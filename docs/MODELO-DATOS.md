# Modelo de datos — Creator-LandingPage

Dos sistemas de almacenamiento con roles distintos. Esquema fuente:
`supabase/001_initial_schema.sql` y `supabase/002_design_sets_vendido.sql`.

## Supabase (Postgres) — registro durable

### `clients` — una fila por sesión/cliente
- `id` UUID PK (`gen_random_uuid()`) — usado como FK desde `design_sets`.
- `session_id` TEXT **UNIQUE** — llave de negocio de la sesión.
- `email`, `nombre_marca`, `rubro`, `template_elegido`.
- `estado` — máquina de estados:
  `iniciado → evaluando → onboarding → diseños_generados → pago_pendiente →
  pagado → aprobado/rechazado`.
- `mp_external_reference` — para matchear pagos de MP.
- `full_brief` JSONB — todo el brief recolectado. **Estructura plana, no anidada**:
  `notify.js` y `chat.js` deben coincidir en esta forma.
- `created_at`, `updated_at` (trigger auto).

### `design_sets` — todos los diseños generados (no solo el comprado)
- `id` UUID PK.
- `client_id` UUID FK → `clients.id` (`ON DELETE SET NULL`).
- `session_id` TEXT, `rubro`, `template_name`.
- `html_preview` TEXT — HTML del diseño. Vive en Redis mientras la sesión está
  activa (48h) y se persiste acá después, para el carrusel. **Riesgo de escala**:
  el schema anota migrar a Blob/R2 en v2 (ver backlog y Fase 4).
- `vendido` BOOLEAN (migración 002) — marca el comprado en vez de duplicar filas.
- `thumbnail_url`, `visible_en_carousel`, `created_at`.

RLS **desactivado** en ambas tablas: el acceso es solo server-side con la
service-role key.

## Redis (Upstash) — efímero, scratch con TTL

Llaves principales (definidas en `api/_lib/redis.js`):

| Llave | Contenido | TTL |
|---|---|---|
| `session:<id>:brief` | brief de la sesión | 48h |
| `session:<id>:meta` | fase, progreso, updatedAt | 48h |
| `session:<id>:messages` | historial (lpush + ltrim 100) | 48h |
| `session:<id>:previews` | previews generados | 48h |
| `session:<id>:last_activity` | detección de abandono | 2h |
| `session:<id>:cost` | costo acumulado en USD | 48h |
| `sessions:open` | SET de sesiones abiertas (barrido cron) | sin TTL ⚠️ |
| `rubro-cache:<rubro>:<template>` | HTML cacheado por rubro | 24h |
| `ratelimit:<intent>:<ip>` | contador de rate limit | según intent |
| `token:used:<hash>` | uso único de tokens JWT | 48h |

⚠️ `sessions:open` no tiene TTL — riesgo de crecimiento si el cron falla. Mitigación
planeada en Fase 4 (migrar a ZSET con limpieza por score).

## Datos legacy eliminados (Fase 0)

Reemplazados por las tablas de arriba y removidos del repo:
- `landing_page/data/clientes.json` → tabla `clients`.
- `landing_page/dsn/*` y `landing_page/previews/index.json` → tabla `design_sets`.

El mock de tests replica el contrato de estas tablas **in-memory** (sin tocar
archivos), así que no quedó dependencia de los archivos legacy.
