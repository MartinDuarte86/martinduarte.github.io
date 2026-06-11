import httpMocks from 'node-mocks-http';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockCheckRateLimit    = jest.fn().mockResolvedValue({ allowed: true, remaining: 9 });
const mockTouchSession      = jest.fn().mockResolvedValue(undefined);
const mockGetSessionCostUsd = jest.fn().mockResolvedValue(0);
const mockTrackTokenUsage   = jest.fn().mockResolvedValue(0.0001);
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
  checkRateLimit:           (...a) => mockCheckRateLimit(...a),
  touchSession:             (...a) => mockTouchSession(...a),
  getSessionCostUsd:        (...a) => mockGetSessionCostUsd(...a),
  trackTokenUsage:          (...a) => mockTrackTokenUsage(...a),
  getBrief:                 (...a) => mockGetBrief(...a),
  getMessages:              (...a) => mockGetMessages(...a),
  compressBriefForSection:  (...a) => mockCompressBriefForSection(...a),
}));

jest.mock('../../api/_lib/cors.js', () => ({
  __esModule: true,
  applyCors: jest.fn().mockReturnValue(false),
}));

// ── Anthropic SDK mock ────────────────────────────────────────────────────────

const mockCreate = jest.fn();
// generation/redesign usan messages.stream (SSE)
const mockStream = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  finalMessage: jest.fn().mockResolvedValue({
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 20 },
  }),
}));

jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate, stream: mockStream },
    })),
  };
}, { virtual: true });

// ── Setup ─────────────────────────────────────────────────────────────────────

let handler;
beforeAll(async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ARS_USD_RATE      = '1200';
  process.env.COST_LIMIT_ARS    = '4000';
  ({ default: handler } = await import('../../api/claude.js'));
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
  mockGetSessionCostUsd.mockResolvedValue(0);
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: 'Hola' }],
    usage: { input_tokens: 10, output_tokens: 20 },
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeReq(body = {}) {
  return httpMocks.createRequest({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { intent: 'chat', messages: [], ...body },
  });
}

// ─── Tests: método HTTP ───────────────────────────────────────────────────────

describe('método HTTP', () => {
  test('GET → 405', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ─── Tests: validación de input ───────────────────────────────────────────────

describe('validación de input', () => {
  test('intent inválido → 400', async () => {
    const req = makeReq({ intent: 'malicioso' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().error).toMatch(/intent/);
  });

  test('section inválida → 400', async () => {
    const req = makeReq({ intent: 'chat', section: 'inyeccion' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData().error).toMatch(/section/);
  });

  test('messages no es array → 400', async () => {
    const req = makeReq({ messages: 'no-array' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('más de 20 mensajes → 400', async () => {
    const messages = Array.from({ length: 21 }, (_, i) => ({
      role: 'user', content: `msg ${i}`,
    }));
    const req = makeReq({ messages });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('mensaje > 3000 chars → 400', async () => {
    const req = makeReq({
      messages: [{ role: 'user', content: 'x'.repeat(3001) }],
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});

// ─── Tests: rate limiting ─────────────────────────────────────────────────────

describe('rate limiting', () => {
  test('IP bloqueada → 429', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const req = makeReq({ intent: 'generation' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });

  test('IP permitida → llama al LLM', async () => {
    const req = makeReq();
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

// ─── Tests: budget guard ──────────────────────────────────────────────────────

describe('budget guard', () => {
  test('costo superado → 402 sin llamar al LLM', async () => {
    // $4000 ARS / 1200 ARS per USD ≈ $3.33 USD. Simulamos $3.34 acumulado
    mockGetSessionCostUsd.mockResolvedValueOnce(3.34);
    const req = makeReq({ session_id: 'sess-budget-test' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(402);
    expect(res._getJSONData().error).toBe('budget_exceeded');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('costo dentro del límite → llama al LLM normalmente', async () => {
    mockGetSessionCostUsd.mockResolvedValueOnce(1.00);
    const req = makeReq({ session_id: 'sess-ok' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  test('sin session_id → no verifica presupuesto', async () => {
    const req = makeReq(); // sin session_id
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(mockGetSessionCostUsd).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  test('trackTokenUsage se llama con el modelo correcto después de la respuesta', async () => {
    const req = makeReq({
      session_id: 'sess-track',
      intent: 'chat',
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    // Esperar micro-tick para el fire-and-forget
    await new Promise(r => setTimeout(r, 10));
    expect(mockTrackTokenUsage).toHaveBeenCalledWith(
      'sess-track',
      'claude-haiku-4-5-20251001',
      10,
      20
    );
  });
});

// ─── Tests: routing de modelos ────────────────────────────────────────────────

describe('routing de modelos', () => {
  // chat/extraction → respuesta JSON via messages.create
  test.each([
    ['chat',       'claude-haiku-4-5-20251001'],
    ['extraction', 'claude-haiku-4-5-20251001'],
  ])('intent=%s → model=%s (create)', async (intent, expectedModel) => {
    const req = makeReq({ intent });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: expectedModel })
    );
  });

  // generation/redesign → streaming SSE via messages.stream
  test.each([
    ['generation', 'claude-sonnet-4-6'],
    ['redesign',   'claude-sonnet-4-6'],
  ])('intent=%s → model=%s (stream)', async (intent, expectedModel) => {
    const req = makeReq({ intent });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ model: expectedModel })
    );
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

// ─── Tests: error del LLM ─────────────────────────────────────────────────────

describe('errores del LLM', () => {
  test('rate limit del LLM → 429', async () => {
    const err = new Error('rate limited');
    err.status = 429;
    mockCreate.mockRejectedValueOnce(err);
    const req = makeReq();
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
  });

  test('error 401 del LLM → 500', async () => {
    const err = new Error('auth');
    err.status = 401;
    mockCreate.mockRejectedValueOnce(err);
    const req = makeReq();
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });

  test('error genérico → 500', async () => {
    mockCreate.mockRejectedValueOnce(new Error('boom'));
    const req = makeReq();
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
