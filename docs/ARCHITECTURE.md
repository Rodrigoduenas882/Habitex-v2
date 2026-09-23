# Habitex — ARCHITECTURE.md

Fuente de verdad técnica de Habitex: describe la arquitectura del frontend
que vive en este repositorio y la dirección arquitectónica del producto.
Toda regla cita el código que la respalda.

> **Alcance de este repo.** Este repositorio contiene el frontend y, desde
> el baseline de `2026-09-22`, el historial versionado de migrations SQL de
> Supabase (`supabase/migrations/`) — ver §0.1. El *contenido* de esas
> migrations (schema, políticas RLS, funciones RPC) sigue gestionándose y
> aplicándose fuera de este repo: aquí solo vive el registro versionado, no
> el mecanismo de ejecución contra producción. Que esta auditoría solo
> pueda observar el uso de Supabase Auth desde el código de `src/`
> **no significa que Habitex "solo tenga Supabase Auth"** como backend;
> significa que es lo único verificable desde el código de aplicación. Ver
> §0.

---

## 0. Qué es observable, qué es el backend actual, qué es evolución

Para no mezclar "lo que puedo probar leyendo este repo" con "cómo es el
producto":

**A. Observable desde este repositorio (frontend):**
Supabase Auth (`getSession`, `signInWithPassword`, `onAuthStateChange`,
`signOut`) es la única superficie de Supabase que el código de `src/` toca.
No hay lectura/escritura de tablas, RPC, Storage ni Edge Functions en
`src/`. `supabase/migrations/` (ver §0.1) sí vive en este repo, pero es
historial versionado de schema/RLS/RPC — no código de aplicación, y no
implica que `src/` llame a Supabase más allá de Auth.

**B. Backend actual del producto** (fuera del alcance de `src/`, pero
real): Supabase como plataforma — Auth, PostgreSQL, RLS, RPC, Storage, Edge
Functions. El contenido de las migrations (§0.1) documenta ese schema tal
como fue aplicado; su *aplicación* contra el proyecto real sigue siendo un
paso manual fuera de este repo (Supabase CLI local, gate humano explícito
por migration — ver §0.1). Este documento no describe políticas RLS
específicas en prosa porque el propio SQL versionado en
`supabase/migrations/` ya es la fuente exacta (ver §9) — solo el principio
de que existen y son la autoridad de acceso a datos.

**C. Evolución prevista**: ver §10. Ninguna decisión ahí está implementada
todavía.

### 0.1 Change management de Supabase (`supabase/migrations/`)

Desde el baseline `2026-09-22` (checkpoint del reconstruction descrito en
`docs/agentic/PROGRESS.md`), este repo versiona el historial completo de
migrations SQL aplicadas al proyecto Supabase real, reconstruido 1:1 desde
`supabase_migrations.schema_migrations` vía el MCP read-only (verificado
por hash md5 contra cada migration remota — cero discrepancias). Reglas de
este modelo, no negociables:

- **`supabase/migrations/*.sql` es la fuente de verdad versionada** de todo
  cambio de schema/RLS/RPC — un cambio que no exista como archivo aquí no
  se considera parte del historial oficial, aunque exista en el proyecto
  remoto.
- **El Supabase MCP configurado en `.mcp.json` permanece SIEMPRE read-only**
  (`read_only=true` es un parámetro de conexión reforzado por el propio
  servidor de Supabase, no solo una convención local) — nunca es, ni será,
  el mecanismo de escritura. Ver `CLAUDE.md §5`.
- **Toda migration nueva requiere Human Gate explícito** antes de
  ejecutarse contra el proyecto real — nunca automático, nunca implícito
  por una autorización general previa.
- **Ejecución actual**: Supabase CLI local, disparada manualmente por un
  humano tras aprobar el SQL propuesto. No existe todavía automatización
  vía GitHub Actions para esto (evaluado como fase posterior).
