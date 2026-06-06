import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLogInterceptor } from '../../common/interceptors/audit-log.interceptor';
import { PrismaService } from '../prisma/prisma.service';
import { ProxiesService } from '../proxies/proxies.service';

@Controller('api/v1/admin')
@UseGuards(JwtGuard, RolesGuard)
@Roles('admin')
@UseInterceptors(AuditLogInterceptor)
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private proxies: ProxiesService,
  ) {}

  @Get('stats')
  async getStats() {
    const [userCount, activeSessions, totalBandwidthSold] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.session.count({ where: { status: 'active' } }),
      this.prisma.bandwidthTransaction.aggregate({
        where: { type: 'purchase' },
        _sum: { bytesDelta: true },
      }),
    ]);
    return {
      userCount,
      activeSessions,
      totalBandwidthSoldBytes: Number(totalBandwidthSold._sum.bytesDelta ?? 0),
    };
  }

  @Get('users')
  getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        bandwidthBytesRemaining: true,
        bandwidthBytesUsedTotal: true,
        createdAt: true,
      },
    });
  }

  @Patch('users/:id/bandwidth')
  async adjustBandwidth(
    @Param('id') userId: string,
    @Body() body: { bytesDelta: number; reason: string },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { bandwidthBytesRemaining: { increment: body.bytesDelta } },
      });
      await tx.bandwidthTransaction.create({
        data: {
          userId,
          type: body.bytesDelta > 0 ? 'purchase' : 'consumption',
          bytesDelta: body.bytesDelta,
          description: `Ajustement admin: ${body.reason}`,
        },
      });
    });
    return { ok: true };
  }

  @Get('proxies')
  getProxies() {
    return this.proxies.findAllProxies();
  }

  @Post('proxies')
  createProxy(
    @Body() body: {
      providerId: string;
      address: string;
      countryCode: string;
      type: 'residential' | 'mobile' | 'datacenter';
      providerCredentialId?: string;
    },
  ) {
    return this.proxies.createProxy(body);
  }

  @Delete('proxies/:id')
  deleteProxy(@Param('id') id: string) {
    return this.proxies.deleteProxy(id);
  }

  @Get('providers')
  getProviders() {
    return this.proxies.findAllProviders();
  }

  @Post('providers')
  createProvider(
    @Body() body: {
      name: string;
      displayName: string;
      adapterType: 'iproyal' | 'brightdata' | 'webshare' | 'manual';
      apiKey: string;
      apiEndpoint: string;
      priority: number;
    },
  ) {
    return this.proxies.createProvider(body);
  }

  @Get('sessions')
  getSessions() {
    return this.prisma.session.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }
}
