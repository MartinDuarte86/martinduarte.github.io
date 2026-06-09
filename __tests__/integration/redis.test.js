/**
 * Tests de integración — Upstash Redis real
 *
 * Inventan datos de sesión, los guardan via los helpers de redis.js,
 * verifican que estén en el store, y limpian al finalizar.
 *
 * Requiere variables de entorno: UPSTASH_REDIS_URL + UPSTASH_REDIS_TOKEN
 * (cargadas desde .env via dotenv)
 */

// dotenv se carga via jest setupFiles: ["dotenv/config"] en package.json
import {
  saveBrief,
  getBrief,
  saveSessionMeta,
  getSessionMeta,
  appendMessage,
  getMessages,
  checkRateLimit,
  markTokenUsed,
  isTokenUsed,
} from '../../api/_lib/redis.js';

// ID único para no pisar otras sesiones en Redis
const TEST_SESSION = `test-integration-${Date.now()}`;

// ─── Cleanup ─────────────────────────────────────────────────────────────────

// Importamos el cliente directamente para limpiar las claves de test
import redis from '../../api/_lib/redis.js';

afterAll(async () => {
  const keys = await redis.keys(`session:${TEST_SESSION}*`);
  const rateKeys = await redis.keys(`ratelimit:*:127.0.0.1-test-${Date.now()}`);
  const allKeys = [...keys, ...rateKeys].filter(Boolean);
  if (allKeys.length) await redis.del(...allKeys);
  await redis.del(`token:used:test-token-hash-${TEST_SESSION}`);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('[INTEGRACIÓN] Redis — Upstash real', () => {
  // ── Brief ──────────────────────────────────────────────────────────────────
  describe('saveBrief / getBrief', () => {
    const brief = {
      hero: { nombre_marca: 'Peluquería Demo', rubro: 'peluquería', slogan: 'Tu mejor versión' },
      servicios: { servicios: [{ nombre: 'Corte', descripcion: 'A domicilio' }] },
      contacto: { contacto_wsp: '1123456789' },
    };

    it('guarda el brief y lo recupera íntegro', async () => {
      await saveBrief(TEST_SESSION, brief);
      const recovered = await getBrief(TEST_SESSION);

      expect(recovered).not.toBeNull();
      expect(recovered.hero.nombre_marca).toBe('Peluquería Demo');
      expect(recovered.hero.slogan).toBe('Tu mejor versión');
      expect(recovered.servicios.servicios[0].nombre).toBe('Corte');
      expect(recovered.contacto.contacto_wsp).toBe('1123456789');
    });

    it('sobreescribe con datos nuevos sin dejar datos viejos', async () => {
      const briefV2 = { ...brief, hero: { ...brief.hero, slogan: 'Tu corte perfecto' } };
      await saveBrief(TEST_SESSION, briefV2);
      const recovered = await getBrief(TEST_SESSION);
      expect(recovered.hero.slogan).toBe('Tu corte perfecto');
    });
  });

  // ── Session meta ───────────────────────────────────────────────────────────
  describe('saveSessionMeta / getSessionMeta', () => {
    it('guarda meta inicial (phase=hero)', async () => {
      await saveSessionMeta(TEST_SESSION, { phase: 'hero' });
      const meta = await getSessionMeta(TEST_SESSION);
      expect(meta.phase).toBe('hero');
      expect(meta.updatedAt).toBeDefined();
    });

    it('merge incremental: avanzar a phase=servicios no borra datos previos', async () => {
      await saveSessionMeta(TEST_SESSION, { phase: 'servicios', email: 'test@demo.com' });
      const meta = await getSessionMeta(TEST_SESSION);
      expect(meta.phase).toBe('servicios');
      expect(meta.email).toBe('test@demo.com');
    });

    it('finaliza en phase=payment con referencia de pago', async () => {
      await saveSessionMeta(TEST_SESSION, { phase: 'payment', mp_reference: 'ABC12345' });
      const meta = await getSessionMeta(TEST_SESSION);
      expect(meta.phase).toBe('payment');
      expect(meta.mp_reference).toBe('ABC12345');
    });
  });

  // ── Mensajes ───────────────────────────────────────────────────────────────
  describe('appendMessage / getMessages', () => {
    const msgs = [
      { role: 'assistant', content: 'Hola, ¿en qué rubro está tu negocio?', section: 'hero' },
      { role: 'user',      content: 'Soy peluquera a domicilio',            section: 'hero' },
      { role: 'assistant', content: '¿Cuántos años de experiencia tenés?',  section: 'sobre_mi' },
      { role: 'user',      content: 'Más de 6 años',                        section: 'sobre_mi' },
    ];

    it('guarda 4 mensajes y los recupera en orden cronológico', async () => {
      for (const m of msgs) await appendMessage(TEST_SESSION, m);

      const recovered = await getMessages(TEST_SESSION);
      expect(recovered.length).toBeGreaterThanOrEqual(4);

      const roles = recovered.slice(-4).map(m => m.role);
      expect(roles).toEqual(['assistant', 'user', 'assistant', 'user']);
    });

    it('cada mensaje tiene ts (timestamp)', async () => {
      const recovered = await getMessages(TEST_SESSION);
      expect(recovered.every(m => m.ts && m.ts > 0)).toBe(true);
    });

    it('secciones quedan bien etiquetadas', async () => {
      const recovered = await getMessages(TEST_SESSION);
      const sections = [...new Set(recovered.slice(-4).map(m => m.section))];
      expect(sections).toContain('hero');
      expect(sections).toContain('sobre_mi');
    });
  });

  // ── Rate limiting ──────────────────────────────────────────────────────────
  describe('checkRateLimit', () => {
    const ip = `127.0.0.1-test-${TEST_SESSION}`;

    afterAll(async () => {
      await redis.del(`ratelimit:chat:${ip}`);
    });

    it('primera llamada → allowed=true', async () => {
      const result = await checkRateLimit(ip, 'chat');
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
    });

    it('segunda llamada → count sube', async () => {
      const result = await checkRateLimit(ip, 'chat');
      expect(result.count).toBe(2);
    });
  });

  // ── JWT one-time-use ───────────────────────────────────────────────────────
  describe('markTokenUsed / isTokenUsed', () => {
    const tokenHash = `test-token-hash-${TEST_SESSION}`;

    it('token nuevo → isTokenUsed = false', async () => {
      const used = await isTokenUsed(tokenHash);
      expect(used).toBe(false);
    });

    it('después de markTokenUsed → isTokenUsed = true', async () => {
      await markTokenUsed(tokenHash);
      const used = await isTokenUsed(tokenHash);
      expect(used).toBe(true);
    });

    it('no se puede reusar (one-time-use garantizado)', async () => {
      const used = await isTokenUsed(tokenHash);
      expect(used).toBe(true);
    });
  });
});
