// Motor del chat: estado, prompts, llamadas a Claude y transiciones de UI
import { generateAllPreviews, renderPreviewInIframe, openPreviewModal, addAltCard } from './generator.js';
import { sendNotification } from './notifier.js';
import { initRegistrationForm, getClientData, saveSession } from './validator.js';
import { initCarousel, buildChatCarouselWidget, buildPreviewsCarouselWidget } from './carousel.js';
import { initSession, updateField, buildContextBlock, getCampoPendiente } from './session.js';
import { extractFromMessage } from './extractor.js';

const MP_LINK = 'https://mpago.la/1Dufc3b';

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB — Vercel serverless body limit es 4.5 MB; base64 agrega ~33%

const PHASE = {
  GREETING:         'greeting',
  EVALUATING:       'evaluating',
  ONBOARDING:       'onboarding',
  CAROUSEL_REVIEW:  'carousel_review',   // Esperando que el usuario elija o rechace diseños previos
  BRAND_DEFINITION: 'brand_definition',  // Preguntas de identidad visual + archivos opcionales
  GENERATING:       'generating',
  SELECTING:        'selecting',
  PAYMENT:          'payment',
  NOTIFYING:        'notifying',
  DONE:             'done',
};

// Máximo de mensajes a enviar por fase — alineado con el hard limit de api/claude.js (20)
const ONBOARDING_MSG_LIMIT      = 20;
const BRAND_DEFINITION_MSG_LIMIT = 20;

let _isSending = false; // debounce: evita doble-clic y envíos duplicados
let currentSession = null;

let state = {
  phase: PHASE.GREETING,
  messages: [],
  prompts: { eval: '', onboarding: '', brand: '' },
  brief: null,
  brandBrief: null,
  previews: [],
  selectedPreview: null,
  uploadedFiles: [], // { name, path, size, type }
  pendingFiles: [],  // File objects pendientes de subir
};

// ─── Inicialización ────────────────────────────────────────────────────────────

export async function init() {
  await loadPrompts();

  initRegistrationForm((clientData) => {
    window._chatSessionReady = true;
    window.flowModal?.goToStep(3);

    currentSession = initSession(clientData.nombre, clientData.apellido);

    const nombre = clientData.nombre;
    appendMessage('ai', `Hola ${nombre}. Contame sobre tu proyecto — ¿de qué se trata tu negocio o idea?`);
    setupEventListeners();
  });
}

async function loadPrompts() {
  try {
    const [evalRes, onboardRes] = await Promise.all([
      fetch('/landing_page/prompts/evaluacion.txt'),
      fetch('/landing_page/prompts/onboarding.txt'),
    ]);
    state.prompts.eval       = evalRes.ok ? await evalRes.text() : '';
    state.prompts.onboarding = onboardRes.ok ? await onboardRes.text() : '';
  } catch {
    // Continúa sin prompts externos; los inline funcionan igual
    console.warn('No se pudieron cargar los archivos de prompt.');
  }

  // Prompt de definición de marca (inline — puede moverse a un .txt)
  state.prompts.brand = `Sos el asistente de diseño de Martín Duarte. El cliente ya completó el brief de su negocio.
Tu objetivo es definir la identidad visual haciéndole preguntas específicas cuando sea necesario.
Temas a cubrir (solo los que falten — si ya están en el brief, no los repitas):
- Paleta de colores (referencia o sensación que quiere transmitir)
- Tipografía o estilo visual (moderno, clásico, minimalista, colorido, etc.)
- Referencias visuales (marcas, sitios o estilos que le gustan)
- Público objetivo y tono de comunicación

Cuando tengas colores, estilo y al menos una referencia de público, respondé SOLO con este JSON sin texto adicional:
\`\`\`json
{
  "colores_principales": ["#hex1", "#hex2"],
  "estilo_visual": "moderno / minimalista / clásico / colorido / etc",
  "tipografia": "descripción del estilo tipográfico",
  "tono": "descripción del tono de comunicación",
  "referencias": "descripción de referencias visuales mencionadas",
  "publico_objetivo": "descripción del público",
  "notas_adicionales": "cualquier dato extra relevante para el diseño"
}
\`\`\`

═══════════════════════════════════════
REGLAS DE COMUNICACIÓN — OBLIGATORIAS
═══════════════════════════════════════

CONTEXTO CRÍTICO:
- Revisá siempre el historial completo antes de responder.
- Si el cliente ya mencionó colores, estilos o referencias, NO volvás a preguntarlo.
- Si está en los datos del brief inyectados al inicio del prompt, tomalo como confirmado.

PREGUNTAS:
- Máximo UNA por mensaje. Si necesitás varias, elegí la más importante primero.
- No uses listas de preguntas. Preguntá en prosa natural.

TONO:
- Directo y profesional. Sin frases de chatbot: "¡Me encanta!", "¡Excelente!"
- Acusá recibo de forma natural: "Bien." / "Lo tomo nota." / "Perfecto."

EMOJIS:
- Máximo 1 por mensaje, solo si suma algo genuino. Nunca al inicio de una oración.

LONGITUD:
- Máximo 3-4 líneas. Si el mensaje es más largo, estás poniendo demasiado en uno solo.`;
}

