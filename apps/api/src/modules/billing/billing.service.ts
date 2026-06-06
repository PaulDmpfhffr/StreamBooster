import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

const PRODUCTS = [
  {
    id: 'starter',
    name: 'Starter',
    description: '10 Go de bande passante',
    bytes: 10 * 1024 * 1024 * 1024,
    priceEur: 4.99,
    isSubscription: false,
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
  },
  {
    id: 'standard',
    name: 'Standard',
    description: '50 Go de bande passante',
    bytes: 50 * 1024 * 1024 * 1024,
    priceEur: 19.99,
    isSubscription: false,
    stripePriceId: process.env.STRIPE_PRICE_STANDARD ?? 'price_standard',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: '200 Go de bande passante',
    bytes: 200 * 1024 * 1024 * 1024,
    priceEur: 59.99,
    isSubscription: false,
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? 'price_pro',
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    description: 'Bande passante illimitée — abonnement mensuel',
    bytes: null,
    priceEur: 99.99,
    isSubscription: true,
    stripePriceId: process.env.STRIPE_PRICE_UNLIMITED ?? 'price_unlimited',
  },
];

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

  getProducts() {
    return PRODUCTS.map(({ id, name, description, bytes, priceEur, isSubscription }) => ({
      id,
      name,
      description,
      bytes,
      priceEur,
      isSubscription,
    }));
  }

  async createCheckout(userId: string, productId: string, successUrl: string, cancelUrl: string) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) throw new BadRequestException('Unknown product');

    let user = await this.prisma.user.findUnique({ where: { id: userId } });
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

    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: product.isSubscription ? 'subscription' : 'payment',
      line_items: [{ price: product.stripePriceId, quantity: 1 }],
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
    } catch (e) {
      throw new BadRequestException('Invalid Stripe signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, productId } = session.metadata ?? {};
      if (!userId || !productId) return;

      const product = PRODUCTS.find((p) => p.id === productId);
      if (!product || !product.bytes) return;

      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            bandwidthBytesRemaining: { increment: product.bytes! },
            bandwidthBytesUsedTotal: { increment: 0 },
          },
        });
        await tx.bandwidthTransaction.create({
          data: {
            userId,
            type: 'purchase',
            bytesDelta: product.bytes!,
            description: `Achat ${product.name}`,
            stripePaymentId: session.payment_intent as string,
          },
        });
      });

      this.logger.log(`Credited ${product.bytes} bytes to user ${userId}`);
    }
  }
}
