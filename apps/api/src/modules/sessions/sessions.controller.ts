import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionsService } from './sessions.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, ApiKey } from '@prisma/client';
import { Request } from 'express';

class StartSessionDto {
  @IsString()
  @IsNotEmpty()
  platform!: string;

  @IsString()
  @IsNotEmpty()
  streamUrl!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  @Type(() => Number)
  instanceCount!: number;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  preferProxyCountry?: string;
}

interface RequestWithApiKey extends Request {
  user: User;
  apiKey: ApiKey;
}

@Controller('api/v1/sessions')
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post('start')
  @UseGuards(ApiKeyGuard)
  start(
    @Req() req: RequestWithApiKey,
    @Body() body: StartSessionDto,
  ) {
    return this.sessionsService.start(req.user.id, req.apiKey.id, body);
  }

  @Post(':id/heartbeat')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  heartbeat(@Req() req: RequestWithApiKey, @Param('id') sessionId: string) {
    return this.sessionsService.heartbeat(sessionId, req.user.id);
  }

  @Post(':id/stop')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  stop(@Req() req: RequestWithApiKey, @Param('id') sessionId: string) {
    return this.sessionsService.stop(sessionId, req.user.id);
  }

  @Get()
  @UseGuards(JwtGuard)
  findAll(@CurrentUser() user: User) {
    return this.sessionsService.findByUser(user.id);
  }
}