- **Las migrations históricas nunca se modifican** una vez aplicadas — un
  cambio de comportamiento siempre se expresa como una migration nueva
  (`supabase migration new <name>`), nunca editando un archivo ya
  aplicado.
- El flujo completo (proponer → revisar → Human Gate → ejecutar vía CLI →
  verificar vía MCP read-only → commit) está descrito en
  `.claude/skills/habitex-orchestrator/SKILL.md` y en el historial de
  `docs/agentic/PROGRESS.md`.

---

## 1. Stack (frontend)

React · Vite · TypeScript strict · TanStack Query · React Router ·
React Hook Form · Zod · react-i18next · Vitest · React Testing Library ·
Playwright · CSS Modules + design tokens (`DESIGN.md`). Gestor de paquetes:
**pnpm**, único en el repo.

**Zustand no forma parte del stack actual** (se eliminó de `package.json`
tras confirmar cero usos reales en `src/` — todo estado de cliente hasta
ahora se resuelve con `localStorage`+hook, `useState`, o TanStack Query como
server state). Puede reconsiderarse si aparece una necesidad real de estado
global de cliente que ninguna de esas tres opciones resuelva bien — ver §7 y
§15.

---

## 2. Estructura (feature-first)

```
src/
  app/            bootstrap, providers, router, layouts
  features/<feature>/
    domain/         tipos + ports, sin dependencias externas
    application/    hooks (TanStack Query), listeners, composition root
    infrastructure/ adapters concretos (únicamente aquí puede aparecer un SDK externo)
    presentation/   componentes React, route guards
  infrastructure/  cliente Supabase, i18n (cross-cutting, no de una feature)
  shared/          ui primitives, theme, lib, testing
```

**Regla explícita: no crear las 4 capas ceremonialmente.** Una feature usa
solo las capas que su responsabilidad actual justifica. Ejemplo real:
`features/dashboard/` hoy es **presentation-only** (`dashboard-mock-data.ts`
vive ahí mismo) porque no tiene backend propio todavía — no existen carpetas
vacías `domain/`/`application/`/`infrastructure/` esperando contenido.
`features/auth/` sí tiene las 4 porque su responsabilidad (sesión) ya las
necesita. Cuando una feature nueva necesite un port, se le agrega esa capa;
no antes.

---

## 3. Dependency direction

```
Presentation
    ↓
Application  (hooks TanStack Query, listeners)
    ↓ conoce el tipo de
Domain / Ports        (interfaces, sin implementación)
    ↑ implementado por
Infrastructure / Adapters   (único lugar con el SDK externo)
```

El wiring port→adapter lo resuelve un **composition root** — no un
framework de DI. Ejemplo canónico actual:

- Port: `SessionRepository` (`features/auth/domain/session.types.ts`).
- Adapter: `supabaseSessionRepository` (`features/auth/infrastructure/supabase-session.repository.ts`).
- Composition root: `features/auth/composition.ts` — un solo
  `export const sessionRepository: SessionRepository = supabaseSessionRepository`.
- `application/` (`useAuthSession`, `useLogin`, `useLogout`,
  `AuthSessionListener`) importa `sessionRepository` desde `composition.ts`,
  **nunca** el adapter concreto directamente. Verificado: cero imports de
  `supabase-session.repository` fuera de `infrastructure/` y de tests
  (los tests mockean ese módulo, lo cual es válido — el mock se propaga a
  través de la referencia en `composition.ts`).

**Regla**: `application/` no importa un adapter concreto. Cuando aparezca un
agregado nuevo (propiedades, arriendos, contratos, pagos), preferir un port
específico del dominio (`PropertyRepository`, `RentalRepository`,
`ContractRepository`, `PaymentRepository`) siguiendo este mismo patrón,
**antes** que crear prematuramente un `HabitexApiClient` genérico gigante.
No es obligatorio que cada feature futura tenga exactamente esta misma
estructura de antemano — la feature lo justifica cuando la necesita, igual
que `SessionRepository` se justificó cuando Auth lo necesitó.

