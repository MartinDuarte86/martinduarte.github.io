// Motor del chat: estado, prompts, llamadas a Claude y transiciones de UI
import { generateAllPreviews, renderPreviewInIframe, openPreviewModal, addAltCard } from './generator.js';
import { sendNotification } from './notifier.js';
import { initRegistrationForm, getClientData, saveSession } from './validator.js';
import { initCarousel, buildChatCarouselWidget, buildPreviewsCarouselWidget } from './carousel.js';

// ─── Session ID persistente (UUID v4) ─────────────────────────────────────────

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

// Mensajes que no se pudieron persistir — se reintentan via sendBeacon al cerrar
const _unsavedMessages = [];
window.addEventListener('pagehide', () => {
  for (const body of _unsavedMessages) {
    navigator.sendBeacon('/api/save-session', new Blob([body], { type: 'application/json' }));
  }
  _unsavedMessages.length = 0;
});

async function persistMessage(role, content, section, attempt = 0) {
  const body = JSON.stringify({ session_id: SESSION_ID, type: 'message', payload: { role, content, section } });
  try {
    const res = await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (e) {
    if (attempt < 2) {
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      return persistMessage(role, content, section, attempt + 1);
    }
    console.warn('[session] Error al persistir mensaje — en cola para reintento al salir');
    _unsavedMessages.push(body);
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
    console.warn('[session] Error al persistir brief');
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
    console.warn('[session] Error al persistir meta');
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

      // 1) Repintar TODO el historial visible (los mensajes están en Redis)
      const history = Array.isArray(data.messages) ? data.messages : [];
      for (const m of history) {
        if (m.role === 'user' || m.role === 'assistant') {
          appendMessage(m.role === 'assistant' ? 'ai' : 'user', m.content);
        }
      }

      const lastPhase = data.meta?.phase;

      // 2) Reconstruir el contexto conversacional de la sección en curso
      state.messages = history
        .filter(m => m.section === lastPhase && (m.role === 'user' || m.role === 'assistant'))
        .map(m => ({ role: m.role, content: m.content }))
        .slice(-SECTION_MSG_LIMIT);

      if (lastPhase && (SECTION_ORDER.includes(lastPhase) || lastPhase === PHASE.EVALUATING)) {
        state.phase = lastPhase;
        document.getElementById('progress-bar')?.removeAttribute('hidden');
        updateProgressIndicator(lastPhase);
        appendSectionDivider(lastPhase);
        appendMessage('system', 'Retomamos donde lo dejaste 👇');

        const lastMsg = history[history.length - 1];
        if (lastMsg?.role === 'user' && SECTION_ORDER.includes(lastPhase)) {
          // El último turno quedó sin respuesta del asistente: completarlo
          showTyping();
          try { await handleSectionTurn(lastPhase); } finally { hideTyping(); }
        } else if (state.messages.length === 0 && SECTION_ORDER.includes(lastPhase)) {
          // Sección recién abierta sin mensajes propios: relanzar la intro
          await openSection(lastPhase);
        }
        setInputEnabled(true);
        document.getElementById('chat-input')?.focus();
      }
      return true;
    } else {
      localStorage.removeItem('lp_session_id');
      return false;
    }
  } catch (e) {
    console.warn('[session] No se pudo recuperar sesión');
    return false;
  }
}

// ─── Derivación a WhatsApp ──────────────────────────────────────────────────

const WHATSAPP_NUMBER = '5491124847981';

const HUMAN_HANDOFF_PATTERNS = [
  /habl(ar|a)\s+con\s+(mart[ií]n|alguien|una\s+persona|un\s+humano|un\s+asesor)/i,
  /derivar?(me)?\s+(a|con)\s+mart[ií]n/i,
  /atenci[oó]n\s+humana/i,
  /quiero\s+hablar\s+con\s+(alguien|una\s+persona)/i,
  /no\s+quiero\s+(seguir\s+)?(hablando\s+)?con\s+(el\s+|un\s+)?bot/i,
  /pasame\s+con\s+mart[ií]n/i,
];

function detectsHumanHandoffRequest(text) {
  return HUMAN_HANDOFF_PATTERNS.some(re => re.test(text));
}

