// Gestiona la generación de 3 previews HTML usando Claude API

const TEMPLATE_SPECS = {
  'calido-artesanal': {
    name: 'Cálido Artesanal',
    description: 'Colores tierra y tipografía serif. Ideal para marcas artesanales y sustentables.',
    spec: `Paleta: primario #7C3D12, acento #C2671A, fondo #FEFAF4, tarjetas #FFF8EE, texto #2C1B0E, secundario #6B4226.
Tipografía: Playfair Display (serif) para títulos, Lato para cuerpo de texto.
Google Fonts @import: https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Lato:wght@300;400;700&display=swap
Estética: Orgánico, cálido, artesanal. Border-radius 16-20px. Fondos con tonos tierra. Separadores delicados.`,
  },
  'minimalista': {
    name: 'Minimalista Profesional',
    description: 'Limpio y directo. Ideal para marca personal, consultoría y servicios profesionales.',
    spec: `Paleta: primario #0F172A, acento #2563EB, fondo #FFFFFF, secciones alternadas #F8FAFC, tarjetas blancas con sombra suave.
Tipografía: Space Grotesk (sans-serif moderna) para títulos, Plus Jakarta Sans para cuerpo.
Google Fonts @import: https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap
Estética: Máximo whitespace. Mucho espacio en blanco. Hero oscuro con texto blanco. Cards con sombra sutil.`,
  },
  'moderno-oscuro': {
    name: 'Moderno Oscuro',
    description: 'Dark mode con acento azul eléctrico. Perfecto para tech, software y agencias digitales.',
    spec: `Paleta: fondo #0F172A (deep navy), secciones #1E293B, acento #2563EB, texto #F8FAFC, secundario #94A3B8, bordes #334155.
Tipografía: Space Grotesk para títulos, Plus Jakarta Sans para cuerpo.
Google Fonts @import: https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap
Estética: Dark mode completo. Glassmorphism en cards. Gradiente azul en hero. Efecto de glow sutil en CTAs.`,
  },
  'editorial-limpio': {
    name: 'Editorial Limpio',
    description: 'Estética de revista de alta gama. Para gastronomía, eventos y moda editorial.',
    spec: `Paleta: primario #1A1A2E, acento #E63946, fondo #FAFAFA, texto oscuro, bordes sutiles #E5E7EB.
Tipografía: Cormorant Garamond (serif editorial) para títulos, Inter para cuerpo.
Google Fonts @import: https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600&display=swap
Estética: Títulos enormes (90-120px), mucho espacio, bordes rectos (border-radius 0), estética de revista.`,
  },
  'natural-sereno': {
    name: 'Natural Sereno',
    description: 'Verdes suaves y tipografía orgánica. Para salud, bienestar y coaching.',
    spec: `Paleta: primario #2D6A4F, acento #52B788, fondo #F9FBF7, secciones #EDF6EC, texto #1B4332, secundario #52796F.
Tipografía: DM Serif Display para títulos, DM Sans para cuerpo.
Google Fonts @import: https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap
Estética: Softness y calma. Border-radius amplio (20-24px). Degradados suaves en verde. Mucho espacio y aire.`,
  },
  'gourmet-calido': {
    name: 'Gourmet Cálido',
    description: 'Tonos ámbar y tipografía italiana. Para gastronomía y catering de autor.',
    spec: `Paleta: fondo oscuro #3D1C00 en hero, fondo página #FFFBF5, acento #C9722A, texto #2C1400, tarjetas #FFF7ED.
Tipografía: Italiana para títulos (sans-serif elegante), Josefin Sans para cuerpo (uppercase, tracking).
Google Fonts @import: https://fonts.googleapis.com/css2?family=Italiana&family=Josefin+Sans:wght@300;400;600;700&display=swap
Estética: Lujoso y cálido. Títulos grandes en italic. Hero muy oscuro con texto crema. Cards con borde ámbar.`,
  },
  'fresco-accesible': {
    name: 'Fresco Accesible',
    description: 'Azul energético con detalles ámbar. Para cursos, talleres y academia.',
    spec: `Paleta: primario #1D4ED8 (azul vibrante), acento #F59E0B (ámbar), fondo #FFFFFF, secciones #EFF6FF, texto #111827.
Tipografía: Nunito (redondeada, amigable) para todo el texto.
Google Fonts @import: https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;700;800;900&display=swap
Estética: Energético y accesible. Bordes redondeados (20-24px). Font-weight 800 en títulos. Degradado azul en hero.`,
  },
  'portafolio-oscuro': {
    name: 'Portafolio Oscuro',
    description: 'Dark con acento violeta. Para fotografía, arte y diseño creativo.',
    spec: `Paleta: fondo #09090B (casi negro), secciones #18181B, acento #A855F7, texto #F8FAFC, secundario #A1A1AA, bordes #27272A.
Tipografía: Bebas Neue para títulos (display, impacto), Inter para cuerpo.
Google Fonts @import: https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600&display=swap
Estética: Maximalismo oscuro. Títulos enormes en Bebas Neue. Hover effects con acento violeta. Grid de portafolio.`,
  },
};

