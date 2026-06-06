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
      const adapter = this.buildAdapter(provider);
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
        for (const sp of session.proxies) {
          if (!sp.proxy.providerCredentialId) continue;

          try {
            const realBytes = await adapter.getUsageBytes(
              sp.proxy.providerCredentialId,
              session.startedAt,
              session.endedAt!,
            );

            if (realBytes === 0) continue;

            const estimated = Number(session.bytesEstimated);
            if (estimated === 0) continue;
            const diff = Math.abs(realBytes - estimated);
            if (diff / estimated > ADJUSTMENT_THRESHOLD) {
              await this.prisma.session.update({
                where: { id: session.id },
                data: { bytesReconciled: realBytes },
              });
              this.logger.debug(
                `Session ${session.id}: estimated=${estimated}, reconciled=${realBytes}`,
              );
            }
          } catch (e) {
            this.logger.error(`Réconciliation session ${session.id}`, e);
          }
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
