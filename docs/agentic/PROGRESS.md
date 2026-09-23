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
independientemente revisado (0 findings). Checkpoint `10ec380` pusheado a
`origin/chore/agentic-foundation`. Ver detalle en "Último incremento
ejecutado" más abajo.

**INC-006 — Rental Terms**: **completo**, pusheado a
`origin/chore/agentic-foundation` (`1b1dc3a`). Ver detalle en
"Incremento anterior: INC-006" más abajo.

**INC-008 — Rental Activation (alcance restante)**: **completo**,
pusheado a `origin/chore/agentic-foundation` (`57b448c`). Ver detalle en
"Incremento anterior: INC-008" más abajo.

**INC-009 — Rental lifecycle completion**: **completo** (frontend-only —
`cancelDraft`/`startEnding`/`end` en `RentalRepository`, ninguna requirió
cambios de backend; `cancelDraft` gateado por `useManagementGate`,
`startEnding`/`end` deliberadamente NO gateados, por asimetría real del
backend: `cancel_draft_rental` usa `can_manage_administration()`,
`start_ending_rental`/`end_rental` usan solo
`has_administration_management_role()`; confirmación inline de dos pasos
para Cancelar/Terminar arriendo, sin Modal nuevo), implementado, validado
e independientemente revisado (0 BLOCKER/HIGH; 1 LOW no bloqueante
registrado). Checkpoint local pendiente de push. Ver detalle en "Último
incremento ejecutado" más abajo.

## Estado

`INC-009 completo, checkpoint local pendiente de push —
INC-001/003/004/006/008 pusheados`.

- INC-001 (backend + frontend): **completo y pusheado** (`89d7e22`,
  `59778fc`).
- INC-003 (frontend, sin backend gate): **completo y pusheado** (`a859e6c`).
- INC-004: **completo y pusheado** (`10ec380`). Gate UX-only de
  expiración/capacidad
  (`hasManagementAccess`/`hasRelationshipCapacity`/`useManagementGate` en
  `administration`, `activeRelationshipCount`/`RentalRepository.activate`/
  `useActivateRental` en `rentals`) sobre las acciones de creación (property/
  room/parking/rental draft) y sobre la activación de `RentalRelationship`
  — implementado, validado de forma independiente, revisado por
  `habitex-reviewer` (contexto independiente, 0 BLOCKER/HIGH/MEDIUM/LOW), y
  checkpointed y pusheado tras aprobación humana (ver "Último checkpoint").
- INC-006: **completo y pusheado** (`1b1dc3a`). Un rental `DRAFT` puede
  recibir sus términos (fecha real/tracking, día y timing de pago, monto
  de renta, modo de administración, responsabilidad de utilities) desde
  una acción nueva ("Completar términos") en la lista de rentals, sin
  necesidad de una vista de detalle general (decisión de producto ya
  tomada en la reconciliación INC-004/INC-008) — implementado, validado
  de forma independiente, revisado por `habitex-reviewer` (contexto
  independiente, vía Supabase MCP read-only en vivo: 0 BLOCKER/HIGH, 2
  LOW + 1 MEDIUM registrados, no bloqueantes), checkpointed y pusheado
  tras aprobación humana.
- INC-008: **completo y pusheado** (`57b448c`). Termina la UX de
  activación que INC-004 dejó deliberadamente en un fallback genérico:
  mapeo de errores nuevo (`terms_incomplete` para
  `RENTAL_TERMS_INCOMPLETE`/`INITIAL_TERM_VERSION_REQUIRED`,
  `already_active` para `RENTAL_NOT_DRAFT`, `subject_in_use` para
  `RENTAL_SUBJECT_ALREADY_IN_USE`); gate proactivo real (no heurístico)
  de "¿tiene este DRAFT sus términos completos?" en la lista; fix del LOW
  de INC-006 (read-only de `/rentals/:id/terms` respeta
  `relationship.status`). Implementado, validado, revisado (0 BLOCKER/
  HIGH, 1 LOW no bloqueante), checkpointed y pusheado tras aprobación
  humana.