function setupEventListeners() {
  const input     = document.getElementById('chat-input');
  const sendBtn   = document.getElementById('send-btn');
  const attachBtn = document.getElementById('attach-btn');
  const fileInput = document.getElementById('file-input');

  sendBtn?.addEventListener('click', handleSend);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize textarea
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  // Paperclip → abre file input
  attachBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', handleFileSelection);
}

// ─── Manejo de archivos ────────────────────────────────────────────────────────

function handleFileSelection(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  // Validar cantidad
  const currentCount = state.pendingFiles.length + state.uploadedFiles.length;
  if (currentCount + files.length > MAX_UPLOAD_FILES) {
    appendMessage('system', `Podés adjuntar máximo ${MAX_UPLOAD_FILES} archivos en total.`);
    e.target.value = '';
    return;
  }

  // Validar tamaño individual
  const oversized = files.find(f => f.size > MAX_UPLOAD_BYTES);
  if (oversized) {
    appendMessage('system', `"${oversized.name}" supera el límite de 3 MB por archivo.`);
    e.target.value = '';
    return;
  }

  // Validar tamaño total
  const newTotalBytes = [...state.pendingFiles, ...files].reduce((a, f) => a + f.size, 0)
    + state.uploadedFiles.reduce((a, f) => a + (f.size || 0), 0);
  if (newTotalBytes > MAX_UPLOAD_BYTES) {
    appendMessage('system', 'El total de archivos no puede superar los 3 MB.');
    e.target.value = '';
    return;
  }

  state.pendingFiles.push(...files);
  renderAttachedFilesList();
  e.target.value = '';
}

function renderAttachedFilesList() {
  const list = document.getElementById('attached-files-list');
  if (!list) return;

  if (state.pendingFiles.length === 0 && state.uploadedFiles.length === 0) {
    list.hidden = true;
    list.innerHTML = '';
    return;
  }

  list.hidden = false;
  list.innerHTML = '';

  // Subidos
  state.uploadedFiles.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'file-chip file-chip--uploaded';
    chip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span>${f.name}</span>`;
    list.appendChild(chip);
  });

  // Pendientes
  state.pendingFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip file-chip--pending';
    chip.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>
      <span>${f.name}</span>
      <button class="file-chip-remove" data-idx="${i}" type="button" aria-label="Quitar archivo">×</button>`;
    list.appendChild(chip);
  });

  list.querySelectorAll('.file-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      state.pendingFiles.splice(idx, 1);
      renderAttachedFilesList();
    });
  });
}

async function uploadPendingFiles() {
  if (state.pendingFiles.length === 0) return;
  const clientData = getClientData();
  if (!clientData?.id) return;

  appendMessage('system', `Subiendo ${state.pendingFiles.length} archivo(s)...`);

  // Convertir a base64
  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Quitar encabezado "data:...;base64,"
        const result = reader.result.split(',')[1];
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const filesPayload = await Promise.all(state.pendingFiles.map(async f => ({
    name: f.name,
    content: await fileToBase64(f),
    size: f.size,
    type: f.type,
  })));

  try {
    const res = await fetch('/api/upload-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientData.id, files: filesPayload }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = res.status === 413
        ? 'El archivo es demasiado grande. El máximo es 3 MB por archivo.'
        : `No se pudieron subir los archivos (${res.status}). Continuamos sin ellos.`;
      appendMessage('system', msg);
    } else {
      state.uploadedFiles.push(...(data.uploaded || []));
      state.pendingFiles = [];
      renderAttachedFilesList();
      appendMessage('system', `✓ ${data.uploaded?.length || 0} archivo(s) recibido(s).`);
    }
  } catch (err) {
    console.error('Upload error:', err);
    appendMessage('system', 'No pude subir los archivos. Continuamos sin ellos.');
  }
}

// ─── Manejo de mensajes ────────────────────────────────────────────────────────