function getWhatsAppUrl() {
  const clientData = getClientData();
  const nombre     = clientData?.nombre ? `${clientData.nombre} ` : '';
  const refCode    = SESSION_ID.slice(0, 8).toUpperCase();
  const text = `Hola Martín! Soy ${nombre}(ref ${refCode}), vengo del chat de la landing page y quiero hablar directamente.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function buildWhatsAppHandoffWidget() {
  const wrap = document.createElement('div');
  wrap.className = 'whatsapp-handoff-widget';
  wrap.innerHTML = `
    <p class="whatsapp-handoff-text">¿Querés hablar directo con Martín? Escribile por WhatsApp.</p>
    <a class="btn-primary whatsapp-handoff-link" href="${getWhatsAppUrl()}" target="_blank" rel="noopener">Hablar por WhatsApp</a>`;
  return wrap;
}

// Fire-and-forget: arma (vía LLM, server-side) y manda a Martín un resumen
// interno de la sesión cuando el cliente pide derivación o abandona sin terminar.
function sendSessionSummary(trigger) {
  if (state.summarySent) return;
  state.summarySent = true;
  fetch('/api/notify', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'session_summary', session_id: SESSION_ID, trigger }),
  }).catch(() => {});
}

// El cliente puede cerrar la pestaña a mitad del wizard sin avisar — mismo
// patrón que el listener de pagehide de arriba (mensajes sin persistir).
window.addEventListener('pagehide', () => {
  if (state.phase === PHASE.DONE || state.summarySent || !getClientData()) return;
  state.summarySent = true;
  const body = JSON.stringify({ action: 'session_summary', session_id: SESSION_ID, trigger: 'abandono_tab' });
  navigator.sendBeacon('/api/notify', new Blob([body], { type: 'application/json' }));
});

// Tracking de funnel — fire-and-forget, nunca bloquea la UX
function track(step, rubro) {
  try {
    fetch('/api/analytics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(rubro ? { step, rubro } : { step }),
    }).catch(() => {});
  } catch {}
}

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

const PHASE = {
  GREETING:    'greeting',
  EVALUATING:  'evaluating',
  HERO:        'hero',
  SOBRE_MI:    'sobre_mi',
  SERVICIOS:   'servicios',
  TESTIMONIOS: 'testimonios',
  CONTACTO:    'contacto',
  DISENO:      'diseno',
  DSN_REVIEW:  'dsn_review',
  GENERATING:  'generating',
  SELECTING:   'selecting',
  PAYMENT:     'payment',
  NOTIFYING:   'notifying',
  DONE:        'done',
};

const SECTION_ORDER = [
  PHASE.HERO,
  PHASE.SOBRE_MI,
  PHASE.SERVICIOS,
  PHASE.TESTIMONIOS,
  PHASE.CONTACTO,
  PHASE.DISENO,
];

// Secciones que el usuario puede saltear
const SKIPPABLE_SECTIONS = new Set([PHASE.TESTIMONIOS]);

const SECTION_MSG_LIMIT = 10;

let _isSending = false;

// Contador de reintentos automáticos por turno
let _autoRetryCount = 0;
const MAX_AUTO_RETRY = 1;

let state = {
  phase: PHASE.GREETING,
  messages: [],
  prompts: {},
  fullBrief: {
    hero:        null,
    sobre_mi:    null,
    servicios:   null,
    testimonios: null,
    contacto:    null,
    diseno:      null,
  },
  brief:           null,
  previews:        [],
  selectedPreview: null,
  uploadedFiles:   [],
  pendingFiles:    [],
  summarySent:        false,
  handoffWidgetShown: false,
};

// ─── Inicialización ────────────────────────────────────────────────────────────

export async function init() {
  await loadPrompts();

  initRegistrationForm(async (clientData) => {
    window._chatSessionReady = true;
    window.flowModal?.goToStep(3);

    const waBtn = document.getElementById('whatsapp-handoff-btn');
    if (waBtn) waBtn.href = getWhatsAppUrl();

    // Registrar listeners ANTES del saludo: si se hiciera después del delay del
    // typing, habría una ventana en la que el input no responde a clicks/Enter.
    setupEventListeners();

    const recovered = await tryRecoverSession();
    if (!recovered) {
      track('registro');
      const nombre = clientData.nombre;
      // Encuadre de expectativa con typing. El input queda bloqueado mientras el
      // asistente "escribe" su saludo: evita que un mensaje del usuario se procese
      // antes del saludo y deje los mensajes fuera de orden.
      setInputEnabled(false);
      showTyping();
      await new Promise(r => setTimeout(r, 900));
      hideTyping();
      appendMessage('ai',
        `Hola ${nombre} 👋 Soy el asistente de Martín. En ~10 minutos armamos juntos el contenido de tu landing `
        + `y al final te muestro diseños reales para tu marca.\n\nContame: ¿de qué se trata tu negocio o idea?`);
      setInputEnabled(true);
      document.getElementById('chat-input')?.focus();
    }
  });
}

async function loadPrompts() {
  const sections = ['hero', 'sobre_mi', 'servicios', 'testimonios', 'contacto', 'diseno'];
  try {
    const results = await Promise.all([
      ...sections.map(f => fetch(`/landing_page/prompts/prompt_${f}.txt`)
        .then(r => r.ok ? r.text() : '')
        .catch(() => '')),
      // Núcleo compartido del wizard (identidad + reglas + contrato de salida)
      fetch('/landing_page/prompts/core_wizard.txt').then(r => r.ok ? r.text() : '').catch(() => ''),
      fetch('/landing_page/prompts/evaluacion.txt').then(r => r.ok ? r.text() : '').catch(() => ''),
    ]);
    sections.forEach((f, i) => { state.prompts[f] = results[i]; });
    state.prompts.core = results[sections.length];
    state.prompts.eval = results[sections.length + 1];
  } catch {
    console.warn('No se pudieron cargar los prompts.');
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
  input?.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    updateCharCounter(input.value.length);
  });
  // Al abrirse el teclado en mobile, el último mensaje queda tapado hasta que
  // algo vuelva a pegar el scroll abajo. El listener de visualViewport en
  // modal.js cubre la mayoría de los casos, pero el delay tapa la animación
  // del teclado en navegadores donde el resize llega antes de tiempo.
  input?.addEventListener('focus', () => {
    setTimeout(() => {
      const container = document.getElementById('chat-messages');
      if (container) container.scrollTop = container.scrollHeight;
    }, 350);
  });
  attachBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', handleFileSelection);

  document.getElementById('whatsapp-handoff-btn')?.addEventListener('click', () => {
    track('derivacion_whatsapp');
    sendSessionSummary('derivacion_explicita');
  });
}

// ─── Manejo de archivos ────────────────────────────────────────────────────────

function handleFileSelection(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const currentCount = state.pendingFiles.length + state.uploadedFiles.length;
  if (currentCount + files.length > MAX_UPLOAD_FILES) {
    appendMessage('system', `Podés adjuntar máximo ${MAX_UPLOAD_FILES} archivos en total.`);
    e.target.value = '';
    return;
  }

  const oversized = files.find(f => f.size > MAX_UPLOAD_BYTES);
  if (oversized) {
    appendMessage('system', `"${oversized.name}" supera el límite de 3 MB.`);
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

  state.uploadedFiles.forEach(f => {
    const chip = document.createElement('div');
    chip.className = 'file-chip file-chip--uploaded';
    chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>${f.name}</span>`;
    list.appendChild(chip);
  });

  state.pendingFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip file-chip--pending';
    chip.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg><span>${f.name}</span><button class="file-chip-remove" data-idx="${i}" type="button" aria-label="Quitar">×</button>`;
    list.appendChild(chip);
  });

  list.querySelectorAll('.file-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      state.pendingFiles.splice(parseInt(btn.dataset.idx, 10), 1);
      renderAttachedFilesList();
    });
  });
}

async function uploadPendingFiles() {
  if (state.pendingFiles.length === 0) return;
  const clientData = getClientData();
  if (!clientData?.id) return;

  appendMessage('system', `Subiendo ${state.pendingFiles.length} archivo(s)...`);

  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  const filesPayload = await Promise.all(state.pendingFiles.map(async f => ({
    name: f.name, content: await fileToBase64(f), size: f.size, type: f.type,
  })));

  try {
    const res = await fetch('/api/upload-file', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientId: clientData.id, files: filesPayload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      appendMessage('system', res.status === 413
        ? 'El archivo es demasiado grande (máx. 3 MB).'
        : `No se pudieron subir los archivos (${res.status}).`);
    } else {
      state.uploadedFiles.push(...(data.uploaded || []));
      state.pendingFiles = [];
      renderAttachedFilesList();
      appendMessage('system', `✓ ${data.uploaded?.length || 0} archivo(s) recibido(s).`);
    }
  } catch (err) {
    appendMessage('system', 'No pude subir los archivos. Continuamos sin ellos.');
  }
}

// ─── Manejo de mensajes ────────────────────────────────────────────────────────

async function handleSend() {
  if (_isSending) return;

  const input = document.getElementById('chat-input');
  const text  = input?.value.trim();

  // DSN_REVIEW no bloquea: texto libre = "ninguno me convence" → generar nuevos
  const blockedPhases = [PHASE.GENERATING, PHASE.NOTIFYING, PHASE.SELECTING, PHASE.PAYMENT, PHASE.DONE];
  if ((!text && state.pendingFiles.length === 0) || blockedPhases.includes(state.phase)) return;
  if (document.getElementById('chat-section')?.hasAttribute('data-locked')) return;

  _isSending     = true;
  _autoRetryCount = 0;

  input.value = '';
  input.style.height = 'auto';
  updateCharCounter(0);

  if (state.pendingFiles.length > 0) await uploadPendingFiles();

  if (text) {
    appendMessage('user', text);
    state.messages.push({ role: 'user', content: text });
    persistMessage('user', text, state.phase);

    if (!state.handoffWidgetShown && detectsHumanHandoffRequest(text)) {
      state.handoffWidgetShown = true;
      appendWidget(buildWhatsAppHandoffWidget());
      sendSessionSummary('derivacion_explicita_chat');
    }
  }

  if (state.phase === PHASE.DSN_REVIEW) {
    // Texto libre en vez de un click cuenta como rechazo — y como ya describió
    // lo que busca, lo usamos directamente como respuesta a la sección Diseño.
    state.phase = PHASE.DISENO;
    updateProgressIndicator(PHASE.DISENO);
  }

  if (state.phase === PHASE.GREETING) state.phase = PHASE.EVALUATING;

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
    await handleSendError(err, state.phase, text);
  } finally {
    _isSending = false;
    hideTyping();
    const inputPhases = [PHASE.EVALUATING, ...SECTION_ORDER];
    if (inputPhases.includes(state.phase)) {
      setInputEnabled(true);
      document.getElementById('chat-input')?.focus();
    }
  }
}

// ─── Manejo de errores con retry ──────────────────────────────────────────────

async function handleSendError(err, phase, lastText) {
  // Presupuesto agotado: terminar la conversación de forma controlada
  if (err.budgetExceeded) {
    appendMessage('ai', err.budgetMessage);
    setInputEnabled(false);
    return;
  }

  const isRateLimit = err.rateLimitMessage || err.message?.includes('429');
  const msg = isRateLimit
    ? (err.rateLimitMessage || 'Límite de solicitudes alcanzado. Esperá unos minutos.')
    : 'Hubo un error de conexión.';

  // Auto-retry una vez si no es rate limit
  if (!isRateLimit && _autoRetryCount < MAX_AUTO_RETRY) {
    _autoRetryCount++;
    appendMessage('system', `${msg} Reintentando automáticamente...`);
    await new Promise(r => setTimeout(r, 1500));
    try {
      if (phase === PHASE.EVALUATING) {
        await handleEvaluationTurn();
      } else if (SECTION_ORDER.includes(phase)) {
        await handleSectionTurn(phase);
      }
      return;
    } catch (retryErr) {
      console.error('Retry also failed:', retryErr);
    }
  }

  // Mostrar mensaje con botón de reintento manual
  showErrorWithRetry(msg, lastText, phase);
}

function showErrorWithRetry(msg, lastText, phase) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const errorDiv = document.createElement('div');
  errorDiv.className = 'message message--system message--error';
  errorDiv.innerHTML = `
    <div class="message-system error-with-retry">
      <span>${escapeHtml(msg)}</span>
      <button class="btn-retry" type="button">Intentar nuevamente</button>
    </div>`;

  container.appendChild(errorDiv);
  container.scrollTop = container.scrollHeight;

  errorDiv.querySelector('.btn-retry').addEventListener('click', async () => {
    errorDiv.remove();
    setInputEnabled(false);
    showTyping();
    _autoRetryCount = 0;
    try {
      if (phase === PHASE.EVALUATING) {
        await handleEvaluationTurn();
      } else if (SECTION_ORDER.includes(phase)) {
        await handleSectionTurn(phase);
      }
    } catch (err2) {
      if (err2.budgetExceeded) {
        appendMessage('ai', err2.budgetMessage);
        setInputEnabled(false);
        return;
      }
      const retryMsg = err2.rateLimitMessage
        || (err2.message?.includes('429') ? 'Límite de solicitudes alcanzado. Esperá unos minutos.' : null)
        || 'Seguimos teniendo problemas. Intentá en unos minutos o escribinos a hola@martinduarte.com';
      appendMessage('system', retryMsg);
    } finally {
      hideTyping();
      setInputEnabled(true);
    }
  });
}

async function handleEvaluationTurn() {
  const data   = await callClaude(state.messages, state.prompts.eval, { max_tokens: 512 });
  const raw    = data.content?.[0]?.text || '{}';
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
    track('wizard_inicio');
    await runSectionTransition(PHASE.HERO);

    const lastUserMsg = state.messages.filter(m => m.role === 'user').slice(-1);
    state.phase    = PHASE.HERO;
    state.messages = lastUserMsg;

    document.getElementById('progress-bar')?.removeAttribute('hidden');
    updateProgressIndicator(PHASE.HERO);
    appendSectionDivider(PHASE.HERO);
    await openSection(PHASE.HERO);

  } else if (result.siguiente_accion === 'derivar_whatsapp') {
    if (!state.handoffWidgetShown) {
      state.handoffWidgetShown = true;
      appendWidget(buildWhatsAppHandoffWidget());
    }
    sendSessionSummary('fuera_de_alcance_landing');
    // DONE evita que el finally de handleSend re-habilite el input
    state.phase = PHASE.DONE;
    setInputEnabled(false);

  } else if (result.siguiente_accion === 'rechazar') {
    appendMessage('system', 'Si tenés otra consulta o querés explorar otros servicios, escribime cuando quieras.');
    // DONE evita que el finally de handleSend re-habilite el input
    state.phase = PHASE.DONE;
    setInputEnabled(false);
  }
}

// ─── Wizard por secciones ──────────────────────────────────────────────────────

async function handleSectionTurn(seccionKey) {
  // Núcleo compartido (estable → cacheable en el backend) + tarea de la sección
  const sectionPrompt  = state.prompts[seccionKey] || '';
  const systemPrompt   = state.prompts.core
    ? `${state.prompts.core}\n\n${sectionPrompt}`
    : sectionPrompt;
  const trimmedMessages = state.messages.slice(-SECTION_MSG_LIMIT);

  const data = await callClaude(trimmedMessages, systemPrompt, { max_tokens: 1024 });

  const raw         = data.content?.[0]?.text || '';
  const sectionData = extractJSON(raw);
  const displayText = raw.replace(/```json[\s\S]*?```/g, '').trim();

  if (displayText) {
    state.messages.push({ role: 'assistant', content: raw });
    appendMessage('ai', displayText);
    persistMessage('assistant', displayText, state.phase);
  }

  if (sectionData?.seccion === seccionKey) {
    state.fullBrief[seccionKey] = sectionData;
    saveSession({ phase: state.phase, fullBrief: state.fullBrief });
    persistBrief(state.fullBrief);
    await advanceToNextSection(seccionKey);
  }
}

async function advanceToNextSection(completedSection) {
  if (completedSection === PHASE.SERVICIOS) track('seccion_3');
  const idx       = SECTION_ORDER.indexOf(completedSection);
  const nextPhase = SECTION_ORDER[idx + 1] || null;

  if (nextPhase === PHASE.DISENO) {
    // Antes de preguntar preferencias de color, repasamos diseños anteriores.
    await runSectionTransition(PHASE.DSN_REVIEW);

    state.phase    = PHASE.DSN_REVIEW;
    state.messages = [];
    persistMeta({ phase: state.phase });
    updateProgressIndicator(PHASE.DSN_REVIEW);
    appendSectionDivider(PHASE.DSN_REVIEW);

    const attachBtn = document.getElementById('attach-btn');
    if (attachBtn) attachBtn.hidden = false;

    await reviewPreviousDesigns();
  } else if (nextPhase) {
    await runSectionTransition(nextPhase);

    state.phase    = nextPhase;
    state.messages = [];
    persistMeta({ phase: state.phase });
    updateProgressIndicator(nextPhase);
    appendSectionDivider(nextPhase);
    await openSection(nextPhase);
  } else {
    // El brief ya se construyó al entrar a DSN_REVIEW (reviewPreviousDesigns);
    // lo reconstruimos para incorporar las preferencias de color recién dadas.
    state.brief = buildFullBrief();
    saveSession({ phase: 'diseno_completo', brief: state.brief });
    await generateNewDesigns();
  }
}

async function askDesignPreferences() {
  state.phase    = PHASE.DISENO;
  state.messages = [];
  updateProgressIndicator(PHASE.DISENO);
  appendSectionDivider(PHASE.DISENO);
  await openSection(PHASE.DISENO);
}

// Número de sección visible al usuario (1-6), excluye DSN_REVIEW y fases no numeradas
const SECTION_NUMBERS = {
  [PHASE.HERO]:        1,
  [PHASE.SOBRE_MI]:    2,
  [PHASE.SERVICIOS]:   3,
  [PHASE.TESTIMONIOS]: 4,
  [PHASE.CONTACTO]:    5,
  [PHASE.DISENO]:      6,
};

const TOTAL_SECTIONS = 6;

// Intros con indicador de progreso [x/6]
const SECTION_INTROS = {
  [PHASE.SOBRE_MI]:    (n) => `[${n}/${TOTAL_SECTIONS}] ¿Tu emprendimiento es personal o es una empresa/equipo?`,
  [PHASE.SERVICIOS]:   (n) => `[${n}/${TOTAL_SECTIONS}] ¿Qué servicios o productos ofrecés? Listámelos y te ayudo a describirlos.`,
  [PHASE.TESTIMONIOS]: (n) => `[${n}/${TOTAL_SECTIONS}] ¿Querés incluir testimonios de clientes en tu landing?`,
  [PHASE.CONTACTO]:    (n) => `[${n}/${TOTAL_SECTIONS}] ¿Cuál es tu WhatsApp o email de contacto?`,
  [PHASE.DISENO]:      (n) => `[${n}/${TOTAL_SECTIONS}] ¿Tenés alguna preferencia de colores, o me describís qué sensación querés transmitir?`
    + ` Podés adjuntar imágenes con el 📎 (máx. ${MAX_UPLOAD_FILES} archivos, 3 MB c/u).`,
};

async function openSection(phase) {
  const sectionNum = SECTION_NUMBERS[phase];
  const introFn    = SECTION_INTROS[phase];

  if (introFn) {
    const introText = introFn(sectionNum);
    appendMessage('ai', introText);
    state.messages.push({ role: 'assistant', content: introText });

    // Agregar botón de skip para secciones opcionales
    if (SKIPPABLE_SECTIONS.has(phase)) {
      appendSkipButton(phase);
    }
  } else {
    // Hero no tiene intro fija — el modelo arranca usando el contexto de evaluación
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

function appendSkipButton(phase) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'skip-section-wrapper';
  wrapper.innerHTML = `<button class="skip-section-btn" type="button" data-phase="${phase}">Saltar esta sección →</button>`;

  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;

  wrapper.querySelector('.skip-section-btn').addEventListener('click', async () => {
    wrapper.remove();
    // Marcar sección como omitida con valor vacío
    state.fullBrief[phase] = { seccion: phase, omitida: true };
    saveSession({ phase: state.phase, fullBrief: state.fullBrief });
    persistBrief(state.fullBrief);
    await advanceToNextSection(phase);
  });
}

const SECTION_LABELS = {
  [PHASE.HERO]:        'Sección 1/6 — Hero',
  [PHASE.SOBRE_MI]:    'Sección 2/6 — Sobre mí / Nosotros',
  [PHASE.SERVICIOS]:   'Sección 3/6 — Servicios',
  [PHASE.TESTIMONIOS]: 'Sección 4/6 — Testimonios',
  [PHASE.CONTACTO]:    'Sección 5/6 — Contacto',
  [PHASE.DISENO]:      'Sección 6/6 — Estilo visual',
  [PHASE.DSN_REVIEW]:  'Diseños anteriores',
  [PHASE.GENERATING]:  'Generando tus diseños',
};

// ─── Slide de transición entre secciones ──────────────────────────────────────
const TRANSITION_TEXTS = {
  [PHASE.HERO]:        'Comencemos con la landing page',
  [PHASE.SOBRE_MI]:    'Ahora, contanos más sobre vos',
  [PHASE.SERVICIOS]:   'Vamos con tus servicios',
  [PHASE.TESTIMONIOS]: 'Sumemos algunos testimonios',
  [PHASE.CONTACTO]:    'Ya casi — tus datos de contacto',
  [PHASE.DSN_REVIEW]:  'Pasemos a la parte visual',
};

const TRANSITION_DELAY_MS    = 1000;
const TRANSITION_DURATION_MS = 2000;

function showTransitionSlide(text) {
  return new Promise((resolve) => {
    const container = document.getElementById('chat-messages');
    if (!container) { resolve(); return; }

    const slide = document.createElement('div');
    slide.className = 'section-transition-slide';
    slide.innerHTML = `<span class="section-transition-slide__text">${escapeHtml(text)}</span>`;
    container.appendChild(slide);
    container.scrollTop = container.scrollHeight;

    requestAnimationFrame(() => slide.classList.add('section-transition-slide--visible'));

    setTimeout(() => {
      slide.classList.remove('section-transition-slide--visible');
      setTimeout(() => { slide.remove(); resolve(); }, 300);
    }, TRANSITION_DURATION_MS);
  });
}

async function runSectionTransition(nextPhase) {
  await new Promise(r => setTimeout(r, TRANSITION_DELAY_MS));
  await showTransitionSlide(TRANSITION_TEXTS[nextPhase] || 'Un momento...');
}

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
  const steps   = document.querySelectorAll('.progress-step');
  const current = PROGRESS_PHASE_INDEX[phase] ?? -1;
  steps.forEach((step, i) => {
    step.classList.toggle('progress-step--done',    i < current);
    step.classList.toggle('progress-step--active',  i === current);
    step.classList.toggle('progress-step--pending', i > current);
  });
}

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

    testimonios: testimonios?.omitida ? { incluir: false, testimonios: [] } : (testimonios || { incluir: false, testimonios: [] }),

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
    session_id:     SESSION_ID,
  };
}

// ─── Handoff visual al Equipo de Diseño ───────────────────────────────────────

function appendHandoffBanner() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'handoff-banner';
  el.innerHTML = `
    <div class="handoff-banner__divider"></div>
    <div class="handoff-banner__card">
      <div class="handoff-banner__header">
        <span class="handoff-banner__dot"></span>
        <span class="handoff-banner__team">Equipo de Diseño</span>
        <span class="handoff-banner__badge">Área Técnica</span>
      </div>
      <p class="handoff-banner__msg">
        Tu información fue procesada. Nuestro equipo de diseño está preparando tus propuestas personalizadas.
      </p>
    </div>
    <div class="handoff-banner__divider"></div>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

