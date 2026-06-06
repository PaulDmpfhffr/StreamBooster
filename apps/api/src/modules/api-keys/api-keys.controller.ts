import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@Controller('api/v1/keys')
@UseGuards(JwtGuard)
export class ApiKeysController {
  constructor(private apiKeysService: ApiKeysService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.apiKeysService.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: User, @Body('label') label: string) {
    return this.apiKeysService.create(user.id, label ?? 'My Device');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@CurrentUser() user: User, @Param('id') keyId: string) {
    return this.apiKeysService.revoke(user.id, keyId);
  }
}
