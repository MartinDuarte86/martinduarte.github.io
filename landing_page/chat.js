// Motor del chat: estado, prompts, llamadas a Claude y transiciones de UI
import { generateAllPreviews, renderPreviewInIframe, cleanupPreviewUrl } from './generator.js';
import { sendNotification } from './notifier.js';

const MP_LINK = 'https://mpago.la/REEMPLAZAR'; // Actualizá con tu link de Mercado Pago

const PHASE = {
  GREETING:   'greeting',
  EVALUATING: 'evaluating',
  ONBOARDING: 'onboarding',
  GENERATING: 'generating',
  SELECTING:  'selecting',
  PAYMENT:    'payment',
  NOTIFYING:  'notifying',
  DONE:       'done',
};

let state = {
  phase: PHASE.GREETING,
  messages: [],
  prompts: { eval: '', onboarding: '' },
  brief: null,
  previews: [],
  selectedPreview: null,
};

// ─── Inicialización ────────────────────────────────────────────────────────────

async function init() {
  await loadPrompts();
  setupEventListeners();
  appendMessage('ai', 'Hola. Contame sobre tu proyecto — ¿de qué se trata tu negocio o idea?');
}

async function loadPrompts() {
  const [evalRes, onboardRes] = await Promise.all([
    fetch('/landing_page/prompts/evaluacion.txt'),
    fetch('/landing_page/prompts/onboarding.txt'),
  ]);
  state.prompts.eval = await evalRes.text();
  state.prompts.onboarding = await onboardRes.text();
}

function setupEventListeners() {
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const startBtn = document.getElementById('start-btn');

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      document.getElementById('chat-section').scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => input?.focus(), 600);
    });
  }

  sendBtn?.addEventListener('click', handleSend);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });
}

// ─── Manejo de mensajes ────────────────────────────────────────────────────────

async function handleSend() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text || state.phase === PHASE.GENERATING || state.phase === PHASE.NOTIFYING) return;

  input.value = '';
  appendMessage('user', text);
  state.messages.push({ role: 'user', content: text });

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
    }
  } catch (err) {
    console.error(err);
    appendMessage('system', 'Hubo un error de conexión. Intentá de nuevo en un momento.');
  } finally {
    hideTyping();
    setInputEnabled(true);
    document.getElementById('chat-input')?.focus();
  }
}

async function handleEvaluationTurn() {
  const data = await callClaude(state.messages, state.prompts.eval);
  const raw = data.content?.[0]?.text || '{}';
  const result = extractJSON(raw);

  if (!result) {
    // Claude no respondió en formato esperado, mostrar el texto directamente
    const displayText = raw.slice(0, 400);
    state.messages.push({ role: 'assistant', content: displayText });
    appendMessage('ai', displayText);
    return;
  }

  const reply = result.respuesta_cliente || 'Entendido. ¿Podés contarme más?';
  state.messages.push({ role: 'assistant', content: reply });
  appendMessage('ai', reply);

  if (result.siguiente_accion === 'onboarding') {
    state.phase = PHASE.ONBOARDING;
  } else if (result.siguiente_accion === 'rechazar') {
    appendMessage('system', 'Si tenés otra consulta o querés explorar otros servicios, escribime cuando quieras.');
    setInputEnabled(false);
  }
}

async function handleOnboardingTurn() {
  const data = await callClaude(state.messages, state.prompts.onboarding);
  const raw = data.content?.[0]?.text || '';

  const brief = extractJSON(raw);
  const isBriefComplete = brief && brief.nombre_marca && brief.rubro &&
    Array.isArray(brief.servicios) && brief.servicios.length > 0 && brief.contacto;

  // Mostrar parte del texto (sin el bloque JSON)
  const displayText = raw.replace(/```json[\s\S]*?```/g, '').trim();
  if (displayText) {
    state.messages.push({ role: 'assistant', content: raw });
    appendMessage('ai', displayText);
  }

  if (isBriefComplete) {
    state.brief = brief;
    state.phase = PHASE.GENERATING;
    setInputEnabled(false);
    await startGeneration();
  }
}

// ─── Generación de previews ────────────────────────────────────────────────────

async function startGeneration() {
  appendMessage('system', 'Perfecto, tengo todo lo que necesito. Generando tus 3 diseños...');
  showGeneratingState();

  try {
    state.previews = await generateAllPreviews(state.brief, (current, total, name) => {
      updateGeneratingProgress(current, total, name);
    });

    state.phase = PHASE.SELECTING;
    hideGeneratingState();
    showPreviewSection(state.previews);
  } catch (err) {
    console.error('Generation error:', err);
    hideGeneratingState();
    appendMessage('system', 'No pude generar los diseños en este momento. Escribime y lo resolvemos.');
    setInputEnabled(true);
    state.phase = PHASE.ONBOARDING;
  }
}

// ─── Selección de template ─────────────────────────────────────────────────────

function showPreviewSection(previews) {
  const section = document.getElementById('previews-section');
  if (!section) return;

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const grid = document.getElementById('previews-grid');
  grid.innerHTML = '';

  previews.forEach((preview, i) => {
    const card = document.createElement('div');
    card.className = 'preview-card';
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

    card.querySelector('.select-preview-btn').addEventListener('click', () => {
      selectPreview(i);
    });
  });
}

function selectPreview(index) {
  state.selectedPreview = state.previews[index];
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
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('payment-brand').textContent = state.brief.nombre_marca;
  document.getElementById('payment-template').textContent = state.selectedPreview.name;

  const mpBtn = document.getElementById('mp-btn');
  if (mpBtn) mpBtn.href = MP_LINK;

  document.getElementById('confirm-payment-btn')?.addEventListener('click', handlePaymentConfirm);
}

async function handlePaymentConfirm() {
  if (state.phase !== PHASE.PAYMENT) return;
  state.phase = PHASE.NOTIFYING;

  const btn = document.getElementById('confirm-payment-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  appendMessage('system', 'Confirmación recibida. Enviando tu pedido a Martín...');
  document.getElementById('chat-section').scrollIntoView({ behavior: 'smooth' });

  try {
    await sendNotification(state.brief, state.selectedPreview.html);
    state.phase = PHASE.DONE;
    showSuccessSection();
  } catch (err) {
    console.error('Notify error:', err);
    appendMessage('system', 'No se pudo enviar la notificación. Escribinos a hola@martinduarte.com con tu nombre de marca y te respondemos en seguida.');
    if (btn) { btn.disabled = false; btn.textContent = 'Reintentar'; }
    state.phase = PHASE.PAYMENT;
  }
}

// ─── Sección de éxito ──────────────────────────────────────────────────────────

function showSuccessSection() {
  const section = document.getElementById('success-section');
  if (!section) return;
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('success-brand').textContent = state.brief.nombre_marca;
  document.getElementById('success-contact').textContent = state.brief.contacto;
}

// ─── Utilidades de UI ──────────────────────────────────────────────────────────

function appendMessage(role, text) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msg = document.createElement('div');
  msg.className = `message message--${role}`;

  if (role === 'ai') {
    msg.innerHTML = `<div class="message-avatar">M</div><div class="message-bubble">${escapeHtml(text)}</div>`;
  } else if (role === 'user') {
    msg.innerHTML = `<div class="message-bubble">${escapeHtml(text)}</div>`;
  } else {
    msg.innerHTML = `<div class="message-system">${escapeHtml(text)}</div>`;
  }

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
  const btn = document.getElementById('send-btn');
  if (input) input.disabled = !enabled;
  if (btn) btn.disabled = !enabled;
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

async function callClaude(messages, system) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens: 1024 }),
  });
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

export { init };