- INC-009: **completo**. `RentalRepository` gana `cancelDraft`/
  `startEnding`/`end` (`cancel_draft_rental`/`start_ending_rental`/
  `end_rental`, ya desplegados, cero cambios de backend). Autorización
  replicada exactamente como está desplegada — no "por consistencia":
  `cancelDraft` respeta `useManagementGate` (el RPC usa
  `can_manage_administration()`); `startEnding`/`end` deliberadamente
  NO lo respetan (esos RPCs usan solo `has_administration_management_role()`
  — un owner puede cerrar un arriendo existente aunque su suscripción
  haya vencido, confirmado como diseño intencional del backend, no un
  descuido). UX por status en la lista: `DRAFT` gana "Cancelar" (además
  de lo ya existente); `ACTIVE` gana "Iniciar cierre" (un clic, sin
  confirmación — no es terminal); `ENDING` gana "Terminar arriendo"
  (confirmación inline de dos pasos); `ENDED`/`CANCELLED` sin acción
  nueva. Confirmación de dos pasos sin Modal/Dialog nuevo (decisión de
  producto explícita) — dos botones distintos ("Confirmar.../Volver"),
  foco movido al botón de confirmación, permanece en estado de
  confirmación si la RPC rechaza (nunca resetea silenciosamente).
  `end_rental` se llama sin `p_actual_end_date` (usa el default del
  backend, `CURRENT_DATE` — sin date picker, fuera de alcance).
  Implementado, validado de forma independiente, revisado por
  `habitex-reviewer` (contexto independiente, vía Supabase MCP read-only
  en vivo — re-verificó las 3 funciones de autorización y confirmó la
  asimetría exactamente como se investigó: 0 BLOCKER/HIGH, 1 LOW no
  bloqueante registrado), checkpointed localmente (ver "Último
  checkpoint").

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
| INC-004 — Capacity & expiration gating (`useManagementGate`, `activeRelationshipCount`, `RentalRepository.activate`, `useActivateRental`, gate en creación de property/room/parking/rental draft y en activación de rental) | done — implementado (2 rondas: primitivas+rentals, luego properties/parking), validado, revisado (0 fix cycles necesarios), checkpoint `10ec380` pusheado |
| INC-008 — reconciliación de alcance tras INC-004 (`HABITEX_COMPLETION_PLAN.md` reescrito: scope reducido, dependencia dura de INC-006, "vista de detalle" retirada, INC-009 clarificado) | done — análisis + reescritura de plan, sin cambios de código |
| INC-006 — Rental Terms (`RentalTermsRepository`, `RentalRepository.updateSchedule`, `useSaveRentalTerms`, `useRentalTermVersion`, `/rentals/:id/terms`, acción "Completar términos" en la lista) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 2 LOW + 1 MEDIUM registrados, no bloqueantes), checkpoint `1b1dc3a` pusheado |
| INC-008 — Rental Activation, alcance restante (mapeo de errores `terms_incomplete`/`already_active`/`subject_in_use`, readiness real de términos, gate proactivo en la lista, fix del LOW de INC-006 en `RentalTermsPage`) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado), checkpoint `57b448c` pusheado |
| INC-009 — Rental lifecycle completion (`RentalRepository.cancelDraft/startEnding/end`, `RentalLifecycleError`, 3 hooks nuevos, confirmación inline de dos pasos en `RentalListCard`, autorización asimétrica respetada exactamente) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado), checkpoint local pendiente de push |

## Blockers

Ninguno técnico ni de aprobación en este momento. INC-001 (`89d7e22`,
`59778fc`), INC-003 (`a859e6c`), INC-004 (`10ec380`), INC-006 (`1b1dc3a`)
e INC-008 (`57b448c`) ya están en `origin/chore/agentic-foundation` —
HEAD y origin sincronizados. El nuevo checkpoint de INC-009 (ver "Último
checkpoint") sigue pendiente de revisión humana antes de push.

## Último incremento ejecutado

**INC-009 — Rental lifecycle completion**
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-009) — completa
la máquina de estados del rental más allá de la activación:
`cancel_draft_rental`/`start_ending_rental`/`end_rental`, las tres ya
desplegadas y sin uso previo desde el frontend.

- **RESEARCH GATE**: resuelto sin escalar — las 3 RPCs re-verificadas en
  vivo contra la BD real (no solo el advisor de seguridad, el cuerpo
  completo de cada función). **Hallazgo central, explícitamente pedido
  por el usuario para verificar**: `cancel_draft_rental` usa
  `can_manage_administration()` (rol + suscripción); `start_ending_rental`
  y `end_rental` usan solo `has_administration_management_role()` (rol,
  **sin** chequeo de suscripción) — asimetría real e intencional del
  backend, no un descuido: un owner/manager puede cerrar un arriendo
  existente aunque `management_access_until` ya haya pasado.
- **Máquina de estados real derivada del backend** (distinta del diagrama
  lineal asumido inicialmente): `end_rental` acepta `ACTIVE` **o**
  `ENDING` como origen — un rental puede terminar directamente desde
  `ACTIVE`, saltándose `ENDING`. El backend soporta esto; **la UX de
  Habitex no lo expone** (decisión de producto explícita, ver abajo).