No se introduce ningún framework de inyección de dependencias.

---

## 4. Supabase boundary

Componentes, páginas y hooks de `presentation/`/`application/` **no llaman
directamente**:

- `supabase.from(...)`
- `supabase.rpc(...)`
- Supabase Storage
- Edge Functions
- Realtime

Toda esa superficie, si llega a usarse, se envuelve en un adapter dentro de
`infrastructure/`. Hoy, el único cliente Supabase del repo vive en
`src/infrastructure/supabase/client.ts`, y el único adapter que lo usa es
`supabase-session.repository.ts` — verificado: `@supabase/supabase-js` se
importa en exactamente esos 2 archivos de todo `src/`.

Los tipos de dominio (`AuthSession`, `SessionCredentials`,
`SessionAuthError`) están escritos a mano, sin adoptar la forma del SDK — el
adapter traduce (`toAuthSession`, `toSessionAuthError`). Cualquier tipo de
dominio nuevo debe seguir este mismo principio: nunca `import type {...}
from '@supabase/supabase-js'` fuera de `infrastructure/`.

---

## 5. Server state / client state

| Tipo de dato | Herramienta |
|---|---|
| Datos remotos / server state | TanStack Query |
| Formularios | React Hook Form (+ Zod vía `@hookform/resolvers`) |
| Estado local de un componente | `useState`/`useReducer` |
| Estado global puramente de cliente | Evaluar en el momento que aparezca una necesidad real (ver §15) — hoy no existe ningún caso así en el repo |

No duplicar server state dentro de un store de cliente — si el dato viene
del backend, vive en la caché de TanStack Query, con un solo lugar
autorizado para escribirlo optimistamente (ver §8).

---

## 6. TanStack Query

- Un `QueryClient` por instancia de `AppProviders` (`app/providers/queryClient.ts`),
  no un singleton de módulo — permite crear uno nuevo por test
  (`createTestQueryClient`).
- Defaults: `staleTime: 30s`, `gcTime: 5min`, `retry: 1` para queries;
  `retry: 0` para mutations. La query de sesión los sobreescribe a
  `Infinity` porque la mantiene fresca `AuthSessionListener`, no polling —
  cualquier query "empujada" por un listener en vez de refetch debe seguir
  este mismo patrón.
- **Query keys**: `authQueryKeys.session = ['auth', 'session']`
  (`features/auth/application/auth-query-keys.ts`). Regla ya vigente para
  todo lo que venga después: **scoped por identidad/administración**, nunca
  un nombre de recurso desnudo.

  ```ts
  // Correcto
  ['administration', administrationId, 'rentals']
  // Prohibido — puede mezclar tenants
  ['rentals']
  ```

- **Invalidación / cleanup de identidad**: `AuthSessionListener`
  (`features/auth/application/AuthSessionListener.tsx`) es el único lugar
  que limpia caché de otro usuario, y lo hace con
  `queryClient.removeQueries({ predicate: query.queryKey[0] !== 'auth' })`.

  **Nunca usar `queryClient.clear()` como solución genérica.** Es un bug ya
  reproducido y corregido: `clear()` destruye la instancia de Query a la que
  está suscrito un observer montado (`useAuthSession`); un `setQueryData()`
  posterior recrea la entrada de caché pero no reconecta ese observer
  huérfano, y el componente se queda cargando/desactualizado hasta un F5.
  Los tests de regresión de este bug viven en `AuthSessionListener.test.tsx`,
  `session-bootstrap.test.tsx` y `auth-reactivity.test.tsx`.

---

## 7. Auth / Security

**Frontend (verificable aquí):**

- Supabase Auth es el identity provider actual (`email` + `password`,
  `persistSession: true`, `autoRefreshToken: true`).
- `useAuthSession` rehidrata la sesión una vez al cargar; `AuthSessionListener`
  la mantiene sincronizada en tiempo real vía `onAuthStateChange`.
