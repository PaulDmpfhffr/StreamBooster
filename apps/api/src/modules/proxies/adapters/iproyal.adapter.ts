import { Injectable, Logger } from '@nestjs/common';
import { IProxyProviderAdapter, RawProxy } from './proxy-provider.interface';

@Injectable()
export class IPRoyalAdapter implements IProxyProviderAdapter {
  private readonly logger = new Logger(IPRoyalAdapter.name);

  constructor(private readonly apiKey: string, private readonly apiEndpoint: string) {}

  async getUsageBytes(credentialId: string, from: Date, to: Date): Promise<number> {
    try {
      const res = await fetch(
        `${this.apiEndpoint}/usage?credential=${credentialId}&from=${from.toISOString()}&to=${to.toISOString()}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      const data = (await res.json()) as { bytes: number };
      return data.bytes ?? 0;
    } catch (e) {
      this.logger.error('IPRoyal getUsageBytes failed', e);
      return 0;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiEndpoint}/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listAvailableProxies(): Promise<RawProxy[]> {
    try {
      const res = await fetch(`${this.apiEndpoint}/proxies`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const data = (await res.json()) as Array<{
        address: string;
        country: string;
        id: string;
      }>;
      return data.map((p) => ({
        address: p.address,
        countryCode: p.country,
        credentialId: p.id,
      }));
    } catch (e) {
      this.logger.error('IPRoyal listAvailableProxies failed', e);
      return [];
    }
  }
}
