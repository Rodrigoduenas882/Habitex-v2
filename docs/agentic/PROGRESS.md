# Habitex — Agentic Progress

> **Read this file before resuming autonomous Habitex work.**
> Este archivo es el único que una sesión nueva necesita leer para saber en
> qué estado quedó el trabajo agentic, sin depender de memoria conversacional.
> Lo mantiene actualizado el `habitex-orchestrator` en cada checkpoint (ver
> `.claude/skills/habitex-orchestrator/SKILL.md`).

---

## Branch activa

`chore/agentic-foundation`

## Incremento actual (producto)

**INC-001 — Account & Administration Bootstrap**: **completo** (backend +
frontend), pusheado a `origin/chore/agentic-foundation` (`59778fc`).

**INC-002 — Administration selection UI**: completo, pusheado a
`origin/chore/agentic-foundation` (piloto original del
`habitex-orchestrator`). Ver "Registro de checkpoints".

**INC-003 — Trial/Subscription status visibility**: **completo**
(frontend, sin backend gate — RLS ya soportaba la lectura), implementado,
validado e independientemente revisado. Checkpoint `a859e6c` pusheado a
`origin/chore/agentic-foundation`. Ver detalle en "Último incremento
ejecutado" más abajo.

## Estado

`INC-003 completo — checkpoint a859e6c pusheado a origin/chore/agentic-foundation`.

- INC-001 (backend + frontend): **completo y pusheado** (`89d7e22`,
  `59778fc`).
- INC-003: **completo**. `SubscriptionStatusBanner` (fail-silent,
  no-gating, solo visibilidad) montado en `AuthenticatedLayout`,
  `useSubscription` + `supabase-subscription.repository` — implementados,
  validados de forma independiente, revisados por `habitex-reviewer` (0
  BLOCKER/HIGH/MEDIUM, 1 LOW no bloqueante registrado abajo), y
  checkpointed y pusheado (ver "Último checkpoint").
- El checkpoint de INC-003 (`a859e6c`) ya está pusheado a
  `origin/chore/agentic-foundation` tras aprobación humana — HEAD y origin
  sincronizados.

## Subtareas

| Subtarea | Estado |
|---|---|
| Supabase MCP read-only conectado y documentado en `CLAUDE.md` | done |
| Fundación agentic (orchestrator skill + `habitex-implementer` + `habitex-reviewer`) | done |
| Auditoría técnica del estado actual (frontend + Supabase read-only) | done |
| Reconciliación con fuente de verdad de producto (PRODUCT SCOPE vs IMPLEMENTATION STATE) | done |
| `docs/agentic/HABITEX_COMPLETION_PLAN.md` (roadmap real, primera versión) | done |
| Revisión humana del roadmap (ROADMAP CONSISTENCY CHECK) | done |
| Normalización del plan (splits, research gates, IDs renumerados INC-001..018, POST-001..003, Unresolved domains) | done |
| Aprobación humana final del Completion Plan normalizado | done — aprobado explícitamente por el usuario al autorizar el piloto INC-002 |
| Selección de piloto agentic (primer incremento a ejecutar con el workflow) | done — INC-002 seleccionado y ejecutado |
| INC-002 — Administration selection UI (implementación + validación + review independiente) | done — pusheado a `origin/chore/agentic-foundation` |
| Infraestructura: Supabase migrations baseline (CLI, 51 migrations históricas reconstruidas) | done — pusheado (`a173cdb`) |
| INC-001 — backend gate (fix trial/grace, migration autorada + aplicada + verificada) | done — aplicada en producción, commit `89d7e22`, pusheado a `origin/chore/agentic-foundation` |
| INC-001 — frontend (bootstrap flow: guards de ruta, `BootstrapAccountPage`, `useBootstrapAccount`) | done — commit `59778fc`, pusheado a `origin/chore/agentic-foundation` |
| INC-003 — Trial/Subscription status visibility (`SubscriptionStatusBanner`, `useSubscription`, `supabase-subscription.repository`) | done — implementado, validado, revisado (0 fix cycles necesarios), checkpoint `a859e6c` pusheado |

## Blockers

Ninguno técnico ni de aprobación en este momento. INC-001 (`89d7e22`,
`59778fc`) e INC-003 (`a859e6c`) ya están en
`origin/chore/agentic-foundation` — HEAD y origin sincronizados.

## Último incremento ejecutado

**INC-003 — Trial/Subscription status visibility**
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-003) — solo
visibilidad de lectura, sin gating de acciones (INC-004, futuro) ni
checkout real de planes (POST-002, futuro).

