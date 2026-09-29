/*
 * site.js — Única fuente de verdad de los elementos compartidos del sitio de
 * marketing (martinduarte.com): navegación, footer, botón flotante de WhatsApp,
 * analítica (GA4 + Microsoft Clarity) y helper de datos estructurados JSON-LD.
 *
 * Cada página incluye los contenedores vacíos y este script los puebla:
 *   <div id="site-nav"></div>
 *   <div id="site-footer"></div>
 *   <div id="site-whatsapp"></div>
 *   <div id="site-booking"></div>   (lo puebla booking.js)
 *
 * y al final del <body>:
 *   <script src="/assets/js/site.js" defer></script>
 *   <script src="/assets/js/booking.js" defer></script>
 *
 * IMPORTANTE: no toca api/ ni landing_page/. Solo el sitio de marketing.
 */
(function () {
  'use strict';

  // ===== Parámetros a cargar (reemplazar por los reales; hay guarda) =====
  var WHATSAPP_NUMBER = '541123797308';            // +54 11 2379-7308
  var GA4_ID = 'G-5WNB92WRGM';                     // GA4 Measurement ID
  var CLARITY_ID = 'xgn3x9yg9x';                   // Microsoft Clarity Project ID

  var WHATSAPP_PLACEHOLDER = '5490000000000';

  // ===== Los 5 pilares (orden = orden del menú) =====
  var PILARES = [
    { nombre: 'Arquitectura de Datos',   slug: 'arquitectura-de-datos',   icono: '📊' },
    { nombre: 'Inteligencia Artificial', slug: 'inteligencia-artificial', icono: '🤖' },
    { nombre: 'Automatizaciones',        slug: 'automatizaciones',        icono: '⚡' },
    { nombre: 'Tienda Nube',             slug: 'tienda-nube',             icono: '🛒' },
    { nombre: 'Desarrollo Web',          slug: 'desarrollo-web',          icono: '⚙️' }
  ];

  // ===== Analítica (se cargan una sola vez, con guarda de placeholder) =====
  function loadAnalytics() {
    if (GA4_ID && GA4_ID !== 'G-XXXXXXXXXX') {
      var ga = document.createElement('script');
      ga.async = true;
      ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
      document.head.appendChild(ga);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_ID);
    }
    if (CLARITY_ID && CLARITY_ID !== 'CLARITY_PROJECT_ID') {
      (function (c, l, a, r, i) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        var t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        var y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY_ID);
    }
  }

  // Delegación global de eventos de analítica (T20). Marcar CTAs con
  // data-ev="click_agendar" (y opcional data-ev-label="...").
  function bindAnalyticsEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-ev]');
      if (el && typeof window.gtag === 'function') {
        window.gtag('event', el.dataset.ev, { label: el.dataset.evLabel || '' });
      }
    });
  }

  // ===== Nav =====
  function renderNav(activeSlug) {
    var dd = PILARES.map(function (p) {
      var active = p.slug === activeSlug;
      return '<a href="/servicios/' + p.slug + '/" class="nav-dd-link' +
        (active ? ' nav-dd-link--active' : '') + '">' +
        '<span aria-hidden="true">' + p.icono + '</span> ' + p.nombre + '</a>';
    }).join('');

    // Los ebooks no son un pilar de servicio: son un recurso propio, y por eso
    // la entrada vive fuera del dropdown de Servicios. `data-pilar="ebooks"` en
    // el <body> de /ebooks/** la marca como activa.
    var ebooksActive = activeSlug === 'ebooks';
    // La tienda (/tienda/) es la puerta de entrada al e-commerce en
    // shop.martinduarte.com (Shopify). `data-pilar="tienda"` la marca activa.
    var tiendaActive = activeSlug === 'tienda';

    return '' +
      '<header>' +
      '<nav class="fixed w-full z-50 px-6 py-5" aria-label="Principal">' +
        '<div class="max-w-7xl mx-auto flex items-center justify-between bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-full px-6 md:px-8 py-3.5 shadow-sm">' +
          '<a href="/" class="font-heading font-bold tracking-tighter text-lg flex items-center gap-2" aria-label="Volver al inicio">' +
            '<span class="text-blue-600" aria-hidden="true">←</span> MARTIN<span class="text-blue-600 font-black">DUARTE</span>' +
          '</a>' +
          '<div class="hidden md:flex items-center gap-8 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">' +
            '<a href="/ebooks/" class="' + (ebooksActive ? 'text-blue-600' : 'hover:text-blue-600') +
              ' transition-colors" data-ev="click_ebooks" data-ev-label="nav">Ebooks</a>' +
            '<a href="/tienda/" class="' + (tiendaActive ? 'text-blue-600' : 'hover:text-blue-600') +
              ' transition-colors" data-ev="click_tienda" data-ev-label="nav">Tienda</a>' +
            '<div class="nav-wrap relative">' +
              '<button type="button" class="flex items-center gap-1.5 hover:text-blue-600 transition-colors uppercase tracking-[0.18em]" aria-haspopup="true" aria-expanded="false">Servicios' +
                '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>' +
              '</button>' +
              '<div class="nav-dd absolute left-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-2">' + dd + '</div>' +
            '</div>' +
            '<a href="/#sobre-mi" class="hover:text-blue-600 transition-colors">Sobre mí</a>' +
            '<a href="/#contacto" class="hover:text-blue-600 transition-colors">Contacto</a>' +
          '</div>' +
          '<div class="flex items-center gap-2">' +
            // En mobile los links de arriba se ocultan: la tienda queda a un toque.
            '<a href="/tienda/" class="nav-tienda-m" aria-label="Tienda" title="Tienda" data-ev="click_tienda" data-ev-label="nav-mobile">' +
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/></svg>' +
            '</a>' +
            '<button type="button" onclick="openBooking()" data-ev="click_agendar" data-ev-label="nav" class="text-[10px] font-black bg-slate-900 text-white px-5 py-3 rounded-full hover:bg-blue-600 transition-all uppercase tracking-widest">Agendar reunión</button>' +
          '</div>' +
        '</div>' +
      '</nav>' +
      '</header>';
  }

  // ===== Footer (navegación secundaria / legal) =====
  function renderFooter() {
    var links = PILARES.map(function (p) {
      return '<a href="/servicios/' + p.slug + '/" class="hover:text-blue-600 transition-colors">' + p.nombre + '</a>';
    }).join('');
    return '' +
      '<footer class="border-t border-slate-200 mt-24 py-12 px-6">' +
        '<div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-8">' +
          '<div class="space-y-2">' +
            '<a href="/" class="font-heading font-bold tracking-tighter text-base flex items-center gap-2"><span class="text-blue-600" aria-hidden="true">←</span> MARTINDUARTE</a>' +
            '<p class="text-[10px] font-black uppercase tracking-widest text-slate-400">© 2026 Martín Duarte · Enterprise Data Strategy</p>' +
          '</div>' +
          '<nav class="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold text-slate-500" aria-label="Servicios">' + links + '</nav>' +
          '<div class="flex gap-4 text-[11px] font-black uppercase text-slate-500">' +
            '<a href="/ebooks/" class="hover:text-blue-600" data-ev="click_ebooks" data-ev-label="footer">Ebooks</a>' +
            '<a href="/tienda/" class="hover:text-blue-600" data-ev="click_tienda" data-ev-label="footer">Tienda</a>' +
            '<a href="https://linkedin.com/in/martinduarte" target="_blank" rel="noopener noreferrer" class="hover:text-blue-600">LinkedIn</a>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  // ===== WhatsApp flotante (acompaña el scroll) =====
  function renderWhatsApp() {
    var href = (WHATSAPP_NUMBER && WHATSAPP_NUMBER !== WHATSAPP_PLACEHOLDER)
      ? 'https://wa.me/' + WHATSAPP_NUMBER + '?text=Hola%20Mart%C3%ADn'
      : '#';
    var guard = (href === '#')
      ? ' onclick="return false" title="WhatsApp pendiente de configurar"'
      : '';
    return '' +
      '<a href="' + href + '"' + guard + ' target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp" data-ev="open_whatsapp"' +
        ' style="position:fixed;right:22px;top:50%;transform:translateY(-50%);z-index:60;width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px -6px rgba(37,211,102,.6)">' +
        '<svg width="30" height="30" viewBox="0 0 32 32" fill="#fff" aria-hidden="true"><path d="M16.04 4C9.9 4 4.92 8.98 4.92 15.12c0 2.03.55 3.99 1.58 5.72L4.5 27.5l6.83-1.96a11.1 11.1 0 0 0 4.71 1.06h.01c6.14 0 11.12-4.98 11.12-11.12C27.18 8.98 22.18 4 16.04 4Zm0 20.36h-.01c-1.5 0-2.98-.4-4.27-1.17l-.31-.18-3.63 1.04.97-3.54-.2-.32a9.2 9.2 0 0 1-1.41-4.87c0-5.1 4.15-9.24 9.26-9.24 2.47 0 4.79.96 6.54 2.71a9.2 9.2 0 0 1 2.71 6.54c0 5.1-4.15 9.25-9.26 9.25Zm5.08-6.92c-.28-.14-1.65-.81-1.9-.9-.26-.1-.44-.14-.63.14-.18.28-.72.9-.88 1.09-.16.18-.32.21-.6.07-.28-.14-1.18-.43-2.24-1.38-.83-.74-1.39-1.65-1.55-1.93-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.49.14-.16.18-.28.28-.46.09-.18.05-.35-.02-.49-.07-.14-.63-1.51-.86-2.07-.23-.55-.46-.47-.63-.48l-.54-.01c-.18 0-.49.07-.75.35-.26.28-.98.96-.98 2.33 0 1.37 1 2.7 1.14 2.88.14.18 1.97 3.01 4.78 4.22.67.29 1.19.46 1.6.59.67.21 1.28.18 1.76.11.54-.08 1.65-.67 1.89-1.33.23-.65.23-1.21.16-1.33-.07-.12-.25-.18-.53-.32Z"/></svg>' +
      '</a>';
  }

  // ===== Helper JSON-LD por página (T3) =====
  // injectSchema({ tipo, nombre, descripcion, url, breadcrumb:[{name,url}], faqs:[{q,a}] })
  function injectSchema(opts) {
    opts = opts || {};
    var graph = [];

    graph.push({
      '@type': opts.tipo || 'Service',
      '@id': (opts.url || '') + '#service',
      name: opts.nombre,
      description: opts.descripcion,
      url: opts.url,
      provider: { '@id': 'https://martinduarte.com/#martin' },
      areaServed: opts.areaServed || 'AR',
      audience: (opts.audience || []).map(function (a) {
        return { '@type': 'Audience', audienceType: a };
      })
    });

    if (opts.breadcrumb && opts.breadcrumb.length) {
      graph.push({
        '@type': 'BreadcrumbList',
        itemListElement: opts.breadcrumb.map(function (b, i) {
          return { '@type': 'ListItem', position: i + 1, name: b.name, item: b.url };
        })
      });
    }

    if (opts.faqs && opts.faqs.length) {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: opts.faqs.map(function (f) {
          return {
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a }
          };
        })
      });
    }

    var node = document.createElement('script');
    node.type = 'application/ld+json';
    node.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    document.head.appendChild(node);
  }

  // ===== Bootstrap =====
  function mount(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function injectNavStyles() {
    var css =
      '.nav-wrap:hover .nav-dd,.nav-wrap:focus-within .nav-dd{opacity:1;visibility:visible;transform:translateY(0)}' +
      '.nav-dd{opacity:0;visibility:hidden;transform:translateY(8px);transition:all .2s ease;z-index:100}' +
      '.nav-dd-link{display:block;padding:.55rem .75rem;border-radius:.9rem;color:#475569;font-size:.72rem;font-weight:700;text-transform:none;letter-spacing:normal;text-decoration:none;transition:background .2s ease}' +
      '.nav-dd-link:hover{background:#f1f5f9;color:#0f172a}' +
      '.nav-dd-link--active{background:#eff6ff;color:#1d4ed8}' +
      // Link a la tienda visible solo en mobile (md:hidden no está compilado en tailwind.css).
      '.nav-tienda-m{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:2.25rem;height:2.25rem;border-radius:9999px;background:#eff6ff;color:#2563eb}' +
      '@media (min-width:768px){.nav-tienda-m{display:none}}';
    var s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init() {
    injectNavStyles();
    var activeSlug = document.body.getAttribute('data-pilar') || '';
    mount('site-nav', renderNav(activeSlug));
    mount('site-footer', renderFooter());
    mount('site-whatsapp', renderWhatsApp());
    loadAnalytics();
    bindAnalyticsEvents();
  }

  // Exponer para las páginas
  window.MDSite = {
    PILARES: PILARES,
    injectSchema: injectSchema,
    renderNav: renderNav,
    renderFooter: renderFooter,
    renderWhatsApp: renderWhatsApp
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
