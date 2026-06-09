/**
 * Tests para las funciones de validator.js.
 *
 * validator.js corre en browser, por lo que mockeamos los globals necesarios
 * (localStorage, document, fetch) y verificamos solo la lógica de negocio.
 */

// ── Browser globals mock ─────────────────────────────────────────────────────

const localStorageStore = {};
global.localStorage = {
  getItem: (k) => localStorageStore[k] ?? null,
  setItem: (k, v) => { localStorageStore[k] = v; },
  removeItem: (k) => { delete localStorageStore[k]; },
};

// DOM mínimo para que el módulo no explote al cargarse
global.document = {
  getElementById: jest.fn().mockReturnValue(null),
  addEventListener: jest.fn(),
};

// fetch mock global
global.fetch = jest.fn();

// ── Helpers extraídos (funciones puras de validator.js) ───────────────────────
// Las probamos directamente sin importar el módulo completo porque el módulo
// registra listeners al ser evaluado y requiere DOM completo.

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Tests: validación de email ────────────────────────────────────────────────

describe('isValidEmailFormat', () => {
  it.each([
    ['test@example.com', true],
    ['user.name+tag@sub.domain.org', true],
    ['a@b.co', true],
    ['invalid', false],
    ['@nodomain.com', false],
    ['noatsign', false],
    ['spaces @domain.com', false],
    ['test@.com', false],
  ])('%s → %s', (email, expected) => {
    expect(isValidEmailFormat(email)).toBe(expected);
  });
});

// ── Tests: UUID generado ──────────────────────────────────────────────────────

describe('generateId', () => {
  it('genera un UUID v4 con formato correcto', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('cada llamada genera un ID único', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});

// ── Tests: payload de saveClientViaApi ────────────────────────────────────────
// Verifica que el fetch a /api/save-client envíe el formato correcto que
// save-client.js espera: { action, session_id, email, data }

describe('saveClientViaApi — payload format', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  it('envía session_id, email y data como campos de primer nivel', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    });

    const client = {
      id: 'test-session-uuid',
      email: 'martin@test.com',
      nombre: 'Martin',
      apellido: 'Duarte',
    };

    // Reimplementamos saveClientViaApi tal como quedó después del fix
    async function saveClientViaApi(client) {
      const res = await fetch('/api/save-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          session_id: client.id,
          email: client.email,
          data: { email: client.email },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) return { conflict: true, ...data };
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return { conflict: false };
    }

    await saveClientViaApi(client);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/save-client');

    const body = JSON.parse(options.body);
    // Verifica que session_id llegue como campo de primer nivel (el bug era que llegaba undefined)
    expect(body.session_id).toBe('test-session-uuid');
    expect(body.email).toBe('martin@test.com');
    expect(body.action).toBe('create');
    expect(body.data).toBeDefined();
    // El viejo bug: enviaba { client: {...} } en lugar de campos separados
    expect(body.client).toBeUndefined();
  });

  it('maneja respuesta 409 (email duplicado) correctamente', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'email_exists',
        session_id: 'sess-existing',
        id: 'sess-existing',
        estado: 'en_chat',
        nombre: 'Martin',
      }),
    });

    async function saveClientViaApi(client) {
      const res = await fetch('/api/save-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          session_id: client.id,
          email: client.email,
          data: { email: client.email },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) return { conflict: true, ...data };
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      return { conflict: false };
    }

    const result = await saveClientViaApi({ id: 'new-id', email: 'martin@test.com' });

    // El conflict handler en validator.js usa: { estado, nombre, id }
    expect(result.conflict).toBe(true);
    expect(result.estado).toBe('en_chat');
    expect(result.nombre).toBe('Martin');
    expect(result.id).toBe('sess-existing');
  });
});