- `useLogin`/`useLogout` escriben la sesión optimistamente en la caché al
  tener éxito, para que la UI reaccione sin esperar el eco async de
  Supabase — `AuthSessionListener` reacciona igual al evento real después;
  es idempotente, no un segundo camino de verdad.
- **Guards** (`ProtectedRoute`, `RedirectIfAuthenticated`): simétricos a
  propósito, para no pelear entre sí en un loop de redirección.
- **Fail-closed**: `isLoading` (estado desconocido) **nunca** se trata como
  autenticado. Solo una sesión resuelta y no nula habilita contenido
  protegido. Un error de `getSession()` cae en la misma rama que "sin
  sesión" — nunca se distinguen a nivel de guard.
- **Cambio de identidad limpia datos correspondientes**: ver §6. Un logout
  o un login de otro usuario en la misma pestaña dispara la limpieza — no
  requiere F5.

**Backend (principio, no detalle verificable desde este repo):**

- RLS sigue siendo la autoridad real de acceso a datos. Los guards del
  frontend son UX, no seguridad — nunca reemplazan una política RLS.
- La `service_role` key de Supabase **nunca** se usa en el frontend (nunca
  en una variable `VITE_*`, que es pública en el bundle).
- No se crean usuarios ni IDs sintéticos en el cliente para sortear Auth.
- Un error remoto nunca se interpreta como éxito local — todo adapter
  (ver `toSessionAuthError`) propaga el error, nunca lo absorbe en silencio.

Este documento no describe políticas RLS específicas porque no son
verificables desde este repositorio (§0); el principio de que RLS manda
sobre cualquier guard de UI sí es una regla de arquitectura de Habitex.

---

## 8. Testing

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unit | Vitest | Funciones puras, hooks aislados |
| Componente | React Testing Library | Comportamiento observable (roles, texto, estados) |
| Browser / E2E | Playwright | Flujos reales en Chromium |

**Principios:**
- Probar comportamiento, no implementación (nombres de clases CSS, detalles
  internos) — evitar tests frágiles.
- Cubrir explícitamente: fail-closed de Auth, refresh (F5), login/logout sin
  recarga, cambio de identidad sin fuga de caché entre usuarios (ver los 3
  archivos de regresión citados en §6).
- Responsive cuando sea relevante para el componente (breakpoints de §7 de
  `DESIGN.md`).
- Cuando exista backend real con múltiples administraciones/usuarios:
  aislamiento cross-user/cross-administration y RLS deben tener su propia
  cobertura — no existe ese caso todavía, así que no existe ese test
  todavía.

**Estado real de la cobertura E2E — no inflar esto:** Playwright corre
contra credenciales de Supabase **no funcionales** a propósito
(`.env.e2e`), por lo que **no existe hoy E2E autenticado real** — no hay
forma de llegar al Dashboard/AppShell autenticado en un navegador real desde
este repo. La cobertura E2E actual verifica el camino fail-closed
(redirección a `/login`), el propio `/login`, y el `AppShell` compartido a
través de `/ui-preview` (pública, mock-data-only, mismo componente que usa
la app real). Esto es una limitación estructural conocida, no un olvido.

---

## 9. TypeScript / entorno

- `strict: true` + todos los flags opcionales estrictos activos
  (`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`,
  `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`) — no negociable. No
  relajar un flag para resolver un error puntual; se corrige el código.
- Variables de entorno validadas con Zod al cargar el módulo
  (`shared/lib/env.ts`) — falla ruidoso e inmediato si falta algo, nunca un
  fallback silencioso.
- Ningún secreto en `VITE_*` — todo lo que empieza con `VITE_` termina en el
  bundle público. La `service_role` key nunca es una variable de entorno del
  frontend.
- **pnpm** es el único gestor de paquetes del repo.

---

## 10. Backend evolutivo

