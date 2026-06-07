import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProxiesService } from './proxies.service';
import { IPRoyalAdapter } from './adapters/iproyal.adapter';
import { BrightDataAdapter } from './adapters/brightdata.adapter';
import { WebshareAdapter } from './adapters/webshare.adapter';
import { ManualAdapter } from './adapters/manual.adapter';
import { IProxyProviderAdapter } from './adapters/proxy-provider.interface';

const ADJUSTMENT_THRESHOLD = 0.10;

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private prisma: PrismaService,
    private proxies: ProxiesService,
  ) {}

  @Cron('0 */4 * * *')
  async reconcileAllProviders() {
    this.logger.log('Démarrage réconciliation fournisseurs...');

    const providers = await this.prisma.proxyProvider.findMany({
      where: { isActive: true },
    });

    for (const provider of providers) {
      let adapter: IProxyProviderAdapter | null;
      try {
        adapter = this.buildAdapter(provider);
      } catch (e) {
        this.logger.error(`Impossible de créer l'adaptateur pour ${provider.name}`, e);
        continue;
      }
      if (!adapter) continue;

      const sessions = await this.prisma.session.findMany({
        where: {
          status: 'ended',
          endedAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
        },
        include: {
          proxies: {
            where: { proxy: { providerId: provider.id } },
            include: { proxy: true },
          },
        },
      });

      for (const session of sessions) {
        try {
          // Accumulate bytes across ALL proxies of this session for this provider
          // before writing — otherwise last-write-wins when a session has multiple
          // proxies from the same provider.
          let totalRealBytes = 0;
          let hasProviderData = false;

          for (const sp of session.proxies) {
            if (!sp.proxy.providerCredentialId) continue;
            try {
              const realBytes = await adapter.getUsageBytes(
                sp.proxy.providerCredentialId,
                session.startedAt,
                session.endedAt!,
              );
              if (realBytes > 0) {
                totalRealBytes += realBytes;
                hasProviderData = true;
              }
            } catch (e) {
              this.logger.error(`Réconciliation proxy ${sp.proxy.id} session ${session.id}`, e);
            }
          }

          if (!hasProviderData) continue;

          const estimated = Number(session.bytesEstimated);
          if (estimated === 0) continue;
          const diff = Math.abs(totalRealBytes - estimated);
          if (diff / estimated > ADJUSTMENT_THRESHOLD) {
            await this.prisma.session.update({
              where: { id: session.id },
              data: { bytesReconciled: totalRealBytes },
            });
            this.logger.debug(
              `Session ${session.id}: estimated=${estimated}, reconciled=${totalRealBytes}`,
            );
          }
        } catch (e) {
          this.logger.error(`Échec réconciliation session ${session.id}`, e);
        }
      }
    }

    this.logger.log('Réconciliation terminée');
  }

  private buildAdapter(provider: {
    adapterType: string;
    apiKeyEncrypted: string | null;
    apiEndpoint: string;
  }): IProxyProviderAdapter | null {
    const apiKey = provider.apiKeyEncrypted
      ? this.proxies.decrypt(provider.apiKeyEncrypted)
      : '';

    switch (provider.adapterType) {
      case 'iproyal': return new IPRoyalAdapter(apiKey, provider.apiEndpoint);
      case 'brightdata': return new BrightDataAdapter(apiKey, provider.apiEndpoint);
      case 'webshare': return new WebshareAdapter(apiKey, provider.apiEndpoint);
      default: return new ManualAdapter();
    }
  }
}
