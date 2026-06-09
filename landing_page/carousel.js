// Carrusel de diseños — dos modos:
// 1. buildChatCarouselWidget()     → diseños anteriores inline en el chat
// 2. buildPreviewsCarouselWidget() → 3 nuevos diseños inline en el chat
//
// Accesibilidad mobile:
//   - Botón de selección SIEMPRE visible (no requiere hover)
//   - Touch swipe para navegar entre cards
//   - Botón en footer de la card, no en overlay

import { renderPreviewInIframe, openPreviewModal } from './generator.js';

let _carouselSets = [];

async function loadDsnIndex() {
  try {
    const url = `/landing_page/dsn/index.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const sets = await res.json();
    if (!Array.isArray(sets) || sets.length === 0) return [];

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
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr || '';
  }
}

// ─── Touch swipe helper ───────────────────────────────────────────────────────

function addTouchSwipe(element, onSwipeLeft, onSwipeRight) {
  let startX = 0;
  let startY = 0;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    // Solo swipe horizontal (ignora scroll vertical)
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
  }, { passive: true });
}

// ─── Widget inline para diseños anteriores ────────────────────────────────────

export function buildChatCarouselWidget(sets, { onSelect, onReject }) {
  const items = [];
  sets.forEach(set => {
    (set.templates || []).forEach(tpl => items.push({ set, tpl }));
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

  const track     = widget.querySelector('.ccw-track');
  const prevBtn   = widget.querySelector('.ccw-arrow--prev');
  const nextBtn   = widget.querySelector('.ccw-arrow--next');
  const indicator = widget.querySelector('.ccw-indicator');

  items.forEach(({ set, tpl }, i) => {
    const card = document.createElement('div');
    card.className = 'ccw-card';
    // Botón siempre visible en el footer — no requiere hover ni overlay
    card.innerHTML = `
      <div class="ccw-label">${set.rubro || 'Diseño'} · ${formatDate(set.fecha)}</div>
      <div class="ccw-iframe-wrap" role="button" tabindex="0" aria-label="Ver preview de ${tpl.name}">
        <iframe title="${tpl.name}" scrolling="no" loading="lazy"></iframe>
        <div class="ccw-overlay" aria-hidden="true">
          <span class="ccw-zoom-hint">Tap para ver completo</span>
        </div>
      </div>
      <div class="ccw-card-footer">
        <span class="ccw-card-name">${tpl.name}</span>
        <button class="btn-primary ccw-select-btn" type="button" aria-label="Elegir diseño ${tpl.name}">Elegir este</button>
      </div>
    `;

    const iframe = card.querySelector('iframe');
    if (tpl.html) renderPreviewInIframe(iframe, tpl.html);

    const wrap = card.querySelector('.ccw-iframe-wrap');
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.ccw-select-btn')) return;
      openPreviewModal(
        { name: tpl.name, description: '', html: tpl.html || '' },
        i,
        () => onSelect({ id: tpl.id, name: tpl.name, description: '', html: tpl.html || '' })
      );
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wrap.click();
      }
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
  addTouchSwipe(widget.querySelector('.ccw-viewport'), () => goTo(idx + 1), () => goTo(idx - 1));

  widget.querySelector('.ccw-reject-btn').addEventListener('click', onReject);

  goTo(0);
  return widget;
}

// ─── Widget para 3 nuevos diseños generados ───────────────────────────────────

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

  const track     = widget.querySelector('.ccw-track');
  const prevBtn   = widget.querySelector('.ccw-arrow--prev');
  const nextBtn   = widget.querySelector('.ccw-arrow--next');
  const indicator = widget.querySelector('.ccw-indicator');

  previews.forEach((preview, i) => {
    const card = document.createElement('div');
    card.className = 'ccw-card';
    card.innerHTML = `
      <div class="ccw-iframe-wrap" role="button" tabindex="0" aria-label="Ver preview de ${preview.name}">
        <iframe title="${preview.name}" scrolling="no" loading="lazy"></iframe>
        <div class="ccw-overlay" aria-hidden="true">
          <span class="ccw-zoom-hint">Tap para ver completo</span>
        </div>
      </div>
      <div class="ccw-card-footer">
        <span class="ccw-card-name">${preview.name}</span>
        <button class="btn-primary ccw-select-btn" type="button" aria-label="Elegir diseño ${preview.name}">Elegir este diseño</button>
      </div>
      ${preview.description ? `<p class="ccw-card-desc">${preview.description}</p>` : ''}
    `;

    const iframe = card.querySelector('iframe');
    if (preview.html) renderPreviewInIframe(iframe, preview.html);

    const wrap = card.querySelector('.ccw-iframe-wrap');
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('.ccw-select-btn')) return;
      openPreviewModal(preview, i, () => onSelect(preview, i));
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wrap.click();
      }
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
  addTouchSwipe(widget.querySelector('.ccw-viewport'), () => goTo(idx + 1), () => goTo(idx - 1));

  goTo(0);
  return widget;
}

export async function initCarousel(callbacks) {
  const sets = await loadDsnIndex();
  _carouselSets = sets;
  return sets.length > 0 ? sets : null;
}

export function refreshCarousel(newSets) {
  _carouselSets = newSets;
}
