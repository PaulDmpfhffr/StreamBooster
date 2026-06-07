import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';

// Prisma returns BigInt for bigint columns; JSON.stringify throws without this.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function () {
  return Number(this);
};

async function bootstrap() {
  // Fail fast in production if critical secrets are missing.
  // The defaults in configuration.ts are for local dev only.
  if (process.env.NODE_ENV === 'production') {
    const required = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PRICE_STARTER',
      'STRIPE_PRICE_STANDARD',
      'STRIPE_PRICE_PRO',
      'STRIPE_PRICE_UNLIMITED',
      'DATABASE_URL',
    ];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`[bootstrap] Missing required environment variable: ${key}`);
      }
    }
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const corsOrigins = config.get<string[]>('cors.origins') ?? [];
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.useWebSocketAdapter(new IoAdapter(app));

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);
  console.log(`StreamBooster API running on port ${port}`);
}

bootstrap();
