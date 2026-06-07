import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const UNLIMITED_BYTES = 10 * 1024 * 1024 * 1024 * 1024; // 10 To créditées par cycle de facturation

const PRODUCT_DEFINITIONS = [
  {
    id: 'starter',
    name: 'Starter',
    description: '10 Go de bande passante',
    bytes: 10 * 1024 * 1024 * 1024,
    priceEur: 4.99,
    isSubscription: false,
    envKey: 'STRIPE_PRICE_STARTER',
    fallbackPriceId: 'price_starter',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: '50 Go de bande passante',
    bytes: 50 * 1024 * 1024 * 1024,
    priceEur: 19.99,
    isSubscription: false,
    envKey: 'STRIPE_PRICE_STANDARD',
    fallbackPriceId: 'price_standard',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: '200 Go de bande passante',
    bytes: 200 * 1024 * 1024 * 1024,
    priceEur: 59.99,
    isSubscription: false,
    envKey: 'STRIPE_PRICE_PRO',
    fallbackPriceId: 'price_pro',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Bande passante illimitée — abonnement mensuel',
    bytes: null,
    priceEur: 99.99,
    isSubscription: true,
    envKey: 'STRIPE_PRICE_UNLIMITED',
    fallbackPriceId: 'price_unlimited',
  },
] as const;

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get<string>('stripe.secretKey')!);
  }

  private getStripePriceId(productId: string): string {
    const priceIds = this.config.get<Record<string, string>>('stripe.priceIds') ?? {};
    return priceIds[productId] ?? `price_${productId}`;
  }

  getProducts() {
    return PRODUCT_DEFINITIONS.map(({ id, name, description, bytes, priceEur, isSubscription }) => ({
      id,
      name,
      description,
      bytes,
      priceEur,
      isSubscription,
    }));
  }

  async createCheckout(userId: string, productId: string, successUrl: string, cancelUrl: string) {
    const def = PRODUCT_DEFINITIONS.find((p) => p.id === productId);
    if (!def) throw new BadRequestException('Unknown product');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({ email: user.email });
      // Atomic write: only save if no other concurrent request already saved a customer.
      // updateMany(WHERE stripeCustomerId IS NULL) → count=0 means we lost the race.
      const saved = await this.prisma.user.updateMany({
        where: { id: userId, stripeCustomerId: null },
        data: { stripeCustomerId: customer.id },
      });
      if (saved.count === 0) {
        // Another concurrent checkout already created and saved a customer; use theirs.
        const fresh = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { stripeCustomerId: true },
        });
        stripeCustomerId = fresh!.stripeCustomerId!;
      } else {
        stripeCustomerId = customer.id;
      }
    }

    const stripePriceId = this.getStripePriceId(def.id);

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: def.isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, productId },
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('stripe.webhookSecret')!;
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, productId } = session.metadata ?? {};
      if (!userId || !productId) return;

      const def = PRODUCT_DEFINITIONS.find((p) => p.id === productId);
      if (!def) return;

      // Subscriptions are credited via invoice.payment_succeeded (fires on every renewal
      // including the first one). Crediting here would double-count the initial subscription.
      if (def.isSubscription) return;

      // Idempotency: session.id is always non-null; prevents double-credit on Stripe retries.
      const existing = await this.prisma.bandwidthTransaction.findFirst({
        where: { stripePaymentId: session.id },
      });
      if (existing) return;

      const bytesToCredit = def.bytes ?? UNLIMITED_BYTES;

      try {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.user.update({
            where: { id: userId },
            data: { bandwidthBytesRemaining: { increment: bytesToCredit } },
          });
          await tx.bandwidthTransaction.create({
            data: {
              userId,
              type: 'purchase',
              bytesDelta: bytesToCredit,
              description: `Achat ${def.name}`,
              stripePaymentId: session.id,
            },
          });
        });
        this.logger.log(`Credited ${bytesToCredit} bytes to user ${userId}`);
      } catch (e: unknown) {
        // P2002 = unique constraint on stripePaymentId: a concurrent webhook delivery
        // already committed this credit. Transaction rolled back — nothing to do.
        if ((e as { code?: string }).code === 'P2002') return;
        throw e;
      }
    }

    // Monthly subscription renewal — checkout.session.completed fires only once (initial).
    // Subsequent billing cycles emit invoice.payment_succeeded; we credit UNLIMITED_BYTES again.
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.subscription) return; // ignore one-time payment invoices

      const stripeCustomerId = invoice.customer as string;
      const user = await this.prisma.user.findFirst({ where: { stripeCustomerId } });
      if (!user) return;

      const unlimitedPriceId = this.getStripePriceId('unlimited');
      const hasUnlimitedLine = invoice.lines.data.some(
        (line) => (line.price as Stripe.Price | null)?.id === unlimitedPriceId,
      );
      if (!hasUnlimitedLine) return;

      // Idempotency: invoice.id is always non-null; prevents double-credit on Stripe retries.
      const existing = await this.prisma.bandwidthTransaction.findFirst({
        where: { stripePaymentId: invoice.id },
      });
      if (existing) return;

      try {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.user.update({
            where: { id: user.id },
            data: { bandwidthBytesRemaining: { increment: UNLIMITED_BYTES } },
          });
          await tx.bandwidthTransaction.create({
            data: {
              userId: user.id,
              type: 'purchase',
              bytesDelta: UNLIMITED_BYTES,
              description: 'Renouvellement Unlimited',
              stripePaymentId: invoice.id,
            },
          });
        });
        this.logger.log(`Subscription renewal: credited ${UNLIMITED_BYTES} bytes to user ${user.id}`);
      } catch (e: unknown) {
        // P2002 = unique constraint on stripePaymentId: concurrent delivery already credited.
        if ((e as { code?: string }).code === 'P2002') return;
        throw e;
      }
    }
  }
}