- **Qué se agregó**:
  - `RentalRepository.cancelDraft`/`.startEnding`/`.end` — llamadas RPC
    directas, mismo patrón que `.activate`, sin mapping nuevo de fila
    (reutiliza `toRentalRelationship`/`firstRow`).
  - `RentalLifecycleErrorCode`/`RentalLifecycleError` (tipo nuevo,
    separado de `RentalActivationError` — familia de excepciones
    distinta): `management_access_required` (`MANAGEMENT_ACCESS_REQUIRED`,
    solo cancel), `not_draft` (`ONLY_DRAFT_CAN_BE_CANCELLED`),
    `not_active` (`RENTAL_NOT_ACTIVE`), `not_endable`
    (`RENTAL_NOT_ENDABLE`), `end_before_start` (`END_BEFORE_START`,
    alcanzable porque `real_start_date` puede ser una fecha futura).
    `RENTAL_NOT_FOUND`/`ADMINISTRATION_ROLE_REQUIRED` quedan sin mapear
    (`unknown`) — este último confirmado inalcanzable hoy: MVP solo tiene
    rol `OWNER`, ningún `MANAGER` existe todavía.
  - 3 hooks nuevos (`useCancelDraftRental`/`useStartEndingRental`/
    `useEndRental`), mismo patrón que `useActivateRental`, invalidan
    `rentalQueryKeys.list(administrationId)`.
  - UX por status en `RentalListCard`/`RentalsPage`: `DRAFT` gana
    "Cancelar" (gateado por `useManagementGate`, reutilizado);
    `ACTIVE` gana "Iniciar cierre" (un clic, sin confirmación — no es
    terminal, **no** gateado por `useManagementGate`); `ENDING` gana
    "Terminar arriendo" (confirmación de dos pasos, **no** gateado por
    `useManagementGate`); `ENDED`/`CANCELLED` sin acción nueva.
    **Decisión de producto respetada**: no se expone "Terminar ahora"
    directo desde `ACTIVE` aunque el RPC lo permitiría — el flujo de
    Habitex es `ACTIVE → Iniciar cierre → ENDING → Terminar arriendo →
    ENDED`.
  - **Confirmación inline de dos pasos** (Cancelar/Terminar arriendo,
    sin Modal/Dialog nuevo — decisión de producto explícita): primer
    clic no llama al RPC, solo entra en estado de confirmación;
    reemplaza el botón original por dos botones nuevos y distintos
    ("Confirmar cancelación"/"Confirmar terminación", `variant=
    "destructive"`, y "Volver", `variant="secondary"`) — nunca un
    relabel del mismo botón. Foco movido al botón de confirmación al
    entrar en ese estado (`ref` + `useEffect`, verificado con
    `toHaveFocus()`). Si la RPC rechaza, permanece en estado de
    confirmación (no resetea silenciosamente) para reintentar sin
    volver a hacer clic en el botón original.
  - `end_rental` se llama sin `p_actual_end_date` — el default del
    backend (`CURRENT_DATE`) aplica; sin date picker, sin argumento de
    fecha desde el frontend (fuera de alcance por decisión de producto).
  - i18n: `rentals.json` (es/es-CO) — namespace `lifecycle.*` nuevo (CTAs
    + 6 mensajes de error), mantenidos idénticos.
- **Tests**: cobertura explícita de exactamente lo pedido — `DRAFT →
  CANCELLED`; `DRAFT → términos → ACTIVE → ENDING → ENDED` de punta a
  punta (extiende el test de integración ya existente de INC-008 en vez
  de duplicar su setup); primer clic no llama al RPC (ambos flujos de
  confirmación); clic de confirmación sí llama; "Volver" no llama;
  `ACTIVE` expone "Iniciar cierre" pero no "Terminar arriendo" (y
  viceversa para `ENDING`); `ENDED`/`CANCELLED` sin acción; acceso de
  gestión vencido bloquea Cancelar pero **no** bloquea Iniciar
  cierre/Terminar arriendo (tests explícitos simulando suscripción
  `EXPIRED`); rechazo de la RPC con estado de cliente obsoleto sigue
  mostrándose correctamente; invalidación/refetch tras éxito.
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó en vivo vía Supabase MCP read-only las 3 funciones de
  autorización y confirmó la asimetría exactamente como la investigación
  la había determinado) no encontró BLOCKER/HIGH.
- **Deuda no bloqueante registrada** (1 LOW del reviewer, sin fix loop
  por debajo del umbral BLOCKER/HIGH):
  - LOW: `RentalListCard.module.css` — la nueva clase `.lifecycleRow` es
    byte-idéntica a la ya existente `.activateRow` (mismo
    `display/flex-direction/gap/margin-top`). Sin impacto
    funcional/visual, es duplicación de CSS — debería reutilizar
    `.activateRow` en vez de duplicarla. Corrección trivial si se
    retoma este archivo.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 76 archivos /
  536 tests (0 fallos), 0 errores de lint (mismos 4 warnings
  preexistentes, no relacionados).
- **Human gates**: ninguno disparado — sin cambios de
  schema/RLS/grants/migrations/dependencias/arquitectura (confirmado por
  `git status`/`git diff --stat`, y por el reviewer vía MCP en vivo:
  definiciones de las 3 RPCs y de las funciones de autorización sin
  cambios respecto a lo investigado).
