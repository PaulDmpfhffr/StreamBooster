import { Test } from '@nestjs/testing';
import { SessionsService } from '../sessions.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProxiesService } from '../../proxies/proxies.service';
import { SessionsGateway } from '../sessions.gateway';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  session: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
  bandwidthTransaction: { create: jest.fn() },
  sessionProxy: { createMany: jest.fn() },
  $transaction: jest.fn(),
};

const mockProxies = {
  getReservedBytesForCount: jest.fn(() => 500 * 1024 * 1024),
  allocateProxies: jest.fn(() => [
    { proxy: { id: 'proxy-1' }, address: 'socks5://1.1.1.1:1080' },
  ]),
};

const mockGateway = { broadcastSessionUpdate: jest.fn() };
const mockRedis = { set: jest.fn(), del: jest.fn(), exists: jest.fn() };

describe('SessionsService', () => {
  let service: SessionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProxiesService, useValue: mockProxies },
        { provide: SessionsGateway, useValue: mockGateway },
        { provide: getRedisConnectionToken(), useValue: mockRedis },
      ],
    }).compile();

    service = module.get(SessionsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((fn) => fn(mockPrisma));
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
  });

  describe('start', () => {
    const sessionData = { platform: 'twitch', streamUrl: 'https://twitch.tv/test', instanceCount: 1 };

    it('lève ForbiddenException si l\'utilisateur n\'existe pas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.start('unknown', 'key-1', sessionData)).rejects.toThrow(ForbiddenException);
    });

    it('lève BadRequestException si la bande passante est insuffisante', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        bandwidthBytesRemaining: BigInt(0),
      });
      await expect(service.start('user-1', 'key-1', sessionData)).rejects.toThrow(BadRequestException);
    });

    it('démarre une session et retourne sessionId + proxys', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 'user-1', bandwidthBytesRemaining: BigInt(2 * 1024 * 1024 * 1024) })
        .mockResolvedValueOnce({ bandwidthBytesRemaining: BigInt(1.5 * 1024 * 1024 * 1024) });
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 }); // solde suffisant
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-1' });
      mockPrisma.sessionProxy.createMany.mockResolvedValue({});

      const result = await service.start('user-1', 'key-1', sessionData);

      expect(result.sessionId).toBe('sess-1');
      expect(result.proxies).toHaveLength(1);
      expect(mockRedis.set).toHaveBeenCalledWith('session:sess-1:heartbeat', '1', 'EX', 90);
    });

    it('lève BadRequestException si le solde passe à zéro entre le check et la transaction (race condition)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        bandwidthBytesRemaining: BigInt(2 * 1024 * 1024 * 1024),
      });
      // updateMany renvoie count=0 : un autre appel concurrent a déjà préempté le solde
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.start('user-1', 'key-1', sessionData)).rejects.toThrow(BadRequestException);
    });
  });

  describe('heartbeat', () => {
    it('lève NotFoundException si la session n\'existe pas', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);
      await expect(service.heartbeat('sess-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('renouvelle le TTL Redis sur heartbeat valide', async () => {
      mockPrisma.session.findFirst.mockResolvedValue({ id: 'sess-1', userId: 'user-1', status: 'active' });
      mockPrisma.session.update.mockResolvedValue({});

      await service.heartbeat('sess-1', 'user-1');

      expect(mockRedis.set).toHaveBeenCalledWith('session:sess-1:heartbeat', '1', 'EX', 90);
    });
  });

  describe('stop', () => {
    it('lève NotFoundException si la session n\'existe pas', async () => {
      mockPrisma.session.findFirst.mockResolvedValue(null);
      await expect(service.stop('sess-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('retourne ok:true sans finaliser si la session est déjà terminée (idempotence)', async () => {
      mockPrisma.session.findFirst.mockResolvedValue({ id: 'sess-1', userId: 'user-1', status: 'ended' });
      const result = await service.stop('sess-1', 'user-1');
      expect(result).toEqual({ ok: true });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('finalizeSession', () => {
    const baseSession = {
      id: 'sess-1',
      userId: 'user-1',
      status: 'active',
      startedAt: new Date(Date.now() - 60_000), // 60s ago
      instanceCount: 1,
      bytesEstimated: BigInt(500 * 1024 * 1024),
    };

    it('ne fait rien si la session n\'existe pas', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);
      await service.finalizeSession('sess-missing');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('émet broadcastSessionUpdate à la fin', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(baseSession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});

      await service.finalizeSession('sess-1');

      expect(mockGateway.broadcastSessionUpdate).toHaveBeenCalledWith({ id: 'sess-1', status: 'ended' });
      expect(mockRedis.del).toHaveBeenCalledWith('session:sess-1:heartbeat');
    });

    it('ne fait rien si la session a déjà été finalisée par un appel concurrent (updateMany count=0)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(baseSession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 0 });

      await service.finalizeSession('sess-1');

      expect(mockGateway.broadcastSessionUpdate).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('rembourse les bytes si la consommation réelle est inférieure à la réservation', async () => {
      // 1s de session → consommation très faible < 500 Mo réservé
      const shortSession = { ...baseSession, startedAt: new Date(Date.now() - 1_000) };
      mockPrisma.session.findUnique.mockResolvedValue(shortSession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});

      await service.finalizeSession('sess-1');

      // La transaction de refund doit être créée (adjustment > 0)
      const txCall = mockPrisma.bandwidthTransaction.create.mock.calls[0][0];
      expect(txCall.data.type).toBe('refund');
      expect(txCall.data.bytesDelta).toBeGreaterThan(0);
    });

    it('débite le dépassement si la consommation dépasse la réservation', async () => {
      // 1 heure de session à 5 MB/s >> 500 Mo réservé
      const longSession = { ...baseSession, startedAt: new Date(Date.now() - 3_600_000) };
      mockPrisma.session.findUnique.mockResolvedValue(longSession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});

      await service.finalizeSession('sess-1');

      // La transaction de consumption doit être créée (adjustment < 0)
      const txCall = mockPrisma.bandwidthTransaction.create.mock.calls[0][0];
      expect(txCall.data.type).toBe('consumption');
      expect(txCall.data.bytesDelta).toBeLessThan(0);
    });
  });
});
