// landing_page/patches/chat-session-patch.js
// ─────────────────────────────────────────────────────────────────────────────
// PARCHE PARA chat.js — Cambios a integrar en el archivo existente
// ─────────────────────────────────────────────────────────────────────────────
// Este archivo documenta exactamente QUÉ agregar/modificar en chat.js.
// NO es un reemplazo completo — es un parche con las funciones nuevas
// y las instrucciones de dónde integrarlas.
//
// CAMBIOS QUE IMPLEMENTA:
//   1. Session ID persistente en localStorage (sobrevive cierre de pestaña)
//   2. Guardado del historial de mensajes en Redis (48h, todas las secciones)
//   3. Recuperación de sesión previa al cargar la página
//   4. MercadoPago external_reference por sesión
//   5. Llamadas a /api/claude con session_id + section para contexto histórico
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 1: Gestión de session_id — Agregar al inicio de chat.js
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Genera o recupera el session_id de esta sesión de usuario.
 * Usa localStorage para que sobreviva el cierre de pestaña (a diferencia de sessionStorage).
 * @returns {string} UUID v4
 */
function getOrCreateSessionId() {
  const STORAGE_KEY = 'lp_session_id';
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    // Genera UUID v4 sin dependencias externas
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

// Inicializar al cargar el módulo — agregar esta línea al inicio del state o del init:
// const SESSION_ID = getOrCreateSessionId();


// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 2: Persistencia de mensajes en Redis — Agregar en chat.js
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Guarda un mensaje en el historial Redis de la sesión.
 * Llamar después de cada sendMessage() y al recibir cada respuesta del LLM.
 * @param {'user'|'assistant'} role
 * @param {string} content
 * @param {string} section - fase actual (ej: 'hero', 'servicios')
 */
async function persistMessage(role, content, section) {
  try {
    await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        session_id: SESSION_ID,
        type:       'message',
        payload:    { role, content, section },
      }),
    });
  } catch (e) {
    // Fire-and-forget: si falla la persistencia, no interrumpe el chat
    console.warn('[session] Error al persistir mensaje:', e);
  }
}

/**
 * Guarda el fullBrief completo en Redis.
 * Llamar cada vez que state.fullBrief se actualiza (al cerrar una sección).
 * @param {object} fullBrief
 */
async function persistBrief(fullBrief) {
  try {
    await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        session_id: SESSION_ID,
        type:       'brief',
        payload:    fullBrief,
      }),
    });
  } catch (e) {
    console.warn('[session] Error al persistir brief:', e);
  }
}

/**
 * Guarda los metadatos de la sesión en Redis.
 * Llamar al cambiar de fase.
 * @param {object} meta - ej: { phase: 'servicios', email: '...' }
 */