- **Seguridad verificada** (vía MCP read-only, por el reviewer):
  reconfirmó en vivo que `cancel_draft_rental` usa
  `can_manage_administration()` y que `start_ending_rental`/`end_rental`
  usan solo `has_administration_management_role()` — el gate del
  frontend replica esta asimetría exactamente (verificado con tests que
  simulan suscripción `EXPIRED` y comprueban que Iniciar cierre/Terminar
  arriendo siguen funcionales); confirmó que `ADMINISTRATION_ROLE_REQUIRED`
  es inalcanzable hoy (solo existe rol `OWNER` en `administration_members`).

### Incremento anterior: INC-008 — Rental Activation (alcance restante)
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-008 reescrita) —
termina la UX de activación que INC-004 dejó deliberadamente en un
fallback genérico, ahora que INC-006 hizo posible completar términos
reales. Marca este incremento como **COMPLETO** en el plan.

- **Qué se agregó**:
  - `RentalActivationErrorCode` extendido con `terms_incomplete`
    (mapea tanto `RENTAL_TERMS_INCOMPLETE` como
    `INITIAL_TERM_VERSION_REQUIRED` — mismo significado de cara al
    usuario), `already_active` (mapea `RENTAL_NOT_DRAFT` — reachable de
    verdad: dos pestañas, una activa mientras la otra sigue mostrando
    DRAFT), `subject_in_use` (mapea `RENTAL_SUBJECT_ALREADY_IN_USE` —
    reachable: nada impide crear dos DRAFT sobre el mismo rental
    subject hoy). `RENTAL_NOT_FOUND`/`PRIMARY_SUBJECT_REQUIRED`/
    `ACTIVE_TENANT_REQUIRED`/`ACTIVE_LESSOR_REQUIRED`/
    `PARKING_ALREADY_SUBLEASED` quedan deliberadamente sin mapear
    (`unknown`) — inalcanzables hoy (`create_rental_draft` ya garantiza
    subject/participantes; sublease requiere un flujo que no existe en
    el frontend) — verificado con un test explícito de que
    `PRIMARY_SUBJECT_REQUIRED` sigue cayendo a `unknown`.
  - `RentalTermsRepository.listRelationshipIdsWithTerms(ids)`: **un
    método nuevo en el repository ya existente de INC-006** (no un
    repository nuevo, no RPC) — una sola query `.in(...)` batched, sin
    N+1, que da la señal precisa (no heurística) de si ya existe una
    versión de términos para cada rental. Combinada con los 4 campos de
    horario/pago que ya vienen gratis en el `RentalRelationship` ya
    fetched (sin query nueva para eso), da exactamente las dos
    condiciones reales que el RPC verifica
    (`RENTAL_TERMS_INCOMPLETE`/`INITIAL_TERM_VERSION_REQUIRED`) — no una
    aproximación del lado del cliente.
  - Gate proactivo real en `RentalsPage`/`RentalListCard`: el botón
    "Activar" de un rental `DRAFT` ahora también se deshabilita con
    razón `termsIncomplete` cuando le faltan términos, apuntando al
    "Completar términos" que INC-006 ya puso justo ahí (sin UI nueva).
    Prioridad: management-access/capacidad (administration-wide, de
    INC-004) sobre terms-incomplete (por fila) — ambas mantienen su
    comportamiento previo intacto (verificado: los fixtures/tests de
    INC-004 para esos dos casos no cambiaron su intención).
  - **Regla de seguridad respetada explícitamente**: el gate proactivo
    nunca reemplaza la llamada real al RPC — clic en "Activar" siempre
    intenta `activate_rental_relationship`; si el estado del cliente
    estaba obsoleto (otra pestaña ya activó el mismo rental), el
    rechazo real del servidor se sigue mostrando correctamente vía el
    mecanismo reactivo ya existente de INC-004 — verificado con un test
    explícito ("stale client state": el gate dice listo, el RPC
    rechaza con `already_active`, el error se muestra igual).
  - Loop completo verificado de punta a punta con un test de
    integración nuevo (no solo piezas aisladas): DRAFT con horario+
    términos completos → "Activar" habilitado → clic → RPC real →
    éxito → invalidación → refetch → la lista muestra `ACTIVE`.
  - **Fix del LOW de INC-006**: `RentalTermsPage` ahora decide
    read-only vs. editable con `termVersion || relationship.status !==
    'DRAFT'` (antes solo miraba la versión de términos).
    `RentalTermsReadOnlyView` acepta `termVersion: RentalTermVersion |
    null` y muestra un mensaje explícito ("no disponible") para los
    campos financieros en vez de fallar cuando es `null`.
  - i18n: `rentals.json` (es/es-CO) — nuevas claves
    `activate.errors.{terms_incomplete,already_active,subject_in_use}`,
    `activate.termsIncompleteReasonBlocked`,
    `termsForm.readOnly.financialUnavailable`.