// ─── Flujo post-secciones ──────────────────────────────────────────────────────

async function reviewPreviousDesigns() {
  setInputEnabled(false);
  appendMessage('system', 'Perfecto, ya tenemos todo. Un momento...');
  appendHandoffBanner();

  // Se construye ya (sin colores todavía) porque elegir un diseño anterior
  // salta directo a pago sin pasar por la pregunta de estilo visual.
  state.brief = buildFullBrief();
  saveSession({ phase: 'secciones_completas', brief: state.brief });
  track('wizard_fin', state.brief.rubro);

  const rubro = state.fullBrief.hero?.rubro || '';
  const { sets, error } = await initCarousel(rubro);

  if (error) {
    appendMessage('system', 'No pude cargar diseños anteriores — seguimos con tu diseño a medida.');
  }

  if (sets && sets.length > 0) {
    appendMessage('ai',
      'Antes de armar algo nuevo, revisemos diseños que ya existen. '
      + 'Si alguno te convence podés elegirlo directamente.'
    );

    const widget = buildChatCarouselWidget(sets, {
      onSelect: (preview) => {
        if (DESIGN_ALREADY_CHOSEN_PHASES.has(state.phase)) return;
        state.selectedPreview = { ...preview, dsnId: preview.id };
        state.phase           = PHASE.PAYMENT;
        appendMessage('ai', `Buena elección — ${preview.name}. Pasemos al pago para confirmar tu pedido.`);
        lockDesignSelection();
        showPaymentSection();
      },
      onReject: async () => {
        appendMessage('ai', 'Entendido. Armemos algo nuevo para tu marca.');
        await askDesignPreferences();
      },
    });

    if (widget) {
      appendWidget(widget);
      track('preview_visto');
      // Nunca dejar al usuario encerrado: el texto libre cuenta como rechazo
      setInputEnabled(true);
      const input = document.getElementById('chat-input');
      if (input) input.placeholder = 'Elegí un diseño arriba, o contame qué buscás para tu diseño…';
    } else {
      await askDesignPreferences();
    }
  } else {
    if (!error) appendMessage('system', 'Vas a estrenar diseños hechos 100% a medida 🎨');
    await askDesignPreferences();
  }
}

