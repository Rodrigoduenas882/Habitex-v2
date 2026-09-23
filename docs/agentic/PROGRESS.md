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
`origin/chore/agentic-foundation`. Ver detalle en "Incremento anterior:
INC-003" más abajo.

**INC-004 — Capacity & expiration gating**: **completo** (frontend-only,
sin backend gate — el RPC `activate_rental_relationship` y
`can_manage_administration()` ya enforce expiración/capacidad; sin nuevos
grants/migrations, declinado explícitamente), implementado, validado e
independientemente revisado (0 findings). Checkpoint local pendiente de
push. Ver detalle en "Último incremento ejecutado" más abajo.

## Estado

`INC-004 completo — checkpoint local pendiente de push`.

- INC-001 (backend + frontend): **completo y pusheado** (`89d7e22`,
  `59778fc`).
- INC-003 (frontend, sin backend gate): **completo y pusheado** (`a859e6c`).
- INC-004: **completo**. Gate UX-only de expiración/capacidad
  (`hasManagementAccess`/`hasRelationshipCapacity`/`useManagementGate` en
  `administration`, `activeRelationshipCount`/`RentalRepository.activate`/
  `useActivateRental` en `rentals`) sobre las acciones de creación (property/
  room/parking/rental draft) y sobre la activación de `RentalRelationship`
  — implementado, validado de forma independiente, revisado por
  `habitex-reviewer` (contexto independiente, 0 BLOCKER/HIGH/MEDIUM/LOW), y
  checkpointed localmente (ver "Último checkpoint").
- El checkpoint de INC-004 sigue pendiente de push/merge — push/merge
  nunca son automáticos en este workflow.

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
| INC-004 — Capacity & expiration gating (`useManagementGate`, `activeRelationshipCount`, `RentalRepository.activate`, `useActivateRental`, gate en creación de property/room/parking/rental draft y en activación de rental) | done — implementado (2 rondas: primitivas+rentals, luego properties/parking), validado, revisado (0 fix cycles necesarios), checkpoint local pendiente de push |

## Blockers

Ninguno técnico ni de aprobación en este momento. INC-001 (`89d7e22`,
`59778fc`) e INC-003 (`a859e6c`) ya están en
`origin/chore/agentic-foundation` — HEAD y origin sincronizados. El nuevo
checkpoint de INC-004 (ver "Último checkpoint") sigue pendiente de revisión
humana antes de push — push/merge nunca son automáticos en este workflow
(ver `SKILL.md` §"Reglas globales").

## Último incremento ejecutado

**INC-004 — Capacity & expiration gating**
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-004) — gating
UX-only de acciones de gestión según expiración de suscripción
(`management_access_until`) y capacidad de relaciones activas
(`active_relationship_limit`); el RPC/RLS del backend sigue siendo la
autoridad real, este incremento no cierra ningún gap de seguridad, solo
evita sorpresas tardías al usuario.

