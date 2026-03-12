import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Request, Response } from 'express';
import { of, Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
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

      console.log('✨ Returning cached response for:', key);

      // Return cached response and DO NOT call next.handle() so no side-effects (like sending email) run.
      let bodyToReturn: unknown = null;
      if (parsed) {
        if (parsed.body !== undefined) {
          bodyToReturn = parsed.body;
        } else {
          bodyToReturn = parsed;
        }
      }

      return of<unknown>(bodyToReturn);
    }

    const result$ = next.handle() as Observable<unknown>;

    return result$.pipe(
      tap((res) => {
        // SOLO GUARDAMOS SI LA RESPUESTA ES EXITOSA
        // Asumiendo que tu servicio retorna { success: true, ... }
        const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
        const isSuccessResponse = (v: unknown): v is { success?: boolean; statusCode?: number } =>
          isObject(v) && ('success' in v || 'statusCode' in v);

        try {
          if (isSuccessResponse(res) && res.success !== false) {
            const statusCode = typeof res.statusCode === 'number' ? res.statusCode : 200;
            const payload = {
              cachedAt: new Date().toISOString(),
              statusCode,
              body: res,
            };

            void this.redis
              .set(redisKey, JSON.stringify(payload), 'EX', 86400)
              .then(() => console.log('💾 Successful response cached in Upstash'))
              .catch((err) => console.error('Error caching idempotent response:', err && (err as Error).message));
          }
        } catch (err) {
          console.error('Error evaluating response for idempotency caching:', (err as Error).message || err);
        }
      }),
      catchError((err) => {
        // Si hay un error (como el 550 de Proton), NO guardamos la llave.
        // Esto permite que el usuario corrija el error y reintente con la MISMA llave.
        console.error('❌ Skipping idempotency cache due to error:', (err as Error).message || err);

        // Wrap the error into an Error instance to avoid returning an `any` typed value
        const message = (err as Error)?.message ?? String(err);

        return throwError(() => new Error(message));
      }),
    );
  }
}
