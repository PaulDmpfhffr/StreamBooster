import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsUrl({ require_tld: false })
  successUrl!: string;

  @IsUrl({ require_tld: false })
  cancelUrl!: string;
}

@Controller('api/v1/billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('products')
  getProducts() {
    return this.billingService.getProducts();
  }

  @Post('checkout')
  @UseGuards(JwtGuard)
  createCheckout(
    @CurrentUser() user: User,
    @Body() body: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckout(
      user.id,
      body.productId,
      body.successUrl,
      body.cancelUrl,
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.billingService.handleWebhook(req.rawBody!, signature);
    return { received: true };
  }
}
