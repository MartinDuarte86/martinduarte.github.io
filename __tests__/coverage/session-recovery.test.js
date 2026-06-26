/**
 * CU-A01 — Session Recovery
 * Verifica que /api/get-session restaura la sesión desde Redis
 * usando el UUID de sessionId (como si viniera de localStorage).
 */
import httpMocks from 'node-mocks-http';
import { cookieFor } from '../helpers/cookie.js';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockGetBrief       = jest.fn();
const mockGetSessionMeta = jest.fn();
const mockGetMessages    = jest.fn();
const mockGetPreviews    = jest.fn();

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  getBrief:       (...a) => mockGetBrief(...a),
  getSessionMeta: (...a) => mockGetSessionMeta(...a),
  getMessages:    (...a) => mockGetMessages(...a),
  getPreviews:    (...a) => mockGetPreviews(...a),
}));

jest.mock('../../api/_lib/cors.js', () => ({
  __esModule: true,
  applyCors: jest.fn().mockReturnValue(false),
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

let handler;
beforeAll(async () => {
  ({ default: handler } = await import('../../api/get-session.js'));
});

beforeEach(() => {
  mockGetBrief.mockResolvedValue(null);
  mockGetSessionMeta.mockResolvedValue(null);
  mockGetMessages.mockResolvedValue([]);
  mockGetPreviews.mockResolvedValue(null);
});

function makeReq(sessionId) {
  // El session_id se autoriza por la cookie firmada; el query queda solo por
  // compatibilidad histórica (el handler lo ignora).
  return httpMocks.createRequest({
    method: 'GET',
    query: sessionId ? { session_id: sessionId } : {},
    headers: sessionId ? { cookie: cookieFor(sessionId) } : {},
  });
}

// ─── CU-A01-A: sesión existente ────────────────────────────────────────────────

describe('CU-A01-A: sesión existente', () => {
  const SESSION_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  beforeEach(() => {
    mockGetSessionMeta.mockResolvedValue({
      phase: 'conversacion',
      updatedAt: Date.now(),
      progress: 3,
      email: 'usuario@ejemplo.com', // PII que no debe aparecer en la respuesta
    });
    mockGetBrief.mockResolvedValue({
      nombre_marca: 'Marca Test',
      rubro: 'psicología',
    });
    mockGetMessages.mockResolvedValue([
      { role: 'user', content: 'Hola', section: 'hero', ts: Date.now() },
    ]);
    mockGetPreviews.mockResolvedValue(['<html>preview 1</html>']);
  });

  test('devuelve 200 con found=true', async () => {
    const req = makeReq(SESSION_ID);
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().found).toBe(true);
  });

  test('respuesta incluye brief completo', async () => {
    const req = makeReq(SESSION_ID);
    const res = httpMocks.createResponse();
    await handler(req, res);
    const body = res._getJSONData();
    expect(body.brief.nombre_marca).toBe('Marca Test');
    expect(body.brief.rubro).toBe('psicología');
  });

  test('respuesta incluye mensajes', async () => {
    const req = makeReq(SESSION_ID);
    const res = httpMocks.createResponse();
    await handler(req, res);
    const body = res._getJSONData();
    expect(Array.isArray(body.messages)).toBe(true);
    expect(body.messages.length).toBeGreaterThan(0);
  });

  test('respuesta incluye previews', async () => {
    const req = makeReq(SESSION_ID);
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res._getJSONData().previews).toBeDefined();
  });

  test('respuesta NO incluye email en meta (PII)', async () => {
    const req = makeReq(SESSION_ID);
    const res = httpMocks.createResponse();
    await handler(req, res);
    const body = res._getJSONData();
    expect(body.meta?.email).toBeUndefined();
    // La meta expuesta solo tiene phase, updatedAt, progress
    if (body.meta) {
      const metaKeys = Object.keys(body.meta);
      expect(metaKeys).not.toContain('email');
    }
  });

  test('meta contiene solo phase, updatedAt, progress', async () => {
    const req = makeReq(SESSION_ID);
    const res = httpMocks.createResponse();
    await handler(req, res);
    const { meta } = res._getJSONData();
    expect(meta).not.toBeNull();
    expect(['phase', 'updatedAt', 'progress']).toEqual(
      expect.arrayContaining(Object.keys(meta))
    );
  });
});

// ─── CU-A01-B: sesión no encontrada ───────────────────────────────────────────

describe('CU-A01-B: sesión no encontrada', () => {
  test('sin meta ni brief → 404 con found=false', async () => {
    mockGetSessionMeta.mockResolvedValue(null);
    mockGetBrief.mockResolvedValue(null);
    const req = makeReq('sess-nonexistent');
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
    expect(res._getJSONData().found).toBe(false);
  });
});

// ─── CU-A01-C: validación de input ────────────────────────────────────────────

describe('CU-A01-C: validación de input', () => {
  test('sin cookie de sesión → 401', async () => {
    const req = makeReq(null);
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  test('método POST → 405', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      query: { session_id: 'sess-post' },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });
});

// ─── CU-A01-D: solo brief sin meta ────────────────────────────────────────────

describe('CU-A01-D: sesión parcial (solo brief)', () => {
  test('brief presente pero meta null → 200 found=true', async () => {
    mockGetBrief.mockResolvedValue({ nombre_marca: 'Solo Brief' });
    mockGetSessionMeta.mockResolvedValue(null);
    const req = makeReq('sess-brief-only');
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().found).toBe(true);
    expect(res._getJSONData().meta).toBeNull();
  });
});

// ─── CU-A01-E: error de Redis ─────────────────────────────────────────────────

describe('CU-A01-E: error de Redis', () => {
  test('error en getBrief → 500', async () => {
    mockGetBrief.mockRejectedValueOnce(new Error('Redis connection failed'));
    const req = makeReq('sess-redis-error');
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