async function generateNewDesigns() {
  state.phase = PHASE.GENERATING;
  updateProgressIndicator(PHASE.GENERATING);
  setInputEnabled(false);
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.placeholder = 'Contá sobre tu proyecto...';
  appendMessage('system', 'Generando tus 3 diseños personalizados...');
  showGeneratingState();

  try {
    state.previews = await generateAllPreviews(state.brief, (current, total, name, chars) => {
      updateGeneratingProgress(current, total, name, chars);
    });

    state.phase = PHASE.SELECTING;
    hideGeneratingState();
    saveSession({ phase: state.phase, generated: true });

    const widget = buildPreviewsCarouselWidget(state.previews, {
      onSelect: (preview, index) => selectPreview(index),
    });

    if (widget) appendWidget(widget);
    else showPreviewSection(state.previews);
    track('preview_visto');

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
      if (!e.target.closest('.select-preview-btn')) openPreviewModal(preview, i, () => selectPreview(i));
    });
    card.querySelector('.select-preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      selectPreview(i);
    });
  });

  addAltCard(grid, getClientData()?.id || null);
}

// Una vez que se eligió un diseño no se puede volver a elegir otro — evita que
// el cliente reabra el pago o pise la notificación ya enviada con otro template.
const DESIGN_ALREADY_CHOSEN_PHASES = new Set([
  PHASE.PAYMENT, PHASE.NOTIFYING, PHASE.DONE,
]);

