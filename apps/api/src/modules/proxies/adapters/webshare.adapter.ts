import { Injectable, Logger } from '@nestjs/common';
import { IProxyProviderAdapter, RawProxy } from './proxy-provider.interface';

@Injectable()
export class WebshareAdapter implements IProxyProviderAdapter {
  private readonly logger = new Logger(WebshareAdapter.name);

  constructor(private readonly apiKey: string, private readonly apiEndpoint: string) {}

  async getUsageBytes(_credentialId: string, _from: Date, _to: Date): Promise<number> {
    return 0;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiEndpoint}/proxy/config/`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listAvailableProxies(): Promise<RawProxy[]> {
    try {
      const res = await fetch(`${this.apiEndpoint}/proxy/list/?mode=direct&page=1&page_size=100`, {
        headers: { Authorization: `Token ${this.apiKey}` },
      });
      const data = (await res.json()) as {
        results: Array<{ proxy_address: string; port: number; country_code: string; id: string }>;
      };
      return data.results.map((p) => ({
        address: `http://${p.proxy_address}:${p.port}`,
        countryCode: p.country_code,
        credentialId: p.id,
      }));
    } catch (e) {
      this.logger.error('Webshare listAvailableProxies failed', e);
      return [];
    }
  }
}