- **Tests**: nuevos/ampliados en `rentals` — mapeo de error (4 casos
  nuevos + confirmación de fallback para uno de los inalcanzables),
  repository (`listRelationshipIdsWithTerms`: vacío, match total,
  match parcial, error), hook nuevo (`useRentalTermsExistence`),
  `RentalListCard` (razón `termsIncomplete` + 3 mensajes de error
  nuevos), `RentalsPage` (habilitado cuando listo, bloqueado con razón
  cuando faltan términos + navegación a "Completar términos", estado de
  cliente obsoleto vs. rechazo real del servidor, loop completo
  éxito→invalidación→`ACTIVE`), `RentalTermsPage` (no-DRAFT sin versión
  de términos → read-only con mensaje "no disponible").
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó en vivo vía Supabase MCP read-only que
  `listRelationshipIdsWithTerms` usa la misma policy `rental_terms_select`
  ya existente, sin ampliar exposición, y confirmó independientemente que
  la cascada de invalidación de query funciona por prefijo de key sin
  wiring nuevo) no encontró BLOCKER/HIGH.
- **Deuda no bloqueante registrada** (1 LOW del reviewer, sin fix loop
  por debajo del umbral BLOCKER/HIGH):
  - LOW: si la query de `listRelationshipIdsWithTerms` falla (`isError`,
    no solo `isPending`), la fila cae en la razón `termsIncomplete` en
    vez de un estado neutral/desconocido — es puramente cosmético (el
    RPC sigue siendo la autoridad real, nunca se bypasea), caso raro
    (fallo de lectura, no de negocio), no bloqueante.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 73 archivos /
  483 tests (0 fallos), 0 errores de lint (mismos 4 warnings
  preexistentes, no relacionados).
- **Human gates**: ninguno disparado — sin cambios de
  schema/RLS/grants/migrations/dependencias/arquitectura (confirmado por
  `git status`/`git diff --stat`, y por el reviewer vía MCP en vivo:
  `rental_terms_select` sin cambios, sin nueva migration, `authenticated`
  con exactamente los mismos grants que antes).
- **Lo que INC-008 desbloquea ahora**: el flujo real DRAFT → términos →
  `ACTIVE` queda usable de punta a punta por primera vez en la app (antes
  de este incremento, activar un rental real siempre fallaba con el
  fallback genérico de `RENTAL_TERMS_INCOMPLETE`). Esto es lo que hace
  que **INC-009** (lifecycle: cancel/ending/end) sea ejecutable de forma
  realista de punta a punta — antes solo tenía el mecanismo (de INC-004)
  pero no una forma real de llegar a `ACTIVE` en la app.

### Incremento anterior: INC-006 — Rental Terms
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-006) — permite que
un rental `DRAFT` reciba sus términos (crear+leer, sin versionado/edición
en este incremento).

- **RESEARCH GATE**: resuelto sin escalar — confirmado vía Supabase MCP
  read-only que `rental_term_versions` **no tiene RPC**; sus policies
  (`rental_terms_insert/select/update/delete`) permiten escritura directa
  del cliente mientras el `rental_relationships` padre siga `DRAFT`
  (`EXISTS (... AND status='DRAFT' AND can_manage_administration(...))`),
  lectura más amplia vía `can_view_relationship`. Además se confirmó que
  "Rental Terms" en realidad son **dos escrituras separadas**, no una:
  (1) 4 columnas propias de `rental_relationships`
  (`real_start_date`/`tracking_start_date`/`payment_day`/`payment_timing`
  — ya parte del `RentalRelationship` domain type desde INC-004, pero sin
  nada que las escribiera todavía) vía UPDATE directo (RLS
  `rental_relationships_update_draft`, ya existente); y (2) un INSERT en
  `rental_term_versions`. Ninguna requiere RPC. **Sin HUMAN GATE de
  Supabase/schema/RLS/grants** — corrige además una afirmación incorrecta
  del plan original de INC-008 ("el RPC no lo exige técnicamente" — sí lo
  exige, ver reconciliación INC-004/INC-008 arriba).
