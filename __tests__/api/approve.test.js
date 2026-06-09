import httpMocks from 'node-mocks-http';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const TEST_SECRET = 'test-approval-secret-1234';

// ── Redis mock ───────────────────────────────────────────────────────────────

const mockIsTokenUsed = jest.fn().mockResolvedValue(false);
const mockMarkTokenUsed = jest.fn().mockResolvedValue(undefined);

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  isTokenUsed: (...args) => mockIsTokenUsed(...args),
  markTokenUsed: (...args) => mockMarkTokenUsed(...args),
}));

// ── Supabase mock ────────────────────────────────────────────────────────────

let mockSupabaseImpl;

jest.mock('../../api/_lib/supabase.js', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    { get(_, prop) { return (...args) => mockSupabaseImpl[prop](...args); } }
  ),
}));

// ── fetch mock (GitHub API) ──────────────────────────────────────────────────

global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });

// ── Setup ────────────────────────────────────────────────────────────────────

let handler;
beforeAll(async () => {
  process.env.APPROVAL_SECRET = TEST_SECRET;
  process.env.GH_TOKEN = 'gh-test';
  process.env.GH_OWNER = 'owner';
  process.env.GH_REPO = 'repo';
  process.env.BASE_URL = 'https://test.example.com';
  ({ default: handler } = await import('../../api/approve.js'));
});

beforeEach(() => {
  mockIsTokenUsed.mockResolvedValue(false);
  mockMarkTokenUsed.mockResolvedValue(undefined);

  const dsnChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { html_preview: '<html/>' }, error: null }),
    update: jest.fn().mockReturnThis(),
  };

  mockSupabaseImpl = { from: jest.fn().mockReturnValue(dsnChain) };
});

function makeToken(overrides = {}) {
  return jwt.sign(
    { action: 'approve', session_id: 'sid', nombre_marca: 'Marca', rubro: 'tech', template: 'moderno', ...overrides },
    TEST_SECRET,
    { expiresIn: '48h' }
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/approve', () => {
  it('POST → 405', async () => {
    const req = httpMocks.createRequest({ method: 'POST' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('sin token → 400', async () => {
    const req = httpMocks.createRequest({ method: 'GET', query: {} });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('token inválido → 401', async () => {
    const req = httpMocks.createRequest({ method: 'GET', query: { token: 'token-falso' } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('token expirado → 401', async () => {
    const expired = jwt.sign(
      { action: 'approve', session_id: 'sid' },
      TEST_SECRET,
      { expiresIn: '-1s' }
    );
    const req = httpMocks.createRequest({ method: 'GET', query: { token: expired } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('token con acción incorrecta (reject) → 400', async () => {
    const token = makeToken({ action: 'reject' });
    const req = httpMocks.createRequest({ method: 'GET', query: { token } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('token ya usado → 410', async () => {
    mockIsTokenUsed.mockResolvedValue(true);
    const token = makeToken();
    const req = httpMocks.createRequest({ method: 'GET', query: { token } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(410);
  });

  it('token válido → marca usado y retorna 200', async () => {
    const token = makeToken();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const req = httpMocks.createRequest({ method: 'GET', query: { token } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockMarkTokenUsed).toHaveBeenCalledWith(tokenHash);
  });

  it('token válido no puede reutilizarse (one-time-use)', async () => {
    const token = makeToken();

    // Primer uso: OK
    mockIsTokenUsed.mockResolvedValueOnce(false);
    const req1 = httpMocks.createRequest({ method: 'GET', query: { token } });
    const res1 = httpMocks.createResponse();
    await handler(req1, res1);
    expect(res1.statusCode).toBe(200);

    // Segundo uso: rechazado
    mockIsTokenUsed.mockResolvedValueOnce(true);
    const req2 = httpMocks.createRequest({ method: 'GET', query: { token } });
    const res2 = httpMocks.createResponse();
    await handler(req2, res2);
    expect(res2.statusCode).toBe(410);
  });
});
