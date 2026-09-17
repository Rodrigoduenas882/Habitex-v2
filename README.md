# Habitex V2 — Frontend

SaaS de administración de arriendos. Este paquete contiene el Frontend:
autenticación real contra Supabase (login, logout, restauración de sesión),
el Dashboard visual (datos de ejemplo, sin integraciones de negocio
todavía) y la infraestructura de sesión/tema.

## Stack

React · Vite · TypeScript (strict) · React Router · TanStack Query ·
React Hook Form · Zod · Supabase JS · Vitest · React Testing Library ·
Playwright. Gestor de paquetes: pnpm.

## Setup

```bash
pnpm install
cp .env.example .env   # completa con las credenciales de tu proyecto Supabase
```

## Scripts

| Script              | Descripción                                   |
| ------------------- | ---------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo                         |
| `pnpm build`        | Type-check + build de producción               |
| `pnpm preview`      | Sirve el build de producción localmente        |
| `pnpm lint`         | ESLint                                         |
| `pnpm typecheck`    | Type-check sin build                           |
| `pnpm test`         | Vitest (unit/integration)                      |
| `pnpm test:watch`   | Vitest en modo watch                           |
| `pnpm test:e2e`     | Playwright (build con env de prueba + preview) |

## Arquitectura

Feature-first bajo `src/`:

- `app/` — bootstrap, providers, router, layouts.
- `features/<feature>/` — dominio/aplicación/infraestructura/presentación
  solo cuando la responsabilidad lo justifica.
- `infrastructure/supabase/` — único punto de contacto directo con Supabase.
- `shared/` — componentes, hooks, lib y utilidades transversales.

React nunca llama a Supabase directamente: toda operación remota pasa por un
repository/adapter en `infrastructure/`.
