/**
 * CU-D05 — Payload Limits / Resilience
 * Verifica que el sistema rechaza o tolera payloads extremos sin crashear.
 */
import httpMocks from 'node-mocks-http';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockCheckRateLimit    = jest.fn().mockResolvedValue({ allowed: true, remaining: 9 });
const mockGetSessionCostUsd = jest.fn().mockResolvedValue(0);
const mockTrackTokenUsage   = jest.fn().mockResolvedValue(0.0001);
const mockTouchSession      = jest.fn().mockResolvedValue(undefined);
const mockGetBrief          = jest.fn().mockResolvedValue(null);
const mockGetMessages       = jest.fn().mockResolvedValue([]);
const mockCompressBriefForSection = jest.fn().mockReturnValue(null);

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  RATE_LIMITS: {
    chat:       { max: 999, ttl: 3600  },
    extraction: { max: 999, ttl: 3600  },
    generation: { max: 8,   ttl: 86400 },
    redesign:   { max: 8,   ttl: 86400 },
  },
  checkRateLimit:          (...a) => mockCheckRateLimit(...a),
  getSessionCostUsd:       (...a) => mockGetSessionCostUsd(...a),
  trackTokenUsage:         (...a) => mockTrackTokenUsage(...a),
  touchSession:            (...a) => mockTouchSession(...a),
  getBrief:                (...a) => mockGetBrief(...a),
  getMessages:             (...a) => mockGetMessages(...a),
  compressBriefForSection: (...a) => mockCompressBriefForSection(...a),
}));

jest.mock('../../api/_lib/cors.js', () => ({
  __esModule: true,
  applyCors: jest.fn().mockReturnValue(false),
}));

const mockCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'ok' }],
  usage: { input_tokens: 5, output_tokens: 5 },
});

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}), { virtual: true });

// ── Setup ─────────────────────────────────────────────────────────────────────

let handler;
beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  ({ default: handler } = await import('../../api/claude.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: 'ok' }],
    usage: { input_tokens: 5, output_tokens: 5 },
  });
});

// ─── Límite de mensajes ────────────────────────────────────────────────────────

describe('límite de mensajes', () => {
  test('exactamente 20 mensajes → permitido', async () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `mensaje ${i}`,
    }));
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { intent: 'chat', messages },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('21 mensajes → 400', async () => {
    const messages = Array.from({ length: 21 }, (_, i) => ({
      role: 'user', content: `msg ${i}`,
    }));
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { intent: 'chat', messages },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('0 mensajes → 200 (array vacío es válido)', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { intent: 'chat', messages: [] },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

// ─── Límite de longitud de contenido ─────────────────────────────────────────

describe('límite de longitud de contenido', () => {
  test('mensaje de exactamente 3000 chars → permitido', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        intent: 'chat',
        messages: [{ role: 'user', content: 'x'.repeat(3000) }],
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('mensaje de 3001 chars → 400', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        intent: 'chat',
        messages: [{ role: 'user', content: 'x'.repeat(3001) }],
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('mensaje de 100.000 chars → 400 (no crashea)', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        intent: 'chat',
        messages: [{ role: 'user', content: 'A'.repeat(100_000) }],
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ─── Tipos de datos inesperados ────────────────────────────────────────────────

describe('tipos de datos inesperados', () => {
  test('messages como objeto (no array) → 400', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { intent: 'chat', messages: { role: 'user', content: 'hola' } },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('messages como string → 400', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { intent: 'chat', messages: 'hola mundo' },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('body completamente vacío → usa defaults, no crashea', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {},
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    // intent default es 'chat', messages default es [] → debe ser 200
    expect(res.statusCode).toBe(200);
  });

  test('body null → 400 o 200 con defaults, no crashea', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: null,
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect([200, 400]).toContain(res.statusCode);
  });
});

// ─── Múltiples mensajes con uno largo ────────────────────────────────────────

describe('varios mensajes con uno que supera el límite', () => {
  test('primer mensaje ok, segundo demasiado largo → 400', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        intent: 'chat',
        messages: [
          { role: 'user',      content: 'hola' },
          { role: 'assistant', content: 'ok' },
          { role: 'user',      content: 'z'.repeat(3001) },
        ],
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
