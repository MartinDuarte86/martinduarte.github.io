import httpMocks from 'node-mocks-http';
import { cookieFor } from '../helpers/cookie.js';

// ── Redis mock ───────────────────────────────────────────────────────────────

const mockSaveBrief = jest.fn().mockResolvedValue(undefined);
const mockSaveSessionMeta = jest.fn().mockResolvedValue(undefined);
const mockAppendMessage = jest.fn().mockResolvedValue(undefined);
const mockTouchSession = jest.fn().mockResolvedValue(undefined);

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  saveBrief:       (...args) => mockSaveBrief(...args),
  saveSessionMeta: (...args) => mockSaveSessionMeta(...args),
  appendMessage:   (...args) => mockAppendMessage(...args),
  touchSession:    (...args) => mockTouchSession(...args),
}));

let handler;
beforeAll(async () => {
  ({ default: handler } = await import('../../api/save-session.js'));
});

beforeEach(() => {
  mockSaveBrief.mockClear();
  mockSaveSessionMeta.mockClear();
  mockAppendMessage.mockClear();
});

// El session_id ahora sale de la cookie firmada (no del body). Helper para armar
// un POST autenticado con la cookie de la sesión 'sid'.
function authedPost(body) {
  return httpMocks.createRequest({
    method: 'POST',
    headers: { cookie: cookieFor('sid') },
    body,
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/save-session', () => {
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

  it('sin cookie de sesión → 401', async () => {
    const req = httpMocks.createRequest({ method: 'POST', body: { type: 'brief' } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('sin type → 400', async () => {
    const req = authedPost({});
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('type brief → llama saveBrief y retorna 200', async () => {
    const req = authedPost({ type: 'brief', payload: { hero: 'Hola' } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockSaveBrief).toHaveBeenCalledWith('sid', { hero: 'Hola' });
  });

  it('type meta → llama saveSessionMeta y retorna 200', async () => {
    const req = authedPost({ type: 'meta', payload: { phase: 'hero' } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockSaveSessionMeta).toHaveBeenCalledWith('sid', { phase: 'hero' });
  });

  it('type message con role y content → llama appendMessage y retorna 200', async () => {
    const msg = { role: 'user', content: 'Hola', section: 'hero' };
    const req = authedPost({ type: 'message', payload: msg });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockAppendMessage).toHaveBeenCalledWith('sid', msg);
  });

  it('type message sin role → 400', async () => {
    const req = authedPost({ type: 'message', payload: { content: 'Hola' } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('type message sin content → 400', async () => {
    const req = authedPost({ type: 'message', payload: { role: 'user' } });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('type messages_batch con array → llama appendMessage N veces', async () => {
    const msgs = [
      { role: 'user', content: 'A', section: 's1' },
      { role: 'assistant', content: 'B', section: 's1' },
    ];
    const req = authedPost({ type: 'messages_batch', payload: msgs });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockAppendMessage).toHaveBeenCalledTimes(2);
  });

  it('type messages_batch con no-array → 400', async () => {
    const req = authedPost({ type: 'messages_batch', payload: 'not-array' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('type desconocido → 400', async () => {
    const req = authedPost({ type: 'unknown' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
  });
});
