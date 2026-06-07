import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshGuard)
  refresh(@CurrentUser() user: { id: string }, @Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(user.id, refreshToken);
  }
}