- **Qué se agregó**:
  - `RentalRepository.updateSchedule(relationshipId, input)` (extiende el
    repository existente, mismo `RENTAL_COLUMNS`/mapeo que `activate`).
  - Nuevo dominio/repository `rental-terms.types.ts` +
    `supabase-rental-terms.repository.ts`: `RentalTermsRepository.create`
    (siempre `version_number: 1`, `effective_until: null` — solo primera
    versión, sin versionado) + `.getCurrent` (lectura). `special_terms`
    (jsonb) deliberadamente no expuesto — fuera de alcance.
  - `useSaveRentalTerms`: mutation que **secuencia** las dos escrituras
    (`updateSchedule` → `create`) — no son atómicas (no existe RPC que las
    envuelva, y no se autorizó crear uno). Si la primera falla, la
    segunda nunca se intenta. Si la primera tiene éxito y la segunda
    falla, se lanza un `SaveRentalTermsError` distinguible — la UI
    muestra un mensaje distinto ("fechas/pago ya guardados, falta solo el
    monto") en vez de implicar que no se guardó nada. Documentado como
    no-atomicidad conocida y aceptada, no como bug a corregir aquí.
  - `useRentalTermVersion` (lectura).
  - Nueva ruta `/rentals/:id/terms` → `RentalTermsPage`: si ya existe una
    versión de términos, renderiza un formulario **read-only** (sin botón
    de submit, no solo deshabilitado visualmente); si no existe, el
    formulario editable (React Hook Form + Zod, mismas convenciones que
    `AddRentalDraftForm`). Gateado por `useManagementGate` (reutilizado,
    no reimplementado) — sin gate de capacidad aquí (la capacidad solo
    aplica a la activación, no a completar términos de un DRAFT).
  - Acción nueva "Completar términos" en `RentalListCard` para filas
    `DRAFT`, independiente del botón "Activar" ya existente (ambos pueden
    coexistir en la misma fila).
  - **Decisión de producto ya tomada, respetada**: sin vista de detalle
    de rental — esta página es acotada a un solo propósito (términos),
    siguiendo el patrón ya existente de `RoomSetupPage`, no una vista
    general.
  - i18n: `rentals.json` (es/es-CO) — namespace `termsForm.*` completo
    (título, secciones, labels, validación, errores) + `list.completeTerms`.
- **Tests**: nuevos en `rentals` (`rental-terms.types` vía el repository
  test, `supabase-rental-terms.repository.test.ts`,
  `useRentalTermVersion.test.tsx`, `useSaveRentalTerms.test.tsx`,
  `RentalTermsPage.test.tsx`, ampliación de
  `supabase-rental.repository.test.ts`/`RentalListCard.test.tsx`).
  Cobertura verificada por el reviewer: escenario de falla parcial
  (primera escritura ok, segunda falla → error distinguible mostrado),
  escenario read-only-una-vez-creado (sin botón de submit, no solo
  deshabilitado), guardado exitoso + invalidación de query correcta.
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó políticas/grants reales contra Supabase MCP read-only, y
  releyó `activate_rental_relationship` para confirmar que sigue exigiendo
  la versión de términos de forma independiente) no encontró BLOCKER/HIGH.
- **Deuda no bloqueante registrada** (2 LOW + 1 MEDIUM del reviewer, sin
  fix loop por debajo del umbral BLOCKER/HIGH):
  - LOW: `RentalTermsPage`'s editable-vs-read-only branch decide solo por
    la ausencia/presencia de una versión de términos, no también por
    `relationship.status !== 'DRAFT'` — en la práctica inalcanzable hoy
    (activar ya exige que exista una versión de términos antes de poner
    `ACTIVE`, y RLS bloquea cualquier escritura real fuera de `DRAFT`
    igual), pero quedaría expuesto si una transición de estado futura
    (fuera de este incremento) dejara un rental no-`DRAFT` sin versión de
    términos.
  - LOW: el botón "Activar" en una fila `DRAFT` sigue clickeable antes de
    que existan términos (mostrará el fallback genérico de
    `RENTAL_TERMS_INCOMPLETE` desde INC-004) — aspereza de UX menor, no
    una regresión de este incremento; conectar ambos gates es candidato
    natural para el alcance restante de INC-008.
  - MEDIUM: el schema Zod de `rental-terms-form.ts` (boundary conditions:
    `trackingStartDate === realStartDate` debe pasar, un día antes debe
    fallar; `paymentDay` 0/32 deben fallar, 1/31 deben pasar; `rentAmount`
    negativo debe fallar, 0 debe pasar) está correctamente implementado
    (verificado por inspección + contra los `CHECK` reales de la DB) pero
    **sin test dedicado** que fije esos boundaries — sin regresión hoy,
    pero sin protección si alguien simplifica el `refine` más adelante.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 72 archivos /
  464 tests (0 fallos), 0 errores de lint (mismos 4 warnings preexistentes,
  no relacionados).
- **Human gates**: ninguno disparado — sin cambios de
  schema/RLS/grants/migrations/dependencias/arquitectura (confirmado por
  `git status`/`git diff --stat`, y por el reviewer vía MCP
  `has_table_privilege`/`pg_policies` en vivo).
- **Seguridad verificada** (vía MCP read-only, por el reviewer):
  `authenticated` tiene exactamente los grants esperados
  (INSERT/SELECT/UPDATE en `rental_term_versions`, UPDATE/SELECT en
  `rental_relationships`); ambas escrituras nuevas son llamadas directas
  de Supabase (`.insert(...)`/`.update(...)`), ninguna RPC; `activate_
  rental_relationship` confirmado sin tocar y sigue exigiendo
  `INITIAL_TERM_VERSION_REQUIRED` de forma independiente.

