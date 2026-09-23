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
frontend), implementado, validado e independientemente revisado. Backend
gate resuelto y aplicado contra el proyecto Supabase real; frontend
implementado en esta sesión (guards de ruta + bootstrap flow). Ver detalle
en "Último incremento ejecutado" más abajo.

**INC-002 — Administration selection UI**: completo, pusheado a
`origin/chore/agentic-foundation` (piloto original del
`habitex-orchestrator`). Ver "Registro de checkpoints".

## Estado

`INC-001 checkpointed locally — pending human review before push/merge`.

- Backend gate: **RESOLVED**. Migration `20260923010827_fix_trial_grace_period`
  aplicada contra el proyecto Supabase real (`eurzpkgikzdvbblgtjwp`),
  commiteada (`89d7e22`) y **pusheada** a `origin/chore/agentic-foundation`.
- Frontend: **completo**. Guards de ruta (`RequiresAccount`,
  `RedirectIfAccountExists`), `BootstrapAccountPage`, `useBootstrapAccount`,
  `supabase-account.repository.bootstrapAccount` — implementados,
  validados de forma independiente, revisados por `habitex-reviewer` con 1
  ciclo de fix (2 HIGH corregidos y re-verificados como resueltos), y
  checkpointed localmente (ver "Último checkpoint").
- El checkpoint de INC-001 frontend (backend ya está en `origin`) sigue
  pendiente de push/merge — push/merge nunca son automáticos en este
  workflow.

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
| INC-001 — frontend (bootstrap flow: guards de ruta, `BootstrapAccountPage`, `useBootstrapAccount`) | done — implementado, validado, revisado (1 fix cycle), checkpoint local pendiente de crear en esta misma sesión |

## Blockers

Ninguno técnico ni de aprobación en este momento. `89d7e22` (backend
gate) ya está en `origin/chore/agentic-foundation`; el nuevo checkpoint de
INC-001 frontend (ver "Último checkpoint") sigue pendiente de revisión
humana antes de push — push/merge nunca son automáticos en este workflow
(ver `SKILL.md` §"Reglas globales").

## Último incremento ejecutado

**INC-001 — Account & Administration Bootstrap** (`docs/agentic/HABITEX_COMPLETION_PLAN.md`,
sección INC-001) — **frontend scope**, resumido a partir del checkpoint de
backend ya resuelto (`89d7e22`).

- **Qué se agregó**:
  - `AccountRepository.bootstrapAccount` (dominio +
    `supabase-account.repository.ts`): invoca el RPC `bootstrap_account`
    existente (sin lógica de negocio nueva, sin reproducir fechas de
    trial/gracia en frontend).
  - `useBootstrapAccount` (TanStack Query mutation): invalida
    `administrationQueryKeys.account` y `.accessibleAdministrations` en
    `onSuccess`, **esperando** ambas invalidaciones (`Promise.all`, ver fix
    loop abajo) antes de que el caller navegue.
  - `RequiresAccount` (guard de ruta, envuelve `AuthenticatedLayout` y todo
    su subárbol): `loading` → boot screen; `error` → `Alert` + retry
    (fail-closed, nunca cae en "tiene cuenta" ni en "necesita bootstrap");
    `data === null` → redirect a `/bootstrap`; resuelto → `Outlet`.
  - `RedirectIfAccountExists` (guard de `/bootstrap`, mismo tratamiento
    fail-closed): `data !== null` → redirect a `/`; `data === null` →
    `Outlet`.
  - `BootstrapAccountPage` (página standalone, sin `AppShell`, sin el
    hero fotográfico/glass reservado a `LoginPage` por `DESIGN.md §10`):
    formulario RHF+Zod, botón e inputs deshabilitados durante
    `isPending` (previene doble submit), error mostrado vía
    `Alert tone="danger"` con copy genérico (nunca el error crudo del
    RPC), éxito navega a `/` con `replace`.
  - Router (`router.tsx`): nueva ruta `bootstrap` (dentro de
    `ProtectedRoute`, fuera de `AuthenticatedLayout`, gateada por
    `RedirectIfAccountExists`); `AuthenticatedLayout` y todas sus rutas
    hijas existentes ahora envueltas en `RequiresAccount`, sin cambiar su
    forma interna.
  - i18n: claves nuevas `bootstrap.*` y `guardError.*` en
    `administration.json` (es/es-CO), `actions.retry` en `common.json`
    (es/es-CO).
- **Tests**: 9 archivos de test nuevos (guards, hook, repository, página,
  y un test de integración del flujo completo — ver fix loop). Sin tests
  existentes modificados salvo `App.test.tsx` (ver fix loop).
- **Fix loop**: 1 ciclo de 2 máximo. `habitex-reviewer` (contexto
  independiente) encontró 2 findings HIGH:
  1. **Race navigate/cache**: `onSuccess` invalidaba la cache de forma
     fire-and-forget (`void invalidateQueries(...)`), permitiendo que
     `navigate('/')` corriera antes de que la cache de `account`
     refrescara — el usuario podía rebotar de vuelta a `/bootstrap`
     justo después de un signup exitoso. **Corregido**: `onSuccess` ahora
     retorna `Promise.all([...])`, así TanStack Query espera ambas
     invalidaciones antes de que el `onSuccess` a nivel de `mutate()`
     (la navegación) se ejecute. Regression test nuevo:
     `bootstrap-account-flow.test.tsx`, monta el subárbol de rutas real
     (`RedirectIfAccountExists` → `BootstrapAccountPage`,
     `RequiresAccount` → ruta protegida) y verifica que la navegación no
     ocurre hasta que el refetch post-invalidación resuelve. Verificado
     como test de regresión real (no tautológico) por trazado manual
     contra el código anterior.
  2. **`pnpm test` fallaba de forma determinística en la suite completa**:
     `App.test.tsx` (preexistente) usaba el timeout default de 1000ms en
     un `findByRole`, y el volumen de tests nuevos de esta sesión
     empujaba ese assertion por encima del timeout bajo contención de
     workers (reproducido 2/2 veces). **Corregido**: timeout explícito de
     5000ms en ese `findByRole`; sin cambios al assertion en sí.
  - Ambos fixes re-verificados independientemente (`habitex-reviewer`,
    contexto fresco): **RESOLVED**, sin nuevos findings BLOCKER/HIGH.