const RUBRO_TEMPLATES = {
  'moda':          ['calido-artesanal', 'editorial-limpio', 'minimalista'],
  'salud':         ['natural-sereno', 'minimalista', 'fresco-accesible'],
  'tech':          ['moderno-oscuro', 'minimalista', 'fresco-accesible'],
  'gastronomia':   ['gourmet-calido', 'editorial-limpio', 'calido-artesanal'],
  'personal':      ['minimalista', 'editorial-limpio', 'moderno-oscuro'],
  'inmobiliaria':  ['minimalista', 'editorial-limpio', 'moderno-oscuro'],
  'educacion':     ['fresco-accesible', 'minimalista', 'natural-sereno'],
  'fotografia':    ['portafolio-oscuro', 'editorial-limpio', 'moderno-oscuro'],
};

function detectRubroCategory(rubro) {
  const r = (rubro || '').toLowerCase();
  if (/moda|ropa|artesa|diseño|boutique|calzado|indument|tejido|joyer/.test(r)) return 'moda';
  if (/salud|bienes|coach|terapia|nutri|psic|médic|wellness|yoga|meditac/.test(r)) return 'salud';
  if (/tech|softw|sistem|agencia digital|startup|app\b|web|it\b|desarrollo|programac/.test(r)) return 'tech';
  if (/gastro|restau|catering|evento|bar|café|comida|cocina|chef|bakery|panadería/.test(r)) return 'gastronomia';
  if (/consul|asesor|freelance|personal brand|independi|abogad|contad|arquitec(?!tura de datos)/.test(r)) return 'personal';
  if (/inmob|construc|arquitectura|propiedad|real estate|alquiler/.test(r)) return 'inmobiliaria';
  if (/educ|curso|taller|capacit|formaci|enseñ|academy|escuela|instituto/.test(r)) return 'educacion';
  if (/fotograf|video|arte|creativ|música|diseño gráfico|audiovisual|ilustrac/.test(r)) return 'fotografia';
  return 'personal';
}

function selectTemplates(rubro) {
  const category = detectRubroCategory(rubro);
  return RUBRO_TEMPLATES[category] || RUBRO_TEMPLATES['personal'];
}

async function fetchPromptTemplate() {
  const res = await fetch('/landing_page/prompts/generacion.txt');
  return res.text();
}

async function generatePreview(brief, templateId, promptTemplate) {
  const spec = TEMPLATE_SPECS[templateId];
  const secciones = brief.secciones || ['hero', 'servicios', 'sobre-mi', 'testimonios', 'contacto'];

  const prompt = promptTemplate
    .replace('{{template_name}}', spec.name)
    .replace('{{template_spec}}', spec.spec)
    .replace('{{datos_cliente}}', JSON.stringify(brief, null, 2))
    .replace('{{secciones}}', secciones.join(', '));

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const html = data.content?.[0]?.text || '';

  // Strip any markdown fences if Claude included them despite instructions
  return html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
}

async function generateAllPreviews(brief, onProgress) {
  const templateIds = selectTemplates(brief.rubro);
  const promptTemplate = await fetchPromptTemplate();
  const results = [];

  for (let i = 0; i < templateIds.length; i++) {
    const id = templateIds[i];
    onProgress(i + 1, templateIds.length, TEMPLATE_SPECS[id].name);
    const html = await generatePreview(brief, id, promptTemplate);
    results.push({
      id,
      name: TEMPLATE_SPECS[id].name,
      description: TEMPLATE_SPECS[id].description,
      html,
    });
  }

  return results;
}

function renderPreviewInIframe(iframe, html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  iframe.src = url;
  iframe._blobUrl = url;
}

function cleanupPreviewUrl(iframe) {
  if (iframe._blobUrl) {
    URL.revokeObjectURL(iframe._blobUrl);
    iframe._blobUrl = null;
  }
}

export { generateAllPreviews, renderPreviewInIframe, cleanupPreviewUrl, TEMPLATE_SPECS };
