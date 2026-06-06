import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionsGateway } from './sessions.gateway';
import { ProxiesModule } from '../proxies/proxies.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ProxiesModule, AuthModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsGateway],
  exports: [SessionsService],
})
export class SessionsModule {}
