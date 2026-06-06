// Mejora 4 — Carrusel de diseños guardados desde dsn/index.json
import { renderPreviewInIframe, openPreviewModal } from './generator.js';

const MAX_SETS = 10;
let _carouselSets = [];
let _currentIndex = 0;
let _callbacks = {};

async function loadDsnIndex() {
  try {
    const res = await fetch('/landing_page/dsn/index.json', { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
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

function buildSkeletonCard() {
  const el = document.createElement('div');
  el.className = 'carousel-item';
  el.innerHTML = `
    <div class="skeleton-card">
      <div class="skeleton-iframe-wrap"></div>
      <div class="skeleton-info">
        <div class="skeleton-line"></div>
        <div class="skeleton-line skeleton-line--short"></div>
      </div>
    </div>`;
  return el;
}

function buildCarouselCard(set, templateIndex, onSelect) {
  const tpl = set.templates[templateIndex];
  if (!tpl) return null;

  const item = document.createElement('div');
  item.className = 'carousel-item';
  item.setAttribute('role', 'listitem');

  const label = document.createElement('div');
  label.className = 'carousel-item-label';
  label.textContent = `${set.rubro || 'Diseño'} · ${formatDate(set.fecha)}`;
  item.appendChild(label);

  const card = document.createElement('div');
  card.className = 'preview-card';
  card.style.cursor = 'pointer';

  const iframeId = `carousel-iframe-${set.id}-${templateIndex}`;
  card.innerHTML = `
    <div class="preview-iframe-wrap">
      <iframe id="${iframeId}" title="${tpl.name}" scrolling="no"></iframe>
      <div class="preview-overlay">
        <button class="select-preview-btn btn-primary" type="button">Elegir este diseño</button>
      </div>
    </div>
    <div class="preview-info">
      <h3>${tpl.name}</h3>
    </div>`;
  item.appendChild(card);

  const iframe = card.querySelector('iframe');
  if (tpl.html) {
    renderPreviewInIframe(iframe, tpl.html);
  }

  // Clic en card: abrir modal (Mejora 2)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.select-preview-btn')) {
      openPreviewModal(
        { name: tpl.name, description: '', html: tpl.html || '' },
        templateIndex,
        () => onSelect({ id: tpl.id, name: tpl.name, description: '', html: tpl.html || '' })
      );
    }
  });

  card.querySelector('.select-preview-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect({ id: tpl.id, name: tpl.name, description: '', html: tpl.html || '' });
  });

  return item;
}

function renderCarousel(sets, onSelectFromCarousel) {
  const track = document.getElementById('carousel-track');
  if (!track) return;
  track.innerHTML = '';

  sets.forEach((set) => {
    set.templates.forEach((_, ti) => {
      const card = buildCarouselCard(set, ti, onSelectFromCarousel);
      if (card) track.appendChild(card);
    });
  });

  updateIndicator();
  updateArrows();
}

function updateIndicator() {
  const track = document.getElementById('carousel-track');
  const indicator = document.getElementById('carousel-indicator');
  if (!track || !indicator) return;

  const items = track.querySelectorAll('.carousel-item');
  const total = items.length;
  if (total === 0) { indicator.textContent = ''; return; }

  // Detectar cuántos son visibles
  const visible = getVisibleCount();
  const current = Math.min(_currentIndex + 1, total);
  indicator.textContent = `${current} / ${total}`;
}

function getVisibleCount() {
  const track = document.getElementById('carousel-track');
  if (!track) return 1;
  const w = track.clientWidth;
  if (w >= 700) return 3;
  if (w >= 400) return 2;
  return 1;
}

function updateArrows() {
  const track = document.getElementById('carousel-track');
  const prev  = document.getElementById('carousel-prev');
  const next  = document.getElementById('carousel-next');
  if (!track || !prev || !next) return;

  const items  = track.querySelectorAll('.carousel-item');
  const total  = items.length;
  const visible = getVisibleCount();

  prev.disabled = _currentIndex <= 0;
  next.disabled = _currentIndex >= total - visible;
}

function scrollToIndex(index) {
  const track = document.getElementById('carousel-track');
  if (!track) return;

  const items = track.querySelectorAll('.carousel-item');
  if (items.length === 0) return;

  _currentIndex = Math.max(0, Math.min(index, items.length - 1));
  items[_currentIndex]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  updateIndicator();
  updateArrows();
}

async function generateNewSets() {
  const track = document.getElementById('carousel-track');
  if (!track) return;

  // Mostrar skeletons
  const skeletons = [buildSkeletonCard(), buildSkeletonCard(), buildSkeletonCard()];
  skeletons.forEach(s => track.appendChild(s));
  scrollToIndex(_currentIndex);

  // Disparar generación nueva (delegar al callback)
  if (_callbacks.onGenerateNew) {
    await _callbacks.onGenerateNew();
  }

  // Remover skeletons
  skeletons.forEach(s => s.remove());
}

export async function initCarousel(callbacks) {
  _callbacks = callbacks || {};

  const sets = await loadDsnIndex();
  _carouselSets = sets;

  if (!sets.length) return; // Primera visita: sin carrusel

  const section = document.getElementById('carousel-section');
  if (!section) return;

  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  renderCarousel(sets, callbacks.onSelectFromCarousel || (() => {}));

  document.getElementById('carousel-prev')?.addEventListener('click', () => {
    scrollToIndex(_currentIndex - getVisibleCount());
  });

  document.getElementById('carousel-next')?.addEventListener('click', () => {
    scrollToIndex(_currentIndex + getVisibleCount());
  });

  document.getElementById('carousel-gen-new')?.addEventListener('click', () => {
    generateNewSets();
  });
}

export function refreshCarousel(newSets) {
  _carouselSets = newSets;
  renderCarousel(newSets, _callbacks.onSelectFromCarousel || (() => {}));
}
