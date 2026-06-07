// Formulario de registro previo al chat
// Gestiona validación, persistencia en clientes.json y sesión en localStorage

const SESSION_KEY = 'mdlp_session'; // martinduarte landing page session
const SESSION_TTL = 48 * 60 * 60 * 1000; // 48 horas

let _clientData = null;

export function getClientData() {
  return _clientData;
}

// ─── Sesión en localStorage ────────────────────────────────────────────────────

export function saveSession(extra = {}) {
  if (!_clientData) return;
  try {
    const current = JSON.parse(localStorage.getItem(SESSION_KEY) || '{}');
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ...current,
      ...extra,
      id: _clientData.id,
      email: _clientData.email,
      nombre: _clientData.nombre,
      apellido: _clientData.apellido,
      timestamp_inicio: _clientData.timestamp_inicio,
      savedAt: Date.now(),
    }));
  } catch {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.savedAt || Date.now() - data.savedAt > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// ─── UUID simple ────────────────────────────────────────────────────────────────

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Validaciones de formulario ────────────────────────────────────────────────

function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function setError(fieldId, msg) {
  const el = document.getElementById(`${fieldId}-error`);
  if (el) { el.textContent = msg; el.hidden = !msg; }
}

function clearError(fieldId) {
  setError(fieldId, '');
}

function updateSubmitBtn() {
  const nombre    = document.getElementById('reg-nombre')?.value.trim() || '';
  const apellido  = document.getElementById('reg-apellido')?.value.trim() || '';
  const email     = document.getElementById('reg-email')?.value.trim() || '';
  const telefono  = document.getElementById('reg-telefono')?.value.trim() || '';
  const btn       = document.getElementById('reg-submit');
  if (!btn) return;
  const ready = nombre.length >= 2 && apellido.length >= 2 && isValidEmailFormat(email);
  btn.disabled = !ready;
}

function resetBtn(btn, label) {
  btn.disabled = false;
  btn.classList.remove('loading');
  // Preservar el texto original del botón si no se pasa label
  if (label) {
    btn.textContent = label;
  } else {
    btn.textContent = btn.dataset.originalLabel || 'Empezar el chat';
  }
}

// ─── Llamadas a API ────────────────────────────────────────────────────────────

async function validateEmailViaApi(email) {
  try {
    const res = await fetch('/api/validate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return { deliverable: true, disposable: false }; // fail-open
    return res.json();
  } catch {
    return { deliverable: true, disposable: false }; // fail-open si el endpoint no existe
  }
}

async function saveClientViaApi(client) {
  const res = await fetch('/api/save-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', client }),
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 409) {
    // Email ya registrado
    return { conflict: true, ...data };
  }

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return { conflict: false };
}

export async function saveFeedback(sessionId, feedbackText) {
  await fetch('/api/save-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'feedback', sessionId, feedbackText }),
  });
}

// ─── Mensaje contextual para emails ya registrados ────────────────────────────

function buildReturnMessage(estado, nombre) {
  const name = nombre ? ` ${nombre}` : '';
  switch (estado) {
    case 'en_chat':
      return `Hola${name}, ya tenés una sesión activa en este dispositivo. Recargá la página para retomar desde donde quedaste.`;
    case 'generado':
    case 'template_elegido':
      return `Hola${name}, ya generaste tus diseños. Si querés avanzar o tenés dudas, escribime a hola@martinduarte.com.`;
    case 'pagado':
    case 'aprobado':
      return `Hola${name}, tu landing page está en proceso. Te avisamos cuando esté lista.`;
    default:
      return `Este email ya está registrado. Si necesitás ayuda escribime a hola@martinduarte.com.`;
  }
}

// ─── Inicialización del formulario ────────────────────────────────────────────