function lockDesignSelection() {
  document.querySelectorAll('.ccw-select-btn, .select-preview-btn').forEach(btn => {
    btn.disabled = true;
  });
}

function selectPreview(index) {
  if (DESIGN_ALREADY_CHOSEN_PHASES.has(state.phase)) return;
  if (state.previews[index]) state.selectedPreview = state.previews[index];
  state.phase = PHASE.PAYMENT;

  document.querySelectorAll('.preview-card').forEach((c, i) => {
    c.classList.toggle('selected', i === index);
  });

  lockDesignSelection();
  showPaymentSection();
}

// ─── Pago ──────────────────────────────────────────────────────────────────────

const TRANSFER_INFO = {
  alias:   'Martin.duarte.CA',
  cbu:     '0070241830004012104542',
  titular: 'Martin Duarte',
};

const PAYMENT_METHOD_LABELS = {
  credito:       'tarjeta de crédito',
  debito:        'tarjeta de débito',
  transferencia: 'transferencia',
};

function showPaymentSection() {
  const refCode = SESSION_ID.slice(0, 8).toUpperCase();
  persistMeta({ phase: 'payment', mp_reference: refCode });

  appendMessage('ai',
    `Código de referencia: **${refCode}** — guardalo por si necesitás consultar.\n\n`
    + `Un diseñador revisará tu diseño y se contactará con vos en las próximas 24-48 horas para coordinar ajustes finales.`
  );

  const widget = buildPaymentWidget();
  appendWidget(widget);
}

