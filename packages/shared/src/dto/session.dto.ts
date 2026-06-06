import { Platform } from '../enums/platform.enum';
import { SessionStatus } from '../enums/session-status.enum';

export interface StartSessionDto {
  platform: Platform;
  streamUrl: string;
  instanceCount: number;
  preferProxyCountry?: string;
}

export interface ProxyAssignment {
  index: number;
  address: string;
}

export interface StartSessionResponseDto {
  sessionId: string;
  proxies: ProxyAssignment[];
  bandwidthReservedBytes: number;
  bandwidthRemainingBytes: number;
}

export interface SessionDto {
  id: string;
  platform: Platform;
  streamUrl: string;
  instanceCount: number;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  bytesEstimated: number;
  bytesReconciled: number;
}
