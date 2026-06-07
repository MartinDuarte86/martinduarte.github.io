// landing_page/session.js
// Gestión del estado estructurado de la sesión de onboarding.
// Persiste en sessionStorage para sobrevivir recargas sin base de datos externa.

const SESSION_KEY = 'lp_chat_session';

const CAMPOS_OBLIGATORIOS = ['nombre_marca', 'rubro', 'servicios', 'colores', 'contacto_wsp', 'zona'];

function _createSession(id, nombre, apellido) {
  return {
    id,
    nombre_cliente:   nombre,
    apellido_cliente: apellido || '',
    timestamp_inicio: new Date().toISOString(),
    collectedData: {
      nombre_marca:   null,
      rubro:          null,
      servicios:      null,
      colores:        null,
      slogan:         null,
      contacto_wsp:   null,
      contacto_email: null,
      zona:           null,
      horarios:       null,
      redes:          null,
      tiene_logo:     null,
      tiene_fotos:    null,
      estilo_visual:  null,
    },
    campos_pendientes: [...CAMPOS_OBLIGATORIOS],
  };
}

function _save(session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('[Session] Error guardando:', e);
  }
}

export function initSession(nombre, apellido) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const existing = JSON.parse(raw);
      const age = Date.now() - new Date(existing.timestamp_inicio).getTime();
      if (age < 2 * 60 * 60 * 1000) {
        console.log('[Session] Sesión recuperada:', existing.id);
        return existing;
      }
    }
  } catch {}

  const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const session = _createSession(id, nombre, apellido);
  _save(session);
  console.log('[Session] Nueva sesión:', id);
  return session;
}

// Actualiza un campo en collectedData. Si ya tiene valor, solo lo reemplaza
// cuando el nuevo es más específico (más largo) — evita que datos parciales
// del extractor bloqueen datos reales dados después por el cliente.
export function updateField(session, campo, valor) {
  if (valor === null || valor === undefined || valor === '') return;
  if (!(campo in session.collectedData)) return;

  const actual = session.collectedData[campo];

  if (actual === null) {
    session.collectedData[campo] = valor;
    session.campos_pendientes = session.campos_pendientes.filter(c => c !== campo);
    console.log(`[Session] ${campo} = ${JSON.stringify(valor)}`);
    _save(session);
    return;
  }

  const lenActual = String(actual).replace(/\s/g, '').length;
  const lenNuevo  = String(valor).replace(/\s/g, '').length;
  if (lenNuevo > lenActual) {
    console.log(`[Session] ${campo} actualizado: "${actual}" → "${valor}"`);
    session.collectedData[campo] = valor;
    _save(session);
  }
}

// Retorna el bloque de contexto para inyectar al sistema de onboarding.
export function buildContextBlock(session) {
  if (!session) return '';

  const obtenidos = Object.entries(session.collectedData)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `  - ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  const pendientes = session.campos_pendientes.length > 0
    ? session.campos_pendientes.join(', ')
    : 'NINGUNO — el onboarding está completo';

  return `
════════════════════════════════════════════════
DATOS YA RECOLECTADOS — NO VOLVER A PREGUNTAR NINGUNO DE ESTOS
════════════════════════════════════════════════
Cliente: ${session.nombre_cliente} ${session.apellido_cliente}

DATOS CONFIRMADOS:
${obtenidos || '  (ninguno todavía)'}

CAMPOS QUE TODAVÍA FALTAN:
  ${pendientes}

REGLA CRÍTICA: Si un dato aparece en "DATOS CONFIRMADOS", no lo preguntes de nuevo
bajo ninguna circunstancia. Elegí siempre el campo más importante de los pendientes.
════════════════════════════════════════════════`;
}
