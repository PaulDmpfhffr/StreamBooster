import { Test } from '@nestjs/testing';
import { ProxiesService } from '../proxies.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
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
  });

  describe('getReservedBytesForCount', () => {
    it('réserve 500 Mo par instance', () => {
      expect(service.getReservedBytesForCount(1)).toBe(500 * 1024 * 1024);
      expect(service.getReservedBytesForCount(4)).toBe(4 * 500 * 1024 * 1024);
    });
  });
});
