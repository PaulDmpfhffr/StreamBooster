import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    const apiKey: string | undefined =
      request.headers['x-api-key'] ??
      (authHeader?.startsWith('ApiKey ') ? authHeader.replace('ApiKey ', '') : undefined);

    if (!apiKey) throw new UnauthorizedException('API key required');

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });
    if (record && !record.isActive) throw new UnauthorizedException('API key revoked');

    if (!record) throw new UnauthorizedException('Invalid API key');

    await this.prisma.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    request.user = record.user;
    request.apiKey = record;
    return true;
  }
}
