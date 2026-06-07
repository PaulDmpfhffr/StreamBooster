import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
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
      stripeCustomerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId },
      });
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

      const bytesToCredit = def.bytes ?? UNLIMITED_BYTES;

      // payment_intent is null for subscription mode; fall back to subscription ID
      const stripeRef = (session.payment_intent ?? session.subscription) as string | null;

      await this.prisma.$transaction(async (tx) => {
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
            stripePaymentId: stripeRef,
          },
        });
      });

      this.logger.log(`Credited ${bytesToCredit} bytes to user ${userId}`);
    }
  }
}
