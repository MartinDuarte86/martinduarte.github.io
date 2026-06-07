// landing_page/extractor.js
// Extrae campos estructurados de un mensaje del usuario usando regex.
// Sin llamadas a la API — procesamiento local, cero latencia.

const PATTERNS = {
  contacto_wsp: [
    /(?:whatsapp|wsp|cel|celular|teléfono|telefono|número|numero)[^\d]{0,10}(\d{6,15})/i,
    /(?:^|\s)(11\d{8})(?:\s|$)/,
    /(?:^|\s)(15\d{8})(?:\s|$)/,
    /(?:^|\s)(\d{10,11})(?:\s|$)/,
  ],

  contacto_email: [
    /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
  ],

  colores: [
    /(?:color(?:es)?|paleta|tono[s]?)[^.]{0,10}(?:son?|es|:)?\s+([a-záéíóúñ,\s]+(?:y\s+[a-záéíóúñ]+)*)/i,
    /(?:quiero|me\s+gusta|prefiero|en\s+tonos?\s+de?)\s+([a-záéíóúñ,\s]+(?:y\s+[a-záéíóúñ]+)*)\s*(?:color|tono)/i,
    /((?:blanco|negro|gris|marrón|marron|beige|crema|azul|rojo|verde|naranja|amarillo|violeta|rosa|dorado|plateado)(?:[,\sy]+(?:blanco|negro|gris|marrón|marron|beige|crema|azul|rojo|verde|naranja|amarillo|violeta|rosa|dorado|plateado))*)/i,
  ],

  zona: [
    /(?:zona|barrio|localidad|opero\s+en|estoy\s+en|ubicad[ao]\s+en)[^.]{0,4}\s+([a-záéíóúñ\s]+?)(?:\.|,|$)/i,
    /(?:\ben\s+)(benavidez|palermo|belgrano|caballito|flores|villa\s+\w+|san\s+\w+|zona\s+norte|zona\s+sur|zona\s+oeste|caba|capital|buenos\s+aires|gba|conurbano)/i,
  ],

  horarios: [
    /(?:de|desde)\s+(\d{1,2}(?::\d{2})?)\s*(?:a|hasta)\s+(\d{1,2}(?::\d{2})?)/i,
    /(\d{1,2})\s*(?:a|hasta)\s*(\d{1,2})\s*(?:hs|horas)/i,
  ],

  tiene_fotos: [
    /(?:tengo|sí\s+tengo|tenemos)\s+(?:fotos?|imágenes?|fotografías?)/i,
    /no\s+tengo\s+(?:fotos?|imágenes?)/i,
  ],

  tiene_logo: [
    /(?:tengo|sí\s+tengo|tenemos)\s+(?:logo|logotipo)/i,
    /no\s+tengo\s+(?:logo|logotipo)/i,
  ],

  redes: [
    /instagram[:\s]*@?([\w.]+)/i,
    /@([\w.]+)\s+(?:en\s+)?instagram/i,
    /(?:no\s+tengo|no\s+tenemos)\s+(?:redes?|instagram|facebook)/i,
  ],
};

function _extractField(text, campo) {
  for (const pattern of PATTERNS[campo]) {
    const m = text.match(pattern);
    if (m) return (m[1] || m[0]).trim();
  }
  return null;
}

function _extractNombreMarca(text) {
  const patterns = [
    /(?:se\s+llama|el\s+nombre\s+es|mi\s+(?:negocio|marca|emprendimiento)\s+(?:es|se\s+llama))\s*["']?([A-ZÁÉÍÓÚÑ][a-záéíóúñA-ZÁÉÍÓÚÑ\s]{2,40})["']?(?:\.|,|$)/i,
    /^["']([A-ZÁÉÍÓÚÑ][a-záéíóúñ\s]{2,40})["']/m,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.length > 2) return m[1].trim();
  }
  return null;
}

function _extractServicios(text) {
  const keywords = [
    'baño', 'corte', 'grooming', 'estilismo', 'tintura',
    'diseño', 'desarrollo', 'consultoría', 'asesoría', 'clases', 'talleres',
    'fotografía', 'video', 'catering', 'eventos', 'reparación', 'instalación',
    'limpieza', 'mantenimiento', 'delivery', 'domicilio', 'online',
  ];
  const found = keywords.filter(kw => new RegExp(kw, 'i').test(text));
  return found.length > 0 ? found.join(', ') : null;
}

function _extractSlogan(text) {
  const patterns = [
    /"([^"]{10,80})"/,
    /'([^']{10,80})'/,
    /(?:slogan|frase|lema)[:\s]+(.{10,80})(?:\.|$)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function _extractRubro(text) {
  const rubros = [
    ['peluquería canina', /peluquer[ií]a\s+canina|groomin|mascotas\s+y\s+perros/i],
    ['gastronomía',       /restaurant|cafeter[ií]a|panader[ií]a|catering|comida/i],
    ['fotografía',        /fotograf[ií]a|sesión\s+de\s+fotos/i],
    ['tecnología',        /software|aplicaci[oó]n|desarrollo\s+web|sistema/i],
    ['salud',             /médico|psicólog|terapeuta|nutricionista|kinesiolog/i],
    ['educación',         /clases|cursos|talleres|academia|profesor/i],
    ['indumentaria',      /ropa|indumentaria|moda|tienda\s+de\s+ropa/i],
    ['inmobiliaria',      /inmobiliaria|propiedades|alquiler|venta\s+de\s+casas/i],
    ['consultoría',       /consultor[ií]a|asesor[ií]a|coach|mentoring/i],
  ];
  for (const [rubro, pattern] of rubros) {
    if (pattern.test(text)) return rubro;
  }
  return null;
}

export function extractFromMessage(text) {
  const result = {};

  for (const campo of Object.keys(PATTERNS)) {
    const valor = _extractField(text, campo);
    if (valor) result[campo] = valor;
  }

  const nombre = _extractNombreMarca(text);
  if (nombre) result.nombre_marca = nombre;

  const servicios = _extractServicios(text);
  if (servicios) result.servicios = servicios;

  const slogan = _extractSlogan(text);
  if (slogan) result.slogan = slogan;

  const rubro = _extractRubro(text);
  if (rubro) result.rubro = rubro;

  return result;
}