async function handleSend() {
  if (_isSending) return;

  const input = document.getElementById('chat-input');
  const text = input?.value.trim();

  const blockedPhases = [
    PHASE.GENERATING, PHASE.NOTIFYING,
    PHASE.CAROUSEL_REVIEW, PHASE.SELECTING, PHASE.PAYMENT, PHASE.DONE,
  ];
  if ((!text && state.pendingFiles.length === 0) || blockedPhases.includes(state.phase)) return;
  if (document.getElementById('chat-section')?.hasAttribute('data-locked')) return;

  _isSending = true;

  input.value = '';
  input.style.height = 'auto';

  // Si hay archivos pendientes, subirlos antes de procesar el mensaje
  if (state.pendingFiles.length > 0) {
    await uploadPendingFiles();
  }

  if (text) {
    appendMessage('user', text);
    state.messages.push({ role: 'user', content: text });

    // Extraer datos estructurados del mensaje y actualizar sesión.
    // Se pasa el campo pendiente actual para captura contextual posicional:
    // guarda la respuesta como valor de lo que el bot estaba preguntando,
    // sin depender de un diccionario de vocabulario por rubro.
    if (currentSession) {
      const campoPendiente = getCampoPendiente(currentSession);
      const extracted = extractFromMessage(text, campoPendiente);
      Object.entries(extracted).forEach(([campo, valor]) => updateField(currentSession, campo, valor));
    }
  }

  if (state.phase === PHASE.GREETING) {
    state.phase = PHASE.EVALUATING;
  }

  showTyping();
  setInputEnabled(false);

  try {
    if (state.phase === PHASE.EVALUATING) {
      await handleEvaluationTurn();
    } else if (state.phase === PHASE.ONBOARDING) {
      await handleOnboardingTurn();
    } else if (state.phase === PHASE.BRAND_DEFINITION) {
      await handleBrandDefinitionTurn();
    }
  } catch (err) {
    console.error(err);
    const msg = err.rateLimitMessage
      ? err.rateLimitMessage
      : 'Hubo un error de conexión. Intentá de nuevo en un momento.';
    appendMessage('system', msg);
  } finally {
    _isSending = false;
    hideTyping();
    // Solo re-habilitar el input en fases donde el usuario debe escribir
    const inputPhases = [PHASE.EVALUATING, PHASE.ONBOARDING, PHASE.BRAND_DEFINITION];
    if (inputPhases.includes(state.phase)) {
      setInputEnabled(true);
      document.getElementById('chat-input')?.focus();
    }
  }
}

async function handleEvaluationTurn() {
  const data = await callClaude(state.messages, state.prompts.eval, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
  });
  const raw = data.content?.[0]?.text || '{}';
  const result = extractJSON(raw);

  if (!result) {
    const displayText = raw.slice(0, 400);
    state.messages.push({ role: 'assistant', content: displayText });
    appendMessage('ai', displayText);
    return;
  }

  const reply = result.respuesta_cliente || 'Entendido. ¿Podés contarme más?';
  state.messages.push({ role: 'assistant', content: reply });
  appendMessage('ai', reply);

  if (result.siguiente_accion === 'onboarding') {
    const lastUserMsg = state.messages.filter(m => m.role === 'user').slice(-1);
    state.messages = lastUserMsg;
    state.phase = PHASE.ONBOARDING;
  } else if (result.siguiente_accion === 'rechazar') {
    appendMessage('system', 'Si tenés otra consulta o querés explorar otros servicios, escribime cuando quieras.');
    setInputEnabled(false);
  }
}

async function handleOnboardingTurn() {
  const trimmedMessages = state.messages.slice(-ONBOARDING_MSG_LIMIT);

  const systemPrompt = state.prompts.onboarding + buildContextBlock(currentSession);

  const data = await callClaude(trimmedMessages, systemPrompt, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
  });
  const raw = data.content?.[0]?.text || '';

  const brief = extractJSON(raw);

  // Normalizar servicios a array si Claude devolvió un string
  if (brief?.servicios && typeof brief.servicios === 'string') {
    brief.servicios = brief.servicios.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
  }

  // Normalizar contacto buscando en todos los campos posibles
  const _contacto = brief?.contacto || brief?.telefono ||
    brief?.whatsapp || brief?.wsp || brief?.email || '';
  if (brief && _contacto) brief.contacto = _contacto;

  const isBriefComplete = brief &&
    brief.nombre_marca?.trim().length > 0 &&
    brief.rubro?.trim().length > 0 &&
    (Array.isArray(brief.servicios)
      ? brief.servicios.length >= 1
      : typeof brief.servicios === 'string' && brief.servicios.trim().length > 2) &&
    _contacto.length > 0;

  const displayText = raw.replace(/```json[\s\S]*?```/g, '').trim();
  if (displayText) {
    state.messages.push({ role: 'assistant', content: raw });
    appendMessage('ai', displayText);
  }

  if (isBriefComplete) {
    await completarOnboarding(brief);
    return;
  }

  // Claude anunció el cierre pero no adjuntó el JSON en el mismo mensaje —
  // construir el brief a partir de los datos ya recolectados en la sesión
  if (!brief && detectarCierreOnboarding(raw)) {
    console.warn('[Onboarding] Claude cerró sin JSON — construyendo brief desde sesión');
    const briefDeSesion = buildBriefFromSession(currentSession);
    if (briefDeSesion) await completarOnboarding(briefDeSesion);
  }
}

