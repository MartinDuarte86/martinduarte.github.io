/** @type {import('tailwindcss').Config} */
module.exports = {
  // Escanea el HTML de todas las páginas y los .js que generan markup con
  // clases (site.js/booking.js inyectan nav/footer/modal). Si algo pierde estilo,
  // casi siempre es una ruta faltante acá: agregarla y recompilar (build:css).
  content: [
    './index.html',
    './servicios/**/*.html',
    './ebooks/**/*.html',
    './assets/js/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'sans-serif']
      }
    }
  },
  plugins: []
};
