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
    const apiKey: string | undefined =
      request.headers['x-api-key'] ?? request.headers['authorization']?.replace('ApiKey ', '');

    if (!apiKey) throw new UnauthorizedException('API key required');

    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const record = await this.prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
      include: { user: true },
    });

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
