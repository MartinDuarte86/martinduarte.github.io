// Gestiona la generación de previews, modal de zoom y almacenamiento en dsn/
import { saveFeedback } from './validator.js';

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

// El brief viaja compacto: sin pretty-print ni campos vacíos (~40% menos tokens de input)
function compactBrief(brief) {
  const clean = Object.fromEntries(
    Object.entries(brief).filter(([, v]) =>
      v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)
    )
  );
  return JSON.stringify(clean);
}

async function generatePreview(brief, templateId, promptTemplate, onChunk) {
  const spec = TEMPLATE_SPECS[templateId];

  const prompt = promptTemplate
    .replace('{{template_name}}', spec.name)
    .replace('{{template_spec}}', spec.spec)
    .replace('{{full_brief}}', compactBrief(brief))
    .replace(/\{\{contacto_wsp\}\}/g, brief.contacto_wsp || '');

  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages:   [{ role: 'user', content: prompt }],
      // Techo de seguridad: a ~59 tok/s, 3200 tokens ≈ 54s < maxDuration 60s de
      // Vercel Hobby. Garantiza que la generación CIERRE antes del timeout de
      // pared (con 8192 el HTML se cortaba a los 60s sin </html>). El prompt
      // mantiene el output compacto; este valor es solo el límite duro.
      max_tokens: 3200,
      intent:     'generation',               // activa rate limit + streaming SSE
      session_id: brief.session_id || null,   // budget guard cubre también Sonnet
    }),
  });

  if (response.status === 429 || response.status === 402) {
    const data = await response.json().catch(() => ({}));
    const err = new Error(data.message || data.error || 'Límite de generaciones alcanzado.');
    err.rateLimitMessage = data.message || data.error || 'Alcanzaste el límite diario de generaciones. Intentá mañana.';
    throw err;
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Claude API error: ${response.status}`);
  }

  // El backend streamea SSE: acumular el HTML a medida que llega
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '', buffer = '', stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop(); // posible evento incompleto al final
    for (const evt of events) {
      const dataLine = evt.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;
      let data;
      try { data = JSON.parse(dataLine.slice(6)); } catch { continue; }
      if (evt.includes('event: error')) throw new Error('generation_failed');
      if (data.t) { html += data.t; onChunk?.(html.length); }
      if (data.stop_reason) stopReason = data.stop_reason;
    }
  }

  if (stopReason === 'max_tokens') {
    console.warn(`[gen] ${templateId}: HTML truncado por max_tokens`);
  }
  return html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
}

async function generateAllPreviews(brief, onProgress) {
  const templateIds = selectTemplates(brief.rubro);
  const promptTemplate = await fetchPromptTemplate();
  const results = [];
  let lastError = null;

  for (let i = 0; i < templateIds.length; i++) {
    const id = templateIds[i];
    onProgress(i + 1, templateIds.length, TEMPLATE_SPECS[id].name);
    try {
      const html = await generatePreview(brief, id, promptTemplate,
        (chars) => onProgress(i + 1, templateIds.length, TEMPLATE_SPECS[id].name, chars));
      results.push({
        id,
        name: TEMPLATE_SPECS[id].name,
        description: TEMPLATE_SPECS[id].description,
        html,
      });
    } catch (err) {
      lastError = err;
      // Si es rate limit y no hay nada generado, no tiene sentido seguir
      if (err.rateLimitMessage && results.length === 0) throw err;
      console.warn(`[gen] Falló ${id}, continúo con los demás:`, err.message);
    }
  }

  // 1, 2 o 3 diseños — lo que haya salido bien vale más que descartar todo
  if (results.length === 0) throw (lastError || new Error('No se pudo generar ningún diseño'));

  // Mejora 4: guardar el set en dsn/
  await saveDsnSet(brief, results).catch(err => console.warn('No se pudo guardar dsn set:', err));

  return results;
}

// ─── Mejora 4: Guardado en dsn/ via GitHub REST API ──────────────────────────

async function saveDsnSet(brief, previews) {
  await Promise.all(previews.map(async (p) => {
    try {
      const r = await fetch('/api/save-dsn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id:    brief.session_id    || null,
          client_id:     brief.cliente_id    || null,
          rubro:         brief.rubro,
          template_name: p.name,
          html:          p.html,
        }),
      });
      if (!r.ok) { console.warn(`[save-dsn] ${p.name}: status ${r.status}`); return; }
      const data = await r.json();
      p.dsnId = data.dsn_id || null;
    } catch (err) {
      console.warn(`[save-dsn] ${p.name}: error`, err.message);
    }
  }));
}

// ─── Mejora 2: Modal de preview con zoom ─────────────────────────────────────

let _modalScale = 1;
let _modalOnSelect = null;
let _modalPreviewIndex = null;

function openPreviewModal(preview, index, onSelect) {
  const modal = document.getElementById('preview-modal');
  if (!modal) return;

  _modalScale = 1;
  _modalOnSelect = onSelect;
  _modalPreviewIndex = index;

  document.getElementById('modal-title').textContent = preview.name;

  const inner = document.getElementById('modal-preview-content');
  inner.style.transform = 'scale(1)';
  inner.innerHTML = '';

  const iframe = document.createElement('iframe');
  iframe.title = preview.name;
  iframe.style.cssText = 'width:100%;height:100vh;border:none;display:block;pointer-events:none;';
  inner.appendChild(iframe);
  renderPreviewInIframe(iframe, preview.html);

  // El iframe no tiene auto-altura: sin esto, todo el contenido debajo del
  // primer viewport del diseño generado queda inaccesible (ni el iframe ni
  // el wrap externo tienen scroll real sobre él).
  iframe.addEventListener('load', () => {
    try {
      const fullHeight = iframe.contentDocument?.documentElement?.scrollHeight;
      if (fullHeight) iframe.style.height = fullHeight + 'px';
    } catch { /* cross-origin: se mantiene el fallback de 100vh */ }
  });

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  const wrap = document.getElementById('modal-preview-wrap');

  // Zoom con scroll de mouse
  function onWheel(e) {
    e.preventDefault();
    _modalScale += e.deltaY * -0.001;
    _modalScale = Math.min(Math.max(0.5, _modalScale), 3);
    inner.style.transform = `scale(${_modalScale})`;
    inner.style.transformOrigin = 'top center';
  }
  wrap.addEventListener('wheel', onWheel, { passive: false });

  // Reset con doble clic
  function onDblClick() {
    _modalScale = 1;
    inner.style.transform = 'scale(1)';
  }
  inner.addEventListener('dblclick', onDblClick);

  // Pinch en mobile via Hammer.js
  if (typeof Hammer !== 'undefined') {
    const hammer = new Hammer(wrap);
    hammer.get('pinch').set({ enable: true });
    let startScale = 1;
    hammer.on('pinchstart', () => { startScale = _modalScale; });
    hammer.on('pinch', (e) => {
      _modalScale = Math.min(Math.max(0.5, startScale * e.scale), 3);
      inner.style.transform = `scale(${_modalScale})`;
      inner.style.transformOrigin = 'top center';
    });
    modal._hammerInstance = hammer;
  }

  // Guardar referencias para cleanup
  modal._onWheel = onWheel;
  modal._onDblClick = onDblClick;
  modal._wrapEl = wrap;
  modal._innerEl = inner;

  // Cerrar con overlay
  document.getElementById('modal-overlay').onclick = () => closePreviewModal();
  document.getElementById('modal-close-btn').onclick = () => closePreviewModal();

  // Botón elegir dentro del modal
  document.getElementById('modal-select-btn').onclick = () => {
    closePreviewModal();
    if (_modalOnSelect) _modalOnSelect();
  };
}

function closePreviewModal() {
  const modal = document.getElementById('preview-modal');
  if (!modal) return;

  if (modal._wrapEl && modal._onWheel) {
    modal._wrapEl.removeEventListener('wheel', modal._onWheel);
  }
  if (modal._innerEl && modal._onDblClick) {
    modal._innerEl.removeEventListener('dblclick', modal._onDblClick);
  }
  if (modal._hammerInstance) {
    modal._hammerInstance.destroy();
    modal._hammerInstance = null;
  }

  modal.hidden = true;
  document.body.style.overflow = '';

  // Limpiar iframe
  const inner = document.getElementById('modal-preview-content');
  if (inner) {
    const iframe = inner.querySelector('iframe');
    if (iframe) cleanupPreviewUrl(iframe);
    inner.innerHTML = '';
  }
}

// ─── Mejora 3: Card alternativa ───────────────────────────────────────────────

function addAltCard(grid, sessionId) {
  const card = document.createElement('div');
  card.className = 'preview-card preview-card--alt';
  card.setAttribute('role', 'listitem');
  card.innerHTML = `
    <div class="alt-card-body">
      <div class="alt-card-icon">✏️</div>
      <div class="alt-card-title">Ninguno me representa / Quiero algo diferente</div>
      <div class="alt-card-sub">Contanos qué estás buscando y lo tenemos en cuenta</div>
    </div>
    <div class="alt-card-feedback" id="alt-card-feedback">
      <textarea
        class="alt-feedback-textarea"
        placeholder="Describí qué te gustaría: estilo, colores, referencias, lo que sea..."
        maxlength="600"
        aria-label="Feedback de diseño"
      ></textarea>
      <button class="alt-feedback-confirm" type="button">Listo, tenerlo en cuenta</button>
      <div class="alt-feedback-saved">¡Gracias! Martín lo va a tener en cuenta.</div>
    </div>`;
  grid.appendChild(card);

  const body    = card.querySelector('.alt-card-body');
  const section = card.querySelector('.alt-card-feedback');
  const btn     = card.querySelector('.alt-feedback-confirm');
  const saved   = card.querySelector('.alt-feedback-saved');
  const textarea = card.querySelector('.alt-feedback-textarea');

  body.addEventListener('click', () => {
    section.classList.add('visible');
    textarea.focus();
  });

  btn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      if (sessionId) {
        await saveFeedback(sessionId, text);
      }
      saved.classList.add('visible');
      btn.style.display = 'none';
    } catch (err) {
      console.warn('No se pudo guardar feedback:', err);
      saved.textContent = '¡Gracias! Fue registrado.';
      saved.classList.add('visible');
      btn.style.display = 'none';
    }
  });
}

// ─── Utilidades de iframe ─────────────────────────────────────────────────────

function renderPreviewInIframe(iframe, html) {
  // sandbox="allow-same-origin" permite que el blob URL funcione pero bloquea
  // scripts en el HTML generado (previene XSS si el LLM inyecta <script> tags)
  if (!iframe.hasAttribute('sandbox')) {
    iframe.setAttribute('sandbox', 'allow-same-origin');
  }
  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  iframe.src = url;
  iframe._blobUrl = url;
}

function cleanupPreviewUrl(iframe) {
  if (iframe._blobUrl) {
    URL.revokeObjectURL(iframe._blobUrl);
    iframe._blobUrl = null;
  }
}

export {
  generateAllPreviews,
  renderPreviewInIframe,
  cleanupPreviewUrl,
  openPreviewModal,
  closePreviewModal,
  addAltCard,
  TEMPLATE_SPECS,
};
