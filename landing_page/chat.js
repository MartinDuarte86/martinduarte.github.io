// Motor del chat: estado, prompts, llamadas a Claude y transiciones de UI
import { generateAllPreviews, renderPreviewInIframe, openPreviewModal, addAltCard } from './generator.js';
import { sendNotification } from './notifier.js';
import { initRegistrationForm, getClientData, saveSession } from './validator.js';
import { initCarousel, buildChatCarouselWidget, buildPreviewsCarouselWidget } from './carousel.js';

// ─── Session ID persistente ────────────────────────────────────────────────────

function getOrCreateSessionId() {
  const STORAGE_KEY = 'lp_session_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

const SESSION_ID = getOrCreateSessionId();

async function persistMessage(role, content, section) {
  try {
    await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: SESSION_ID, type: 'message', payload: { role, content, section } }),
    });
  } catch (e) {
    console.warn('[session] Error al persistir mensaje:', e);
  }
}

async function persistBrief(fullBrief) {
  try {
    await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: SESSION_ID, type: 'brief', payload: fullBrief }),
    });
  } catch (e) {
    console.warn('[session] Error al persistir brief:', e);
  }
}

async function persistMeta(meta) {
  try {
    await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: SESSION_ID, type: 'meta', payload: meta }),
    });
  } catch (e) {
    console.warn('[session] Error al persistir meta:', e);
  }
}

async function tryRecoverSession() {
  const storedId = localStorage.getItem('lp_session_id');
  if (!storedId) return false;

  try {
    const res  = await fetch(`/api/get-session?session_id=${storedId}`);
    const data = await res.json();

    if (!data.found || !data.brief) return false;

    const completedSections = Object.keys(data.brief).filter(k => data.brief[k]);
    if (completedSections.length === 0) return false;

    const confirmed = confirm(
      `Tenés una sesión en progreso (completaste: ${completedSections.join(', ')}).\n¿Querés continuar donde lo dejaste?`
    );

    if (confirmed) {
      state.fullBrief = data.brief || {};
      state.messages  = [];

      const lastPhase = data.meta?.phase;
      if (lastPhase) {
        state.phase = lastPhase;
        document.getElementById('progress-bar')?.removeAttribute('hidden');
        updateProgressIndicator(lastPhase);
        appendSectionDivider(lastPhase);
        await openSection(lastPhase);
      }

      return true;
    } else {
      localStorage.removeItem('lp_session_id');
      return false;
    }
  } catch (e) {
    console.warn('[session] No se pudo recuperar sesión:', e);
    return false;
  }
}

const MP_LINK = 'https://mpago.la/1Dufc3b';

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB — Vercel serverless body limit es 4.5 MB; base64 agrega ~33%

const PHASE = {
  GREETING:    'greeting',
  EVALUATING:  'evaluating',
  HERO:        'hero',
  SOBRE_MI:    'sobre_mi',
  SERVICIOS:   'servicios',
  TESTIMONIOS: 'testimonios',
  CONTACTO:    'contacto',
  DISENO:      'diseno',
  DSN_REVIEW:  'dsn_review', // carrusel de diseños anteriores
  GENERATING:  'generating',
  SELECTING:   'selecting',
  PAYMENT:     'payment',
  NOTIFYING:   'notifying',
  DONE:        'done',
};

// Orden de las secciones del wizard — define las transiciones y el indicador de progreso
const SECTION_ORDER = [
  PHASE.HERO,
  PHASE.SOBRE_MI,
  PHASE.SERVICIOS,
  PHASE.TESTIMONIOS,
  PHASE.CONTACTO,
  PHASE.DISENO,
];

// Máximo de mensajes a enviar por sección — alineado con el hard limit de api/claude.js (20)
const SECTION_MSG_LIMIT = 10;

let _isSending = false; // debounce: evita doble-clic y envíos duplicados

let state = {
  phase: PHASE.GREETING,
  messages: [],          // historial de la sección/fase actual — se resetea entre secciones
  prompts: {},
  fullBrief: {           // se acumula sección por sección
    hero:        null,
    sobre_mi:    null,
    servicios:   null,
    testimonios: null,
    contacto:    null,
    diseno:      null,
  },
  brief: null,           // brief plano final, construido al cerrar la sección de diseño
  previews: [],
  selectedPreview: null,
  uploadedFiles: [], // { name, path, size, type }
  pendingFiles: [],  // File objects pendientes de subir
};

