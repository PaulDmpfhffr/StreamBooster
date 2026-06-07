import { Test } from '@nestjs/testing';
import { ProxiesService } from '../proxies.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  sessionProxy: { findMany: jest.fn(() => []) },
  proxyProvider: { findMany: jest.fn() },
  proxyPool: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'encryptionKey') return '0'.repeat(64);
    return undefined;
  }),
};

describe('ProxiesService', () => {
  let service: ProxiesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProxiesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(ProxiesService);
    jest.clearAllMocks();
  });

  describe('encrypt/decrypt', () => {
    it('chiffre et déchiffre correctement', () => {
      const plain = 'socks5://user:pass@1.2.3.4:1080';
      const enc = service.encrypt(plain);
      expect(enc).not.toBe(plain);
      expect(enc).toContain(':');
      expect(service.decrypt(enc)).toBe(plain);
    });

    it('produit des chiffrés différents à chaque appel (IV aléatoire)', () => {
      const plain = 'http://proxy.example.com:8080';
      const enc1 = service.encrypt(plain);
      const enc2 = service.encrypt(plain);
      expect(enc1).not.toBe(enc2);
    });
  });

  describe('allocateProxies', () => {
    it('lève BadRequestException si pas assez de proxys disponibles', async () => {
      mockPrisma.proxyProvider.findMany.mockResolvedValue([
        { id: 'p1', priority: 1 },
      ]);
      mockPrisma.proxyPool.findMany.mockResolvedValue([
        { id: 'proxy-1', addressEncrypted: service.encrypt('socks5://1.1.1.1:1080') },
      ]);

      await expect(service.allocateProxies(5)).rejects.toThrow(BadRequestException);
    });

    it('alloue le bon nombre de proxys', async () => {
      const proxyAddress = 'socks5://user:pass@1.2.3.4:1080';
      mockPrisma.proxyProvider.findMany.mockResolvedValue([{ id: 'p1', priority: 1 }]);
      mockPrisma.proxyPool.findMany.mockResolvedValue([
        { id: 'proxy-1', addressEncrypted: service.encrypt(proxyAddress), providerId: 'p1' },
        { id: 'proxy-2', addressEncrypted: service.encrypt('socks5://user:pass@2.2.2.2:1080'), providerId: 'p1' },
        { id: 'proxy-3', addressEncrypted: service.encrypt('socks5://user:pass@3.3.3.3:1080'), providerId: 'p1' },
      ]);

      const allocated = await service.allocateProxies(2);
      expect(allocated).toHaveLength(2);
      expect(allocated[0].address).toBe(proxyAddress);
    });

    it('lève BadRequestException si le ciphertext du proxy est corrompu', async () => {
      mockPrisma.proxyProvider.findMany.mockResolvedValue([{ id: 'p1', priority: 1 }]);
      mockPrisma.proxyPool.findMany.mockResolvedValue([
        { id: 'proxy-1', addressEncrypted: 'deadbeef:notvalidhex!!', providerId: 'p1' },
      ]);

      await expect(service.allocateProxies(1)).rejects.toThrow(BadRequestException);
    });

    it('repli sans filtre pays si preferProxyCountry a moins de proxys que nécessaire', async () => {
      mockPrisma.proxyProvider.findMany.mockResolvedValue([{ id: 'p1', priority: 1 }]);
      // 1er appel : filtré par pays FR → 0 proxys
      // 2ème appel : sans filtre → 2 proxys disponibles
      mockPrisma.proxyPool.findMany
        .mockResolvedValueOnce([]) // filtre FR — aucun résultat
        .mockResolvedValueOnce([   // sans filtre — 2 proxys US
          { id: 'proxy-us-1', addressEncrypted: service.encrypt('socks5://1.1.1.1:1080'), providerId: 'p1' },
          { id: 'proxy-us-2', addressEncrypted: service.encrypt('socks5://2.2.2.2:1080'), providerId: 'p1' },
        ]);

      const allocated = await service.allocateProxies(1, 'FR');

      expect(allocated).toHaveLength(1);
      // Doit avoir utilisé les proxys US (fallback)
      expect(allocated[0].address).toBe('socks5://1.1.1.1:1080');
    });
  });

  describe('getReservedBytesForCount', () => {
    it('réserve 500 Mo par instance', () => {
      expect(service.getReservedBytesForCount(1)).toBe(500 * 1024 * 1024);
      expect(service.getReservedBytesForCount(4)).toBe(4 * 500 * 1024 * 1024);
    });
  });

  describe('deleteProxy', () => {
    it('lève NotFoundException si le proxy n\'existe pas', async () => {
      mockPrisma.proxyPool.findUnique.mockResolvedValue(null);
      await expect(service.deleteProxy('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('supprime le proxy si existant et non utilisé', async () => {
      mockPrisma.proxyPool.findUnique.mockResolvedValue({ id: 'proxy-1' });
      mockPrisma.proxyPool.delete.mockResolvedValue({});
      await service.deleteProxy('proxy-1');
      expect(mockPrisma.proxyPool.delete).toHaveBeenCalledWith({ where: { id: 'proxy-1' } });
    });

    it('lève ConflictException (P2003) si le proxy est utilisé par une session active', async () => {
      mockPrisma.proxyPool.findUnique.mockResolvedValue({ id: 'proxy-1' });
      const p2003 = Object.assign(new Error('FK constraint'), { code: 'P2003' });
      mockPrisma.proxyPool.delete.mockRejectedValue(p2003);
      await expect(service.deleteProxy('proxy-1')).rejects.toThrow(ConflictException);
    });
  });
});
