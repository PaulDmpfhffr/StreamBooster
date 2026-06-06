import { Injectable } from '@nestjs/common';
import { IProxyProviderAdapter, RawProxy } from './proxy-provider.interface';

@Injectable()
export class ManualAdapter implements IProxyProviderAdapter {
  async getUsageBytes(_credentialId: string, _from: Date, _to: Date): Promise<number> {
    return 0;
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async listAvailableProxies(): Promise<RawProxy[]> {
    return [];
  }
}
