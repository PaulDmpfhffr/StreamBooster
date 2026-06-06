import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKeyHeader: string | undefined =
      req.headers['x-api-key'] ??
      (req.headers['authorization']?.startsWith('ApiKey ')
        ? req.headers['authorization'].replace('ApiKey ', '')
        : undefined);

    if (apiKeyHeader) {
      const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex');
      const record = await this.prisma.apiKey.findFirst({
        where: { keyHash, isActive: true },
        include: { user: true },
      });
      if (!record) throw new UnauthorizedException('Invalid API key');
      await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
      req.user = record.user;
      req.apiKey = record;
      return true;
    }

    const bearer = req.headers['authorization']?.replace('Bearer ', '');
    if (!bearer) throw new UnauthorizedException();
    try {
      const payload = this.jwt.verify(bearer, {
        secret: this.config.get<string>('jwt.secret'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new UnauthorizedException();
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
