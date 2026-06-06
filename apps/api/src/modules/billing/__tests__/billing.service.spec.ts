import { Test } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  bandwidthTransaction: { create: jest.fn() },
  $transaction: jest.fn((fn: Function) => fn(mockPrisma)),
};

const mockStripe = {
  customers: { create: jest.fn(() => ({ id: 'cus_test' })) },
  checkout: {
    sessions: { create: jest.fn(() => ({ url: 'https://stripe.com/pay/cs_test', id: 'cs_test' })) },
  },
  webhooks: { constructEvent: jest.fn() },
};

const mockConfig = { get: jest.fn(() => 'test_value') };

jest.mock('stripe', () =>
  jest.fn(() => mockStripe),
);

describe('BillingService', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(BillingService);
    jest.clearAllMocks();
  });

  describe('getProducts', () => {
    it('retourne 4 produits', () => {
      const products = service.getProducts();
      expect(products).toHaveLength(4);
      expect(products.map((p) => p.id)).toEqual(['starter', 'standard', 'pro', 'unlimited']);
    });
  });

  describe('createCheckout', () => {
    it('lève BadRequestException pour un produit inconnu', async () => {
      await expect(
        service.createCheckout('user-1', 'unknown', 'http://success', 'http://cancel'),
      ).rejects.toThrow(BadRequestException);
    });

    it('crée un customer Stripe si inexistant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        stripeCustomerId: null,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.createCheckout(
        'user-1', 'starter', 'http://success', 'http://cancel',
      );

      expect(mockStripe.customers.create).toHaveBeenCalledWith({ email: 'test@test.com' });
      expect(result.checkoutUrl).toBe('https://stripe.com/pay/cs_test');
    });
  });

  describe('handleWebhook', () => {
    const makeEvent = (productId: string) => ({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user-1', productId },
          payment_intent: 'pi_test',
        },
      },
    });

    beforeEach(() => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});
    });

    it('crédite les bytes corrects pour le plan starter (10 Go)', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeEvent('starter'));
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      const call = mockPrisma.user.update.mock.calls[0][0];
      expect(call.data.bandwidthBytesRemaining.increment).toBe(10 * 1024 * 1024 * 1024);
    });

    it('crédite 10 To pour le plan unlimited (bytes null → UNLIMITED_BYTES)', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeEvent('unlimited'));
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      const call = mockPrisma.user.update.mock.calls[0][0];
      const TEN_TB = 10 * 1024 * 1024 * 1024 * 1024;
      expect(call.data.bandwidthBytesRemaining.increment).toBe(TEN_TB);
    });

    it('ignore les events inconnus silencieusement', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({ type: 'payment_intent.created', data: { object: {} } });
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('lève BadRequestException si la signature Stripe est invalide', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => { throw new Error('Bad sig'); });
      await expect(service.handleWebhook(Buffer.from('{}'), 'invalid')).rejects.toThrow('Invalid Stripe signature');
    });
  });
});