- **RESEARCH GATE condicional del plan**: resuelto sin escalar — RLS ya
  soporta la lectura (`administration_subscriptions_select`, `USING
  is_administration_member(administration_id)`), schema ya tiene todos
  los campos necesarios, sin RPC/vista dedicada (SELECT directo scoped es
  el mecanismo correcto). **Sin HUMAN GATE de Supabase/schema/RLS.**
- **Qué se agregó**:
  - `Subscription`/`SubscriptionStatus`/`SubscriptionRepository` en el
    dominio de `administration`, `supabase-subscription.repository.ts`
    (SELECT scoped por `administration_id`, `.maybeSingle()`, columnas
    explícitas sin `*`), `useSubscription` (TanStack Query, key scoped
    `['administration', id, 'subscription']`), wiring en `composition.ts`.
  - `SubscriptionStatusBanner`: resuelve la administración activa vía
    `useActiveAdministration()` (reutilizado, no reimplementado);
    **fail-silent** (renderiza `null`, sin spinner ni error propio) en
    todo estado no accionable (sin administración resuelta, loading,
    error, `subscription === null`, `status === 'ACTIVE'`) — a propósito
    distinto de los guards fail-closed de INC-001 (`RequiresAccount` etc.),
    porque esto no es un gate de seguridad, es un widget informativo.
    Montado en `AuthenticatedLayout` (aditivo, sin tocar su árbol de
    rutas/nav existente).
  - Tone-mapping (primera regla que matchea, sin hardcodear duración de
    trial/gracia — solo diffs de timestamps del backend): `ACTIVE` → nada;
    `TRIALING` antes de `trial_ends_at` → `info`; `TRIALING` en gracia
    (después de `trial_ends_at`, antes de `management_access_until`) →
    `warning`; `PAST_DUE` → `warning` incondicional; `EXPIRED` o
    `management_access_until` ya pasado → `danger`; `CANCELED` → `danger`.
  - CTA "Ver planes" deliberadamente deshabilitado (`aria-disabled`, sin
    navegación) — checkout real es POST-002, fuera de alcance.
  - Reutiliza `Alert`/`Button` sin crear primitives nuevos
    (`DESIGN.md:136`, "No crear un banner de error propio").
  - i18n: claves nuevas `subscriptionBanner.*` en `administration.json`
    (es/es-CO), con pluralización `_one`/`_other` para los mensajes de
    días restantes.
- **Tests**: 6 archivos nuevos (repository, hook, banner) + ampliación de
  `AuthenticatedLayout.test.tsx`.
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente) no
  encontró BLOCKER/HIGH/MEDIUM.
- **Deuda no bloqueante registrada**:
  - LOW: para una suscripción `CANCELED` cuyo `management_access_until`
    ya pasó, el orden de reglas especificado (catch-all de "expirado"
    antes que `CANCELED`) hace que se muestre el copy de "expirado" en
    vez de "cancelada" — el tono (`danger`) es correcto en ambos casos,
    es solo un matiz de texto. Si el copy distinto importa a producto,
    es un reorder de una línea en `resolveBannerState`.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora): `pnpm typecheck && pnpm lint && pnpm test -- --run &&
  pnpm build` — todos PASS. 62 archivos / 381 tests (0 fallos), 0 errores
  de lint (mismos 4 warnings preexistentes no relacionados). Suite
  completa corrida dos veces por el reviewer para descartar flakiness del
  patrón nuevo `vi.useFakeTimers` (sin precedente previo en esta suite) —
  sin fallos en ninguna corrida.
- **Human gates**: ninguno disparado — no se tocó schema/RLS/Auth
  (solo lectura ya soportada)/dependencias/arquitectura.
- **Seguridad verificada** (vía MCP read-only): única policy sobre
  `administration_subscriptions` es `administration_subscriptions_select`
  (SELECT, scoped), sin policy de escritura expuesta a `authenticated`.

### Incremento anterior: INC-001 — Account & Administration Bootstrap

Completo (backend + frontend), pusheado — ver checkpoints `89d7e22` y
`59778fc` en "Registro de checkpoints" para el resumen; detalle completo
del backend gate (contradicción producto/backend del trial, fix
aplicado) en "Infraestructura: Supabase migrations baseline" más abajo.

## Infraestructura: Supabase migrations baseline

