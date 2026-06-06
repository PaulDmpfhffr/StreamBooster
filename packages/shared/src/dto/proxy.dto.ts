import { ProxyType, ProxyAdapterType } from '../enums/proxy-type.enum';

export interface ProxyDto {
  id: string;
  providerId: string;
  countryCode: string;
  type: ProxyType;
  isActive: boolean;
}

export interface ProxyProviderDto {
  id: string;
  name: string;
  displayName: string;
  adapterType: ProxyAdapterType;
  isActive: boolean;
  priority: number;
  apiEndpoint: string;
}

export interface CreateProxyDto {
  providerId: string;
  address: string;
  countryCode: string;
  type: ProxyType;
  providerCredentialId?: string;
}

export interface CreateProxyProviderDto {
  name: string;
  displayName: string;
  adapterType: ProxyAdapterType;
  apiKey: string;
  apiEndpoint: string;
  priority: number;
}
