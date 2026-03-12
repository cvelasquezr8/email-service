import { BadRequestException, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError, Observable } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();

const mockRedis = {
  get: mockRedisGet,
  set: mockRedisSet,
};

const mockSetHeader = jest.fn();
const mockStatus = jest.fn();

function buildContext(headers: Record<string, string | string[] | undefined> = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({
        setHeader: mockSetHeader,
        status: mockStatus,
      }),
    }),
  } as unknown as ExecutionContext;
}

function buildCallHandler(observable: Observable<unknown> = of({ success: true, statusCode: 201 })): CallHandler {
  return { handle: () => observable } as unknown as CallHandler;
}

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new IdempotencyInterceptor(mockRedis as never);
  });

  // ─── Missing / invalid header ───────────────────────────────────────────────

  it('should throw BadRequestException when x-idempotency-key header is missing', async () => {
    const ctx = buildContext({});
    await expect(interceptor.intercept(ctx, buildCallHandler())).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when x-idempotency-key is an array', async () => {
    const ctx = buildContext({ 'x-idempotency-key': ['key1', 'key2'] });
    await expect(interceptor.intercept(ctx, buildCallHandler())).rejects.toThrow(BadRequestException);
  });

  // ─── Cache HIT ──────────────────────────────────────────────────────────────

  it('should return cached response with body and restore statusCode', async () => {
    const payload = { cachedAt: new Date().toISOString(), statusCode: 201, body: { id: 1 } };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(payload));

    const ctx = buildContext({ 'x-idempotency-key': 'test-key' });
    const result$ = await interceptor.intercept(ctx, buildCallHandler());

    await new Promise<void>((resolve) => {
      result$.subscribe({
        next: (val) => {
          expect(val).toEqual({ id: 1 });
          resolve();
        },
      });
    });

    expect(mockSetHeader).toHaveBeenCalledWith('X-Idempotency-Cache', 'HIT');
    expect(mockSetHeader).toHaveBeenCalledWith('X-Idempotency-Key', 'test-key');
    expect(mockStatus).toHaveBeenCalledWith(201);
  });

  it('should return cached response and default to status 200 when statusCode is absent', async () => {
    const payload = { cachedAt: new Date().toISOString(), body: { ok: true } };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(payload));

    const ctx = buildContext({ 'x-idempotency-key': 'key-no-status' });
    const result$ = await interceptor.intercept(ctx, buildCallHandler());

    await new Promise<void>((resolve) => {
      result$.subscribe({
        next: (val) => {
          expect(val).toEqual({ ok: true });
          resolve();
        },
      });
    });

    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('should return full parsed object when body property is absent', async () => {
    const payload = { cachedAt: new Date().toISOString(), statusCode: 200 };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(payload));

    const ctx = buildContext({ 'x-idempotency-key': 'key-no-body' });
    const result$ = await interceptor.intercept(ctx, buildCallHandler());

    await new Promise<void>((resolve) => {
      result$.subscribe({
        next: (val) => {
          expect(val).toEqual(payload);
          resolve();
        },
      });
    });
  });

  it('should return null body when cached value is invalid JSON', async () => {
    mockRedisGet.mockResolvedValueOnce('not-json{{{');

    const ctx = buildContext({ 'x-idempotency-key': 'bad-json-key' });
    const result$ = await interceptor.intercept(ctx, buildCallHandler());

    await new Promise<void>((resolve) => {
      result$.subscribe({
        next: (val) => {
          expect(val).toBeNull();
          resolve();
        },
      });
    });

    expect(mockStatus).toHaveBeenCalledWith(200);
  });

  it('should silently ignore errors thrown by res.setHeader / res.status', async () => {
    const payload = { cachedAt: new Date().toISOString(), statusCode: 200, body: 'data' };
    mockRedisGet.mockResolvedValueOnce(JSON.stringify(payload));
    mockSetHeader.mockImplementationOnce(() => {
      throw new Error('header error');
    });

    const ctx = buildContext({ 'x-idempotency-key': 'header-throw-key' });
    const result$ = await interceptor.intercept(ctx, buildCallHandler());

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });
  });

  // ─── Cache MISS → tap (success path) ────────────────────────────────────────

  it('should cache a successful response with success:true and numeric statusCode', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockResolvedValueOnce('OK');

    const ctx = buildContext({ 'x-idempotency-key': 'new-key' });
    const handler = buildCallHandler(of({ success: true, statusCode: 201 }));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(mockRedisSet).toHaveBeenCalledWith(
      'idempotency:new-key',
      expect.stringContaining('"statusCode":201'),
      'EX',
      86400,
    );
  });

  it('should cache with statusCode 200 when response has no numeric statusCode', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockResolvedValueOnce('OK');

    const ctx = buildContext({ 'x-idempotency-key': 'key-no-sc' });
    const handler = buildCallHandler(of({ success: true } as unknown));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(mockRedisSet).toHaveBeenCalledWith(
      'idempotency:key-no-sc',
      expect.stringContaining('"statusCode":200'),
      'EX',
      86400,
    );
  });

  it('should cache when response has only statusCode property (no success field)', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockResolvedValueOnce('OK');

    const ctx = buildContext({ 'x-idempotency-key': 'key-only-statuscode' });
    const handler = buildCallHandler(of({ statusCode: 200 } as unknown));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(mockRedisSet).toHaveBeenCalledWith(
      'idempotency:key-only-statuscode',
      expect.stringContaining('"statusCode":200'),
      'EX',
      86400,
    );
  });

  it('should NOT cache when response has success:false', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const ctx = buildContext({ 'x-idempotency-key': 'fail-key' });
    const handler = buildCallHandler(of({ success: false, statusCode: 400 }));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('should NOT cache when response does not contain success or statusCode', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const ctx = buildContext({ 'x-idempotency-key': 'plain-key' });
    const handler = buildCallHandler(of('just a string'));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('should NOT cache when response is null', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const ctx = buildContext({ 'x-idempotency-key': 'null-key' });
    const handler = buildCallHandler(of(null));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it('should log error when redis.set rejects', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    mockRedisSet.mockRejectedValueOnce(new Error('Redis down'));

    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const ctx = buildContext({ 'x-idempotency-key': 'redis-fail-key' });
    const handler = buildCallHandler(of({ success: true, statusCode: 200 }));
    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => setTimeout(resolve, 20) });
    });

    expect(loggerErrorSpy).toHaveBeenCalled();
    loggerErrorSpy.mockRestore();
  });

  it('should log error when tap block throws synchronously', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const ctx = buildContext({ 'x-idempotency-key': 'circular-key' });
    const handler = buildCallHandler(of({ success: true, statusCode: 200 }));
    const result$ = await interceptor.intercept(ctx, handler);

    // Patch JSON.stringify BEFORE subscribing so it's in place when tap runs
    jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('circular structure');
    });

    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve(), error: () => resolve() });
    });

    expect(loggerErrorSpy).toHaveBeenCalled();
    loggerErrorSpy.mockRestore();
  });

  // ─── catchError path ─────────────────────────────────────────────────────────

  it('should propagate error through catchError and wrap it as Error instance', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const original = new Error('upstream failure');
    const handler = buildCallHandler(throwError(() => original));
    const ctx = buildContext({ 'x-idempotency-key': 'error-key' });

    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({
        error: (err: Error) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('upstream failure');
          resolve();
        },
      });
    });
  });

  it('should wrap non-Error thrown values using String()', async () => {
    mockRedisGet.mockResolvedValueOnce(null);

    const handler = buildCallHandler(throwError(() => 'string error'));
    const ctx = buildContext({ 'x-idempotency-key': 'string-error-key' });

    const result$ = await interceptor.intercept(ctx, handler);

    await new Promise<void>((resolve) => {
      result$.subscribe({
        error: (err: Error) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe('string error');
          resolve();
        },
      });
    });
  });
});
