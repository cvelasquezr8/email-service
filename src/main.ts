import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function main() {
  const logger = new Logger('main');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const originsHeader = configService.get<string>('ALLOWED_ORIGIN');

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: originsHeader,
    methods: 'GET, POST',
    allowedHeaders: 'Content-Type',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);
  logger.log(`Server running on port: ${port}`);
}

void main();
