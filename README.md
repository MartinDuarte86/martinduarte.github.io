# Creator-LandingPage

Sitio personal de Martín Duarte (`martinduarte.com`) + un servicio productizado y
mayormente automatizado de **generación de landing pages**: el cliente describe su
negocio en una webapp conversacional, un wizard con LLM recolecta un brief, genera
3 previews HTML, el cliente elige y paga, y —tras la aprobación de Martín vía un
link emailado— el diseño elegido se despliega automáticamente a `clientes/<slug>/`.

Sin build step / bundler / framework: frontend HTML/CSS/JS vanilla; backend =
funciones serverless de Vercel bajo `api/`.

## Arranque rápido

```bash
npm install
node mock-server.js        # → http://localhost:3000/landing_page/  (LLM mockeado, sin API keys)
```

## Comandos

```bash
npm test                   # unit (Jest)
npm run test:integration   # integración (Redis/Supabase reales, requiere .env)
npm run test:e2e           # E2E (Playwright contra el mock)
npm run test:all           # unit + integración + e2e
```

Un solo test: `npx jest __tests__/api/claude.test.js` · `npx playwright test e2e/03-diseno-nuevo.spec.js`

## Estructura

```
landing_page/   Frontend del wizard conversacional (chat, generación, carrusel, modal)
api/            Funciones serverless de Vercel (proxy LLM, sesión, clientes, aprobación)
api/_lib/       Lógica compartida (redis, supabase, cors)
supabase/       Esquema SQL (clients, design_sets)
clientes/       Landing pages de clientes desplegadas (estáticas, versionadas)
brochures/      Brochures de servicios (HTML + PDF)
__tests__/      Tests unit / integración / resiliencia / seguridad
e2e/            Tests E2E (Playwright) + smoke/seguridad en vivo
docs/           Documentación técnica (ver docs/README.md)
```

## Documentación

- **Técnica** (arquitectura, modelo de datos, patrón de desarrollo, backlog):
  [`docs/`](docs/README.md).
- **Operativa del agente** (comandos, gotchas, restricciones de marca): `CLAUDE.md`.
- **Funcional / negocio** (servicio, flujo, pricing, políticas, métricas): base de
  conocimiento central en Drive →
  `…\0001-Marca personal\Herramientas\Creator-LandingPage`.
