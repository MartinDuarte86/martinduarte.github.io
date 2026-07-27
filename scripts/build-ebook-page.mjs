/*
 * scripts/build-ebook-page.mjs — Genera la página de lectura de un ebook a
 * partir de su fuente en ebooks/_fuentes/.
 *
 * Correr con: npm run build:ebook   (y después npm run build:pdf)
 *
 * Por qué existe: el fuente que sale del editor NO es un documento HTML
 * completo — arranca en <meta charset> sin <!DOCTYPE>/<html>/<head>/<body> — y
 * tampoco trae @media print. Este script lo envuelve en el shell del sitio
 * (SEO/OG, canonical, AdSense, GA4+Clarity inlineados, link de vuelta y el gate
 * de descarga) y le agrega el CSS de impresión que consume build-ebook-pdf.mjs.
 *
 * A propósito NO se carga tailwind.css ni site.js en la página resultante: el
 * ebook tiene su propio :root, reset y tipografía (Fraunces + Inter). Ver el
 * comentario que queda embebido en el <head> del archivo generado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SRC = path.join(ROOT, 'ebooks/_fuentes/inteligencia-artificial.src.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

// Localizamos los límites en vez de hardcodearlos, para que el script no se
// rompa en silencio si el fuente se regenera con otra cantidad de líneas.
const styleStart = lines.findIndex(l => l.trim() === '<style>');
const styleEnd   = lines.findIndex(l => l.trim() === '</style>');
const bodyStart  = lines.findIndex(l => l.includes('================= PORTADA'));

if (styleStart < 0 || styleEnd < 0 || bodyStart < 0 || bodyStart < styleEnd) {
  throw new Error('No se pudieron ubicar el <style> y la portada en el fuente del ebook');
}

const style = lines.slice(styleStart, styleEnd + 1).join('\n').trimEnd();
const body  = lines.slice(bodyStart).join('\n').trimEnd();

// El <style> del ebook llega como "<style>...</style>". Le insertamos el bloque
// @media print (el original no tiene ninguno) justo antes del cierre.
const PRINT_CSS = `
  /* ---------- IMPRESION / PDF ----------
     El original no traia @media print. Estas reglas las consume
     scripts/build-ebook-pdf.mjs (Chromium print-to-PDF, A4, printBackground). */
  @media print{
    @page{size:A4; margin:0}
    .eb-back{display:none !important}
    .wrap{max-width:none; padding:26px 34px 34px}

    /* La portada ocupa su propia hoja completa: sin min-height se quedaba en
       ~61% del A4 y dejaba un tercio de la pagina 1 en blanco. */
    .cover{min-height:297mm; padding:0 48px; page-break-after:always; break-after:page;
           display:flex; align-items:center; justify-content:center}
    .cover .inner{max-width:none}

    /* Ningun titulo huerfano al pie de pagina. */
    h2.q, .mesa-num, .block h2, .prologo h2, .glosario h2, .cont h2, .toc .group{
      page-break-after:avoid; break-after:avoid}
    /* Cajas que se ven rotas si se parten entre dos hojas. */
    .ilustracion, .frase, .pensar, .autor, .glosario .row, .colofon, .creditos,
    .cta, .toc li, .cont li{page-break-inside:avoid; break-inside:avoid}
    .nodesep{margin:34px 0}
    a{color:inherit; text-decoration:none}
  }
