import { Injectable, Logger } from '@nestjs/common';
import { IProxyProviderAdapter, RawProxy } from './proxy-provider.interface';

@Injectable()
export class BrightDataAdapter implements IProxyProviderAdapter {
  private readonly logger = new Logger(BrightDataAdapter.name);

  constructor(private readonly apiKey: string, private readonly apiEndpoint: string) {}

  async getUsageBytes(credentialId: string, from: Date, to: Date): Promise<number> {
    try {
      const res = await fetch(
        `${this.apiEndpoint}/usage?zone=${credentialId}&start=${from.toISOString()}&end=${to.toISOString()}`,
        { headers: { Authorization: `Bearer ${this.apiKey}` } },
      );
      const data = (await res.json()) as { bw: number };
      return data.bw ?? 0;
    } catch (e) {
      this.logger.error('BrightData getUsageBytes failed', e);
      return 0;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiEndpoint}/ping`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listAvailableProxies(): Promise<RawProxy[]> {
    return [];
  }
}
