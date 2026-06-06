import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, label: string) {
    const raw = `sb_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(raw).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: { userId, keyHash, label },
    });

    return { id: apiKey.id, label: apiKey.label, key: raw, createdAt: apiKey.createdAt };
  }

  async findAll(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId, isActive: true },
      select: { id: true, label: true, lastUsedAt: true, createdAt: true },
    });
  }

  async revoke(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, userId } });
    if (!key) throw new NotFoundException('API key not found');

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
  }
}