// ─── Inicialización ────────────────────────────────────────────────────────────

export async function init() {
  await loadPrompts();

  initRegistrationForm(async (clientData) => {
    window._chatSessionReady = true;
    window.flowModal?.goToStep(3);

    const recovered = await tryRecoverSession();
    if (!recovered) {
      const nombre = clientData.nombre;
      appendMessage('ai', `Hola ${nombre}. Contame sobre tu proyecto — ¿de qué se trata tu negocio o idea?`);
    }
    setupEventListeners();
  });
}

async function loadPrompts() {
  const files = ['evaluacion', 'hero', 'sobre_mi', 'servicios', 'testimonios', 'contacto', 'diseno'];
  try {
    const results = await Promise.all(
      files.map(f => fetch(`/landing_page/prompts/prompt_${f}.txt`)
        .then(r => r.ok ? r.text() : '')
        .catch(() => ''))
    );
    files.forEach((f, i) => { state.prompts[f] = results[i]; });
  } catch {
    console.warn('No se pudieron cargar los archivos de prompt.');
  }

  // evaluacion.txt no sigue la convención prompt_<nombre>.txt — se carga aparte
  try {
    const evalRes = await fetch('/landing_page/prompts/evaluacion.txt');
    state.prompts.eval = evalRes.ok ? await evalRes.text() : '';
  } catch {
    state.prompts.eval = '';
  }
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
    PHASE.DSN_REVIEW, PHASE.SELECTING, PHASE.PAYMENT, PHASE.DONE,
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
    persistMessage('user', text, state.phase);
  }

  if (state.phase === PHASE.GREETING) {
    state.phase = PHASE.EVALUATING;
  }

  showTyping();
  setInputEnabled(false);

  try {
    if (state.phase === PHASE.EVALUATING) {
      await handleEvaluationTurn();
    } else if (SECTION_ORDER.includes(state.phase)) {
      await handleSectionTurn(state.phase);
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
    const inputPhases = [PHASE.EVALUATING, ...SECTION_ORDER];
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
  persistMessage('assistant', reply, state.phase);

  if (result.siguiente_accion === 'onboarding') {
    const lastUserMsg = state.messages.filter(m => m.role === 'user').slice(-1);

    state.phase = PHASE.HERO;
    state.messages = lastUserMsg;

    document.getElementById('progress-bar')?.removeAttribute('hidden');
    updateProgressIndicator(PHASE.HERO);
    appendSectionDivider(PHASE.HERO);

    await openSection(PHASE.HERO);
  } else if (result.siguiente_accion === 'rechazar') {
    appendMessage('system', 'Si tenés otra consulta o querés explorar otros servicios, escribime cuando quieras.');
    setInputEnabled(false);
  }
}

// ─── Wizard por secciones ──────────────────────────────────────────────────────

async function handleSectionTurn(seccionKey) {
  const systemPrompt = state.prompts[seccionKey] || '';
  const trimmedMessages = state.messages.slice(-SECTION_MSG_LIMIT);

  const data = await callClaude(trimmedMessages, systemPrompt, {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
  });

  const raw = data.content?.[0]?.text || '';
  const sectionData = extractJSON(raw);

  // Mostrar mensaje al usuario (sin el JSON)
  const displayText = raw.replace(/```json[\s\S]*?```/g, '').trim();
  if (displayText) {
    state.messages.push({ role: 'assistant', content: raw });
    appendMessage('ai', displayText);
    persistMessage('assistant', displayText, state.phase);
  }

  // Si el JSON tiene la sección correcta, acumular y avanzar
  if (sectionData?.seccion === seccionKey) {
    state.fullBrief[seccionKey] = sectionData;
    saveSession({ phase: state.phase, fullBrief: state.fullBrief });
    persistBrief(state.fullBrief);

    await advanceToNextSection(seccionKey);
  }
}

async function advanceToNextSection(completedSection) {
  const idx = SECTION_ORDER.indexOf(completedSection);
  const nextPhase = SECTION_ORDER[idx + 1] || null;

  if (nextPhase) {
    state.phase = nextPhase;
    state.messages = []; // resetear historial — cada sección arranca limpia
    persistMeta({ phase: state.phase });
    updateProgressIndicator(nextPhase);
    appendSectionDivider(nextPhase);

    if (nextPhase === PHASE.DISENO) {
      const attachBtn = document.getElementById('attach-btn');
      if (attachBtn) attachBtn.hidden = false;
    }

    await openSection(nextPhase);

  } else {
    // Todas las secciones completas → revisar diseños anteriores o generar nuevos
    await startDesignPhase();
  }
}

const SECTION_INTROS = {
  [PHASE.SOBRE_MI]:    '¿Tu emprendimiento es personal o es una empresa/equipo?',
  [PHASE.SERVICIOS]:   '¿Qué servicios o productos ofrecés? Listámelos y te ayudo a describirlos.',
  [PHASE.TESTIMONIOS]: '¿Querés incluir una sección de testimonios de clientes en tu landing?',
  [PHASE.CONTACTO]:    '¿Cuál es tu WhatsApp o email de contacto para que los clientes te escriban?',
  [PHASE.DISENO]:      '¿Tenés alguna preferencia de colores para tu landing, o me describís qué sensación querés transmitir?'
    + ` Podés adjuntar imágenes o referencias con el 📎 (máx. ${MAX_UPLOAD_FILES} archivos, 3 MB c/u).`,
};

async function openSection(phase) {
  const intro = SECTION_INTROS[phase];

  if (intro) {
    appendMessage('ai', intro);
    state.messages.push({ role: 'assistant', content: intro });
  } else {
    // Hero no tiene intro fija — el modelo arranca la sección usando como
    // contexto lo que el cliente ya contó durante la evaluación.
    showTyping();
    try {
      await handleSectionTurn(phase);
    } finally {
      hideTyping();
    }
  }

  setInputEnabled(true);
  document.getElementById('chat-input')?.focus();
}

const SECTION_LABELS = {
  [PHASE.HERO]:        'Sección 1 — Hero',
  [PHASE.SOBRE_MI]:    'Sección 2 — Sobre mí / Nosotros',
  [PHASE.SERVICIOS]:   'Sección 3 — Servicios',
  [PHASE.TESTIMONIOS]: 'Sección 4 — Testimonios',
  [PHASE.CONTACTO]:    'Sección 5 — Contacto',
  [PHASE.DISENO]:      'Sección 6 — Estilo visual',
  [PHASE.DSN_REVIEW]:  'Diseños anteriores',
  [PHASE.GENERATING]:  'Generando tus diseños',
};

function appendSectionDivider(phase) {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const label = SECTION_LABELS[phase];
  if (!label) return;

  const div = document.createElement('div');
  div.className = 'section-divider';
  div.innerHTML = `<span class="section-divider-label">${escapeHtml(label)}</span>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

const PROGRESS_PHASE_INDEX = {
  [PHASE.HERO]:        0,
  [PHASE.SOBRE_MI]:    1,
  [PHASE.SERVICIOS]:   2,
  [PHASE.TESTIMONIOS]: 3,
  [PHASE.CONTACTO]:    4,
  [PHASE.DISENO]:      5,
  [PHASE.DSN_REVIEW]:  6,
  [PHASE.GENERATING]:  6,
  [PHASE.SELECTING]:   6,
};

function updateProgressIndicator(phase) {
  const steps = document.querySelectorAll('.progress-step');
  if (!steps.length) return;

  const current = PROGRESS_PHASE_INDEX[phase] ?? -1;

  steps.forEach((step, i) => {
    step.classList.toggle('progress-step--done',    i < current);
    step.classList.toggle('progress-step--active',  i === current);
    step.classList.toggle('progress-step--pending', i > current);
  });
}

// Construye el brief plano final a partir de las secciones acumuladas —
// es lo que consume generacion.txt y lo que se muestra en pago/éxito/notificación
function buildFullBrief() {
  const { hero, sobre_mi, servicios, testimonios, contacto, diseno } = state.fullBrief;
  const clientData = getClientData();

  return {
    nombre_marca:    hero?.nombre_marca    || '',
    rubro:           hero?.rubro           || '',
    slogan:          hero?.slogan          || '',
    propuesta_valor: hero?.propuesta_valor || '',

    tipo:                 sobre_mi?.tipo                 || 'personal',
    historia:             sobre_mi?.historia             || '',
    experiencia_o_equipo: sobre_mi?.experiencia_o_equipo || '',
    diferencial:          sobre_mi?.diferencial          || '',

    servicios:      servicios?.servicios      || [],
    precio_visible: servicios?.precio_visible || false,

    testimonios: testimonios || { incluir: false, testimonios: [] },

    contacto:     contacto?.contacto_wsp || contacto?.email || '',
    contacto_wsp: contacto?.contacto_wsp || '',
    email:        contacto?.email        || '',
    redes:        contacto?.redes        || {},
    zona:         contacto?.zona         || '',
    horarios:     contacto?.horarios     || '',

    colores:       diseno?.colores     || [],
    colores_hex:   diseno?.colores_hex || ['#1E293B', '#7C3AED'],
    estilo_visual: diseno?.estilo      || '',
    tipografia:    diseno?.tipografia  || '',
    tono:          diseno?.tono        || '',
    referencias:   diseno?.referencias || '',

    cliente_nombre: clientData ? `${clientData.nombre} ${clientData.apellido}` : '',
    cliente_email:  clientData?.email || '',
    cliente_id:     clientData?.id    || '',
  };
}

// ─── Flujo post-secciones: carrusel de diseños anteriores o generación nueva ──

async function startDesignPhase() {
  setInputEnabled(false);
  appendMessage('system', 'Perfecto, ya tenemos todo. Un momento...');

  state.brief = buildFullBrief();
  saveSession({ phase: 'secciones_completas', brief: state.brief });

  const sets = await initCarousel();

  if (sets && sets.length > 0) {
    state.phase = PHASE.DSN_REVIEW;
    updateProgressIndicator(PHASE.DSN_REVIEW);

    appendMessage('ai',
      'Antes de generar nuevos diseños, revisemos los que ya existen. '
      + 'Si alguno te convence podés elegirlo directamente.'
    );

    const widget = buildChatCarouselWidget(sets, {
      onSelect: (preview) => {
        state.selectedPreview = preview;
        state.phase = PHASE.PAYMENT;
        appendMessage('ai', `Buena elección — ${preview.name}. Pasemos al pago para confirmar tu pedido.`);
        showPaymentSection();
      },
      onReject: () => {
        appendMessage('ai', 'Entendido. Generamos algo nuevo para tu marca.');
        generateNewDesigns();
      },
    });

    if (widget) appendWidget(widget);

  } else {
    await generateNewDesigns();
  }
}

async function generateNewDesigns() {
  state.phase = PHASE.GENERATING;
  updateProgressIndicator(PHASE.GENERATING);
  appendMessage('system', 'Generando tus 3 diseños personalizados...');
  showGeneratingState();

  try {
    state.previews = await generateAllPreviews(state.brief, (current, total, name) => {
      updateGeneratingProgress(current, total, name);
    });

    state.phase = PHASE.SELECTING;
    hideGeneratingState();
    saveSession({ phase: state.phase, generated: true });

    const widget = buildPreviewsCarouselWidget(state.previews, {
      onSelect: (preview, index) => selectPreview(index),
    });

    if (widget) {
      appendWidget(widget);
    } else {
      showPreviewSection(state.previews);
    }

  } catch (err) {
    console.error('Generation error:', err);
    hideGeneratingState();
    const msg = err.rateLimitMessage
      ? err.rateLimitMessage
      : 'No pude generar los diseños ahora. Escribime y lo resolvemos.';
    appendMessage('system', msg);
    setInputEnabled(true);
    state.phase = PHASE.DISENO;
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

  const refCode = SESSION_ID.slice(0, 8).toUpperCase();
  appendMessage('ai', `Código de referencia de tu pedido: **${refCode}** — guardalo por si necesitás consultar el estado.`);
  persistMeta({ phase: 'payment', mp_reference: refCode });

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
    body: JSON.stringify({ messages, system, max_tokens, model, intent, session_id: SESSION_ID, section: state.phase }),
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
