import httpMocks from 'node-mocks-http';

// ── Supabase mock ────────────────────────────────────────────────────────────

let mockSupabaseImpl;

jest.mock('../../api/_lib/supabase.js', () => ({
  __esModule: true,
  default: new Proxy(
    {},
    {
      get(_, prop) {
        return (...args) => mockSupabaseImpl[prop](...args);
      },
    }
  ),
}));

function makeChain(overrides = {}) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    single: jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
    ...overrides,
  };
  return chain;
}

// ── Import handler after mocks ───────────────────────────────────────────────

let handler;
beforeAll(async () => {
  ({ default: handler } = await import('../../api/save-client.js'));
});

beforeEach(() => {
  mockSupabaseImpl = { from: jest.fn(() => makeChain()) };
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/save-client', () => {
  it('OPTIONS → 204', async () => {
    const req = httpMocks.createRequest({ method: 'OPTIONS', headers: { origin: '' } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(204);
  });

  it('GET → 405', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('sin session_id → 400', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      body: { action: 'create', email: 'test@test.com' },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toMatchObject({ error: 'session_id requerido' });
  });

  it('create: crea cliente correctamente → 201', async () => {
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: { id: 'generated-id' }, error: null }),
    });
    mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };

    const req = httpMocks.createRequest({
      method: 'POST',
      body: {
        action: 'create',
        session_id: 'sess-abc',
        email: 'nuevo@test.com',
        data: { email: 'nuevo@test.com' },
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
    expect(res._getJSONData()).toMatchObject({ ok: true, client_id: 'generated-id' });
  });

  it('create: email duplicado → 409 con estado/nombre/id', async () => {
    const existingClient = {
      id: 'existing-id',
      session_id: 'sess-existing',
      estado: 'en_chat',
      nombre_marca: 'Marca Existente',
    };

    const chain = makeChain({
      maybeSingle: jest.fn().mockResolvedValue({ data: existingClient, error: null }),
    });
    mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };

    const req = httpMocks.createRequest({
      method: 'POST',
      body: {
        action: 'create',
        session_id: 'sess-new',
        email: 'existente@test.com',
        data: { email: 'existente@test.com' },
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(409);
    const body = res._getJSONData();
    expect(body.error).toBe('email_exists');
    expect(body.session_id).toBe('sess-existing');
    expect(body.id).toBe('sess-existing');
    expect(body.estado).toBe('en_chat');
    expect(body.nombre).toBe('Marca Existente');
  });

  it('create sin email no verifica duplicado y crea → 201', async () => {
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
    });
    mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };

    const req = httpMocks.createRequest({
      method: 'POST',
      body: { action: 'create', session_id: 'sess-nomail', data: {} },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(201);
  });

  it('update: actualiza estado → 200', async () => {
    const chain = makeChain({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };

    const req = httpMocks.createRequest({
      method: 'POST',
      body: {
        action: 'update',
        session_id: 'sess-abc',
        data: { estado: 'generado' },
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({ ok: true });
  });

  it('feedback: actualiza template y estado → 200', async () => {
    const chain = makeChain({
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };

    const req = httpMocks.createRequest({
      method: 'POST',
      body: {
        action: 'feedback',
        session_id: 'sess-abc',
        data: { template_elegido: 'moderno' },
      },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toMatchObject({ ok: true });
  });

  it('acción desconocida → 400', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      body: { action: 'delete', session_id: 'sess-abc' },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(400);
  });

  it('error de Supabase → 500', async () => {
    const chain = makeChain({
      single: jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    });
    mockSupabaseImpl = { from: jest.fn().mockReturnValue(chain) };

    const req = httpMocks.createRequest({
      method: 'POST',
      body: { action: 'create', session_id: 'sess-abc', email: 'err@test.com', data: {} },
    });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(500);
  });
});
