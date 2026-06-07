// landing_page/extractor.js
// Estrategia híbrida:
// - Regex estructurado para teléfono, email, redes, slogan, fotos, logo (siempre corre)
// - Captura contextual posicional para el campo pendiente actual (sin diccionario de
//   vocabulario por rubro — agnóstica al tipo de negocio, sin dependencia humana)
// La extracción semántica con Claude al cierre vive en chat.js (extractStructuredData).

// Elimina acentos/diacríticos para matching robusto independiente de tildes
function _norm(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

// ─── Patrones estructurados (regex) ────────────────────────────────────────
// Solo para datos con formato predecible: teléfono, email, redes, slogan, fotos, logo
const STRUCTURED_PATTERNS = {
  contacto_wsp: [
    /(?:whatsapp|wsp|cel(?:ular)?|tel(?:[eé]fono)?|n[uú]mero)[^\d]{0,10}(\d{6,15})/i,
    /(?:^|\s)(11\d{8})(?:\s|$)/,
    /(?:^|\s)(15\d{8})(?:\s|$)/,
    /(?:^|\s)(\d{10,11})(?:\s|$)/,
  ],

  contacto_email: [
    /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
  ],

  redes: [
    /instagram[:\s]*@?([\w.]+)/i,
    /@([\w.]+)\s+(?:en\s+)?instagram/i,
    /(?:no\s+ten(?:go|emos)\s+(?:redes?|instagram|facebook))/i,
  ],

  slogan: [
    /"([^"]{8,100})"/,
    /'([^']{8,100})'/,
    /(?:slogan|frase|lema|tagline)[:\s]+(.{8,100})(?:\.|$)/i,
  ],

  tiene_fotos: [
    /(?:tengo|s[íi]\s+tengo|tenemos)\s+(?:fotos?|im[áa]genes?)/i,
    /no\s+tengo\s+(?:fotos?|im[áa]genes?)/i,
  ],

  tiene_logo: [
    /(?:tengo|s[íi]\s+tengo|tenemos)\s+(?:logo|logotipo)/i,
    /no\s+tengo\s+(?:logo|logotipo)/i,
  ],
};

function _esNegativa(text) {
  return /^(?:no|nop(?:e)?|ningun[oa]?|tampoco|sin\s+\w+|no\s+ten(?:go|emos)|no\s+hay|por\s+ahora\s+no)[\s.,!]*$/i.test(_norm(text).trim());
}

const LONGITUD_MINIMA = {
  nombre_marca:   2,
  rubro:          3,
  servicios:      4,
  colores:        3,
  zona:           3,
  slogan:         8,
  descripcion:    10,
  contacto_wsp:   6,
  contacto_email: 6,
  horarios:       3,
  estilo_visual:  3,
};

// ─── Captura contextual posicional ─────────────────────────────────────────
// Guarda la respuesta del usuario como valor del campo que el bot acababa de
// preguntar. No clasifica ni reconoce vocabulario — lo guarda verbatim.
// Esto la hace agnóstica al rubro: funciona igual para un estudio contable,
// una peluquería canina o una inmobiliaria, sin mantenimiento de diccionarios.
function extractContextual(userMessage, campoPendiente) {
  if (!campoPendiente || !userMessage?.trim()) return null;

  const texto = userMessage.trim();

  if (_esNegativa(texto)) {
    return { [campoPendiente]: '__no_tiene__' };
  }

  const minLen = LONGITUD_MINIMA[campoPendiente] || 2;
  if (texto.length < minLen) return null;

  if (campoPendiente === 'contacto_wsp') {
    const digits = texto.replace(/\D/g, '');
    if (digits.length < 8) return null;
    return { contacto_wsp: digits };
  }

  if (campoPendiente === 'contacto_email') {
    if (!/@/.test(texto)) return null;
    return { contacto_email: texto };
  }

  if (campoPendiente === 'colores' || campoPendiente === 'estilo_visual') {
    const tieneColorOEstilo = /(blanco|negro|gris|marr[oó]n|beige|azul|rojo|verde|naranja|violeta|rosa|dorado|plateado|oscuro|claro|moderno|minimalista|elegante|formal|colorido|sobrio)/i.test(_norm(texto));
    if (!tieneColorOEstilo && texto.length < 10) return null;
  }

  return { [campoPendiente]: texto };
}

function extractStructured(text) {
  const result = {};
  for (const [campo, patterns] of Object.entries(STRUCTURED_PATTERNS)) {
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m) {
        result[campo] = (m[1] || m[0]).trim();
        break;
      }
    }
  }
  return result;
}

// Combina extracción estructurada (siempre) + captura contextual posicional
// (cuando se conoce el campo que el bot estaba preguntando).
//
// @param {string} text - Mensaje del usuario
// @param {string|null} campoPendiente - Primer campo en campos_pendientes de la sesión
export function extractFromMessage(text, campoPendiente = null) {
  const structured = extractStructured(text);
  const contextual = campoPendiente ? extractContextual(text, campoPendiente) : null;

  // structured tiene prioridad para los campos que cubre (formato predecible)
  return { ...contextual, ...structured };
}

export { _norm };