// Detecta frases de cierre del onboarding aunque no venga el JSON adjunto
function detectarCierreOnboarding(texto) {
  const frases = [
    /ya tengo todo lo que necesito/i,
    /con esto es suficiente/i,
    /tenemos lo necesario/i,
    /tu landing.*está lista/i,
    /está lista para desarrollarse/i,
    /brief completo/i,
    /te contactaremos con los próximos pasos/i,
  ];
  return frases.some(f => f.test(texto));
}

// Reconstruye el brief mínimo a partir de session.collectedData cuando Claude
// cierra el onboarding sin adjuntar el JSON
function buildBriefFromSession(session) {
  if (!session?.collectedData) return null;
  const cd = session.collectedData;

  if (!cd.nombre_marca || !cd.rubro) return null;

  const serviciosArray = cd.servicios
    ? (typeof cd.servicios === 'string'
        ? cd.servicios.split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : cd.servicios)
    : [];

  const contacto = cd.contacto_wsp || cd.contacto_email || '';
  if (serviciosArray.length === 0 || !contacto) return null;

  return {
    nombre_marca:  cd.nombre_marca,
    rubro:         cd.rubro,
    slogan:        cd.slogan || null,
    descripcion:   cd.descripcion || null,
    servicios:     serviciosArray,
    contacto,
    email:         cd.contacto_email || null,
    redes:         cd.redes ? { instagram: cd.redes } : {},
    testimonios:   [],
    estilo_visual: cd.colores || cd.estilo_visual || null,
    fotos:         cd.tiene_fotos === 'true',
  };
}

