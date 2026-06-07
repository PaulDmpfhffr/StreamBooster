import { Test } from '@nestjs/testing';
import { BillingService } from '../billing.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  bandwidthTransaction: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockStripe = {
  customers: { create: jest.fn(() => ({ id: 'cus_test' })) },
  checkout: {
    sessions: { create: jest.fn(() => ({ url: 'https://stripe.com/pay/cs_test', id: 'cs_test' })) },
  },
  webhooks: { constructEvent: jest.fn() },
};

const mockConfig = { get: jest.fn(() => 'test_value') };

jest.mock('stripe', () => ({
  default: jest.fn(() => mockStripe),
}));

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
    // Rétablir après clearAllMocks car $transaction est utilisé dans chaque test
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
    mockPrisma.bandwidthTransaction.findFirst.mockResolvedValue(null);
    // Atomic customer save: count=1 means we won the race (key was null)
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
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

    it('crée un customer Stripe si inexistant et le sauvegarde atomiquement', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        stripeCustomerId: null,
      });

      const result = await service.createCheckout(
        'user-1', 'starter', 'http://success', 'http://cancel',
      );

      expect(mockStripe.customers.create).toHaveBeenCalledWith({ email: 'test@test.com' });
      // updateMany(WHERE stripeCustomerId IS NULL) doit être utilisé pour l'écriture atomique
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', stripeCustomerId: null },
        data: { stripeCustomerId: 'cus_test' },
      });
      expect(result.checkoutUrl).toBe('https://stripe.com/pay/cs_test');
    });

    it('réutilise le customer d\'une requête concurrente si la sauvegarde atomique échoue (count=0)', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', email: 'test@test.com', stripeCustomerId: null })
        .mockResolvedValueOnce({ id: 'user-1', stripeCustomerId: 'cus_concurrent' });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 }); // concurrent request won

      const result = await service.createCheckout(
        'user-1', 'starter', 'http://success', 'http://cancel',
      );

      expect(mockStripe.customers.create).toHaveBeenCalledTimes(1); // created but not saved
      expect(result.checkoutUrl).toBe('https://stripe.com/pay/cs_test');
    });
  });

  describe('handleWebhook', () => {
    const makeEvent = (productId: string, overrides: Record<string, unknown> = {}) => ({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test',
          metadata: { userId: 'user-1', productId },
          payment_intent: 'pi_test',
          subscription: null,
          ...overrides,
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

    it('ignore checkout.session.completed pour unlimited (évite double-crédit avec invoice.payment_succeeded)', async () => {
      // Stripe émet aussi invoice.payment_succeeded sur la première souscription.
      // Ne pas créditer ici empêche de compter 2× les 10 To.
      mockStripe.webhooks.constructEvent.mockReturnValue(makeEvent('unlimited'));
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.bandwidthTransaction.create).not.toHaveBeenCalled();
    });

    it('ignore checkout.session.completed pour unlimited même avec subscription ID fourni', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(
        makeEvent('unlimited', { payment_intent: null, subscription: 'sub_test123' }),
      );
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
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

    it('idempotence — ne crédite pas si stripePaymentId déjà présent (retry Stripe)', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeEvent('starter'));
      (mockPrisma.bandwidthTransaction.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'existing' });
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('idempotence — absorbe P2002 si un call concurrent a déjà inséré le stripePaymentId', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue(makeEvent('starter'));
      // findFirst retourne null (check passe), mais l'insert échoue car l'autre call concurrent a déjà committé
      const p2002 = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      mockPrisma.bandwidthTransaction.create.mockRejectedValueOnce(p2002);
      // Ne doit pas lever d'exception
      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).resolves.not.toThrow();
    });
  });

  describe('handleWebhook — invoice.payment_succeeded (renouvellement abonnement)', () => {
    beforeEach(() => {
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});
    });

    it('crédite 10 To sur renouvellement Unlimited', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_renewal',
            subscription: 'sub_test',
            customer: 'cus_test',
            payment_intent: 'pi_renewal',
            // getStripePriceId('unlimited') retourne 'price_unlimited' (fallback quand config.get n'est pas un objet)
            lines: {
              data: [{ price: { id: 'price_unlimited' } }],
            },
          },
        },
      });
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      const call = mockPrisma.user.update.mock.calls[0][0];
      const TEN_TB = 10 * 1024 * 1024 * 1024 * 1024;
      expect(call.data.bandwidthBytesRemaining.increment).toBe(TEN_TB);
    });

    it('ignore les invoices sans subscription (one-time)', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_succeeded',
        data: { object: { subscription: null, customer: 'cus_test', lines: { data: [] } } },
      });
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('idempotence — ne crédite pas si invoice déjà traitée (retry Stripe)', async () => {
      mockStripe.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_renewal',
            subscription: 'sub_test',
            customer: 'cus_test',
            lines: { data: [{ price: { id: 'price_unlimited' } }] },
          },
        },
      });
      (mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'user-1' });
      (mockPrisma.bandwidthTransaction.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'existing' });
      await service.handleWebhook(Buffer.from('{}'), 'sig');
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });
  });
});
