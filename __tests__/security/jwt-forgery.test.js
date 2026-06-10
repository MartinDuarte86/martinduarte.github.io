/**
 * CU-C01 — JWT Forgery
 * Objetivo: verificar que /api/approve y /api/reject no aceptan tokens
 * forjados (alg:none, action swap, token de otra sesión).
 */
import httpMocks from 'node-mocks-http';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-approval-secret-xyz';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockMarkTokenUsedIfNew = jest.fn().mockResolvedValue(true);
const mockIsTokenUsed        = jest.fn().mockResolvedValue(false);
const mockMarkTokenUsed      = jest.fn().mockResolvedValue(undefined);

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  markTokenUsedIfNew: (...a) => mockMarkTokenUsedIfNew(...a),
  isTokenUsed:        (...a) => mockIsTokenUsed(...a),
  markTokenUsed:      (...a) => mockMarkTokenUsed(...a),
}));

jest.mock('../../api/_lib/cors.js', () => ({
  __esModule: true,
  applyCors: jest.fn().mockReturnValue(false),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

let mockSupabaseImpl;
jest.mock('../../api/_lib/supabase.js', () => ({
  __esModule: true,
  default: new Proxy({}, { get(_, p) { return (...a) => mockSupabaseImpl[p](...a); } }),
}));

global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });

// ── Setup ─────────────────────────────────────────────────────────────────────

let approveHandler, rejectHandler;
beforeAll(async () => {
  process.env.APPROVAL_SECRET = TEST_SECRET;
  process.env.GH_TOKEN = 'gh-test';
  process.env.GH_OWNER = 'owner';
  process.env.GH_REPO  = 'repo';
  process.env.BASE_URL  = 'https://test.example.com';
  ({ default: approveHandler } = await import('../../api/approve.js'));
  ({ default: rejectHandler  } = await import('../../api/reject.js'));
});

beforeEach(() => {
  mockMarkTokenUsedIfNew.mockResolvedValue(true);
  mockIsTokenUsed.mockResolvedValue(false);
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { html_preview: '<html/>' }, error: null }),
  };
  mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };
  global.fetch.mockResolvedValue({ ok: true, text: async () => '' });
});

function validToken(action = 'approve', sessionId = 'sess-123') {
  return jwt.sign(
    { action, session_id: sessionId },
    TEST_SECRET,
    { expiresIn: '1h' }
  );
}

function makeApproveReq(token) {
  return httpMocks.createRequest({
    method: 'GET',
    query: { token },
  });
}

// ─── CU-C01-A: alg:none bypass ────────────────────────────────────────────────

describe('CU-C01-A: alg:none bypass', () => {
  test('token con alg:none → rechazado (400/401)', async () => {
    const payload  = { action: 'approve', session_id: 'sess-alg-none' };
    const header   = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const body     = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const forgedToken = `${header}.${body}.`;

    const req = makeApproveReq(forgedToken);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.statusCode).toBeLessThan(500);
  });
});

// ─── CU-C01-B: action swap ────────────────────────────────────────────────────

describe('CU-C01-B: action swap', () => {
  test('token de reject usado en /api/approve → rechazado', async () => {
    const token = jwt.sign(
      { action: 'reject', session_id: 'sess-swap' },
      TEST_SECRET,
      { expiresIn: '1h' }
    );
    const req = makeApproveReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  test('token de approve usado en /api/reject → rechazado', async () => {
    const token = jwt.sign(
      { action: 'approve', session_id: 'sess-swap2' },
      TEST_SECRET,
      { expiresIn: '1h' }
    );
    const req = makeApproveReq(token);
    const res = httpMocks.createResponse();
    await rejectHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ─── CU-C01-C: token expirado ─────────────────────────────────────────────────

describe('CU-C01-C: token expirado', () => {
  test('token expirado → 400/401', async () => {
    const token = jwt.sign(
      { action: 'approve', session_id: 'sess-exp' },
      TEST_SECRET,
      { expiresIn: -1 }
    );
    const req = makeApproveReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ─── CU-C01-D: firma incorrecta ───────────────────────────────────────────────

describe('CU-C01-D: firma incorrecta', () => {
  test('token firmado con clave diferente → rechazado', async () => {
    const token = jwt.sign(
      { action: 'approve', session_id: 'sess-wrongkey' },
      'otra-clave-secreta',
      { expiresIn: '1h' }
    );
    const req = makeApproveReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

// ─── CU-C01-E: token sin campos requeridos ────────────────────────────────────

describe('CU-C01-E: payload incompleto', () => {
  test('token sin session_id → rechazado', async () => {
    const token = jwt.sign({ action: 'approve' }, TEST_SECRET, { expiresIn: '1h' });
    const req = makeApproveReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  test('token válido one-time-use ya utilizado → 410', async () => {
    mockMarkTokenUsedIfNew.mockResolvedValueOnce(false); // ya estaba usado
    const token = validToken('approve', 'sess-onetimeused');
    const req = makeApproveReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBe(410);
  });
});