### Incremento anterior: INC-004 — Capacity & expiration gating
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

## Reconciliación INC-004/INC-008

Tras completar y pushear INC-004, se auditó su implementación real contra
los criterios de aceptación originales de **INC-008 — Rental Activation**
(P1, dependiente de INC-006 en el plan original) porque ambos incrementos
terminaron construyendo el mismo mecanismo de activación. Análisis
solicitado y aprobado explícitamente por el usuario; resultado:

- **Créditado a INC-004** (no se duplica en INC-008): integración con el
  RPC `activate_rental_relationship`, `RentalRepository.activate()`,
  `useActivateRental`, ciclo de vida de la mutation, invalidación de
  query, acción "Activar" a nivel de lista, reflejo de `ACTIVE` tras
  refetch, y el manejo de `MANAGEMENT_ACCESS_REQUIRED`/
  `RELATIONSHIP_CAPACITY_REACHED`.
- **Decisión de producto**: NO se construye una vista de detalle de
  rental. El texto original de INC-008 asumía una — retirado del plan (ver
  `HABITEX_COMPLETION_PLAN.md`, sección INC-008 reescrita). Activar desde
  la lista existente es suficiente para el MVP actual; una experiencia de
  detalle dedicada se reconsiderará más adelante, sin incremento nuevo
  creado para eso ahora.
- **INC-008 queda en el plan, con alcance reducido**: terminar la UX para
  las fallas de validación del RPC que INC-004 dejó en un fallback
  genérico a propósito (mínimo: `RENTAL_TERMS_INCOMPLETE`,
  `INITIAL_TERM_VERSION_REQUIRED`) — inspeccionando en el momento de
  ejecutarlo qué códigos siguen siendo alcanzables, sin construir UI para
  invariantes que `create_rental_draft` ya hace inalcanzables
  (`PRIMARY_SUBJECT_REQUIRED`/`ACTIVE_TENANT_REQUIRED`/
  `ACTIVE_LESSOR_REQUIRED`).
- **Corrección de un error en el plan original**: INC-008 decía "activar
  sin términos no tiene sentido de producto, aunque el RPC no lo exija
  técnicamente" — falso. Confirmado leyendo el cuerpo real del RPC durante
  la investigación de INC-004: el RPC sí exige términos completos
  (`RENTAL_TERMS_INCOMPLETE`/`INITIAL_TERM_VERSION_REQUIRED`). INC-006 es
  ahora una **dependencia dura** del resto de INC-008, no solo una
  recomendación de producto.
- **INC-009** (lifecycle: cancel/ending/end) clarificado sin cambiar su
  alcance: su dependencia técnica real en el mecanismo de activación ya
  está resuelta por INC-004; lo que le falta a INC-008 (copy de errores)
  no lo bloquea. La cadena real es INC-006 → (resto de INC-008) → un
  rental `ACTIVE` real de punta a punta; `cancel_draft_rental` (parte de
  INC-009) no depende de nada de esto porque opera sobre `DRAFT`.
- **Sin cambios de código** en esta reconciliación — solo
  `HABITEX_COMPLETION_PLAN.md` (sección INC-008 reescrita, nota de
  dependencia de INC-009 clarificada) y este archivo.

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
- **Contenido del checkpoint**: INC-009 —
  `RentalRepository.cancelDraft/startEnding/end`,
  `RentalLifecycleError`/`RentalLifecycleErrorCode`, 3 hooks nuevos
  (`useCancelDraftRental`/`useStartEndingRental`/`useEndRental`),
  confirmación inline de dos pasos en `RentalListCard`, autorización
  asimétrica (cancel gateado, start-ending/end no) replicada
  exactamente, i18n, tests, y esta actualización de `PROGRESS.md`.
- **Fecha**: 2026-09-23
- **Estado**: commiteado localmente, **pendiente de push** — push/merge
  nunca son automáticos en este workflow.
- **No incluido**: ningún cambio de Supabase/schema/RLS/grants/migrations
  (INC-009 confirmó que las 3 RPCs ya estaban desplegadas y no requerían
  ningún cambio de backend).

## Último resultado de validación

Medido sobre el resultado integrado de INC-009, ejecutado de forma
independiente por la sesión orquestadora y re-verificado por el reviewer
(incluyendo re-verificación en vivo vía Supabase MCP read-only de las 3
funciones de autorización):

| Check | Resultado |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errores, 4 warnings preexistentes (React Compiler + `watch()` de React Hook Form en `ParkingForm`/`AddFullPropertyForm`/`AddRoomRentalPropertyForm`/`AddRentalDraftForm`, no relacionados, no introducidos por este cambio) |
| `pnpm test -- --run` | PASS — 536/536, 76 archivos |
| `pnpm build` | PASS |

