import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ProxyPool, ProxyProvider } from '@prisma/client';
import { IPRoyalAdapter } from './adapters/iproyal.adapter';
import { BrightDataAdapter } from './adapters/brightdata.adapter';
import { WebshareAdapter } from './adapters/webshare.adapter';
import { ManualAdapter } from './adapters/manual.adapter';

const RESERVED_BYTES_PER_INSTANCE = 500 * 1024 * 1024;

@Injectable()
export class ProxiesService {
  private readonly encKey: Buffer;

  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    this.encKey = Buffer.from(config.get<string>('encryptionKey')!, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, encHex] = ciphertext.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const enc = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv('aes-256-cbc', this.encKey, iv);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  }

  async allocateProxies(
    instanceCount: number,
    preferCountry?: string,
  ): Promise<Array<{ proxy: ProxyPool; address: string }>> {
    const activeSessions = await this.prisma.sessionProxy.findMany({
      where: { session: { status: 'active' } },
      select: { proxyId: true },
    });
    const usedProxyIds = new Set(activeSessions.map((sp) => sp.proxyId));

    const providers = await this.prisma.proxyProvider.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    const available: Array<{ proxy: ProxyPool; provider: ProxyProvider }> = [];
    for (const provider of providers) {
      const proxies = await this.prisma.proxyPool.findMany({
        where: {
          providerId: provider.id,
          isActive: true,
          ...(preferCountry ? { countryCode: preferCountry } : {}),
        },
      });
      for (const proxy of proxies) {
        if (!usedProxyIds.has(proxy.id)) {
          available.push({ proxy, provider });
        }
      }
    }

    if (available.length < instanceCount) {
      throw new BadRequestException(
        `Not enough proxies available. Need ${instanceCount}, have ${available.length}`,
      );
    }

    const providerCounts = new Map<string, number>();
    const selected: Array<{ proxy: ProxyPool; address: string }> = [];

    for (let i = 0; i < instanceCount; i++) {
      const candidate = available.find(({ proxy, provider }) => {
        if (selected.some((s) => s.proxy.id === proxy.id)) return false;
        const count = providerCounts.get(provider.id) ?? 0;
        return count < Math.ceil(instanceCount / providers.length) + 1;
      }) ?? available.find(({ proxy }) => !selected.some((s) => s.proxy.id === proxy.id));

      if (!candidate) throw new BadRequestException('Proxy allocation failed');

      let address: string;
      try {
        address = this.decrypt(candidate.proxy.addressEncrypted);
      } catch {
        throw new BadRequestException('Proxy data corrupted — contact support');
      }
      selected.push({ proxy: candidate.proxy, address });
      providerCounts.set(
        candidate.provider.id,
        (providerCounts.get(candidate.provider.id) ?? 0) + 1,
      );
    }

    return selected;
  }

  async createProxy(data: {
    providerId: string;
    address: string;
    countryCode: string;
    type: 'residential' | 'mobile' | 'datacenter';
    providerCredentialId?: string;
  }) {
    const addressEncrypted = this.encrypt(data.address);
    return this.prisma.proxyPool.create({
      data: {
        providerId: data.providerId,
        addressEncrypted,
        countryCode: data.countryCode,
        type: data.type,
        providerCredentialId: data.providerCredentialId,
      },
    });
  }

  async findAllProxies() {
    return this.prisma.proxyPool.findMany({
      include: { provider: { select: { displayName: true } } },
    });
  }

  async deleteProxy(id: string) {
    const proxy = await this.prisma.proxyPool.findUnique({ where: { id } });
    if (!proxy) throw new NotFoundException('Proxy not found');
    try {
      await this.prisma.proxyPool.delete({ where: { id } });
    } catch (e: unknown) {
      // P2003 = foreign key constraint (proxy used by an active session)
      if ((e as { code?: string }).code === 'P2003') {
        throw new ConflictException('Proxy is in use by an active session');
      }
      throw e;
    }
  }

  async createProvider(data: {
    name: string;
    displayName: string;
    adapterType: 'iproyal' | 'brightdata' | 'webshare' | 'manual';
    apiKey: string;
    apiEndpoint: string;
    priority: number;
  }) {
    const apiKeyEncrypted = this.encrypt(data.apiKey);
    return this.prisma.proxyProvider.create({
      data: {
        name: data.name,
        displayName: data.displayName,
        adapterType: data.adapterType,
        apiKeyEncrypted,
        apiEndpoint: data.apiEndpoint,
        priority: data.priority,
      },
    });
  }

  async findAllProviders() {
    return this.prisma.proxyProvider.findMany({
      select: {
        id: true,
        name: true,
        displayName: true,
        adapterType: true,
        isActive: true,
        priority: true,
        apiEndpoint: true,
      },
    });
  }

  getReservedBytesForCount(instanceCount: number): number {
    return instanceCount * RESERVED_BYTES_PER_INSTANCE;
  }

  async testProviderHealth(providerId: string): Promise<boolean> {
    const provider = await this.prisma.proxyProvider.findUnique({ where: { id: providerId } });
    if (!provider) throw new NotFoundException('Provider not found');

    const apiKey = provider.apiKeyEncrypted ? this.decrypt(provider.apiKeyEncrypted) : '';
    let adapter;
    switch (provider.adapterType) {
      case 'iproyal': adapter = new IPRoyalAdapter(apiKey, provider.apiEndpoint); break;
      case 'brightdata': adapter = new BrightDataAdapter(apiKey, provider.apiEndpoint); break;
      case 'webshare': adapter = new WebshareAdapter(apiKey, provider.apiEndpoint); break;
      default: adapter = new ManualAdapter();
    }
    return adapter.isHealthy();
  }
}
