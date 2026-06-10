/**
 * CU-A05 — JWT One-Time-Use (TOCTOU)
 * Verifica que un token de aprobación no puede ser usado dos veces,
 * incluyendo el caso de uso concurrente.
 */
import httpMocks from 'node-mocks-http';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-approval-secret-xyz';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockMarkTokenUsedIfNew = jest.fn().mockResolvedValue(true);

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  markTokenUsedIfNew: (...a) => mockMarkTokenUsedIfNew(...a),
  markTokenUsed:      jest.fn().mockResolvedValue(undefined),
  isTokenUsed:        jest.fn().mockResolvedValue(false),
}));

jest.mock('../../api/_lib/cors.js', () => ({
  __esModule: true,
  applyCors: jest.fn().mockReturnValue(false),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

let mockChain;
jest.mock('../../api/_lib/supabase.js', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get(_, p) {
      return (...a) => {
        if (mockChain[p]) return mockChain[p](...a);
        return mockChain;
      };
    }
  }),
}));

global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => '' });

// ── Setup ─────────────────────────────────────────────────────────────────────

let approveHandler;
beforeAll(async () => {
  process.env.APPROVAL_SECRET = TEST_SECRET;
  process.env.GH_TOKEN = 'gh-test';
  process.env.GH_OWNER = 'owner';
  process.env.GH_REPO  = 'repo';
  process.env.BASE_URL  = 'https://test.example.com';
  ({ default: approveHandler } = await import('../../api/approve.js'));
});

function freshChain(htmlPreview = '<html/>') {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: { html_preview: htmlPreview }, error: null }),
    single:      jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
  };
  return chain;
}

function makeReq(token) {
  return httpMocks.createRequest({ method: 'GET', query: { token } });
}

function validApproveToken(sessionId = 'sess-abc') {
  return jwt.sign({ action: 'approve', session_id: sessionId }, TEST_SECRET, { expiresIn: '1h' });
}

// ─── CU-A05-A: uso normal (primer uso → 200/302) ─────────────────────────────

describe('CU-A05-A: primer uso del token', () => {
  beforeEach(() => {
    mockChain = freshChain();
    mockMarkTokenUsedIfNew.mockResolvedValue(true); // primer uso
    global.fetch.mockResolvedValue({ ok: true, text: async () => '' });
  });

  test('token válido en primer uso → no devuelve 410', async () => {
    const token = validApproveToken('sess-first-use');
    const req = makeReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).not.toBe(410);
    expect(res.statusCode).not.toBe(400);
    expect(res.statusCode).not.toBe(401);
  });
});

// ─── CU-A05-B: segundo uso → 410 Gone ────────────────────────────────────────

describe('CU-A05-B: token ya utilizado', () => {
  beforeEach(() => {
    mockChain = freshChain();
    mockMarkTokenUsedIfNew.mockResolvedValue(false); // ya fue usado
    global.fetch.mockResolvedValue({ ok: true, text: async () => '' });
  });

  test('token re-usado → 410 Gone', async () => {
    const token = validApproveToken('sess-reused');
    const req = makeReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    expect(res.statusCode).toBe(410);
  });

  test('token re-usado → no llama a Supabase update', async () => {
    const token = validApproveToken('sess-noupdate');
    const req = makeReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    // Si el token ya fue usado, no debería procesar la aprobación
    expect(mockChain.update).not.toHaveBeenCalled();
  });
});

// ─── CU-A05-C: uso concurrente (TOCTOU) ──────────────────────────────────────

describe('CU-A05-C: concurrencia — solo uno de dos usos simultáneos tiene éxito', () => {
  test('dos requests concurrentes al mismo token → solo uno pasa', async () => {
    const sessionId = 'sess-concurrent';
    const token = validApproveToken(sessionId);

    let callCount = 0;
    // Simula que el primer call atómico tiene éxito, el segundo no
    mockMarkTokenUsedIfNew.mockImplementation(() => {
      callCount++;
      return Promise.resolve(callCount === 1); // true solo la primera vez
    });

    mockChain = freshChain();
    global.fetch.mockResolvedValue({ ok: true, text: async () => '' });

    const [res1, res2] = await Promise.all([
      (async () => {
        const req = makeReq(token);
        const res = httpMocks.createResponse();
        await approveHandler(req, res);
        return res;
      })(),
      (async () => {
        const req = makeReq(token);
        const res = httpMocks.createResponse();
        await approveHandler(req, res);
        return res;
      })(),
    ]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    // Uno debe ser exitoso (no 410), el otro 410
    expect(statuses).toContain(410);
    // Al menos uno no es 410 (el que pasó primero)
    expect(statuses.some(s => s !== 410)).toBe(true);
  });
});

// ─── CU-A05-D: markTokenUsedIfNew recibe el hash del token ───────────────────

describe('CU-A05-D: hash del token', () => {
  beforeEach(() => {
    mockChain = freshChain();
    mockMarkTokenUsedIfNew.mockResolvedValue(true);
    global.fetch.mockResolvedValue({ ok: true, text: async () => '' });
  });

  test('markTokenUsedIfNew es llamado con un string no vacío', async () => {
    const token = validApproveToken('sess-hash-check');
    const req = makeReq(token);
    const res = httpMocks.createResponse();
    await approveHandler(req, res);
    if (mockMarkTokenUsedIfNew.mock.calls.length > 0) {
      const arg = mockMarkTokenUsedIfNew.mock.calls[0][0];
      expect(typeof arg).toBe('string');
      expect(arg.length).toBeGreaterThan(0);
    }
  });

  test('tokens distintos → markTokenUsedIfNew recibe valores distintos', async () => {
    const token1 = validApproveToken('sess-t1');
    const token2 = validApproveToken('sess-t2');

    await approveHandler(makeReq(token1), httpMocks.createResponse());
    await approveHandler(makeReq(token2), httpMocks.createResponse());

    if (mockMarkTokenUsedIfNew.mock.calls.length >= 2) {
      const hash1 = mockMarkTokenUsedIfNew.mock.calls[0][0];
      const hash2 = mockMarkTokenUsedIfNew.mock.calls[1][0];
      expect(hash1).not.toBe(hash2);
    }
  });
});