- **RESEARCH GATE**: resuelto sin escalar — confirmado vía Supabase MCP
  read-only que el backend ya enforce ambas reglas de forma autoritativa y
  ya desplegada:
  - Expiración: `has_management_access()` (status no `EXPIRED` y
    `management_access_until` nulo o no vencido) compuesto en
    `can_manage_administration()`, usado por `create_full_property_asset`,
    `create_room_asset`, `create_room_rental_property`,
    `create_parking_asset`, `create_rental_draft` y
    `activate_rental_relationship`.
  - Capacidad: `active_relationship_count()` (`status IN ('ACTIVE',
    'ENDING')` — definición única y autoritativa, resuelve la pregunta
    abierta del plan) enforced solo dentro de `activate_rental_relationship`
    (crear property/room/parking/draft nunca consume capacidad, correcto
    contra el product source of truth: "vacant properties/rooms must not
    consume active capacity").
  - RLS (`rental_relationships_update_draft`, `WITH CHECK (...  AND
    status='DRAFT')`) impide cualquier bypass directo de DRAFT→ACTIVE fuera
    del RPC — confirma que el backend es el límite de seguridad real, nunca
    el frontend.
  - Hallazgo de alcance: `report_payment`/`start_ending_rental`/
    `end_rental` NO pasan por `can_manage_administration` server-side (usan
    semántica distinta: visibilidad de participante o solo rol, sin chequeo
    de suscripción) — **excluidos explícitamente del gate** por decisión
    humana, para no contradecir el comportamiento real del backend.
  - **Grants nuevos declinados explícitamente** por el usuario —
    `active_relationship_count`/`relationship_capacity_available`/
    `has_management_access` siguen sin `EXECUTE` para `authenticated`; el
    frontend deriva todo del dato ya accesible bajo los grants existentes
    (`useSubscription` ya seleccionaba `activeRelationshipLimit`; el conteo
    activo se deriva de la lista de `rentals` ya fetched, scoped por RLS).
    **Sin HUMAN GATE de Supabase/schema/RLS/grants.**
- **Qué se agregó**:
  - Primitivas compartidas (dominio `administration`):
    `hasManagementAccess`/`hasRelationshipCapacity`
    (`management-access.ts`, puras, espejo documentado de las funciones SQL
    homónimas) + `useManagementGate` (hook, **fail-open** — nunca bloquea
    mientras carga o si falla la query — a propósito distinto del
    fail-closed de seguridad de `RequiresAccount`, porque esto es UX, no un
    gate de seguridad).
  - `activeRelationshipCount` (dominio `rentals`, ACTIVE+ENDING, espejo
    exacto de `active_relationship_count()`).
  - `RentalRepository.activate(relationshipId)` → RPC
    `activate_rental_relationship`; `RentalActivationError`/
    `RentalActivationErrorCode` (`management_access_required`/
    `capacity_reached`/`unknown`, mapeo espejo de `SessionAuthError` de
    auth — solo esos 2 códigos tienen copy específico, el resto de
    excepciones del RPC (`RENTAL_NOT_DRAFT`, `RENTAL_TERMS_INCOMPLETE`,
    etc.) caen a `unknown` a propósito, fuera de alcance de este
    incremento).
  - `useActivateRental` (mutation, invalida
    `rentalQueryKeys.list(administrationId)` en éxito).
  - UI: acción "Activar" en `RentalsPage`/`RentalListCard` para rentals
    `DRAFT` (Button deshabilitado + párrafo de razón, patrón ya existente
    de `RoomSetupPage`, sin primitive nuevo); gate del mismo tipo en
    `AddRentalDraftForm`, `AddFullPropertyForm`,
    `AddRoomRentalPropertyForm`, `ParkingForm`. Clic en "Activar" siempre
    llama al RPC real — el estado del gate del cliente nunca reemplaza la
    respuesta del servidor (verificado con un test explícito de "estado de
    cliente obsoleto, servidor rechaza").
  - **Excepción de alcance documentada**: `RoomSetupPage.tsx` queda sin
    gate en este incremento — no resuelve `administrationId` hoy (por
    diseño previo) y agregar ese plumbing nuevo se consideró fuera del
    alcance "mínimo" de este incremento. No es un olvido.
  - i18n: `administration.json` → `managementAccessGate.blocked`
    (compartido entre rentals/properties/parking); `rentals.json` →
    `activate.*` (cta, razón de capacidad, 3 mensajes de error). es/es-CO
    mantenidos idénticos.
- **Implementación en 2 rondas secuenciales** (`habitex-implementer`):
  ronda 1 = primitivas compartidas + todo `rentals` (activación, gate,
  UI, i18n); ronda 2 = gate reutilizado (sin reimplementar) en
  `AddFullPropertyForm`/`AddRoomRentalPropertyForm`/`ParkingForm`. Elegido
  secuencial (no paralelo) por la dependencia real entre rondas y el
  tamaño/alcance del incremento — `SCOPE/OVERLAP CHECK` confirmó además
  cero solapamiento de archivos entre ambas rondas.
- **Tests**: nuevos en `administration` (`management-access.test.ts`,
  `useManagementGate.test.tsx`), `rentals` (`rental.types.test.ts`,
  `useActivateRental.test.tsx`, repository, `RentalsPage`,
  `RentalListCard`, `AddRentalDraftForm`), `properties`
  (`AddFullPropertyForm.test.tsx`/`AddRoomRentalPropertyForm.test.tsx`
  nuevos), `parking` (`ParkingForm.test.tsx` ampliado). Cobertura
  explícitamente verificada por el reviewer: boundary de capacidad (count
  exactamente en el límite → bloqueado, `count < limit` → permitido),
  boundary de expiración (`managementAccessUntil` exacto, `>=` no `>`),
  `activeRelationshipLimit === null` → ilimitado, y el escenario de
  "estado de cliente obsoleto vs. rechazo real del servidor".
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó contra Supabase MCP read-only en vivo) no encontró ningún
  finding BLOCKER/HIGH/MEDIUM/LOW.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 68 archivos / 436
  tests (0 fallos), 0 errores de lint (mismos 4 warnings preexistentes de
  `watch()`/React Compiler, no relacionados).
- **Human gates**: ninguno disparado — sin cambios de
  schema/RLS/grants/migrations/dependencias/arquitectura (confirmado por
  ambos implementers vía `git status`/`git diff --stat`, y por el reviewer
  vía MCP `list_migrations` — mismas 51 migrations que al inicio).
- **Seguridad verificada** (vía MCP read-only, por el reviewer):
  `active_relationship_count`/`has_management_access` confirmadas SIN
  `EXECUTE` para `authenticated` (el frontend nunca las invoca); RLS de
  `rental_relationships_update_draft` confirma que `activate_rental_
  relationship` es el único camino real a `ACTIVE`.

### Incremento anterior: INC-003 — Trial/Subscription status visibility
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

- **SHA**: _(pendiente — se crea inmediatamente después de esta
  actualización de `PROGRESS.md`, en el mismo commit)_
- **Branch**: `chore/agentic-foundation`
- **Contenido del checkpoint**: INC-004 — primitivas de gate
  (`management-access.ts`, `useManagementGate`), `activeRelationshipCount`,
  `RentalRepository.activate` + `RentalActivationError`, `useActivateRental`,
  UI de activación en `RentalsPage`/`RentalListCard`, gate en
  `AddRentalDraftForm`/`AddFullPropertyForm`/`AddRoomRentalPropertyForm`/
  `ParkingForm`, i18n, tests, y esta actualización de `PROGRESS.md`.
- **Fecha**: 2026-09-23
- **Estado**: commiteado localmente, **pendiente de push** — push/merge
  nunca son automáticos en este workflow.
- **No incluido**: ningún cambio de Supabase/schema/RLS/grants/migrations
  (INC-004 confirmó que no se necesitaba ninguno; el grant opcional
  discutido en el research gate fue declinado explícitamente).

## Último resultado de validación

Medido sobre el resultado integrado de INC-004 (2 rondas), ejecutado de
forma independiente por la sesión orquestadora y re-verificado por el
reviewer:

| Check | Resultado |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errores, 4 warnings preexistentes (React Compiler + `watch()` de React Hook Form en `ParkingForm`/`AddFullPropertyForm`/`AddRoomRentalPropertyForm`/`AddRentalDraftForm`, no relacionados, no introducidos por este cambio) |
| `pnpm test -- --run` | PASS — 436/436, 68 archivos |
| `pnpm build` | PASS |

## Siguiente acción recomendada

**Revisión humana del checkpoint de INC-004 antes de push/merge.** INC-001
e INC-003 (backend + frontend) ya están en `origin`.

Con INC-001, INC-003 e INC-004 completos, los siguientes incrementos del
`HABITEX_COMPLETION_PLAN.md` quedan sin dependencias técnicas pendientes:

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

Nota: **INC-008 (Rental Activation)** ya no es un incremento separado en el
sentido en que lo describía el plan original — la acción mínima de
activar (`activate_rental_relationship`) fue construida como parte de
INC-004 (alcance ampliado, aprobado explícitamente por el usuario para no
partir el incremento). Si se llega a INC-008/INC-009 más adelante, ya
existe `useActivateRental`/`RentalRepository.activate` para reutilizar —
falta revisar si INC-008 todavía aporta algo más allá de lo ya cubierto
(p. ej. una vista de detalle de rental) antes de darlo por completo.

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
| 2026-09-23 | _(pendiente — este checkpoint)_ | `chore/agentic-foundation` | INC-004 — Capacity & expiration gating: `hasManagementAccess`/`hasRelationshipCapacity`/`useManagementGate` (administration), `activeRelationshipCount`/`RentalRepository.activate`/`RentalActivationError`/`useActivateRental` (rentals), UI de activación + gate en creación de property/room/parking/rental draft. Sin backend gate (RPC/RLS ya enforced; grant opcional declinado explícitamente). 2 rondas de `habitex-implementer` (primitivas+rentals, luego properties/parking). 0 fix cycles — 0 findings del reviewer. **Local, pendiente de push**. |
