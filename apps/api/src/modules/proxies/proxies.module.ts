import { Module } from '@nestjs/common';
import { ProxiesService } from './proxies.service';
import { ReconciliationService } from './reconciliation.service';

@Module({
  providers: [ProxiesService, ReconciliationService],
  exports: [ProxiesService],
})
export class ProxiesModule {}
