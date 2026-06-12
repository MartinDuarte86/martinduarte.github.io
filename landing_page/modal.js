// ─── Flow Modal — 3 pasos: pre-cal → registro → chat ────────────────────────
// Expone window.flowModal para que chat.js y la pre-cal puedan controlarlo.

const flowModal = (() => {
  let currentStep = 0;
  let initialized = false;

  function getEl(id) { return document.getElementById(id); }

  function open() {
    // Tracking de funnel (fire-and-forget)
    try {
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'modal_open' }),
      }).catch(() => {});
    } catch {}

    // Si ya hay sesión activa el chat está listo → ir directo al paso 3
    if (window._chatSessionReady) {
      _show();
      _setStep(3, false);
      return;
    }
    _show();
    _setStep(1, false);
  }

  function goToStep(n, animate = true) {
    _setStep(n, animate);
  }

  function close() {
    const modal = getEl('flow-modal');
    if (!modal) return;
    modal.classList.add('flow-modal--closing');
    setTimeout(() => {
      modal.hidden = true;
      modal.classList.remove('flow-modal--closing');
      document.body.style.overflow = '';
    }, 280);
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  function _show() {
    const modal = getEl('flow-modal');
    if (!modal) return;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function _setStep(n, animate) {
    currentStep = n;

    // Actualizar indicador de pasos
    document.querySelectorAll('.fsi-step').forEach(el => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.toggle('fsi-step--active', s === n);
      el.classList.toggle('fsi-step--done', s < n);
    });

    // Ocultar / mostrar paneles con animación
    [1, 2, 3].forEach(step => {
      const panel = getEl(`flow-step-${step}`);
      if (!panel) return;
      if (step === n) {
        panel.hidden = false;
        if (animate) {
          panel.classList.add('flow-panel--entering');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => panel.classList.remove('flow-panel--entering'));
          });
        }
      } else {
        panel.hidden = true;
      }
    });

    // Paso 3: expandir a full-screen y ocultar el header del modal
    const container = getEl('flow-container');
    const header    = getEl('flow-header');
    if (n === 3) {
      container?.classList.add('flow-container--full');
      if (header) header.hidden = true;
    } else {
      container?.classList.remove('flow-container--full');
      if (header) header.hidden = false;
    }

    // Foco accesible
    const panel = getEl(`flow-step-${n}`);
    const firstFocusable = panel?.querySelector('select, input, button:not([disabled]), [tabindex="0"]');
    setTimeout(() => firstFocusable?.focus(), 320);
  }

  // ─── Inicialización ────────────────────────────────────────────────────────

  function init() {
    if (initialized) return;
    initialized = true;

    // Trigger: botón "Empezar ahora" de la card del hero
    document.querySelectorAll('[data-open-flow]').forEach(btn => {
      btn.addEventListener('click', open);
    });

    // Cerrar con clic fuera del contenedor (solo pasos 1-2)
    // Se escucha en el modal raíz porque flow-container intercepta clicks sobre el overlay
    getEl('flow-modal')?.addEventListener('click', (e) => {
      if (currentStep < 3 && !getEl('flow-container')?.contains(e.target)) close();
    });

    // Cerrar con botón X
    getEl('flow-close')?.addEventListener('click', close);

    // Cerrar con Escape (solo pasos 1-2)
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentStep > 0 && currentStep < 3) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { open, goToStep, close };
})();

window.flowModal = flowModal;
