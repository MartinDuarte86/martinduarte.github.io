/*
 * Tests de la acción `ebook_lead` multiplexada en api/notify.js.
 * Cubre lo que protege el gate de /ebooks/**: validación server-side (el
 * checkbox del modal es solo UX), el consentimiento obligatorio, el rate limit,
 * y que un fallo de email NO le niegue el ebook a un lead ya guardado.
 */
import httpMocks from 'node-mocks-http';

// ── Mocks ────────────────────────────────────────────────────────────────────

let mockInsert;
let mockSupabaseImpl;

jest.mock('../../api/_lib/supabase.js', () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_, prop) => (...args) => mockSupabaseImpl[prop](...args) }),
}));

let mockCheckRateLimit;
jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  savePreviews:        jest.fn(),
  getBrief:            jest.fn(),
  getMessages:         jest.fn(() => []),
  getSessionMeta:      jest.fn(),
  getOpenSessions:     jest.fn(() => []),
  removeOpenSession:   jest.fn(),
  isSessionAbandoned:  jest.fn(),
  checkRateLimit:      (...args) => mockCheckRateLimit(...args),
}));

let mockSend;
jest.mock('resend', () => ({
  __esModule: true,
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: (...args) => mockSend(...args) },
  })),
}));

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ messages: { create: jest.fn() } })),
}));

let handler;
beforeAll(async () => {
  process.env.RESEND_API_KEY = 'test-key';
  ({ default: handler } = await import('../../api/notify.js'));
});

beforeEach(() => {
  mockInsert = jest.fn().mockResolvedValue({ error: null });
  mockSupabaseImpl = { from: jest.fn(() => ({ insert: mockInsert })) };
  mockCheckRateLimit = jest.fn().mockResolvedValue({ allowed: true, remaining: 9, count: 1 });
  mockSend = jest.fn().mockResolvedValue({ error: null });
});

const VALID = {
  action: 'ebook_lead',
  nombre: 'Ana',
  apellido: 'Gómez',
  email: 'ana@example.com',
  telefono: '+54 11 2379-7308',
  acepta_marketing: true,
  consent_texto_version: 'v1',
  recurso_slug: 'inteligencia-artificial',
  accion: 'descargar',
};

function call(body, headers = {}) {
  const req = httpMocks.createRequest({
    method: 'POST',
    headers: { origin: '', 'user-agent': 'jest-ua', ...headers },
    body,
  });
  const res = httpMocks.createResponse();
  return handler(req, res).then(() => res);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/notify { action: ebook_lead }', () => {
  it('happy path → 200, guarda el lead y avisa por email', async () => {
    const res = await call(VALID);

    expect(res.statusCode).toBe(200);
    expect(mockSupabaseImpl.from).toHaveBeenCalledWith('leads');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const row = mockInsert.mock.calls[0][0];
    expect(row).toMatchObject({
      nombre: 'Ana',
      apellido: 'Gómez',
      email: 'ana@example.com',
      origen: 'ebook',
      recurso_slug: 'inteligencia-artificial',
      accion: 'descargar',
      acepta_marketing: true,
      consent_texto_version: 'v1',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('normaliza el email a minúsculas', async () => {
    await call({ ...VALID, email: 'ANA@Example.COM' });
    expect(mockInsert.mock.calls[0][0].email).toBe('ana@example.com');
  });

  it.each(['nombre', 'apellido', 'email', 'telefono'])(
    'falta %s → 400 y no toca la base',
    async (field) => {
      const res = await call({ ...VALID, [field]: '' });
      expect(res.statusCode).toBe(400);
      expect(mockInsert).not.toHaveBeenCalled();
    }
  );

  it('email con formato inválido → 400', async () => {
    const res = await call({ ...VALID, email: 'no-es-un-email' });
    expect(res.statusCode).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('sin acepta_marketing → 400 (el consentimiento se valida en el servidor)', async () => {
    const res = await call({ ...VALID, acepta_marketing: false });
    expect(res.statusCode).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('acepta_marketing truthy pero no === true → 400 (no se acepta "true" string)', async () => {
    const res = await call({ ...VALID, acepta_marketing: 'true' });
    expect(res.statusCode).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('rate limit excedido → 429 y no toca la base', async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0, count: 11 });
    const res = await call(VALID);
    expect(res.statusCode).toBe(429);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('usa el rate limit lead_capture', async () => {
    await call(VALID);
    expect(mockCheckRateLimit).toHaveBeenCalledWith(expect.any(String), 'lead_capture');
  });

  it('si falla el insert → 500', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'boom' } });
    const res = await call(VALID);
    expect(res.statusCode).toBe(500);
  });

  it('si falla el email → sigue 200 (el lead ya está guardado)', async () => {
    mockSend.mockResolvedValue({ error: { message: 'resend caido' } });
    const res = await call(VALID);
    expect(res.statusCode).toBe(200);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('si el envío de email tira excepción → sigue 200', async () => {
    mockSend.mockRejectedValue(new Error('network'));
    const res = await call(VALID);
    expect(res.statusCode).toBe(200);
  });

  it('corta campos largos para acotar la fila y el email', async () => {
    await call({ ...VALID, nombre: 'A'.repeat(500) });
    expect(mockInsert.mock.calls[0][0].nombre.length).toBeLessThanOrEqual(120);
  });

  it('accion desconocida cae a "leer"', async () => {
    await call({ ...VALID, accion: 'hackeame' });
    expect(mockInsert.mock.calls[0][0].accion).toBe('leer');
  });

  it('guarda la IP del header x-forwarded-for', async () => {
    await call(VALID, { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' });
    expect(mockInsert.mock.calls[0][0].ip).toBe('203.0.113.7');
  });

  it('escapa HTML en el email para no inyectar markup', async () => {
    await call({ ...VALID, nombre: '<script>alert(1)</script>' });
    const html = mockSend.mock.calls[0][0].html;
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