export function initRegistrationForm(onSuccess) {
  const form = document.getElementById('registration-form');
  if (!form) return;

  // Verificar sesión activa en localStorage — saltear formulario si existe
  const session = loadSession();
  if (session?.id && session?.nombre) {
    _clientData = {
      id: session.id,
      nombre: session.nombre,
      apellido: session.apellido || '',
      email: session.email || '',
      timestamp_inicio: session.timestamp_inicio || new Date().toISOString(),
      estado: session.phase || 'en_chat',
    };

    form.hidden = true;
    const chatSection = document.getElementById('chat-section');
    if (chatSection) chatSection.removeAttribute('data-locked');

    onSuccess(_clientData);
    return;
  }

  // Sin sesión — mostrar formulario normal
  ['reg-nombre', 'reg-apellido', 'reg-email', 'reg-telefono'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (id === 'reg-email') {
        const val = document.getElementById('reg-email').value.trim();
        if (val && !isValidEmailFormat(val)) {
          setError('reg-email', 'Revisá el formato del email');
        } else {
          clearError('reg-email');
        }
      }
      updateSubmitBtn();
    });
  });

  document.getElementById('reg-submit')?.addEventListener('click', async () => {
    const nombre    = document.getElementById('reg-nombre').value.trim();
    const apellido  = document.getElementById('reg-apellido').value.trim();
    const email     = document.getElementById('reg-email').value.trim();
    const telefono  = document.getElementById('reg-telefono')?.value.trim() || '';

    if (nombre.length < 2)   { setError('reg-nombre', 'Mínimo 2 caracteres'); return; }
    if (apellido.length < 2) { setError('reg-apellido', 'Mínimo 2 caracteres'); return; }

    const btn = document.getElementById('reg-submit');
    btn.dataset.originalLabel = btn.textContent.trim();
    btn.disabled = true;
    btn.textContent = 'Guardando...';
    btn.classList.add('loading');

    try {
      // TODO: reactivar validación de email y teléfono

      // Armar registro y guardar — la API retorna 409 si el email existe
      _clientData = {
        id: generateId(),
        nombre,
        apellido,
        email,
        telefono,
        timestamp_inicio: new Date().toISOString(),
        estado: 'en_chat',
        template_elegido: null,
        feedback_diseño: null,
        dsn_carpeta: null,
      };

      const saveResult = await saveClientViaApi(_clientData);

      if (saveResult.conflict) {
        const { estado, nombre: existingNombre, id: existingId } = saveResult;

        // Si el proceso está incompleto (en_chat) → restaurar sesión y avanzar
        if (!estado || estado === 'en_chat') {
          _clientData = {
            id: existingId || generateId(),
            nombre: existingNombre || nombre,
            apellido,
            email,
            telefono,
            timestamp_inicio: new Date().toISOString(),
            estado: 'en_chat',
          };
          saveSession({ phase: 'en_chat' });
          form.classList.add('reg-form--done');
          setTimeout(() => { form.hidden = true; }, 350);
          const chatSection = document.getElementById('chat-section');
          if (chatSection) chatSection.removeAttribute('data-locked');
          onSuccess(_clientData);
          return;
        }

        // Si ya generó diseños o pagó → mostrar mensaje informativo
        setError('reg-email', buildReturnMessage(estado, existingNombre));
        resetBtn(btn, 'Empezar el chat');
        _clientData = null;
        return;
      }

      // 3. Guardar sesión en localStorage y habilitar chat
      saveSession({ phase: 'en_chat' });

      form.classList.add('reg-form--done');
      setTimeout(() => { form.hidden = true; }, 350);

      const chatSection = document.getElementById('chat-section');
      if (chatSection) chatSection.removeAttribute('data-locked');

      onSuccess(_clientData);
    } catch (err) {
      console.warn('No se pudo guardar cliente, continuando de todas formas:', err);
      // El guardado remoto falló (p. ej. GH_TOKEN no configurado) — seguimos igual
      saveSession({ phase: 'en_chat' });
      form.classList.add('reg-form--done');
      setTimeout(() => { form.hidden = true; }, 350);
      const chatSection = document.getElementById('chat-section');
      if (chatSection) chatSection.removeAttribute('data-locked');
      onSuccess(_clientData);
    }
  });
}