**Hoy:**

```
Frontend → Application → Ports → Supabase Adapters → Supabase/PostgreSQL
```

**Futuro, cuando exista necesidad real** (no una decisión tomada, ver §15):

```
Frontend → Application → los mismos Ports → HTTP Adapters → Habitex API → PostgreSQL/Supabase
```

La Habitex API, si se construye, probablemente sería TypeScript + Fastify —
pero **no es una decisión de implementación inmediata** y no se introduce
solo por anticipar escala. El frontend ya está preparado para ese día
porque `application/` depende de ports (§3), no de Supabase directamente —
migrar significa escribir un nuevo adapter e implementar el port, no tocar
`application/`.

**Disparadores reales para reconsiderar esto** (complejidad genuina, no
anticipación): contratos, generación de documentos, firma electrónica,
pagos, webhooks, email, WhatsApp, OCR, IA, estudios de arrendamiento,
jobs/colas, integraciones externas, o cualquier workflow que por seguridad
no deba ejecutarse directamente desde el cliente.

Supabase Auth puede seguir siendo el identity provider incluso si aparece
una Habitex API — son decisiones independientes; no asumir que "Habitex
API" implica migrar Auth también.

---

## 11. Backend responsibility

Una operación sensible o que dependa de un secreto externo **nunca** se
mueve al frontend solo para evitar construir un backend. Edge Functions ya
son backend; una futura Habitex API también lo es. La elección entre
"resolverlo en Supabase (RPC/Edge Function)" o "resolverlo en una futura
Habitex API" depende del workflow concreto — no existe una regla absoluta
de "todo Supabase" ni "todo Fastify".

---

## 12. Anti-overengineering

No agregar por anticipación, sin un segundo caso real que lo justifique hoy:

- Microservicios.
- Redis.
- Event buses.
- CQRS.
- Frameworks de DI.
- Un `HabitexApiClient` genérico gigante en vez de ports específicos (§3).
- State managers instalados sin un uso real (esto ya pasó una vez con
  Zustand y se corrigió — ver §1).
- Abstracciones creadas para un único consumidor.

**Diseñar para poder evolucionar no es lo mismo que implementar hoy toda la
arquitectura futura.** El composition root de `SessionRepository` (§3) es el
ejemplo de la cantidad correcta de preparación: una interfaz + un solo
binding, no un framework.

---

## 13. Decisiones abiertas

Lista corta, sin rellenar con hipótesis. Se actualiza cuando una se
resuelve o aparece una nueva:

- **Cuándo introducir la Habitex API.** Fastify sigue siendo el candidato
  más probable, no una obligación ni un compromiso de fecha.
- **Composition root con múltiples ports.** Hoy `features/auth/composition.ts`
  resuelve un solo port. Cuando exista un segundo agregado con su propio
  port, decidir si cada feature mantiene su propio composition root o si
  conviene uno centralizado en `app/`.
- **Estrategia de firma electrónica.** Sin definir — depende de qué
  proveedor y de si el flujo vive en Supabase o en una futura Habitex API.
- **Estado global de cliente.** Si una feature futura demuestra una
  necesidad real que ni Query ni estado local resuelven bien, evaluar
  Zustand (u otra opción) en ese momento — no antes.

---

## Evidencia usada en este documento

`src/features/auth/{domain,application,infrastructure,presentation}/*`,
`src/features/auth/composition.ts`, `src/features/dashboard/presentation/*`,
`src/app/providers/{AppProviders,queryClient}.tsx`, `src/app/router/router.tsx`,
`src/infrastructure/supabase/client.ts`, `src/shared/lib/env.ts`,
`tsconfig.app.json`, `package.json`, `.env.example`, `.env.e2e`,
`playwright.config.ts`, y `supabase/migrations/` (51 migrations
reconstruidas 1:1 desde `supabase_migrations.schema_migrations` vía MCP
read-only, verificadas por hash — ver §0.1).