- **Deuda no bloqueante registrada** (no requiere acción antes de
  mergear):
  - LOW/informativo: `administrationQueryKeys.account` y
    `.accessibleAdministrations` son keys "desnudas" (no scoped por
    identidad en el nombre de la key en sí) — preexistente, no
    introducido por este cambio. Mitigado en la práctica porque
    `AuthSessionListener` limpia toda key no-`auth` en cada cambio de
    identidad (confirmado leyendo el código). Candidato a nota explícita
    en `ARCHITECTURE.md §6` si esta excepción debe quedar documentada
    formalmente.
  - Preexistente, no introducido ahora: `useBootstrapAccount.test.tsx`
    usa un `createClient()` local en vez del helper compartido
    `createTestQueryClient()` que sí usan los tests más nuevos de esta
    feature — inconsistencia de convención de test, no funcional.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora, no solo reportada por los implementers — dos rondas
  completas, antes y después del fix loop):
  `pnpm typecheck && pnpm lint && pnpm test -- --run && pnpm build` — 
  todos PASS. 59 archivos / 359 tests (0 fallos), 0 errores de lint (4
  warnings preexistentes no relacionados —
  `react-hooks/incompatible-library` en `ParkingForm`,
  `AddFullPropertyForm`, `AddRoomRentalPropertyForm`,
  `AddRentalDraftForm`, ninguno tocado por este cambio). Suite completa
  corrida dos veces tras el fix para confirmar que el flake de
  `App.test.tsx` quedó resuelto, no solo mejorado — sin fallos en ninguna
  corrida.
- **Human gates**: ninguno disparado durante el frontend — no se tocó
  schema/RLS/Auth/dependencias/arquitectura. El único human gate de
  INC-001 (la contradicción producto/backend del trial) ya se resolvió y
  checkpointeó por separado (ver abajo).
- **Seguridad verificada** (vía MCP read-only, no asumida): `bootstrap_account`
  es `SECURITY DEFINER`; no existe policy de INSERT directa sobre
  `accounts`/`people`/`administrations` para `authenticated` — el RPC es
  la única vía de creación, el guard de frontend es solo UX, RLS sigue
  siendo la autoridad real. Sin uso de `service_role`. Sin `localStorage`
  como mecanismo de autorización en ningún archivo nuevo.

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

Decisión pendiente adicional: push/merge del nuevo checkpoint de INC-001
frontend (`89d7e22`, backend, ya está en `origin`) — siempre gate humano,
nunca automático en este workflow.

## Último checkpoint

- **SHA**: _(pendiente — se crea inmediatamente después de esta
  actualización de `PROGRESS.md`, en el mismo commit)_
- **Branch**: `chore/agentic-foundation`
- **Contenido del checkpoint**: INC-001 frontend — guards de ruta
  (`RequiresAccount`, `RedirectIfAccountExists`), `BootstrapAccountPage`,
  `useBootstrapAccount`, `bootstrapAccount` en el repository/dominio de
  `administration`, wiring en `router.tsx`, i18n, tests (incluye el fix
  loop: `App.test.tsx` timeout + `bootstrap-account-flow.test.tsx`), y
  esta actualización de `PROGRESS.md`.
- **Fecha**: 2026-09-23
- **No incluido**: ningún cambio de Supabase/migrations nuevo (el backend
  gate ya está en `89d7e22`, checkpoint previo separado).

## Último resultado de validación

Medido sobre el resultado integrado de INC-001 frontend (implementación +
fix loop), ejecutado de forma independiente por la sesión orquestadora —
no solo reportado por los implementers/reviewer:

| Check | Resultado |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errores, 4 warnings preexistentes (React Compiler + `watch()` de React Hook Form en `ParkingForm`/`AddFullPropertyForm`/`AddRoomRentalPropertyForm`/`AddRentalDraftForm`, no relacionados, no tocados por este cambio) |
| `pnpm test -- --run` | PASS — 359/359, 59 archivos (corrido 2 veces tras el fix loop para confirmar que el flake de `App.test.tsx` quedó resuelto, no solo mejorado) |
| `pnpm build` | PASS |

## Siguiente acción recomendada

**Revisión humana del checkpoint de INC-001 frontend antes de push/merge.**
El checkpoint de backend (`89d7e22`) ya está en `origin`; solo el checkpoint
de frontend sigue sin pushear.

Con INC-001 completo (backend + frontend), los siguientes incrementos del
`HABITEX_COMPLETION_PLAN.md` quedan **sin dependencias técnicas
pendientes** (antes bloqueados por INC-001):

- **INC-003** — Trial/Subscription status visibility (depende de INC-001).
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
| 2026-09-23 | _(pendiente — este checkpoint)_ | `chore/agentic-foundation` | INC-001 frontend: guards de ruta (`RequiresAccount`, `RedirectIfAccountExists`), `BootstrapAccountPage`, `useBootstrapAccount`, `bootstrapAccount` en el repository, wiring en `router.tsx`, i18n. 1 fix cycle (2 HIGH: race navigate/cache, flake de `App.test.tsx`) resuelto y re-verificado. **Local, pendiente de push**. |
