import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { JwtOrApiKeyGuard } from '../auth/guards/jwt-or-api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Controller('api/v1/account')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  @UseGuards(JwtOrApiKeyGuard)
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      bandwidthBytesRemaining: Number(user.bandwidthBytesRemaining),
      bandwidthBytesUsedTotal: Number(user.bandwidthBytesUsedTotal),
    };
  }

  @Get('usage')
  @UseGuards(JwtGuard)
  async getUsage(@CurrentUser() user: User) {
    const [sessions, transactions] = await Promise.all([
      this.prisma.session.findMany({
        where: { userId: user.id },
        orderBy: { startedAt: 'desc' },
        take: 20,
      }),
      this.prisma.bandwidthTransaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return { sessions, transactions };
  }
}
