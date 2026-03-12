import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, CanActivate, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Server } from 'http';
import request from 'supertest';

import { EmailController } from '../src/email/email.controller';
import { EmailService } from '../src/email/email.service';
import { IdempotencyInterceptor } from '../src/interceptors/idempotency.interceptor';
import { AllExceptionsFilter } from '../src/filters/http-exception.filter';

// Token that @InjectRedis() (no-arg) resolves to in @nestjs-modules/ioredis
// See: https://github.com/nest-modules/ioredis/blob/master/lib/ioredis.utils.ts
const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();

const mockRedis = {
  get: mockRedisGet,
  set: mockRedisSet,
};

const mockEmailService = {
  sendEmail: jest.fn(),
};

class ThrottlerBypassGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_BODY = {
  name: 'John Doe',
  email: 'john@example.com',
  message: 'Hello from e2e test',
};

const EMAIL_SUCCESS_RESPONSE = {
  success: true,
  statusCode: 201,
  message: 'Email sent successfully',
};

function buildCachedPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    cachedAt: new Date().toISOString(),
    statusCode: 201,
    body: EMAIL_SUCCESS_RESPONSE,
    ...overrides,
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('POST /api/email/send — IdempotencyInterceptor (e2e)', () => {
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [EmailController],
      providers: [
        { provide: EmailService, useValue: mockEmailService },
        { provide: REDIS_TOKEN, useValue: mockRedis },
        IdempotencyInterceptor,
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useClass(ThrottlerBypassGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: cache miss. Individual tests can override with mockResolvedValueOnce.
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('x-idempotency-key header validation', () => {
    it('returns 400 when x-idempotency-key header is missing', async () => {
      const res = await request(server).post('/api/email/send').send(VALID_BODY).expect(400);

      expect(res.body).toMatchObject({
        success: false,
        statusCode: 400,
      });
      const body = res.body as { message: string };
      expect(body.message).toMatch(/x-idempotency-key/i);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ─── Cache MISS — real call ──────────────────────────────────────────────────

  describe('Cache MISS', () => {
    it('calls EmailService and caches the successful response', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(EMAIL_SUCCESS_RESPONSE);

      const res = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'first-call-key')
        .send(VALID_BODY)
        .expect(201);

      expect(res.body).toMatchObject(EMAIL_SUCCESS_RESPONSE);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith(VALID_BODY);

      // Wait for the async void redis.set
      await new Promise((r) => setTimeout(r, 30));

      expect(mockRedisSet).toHaveBeenCalledWith(
        'idempotency:first-call-key',
        expect.stringContaining('"statusCode":201'),
        'EX',
        86400,
      );
    });

    it('does NOT cache when EmailService throws', async () => {
      mockEmailService.sendEmail.mockRejectedValueOnce(new Error('SMTP timeout'));

      await request(server).post('/api/email/send').set('x-idempotency-key', 'error-key').send(VALID_BODY).expect(500);

      await new Promise((r) => setTimeout(r, 30));
      expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('responds normally even if redis.set rejects after a successful send', async () => {
      mockEmailService.sendEmail.mockResolvedValueOnce(EMAIL_SUCCESS_RESPONSE);
      mockRedisSet.mockRejectedValueOnce(new Error('Redis down'));

      const res = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'redis-fail-key')
        .send(VALID_BODY)
        .expect(201);

      expect(res.body).toMatchObject({ success: true });
    });
  });

  // ─── Cache HIT — no side effects ────────────────────────────────────────────

  describe('Cache HIT', () => {
    it('returns cached response with HIT headers and does NOT call EmailService', async () => {
      mockRedisGet.mockResolvedValueOnce(buildCachedPayload());

      const res = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'cached-key')
        .send(VALID_BODY)
        .expect(201);

      expect(res.headers['x-idempotency-cache']).toBe('HIT');
      expect(res.headers['x-idempotency-key']).toBe('cached-key');
      expect(res.body).toMatchObject(EMAIL_SUCCESS_RESPONSE);

      // Core idempotency guarantee: email is NOT sent again
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(mockRedisSet).not.toHaveBeenCalled();
    });

    it('defaults to status 200 when cached payload has no statusCode', async () => {
      mockRedisGet.mockResolvedValueOnce(buildCachedPayload({ statusCode: undefined }));

      const res = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'cached-no-status')
        .send(VALID_BODY)
        .expect(200);

      expect(res.headers['x-idempotency-cache']).toBe('HIT');
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns null body when cached JSON is corrupted', async () => {
      mockRedisGet.mockResolvedValueOnce('broken-json{{');

      const res = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'corrupt-cache-key')
        .send(VALID_BODY)
        .expect(200);

      expect(res.headers['x-idempotency-cache']).toBe('HIT');
      expect(res.body).toEqual({});
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });

    it('returns full parsed object when cached payload has no body field', async () => {
      const noBodyPayload = { cachedAt: new Date().toISOString(), statusCode: 201 };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(noBodyPayload));

      const res = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'no-body-cache-key')
        .send(VALID_BODY)
        .expect(201);

      expect(res.headers['x-idempotency-cache']).toBe('HIT');
      expect(res.body).toMatchObject({ statusCode: 201 });
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  // ─── Idempotency contract ────────────────────────────────────────────────────

  describe('Idempotency contract', () => {
    it('two calls with the same key send the email only once', async () => {
      // First call: cache miss → sends email → stores in Redis
      mockEmailService.sendEmail.mockResolvedValueOnce(EMAIL_SUCCESS_RESPONSE);

      const firstRes = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'contract-key')
        .send(VALID_BODY)
        .expect(201);

      await new Promise((r) => setTimeout(r, 30));
      expect(mockRedisSet).toHaveBeenCalledTimes(1);

      // Second call: simulate what Redis would return after the first call stored it
      const firstCallArgs = mockRedisSet.mock.calls[0] as [string, string, string, number];
      const storedValue = firstCallArgs[1];
      mockRedisGet.mockResolvedValueOnce(storedValue);

      const secondRes = await request(server)
        .post('/api/email/send')
        .set('x-idempotency-key', 'contract-key')
        .send(VALID_BODY)
        .expect(201);

      // Email was sent exactly once across both requests
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      // Both responses carry the same business payload
      expect(secondRes.body).toEqual(firstRes.body);
      // Cache header confirms the second response came from the store
      expect(secondRes.headers['x-idempotency-cache']).toBe('HIT');
      // Redis was not written again on the second call
      expect(mockRedisSet).toHaveBeenCalledTimes(1);
    });
  });
});
