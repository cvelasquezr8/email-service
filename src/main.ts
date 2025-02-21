import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function main() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'https://cvelasquezr8.github.io',
    methods: 'GET, POST',
    allowedHeaders: 'Content-Type',
  });

  await app.listen(process.env.PORT ?? 3000);
}
main();