async function persistMeta(meta) {
  try {
    await fetch('/api/save-session', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        session_id: SESSION_ID,
        type:       'meta',
        payload:    meta,
      }),
    });
  } catch (e) {
    console.warn('[session] Error al persistir meta:', e);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 3: Recuperación de sesión al cargar — Agregar en initChat() o DOMContentLoaded
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Al cargar la página, verifica si hay una sesión previa en Redis.
 * Si la hay y tiene datos, ofrece al cliente retomar desde donde estaba.
 * @returns {Promise<boolean>} true si se recuperó una sesión y se la ofreció al usuario
 */
async function tryRecoverSession() {
  const storedId = localStorage.getItem('lp_session_id');
  if (!storedId) return false;

  try {
    const res  = await fetch(`/api/get-session?session_id=${storedId}`);
    const data = await res.json();

    if (!data.found || !data.brief) return false;

    // Hay una sesión con datos — determinar cuánto progreso tiene
    const completedSections = Object.keys(data.brief).filter(k => data.brief[k]);
    if (completedSections.length === 0) return false;

    // Mostrar banner/modal de "retomar sesión"
    const confirmed = confirm(
      `Tenés una sesión en progreso (completaste: ${completedSections.join(', ')}).\n¿Querés continuar donde lo dejaste?`
    );

    if (confirmed) {
      // Restaurar estado desde Redis
      state.fullBrief = data.brief || {};
      state.messages  = [];  // el historial vive en Redis, se enviará en cada llamada

      // Restaurar la fase desde los metadatos
      const lastPhase = data.meta?.phase;
      if (lastPhase) {
        state.phase = lastPhase;
        await advanceToPhase(lastPhase); // función existente en chat.js
      }

      return true;
    } else {
      // El usuario eligió empezar de nuevo — limpiar la sesión vieja
      localStorage.removeItem('lp_session_id');
      return false;
    }
  } catch (e) {
    console.warn('[session] No se pudo recuperar sesión:', e);
    return false;
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 4: Modificación de callClaude() — Agregar session_id + section
// ═══════════════════════════════════════════════════════════════════════════════
//
// En la función callClaude() (o como se llame en chat.js), agregar los campos
// session_id y section al body del fetch hacia /api/claude:
//
// ANTES:
//   body: JSON.stringify({
//     model,
//     system,
//     messages: state.messages,
//     max_tokens,
//     intent,
//   })
//
// DESPUÉS:
//   body: JSON.stringify({
//     model,
//     system,
//     messages: state.messages,
//     max_tokens,
//     intent,
//     session_id: SESSION_ID,   // ← NUEVO
//     section:    state.phase,  // ← NUEVO: fase/sección actual
//   })
//
// El backend (api/claude.js) usará session_id + section para inyectar el
// contexto histórico de secciones anteriores en el system prompt automáticamente.


// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 5: MercadoPago con external_reference por sesión
// ═══════════════════════════════════════════════════════════════════════════════
//
// ANTES (link hardcodeado, sin trazabilidad de pago):
//   const MP_LINK = 'https://mpago.la/1Dufc3b';
//   window.open(MP_LINK);
//
// DESPUÉS (mismo link de MP + external_reference para matchear pagos):
//
// Mercado Pago no soporta agregar external_reference a un link de pago directo vía URL.
// La solución temporal (MVP) es mostrar el session_id visualmente junto al botón de pago
// para que Martín pueda matchearlo manualmente con la notificación de MP.

function renderPaymentStep() {
  const MP_LINK = 'https://mpago.la/1Dufc3b';

  // Mostrar en el chat el mensaje de pago con el ID de referencia visible
  addChatMessage('assistant', `
    Perfecto. Para confirmar tu pedido, realizá el pago de <strong>$40.000 ARS</strong>.<br><br>
    <strong>Tu código de referencia:</strong> <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px">${SESSION_ID.slice(0, 8).toUpperCase()}</code><br>
    <em style="font-size:0.85em;color:#6b7280">Guardá este código — te puede ser útil si necesitás consultar el estado de tu pedido.</em><br><br>
    <a href="${MP_LINK}" target="_blank"
       style="display:inline-block;background:#009ee3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
      💳 Pagar con Mercado Pago
    </a><br><br>
    Una vez que hayas pagado, hacé clic en el botón de confirmación.
  `);

  // Persistir la referencia
  persistMeta({ phase: 'payment', mp_reference: SESSION_ID.slice(0, 8).toUpperCase() });
}


// ═══════════════════════════════════════════════════════════════════════════════
// BLOQUE 6: Hooks de integración — Dónde llamar cada función
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estos son los puntos exactos en chat.js donde integrar los llamados:
//
// 1. Al inicio, en DOMContentLoaded o init():
//    const SESSION_ID = getOrCreateSessionId();
//    await tryRecoverSession();
//
// 2. Después de cada mensaje enviado por el usuario (antes del await callClaude):
//    await persistMessage('user', userMessage, state.phase);
//
// 3. Después de recibir y mostrar la respuesta del LLM:
//    await persistMessage('assistant', assistantResponse, state.phase);
//
// 4. Al cerrar una sección y actualizar fullBrief:
//    state.fullBrief[sectionName] = sectionData;
//    await persistBrief(state.fullBrief);
//
// 5. Al cambiar de fase (advanceToNextSection o similar):
//    await persistMeta({ phase: state.phase });
//
// 6. Al llegar a la fase 'payment':
//    renderPaymentStep(); // en lugar del código anterior de pago
//
// NOTA SOBRE persistMessage: es fire-and-forget (no bloquea el chat).
// No necesita await si el rendimiento es importante — puede ir sin await.
