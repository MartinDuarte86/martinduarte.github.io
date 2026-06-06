// Mejora 1 — Formulario de registro previo al chat
// Gestiona validación, llamada a API y persistencia en clientes.json

let _clientData = null;

function getClientData() {
  return _clientData;
}

// UUID v4 simple (sin crypto.randomUUID para compatibilidad)
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

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
  const nombre   = document.getElementById('reg-nombre')?.value.trim() || '';
  const apellido = document.getElementById('reg-apellido')?.value.trim() || '';
  const email    = document.getElementById('reg-email')?.value.trim() || '';
  const btn      = document.getElementById('reg-submit');
  if (!btn) return;
  const ready = nombre.length >= 2 && apellido.length >= 2 && isValidEmailFormat(email);
  btn.disabled = !ready;
}

async function validateEmailViaApi(email) {
  const res = await fetch('/api/validate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { deliverable: true, disposable: false }; // fail-open si la API falla
  return res.json();
}

async function saveClientViaApi(client) {
  const res = await fetch('/api/save-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', client }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
}

export async function saveFeedback(sessionId, feedbackText) {
  await fetch('/api/save-client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'feedback', sessionId, feedbackText }),
  });
}

export function initRegistrationForm(onSuccess) {
  const form = document.getElementById('registration-form');
  if (!form) return;

  ['reg-nombre', 'reg-apellido', 'reg-email'].forEach(id => {
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
    const nombre   = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const email    = document.getElementById('reg-email').value.trim();

    if (nombre.length < 2)   { setError('reg-nombre', 'Mínimo 2 caracteres'); return; }
    if (apellido.length < 2) { setError('reg-apellido', 'Mínimo 2 caracteres'); return; }
    if (!isValidEmailFormat(email)) { setError('reg-email', 'Revisá el formato del email'); return; }

    const btn = document.getElementById('reg-submit');
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    btn.classList.add('loading');

    try {
      const result = await validateEmailViaApi(email);

      if (result.disposable) {
        setError('reg-email', 'Por favor usá un email personal o de trabajo');
        btn.disabled = false;
        btn.textContent = 'Continuar';
        btn.classList.remove('loading');
        return;
      }

      if (!result.deliverable) {
        setError('reg-email', 'Este email no parece válido. ¿Está bien escrito?');
        btn.disabled = false;
        btn.textContent = 'Continuar';
        btn.classList.remove('loading');
        return;
      }

      _clientData = {
        id: generateId(),
        nombre,
        apellido,
        email,
        timestamp_inicio: new Date().toISOString(),
        estado: 'en_chat',
        template_elegido: null,
        feedback_diseño: null,
        dsn_carpeta: null,
      };

      // Guardar en GitHub (no bloquea el flujo si falla)
      saveClientViaApi(_clientData).catch(err => console.warn('No se pudo guardar cliente:', err));

      // Ocultar formulario y habilitar chat
      form.classList.add('reg-form--done');
      setTimeout(() => { form.hidden = true; }, 350);

      const chatSection = document.getElementById('chat-section');
      if (chatSection) chatSection.removeAttribute('data-locked');

      onSuccess(_clientData);
    } catch (err) {
      console.error('Registration error:', err);
      setError('reg-email', 'Error al verificar. Intentá de nuevo.');
      btn.disabled = false;
      btn.textContent = 'Continuar';
      btn.classList.remove('loading');
    }
  });
}

export { getClientData };
