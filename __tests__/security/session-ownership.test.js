/**
 * Seguridad — Aislamiento de sesión (Fase 1).
 *
 * Verifica que el acceso a los datos de una sesión se autoriza por la cookie
 * httpOnly firmada y NO por el session_id que viaja en el body/query. Esto cierra
 * el IDOR que permitía leer/escribir la sesión de otra persona conociendo o
 * forjando su id (la causa de las "conversaciones mezcladas").
 */
import httpMocks from 'node-mocks-http';
import jwt from 'jsonwebtoken';
import { cookieFor } from '../helpers/cookie.js';

// ── Redis mock: registra con qué session_id se consultó ──────────────────────
const seen = { get: [], save: [] };
jest.mock('../../api/_lib/redis.js', () => ({
  __esModule: true,
  getBrief:        (sid) => { seen.get.push(sid); return Promise.resolve({ nombre_marca: `brief-de-${sid}` }); },
  getSessionMeta:  () => Promise.resolve({ phase: 'hero' }),
  getMessages:     () => Promise.resolve([]),
  getPreviews:     () => Promise.resolve(null),
  saveBrief:       (sid, p) => { seen.save.push({ sid, p }); return Promise.resolve(); },
  saveSessionMeta: () => Promise.resolve(),
  appendMessage:   () => Promise.resolve(),
  touchSession:    () => Promise.resolve(),
}));

let getSession, saveSession;
beforeAll(async () => {
  ({ default: getSession } = await import('../../api/get-session.js'));
  ({ default: saveSession } = await import('../../api/save-session.js'));
});

beforeEach(() => { seen.get = []; seen.save = []; });

describe('get-session: ownership por cookie', () => {
  it('sin cookie → 401 (no expone datos de ninguna sesión)', async () => {
    const req = httpMocks.createRequest({ method: 'GET', query: { session_id: 'victima' } });
    const res = httpMocks.createResponse();
    await getSession(req, res);
    expect(res.statusCode).toBe(401);
    expect(seen.get).toHaveLength(0);
  });

  it('cookie de A + query=victima → lee la sesión de A, NUNCA la de la víctima', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      query: { session_id: 'victima' },          // intento de IDOR por query
      headers: { cookie: cookieFor('atacante-A') }, // su propia cookie
    });
    const res = httpMocks.createResponse();
    await getSession(req, res);

    expect(res.statusCode).toBe(200);
    // El handler usó el sid de la cookie, no el del query.
    expect(seen.get).toEqual(['atacante-A']);
    expect(res._getJSONData().brief.nombre_marca).toBe('brief-de-atacante-A');
  });

  it('cookie con firma inválida → 401', async () => {
    const forged = jwt.sign({ sid: 'victima' }, 'secreto-equivocado');
    const req = httpMocks.createRequest({
      method: 'GET',
      query: { session_id: 'victima' },
      headers: { cookie: `lp_sid=${forged}` },
    });
    const res = httpMocks.createResponse();
    await getSession(req, res);
    expect(res.statusCode).toBe(401);
    expect(seen.get).toHaveLength(0);
  });
});

describe('save-session: ownership por cookie', () => {
  it('sin cookie → 401 (no escribe en ninguna sesión)', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      body: { session_id: 'victima', type: 'brief', payload: { hero: 'inyectado' } },
    });
    const res = httpMocks.createResponse();
    await saveSession(req, res);
    expect(res.statusCode).toBe(401);
    expect(seen.save).toHaveLength(0);
  });

  it('cookie de A + body.session_id=victima → escribe en A, no en la víctima', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      headers: { cookie: cookieFor('atacante-A') },
      body: { session_id: 'victima', type: 'brief', payload: { hero: 'x' } },
    });
    const res = httpMocks.createResponse();
    await saveSession(req, res);

    expect(res.statusCode).toBe(200);
    expect(seen.save).toEqual([{ sid: 'atacante-A', p: { hero: 'x' } }]);
  });
});