Tras seleccionar INC-001 (Account & Administration Bootstrap) como
siguiente incremento, el RESEARCH GATE de INC-001 encontró una
**PRODUCT/BACKEND CONTRADICTION** (clasificación C): el trigger
`create_default_administration_trial()` provisiona `administration_subscriptions`
con 30 días de trial y 0 días de gracia, en vez de los 14 días de trial +
30 días de gracia documentados como Product Source of Truth. HUMAN GATE
TRIGGERED — INC-001 quedó pausado hasta resolver esto; no se implementó
nada de INC-001 en `src/` en ese momento.

Antes de aplicar ese fix, el usuario pidió resolver primero cómo Habitex
versiona y aplica cambios de backend Supabase. Ese trabajo de
infraestructura quedó checkpointed:

- **`supabase` CLI** agregada como devDependency vía pnpm
  (`package.json`/`pnpm-lock.yaml`).
- **`supabase/config.toml`** generado vía `supabase init` — sin secretos
  (todo valor sensible usa `env(...)`).
- **`supabase/migrations/*.sql`** — las 51 migrations históricas
  reconstruidas 1:1 desde `supabase_migrations.schema_migrations` vía el
  MCP read-only, verificadas byte a byte contra el remoto por dos métodos
  independientes (md5 durante la reconstrucción; sha256 + longitud en
  bytes durante la revisión independiente) — cero discrepancias.
- **`docs/ARCHITECTURE.md §0/§0.1`** y **`CLAUDE.md §5`** actualizados para
  documentar el nuevo modelo: MCP siempre read-only, Human Gate explícito
  por migration, ejecución actual vía Supabase CLI local, migrations
  históricas nunca se modifican.
- **Revisión independiente** (`habitex-reviewer`, contexto separado):
  sin BLOCKER. Validación completa (`typecheck`/`lint`/`test`/`build`) en
  PASS, 334/334 tests, sin regresiones. `git status`/`diff --stat`
  confirmaron que nada bajo `src/` fue tocado.
- **Sin escritura contra Supabase remoto en ningún momento durante esta
  fase**: no hubo `supabase login`/`link`/`db push`/`migration up`/
  `migration repair`, ni SQL Editor. El MCP read-only fue la única vía de
  lectura.
- **Checkpoint**: `a173cdb` (commiteado y **pusheado** a
  `origin/chore/agentic-foundation`).

### Fix del trial/gracia — migration autorada y APLICADA

Decisión de producto aprobada explícitamente por el usuario para resolver
la contradicción de arriba:

- **Trial = 14 días**, **grace = 30 días adicionales** →
  `trial_ends_at = trial_started_at + 14 days`,
  `management_access_until = trial_started_at + 44 days`.
- **Option B aprobada** para las filas existentes: reconciliar únicamente
  las `administration_subscriptions` que todavía coincidan exactamente con
  el patrón legacy 30d/30d (`status='TRIALING'`, `plan_code='TRIAL'`,
  `trial_ends_at = trial_started_at + 30 days`,
  `management_access_until = trial_ends_at`) — sin tocar
  `trial_started_at`, sin afectar filas ya desviadas del patrón por otra
  razón, idempotente por construcción.

Migration autorada: `supabase/migrations/20260923010827_fix_trial_grace_period.sql`
— `CREATE OR REPLACE FUNCTION public.create_default_administration_trial()`
(misma firma, `RETURNS trigger`/`LANGUAGE plpgsql`/`SECURITY DEFINER`/
`SET search_path=''` preservados) + el `UPDATE` acotado de Option B,
envueltos en `begin;`/`commit;`. Revisada independientemente
(`habitex-reviewer`, contexto fresco): sin BLOCKER, sin HIGH — veredicto
"correcta y segura de aplicar, sin impedimento para continuar".

**MIGRATION APLICADA (2026-09-23) contra el proyecto Supabase real**
(`eurzpkgikzdvbblgtjwp`), vía `supabase db push` ejecutado directamente por
el usuario (el intento de ejecutarlo desde el agente fue bloqueado por el
clasificador de auto-mode de Claude Code — `[Blind Apply]` — y no se
intentó ningún workaround). Pre-flight (project ref, `migration list`,
`db push --dry-run`, y MCP read-only) confirmó inmediatamente antes de la
ejecución que solo esta migration estaba pendiente y que la población
legacy no había cambiado.

**Verificación remota post-ejecución (MCP read-only)**:
- `migration list`: local 52 / remoto 52, 0 pendientes, 0 mismatch.
  `20260923010827` registrada exactamente una vez.
