/**
 * Tests de integración — Supabase PostgreSQL real
 *
 * Inventan un cliente de prueba, lo insertan en la tabla clients,
 * verifican que esté, actualizan el estado, y limpian al finalizar.
 *
 * Requiere: SUPABASE_URL + SUPABASE_SERVICE_KEY en .env
 */

// dotenv se carga via jest setupFiles: ["dotenv/config"] en package.json
import supabase from '../../api/_lib/supabase.js';

// Datos de test inventados — email con dominio de test para identificarlos claramente
const TEST_SESSION = `test-integration-${Date.now()}`;
const TEST_EMAIL   = `test+${Date.now()}@martinduarte-testing.com`;

const TEST_CLIENT = {
  session_id:             TEST_SESSION,
  email:                  TEST_EMAIL,
  nombre_marca:           'Peluquería Test Integración',
  rubro:                  'peluquería',
  estado:                 'iniciado',
  mp_external_reference:  TEST_SESSION,
  full_brief:             null,
};

// ─── Cleanup ─────────────────────────────────────────────────────────────────

afterAll(async () => {
  await supabase.from('clients').delete().eq('session_id', TEST_SESSION);
  await supabase.from('design_sets').delete().eq('session_id', TEST_SESSION);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('[INTEGRACIÓN] Supabase — PostgreSQL real', () => {
  let clientId;

  // ── Crear cliente ──────────────────────────────────────────────────────────
  describe('INSERT clients', () => {
    it('inserta el cliente de prueba y devuelve el ID generado', async () => {
      const { data, error } = await supabase
        .from('clients')
        .insert(TEST_CLIENT)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.session_id).toBe(TEST_SESSION);
      expect(data.email).toBe(TEST_EMAIL);
      expect(data.nombre_marca).toBe('Peluquería Test Integración');
      expect(data.estado).toBe('iniciado');
      clientId = data.id;
    });

    it('la fila aparece en un SELECT inmediato (read-your-writes)', async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('session_id', TEST_SESSION)
        .single();

      expect(error).toBeNull();
      expect(data.email).toBe(TEST_EMAIL);
      expect(data.rubro).toBe('peluquería');
    });

    it('rechaza session_id duplicado (constraint UNIQUE en session_id)', async () => {
      // session_id es UNIQUE en el schema; email puede repetirse (solo tiene índice)
      const { error } = await supabase
        .from('clients')
        .insert({ ...TEST_CLIENT, email: 'diferente@test.com' }); // mismo session_id

      // Supabase devuelve error de constraint violation
      expect(error).not.toBeNull();
      expect(error.code).toMatch(/23505|unique/i); // unique_violation
    });
  });

  // ── Actualizar estado (flujo de onboarding) ────────────────────────────────
  describe('UPDATE clients — estados del flujo', () => {
    it('pasa de iniciado → en_chat cuando arranca el chat', async () => {
      const { error } = await supabase
        .from('clients')
        .update({ estado: 'en_chat' })
        .eq('session_id', TEST_SESSION);

      expect(error).toBeNull();

      const { data } = await supabase
        .from('clients').select('estado').eq('session_id', TEST_SESSION).single();
      expect(data.estado).toBe('en_chat');
    });

    it('guarda el full_brief cuando finaliza la conversación', async () => {
      const brief = {
        hero:      { nombre_marca: 'Peluquería Test', slogan: 'Tu mejor versión' },
        servicios: { servicios: [{ nombre: 'Corte', descripcion: 'A domicilio' }] },
        contacto:  { contacto_wsp: '1123456789' },
      };

      const { error } = await supabase
        .from('clients')
        .update({ full_brief: brief, estado: 'brief_completo' })
        .eq('session_id', TEST_SESSION);

      expect(error).toBeNull();

      const { data } = await supabase
        .from('clients').select('full_brief, estado').eq('session_id', TEST_SESSION).single();
      expect(data.estado).toBe('brief_completo');
      expect(data.full_brief.hero.slogan).toBe('Tu mejor versión');
    });

    it('registra el template elegido por el cliente', async () => {
      const { error } = await supabase
        .from('clients')
        .update({ template_elegido: 'moderno-oscuro', estado: 'diseños_generados' })
        .eq('session_id', TEST_SESSION);

      expect(error).toBeNull();

      const { data } = await supabase
        .from('clients').select('template_elegido').eq('session_id', TEST_SESSION).single();
      expect(data.template_elegido).toBe('moderno-oscuro');
    });

    it('pasa a aprobado cuando Martin aprueba el diseño', async () => {
      const { error } = await supabase
        .from('clients').update({ estado: 'aprobado' }).eq('session_id', TEST_SESSION);
      expect(error).toBeNull();

      const { data } = await supabase
        .from('clients').select('estado').eq('session_id', TEST_SESSION).single();
      expect(data.estado).toBe('aprobado');
    });

    it('pasa a rechazado cuando Martin rechaza el diseño', async () => {
      const { error } = await supabase
        .from('clients').update({ estado: 'rechazado' }).eq('session_id', TEST_SESSION);
      expect(error).toBeNull();

      const { data } = await supabase
        .from('clients').select('estado').eq('session_id', TEST_SESSION).single();
      expect(data.estado).toBe('rechazado');
    });
  });

  // ── Design sets ────────────────────────────────────────────────────────────
  describe('INSERT design_sets', () => {
    it('guarda un set de 3 templates para el cliente', async () => {
      // design_sets schema: { id, client_id, session_id, rubro, template_name, html_preview, thumbnail_url, visible_en_carousel, created_at }
      const templates = [
        { rubro: 'peluquería', template_name: 'moderno-oscuro',          html_preview: '<html>T1</html>' },
        { rubro: 'peluquería', template_name: 'minimalista-profesional', html_preview: '<html>T2</html>' },
        { rubro: 'peluquería', template_name: 'fresco-accesible',        html_preview: '<html>T3</html>' },
      ];

      for (const tpl of templates) {
        const { error } = await supabase
          .from('design_sets')
          .insert({ session_id: TEST_SESSION, ...tpl });
        expect(error).toBeNull();
      }

      const { data } = await supabase
        .from('design_sets')
        .select('template_name, html_preview')
        .eq('session_id', TEST_SESSION);

      expect(data.length).toBe(3);
      expect(data.map(d => d.template_name)).toContain('moderno-oscuro');
      expect(data.map(d => d.template_name)).toContain('fresco-accesible');
    });

    it('puede recuperar el HTML de un template específico (para approve.js)', async () => {
      const { data, error } = await supabase
        .from('design_sets')
        .select('html_preview')
        .eq('session_id', TEST_SESSION)
        .eq('template_name', 'moderno-oscuro')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data.html_preview).toBe('<html>T1</html>');
    });
  });
});
