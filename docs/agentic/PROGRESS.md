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

**INC-002 — Administration selection UI**: implementado, validado e
independientemente revisado. Ver detalle en "Último incremento
ejecutado" más abajo. Es el primer incremento de producto del plan que
pasa por el ciclo completo del `habitex-orchestrator` (piloto agentic).

## Estado

`INC-002 checkpointed locally — pending human review before push/merge`.
El plan fue aprobado explícitamente por el usuario y INC-002 fue
seleccionado explícitamente como piloto en la misma sesión en que se
ejecutó (sin quedar registrado ese approval por separado — ver Subtareas).
El ciclo READ STATE → ... → NEXT puede seguir operando sobre el resto del
backlog normalizado.

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
| INC-002 — Administration selection UI (implementación + validación + review independiente) | done — checkpoint local `75975cd`, pendiente de revisión humana antes de push/merge |

## Blockers

Ninguno técnico ni de aprobación en este momento. `75975cd` es un
checkpoint **local**, no pusheado ni mergeado — queda pendiente de
revisión humana antes de avanzar (push/merge nunca son automáticos en
este workflow, ver `SKILL.md` §"Reglas globales").

## Último incremento ejecutado

**INC-002 — Administration selection UI** (`docs/agentic/HABITEX_COMPLETION_PLAN.md`,
sección INC-002).

- **Checkpoint**: `75975cd` (local, branch `chore/agentic-foundation`, sin push).
- **Qué se agregó**: `useActiveAdministration` (hook, envuelve
  `useCurrentAdministration` con selección persistida en `localStorage`)
  + `AdministrationPicker` (componente accesible) en
  `src/features/administration/`; cableado en `PropertiesPage`,
  `AddPropertyPage`, `RentalsPage`, `AddRentalPage`, reemplazando el
  `EmptyState` sin acción del estado `selection-required`.
- **Fix loop**: 1 ciclo de 2 máximo. `habitex-reviewer` encontró 1 finding
  HIGH (selección persistida no scoped por identidad — podía resolver
  silenciosamente a la administración de otro usuario en un cambio de
  sesión sin recarga). Corregido (`AuthSessionListener` ahora limpia la
  selección persistida en `identityChanged`) y re-verificado
  independientemente como resuelto.
- **Deuda no bloqueante registrada** (no requiere acción antes de
  mergear, sí antes de tocar estos archivos de nuevo):
  - MEDIUM: `useActiveAdministration` solo evita arrastrar una selección
    obsoleta en memoria porque `ProtectedRoute` desmonta todo el subárbol
    autenticado en cada cambio de identidad — garantía incidental, no
    declarada como invariante ni cubierta por test a nivel del hook.
  - LOW: `administration-selection-storage.ts` ahora se importa desde
    `features/auth` — primer import cruzado de una feature hacia
    `infrastructure/` de otra. No viola `ARCHITECTURE.md` (no usa SDK),
    pero podría encajar mejor en `shared/`.
- **Validación**: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  — todos PASS. 53 archivos / 334 tests (0 fallos, 0 errores de lint, 4
  warnings preexistentes no relacionados). Sin `FAIL` nuevo en ningún
  paso.
- **Human gates**: ninguno disparado — el incremento no tocó
  schema/RLS/Auth/dependencias/arquitectura.

## Infraestructura: Supabase migrations baseline

Tras seleccionar INC-001 (Account & Administration Bootstrap) como
siguiente incremento, el RESEARCH GATE de INC-001 encontró una
**PRODUCT/BACKEND CONTRADICTION** (clasificación C): el trigger
`create_default_administration_trial()` provisiona `administration_subscriptions`
con 30 días de trial y 0 días de gracia, en vez de los 14 días de trial +
30 días de gracia documentados como Product Source of Truth. HUMAN GATE
TRIGGERED — INC-001 queda pausado hasta resolver esto; no se implementó
nada de INC-001 en `src/`.

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
- **Sin escritura contra Supabase remoto en ningún momento**: no hubo
  `supabase login`/`link`/`db push`/`migration up`/`migration repair`, ni
  SQL Editor. El MCP read-only fue la única vía de lectura.
- **Checkpoint**: `a173cdb` (commiteado y **pusheado** a
  `origin/chore/agentic-foundation`).

### Fix del trial/gracia — migration autorada, NO APLICADA todavía

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
- **INC-001 frontend implementation = NOT STARTED** — no se ha escrito
  ningún código bajo `src/` para INC-001 todavía; sigue siendo trabajo
  futuro separado, requiere su propio ciclo del `habitex-orchestrator`.
- El commit local de esta migration (`supabase/migrations/20260923010827_fix_trial_grace_period.sql`
  + esta actualización de `PROGRESS.md`) sigue **pendiente** — no se ha
  hecho `git commit` ni `git push` todavía.

## Decisiones humanas pendientes

Ver `docs/agentic/HABITEX_COMPLETION_PLAN.md` §"Unresolved product
domains" (6 dominios sin decisión: property spaces/room access, house
rules, acts, utilities billing, parking sublease authorization, demo
experience) y §"Other pending clarifications" (provisión de subscription
en `bootstrap_account`, qué cuenta hacia `active_relationship_limit`,
email real y storage no bloqueantes). Ninguna de estas bloquea la
aprobación del plan en sí — bloquean incrementos específicos (algunas como
RESEARCH GATE explícito) cuando se lleguen a ejecutar.

## Último checkpoint

- **SHA**: `18a846d727785422e1d7b9340c3a9a3836fea433`
- **Branch**: `chore/agentic-foundation`
- **Contenido del checkpoint**: fundación del workflow agentic —
  `habitex-orchestrator` skill + `habitex-implementer` + `habitex-reviewer`
  + estado persistente inicial.
- **Fecha**: 2026-09-22
- **Pendiente de commit ahora mismo**: la reconciliación de esta sesión
  (`HABITEX_COMPLETION_PLAN.md` reescrito con el roadmap real +
  actualización de este archivo) — **no incluida en el SHA anterior**,
  sin commit todavía, pendiente de aprobación humana.

## Último resultado de validación

Medido sobre el checkpoint `75975cd` (INC-002, ejecutado por el
`habitex-orchestrator` de punta a punta, validado de forma independiente
por la sesión orquestadora — no solo reportado por los implementers):

| Check | Resultado |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errores, 4 warnings preexistentes (React Compiler + `watch()` de React Hook Form, no relacionados, mismos 4 archivos que en el baseline anterior) |
| `pnpm test` | PASS — 334/334, 53 archivos |
| `pnpm build` | PASS |

## Siguiente acción recomendada

**Revisión humana de `75975cd` antes de push/merge.** No es un incremento
completo del MVP por sí solo respecto al roadmap — sigue habiendo
incrementos `pending` en el Completion Plan. Una vez el usuario revise y
apruebe `75975cd` (y decida si push/merge a `main`, que este workflow
nunca hace automáticamente), la siguiente acción natural es volver a
SELECT INCREMENT sobre `HABITEX_COMPLETION_PLAN.md` — INC-001 (Account &
Administration Bootstrap) es el siguiente candidato P0 sin dependencias
técnicas pendientes, pero la selección la hace el usuario, no el
orchestrator por su cuenta.

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
| 2026-09-22 | `75975cd` | `chore/agentic-foundation` | INC-002 — Administration selection UI. Piloto del `habitex-orchestrator` end-to-end: research → plan → 2 subtareas delegadas a `habitex-implementer` → validate independiente → review independiente (`habitex-reviewer`) → 1 fix cycle (HIGH: selección persistida sin scope de identidad) → re-review → checkpoint local. Sin push/merge. |
