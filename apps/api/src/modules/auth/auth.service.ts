import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 jours en secondes

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    @InjectRedis() private redis: Redis,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const user = await this.prisma.user.create({
        data: { email, passwordHash },
      });
      return this.buildTokenPair(user);
    } catch (e: unknown) {
      // P2002 = unique constraint violation (race condition: concurrent registrations)
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('Email already registered');
      }
      throw new InternalServerErrorException();
    }
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildTokenPair(user);
  }

  async refresh(userId: string, oldRefreshToken: string) {
    const hash = createHash('sha256').update(oldRefreshToken).digest('hex');
    const key = `auth:refresh:blacklist:${hash}`;
    // Atomic SET NX: write succeeds only if key doesn't exist yet.
    // Two concurrent refresh calls with the same token both attempt this;
    // only one gets 'OK' — the other gets null and is rejected.
    const claimed = await this.redis.set(key, '1', 'EX', REFRESH_TTL, 'NX');
    if (claimed === null) {
      throw new UnauthorizedException('Refresh token already used');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.buildTokenPair(user);
  }

  private buildTokenPair(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.secret'),
      expiresIn: this.config.get<string>('jwt.accessExpiry'),
    });
    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.refreshSecret'),
      expiresIn: this.config.get<string>('jwt.refreshExpiry'),
    });
    return { accessToken, refreshToken };
  }
}
