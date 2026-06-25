# docs/ — Documentación técnica (versionada)

Documentación **técnica** del proyecto, versionada junto al código. La
documentación **funcional/de negocio** vive en la base de conocimiento central de
Drive (ver más abajo).

## Índice

- [ARQUITECTURA.md](ARQUITECTURA.md) — componentes, frontend, backend, deploy, mock.
- [MODELO-DATOS.md](MODELO-DATOS.md) — tablas Supabase, llaves Redis, datos legacy.
- [PATRON-DESARROLLO.md](PATRON-DESARROLLO.md) — el patrón único a respetar.
- [backlog.md](backlog.md) — ideas y tareas a futuro fuera del MVP.

## Dónde vive cada cosa

| Tipo de información | Lugar |
|---|---|
| Técnica (arquitectura, modelo de datos, patrón, runbooks, ADRs) | este `docs/` (repo) |
| Funcional / negocio (servicio, flujo, pricing, políticas, métricas) | KB de Drive (abajo) |
| Guía operativa del agente (comandos, gotchas, reglas) | `CLAUDE.md` (raíz) |

## Base de conocimiento central (Drive)

`G:\Mi unidad\Nueva carpeta\Mint to martin\0001-Marca personal\Herramientas\Creator-LandingPage`

Repositorio único de conocimiento del proyecto. Estructura: `funcional/`,
`tecnica/`, `operacion/`. Toda doc funcional relevante se actualiza ahí; lo técnico
se mantiene acá y se referencia desde la KB. `CLAUDE.md` indexa ambos.
