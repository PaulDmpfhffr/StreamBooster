import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
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
