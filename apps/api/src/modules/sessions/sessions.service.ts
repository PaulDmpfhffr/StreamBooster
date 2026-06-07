import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { ProxiesService } from '../proxies/proxies.service';
import { SessionsGateway } from './sessions.gateway';

const HEARTBEAT_TTL = 90;
const BITRATE_SOURCE_BYTES_PER_SEC = 5000 * 1024;

@Injectable()
export class SessionsService {
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

    const reservedBytes = this.proxies.getReservedBytesForCount(data.instanceCount);
    // Optimistic early check (not the authoritative check — see atomic updateMany below)
    if (user.bandwidthBytesRemaining < BigInt(reservedBytes)) {
      throw new BadRequestException('Insufficient bandwidth balance');
    }

    const allocated = await this.proxies.allocateProxies(
      data.instanceCount,
      data.preferProxyCountry,
    );

    const session = await this.prisma.$transaction(async (tx) => {
      // Atomic conditional decrement — prevents TOCTOU race when two concurrent
      // start requests both pass the optimistic check before either decrements.
      const deducted = await tx.user.updateMany({
        where: { id: userId, bandwidthBytesRemaining: { gte: reservedBytes } },
        data: { bandwidthBytesRemaining: { decrement: reservedBytes } },
      });
      if (deducted.count === 0) {
        throw new BadRequestException('Insufficient bandwidth balance');
      }

      await tx.bandwidthTransaction.create({
        data: {
          userId,
          type: 'consumption',
          bytesDelta: -reservedBytes,
          description: `Réservation session ${data.platform} ×${data.instanceCount}`,
        },
      });

      const sess = await tx.session.create({
        data: {
          userId,
          apiKeyId,
          platform: data.platform,
          streamUrl: data.streamUrl,
          instanceCount: data.instanceCount,
          bytesEstimated: reservedBytes,
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

    const newBalance = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { bandwidthBytesRemaining: true },
    });

    return {
      sessionId: session.id,
      proxies: allocated.map(({ address }, i) => ({ index: i + 1, address })),
      bandwidthReservedBytes: Number(reservedBytes),
      bandwidthRemainingBytes: Number(newBalance?.bandwidthBytesRemaining ?? 0),
    };
  }

  async heartbeat(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, status: 'active' },
    });
    if (!session) throw new NotFoundException('Session not found or not active');

    await this.redis.set(`session:${sessionId}:heartbeat`, '1', 'EX', HEARTBEAT_TTL);
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastHeartbeatAt: new Date() },
    });

    return { ok: true };
  }

  async stop(sessionId: string, userId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, status: 'active' },
    });
    if (!session) throw new NotFoundException('Session not found');

    await this.finalizeSession(sessionId);
    return { ok: true };
  }

  async findByUser(userId: string) {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  async finalizeSession(sessionId: string) {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'active') return;

    const endedAt = new Date();
    const durationSec = (endedAt.getTime() - session.startedAt.getTime()) / 1000;
    const bytesConsumed = Math.floor(durationSec * session.instanceCount * BITRATE_SOURCE_BYTES_PER_SEC);
    const reserved = Number(session.bytesEstimated);
    const adjustment = reserved - bytesConsumed;

    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: sessionId },
        data: { status: 'ended', endedAt, bytesEstimated: bytesConsumed },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: { bandwidthBytesUsedTotal: { increment: bytesConsumed } },
      });

      if (adjustment !== 0) {
        await tx.user.update({
          where: { id: session.userId },
          data: { bandwidthBytesRemaining: { increment: adjustment } },
        });
        await tx.bandwidthTransaction.create({
          data: {
            userId: session.userId,
            type: adjustment > 0 ? 'refund' : 'consumption',
            bytesDelta: adjustment,
            description: `Ajustement fin session ${sessionId.slice(0, 8)}`,
          },
        });
      }
    });

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
      await this.finalizeSession(id);
    }
  }
}
