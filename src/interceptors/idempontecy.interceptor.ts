import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Request } from 'express';
import { of, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-idempotency-key'];

    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Header x-idempotency-key is required and must be a string');
    }

    const redisKey = `idempotency:${key}`;
    const cached = await this.redis.get(redisKey);
    if (cached) {
      return of(JSON.parse(cached));
    }

    return next.handle().pipe(
      tap((res) => {
        this.redis.set(redisKey, JSON.stringify(res), 'EX', 86400).catch((err) => {
          console.error('Redis Idempotency Error:', err);
        });
      }),
    );
  }
}
