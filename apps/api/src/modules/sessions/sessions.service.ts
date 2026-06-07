import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { ProxiesService } from '../proxies/proxies.service';
import { SessionsGateway } from './sessions.gateway';

const HEARTBEAT_TTL = 90;

// Consommation minimale pour pouvoir démarrer (30s × 1 instance à ~5 MB/s)
const MIN_BYTES_TO_START = (instanceCount: number) =>
  instanceCount * 5000 * 1024 * 30;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private prisma: PrismaService,
    private proxies: ProxiesService,
    private gateway: SessionsGateway,
    @InjectRedis() private redis: Redis,
  ) {}

  async start(userId: string, apiKeyId: string, data: {
    platform: string;
    streamUrl: string;
    instanceCount: number;
    preferProxyCountry?: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException();

    if (Number(user.bandwidthBytesRemaining) < MIN_BYTES_TO_START(data.instanceCount)) {
      throw new BadRequestException('Insufficient bandwidth balance');
    }

    const allocated = await this.proxies.allocateProxies(
      data.instanceCount,
      data.preferProxyCountry,
    );

    const session = await this.prisma.$transaction(async (tx) => {
      const sess = await tx.session.create({
        data: {
          userId,
          apiKeyId,
          platform: data.platform,
          streamUrl: data.streamUrl,
          instanceCount: data.instanceCount,
          bytesEstimated: 0,
          lastHeartbeatAt: new Date(),
        },
      });

      await tx.sessionProxy.createMany({
        data: allocated.map(({ proxy }, i) => ({
          sessionId: sess.id,
          proxyId: proxy.id,
          instanceIndex: i + 1,
        })),
      });

      return sess;
    });

    await this.redis.set(`session:${session.id}:heartbeat`, '1', 'EX', HEARTBEAT_TTL);

    return {
      sessionId: session.id,
      proxies: allocated.map(({ address }, i) => ({ index: i + 1, address })),
      bandwidthReservedBytes: 0,
      bandwidthRemainingBytes: Number(user.bandwidthBytesRemaining),
    };
  }

  async heartbeat(sessionId: string, userId: string, bytesConsumed: number = 0) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, status: 'active' },
    });
    if (!session) throw new NotFoundException('Session not found or not active');

    await this.redis.set(`session:${sessionId}:heartbeat`, '1', 'EX', HEARTBEAT_TTL);

    if (bytesConsumed > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: sessionId },
          data: {
            lastHeartbeatAt: new Date(),
            bytesEstimated: { increment: bytesConsumed },
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            bandwidthBytesRemaining: { decrement: bytesConsumed },
            bandwidthBytesUsedTotal: { increment: bytesConsumed },
          },
        });
      });
    } else {
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { lastHeartbeatAt: new Date() },
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bandwidthBytesRemaining: true },
    });

    return {
      ok: true,
      bandwidthRemainingBytes: Number(user?.bandwidthBytesRemaining ?? 0),
    };
  }

  async stop(sessionId: string, userId: string, finalBytes: number = 0) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (session.status !== 'active') return { ok: true };

    await this.finalizeSession(sessionId, finalBytes);
    return { ok: true };
  }

  async findByUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async finalizeSession(sessionId: string, finalBytes: number = 0) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'active') return;

    const finalized = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.session.updateMany({
        where: { id: sessionId, status: 'active' },
        data: { status: 'ended', endedAt: new Date() },
      });
      if (claimed.count === 0) return false;

      // Déduit les bytes du dernier intervalle non encore reportés via heartbeat.
      if (finalBytes > 0) {
        await tx.user.update({
          where: { id: session.userId },
          data: {
            bandwidthBytesRemaining: { decrement: finalBytes },
            bandwidthBytesUsedTotal: { increment: finalBytes },
          },
        });
        await tx.session.update({
          where: { id: sessionId },
          data: { bytesEstimated: { increment: finalBytes } },
        });
      }

      return true;
    });

    if (!finalized) return;
    await this.redis.del(`session:${sessionId}:heartbeat`);
    this.gateway.broadcastSessionUpdate({ id: sessionId, status: 'ended' });
  }

  @Cron('*/30 * * * * *')
  async expireDeadSessions() {
    const timeout = new Date(Date.now() - HEARTBEAT_TTL * 1000);
    const deadSessions = await this.prisma.session.findMany({
      where: {
        status: 'active',
        lastHeartbeatAt: { lt: timeout },
      },
      select: { id: true },
    });

    for (const { id } of deadSessions) {
      await this.finalizeSession(id, 0).catch((err) => {
        this.logger.error(`Échec finalisation session expirée ${id}`, err);
      });
    }
  }
}