// Extracción semántica con Claude — corre UNA vez al cierre del onboarding
// para validar y completar lo que la captura contextual no haya cubierto
// (corrige ortografía, normaliza servicios a array, agnóstica al rubro).
// intent: 'extraction' queda excluida del rate limit de chat (api/claude.js).
async function extractStructuredData(historial) {
  const conversacion = historial
    .filter(m => m.role === 'user')
    .map((m, i) => `[${i + 1}] ${m.content}`)
    .join('\n');

  const prompt = `Analizá esta conversación de un cliente que quiere una landing page.
Extraé sus datos con exactitud. Si algo no fue mencionado, usá null.

CONVERSACIÓN:
${conversacion}

Respondé ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown ni bloques de código:
{
  "nombre_marca": "nombre exacto del negocio o persona",
  "rubro": "tipo de negocio en 2-4 palabras",
  "servicios": ["servicio 1", "servicio 2"],
  "contacto_wsp": "solo dígitos sin espacios ni caracteres especiales, o null",
  "contacto_email": "email completo, o null",
  "colores": "colores o paleta mencionada textualmente, o null",
  "zona": "zona geográfica si la mencionó, o null",
  "slogan": "frase o tagline si la mencionó, o null",
  "redes": "usuario de Instagram u otras redes, o null",
  "estilo_visual": "descripción del estilo visual si mencionó algo, o null"
}

REGLAS:
- servicios SIEMPRE debe ser un array de strings, nunca un string plano
- Corregí errores ortográficos en los valores (ej: "monotivuto" → "Monotributo")
- Si mencionó el mismo servicio de distintas formas, unificalo en uno
- contacto_wsp: solo dígitos, sin el 15 ni el +54 (ej: "1123797308")
- No inventes datos — si no fue mencionado, null`;

  try {
    const data = await callClaude(
      [{ role: 'user', content: prompt }],
      'Sos un extractor de datos estructurados. Respondés SOLO con JSON válido sin markdown.',
      {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        intent: 'extraction',
      }
    );

    const raw = data.content?.[0]?.text || '{}';
    const clean = raw.replace(/```(?:json)?/g, '').trim();
    const extracted = extractJSON(clean);

    if (!extracted) {
      console.warn('[ExtractorA] JSON inválido:', raw.slice(0, 200));
      return null;
    }

    if (extracted.servicios && typeof extracted.servicios === 'string') {
      extracted.servicios = extracted.servicios.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
    }

    console.log('[ExtractorA] Extracción semántica:', extracted);
    return extracted;

  } catch (err) {
    console.error('[ExtractorA] Error:', err.message);
    return null; // fail-open: si falla, seguimos con lo que ya teníamos
  }
}

async function completarOnboarding(brief) {
  const extracted = await extractStructuredData(state.messages);

  if (extracted) {
    // Los datos del brief de Claude tienen prioridad; la extracción semántica
    // completa los huecos y corrige lo que vino mal formado
    brief.nombre_marca  = brief.nombre_marca  || extracted.nombre_marca;
    brief.rubro         = brief.rubro         || extracted.rubro;
    brief.email         = brief.email         || extracted.contacto_email;
    brief.estilo_visual = brief.estilo_visual || extracted.colores || extracted.estilo_visual;
    brief.slogan        = brief.slogan        || extracted.slogan;

    if (!brief.contacto) {
      brief.contacto = extracted.contacto_wsp || extracted.contacto_email || '';
    }
    if (!brief.redes && extracted.redes) {
      brief.redes = { instagram: extracted.redes };
    }

    const serviciosExtracted = Array.isArray(extracted.servicios) ? extracted.servicios : [];
    const serviciosBrief = Array.isArray(brief.servicios)
      ? brief.servicios
      : (brief.servicios ? brief.servicios.split(/[,;\/]/).map(s => s.trim()).filter(Boolean) : []);

    brief.servicios = serviciosExtracted.length >= serviciosBrief.length ? serviciosExtracted : serviciosBrief;

    if (currentSession) {
      const camposAActualizar = {
        nombre_marca:   extracted.nombre_marca,
        rubro:          extracted.rubro,
        servicios:      extracted.servicios?.join(', '),
        colores:        extracted.colores,
        contacto_wsp:   extracted.contacto_wsp,
        contacto_email: extracted.contacto_email,
        zona:           extracted.zona,
        slogan:         extracted.slogan,
      };
      Object.entries(camposAActualizar).forEach(([campo, valor]) => {
        if (valor) updateField(currentSession, campo, valor);
      });
    }
  }

  // Rescate final desde session.collectedData por si ni el brief ni la
  // extracción semántica trajeron el dato
  if (!brief.estilo_visual && currentSession?.collectedData?.colores) {
    brief.estilo_visual = currentSession.collectedData.colores;
  }
  if (!brief.contacto && currentSession?.collectedData?.contacto_wsp) {
    brief.contacto = currentSession.collectedData.contacto_wsp;
  }
  if (!brief.nombre_marca && currentSession?.collectedData?.nombre_marca) {
    brief.nombre_marca = currentSession.collectedData.nombre_marca;
  }

  const clientData = getClientData();
  if (clientData) {
    brief.cliente_nombre   = `${clientData.nombre} ${clientData.apellido}`;
    brief.cliente_email    = clientData.email;
    brief.cliente_telefono = clientData.telefono || '';
    brief.cliente_id       = clientData.id;
  }

  state.brief = brief;
  saveSession({ phase: 'onboarding_done', brief: state.brief });

  await startBrandOrCarouselFlow();
}

// Detecta si el cliente confirma el estilo visual ya dado, sin pedir cambios
function detectarConfirmacionVisual(texto) {
  const confirmaciones = [
    /^(no|nope|así|así está|bien|ok|dale|perfecto|sí|si|seguimos)[\s.,!]*$/i,
    /no.*cambiar/i,
    /seguimos con eso/i,
    /está bien así/i,
    /solo eso/i,
    /el diseño/i,
  ];
  return confirmaciones.some(f => f.test(texto.trim()));
}

// Convierte una descripción de colores en texto a códigos hex aproximados
function extraerColoresHex(estiloVisual) {
  const coloresMap = {
    'violeta': '#7C3AED', 'morado': '#7C3AED', 'purple': '#7C3AED',
    'negro': '#0F172A',   'black': '#0F172A',
    'gris': '#6B7280',    'grey': '#6B7280',   'gray': '#6B7280',
    'blanco': '#F8FAFC',  'white': '#F8FAFC',
    'azul': '#2563EB',    'blue': '#2563EB',
    'verde': '#16A34A',   'rojo': '#DC2626',
    'naranja': '#EA580C', 'amarillo': '#CA8A04',
    'marrón': '#92400E',  'marron': '#92400E',
    'beige': '#D4B896',   'tierra': '#92400E',
    'rosa': '#EC4899',    'dorado': '#B45309',
  };

  const texto = estiloVisual.toLowerCase();
  const encontrados = [];
  for (const [nombre, hex] of Object.entries(coloresMap)) {
    if (texto.includes(nombre) && !encontrados.includes(hex)) {
      encontrados.push(hex);
    }
  }
  return encontrados.length > 0 ? encontrados.slice(0, 3) : ['#1E293B', '#7C3AED'];
}

// Avanza directo a generación con un brand brief básico derivado del estilo
// visual ya dado en el onboarding — evita llamadas extra a Claude
async function avanzarConBrandBriefBasico(estiloVisual) {
  const brandBriefBasico = {
    colores_principales: extraerColoresHex(estiloVisual),
    estilo_visual: estiloVisual,
    tipografia: 'moderna y profesional',
    tono: 'formal y confiable',
    referencias: null,
    publico_objetivo: state.brief?.descripcion || 'profesionales y empresas',
    notas_adicionales: null,
  };

  state.brandBrief = brandBriefBasico;
  state.phase = PHASE.GENERATING;
  setInputEnabled(false);

  const fullBrief = { ...state.brief, ...brandBriefBasico };
  saveSession({ phase: state.phase, brandBrief: state.brandBrief });

  await proceedWithGeneration(fullBrief);
}

async function handleBrandDefinitionTurn() {
  const lastUserMsg = state.messages[state.messages.length - 1]?.content || '';

  // Si el cliente confirma el estilo visual ya dado en el onboarding, saltar
  // directo a generación sin más preguntas (evita rate limit por llamadas extra)
  if (state.brief?.estilo_visual && detectarConfirmacionVisual(lastUserMsg)) {
    console.log('[Brand] Confirmación visual detectada — saltando a generación');
    await avanzarConBrandBriefBasico(state.brief.estilo_visual);
    return;
  }

  const trimmedMessages = state.messages.slice(-BRAND_DEFINITION_MSG_LIMIT);

  // Construir system prompt con contexto del brief + archivos
  let brandSystem = state.prompts.brand;

  // Inyectar datos ya recolectados para que Claude no vuelva a preguntar lo mismo
  if (state.brief) {
    const briefLines = [
      state.brief.nombre_marca  && `- Nombre de marca: ${state.brief.nombre_marca}`,
      state.brief.rubro         && `- Rubro: ${state.brief.rubro}`,
      state.brief.slogan        && `- Slogan: "${state.brief.slogan}"`,
      state.brief.descripcion   && `- Descripción: ${state.brief.descripcion}`,
      state.brief.servicios?.length && `- Servicios: ${state.brief.servicios.join(', ')}`,
      state.brief.contacto      && `- Contacto: ${state.brief.contacto}`,
      state.brief.estilo_visual && `- Estilo/colores mencionados en onboarding: ${state.brief.estilo_visual}`,
    ].filter(Boolean).join('\n');

    brandSystem = `DATOS YA RECOLECTADOS DEL CLIENTE — NO volver a preguntar ninguno de estos:\n${briefLines}\n\nSi el cliente ya mencionó colores o estilo visual arriba, tomalo como punto de partida confirmado y avanzá. Solo pedí confirmación si el dato es ambiguo.\n\n${brandSystem}`;
  }

  if (state.uploadedFiles.length > 0) {
    const fileList = state.uploadedFiles.map(f => `- ${f.name} (${Math.round(f.size / 1024)} KB)`).join('\n');
    brandSystem += `\n\nEl usuario subió los siguientes archivos como referencia:\n${fileList}`;
  }

  const data = await callClaude(trimmedMessages, brandSystem, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
  });
  const raw = data.content?.[0]?.text || '';

  const brandBrief = extractJSON(raw);
  const isBrandComplete = brandBrief && brandBrief.colores_principales && brandBrief.estilo_visual;

  const displayText = raw.replace(/```json[\s\S]*?```/g, '').trim();
  if (displayText) {
    state.messages.push({ role: 'assistant', content: raw });
    appendMessage('ai', displayText);
  }

  if (isBrandComplete) {
    state.brandBrief = brandBrief;
    state.phase = PHASE.GENERATING;
    setInputEnabled(false);

    // Combinar brief de negocio + brief de marca
    const fullBrief = { ...state.brief, ...brandBrief };
    saveSession({ phase: state.phase, brandBrief: state.brandBrief });

    await proceedWithGeneration(fullBrief);
  } else if (state.brief?.estilo_visual && detectarConfirmacionVisual(raw)) {
    // Claude no devolvió colores en hex pero el cliente ya confirmó el estilo
    await avanzarConBrandBriefBasico(state.brief.estilo_visual);
  }
}

// ─── Flujo post-onboarding: carrusel previo o ir directo a marca ──────────────

async function startBrandOrCarouselFlow() {
  setInputEnabled(false);
  appendMessage('system', 'Perfecto, tengo una idea clara de tu proyecto. Un momento...');

  const sets = await initCarousel();

  if (sets && sets.length > 0) {
    // Hay diseños anteriores → mostrar carrusel dentro del chat
    state.phase = PHASE.CAROUSEL_REVIEW;

    appendMessage('ai', '¡Antes de generar nuevos diseños, revisemos los que ya existen! Quizás alguno encaja con lo que buscás.');

    const widget = buildChatCarouselWidget(sets, {
      onSelect: (preview) => {
        // Usuario eligió un diseño anterior
        state.selectedPreview = preview;
        state.phase = PHASE.PAYMENT;
        appendMessage('ai', `Excelente elección — ${preview.name}. Pasemos al paso de pago para confirmar tu pedido.`);
        showPaymentSection();
      },
      onReject: () => {
        // Usuario no quiere ninguno → ir a definición de marca
        appendMessage('ai', 'Entendido. Vamos a crear algo completamente nuevo para tu marca.');
        enterBrandDefinitionPhase();
      },
    });

    if (widget) appendWidget(widget);

  } else {
    // Sin diseños previos → ir directo a definición de marca
    enterBrandDefinitionPhase();
  }
}

function enterBrandDefinitionPhase() {
  state.phase = PHASE.BRAND_DEFINITION;
  state.messages = []; // Reset mensajes — el brief completo se inyecta en el system prompt de cada llamada

  // Habilitar botón de adjunto
  const attachBtn = document.getElementById('attach-btn');
  if (attachBtn) attachBtn.hidden = false;

  setInputEnabled(true);

  // Si el brief ya tiene info de estilo visual, mencionarla en el saludo
  const estiloExistente = state.brief?.estilo_visual;
  const introEstilo = estiloExistente
    ? `Ya mencionaste que preferís: ${estiloExistente}. ¿Querés ajustar algo o seguimos con eso?`
    : `¿Tenés alguna referencia de colores o estilos que te gusten?`;

  appendMessage('ai',
    `Ahora definimos la identidad visual de tu marca. ${introEstilo} `
    + `Podés adjuntar imágenes o logos de referencia con el 📎 (máx. ${MAX_UPLOAD_FILES} archivos, 3 MB c/u).`
  );
}

// ─── Generación de previews ────────────────────────────────────────────────────

async function proceedWithGeneration(fullBrief) {
  appendMessage('system', 'Generando tus 3 diseños personalizados...');
  showGeneratingState();

  try {
    state.previews = await generateAllPreviews(fullBrief || state.brief, (current, total, name) => {
      updateGeneratingProgress(current, total, name);
    });

    state.phase = PHASE.SELECTING;
    hideGeneratingState();

    saveSession({ phase: state.phase, generated: true });

    // Mostrar los 3 nuevos diseños como carrusel en el chat
    const widget = buildPreviewsCarouselWidget(state.previews, {
      onSelect: (preview, index) => selectPreview(index),
    });

    if (widget) {
      appendWidget(widget);
    } else {
      // Fallback: sección grid clásica
      showPreviewSection(state.previews);
    }

  } catch (err) {
    console.error('Generation error:', err);
    hideGeneratingState();
    const msg = err.rateLimitMessage
      ? err.rateLimitMessage
      : 'No pude generar los diseños en este momento. Escribime y lo resolvemos.';
    appendMessage('system', msg);
    setInputEnabled(true);
    state.phase = PHASE.BRAND_DEFINITION;
  }
}

// ─── Selección de template ─────────────────────────────────────────────────────

function showPreviewSection(previews) {
  const section = document.getElementById('previews-section');
  if (!section) return;

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const grid = document.getElementById('previews-grid');
  grid.innerHTML = '';

  previews.forEach((preview, i) => {
    const card = document.createElement('div');
    card.className = 'preview-card';
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
      <div class="preview-iframe-wrap">
        <iframe id="preview-iframe-${i}" title="${preview.name}" scrolling="no"></iframe>
        <div class="preview-overlay" data-index="${i}">
          <button class="select-preview-btn btn-primary" data-index="${i}">Elegir este diseño</button>
        </div>
      </div>
      <div class="preview-info">
        <h3>${preview.name}</h3>
        <p>${preview.description}</p>
      </div>`;
    grid.appendChild(card);

    const iframe = document.getElementById(`preview-iframe-${i}`);
    renderPreviewInIframe(iframe, preview.html);

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.select-preview-btn')) {
        openPreviewModal(preview, i, () => selectPreview(i));
      }
    });

    card.querySelector('.select-preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      selectPreview(i);
    });
  });

  addAltCard(grid, getClientData()?.id || null);
}