function buildPaymentWidget() {
  const widget = document.createElement('div');
  widget.className = 'chat-payment-widget';
  widget.innerHTML = `
    <div class="cpw-preview-wrap">
      <iframe title="Vista previa — ${escapeHtml(state.selectedPreview?.name || '')}" scrolling="no" sandbox="allow-same-origin" loading="lazy"></iframe>
    </div>
    <div class="cpw-summary">
      <div class="cpw-row"><span>Marca</span><span class="cpw-brand-value">${escapeHtml(state.brief?.nombre_marca || '—')}</span></div>
      <div class="cpw-row"><span>Diseño</span><span class="cpw-template-value">${escapeHtml(state.selectedPreview?.name || '—')}</span></div>
      <div class="cpw-row"><span>Hosting</span><span>GitHub Pages — gratis</span></div>
      <div class="cpw-row"><span>Entrega</span><span>48–72hs hábiles</span></div>
      <div class="cpw-row cpw-row--total"><span>Total</span><span>$40.000 ARS</span></div>
    </div>
    <p class="cpw-label">¿Cómo preferís pagar?</p>
    <div class="cpw-methods">
      <button class="btn-secondary cpw-method-btn" type="button" data-method="credito">Tarjeta de crédito</button>
      <button class="btn-secondary cpw-method-btn" type="button" data-method="debito">Tarjeta de débito</button>
      <button class="btn-secondary cpw-method-btn" type="button" data-method="transferencia">Transferencia</button>
    </div>`;

  if (state.selectedPreview?.html) {
    renderPreviewInIframe(widget.querySelector('.cpw-preview-wrap iframe'), state.selectedPreview.html);
  }

  widget.querySelectorAll('.cpw-method-btn').forEach(btn => {
    btn.addEventListener('click', () => handlePaymentMethodSelect(btn.dataset.method, widget), { once: true });
  });

  return widget;
}