- `create_default_administration_trial()`: `RETURNS trigger`,
  `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path TO ''`,
  `trial_started_at=now()`, `trial_ends_at=now()+14 days`,
  `management_access_until=now()+44 days` — confirmado carácter por
  carácter contra la definición real desplegada.
- Datos agregados (sin PII): `total_subscriptions=1`, `trialing=1`,
  `matches_14d_trial=1`, `matches_44d_management=1`,
  `legacy_30_30_remaining=0` — Option B reconcilió la única fila legacy
  existente, cero filas 30d/30d restantes.
- Invariantes de seguridad intactos: trigger `administrations_create_trial`
  habilitado y sin cambios, grants de la función sin cambios
  (`{postgres=X/postgres}`, nunca expuesta a `authenticated`/`anon`),
  `bootstrap_account` no tocada, RLS de `administration_subscriptions`
  intacta (única policy `administration_subscriptions_select`).
- **Product invariant confirmado**: trial = 14 días, grace =
  `management_access_until - trial_ends_at` = 30 días, ventana total de
  gestión desde `trial_started_at` = 44 días.

**Estado explícito:**
- Migration aplicada y verificada remotamente — **PASS** en todas las
  verificaciones.
- Trial = 14 días, Grace = 30 días adicionales, management access hasta
  el día 44 — confirmado en producción.
- Option B (reconciliación legacy) completada.
- **INC-001 Supabase/backend gate = RESOLVED.**
- El commit de esta migration (`supabase/migrations/20260923010827_fix_trial_grace_period.sql`
  + la actualización correspondiente de `PROGRESS.md`) se creó como
  `89d7e22` (`fix: align trial and grace period provisioning`) —
  **commiteado y pusheado** a `origin/chore/agentic-foundation`.
- **INC-001 frontend implementation = completo** — ver "Último incremento
  ejecutado" arriba.

## Decisiones humanas pendientes

Ver `docs/agentic/HABITEX_COMPLETION_PLAN.md` §"Unresolved product
domains" (6 dominios sin decisión: property spaces/room access, house
rules, acts, utilities billing, parking sublease authorization, demo
experience) y §"Other pending clarifications" (provisión de subscription
en `bootstrap_account` — ya resuelta vía el trigger existente, sin lógica
adicional necesaria; qué cuenta hacia `active_relationship_limit`; email
real y storage no bloqueantes). Ninguna de estas bloquea la aprobación del
plan en sí — bloquean incrementos específicos (algunas como RESEARCH GATE
explícito) cuando se lleguen a ejecutar.

## Último checkpoint

- **SHA**: `a859e6c`
- **Branch**: `chore/agentic-foundation`
- **Contenido del checkpoint**: INC-003 — `SubscriptionStatusBanner`,
  `useSubscription`, `supabase-subscription.repository`, dominio/tipos de
  `Subscription`, wiring en `composition.ts`, banner montado en
  `AuthenticatedLayout`, i18n, tests, y la actualización correspondiente de
  `PROGRESS.md`.
- **Fecha**: 2026-09-23
- **Estado**: pusheado a `origin/chore/agentic-foundation` tras aprobación
  humana. HEAD == origin, sin pendientes.
- **No incluido**: ningún cambio de Supabase/migrations nuevo (INC-003 no
  requirió backend gate — RLS ya soportaba la lectura).

## Último resultado de validación

Medido sobre el resultado integrado de INC-003, ejecutado de forma
independiente por la sesión orquestadora (y re-verificado por el
reviewer):

| Check | Resultado |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errores, 4 warnings preexistentes (React Compiler + `watch()` de React Hook Form en `ParkingForm`/`AddFullPropertyForm`/`AddRoomRentalPropertyForm`/`AddRentalDraftForm`, no relacionados, no tocados por este cambio) |
| `pnpm test -- --run` | PASS — 381/381, 62 archivos (corrido 2 veces por el reviewer para descartar flakiness del patrón nuevo `vi.useFakeTimers`) |
| `pnpm build` | PASS |

## Siguiente acción recomendada

INC-001 e INC-003 (backend + frontend) ya están completos, revisados y
pusheados a `origin/chore/agentic-foundation` (`a859e6c` == HEAD == origin,
0 ahead/0 behind). Falta selección humana del próximo incremento a
ejecutar.

Con INC-001 y INC-003 completos, los siguientes incrementos del
`HABITEX_COMPLETION_PLAN.md` quedan sin dependencias técnicas pendientes:

- **INC-004** — Capacity & expiration gating (depende de INC-003, recién
  satisfecho; reutiliza el hook de lectura de `useSubscription`).
