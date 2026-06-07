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

    it('lève BadRequestException si la bande passante est insuffisante (< 30s de streaming)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        bandwidthBytesRemaining: BigInt(0),
      });
      await expect(service.start('user-1', 'key-1', sessionData)).rejects.toThrow(BadRequestException);
    });

    it('démarre une session sans déduire de bande passante au lancement', async () => {
      const initialBalance = BigInt(2 * 1024 * 1024 * 1024);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        bandwidthBytesRemaining: initialBalance,
      });
      mockPrisma.session.create.mockResolvedValue({ id: 'sess-1' });
      mockPrisma.sessionProxy.createMany.mockResolvedValue({});

      const result = await service.start('user-1', 'key-1', sessionData);

      expect(result.sessionId).toBe('sess-1');
      expect(result.proxies).toHaveLength(1);
      expect(result.bandwidthReservedBytes).toBe(0);
      // Aucune déduction au démarrage
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalledWith('session:sess-1:heartbeat', '1', 'EX', 90);
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
      platform: 'twitch',
      startedAt: new Date(Date.now() - 60_000), // 60s ago
      instanceCount: 1,
      bytesEstimated: BigInt(0),
    };

    it('ne fait rien si la session n\'existe pas', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(null);
      await service.finalizeSession('sess-missing');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('déduit les bytes finaux fournis en paramètre (dernier intervalle non reporté via heartbeat)', async () => {
      mockPrisma.session.findUnique.mockResolvedValue(baseSession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.session.update = jest.fn().mockResolvedValue({});

      const finalBytes = 12_345_678;
      await service.finalizeSession('sess-1', finalBytes);

      // user.update doit déduire exactement les finalBytes
      const userUpdate = mockPrisma.user.update.mock.calls[0][0];
      expect(userUpdate.data.bandwidthBytesRemaining.decrement).toBe(finalBytes);
      expect(userUpdate.data.bandwidthBytesUsedTotal.increment).toBe(finalBytes);
    });

    it('émet broadcastSessionUpdate et supprime la clé Redis à la fin', async () => {
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

    it('ne crée pas de transaction si la durée est nulle (session immédiatement arrêtée)', async () => {
      const instantSession = { ...baseSession, startedAt: new Date() };
      mockPrisma.session.findUnique.mockResolvedValue(instantSession);
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      await service.finalizeSession('sess-1');

      expect(mockPrisma.bandwidthTransaction.create).not.toHaveBeenCalled();
      expect(mockGateway.broadcastSessionUpdate).toHaveBeenCalledWith({ id: 'sess-1', status: 'ended' });
    });
  });

  describe('expireDeadSessions', () => {
    it('continue de traiter les sessions suivantes si l\'une échoue (isolation erreur)', async () => {
      mockPrisma.session.findMany.mockResolvedValue([
        { id: 'sess-err' },
        { id: 'sess-ok' },
      ]);

      const okSession = {
        id: 'sess-ok',
        userId: 'user-1',
        status: 'active',
        platform: 'twitch',
        startedAt: new Date(Date.now() - 60_000),
        instanceCount: 1,
        bytesEstimated: BigInt(0),
      };

      mockPrisma.session.findUnique
        .mockResolvedValueOnce({ ...okSession, id: 'sess-err' })
        .mockResolvedValueOnce(okSession);

      mockPrisma.session.updateMany
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce({ count: 1 });

      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.bandwidthTransaction.create.mockResolvedValue({});

      await service.expireDeadSessions();

      expect(mockGateway.broadcastSessionUpdate).toHaveBeenCalledWith({ id: 'sess-ok', status: 'ended' });
      expect(mockGateway.broadcastSessionUpdate).not.toHaveBeenCalledWith({ id: 'sess-err', status: 'ended' });
    });
  });
});