async function handlePaymentMethodSelect(method, widgetEl) {
  if (state.phase !== PHASE.PAYMENT) return;
  state.phase = PHASE.NOTIFYING;
  track('pago_click', method);

  widgetEl.querySelectorAll('.cpw-method-btn').forEach(b => { b.disabled = true; });
  widgetEl.querySelector(`.cpw-method-btn[data-method="${method}"]`)?.classList.add('cpw-method-btn--selected');

  if (method === 'transferencia') {
    appendMessage('ai',
      'Perfecto, transferí a:\n\n'
      + `**Alias:** ${TRANSFER_INFO.alias}\n`
      + `**CBU:** ${TRANSFER_INFO.cbu}\n`
      + `**Titular:** ${TRANSFER_INFO.titular}\n\n`
      + 'Apenas Martín vea el ingreso te confirma por WhatsApp.'
    );
  } else {
    appendMessage('ai', `Perfecto, dejamos registrado el pago con ${PAYMENT_METHOD_LABELS[method]}. Martín te contacta para coordinar el cobro.`);
  }

  appendMessage('system', 'Enviando tu pedido...');

  try {
    await sendNotification(state.brief, state.selectedPreview?.html || '', getClientData(), state.selectedPreview?.name || '', state.selectedPreview?.dsnId || null, method);
    state.phase = PHASE.DONE;
    saveSession({ phase: PHASE.DONE });
    track('pago_confirmado', state.brief?.rubro);
    showOrderReceivedSlide();
  } catch (err) {
    console.error('Notify error:', err);
    appendMessage('system', 'No se pudo enviar la notificación. Escribinos a hola@martinduarte.com con tu nombre de marca.');
    widgetEl.querySelectorAll('.cpw-method-btn').forEach(b => { b.disabled = false; });
    widgetEl.querySelector(`.cpw-method-btn[data-method="${method}"]`)?.classList.remove('cpw-method-btn--selected');
    state.phase = PHASE.PAYMENT;
  }
}

