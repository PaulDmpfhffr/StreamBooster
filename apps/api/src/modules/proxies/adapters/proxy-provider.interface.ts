export interface RawProxy {
  address: string;
  countryCode: string;
  credentialId: string;
}

export interface IProxyProviderAdapter {
  getUsageBytes(credentialId: string, from: Date, to: Date): Promise<number>;
  isHealthy(): Promise<boolean>;
  listAvailableProxies(): Promise<RawProxy[]>;
}
