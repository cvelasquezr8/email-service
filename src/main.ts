import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './filters/http-exception.filter';

async function main() {
  const logger = new Logger('main');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const originsHeader = configService.get<string>('ALLOWED_ORIGIN');

  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: originsHeader,
    methods: 'GET, POST, OPTIONS',
    allowedHeaders: ['Content-Type', 'x-idempotency-key', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on port: ${port}`);
}

void main();