// ─── Pedido recibido ────────────────────────────────────────────────────────────

function showOrderReceivedSlide() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const slide = document.createElement('div');
  slide.className = 'order-received-slide';
  slide.innerHTML = `
    <div class="ors-icon" role="img" aria-label="Éxito">✓</div>
    <h3 class="ors-title">¡Pedido recibido!</h3>
    <p class="ors-text">
      Martín recibió el brief de <strong>${escapeHtml(state.brief?.nombre_marca || 'tu marca')}</strong> y va a revisar el diseño.<br>
      Te contactamos al <strong>${escapeHtml(state.brief?.contacto || getClientData()?.telefono || 'tu contacto')}</strong> en las próximas 24–48hs.
    </p>
    <button class="btn-primary ors-close-btn" type="button">Listo, ya terminé</button>`;

  container.appendChild(slide);
  container.scrollTop = container.scrollHeight;
  setInputEnabled(false);

  const attachBtn = document.getElementById('attach-btn');
  if (attachBtn) attachBtn.hidden = true;

  slide.querySelector('.ors-close-btn').addEventListener('click', () => {
    window.flowModal?.close();
  });
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

const CHAR_LIMIT = 600;

function updateCharCounter(len) {
  const counter = document.getElementById('char-counter');
  if (!counter) return;
  counter.textContent = `${len} / ${CHAR_LIMIT}`;
  counter.classList.toggle('visible',  len > 0);
  counter.classList.toggle('warn',     len > CHAR_LIMIT * 0.67 && len <= CHAR_LIMIT * 0.9);
  counter.classList.toggle('danger',   len > CHAR_LIMIT * 0.9 && len < CHAR_LIMIT);
  counter.classList.toggle('at-limit', len === CHAR_LIMIT);
}

function showGeneratingState() {
  const el = document.getElementById('generating-state');
  if (el) el.hidden = false;
}

function hideGeneratingState() {
  const el = document.getElementById('generating-state');
  if (el) el.hidden = true;
}

const GEN_HINTS = [
  'Eligiendo paleta para tu rubro…',
  'Escribiendo tu hero…',
  'Armando las cards de servicios…',
  'Ajustando la versión mobile…',
  'Puliendo detalles…',
];
const GEN_EXPECTED_CHARS = 14000; // tamaño típico de un HTML completo

function updateGeneratingProgress(current, total, name, chars = 0) {
  // Skeletons: activo el actual, completados los anteriores
  document.querySelectorAll('.gen-skeleton').forEach((el, i) => {
    el.classList.toggle('gen-skeleton--active', i === current - 1);
    el.classList.toggle('gen-skeleton--done',   i < current - 1);
  });

  const label = document.getElementById('generating-label');
  if (!label) return;

  if (chars > 0) {
    const pct  = Math.min(99, Math.round((chars / GEN_EXPECTED_CHARS) * 100));
    const hint = GEN_HINTS[Math.min(GEN_HINTS.length - 1, Math.floor((pct / 100) * GEN_HINTS.length))];
    label.textContent = `Diseño ${current} de ${total} — ${name} · ${pct}% · ${hint}`;
  } else {
    label.textContent = `Generando diseño ${current} de ${total}: ${name}...`;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function callClaude(messages, system, opts = {}) {
  const { max_tokens = 1024, intent } = opts;

  const res = await fetch('/api/claude', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      messages,
      system,
      max_tokens,
      model:      'claude-haiku-4-5-20251001',
      intent:     intent || 'chat',
      session_id: SESSION_ID,
      section:    state.phase,
    }),
  });

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    const err  = new Error(data.message || 'Límite alcanzado.');
    err.rateLimitMessage = data.error || 'Alcanzaste el límite de solicitudes. Intentá en unos minutos.';
    throw err;
  }

  if (res.status === 402) {
    const data = await res.json().catch(() => ({}));
    const err  = new Error('budget_exceeded');
    err.budgetExceeded = true;
    err.budgetMessage  = data.message || 'Se alcanzó el límite de esta sesión. Escribinos a hola@martinduarte.com para continuar.';
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