`;
const styleWithPrint = style.replace(/<\/style>\s*$/, PRINT_CSS + '</style>');

const page = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Por fin vas a entender la Inteligencia Artificial — Ebook | Martín Duarte</title>
    <meta name="description" content="Ebook gratuito: qué es realmente la inteligencia artificial, cómo funciona por dentro y cómo usarla en tu día a día. Escrito sin tecnicismos, para quien arranca de cero.">
    <meta name="author" content="Martín Duarte">
    <meta name="robots" content="index, follow, max-image-preview:large">
    <meta name="theme-color" content="#0A1120">
    <link rel="canonical" href="https://martinduarte.com/ebooks/inteligencia-artificial/">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="Martín Duarte">
    <meta property="og:locale" content="es_AR">
    <meta property="og:title" content="Por fin vas a entender la Inteligencia Artificial — Ebook gratuito">
    <meta property="og:description" content="Qué es realmente la IA, cómo funciona por dentro y cómo usarla en tu día a día. Sin tecnicismos.">
    <meta property="og:url" content="https://martinduarte.com/ebooks/inteligencia-artificial/">
    <meta property="og:image" content="https://martinduarte.com/assets/martin-profile.jpg">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1594572872514423" crossorigin="anonymous"></script>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

    <!--
      ARCHIVO GENERADO — no editar a mano.
      Se genera con "npm run build:ebook" (scripts/build-ebook-page.mjs) a partir
      de ebooks/_fuentes/inteligencia-artificial.src.html. Cualquier cambio va en
      el fuente o en el script; editar acá se pierde en la próxima corrida.
      Después de regenerar: "npm run build:pdf", o el PDF queda desincronizado.

      NO cargar /assets/css/tailwind.css ni /assets/js/site.js en esta página.
      El ebook trae su propio :root, su reset y su tipografía (Fraunces + Inter);
      el Preflight de Tailwind y las reglas sin scope de input.css
      (body{font-family:'Plus Jakarta Sans'}, h1..h4{font-family:'Space Grotesk'})
      pisarían los titulares del ebook. Por eso el nav del sitio se reemplaza acá
      por el link fijo .eb-back de abajo, estilado en el vocabulario del ebook,
      y GA4 + Clarity van inlineados (site.js normalmente los carga).

      El PDF de esta página se genera con: npm run build:pdf
      Si editás este archivo, volvé a correrlo o el PDF queda desincronizado.
    -->
${styleWithPrint}

<style>
  /* Vuelta al sitio: única pieza de chrome, en el lenguaje visual del ebook. */
  .eb-back{position:fixed; top:16px; left:16px; z-index:50; display:inline-flex; align-items:center;
    gap:7px; padding:9px 16px; border-radius:999px; background:rgba(255,255,255,.92);
    backdrop-filter:blur(8px); border:1px solid var(--line); color:var(--blue);
    font-family:'Inter',system-ui,sans-serif; font-size:12px; font-weight:600;
    text-decoration:none; box-shadow:0 6px 20px -8px rgba(15,23,42,.35)}
  .eb-back:hover{background:#fff; border-color:var(--blue-line)}

  /* CTA de descarga al pie (pasa por el gate de ebooks.js). */
  .eb-cta{margin:48px 0 0; padding:30px 26px; background:var(--blue-soft);
    border:1px solid var(--blue-line); border-radius:20px; text-align:center}
  .eb-cta p{margin:0 0 18px; font-size:15px; color:var(--ink-soft)}
  .eb-cta button{padding:14px 28px; background:var(--blue); color:#fff; border:0; border-radius:12px;
    font-family:'Inter',system-ui,sans-serif; font-size:13px; font-weight:700; cursor:pointer}
  .eb-cta button:hover{background:var(--blue-2)}
  @media print{.eb-cta{display:none}}

  @media (max-width:520px){
    .eb-back{top:10px; left:10px; padding:8px 13px; font-size:11px}
  }
</style>
</head>
<body>

<a href="/ebooks/" class="eb-back" data-ev="click_ebook_volver" data-ev-label="inteligencia-artificial">
  <span aria-hidden="true">←</span> Volver a Ebooks
</a>

${body}

<div class="wrap" style="padding-top:0">
  <div class="eb-cta">
    <p>¿Querés tenerlo siempre a mano? Descargalo en PDF.</p>
    <button type="button"
            data-ebook-action="descargar"
            data-ebook-slug="inteligencia-artificial"
            data-ebook-href="/ebooks/inteligencia-artificial/por-fin-vas-a-entender-la-ia.pdf"
            data-ev="click_ebook_descargar" data-ev-label="lector-ia">
      Descargar el PDF
    </button>
  </div>
</div>

<div id="ebook-gate"></div>
<script src="/assets/js/ebooks.js" defer></script>

<!-- GA4 + Clarity inlineados: esta página no carga site.js (ver comentario del head). -->
<script>
  (function(){
    var GA4_ID='G-5WNB92WRGM', CLARITY_ID='xgn3x9yg9x';
    var ga=document.createElement('script');
    ga.async=true; ga.src='https://www.googletagmanager.com/gtag/js?id='+GA4_ID;
    document.head.appendChild(ga);
    window.dataLayer=window.dataLayer||[];
    window.gtag=function(){window.dataLayer.push(arguments);};
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID);
    (function(c,l,a,r,i){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments);};
      var t=l.createElement(r); t.async=1; t.src='https://www.clarity.ms/tag/'+i;
      var y=l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t,y);
    })(window,document,'clarity','script',CLARITY_ID);
    // Misma delegación de eventos que site.js, para los data-ev de esta página.
    document.addEventListener('click', function(e){
      var el=e.target.closest('[data-ev]');
      if(el && typeof window.gtag==='function'){
        window.gtag('event', el.dataset.ev, { label: el.dataset.evLabel || '' });
      }
    });
  })();
</script>
</body>
</html>
`;

const outPath = path.join(ROOT, 'ebooks/inteligencia-artificial/index.html');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, page, 'utf8');
console.log(`✓ ebooks/inteligencia-artificial/index.html (${(page.length / 1024).toFixed(0)} KB)`);
console.log('  Ahora corré: npm run build:pdf');
