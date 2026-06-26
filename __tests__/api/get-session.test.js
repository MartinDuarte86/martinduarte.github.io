import httpMocks from 'node-mocks-http';
import { cookieFor } from '../helpers/cookie.js';

// ── Redis mock ───────────────────────────────────────────────────────────────

const mockGetBrief = jest.fn();
const mockGetSessionMeta = jest.fn();
const mockGetMessages = jest.fn();
const mockGetPreviews = jest.fn();

jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  getBrief: (...args) => mockGetBrief(...args),
  getSessionMeta: (...args) => mockGetSessionMeta(...args),
  getMessages: (...args) => mockGetMessages(...args),
  getPreviews: (...args) => mockGetPreviews(...args),
}));

let handler;
beforeAll(async () => {
  ({ default: handler } = await import('../../api/get-session.js'));
});

beforeEach(() => {
  mockGetBrief.mockReset();
  mockGetSessionMeta.mockReset();
  mockGetMessages.mockReset().mockResolvedValue([]);
  mockGetPreviews.mockReset().mockResolvedValue(null);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/get-session', () => {
  it('POST → 405', async () => {
    const req = httpMocks.createRequest({ method: 'POST' });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
  });

  it('sin cookie de sesión → 401', async () => {
    const req = httpMocks.createRequest({ method: 'GET', query: {} });
    const res = httpMocks.createResponse();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
  });

  it('sesión inexistente (meta y brief null) → 404', async () => {
    mockGetBrief.mockResolvedValue(null);
    mockGetSessionMeta.mockResolvedValue(null);

    const req = httpMocks.createRequest({ method: 'GET', query: { session_id: 'ghost' }, headers: { cookie: cookieFor('ghost') } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res._getJSONData()).toMatchObject({ found: false });
  });

  it('sesión existente → 200 con meta, brief y messages', async () => {
    const meta = { phase: 'hero', updatedAt: 1234 };
    const brief = { hero: 'Titulo' };
    const messages = [{ role: 'user', content: 'Hola' }];

    mockGetSessionMeta.mockResolvedValue(meta);
    mockGetBrief.mockResolvedValue(brief);
    mockGetMessages.mockResolvedValue(messages);
    mockGetPreviews.mockResolvedValue(null);

    const req = httpMocks.createRequest({ method: 'GET', query: { session_id: 'sid-123' }, headers: { cookie: cookieFor('sid-123') } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res._getJSONData();
    expect(body.found).toBe(true);
    expect(body.meta).toEqual(meta);
    expect(body.brief).toEqual(brief);
    expect(body.messages).toEqual(messages);
  });

  it('solo meta (sin brief) → 200 (sesión válida)', async () => {
    mockGetSessionMeta.mockResolvedValue({ phase: 'hero' });
    mockGetBrief.mockResolvedValue(null);

    const req = httpMocks.createRequest({ method: 'GET', query: { session_id: 'sid-meta-only' }, headers: { cookie: cookieFor('sid-meta-only') } });
    const res = httpMocks.createResponse();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData().found).toBe(true);
  });
});
