import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ProxiesModule } from '../proxies/proxies.module';

@Module({
  imports: [ProxiesModule],
  controllers: [AdminController],
})
export class AdminModule {}
