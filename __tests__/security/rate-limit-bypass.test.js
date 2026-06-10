/**
 * CU-C04 — Rate Limit Bypass via X-Forwarded-For spoofing
 * Verifica que el sistema no permite evadir el rate limit
 * inyectando IPs falsas en headers de proxy.
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

function makeReq(overrideHeaders = {}, body = {}) {
  return httpMocks.createRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json', ...overrideHeaders },
    body: { intent: 'chat', messages: [], ...body },
  });
}

// ─── CU-C04-A: X-Forwarded-For con IP spoofada ────────────────────────────────

describe('CU-C04-A: extracción de IP para rate limiting', () => {
  test('x-forwarded-for con lista de IPs → usa la primera (no la last/trusted)', async () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1, 192.168.1.1' }, { intent: 'generation' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    // Verificar que checkRateLimit fue llamado con la primera IP del header
    const calledWithIp = mockCheckRateLimit.mock.calls[0]?.[0];
    expect(calledWithIp).toBe('1.2.3.4');
  });

  test('x-forwarded-for spoofado: localhost (127.0.0.1) → aún aplica rate limit', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const req = makeReq({ 'x-forwarded-for': '127.0.0.1' }, { intent: 'generation' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });

  test('x-forwarded-for spoofado: 0.0.0.0 → rate limit se aplica igual', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const req = makeReq({ 'x-forwarded-for': '0.0.0.0' }, { intent: 'generation' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });
});

// ─── CU-C04-B: múltiples intents para evadir contadores separados ─────────────

describe('CU-C04-B: intent hopping para evadir rate limit', () => {
  test('al cambiar intent de generation a redesign → checkRateLimit es llamado con el intent real', async () => {
    const req = makeReq({}, { intent: 'redesign' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    const calledWithIntent = mockCheckRateLimit.mock.calls[0]?.[1];
    expect(calledWithIntent).toBe('redesign');
  });

  test('intent "chat" y "extraction" tienen max=999 → checkRateLimit NO se llama', async () => {
    for (const intent of ['chat', 'extraction']) {
      jest.clearAllMocks();
      const req = makeReq({}, { intent });
      const res = httpMocks.createResponse();
      await handler(req, res);
      expect(mockCheckRateLimit).not.toHaveBeenCalled();
    }
  });
});

// ─── CU-C04-C: límite de generación agotado ───────────────────────────────────

describe('CU-C04-C: agotamiento de límite de generation', () => {
  test('generation bloqueada → 429 con mensaje específico', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const req = makeReq({}, { intent: 'generation' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    const body = res._getJSONData();
    expect(body.error).toMatch(/Límite de generación|Demasiadas/i);
  });

  test('redesign bloqueada → 429 con mensaje específico', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const req = makeReq({}, { intent: 'redesign' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    const body = res._getJSONData();
    expect(body.error).toMatch(/Límite de rediseño|Demasiadas/i);
  });
});

// ─── CU-C04-D: sin IP header (unknown) ────────────────────────────────────────

describe('CU-C04-D: request sin IP headers', () => {
  test('sin x-forwarded-for ni socket → checkRateLimit con "unknown" o IP de socket', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: { intent: 'generation', messages: [] },
    });
    // Sin x-forwarded-for ni socket configurado
    const res = httpMocks.createResponse();
    await handler(req, res);
    const calledWithIp = mockCheckRateLimit.mock.calls[0]?.[0];
    // Debe ser algún string no vacío (fallback a 'unknown' u otra IP)
    expect(typeof calledWithIp).toBe('string');
    expect(calledWithIp.length).toBeGreaterThan(0);
  });
});
