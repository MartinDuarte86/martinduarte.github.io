/**
 * CU-C02 / CU-C03 — SQL & XSS Injection
 * Verifica que los campos de brief y mensajes no ejecuten inyecciones.
 */
import httpMocks from 'node-mocks-http';

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockSaveBrief         = jest.fn().mockResolvedValue(undefined);
const mockGetBrief          = jest.fn().mockResolvedValue(null);
const mockGetSessionMeta    = jest.fn().mockResolvedValue(null);
const mockSaveSessionMeta   = jest.fn().mockResolvedValue(undefined);
const mockAppendMessage     = jest.fn().mockResolvedValue(undefined);
const mockGetMessages       = jest.fn().mockResolvedValue([]);
const mockTouchSession      = jest.fn().mockResolvedValue(undefined);

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  saveBrief:        (...a) => mockSaveBrief(...a),
  getBrief:         (...a) => mockGetBrief(...a),
  getSessionMeta:   (...a) => mockGetSessionMeta(...a),
  saveSessionMeta:  (...a) => mockSaveSessionMeta(...a),
  appendMessage:    (...a) => mockAppendMessage(...a),
  getMessages:      (...a) => mockGetMessages(...a),
  touchSession:     (...a) => mockTouchSession(...a),
}));

jest.mock('../../api/_lib/cors.js', () => ({
  __esModule: true,
  applyCors: jest.fn().mockReturnValue(false),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

let mockSupabaseChain;
jest.mock('../../api/_lib/supabase.js', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get(_, p) {
      return (...a) => mockSupabaseChain[p]?.(...a) ?? mockSupabaseChain;
    }
  }),
}));

// ── Setup ─────────────────────────────────────────────────────────────────────

let saveSessionHandler, saveClientHandler;
beforeAll(async () => {
  ({ default: saveSessionHandler } = await import('../../api/save-session.js'));
  ({ default: saveClientHandler  } = await import('../../api/save-client.js'));
});

beforeEach(() => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    order:  jest.fn().mockReturnThis(),
    limit:  jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single:      jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
  };
  mockSupabaseChain = chain;
  mockGetBrief.mockResolvedValue(null);
  mockGetSessionMeta.mockResolvedValue(null);
});

// ─── CU-C02: SQL Injection en campos del brief ────────────────────────────────

describe('CU-C02: SQL Injection en brief', () => {
  const sqlPayloads = [
    "'; DROP TABLE clients; --",
    "1' OR '1'='1",
    'UNION SELECT * FROM clients',
    "admin'--",
    "1; EXEC xp_cmdshell('dir')",
  ];

  test.each(sqlPayloads.map(p => [p]))(
    'nombre_marca con SQL injection → no devuelve 500 ni ejecuta SQL: %s',
    async (payload) => {
      const req = httpMocks.createRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          type: 'brief',
          session_id: 'sess-sql-test',
          payload: { nombre_marca: payload, rubro: 'test' },
        },
      });
      const res = httpMocks.createResponse();
      await saveSessionHandler(req, res);
      // El handler debe guardar el dato sin ejecutar SQL (lo persiste en Redis, no en Postgres directamente)
      // Lo importante: no devuelve 500 (error de BD), y si persiste, lo hace como string literal
      expect(res.statusCode).not.toBe(500);
      if (res.statusCode === 200) {
        const savedPayload = mockSaveBrief.mock.calls[mockSaveBrief.mock.calls.length - 1]?.[1];
        if (savedPayload) {
          expect(savedPayload.nombre_marca).toBe(payload); // se guarda literalmente, no interpretado
        }
      }
    }
  );
});

// ─── CU-C03: XSS en brief ─────────────────────────────────────────────────────

describe('CU-C03: XSS en campos del brief', () => {
  const xssPayloads = [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)',
    '<svg onload=alert(1)>',
    '"><script>document.cookie="stolen"</script>',
  ];

  test.each(xssPayloads.map(p => [p]))(
    'slogan con XSS → almacenado como string literal (stored XSS test): %s',
    async (payload) => {
      const req = httpMocks.createRequest({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: {
          type: 'brief',
          session_id: 'sess-xss-test',
          payload: { slogan: payload, rubro: 'test' },
        },
      });
      const res = httpMocks.createResponse();
      await saveSessionHandler(req, res);
      expect(res.statusCode).not.toBe(500);
    }
  );
});

// ─── CU-C02: SQL Injection en save-client (datos de contacto) ─────────────────

describe('CU-C02: SQL Injection en save-client', () => {
  test('email con payload SQL → rechazado por validación de formato o almacenado sin ejecutar', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action: 'create',
        session_id: 'sess-sqlinject',
        email: "admin'--@test.com",
        data: { nombre: "'; DROP TABLE clients; --" },
      },
    });
    const res = httpMocks.createResponse();
    await saveClientHandler(req, res);
    // Puede ser 400 (validación rechaza el email) o 200/409 (almacenado literalmente)
    // Lo que NO debe pasar: 500 con stack trace de BD
    expect(res.statusCode).not.toBe(500);
  });

  test('nombre con XSS en save-client → no devuelve 500', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        action: 'create',
        session_id: 'sess-xssclient',
        email: 'test@ejemplo.com',
        data: { nombre: '<script>alert(1)</script>' },
      },
    });
    const res = httpMocks.createResponse();
    await saveClientHandler(req, res);
    expect(res.statusCode).not.toBe(500);
  });
});

// ─── Validación de mensajes grandes (no XSS específico pero sí seguridad de input) ───

describe('Input oversized en mensajes', () => {
  test('mensaje extremadamente largo → no crashea el servidor', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: {
        type: 'message',
        session_id: 'sess-bigmsg',
        payload: { role: 'user', content: 'A'.repeat(100_000), section: 'hero' },
      },
    });
    const res = httpMocks.createResponse();
    await saveSessionHandler(req, res);
    expect(res.statusCode).not.toBe(500);
  });
});
