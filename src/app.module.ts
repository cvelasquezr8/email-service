import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import Redis from 'ioredis';

import { EmailModule } from './email/email.module';
import { EnvConfiguration, JoiValidationSchema } from './config';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [EnvConfiguration],
      validationSchema: JoiValidationSchema,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }

        const isSsl = redisUrl.startsWith('rediss://');

        return {
          throttlers: [
            {
              name: 'contact_email',
              ttl: Number(configService.get('THROTTLE_TTL')) || 86400000,
              limit: Number(configService.get('THROTTLE_LIMIT')) || 10,
            },
          ],
          storage: new ThrottlerStorageRedisService(
            new Redis(redisUrl, {
              tls: isSsl ? { rejectUnauthorized: false } : undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: false,
            }),
          ),
        };
      },
    }),
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        if (!redisUrl) {
          throw new Error('REDIS_URL is not defined in environment variables');
        }

        const isSsl = redisUrl.startsWith('rediss://');

        return {
          type: 'single',
          url: redisUrl,
          options: {
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
            ...(isSsl && {
              tls: {
                rejectUnauthorized: false,
              },
            }),
          },
        };
      },
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('EMAIL_HOST'),
          port: configService.get<number>('EMAIL_PORT'),
          secure: configService.get<boolean>('EMAIL_SECURE'),
          auth: {
            user: configService.get<string>('EMAIL_USER'),
            pass: configService.get<string>('EMAIL_PASSWORD'),
          },
        },
        defaults: {
          from: `"No Reply" <${configService.get<string>('EMAIL_USER')}>`,
        },
      }),
    }),
    EmailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
