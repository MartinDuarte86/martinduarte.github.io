/*
 * ebooks.js — Gate de captura de leads para /ebooks/**.
 *
 * Tanto "Leer online" como "Descargar PDF" exigen completar el formulario
 * (nombre, apellido, email, teléfono + consentimiento). No hay opción de
 * saltear. Una vez enviado, se guarda en localStorage y el usuario que vuelve
 * no lo completa de nuevo.
 *
 * El markup se inyecta en <div id="ebook-gate"></div>.
 *
 * IMPORTANTE: el CSS se inyecta completo acá y NO depende de Tailwind, porque
 * este script también corre en la página de lectura del ebook
 * (/ebooks/<slug>/), que a propósito no carga assets/css/tailwind.css para no
 * pisar su propia tipografía (Fraunces/Inter). Ver el comentario de esa página.
 *
 * Expone en window: openEbookGate(opts), closeEbookGate().
 */
(function () {
  'use strict';

  // Sincronizado con `consent_texto_version` en supabase/003_leads.sql y con la
  // validación de api/notify.js. Si cambia el texto legal de abajo, subir esto.
  var LEGAL_VERSION = 'v1';
  var STORAGE_KEY = 'md_ebook_lead';

  var pending = null;    // { slug, accion, href }
  var lastFocus = null;

  // ===== Persistencia (localStorage puede tirar en Safari privado) =====
  function readLead() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      return (data && data.email) ? data : null;
    } catch (e) {
      return null;
    }
  }

  function writeLead(email) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ email: email, ts: Date.now() }));
    } catch (e) {
      /* modo privado o storage bloqueado: el acceso de esta sesión ya se dio */
    }
  }

  // ===== Ejecutar la acción pedida una vez pasado el gate =====
  function runAction(action) {
    if (!action || !action.href) return;
    if (action.accion === 'descargar') {
      var a = document.createElement('a');
      a.href = action.href;
      a.setAttribute('download', '');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.location.href = action.href;
    }
  }

  // ===== Markup =====
  function renderGateModal() {
    return '' +
    '<div id="ebookGate" class="eg-modal eg-hidden" role="dialog" aria-modal="true" aria-labelledby="egTitle">' +
      '<div class="eg-overlay" data-eg-close></div>' +
      '<div class="eg-card">' +
        '<div class="eg-head">' +
          '<h3 id="egTitle" class="eg-title">Accedé al ebook</h3>' +
          '<button type="button" class="eg-x" data-eg-close aria-label="Cerrar">&times;</button>' +
        '</div>' +
        '<p class="eg-lead">Completá tus datos para leerlo online o descargar el PDF.</p>' +
        '<form id="egForm" novalidate>' +
          '<div class="eg-row">' +
            '<input type="text" id="egNombre" class="eg-input" placeholder="Nombre" autocomplete="given-name">' +
            '<input type="text" id="egApellido" class="eg-input" placeholder="Apellido" autocomplete="family-name">' +
          '</div>' +
          '<input type="email" id="egEmail" class="eg-input" placeholder="Correo electrónico" autocomplete="email">' +
          '<input type="tel" id="egTelefono" class="eg-input" placeholder="Teléfono (con característica)" autocomplete="tel">' +
          '<label class="eg-consent">' +
            '<input type="checkbox" id="egConsent">' +
            '<span>Acepto los términos y la política de privacidad: autorizo a Martín Duarte a ' +
              'guardar mis datos y a contactarme por email, teléfono o WhatsApp con contenidos, ' +
              'novedades y comunicaciones comerciales sobre sus servicios. Mis datos no se venden ' +
              'ni se ceden a terceros, y puedo pedir su baja o eliminación en cualquier momento ' +
              'escribiendo a <a href="mailto:martynduarte@gmail.com">martynduarte@gmail.com</a>.</span>' +
          '</label>' +
          '<p id="egError" class="eg-error" role="alert" aria-live="polite"></p>' +
          '<button type="submit" id="egSubmit" class="eg-submit" data-ev="submit_ebook_gate">Acceder al ebook</button>' +
        '</form>' +
      '</div>' +
    '</div>';
  }

  // ===== Validación (booking.js no valida nada; acá sí hace falta) =====
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validate(values) {
    if (!values.nombre)   return 'Ingresá tu nombre.';
    if (!values.apellido) return 'Ingresá tu apellido.';
    if (!values.email)    return 'Ingresá tu correo electrónico.';
    if (!EMAIL_RE.test(values.email)) return 'El correo electrónico no parece válido.';
    if (!values.telefono) return 'Ingresá tu teléfono.';
    if (values.telefono.replace(/\D/g, '').length < 8) return 'El teléfono parece incompleto.';
    if (!values.acepta_marketing) return 'Tenés que aceptar los términos para continuar.';
    return null;
  }

  function readForm() {
    function val(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    }
    var chk = document.getElementById('egConsent');
    return {
      nombre:   val('egNombre'),
      apellido: val('egApellido'),
      email:    val('egEmail'),
      telefono: val('egTelefono'),
      acepta_marketing: !!(chk && chk.checked),
    };
  }

  function showError(msg) {
    var el = document.getElementById('egError');
    if (el) el.textContent = msg || '';
  }

  function onSubmit(e) {
    e.preventDefault();
    var values = readForm();
    var err = validate(values);
    if (err) { showError(err); return; }
    showError('');

    var btn = document.getElementById('egSubmit');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }

    var payload = {
      action: 'ebook_lead',
      nombre: values.nombre,
      apellido: values.apellido,
      email: values.email,
      telefono: values.telefono,
      acepta_marketing: true,
      consent_texto_version: LEGAL_VERSION,
      recurso_slug: pending ? pending.slug : null,
      accion: pending ? pending.accion : 'leer',
    };

    var target = pending;

    window.fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) throw new Error('http_' + res.status);
      writeLead(values.email);
      window.closeEbookGate();
      runAction(target);
    }).catch(function () {
      showError('No pudimos registrar tus datos. Probá de nuevo en unos segundos.');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Acceder al ebook'; }
    });
  }

  // ===== API pública =====
  window.openEbookGate = function (opts) {
    pending = opts || null;
    var modal = document.getElementById('ebookGate');
    if (!modal) return;
    lastFocus = document.activeElement;
    showError('');
    modal.classList.remove('eg-hidden');
    document.body.style.overflow = 'hidden';
    var first = document.getElementById('egNombre');
    if (first) first.focus();
  };

  window.closeEbookGate = function () {
    var modal = document.getElementById('ebookGate');
    if (!modal) return;
    modal.classList.add('eg-hidden');
    document.body.style.overflow = 'auto';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  // ===== Delegación de clicks en los CTAs de ebooks =====
  function bindTriggers() {
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-ebook-action]');
      if (trigger) {
        e.preventDefault();
        var action = {
          slug:   trigger.getAttribute('data-ebook-slug'),
          accion: trigger.getAttribute('data-ebook-action'),
          href:   trigger.getAttribute('data-ebook-href'),
        };
        // Ya dejó sus datos antes: acceso directo, sin volver a pedirlos.
        if (readLead()) runAction(action);
        else window.openEbookGate(action);
        return;
      }
      if (e.target.closest('[data-eg-close]')) window.closeEbookGate();
    });
  }

  // Accesibilidad: Esc cierra y Tab queda atrapado dentro del modal.
  // Coexiste con el listener de booking.js: ambos salen temprano si su modal
  // está oculto.
  document.addEventListener('keydown', function (e) {
    var modal = document.getElementById('ebookGate');
    if (!modal || modal.classList.contains('eg-hidden')) return;
    if (e.key === 'Escape') { window.closeEbookGate(); return; }
    if (e.key !== 'Tab') return;
    var focusables = modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    var visible = Array.prototype.filter.call(focusables, function (el) {
      return el.offsetParent !== null;
    });
    if (!visible.length) return;
    var first = visible[0], last = visible[visible.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ===== Estilos autosuficientes (no dependen de Tailwind) =====
  function injectStyles() {
    if (document.getElementById('ebook-gate-styles')) return;
    var css =
      '.eg-modal{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.eg-modal.eg-hidden{display:none}' +
      '.eg-overlay{position:absolute;inset:0;background:rgba(15,23,42,.9);backdrop-filter:blur(8px)}' +
      '.eg-card{position:relative;background:#fff;width:100%;max-width:460px;border-radius:28px;' +
        'padding:32px 28px;box-shadow:0 25px 60px -15px rgba(15,23,42,.5);max-height:90vh;overflow-y:auto;' +
        'font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#0F172A}' +
      '.eg-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}' +
      '.eg-title{font-family:"Space Grotesk","Plus Jakarta Sans",system-ui,sans-serif;font-size:1.4rem;' +
        'font-weight:800;letter-spacing:-.02em;margin:0}' +
      '.eg-x{background:none;border:0;font-size:1.6rem;line-height:1;color:#94A3B8;cursor:pointer;padding:0 4px}' +
      '.eg-x:hover{color:#0F172A}' +
      '.eg-lead{font-size:.86rem;color:#64748B;margin:8px 0 20px;line-height:1.5}' +
      '.eg-row{display:flex;gap:10px}' +
      '.eg-row .eg-input{flex:1;min-width:0}' +
      '.eg-input{display:block;width:100%;box-sizing:border-box;padding:13px 15px;margin-bottom:10px;' +
        'background:#F8FAFC;border:1px solid #E2E8F0;border-radius:14px;font-size:.9rem;font-family:inherit;' +
        'color:#0F172A;outline:none;transition:border-color .15s ease}' +
      '.eg-input::placeholder{color:#94A3B8}' +
      '.eg-input:focus{border-color:#2563EB;background:#fff}' +
      '.eg-consent{display:flex;gap:10px;align-items:flex-start;margin:14px 0 4px;font-size:.72rem;' +
        'line-height:1.55;color:#64748B;cursor:pointer}' +
      '.eg-consent input{margin-top:2px;flex-shrink:0;width:15px;height:15px;accent-color:#2563EB;cursor:pointer}' +
      '.eg-consent a{color:#2563EB;text-decoration:underline}' +
      '.eg-error{color:#DC2626;font-size:.78rem;margin:10px 0 0;min-height:1em;font-weight:600}' +
      '.eg-submit{width:100%;margin-top:14px;padding:15px;background:#2563EB;color:#fff;border:0;' +
        'border-radius:14px;font-family:inherit;font-size:.9rem;font-weight:700;cursor:pointer;' +
        'transition:background .15s ease}' +
      '.eg-submit:hover:not(:disabled){background:#1D4ED8}' +
      '.eg-submit:disabled{opacity:.6;cursor:default}' +
      '@media (max-width:520px){.eg-card{padding:26px 20px;border-radius:22px}.eg-row{flex-direction:column;gap:0}}';
    var s = document.createElement('style');
    s.id = 'ebook-gate-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init() {
    injectStyles();
    var host = document.getElementById('ebook-gate');
    if (host) host.innerHTML = renderGateModal();
    var form = document.getElementById('egForm');
    if (form) form.addEventListener('submit', onSubmit);
    bindTriggers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