- **INC-005** — Fix dead Dashboard CTAs (sin dependencias).
- **INC-006** — Rental Terms (depende de INC-001).
- **INC-007** — Tenant invitation & claim (depende de INC-001).
- **INC-010** — Generic file upload/download primitive (sin dependencias
  técnicas; secuenciado antes de INC-011/INC-013 porque ambos lo
  consumen).
- **INC-017** — Corregir doc drift (sin dependencias).
- **INC-018** — Habilitar `leaked_password_protection` (sin dependencias
  técnicas, pero es config de Supabase Auth — dispara HUMAN GATE
  automático por tocar Auth).

Hay varios candidatos sin dependencias pendientes — la priorización es
del usuario, no del orchestrator (ver `SKILL.md` §"SELECT INCREMENT").

---

## Registro de checkpoints

_Log append-only. Una línea por checkpoint — el detalle del diff vive en
git, no aquí._

| Fecha | SHA | Branch | Resumen |
|-------|-----|--------|---------|
| 2026-09-22 | `d524169` | `chore/agentic-foundation` | Supabase MCP read-only conectado + regla en `CLAUDE.md`. |
| 2026-09-22 | `18a846d` | `chore/agentic-foundation` | Fundación del workflow agentic: orchestrator skill + `habitex-implementer` + `habitex-reviewer` + estado persistente inicial. |
| 2026-09-22 | _(pendiente)_ | `chore/agentic-foundation` | Auditoría técnica + reconciliación con fuente de verdad de producto → `HABITEX_COMPLETION_PLAN.md` real (primera versión). Sin commit — superseded por la fila siguiente antes de commitear. |
| 2026-09-22 | `aaa0956` | `chore/agentic-foundation` | Normalización del Completion Plan tras ROADMAP CONSISTENCY CHECK: split de INC-003 (visibilidad vs. gating de capacidad/expiración) y del flujo de pagos (report+confirm / allocation / receipt), research gate explícito en Rental Terms, parking sublease movido a Unresolved domains, schema uniforme en todos los incrementos (incl. P3/POST-MVP), IDs renumerados INC-001..018 + POST-001..003. |
| 2026-09-22 | `75975cd` | `chore/agentic-foundation` | INC-002 — Administration selection UI. Piloto del `habitex-orchestrator` end-to-end: research → plan → 2 subtareas delegadas a `habitex-implementer` → validate independiente → review independiente (`habitex-reviewer`) → 1 fix cycle (HIGH: selección persistida sin scope de identidad) → re-review → checkpoint local. |
| 2026-09-22 | `4c8a884` | `chore/agentic-foundation` | Registro de INC-002 en `PROGRESS.md`. Con este commit, INC-002 y toda la fundación previa quedaron **pusheados** a `origin/chore/agentic-foundation` tras aprobación humana. |
| 2026-09-22 | `a173cdb` | `chore/agentic-foundation` | Adopción del baseline de Supabase migrations: CLI como devDependency, `supabase/config.toml`, 51 migrations históricas reconstruidas byte-exactas, `ARCHITECTURE.md`/`CLAUDE.md` actualizados. Sin cambios bajo `src/`. **Pusheado**. |
| 2026-09-23 | `89d7e22` | `chore/agentic-foundation` | INC-001 backend gate: migration `fix_trial_grace_period` (14d trial / 44d management access, Option B para la fila legacy existente) autorada, aplicada contra el proyecto Supabase real y verificada remotamente. **Pusheado**. |
| 2026-09-23 | `59778fc` | `chore/agentic-foundation` | INC-001 frontend: guards de ruta (`RequiresAccount`, `RedirectIfAccountExists`), `BootstrapAccountPage`, `useBootstrapAccount`, `bootstrapAccount` en el repository, wiring en `router.tsx`, i18n. 1 fix cycle (2 HIGH: race navigate/cache, flake de `App.test.tsx`) resuelto y re-verificado; corrección posterior del estado de push de `89d7e22` en `PROGRESS.md` (amend, sin cambio de mensaje). **Pusheado**. |
| 2026-09-23 | `a859e6c` | `chore/agentic-foundation` | INC-003 — Trial/Subscription status visibility: `SubscriptionStatusBanner` (fail-silent, no-gating), `useSubscription`, `supabase-subscription.repository`, montado en `AuthenticatedLayout`. Sin backend gate (RLS ya soportaba la lectura). 0 fix cycles — 1 LOW no bloqueante registrado (copy de CANCELED+gracia-vencida). **Pusheado**. |