function selectPreview(index) {
  if (state.previews[index]) {
    state.selectedPreview = state.previews[index];
  }
  state.phase = PHASE.PAYMENT;

  document.querySelectorAll('.preview-card').forEach((c, i) => {
    c.classList.toggle('selected', i === index);
  });

  showPaymentSection();
}

// ─── Pago ──────────────────────────────────────────────────────────────────────

function showPaymentSection() {
  const section = document.getElementById('payment-section');
  if (!section) return;

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('payment-brand').textContent  = state.brief?.nombre_marca || '—';
  document.getElementById('payment-template').textContent = state.selectedPreview?.name || '—';

  const mpBtn = document.getElementById('mp-btn');
  if (mpBtn) mpBtn.href = MP_LINK;

  document.getElementById('confirm-payment-btn')?.addEventListener('click', handlePaymentConfirm, { once: true });
}

async function handlePaymentConfirm() {
  if (state.phase !== PHASE.PAYMENT) return;
  state.phase = PHASE.NOTIFYING;

  const btn = document.getElementById('confirm-payment-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  appendMessage('system', 'Confirmación recibida. Enviando tu pedido a Martín...');

  try {
    await sendNotification(state.brief, state.selectedPreview?.html || '', getClientData());
    state.phase = PHASE.DONE;
    saveSession({ phase: PHASE.DONE });
    showSuccessSection();
  } catch (err) {
    console.error('Notify error:', err);
    appendMessage('system', 'No se pudo enviar la notificación. Escribinos a hola@martinduarte.com con tu nombre de marca.');
    if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
    state.phase = PHASE.PAYMENT;
  }
}

// ─── Sección de éxito ──────────────────────────────────────────────────────────

function showSuccessSection() {
  const section = document.getElementById('success-section');
  if (!section) return;
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  document.getElementById('success-brand').textContent   = state.brief?.nombre_marca || 'tu marca';
  document.getElementById('success-contact').textContent = state.brief?.contacto || getClientData()?.telefono || 'tu contacto';
}

// ─── Utilidades de UI ──────────────────────────────────────────────────────────

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = `message message--${role}`;

  if (role === 'ai') {
    const html = typeof marked !== 'undefined'
      ? marked.parse(String(text))
      : escapeHtml(text).replace(/\n/g, '<br>');
    msg.innerHTML = `<div class="message-avatar">M</div><div class="message-bubble message-bubble--md">${html}</div>`;
  } else if (role === 'user') {
    msg.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
  } else {
    msg.innerHTML = `<div class="message-system">${escapeHtml(text)}</div>`;
  }

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

/**
 * Inserta un widget DOM como burbuja del asistente en el chat.
 */
function appendWidget(el) {
  const container = document.getElementById('chat-messages');
  if (!container || !el) return;

  const msg = document.createElement('div');
  msg.className = 'message message--ai message--widget';
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'M';
  msg.appendChild(avatar);
  msg.appendChild(el);

  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container || document.getElementById('typing-indicator')) return;
  const el = document.createElement('div');
  el.id = 'typing-indicator';
  el.className = 'message message--ai';
  el.innerHTML = `<div class="message-avatar">M</div><div class="message-bubble typing"><span></span><span></span><span></span></div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  document.getElementById('typing-indicator')?.remove();
}

function setInputEnabled(enabled) {
  const input = document.getElementById('chat-input');
  const btn   = document.getElementById('send-btn');
  if (input) input.disabled = !enabled;
  if (btn)   btn.disabled   = !enabled;
}

function showGeneratingState() {
  const el = document.getElementById('generating-state');
  if (el) el.hidden = false;
}

function hideGeneratingState() {
  const el = document.getElementById('generating-state');
  if (el) el.hidden = true;
}

function updateGeneratingProgress(current, total, name) {
  const label = document.getElementById('generating-label');
  if (label) label.textContent = `Generando diseño ${current} de ${total}: ${name}...`;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function callClaude(messages, system, opts = {}) {
  const { model, max_tokens = 1024, intent } = opts;

  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens, model, intent }),
  });

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(data.message || 'Límite de solicitudes alcanzado.');
    err.rateLimitMessage = data.message || 'Alcanzaste el límite de solicitudes. Intentá en unos minutos.';
    throw err;
  }

  if (!res.ok) throw new Error(`Claude error: ${res.status}`);
  return res.json();
}

function extractJSON(text) {
  const codeMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeMatch) {
    try { return JSON.parse(codeMatch[1].trim()); } catch {}
  }
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  return null;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

