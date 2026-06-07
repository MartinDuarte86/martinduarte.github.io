// Carrusel de diseños — dos modos:
// 1. initCarousel() → sección HTML existente (legacy, no se usa con el modal nuevo)
// 2. buildChatCarouselWidget() → burbuja inline dentro del chat
// 3. buildPreviewsCarouselWidget() → 3 nuevos diseños inline en el chat

import { renderPreviewInIframe, openPreviewModal } from './generator.js';

const MAX_SETS = 10;
let _carouselSets   = [];
let _currentIndex   = 0;
let _callbacks      = {};

// ─── Carga desde dsn/index.json ───────────────────────────────────────────────

async function loadDsnIndex() {
  console.log('[DSN] Cargando dsn/index.json...');
  try {
    const url = `/landing_page/dsn/index.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    console.log('[DSN] HTTP status:', res.status);
    if (!res.ok) {
      console.warn('[DSN] Error HTTP, retornando array vacío');
      return [];
    }
    const sets = await res.json();
    console.log('[DSN] Sets encontrados:', sets.length);
    if (!Array.isArray(sets) || sets.length === 0) return [];

    // Resolver file paths → html para cada template que no tenga html inline
    await Promise.all(
      sets.flatMap(set =>
        (set.templates || []).map(async tpl => {
          if (!tpl.html && tpl.file) {
            try {
              const r = await fetch(`/landing_page/${tpl.file}?t=${Date.now()}`, { cache: 'no-store' });
              if (r.ok) tpl.html = await r.text();
            } catch {}
          }
        })
      )
    );

    return sets;
  } catch (err) {
    console.error('[DSN] Error al cargar index.json:', err.message);
    return [];
  }
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr || '';
  }
}

// ─── Widget inline para el chat (diseños anteriores) ─────────────────────────

/**
 * Construye un widget de carrusel para insertar como burbuja en el chat.
 * @param {Array} sets - Array de sets del dsn/index.json
 * @param {{ onSelect: (preview) => void, onReject: () => void }} callbacks
 * @returns {HTMLElement}
 */
export function buildChatCarouselWidget(sets, { onSelect, onReject }) {
  // Aplanar todos los templates en una lista plana
  const items = [];
  sets.forEach(set => {
    (set.templates || []).forEach(tpl => {
      items.push({ set, tpl });
    });
  });

  if (items.length === 0) return null;

  let idx = 0;

  const widget = document.createElement('div');
  widget.className = 'chat-carousel-widget';

  widget.innerHTML = `
    <p class="ccw-intro">Tenés <strong>${items.length}</strong> diseño${items.length > 1 ? 's' : ''} anterior${items.length > 1 ? 'es' : ''}. ¿Alguno te conviene?</p>
    <div class="ccw-slides">
      <button class="ccw-arrow ccw-arrow--prev" type="button" aria-label="Anterior" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="ccw-viewport">
        <div class="ccw-track"></div>
      </div>
      <button class="ccw-arrow ccw-arrow--next" type="button" aria-label="Siguiente">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
    <div class="ccw-indicator">${idx + 1} / ${items.length}</div>
    <div class="ccw-actions">
      <button class="ccw-reject-btn btn-secondary" type="button">No me gusta ninguno →</button>
    </div>
  `;

  const track    = widget.querySelector('.ccw-track');
  const prevBtn  = widget.querySelector('.ccw-arrow--prev');
  const nextBtn  = widget.querySelector('.ccw-arrow--next');
  const indicator = widget.querySelector('.ccw-indicator');

  // Construir cards
  items.forEach(({ set, tpl }, i) => {
    const card = document.createElement('div');
    card.className = 'ccw-card';
    card.innerHTML = `
      <div class="ccw-label">${set.rubro || 'Diseño'} · ${formatDate(set.fecha)}</div>
      <div class="ccw-iframe-wrap">
        <iframe title="${tpl.name}" scrolling="no" loading="lazy"></iframe>
        <div class="ccw-overlay">
          <button class="btn-primary ccw-select-btn" type="button">Elegir este</button>
        </div>
      </div>
      <div class="ccw-card-name">${tpl.name}</div>
    `;

    const iframe = card.querySelector('iframe');
    if (tpl.html) renderPreviewInIframe(iframe, tpl.html);

    // Click en iframe → abrir preview modal
    card.querySelector('.ccw-iframe-wrap').addEventListener('click', (e) => {
      if (e.target.closest('.ccw-select-btn')) return;
      openPreviewModal(
        { name: tpl.name, description: '', html: tpl.html || '' },
        i,
        () => onSelect({ id: tpl.id, name: tpl.name, description: '', html: tpl.html || '' })
      );
    });

    card.querySelector('.ccw-select-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect({ id: tpl.id, name: tpl.name, description: '', html: tpl.html || '' });
    });

    track.appendChild(card);
  });

  function goTo(i) {
    idx = Math.max(0, Math.min(i, items.length - 1));
    track.style.transform = `translateX(-${idx * 100}%)`;
    indicator.textContent = `${idx + 1} / ${items.length}`;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === items.length - 1;
  }

  prevBtn.addEventListener('click', () => goTo(idx - 1));
  nextBtn.addEventListener('click', () => goTo(idx + 1));

  widget.querySelector('.ccw-reject-btn').addEventListener('click', () => {
    onReject();
  });

  goTo(0);
  return widget;
}

// ─── Widget inline para 3 nuevos diseños generados ────────────────────────────

/**
 * Construye el widget de los 3 diseños recién generados, para insertar en el chat.
 * @param {Array} previews - [{ name, description, html }]
 * @param {{ onSelect: (preview, index) => void }} callbacks
 * @returns {HTMLElement}
 */
export function buildPreviewsCarouselWidget(previews, { onSelect }) {
  if (!previews || previews.length === 0) return null;

  let idx = 0;

  const widget = document.createElement('div');
  widget.className = 'chat-carousel-widget chat-carousel-widget--new';

  widget.innerHTML = `
    <p class="ccw-intro">Generé <strong>${previews.length}</strong> diseño${previews.length > 1 ? 's' : ''} para tu marca. ¿Cuál te gusta más?</p>
    <div class="ccw-slides">
      <button class="ccw-arrow ccw-arrow--prev" type="button" aria-label="Anterior" disabled>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="ccw-viewport">
        <div class="ccw-track"></div>
      </div>
      <button class="ccw-arrow ccw-arrow--next" type="button" aria-label="Siguiente">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
    <div class="ccw-indicator">1 / ${previews.length}</div>
  `;

  const track    = widget.querySelector('.ccw-track');
  const prevBtn  = widget.querySelector('.ccw-arrow--prev');
  const nextBtn  = widget.querySelector('.ccw-arrow--next');
  const indicator = widget.querySelector('.ccw-indicator');

  previews.forEach((preview, i) => {
    const card = document.createElement('div');
    card.className = 'ccw-card';
    card.innerHTML = `
      <div class="ccw-iframe-wrap">
        <iframe title="${preview.name}" scrolling="no" loading="lazy"></iframe>
        <div class="ccw-overlay">
          <button class="btn-primary ccw-select-btn" type="button">Elegir este diseño</button>
        </div>
      </div>
      <div class="ccw-card-name">${preview.name}</div>
      ${preview.description ? `<p class="ccw-card-desc">${preview.description}</p>` : ''}
    `;

    const iframe = card.querySelector('iframe');
    if (preview.html) renderPreviewInIframe(iframe, preview.html);

    card.querySelector('.ccw-iframe-wrap').addEventListener('click', (e) => {
      if (e.target.closest('.ccw-select-btn')) return;
      openPreviewModal(preview, i, () => onSelect(preview, i));
    });

    card.querySelector('.ccw-select-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      onSelect(preview, i);
    });

    track.appendChild(card);
  });

  function goTo(i) {
    idx = Math.max(0, Math.min(i, previews.length - 1));
    track.style.transform = `translateX(-${idx * 100}%)`;
    indicator.textContent = `${idx + 1} / ${previews.length}`;
    prevBtn.disabled = idx === 0;
    nextBtn.disabled = idx === previews.length - 1;
  }

  prevBtn.addEventListener('click', () => goTo(idx - 1));
  nextBtn.addEventListener('click', () => goTo(idx + 1));

  goTo(0);
  return widget;
}

// ─── Export para initCarousel (mantiene compatibilidad) ────────────────────────

export async function initCarousel(callbacks) {
  _callbacks = callbacks || {};
  const sets = await loadDsnIndex();
  _carouselSets = sets;
  return sets.length > 0 ? sets : null;
}

export function refreshCarousel(newSets) {
  _carouselSets = newSets;
}