## Siguiente acción recomendada

Con INC-001, INC-002, INC-003, INC-004, INC-006, INC-008 e INC-009
completos, el ciclo de vida completo del rental (`DRAFT` → términos →
`ACTIVE` → `ENDING` → `ENDED`, más `DRAFT` → `CANCELLED`) es usable de
punta a punta en la app por primera vez. Ningún incremento restante del
plan depende técnicamente de esto. Candidatos sin dependencias técnicas
pendientes:

- **INC-005** — Fix dead Dashboard CTAs (sin dependencias).
- **INC-007** — Tenant invitation & claim (depende de INC-001).
- **INC-010** — Generic file upload/download primitive (sin dependencias
  técnicas; secuenciado antes de INC-011/INC-013 porque ambos lo
  consumen).
- **INC-017** — Corregir doc drift (sin dependencias).
- **INC-018** — Habilitar `leaked_password_protection` (sin dependencias
  técnicas, pero es config de Supabase Auth — dispara HUMAN GATE
  automático por tocar Auth).

La priorización final sigue siendo del usuario, no del orchestrator (ver
`SKILL.md` §"SELECT INCREMENT").

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
| 2026-09-23 | `10ec380` | `chore/agentic-foundation` | INC-004 — Capacity & expiration gating: `hasManagementAccess`/`hasRelationshipCapacity`/`useManagementGate` (administration), `activeRelationshipCount`/`RentalRepository.activate`/`RentalActivationError`/`useActivateRental` (rentals), UI de activación + gate en creación de property/room/parking/rental draft. Sin backend gate (RPC/RLS ya enforced; grant opcional declinado explícitamente). 2 rondas de `habitex-implementer` (primitivas+rentals, luego properties/parking). 0 fix cycles — 0 findings del reviewer. **Pusheado**. |
| 2026-09-23 | `92e3917` | `chore/agentic-foundation` | Reconciliación INC-004/INC-008: auditoría de la implementación real de INC-004 contra los criterios de aceptación originales de INC-008. `HABITEX_COMPLETION_PLAN.md` reescrito (INC-008 con alcance reducido y dependencia dura de INC-006; nota de dependencia de INC-009 clarificada) + actualización de `PROGRESS.md`. Documentación únicamente, sin cambios de código. INC-008 permanece **NO completo**. **Pusheado**. |
| 2026-09-23 | `1b1dc3a` | `chore/agentic-foundation` | INC-006 — Rental Terms: `RentalRepository.updateSchedule`, `RentalTermsRepository` (`create`/`getCurrent`, sin RPC), `useSaveRentalTerms` (secuencia no-atómica documentada, error distinguible en falla parcial), `useRentalTermVersion`, ruta `/rentals/:id/terms` (editable vs. read-only), acción "Completar términos" en `RentalListCard`. Sin backend gate (dos escrituras directas RLS-gated, sin RPC necesario). 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 2 LOW + 1 MEDIUM registrados, no bloqueantes. **Pusheado**. |
| 2026-09-23 | `57b448c` | `chore/agentic-foundation` | INC-008 — Rental Activation, alcance restante: `RentalActivationErrorCode` extendido (`terms_incomplete`/`already_active`/`subject_in_use`), `RentalTermsRepository.listRelationshipIdsWithTerms` (nuevo método, sin RPC), `useRentalTermsExistence`, gate proactivo real en `RentalsPage`/`RentalListCard` (sin reemplazar al RPC como autoridad — verificado con test de estado de cliente obsoleto), fix del LOW de INC-006 en `RentalTermsPage` (read-only respeta `relationship.status`). Loop DRAFT→términos→`ACTIVE` verificado de punta a punta. Sin backend gate. 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado. **Pusheado**. |
| 2026-09-23 | _(pendiente — este checkpoint)_ | `chore/agentic-foundation` | INC-009 — Rental lifecycle completion: `RentalRepository.cancelDraft/startEnding/end`, `RentalLifecycleError`/`RentalLifecycleErrorCode` (`not_draft`/`not_active`/`not_endable`/`end_before_start`/`management_access_required`), 3 hooks nuevos, confirmación inline de dos pasos (sin Modal nuevo) en `RentalListCard` para Cancelar/Terminar arriendo, "Iniciar cierre" de un clic para `ACTIVE`. Autorización asimétrica del backend respetada exactamente: `cancelDraft` gateado por `useManagementGate` (`can_manage_administration`), `startEnding`/`end` deliberadamente NO gateados (`has_administration_management_role` únicamente — verificado en vivo por el reviewer). `end_rental` llamado sin `p_actual_end_date` (default del backend). Sin backend gate/cambios. 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado (CSS duplicado). **Local, pendiente de push**. |
