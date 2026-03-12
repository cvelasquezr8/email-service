import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import { of, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private logger = new Logger(IdempotencyInterceptor.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const key = req.headers['x-idempotency-key'];
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('x-idempotency-key header is required');
    }

    const redisKey = `idempotency:${key}`;
    const cached = await this.redis.get(redisKey);
    if (cached) {
      type CachedPayload = { cachedAt?: string; statusCode?: number; body?: unknown };

      let parsed: CachedPayload | null = null;
      try {
        parsed = JSON.parse(cached) as CachedPayload;
      } catch {
        parsed = null;
      }

      const res = context.switchToHttp().getResponse<Response>();

      // If the cached value contains a statusCode, restore it. Otherwise 200.
      const status = parsed && parsed.statusCode ? Number(parsed.statusCode) : 200;
      // Add informative headers so clients know the response came from idempotency cache
      try {
        res.setHeader('X-Idempotency-Cache', 'HIT');
        res.setHeader('X-Idempotency-Key', String(key));
        res.status(status);
      } catch {
        // ignore if response object doesn't support headers in this context
      }

      // Return cached response and DO NOT call next.handle() so no side-effects (like sending email) run.
      let bodyToReturn: unknown = null;
      if (parsed) {
        if (parsed.body !== undefined) {
          bodyToReturn = parsed.body;
        } else {
          bodyToReturn = parsed;
        }
      }

      this.logger.log(`⚡ Returning cached response for key ${key} with status ${status}`);

      return of<unknown>(bodyToReturn);
    }

    const result$ = next.handle() as Observable<unknown>;

    return result$.pipe(
      tap((res) => {
        const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
        const isSuccessResponse = (v: unknown): v is { success?: boolean; statusCode?: number } =>
          isObject(v) && ('success' in v || 'statusCode' in v);

        if (isSuccessResponse(res) && res.success !== false) {
          const statusCode = typeof res.statusCode === 'number' ? res.statusCode : 200;
          const payload = {
            cachedAt: new Date().toISOString(),
            statusCode,
            body: res,
          };

          void this.redis
            .set(redisKey, JSON.stringify(payload), 'EX', 86400)
            .then(() => this.logger.log('💾 Successful response cached in Upstash'))
            .catch((err) => this.logger.error('Error caching idempotent response:', err && (err as Error).message));
        }
      }),
      catchError((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error('❌ Skipping idempotency cache due to error:', errorMessage);

        const wrappedError = err instanceof Error ? err : new Error(String(err));

        return throwError(() => wrappedError);
      }),
    );
  }
}
