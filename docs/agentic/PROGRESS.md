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

**INC-009 — Rental lifecycle completion**: **completo**, pusheado a
`origin/chore/agentic-foundation` (`1e79c3b`). Ver detalle en
"Incremento anterior: INC-009" más abajo.

**INC-010 — Generic file upload/download primitive**: **completo**,
pusheado a `origin/chore/agentic-foundation` (`14eb8b9` backend gate,
`e29eed4` primitive de frontend). Ver detalle en "Incremento anterior:
INC-010" más abajo.

**INC-011 — Contract management (sin firma avanzada)**: **completo**
(frontend-only, sin cambios de backend — las 3 RPCs ya desplegadas
(`register_habitex_generated_contract`/`register_external_signed_contract`/
`attach_signed_contract_copy`) cubren toda la creación/firma; "marcar
compartido" y "terminar" son UPDATE directo, RLS-gated, guardado por
status del lado del cliente ya que la RLS no lo restringe), implementado,
validado e independientemente revisado (0 BLOCKER/HIGH; 1 MEDIUM resuelto
en un review-fix del 2026-09-25, ver detalle en "Incremento anterior:
INC-011" más abajo). Checkpoints `f1d6ae1` + `6cb0f71` pusheados a
`origin/chore/agentic-foundation`.

**INC-012 — Charges**: **completo** (frontend-only, sin cambios de
backend — `generate_rent_charges` ya desplegado, idempotente, y
`public.charge_balances` ya provee `paid_amount`/`balance`/
`financial_status` derivados server-side), implementado, validado e
independientemente revisado (0 BLOCKER/HIGH; 2 LOW no bloqueantes
registrados). Checkpoint local pendiente de push. Ver detalle en "Último
incremento ejecutado" más abajo.

## Estado

`INC-012 completo, checkpoint local pendiente de push.
INC-001/003/004/006/008/009/010/011 pusheados`.

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
- INC-009: **completo y pusheado** (`1e79c3b`). `RentalRepository` gana `cancelDraft`/
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
  bloqueante registrado), checkpointed y pusheado tras aprobación humana.
- INC-010: **completo y pusheado** (`14eb8b9` backend gate, `e29eed4`
  primitive de frontend). Nuevo `features/documents/` (`FileRepository`
  `upload`/`download`/`remove`, sin producto/UI), consumido directamente
  por INC-011.
- INC-011: **completo y pusheado** (`f1d6ae1`, más un review-fix
  `6cb0f71`). Nuevo `features/contracts/` — aggregate propio
  (dominio/infraestructura/aplicación/presentación/composition, no
  plegado en `features/rentals/`). `ContractRepository` envuelve
  exactamente las 3 RPCs ya desplegadas para creación/firma (nunca un
  INSERT directo) más dos UPDATE directos guardados por status
  (`markShared`: solo desde `GENERATED`; `terminate`: solo desde
  `SIGNED`) para las dos transiciones sin RPC — la RLS de `contracts` no
  restringe qué transición de status es válida más allá de "no
  `TERMINATED`", así que ese guardado es responsabilidad exclusiva del
  frontend, documentado como tal. SHA-256 real calculado con
  `crypto.subtle.digest` (sin dependencia nueva) para
  `register_habitex_generated_contract`, que lo exige. `terms_snapshot`
  construido desde `RentalTermVersion` (INC-006) + los campos de horario
  propios de `RentalRelationship`, forma explícita y documentada, nunca
  una serialización ciega. Subida/registro nunca es una sola mutation
  atómica — el archivo ya subido se reutiliza en un reintento tras un
  fallo de registro, nunca se vuelve a subir (verificado con test
  explícito). Reutiliza `FileRepository` de INC-010 sin duplicar
  (`purpose: CONTRACT_GENERATED`/`CONTRACT_SIGNED`); extendió
  `FileRepository` con un `getById` aditivo (necesario porque los
  contratos solo guardan ids de archivo, no metadata completa). Sin
  vista de detalle general — ruta angosta y de propósito único
  `/rentals/:id/contracts` (mismo principio que `/rentals/:id/terms` de
  INC-006), acción "Contratos" en la lista solo para `ACTIVE`/`ENDING`/
  `ENDED` (no `DRAFT`/`CANCELLED`). Creación de contrato ofrecida solo
  para `ACTIVE`/`ENDING` — **decisión de producto/UX explícita, no
  autorización real** (el RPC no exige ningún status de rental).
  `ENDED` conserva lectura/descarga histórica sin sección de creación.
  Acciones por status exactas: `GENERATED` → marcar compartido + adjuntar
  copia firmada; `SHARED` → adjuntar copia firmada; `SIGNED` → terminar
  (con confirmación inline de dos pasos, agregada por el review-fix);
  `TERMINATED`/`DRAFT` → ninguna. `useManagementGate` aplicado de forma
  uniforme a las 5 acciones mutantes (sin la asimetría de INC-009 — el
  RPC/RLS de contracts usa `can_manage_administration()` en todos los
  casos); acceso vencido nunca oculta la lista/descarga de solo lectura.
  Sin UI de eliminación de contrato/archivo en ningún lugar (no existe
  policy `DELETE` sobre `contracts`, y los archivos referenciados están
  protegidos por FK `RESTRICT`). Sin firma digital avanzada, sin
  `acceptances`/`secure_actions`/`communication_events`, sin motor de
  generación de documentos — "Habitex-generado" significa que el owner
  sube un documento real vía el mismo flujo de subida que el flujo
  externo, no que la app genera contenido automáticamente. Implementado,
  validado de forma independiente, revisado por `habitex-reviewer`
  (contexto independiente, re-verificó en vivo vía Supabase MCP
  read-only las policies/RPCs de `contracts`, confirmó que los guardados
  de status y la ausencia de INSERT directo son reales, no solo
  documentados: 0 BLOCKER/HIGH, 1 MEDIUM); el MEDIUM (sin confirmación de
  dos pasos en "Terminar contrato") se resolvió en un review-fix
  separado (`6cb0f71`, revisado independientemente de nuevo: 0
  BLOCKER/HIGH/MEDIUM/LOW nuevos). Ambos commits pusheados tras
  aprobación humana.
- INC-012: **completo**. Nuevo `features/charges/` — aggregate propio
  (dominio/infraestructura/aplicación/presentación/composition, no
  plegado en `features/rentals/`). `ChargeRepository` tiene exactamente
  dos métodos: `listByRelationship` (dos `SELECT` directos separados
  contra `public.charges` y la vista `public.charge_balances` — sin FK
  registrada entre ambas para embedding de PostgREST, mezcladas por id
  en el adapter; `paidAmount`/`balance`/`financialStatus` vienen
  siempre de la vista, nunca calculados en el frontend) y
  `generateRentCharges` (envuelve el RPC ya desplegado
  `generate_rent_charges`, llamado solo con `p_relationship_id` para que
  aplique el default `CURRENT_DATE` del backend — sin lógica de
  periodos/mes/monto/versión de términos en TypeScript, el RPC es dueño
  de todo eso). El RPC es idempotente (índice único +
  `ON CONFLICT DO NOTHING`) — un resultado de 0 filas nuevas se trata
  como éxito, nunca como error, con copy distinta ("N cargo(s)
  generado(s)" vs. "no había cargos nuevos por generar"). Mapeo de error
  tipado deliberadamente acotado a los 3 códigos realmente alcanzables
  (`management_access_required`/`not_chargeable`/
  `billing_configuration_incomplete`), el resto cae a `unknown`. Sin
  vista de detalle general — ruta angosta `/rentals/:id/charges` (mismo
  principio que `/rentals/:id/terms` y `/rentals/:id/contracts`), acción
  "Cargos" en la lista solo para `ACTIVE`/`ENDING`/`ENDED` (no
  `DRAFT`/`CANCELLED`) — regla de UX de producto, no de autorización (el
  RPC tiene su propia verificación de status, `RENTAL_NOT_CHARGEABLE`,
  que coincide pero no es lo que la UI aplica). `ENDED` puede seguir
  generando cargos (el RPC lo permite explícitamente — no se asumió que
  "terminado" implica "nunca más generar"). "Generar cargos de renta"
  gateado por `useManagementGate` (reutilizado, sin lógica nueva); acceso
  vencido deshabilita la generación pero nunca oculta el historial de
  cargos de solo lectura (`charges_select` RLS no exige gestión, solo
  membresía/participación). Sin creación de cargos manuales
  (`ADMINISTRATION`/`UTILITY`/`OTHER`/RENT manual) aunque la RLS de
  `charges` lo permitiría vía INSERT directo — decisión humana explícita
  de excluirlo de este incremento. Sin llamada a
  `generate_fixed_utility_charges`. **Sin ninguna UI de editar/
  eliminar/cancelar/anular cargo** — decisión deliberada dado que la
  policy `charges_update_manager` no protege `amount` contra un balance
  ya asignado, así que este incremento nunca expone esa superficie. Sin
  UI de pagos/reporte/confirmación/allocation/recibos (INC-013/014/015)
  — mostrar `financial_status`/`paid_amount`/`balance` derivados de
  `charge_balances` es lectura, no implementación de Payments. Dinero:
  `number` plano (mismo patrón ya establecido para `rent_amount`), COP
  única moneda, `.tabular-nums` por `DESIGN.md` §4, sin BigDecimal ni
  capa de minor-units. Implementado (1 ronda), validado de forma
  independiente, revisado por `habitex-reviewer` (contexto independiente,
  re-verificó en vivo vía Supabase MCP read-only el cuerpo completo del
  RPC, la vista `charge_balances` con `security_invoker=true` vía
  `pg_class.reloptions`, y el grant a `authenticated` vía
  `has_table_privilege` — no vía `information_schema.role_table_grants`,
  que ya dio un falso negativo en INC-010: 0 BLOCKER/HIGH, 2 LOW no
  bloqueantes registrados), checkpointed localmente (ver "Último
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
| INC-009 — Rental lifecycle completion (`RentalRepository.cancelDraft/startEnding/end`, `RentalLifecycleError`, 3 hooks nuevos, confirmación inline de dos pasos en `RentalListCard`, autorización asimétrica respetada exactamente) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado), checkpoint `1e79c3b` pusheado |
| INC-010 — backend gate (RESEARCH GATE encontró `storage.objects` sin policies; migration autorada, revisada, aplicada y verificada) | done — aplicada en producción vía `supabase db push --yes` ejecutado por el usuario, verificada vía MCP read-only, commiteada y pusheada (`14eb8b9`) |
| INC-010 — primitive de frontend (`features/documents/`: `FileRepository` upload/download/remove, paths únicos, sin producto/UI) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado), checkpoint `e29eed4` pusheado |
| INC-011 — Contract management (`features/contracts/`: `ContractRepository` sobre las 3 RPCs + 2 UPDATE guardados, SHA-256 real, `terms_snapshot`, subida-luego-registro sin re-subida en reintento, ruta `/rentals/:id/contracts`) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 1 MEDIUM **resuelto** en review-fix del 2026-09-25), checkpoints `f1d6ae1` + `6cb0f71` pusheados |
| INC-012 — Charges (`features/charges/`: `ChargeRepository` con `listByRelationship`/`generateRentCharges`, `charge_balances` como fuente de verdad de balance/estado financiero, ruta `/rentals/:id/charges`) | done — implementado (1 ronda), validado, revisado (0 fix cycles — 0 BLOCKER/HIGH; 2 LOW no bloqueantes registrados), checkpoint local pendiente de push |

## Blockers

Ninguno técnico ni de aprobación en este momento. INC-001 (`89d7e22`,
`59778fc`), INC-003 (`a859e6c`), INC-004 (`10ec380`), INC-006 (`1b1dc3a`),
INC-008 (`57b448c`), INC-009 (`1e79c3b`), INC-010 (`14eb8b9`, `e29eed4`)
e INC-011 (`f1d6ae1`, `6cb0f71`) ya están en
`origin/chore/agentic-foundation` — HEAD y origin sincronizados. El
nuevo checkpoint de INC-012 (ver "Último checkpoint") sigue pendiente de
revisión humana antes de push.

## Último incremento ejecutado

**INC-012 — Charges** (`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección
INC-012) — generar cargos de renta reales sobre una relación activa a
partir de sus términos vigentes, y listarlos junto con su estado
financiero derivado (pendiente/vencido/parcial/pagado).

- **RESEARCH GATE**: resuelto sin escalar — modelo de datos completo de
  `public.charges` re-verificado en vivo (sin columna `status`, sin
  policy `DELETE`, `RLS`: `charges_select`/`can_view_relationship`,
  `charges_insert_manager`/`charges_update_manager`/
  `can_manage_administration`), más el cuerpo completo (no solo la firma)
  de `generate_rent_charges` leído vía `pg_get_functiondef`: bloquea la
  fila del rental, exige `can_manage_administration`
  (`MANAGEMENT_ACCESS_REQUIRED`), exige status
  `ACTIVE`/`ENDING`/`ENDED` (`RENTAL_NOT_CHARGEABLE`), exige
  `tracking_start_date`/`payment_day` (`RENTAL_BILLING_CONFIGURATION_INCOMPLETE`),
  itera mes a mes seleccionando la `rental_term_versions` vigente en cada
  periodo, e inserta con `ON CONFLICT DO NOTHING` respaldado por el
  índice único `charges_recurring_source_uq` — **idempotente**, una
  llamada repetida es siempre segura y puede legítimamente devolver 0
  filas nuevas. Hallazgo clave: **`public.charge_balances`** ya existe
  como vista (`security_invoker=true`, confirmado vía
  `pg_class.reloptions`, no vía `information_schema.views` que devolvió
  `view_definition: null` para el rol read-only del MCP — mismo tipo de
  falso negativo ya documentado en INC-010) con `SELECT` otorgado a
  `authenticated` (confirmado vía `has_table_privilege`, no vía
  `information_schema.role_table_grants`) — computa `paid_amount`/
  `balance`/`financial_status` (`PENDING`/`OVERDUE`/`PARTIAL`/`PAID`)
  server-side a partir de `payment_allocations`/`payments.status =
  'CONFIRMED'`, y ya es útil hoy (antes de que exista INC-013 en el
  frontend) porque con cero pagos reales sigue devolviendo
  `PENDING`/`OVERDUE` correctos. Sin FK registrada entre `charges` y
  `charge_balances` para PostgREST embedding — confirmado, dos `SELECT`
  separados es la única forma correcta de leerlas juntas. **Sin HUMAN
  GATE de Supabase/schema/RLS — YES, backend sin cambios.**
- **Decisiones humanas explícitas** (ver mensaje "HUMAN DECISIONS —
  INC-012"): sin creación de cargos manuales en este incremento (aunque
  la RLS lo permitiría vía INSERT directo — alcance de producto futuro);
  usar `charge_balances` ahora mismo para el estado financiero, aunque
  `PARTIAL`/`PAID` no sean alcanzables todavía sin INC-013 en el
  frontend.
- **Qué se agregó**:
  - Nuevo `features/charges/` — aggregate propio con las 4 capas que su
    responsabilidad justifica (domain/infrastructure/application/
    presentation + composition), **no plegado en `features/rentals/`**.
  - `ChargeRepository`, exactamente dos métodos:
    - `listByRelationship`: dos `SELECT` directos separados
      (`public.charges` + `public.charge_balances`, ambos scoped por
      `rental_relationship_id`), mezclados por id en el adapter —
      `paidAmount`/`balance`/`financialStatus` **siempre** vienen de la
      vista, nunca calculados en TypeScript (verificado por el reviewer
      con grep: ningún cálculo de balance en el frontend).
    - `generateRentCharges`: envuelve `generate_rent_charges`, llamado
      **solo con `p_relationship_id`** (nunca `p_through_date`, así
      aplica el default `CURRENT_DATE` del backend — mismo patrón que
      `end_rental` omitiendo `p_actual_end_date` en INC-009). Confirmado
      por grep: cero lógica de periodos/mes/monto/versión de términos en
      todo `src/features/charges/` — el RPC es dueño de todo eso. Un
      resultado de 0 filas nuevas se mapea a `{ createdCount: 0 }`, un
      éxito, nunca un error.
  - Mapeo de error tipado deliberadamente acotado — solo los 3 códigos
    realmente alcanzables (`management_access_required`/
    `not_chargeable`/`billing_configuration_incomplete`); todo lo demás
    (incluido `RENTAL_RELATIONSHIP_NOT_FOUND`, inalcanzable en el flujo
    real ya que el id siempre viene de una lista ya cargada) cae a
    `unknown`.
  - Sin vista de detalle general — ruta angosta `/rentals/:id/charges`
    (mismo principio que `/rentals/:id/terms` y `/rentals/:id/contracts`),
    acción "Cargos" nueva en `RentalListCard` solo para
    `ACTIVE`/`ENDING`/`ENDED` (no `DRAFT`/`CANCELLED`) — **regla de UX de
    producto, no de autorización real** (el RPC tiene su propia
    verificación `RENTAL_NOT_CHARGEABLE`, que coincide pero no es lo que
    la UI aplica).
  - **`ENDED` puede seguir generando cargos** — el RPC lo permite
    explícitamente (cargos finales de un arriendo terminado); el
    frontend no asume que "terminado" implica "nunca más generar".
  - "Generar cargos de renta" gateado por `useManagementGate`
    (reutilizado sin lógica nueva); acceso de gestión vencido deshabilita
    la generación con una razón visible pero **nunca oculta** el
    historial de cargos de solo lectura (`charges_select` no exige
    gestión, solo membresía/participación — mismo principio ya
    establecido en `features/contracts/`/`features/documents/`). Botón
    deshabilitado mientras la mutación está pendiente (sin doble envío).
    Éxito invalida/refetch la query de cargos de la relación.
  - **Sin creación de cargos manuales** de ningún tipo
    (`ADMINISTRATION`/`UTILITY`/`OTHER`/RENT manual) — decisión humana
    explícita, aunque `charges_insert_manager` lo permitiría. **Sin
    llamada a `generate_fixed_utility_charges`** en ningún lugar.
  - **Sin ninguna UI de editar/eliminar/cancelar/anular cargo** —
    decisión deliberada: la policy `charges_update_manager` no protege
    `amount` contra un balance ya asignado (ningún CHECK lo impide), así
    que este incremento nunca expone esa superficie de mutación,
    tratando los cargos como estrictamente de solo lectura.
  - **Sin UI de pagos/reporte/confirmación/allocation/recibos**
    (INC-013/014/015) — mostrar `financial_status`/`paid_amount`/
    `balance` derivados de `charge_balances` es lectura, no
    implementación de Payments.
  - Dinero: `number` plano (mismo patrón ya establecido para
    `rent_amount` en `rental_term_versions`), COP como única moneda
    (`CHECK currency = 'COP'` en el schema), `.tabular-nums` por
    `DESIGN.md` §4, `Intl.NumberFormat('es-CO')`, sin BigDecimal ni capa
    de minor-units.
  - i18n: nuevo namespace `charges` (es/es-CO, registrado en
    `i18n.ts`/`i18next.d.ts`) + una clave nueva en `rentals.json`
    (`list.charges`, "Cargos").
- **Tests**: 655/655 en la suite completa (36 nuevos), incluyendo
  cobertura explícita de exactamente lo pedido — mezcla de las dos
  consultas con los campos financieros viniendo de la vista; RPC llamado
  solo con `p_relationship_id`; los 3 mapeos de error tipados + fallback
  `unknown`; `createdCount: 0` tratado como éxito en repository/hook/UI;
  "Cargos" presente en `ACTIVE`/`ENDING`/`ENDED` y ausente en
  `DRAFT`/`CANCELLED`; acceso vencido deshabilita generación sin ocultar
  el historial; pending previene doble envío; invalidación tras éxito;
  render de los 4 `financialStatus`; loading/error/empty/populated; sin
  UI de creación manual; sin acción de editar/eliminar/anular.
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó en vivo vía Supabase MCP read-only el cuerpo completo del
  RPC, la vista `charge_balances` con `security_invoker=true`, y su
  grant a `authenticated`) no encontró BLOCKER/HIGH.
- **Deuda no bloqueante registrada** (2 LOW del reviewer, sin fix loop
  por debajo del umbral BLOCKER/HIGH):
  - LOW: `generate.success.created` en `charges.json` usa un string
    manual `"{{count}} cargo(s) generado(s)."` en vez de las claves de
    plural de i18next (`_one`/`_other`). Sin impacto funcional.
  - LOW: el botón "Cargos" de `RentalListCard` reutiliza
    `styles['termsAction']` (nombrada por la acción "Completar
    términos") para una tercera acción sin relación semántica — deuda ya
    existente desde que "Contratos" hizo lo mismo en INC-011, este
    incremento no la introduce, solo la extiende. Rename sugerido
    (`styles['secondaryAction']`) si se retoma este archivo.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 85 archivos /
  655 tests (0 fallos), 0 errores de lint (mismos 4 warnings
  preexistentes, no relacionados). Build emite el chunk
  `RentalChargesPage` correctamente.
- **Human gates**: ninguno disparado — sin cambios de
  schema/RLS/grants/migrations/dependencias/arquitectura (confirmado por
  `git status`/`git diff --stat`, y por el reviewer vía MCP en vivo: sin
  archivo nuevo bajo `supabase/migrations/`, RPC/vista/policies de
  `charges`/`charge_balances` sin cambios respecto a lo investigado).
- **Seguridad verificada** (vía MCP read-only, por el reviewer):
  re-confirmó en vivo `charges_select`/`charges_insert_manager`/
  `charges_update_manager`, `charge_balances` con
  `security_invoker=true` y su grant real a `authenticated`, el cuerpo
  completo de `generate_rent_charges` (orden exacto de las 4
  excepciones), y que no existe FK para embedding entre `charges` y
  `charge_balances`.

### Incremento anterior: INC-011 — Contract management (sin firma avanzada)
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-011) — registrar
un contrato Habitex-generado o externo, adjuntar copia firmada
manualmente, seguir su ciclo de vida, sin ningún mecanismo de firma
digital.

- **RESEARCH GATE**: resuelto sin escalar — el modelo de datos completo
  (`public.contracts`, sus 2 CHECK constraints de consistencia
  origin/status, sus 2 FK `RESTRICT` hacia `files`, su RLS de 3 policies
  sin `DELETE`) y las 3 RPCs de escritura re-verificadas en vivo,
  cuerpo completo, no solo el advisor. Confirmado: `DRAFT` nunca es
  producido por ninguna RPC (no se construyó nada para ese status);
  ninguna RPC exige que el rental esté `ACTIVE` (la restricción a
  `ACTIVE`/`ENDING` en la UI es decisión de producto, no del backend);
  `register_habitex_generated_contract` exige `p_document_hash` real
  (hallazgo que corrige el "Current evidence" del plan, que no lo
  mencionaba); no existe RPC para "compartir" ni "terminar" — ambas son
  UPDATE directo permitido por RLS, sin restricción de qué transición de
  status es válida más allá de "no `TERMINATED`" — el guardado
  correcto (`markShared` solo desde `GENERATED`, `terminate` solo desde
  `SIGNED`) es responsabilidad exclusiva del frontend, no del backend.
  Race de `version_number` conocida y aceptada (ninguna RPC bloquea la
  fila del rental antes de calcular `max+1` — colisión posible bajo
  registro concurrente, falla limpia vía `UNIQUE` constraint, sin
  migration para esto en este incremento). `acceptances`/
  `secure_actions`/`communication_events` confirmados sin ninguna
  integración con `contracts` hoy — infraestructura reservada para una
  firma avanzada futura (POST-003), no tocada. **Sin HUMAN GATE de
  Supabase/schema/RLS — YES, backend sin cambios.**
- **Qué se agregó**:
  - Nuevo `features/contracts/` — aggregate propio con las 4 capas que
    su responsabilidad justifica (domain/infrastructure/application/
    presentation + composition), **no plegado en `features/rentals/`**
    (decisión de producto explícita).
  - `ContractRepository`: `listByRelationship` (SELECT directo),
    `registerHabitexGenerated`/`registerExternalSigned` (las 2 RPC de
    registro), `attachSignedCopy` (RPC), `markShared`/`terminate` (UPDATE
    directo, cada uno con `.eq('status', '<status_origen_esperado>')`
    como guardia explícita — verificado por el reviewer que un match de
    cero filas por una race se detecta y se reporta como error distinto,
    nunca como éxito silencioso). **Nunca un INSERT directo** —
    verificado por grep y por tests que confirman `.from('contracts').insert` no se usa en ningún lugar.
  - `computeSha256Hex(blob)`: hash real vía `crypto.subtle.digest`
    (Web Crypto, sin dependencia nueva), nunca del filename/path/
    metadata — solo de los bytes del documento.
  - `buildTermsSnapshot(relationship, termVersion)`: forma explícita y
    documentada (`rentAmount`/`administrationMode`/`utilitiesMode`/
    `effectiveFrom` de `RentalTermVersion` + `realStartDate`/
    `trackingStartDate`/`paymentDay`/`paymentTiming`/`expectedEndDate`
    de `RentalRelationship`) — nunca una serialización ciega de estado
    de UI/query, nunca un campo legal inventado.
  - **Subida-luego-registro nunca es una mutation atómica**: el upload
    (reutiliza `fileRepository` de INC-010 sin duplicar, `purpose:
    CONTRACT_GENERATED`/`CONTRACT_SIGNED` según el flujo) y la llamada a
    la RPC de registro son mutations separadas; el archivo ya subido se
    conserva en estado local de presentación y se reutiliza si el
    registro falla y el usuario reintenta — nunca se vuelve a subir un
    duplicado (verificado con un test explícito: upload llamado 1 vez,
    registro llamado 2 veces en un fallo-luego-reintento, reutilizando
    el mismo `documentFileId`).
  - **Extensión aditiva a INC-010**: `FileRepository` gana `getById` —
    necesario porque `contracts` solo guarda ids de archivo (FKs), no
    metadata completa, y no existía ningún camino de lectura por id
    individual. Revisado independientemente y confirmado necesario, no
    duplicado, no una violación de alcance.
  - Sin vista de detalle general — ruta angosta de propósito único
    `/rentals/:id/contracts` (mismo principio que `/rentals/:id/terms`
    de INC-006), acción "Contratos" nueva en `RentalListCard` solo para
    `ACTIVE`/`ENDING`/`ENDED` (no `DRAFT`/`CANCELLED`).
  - **Creación de contrato ofrecida solo para `ACTIVE`/`ENDING`** —
    decisión de producto/UX explícita, documentada como tal en el código
    (nunca representada como autorización real, ya que el RPC no exige
    ningún status de rental). `ENDED` conserva lectura/descarga
    histórica de contratos existentes, sin sección de creación.
    `DRAFT`/`CANCELLED` no muestran ni siquiera el punto de entrada.
  - Acciones por status de contrato, exactas: `GENERATED` → "Marcar
    como compartido" + "Adjuntar copia firmada"; `SHARED` → "Adjuntar
    copia firmada" solamente; `SIGNED` → "Terminar contrato" solamente;
    `TERMINATED`/`DRAFT` → ninguna acción.
  - `useManagementGate` aplicado **de forma uniforme** a las 5 acciones
    mutantes (registro Habitex, registro externo, adjuntar firmada,
    marcar compartido, terminar) — sin la asimetría de INC-009, porque
    el RPC/RLS real de `contracts` usa `can_manage_administration()` en
    todos los casos, sin excepción. Acceso de gestión vencido nunca
    oculta la lista/descarga de solo lectura (coincide exactamente con
    lo que `contracts_select` permite independientemente de la
    suscripción).
  - **Sin UI de eliminación** de contrato o de sus archivos, en ningún
    lugar — no existe policy `DELETE` sobre `contracts`, y los archivos
    referenciados están protegidos por FK `ON DELETE RESTRICT`.
  - **Sin firma digital avanzada**: "firmado" en este incremento
    significa que un OWNER/MANAGER sube una copia ya firmada — nunca
    firma criptográfica, OTP, biométrica, proveedor externo, ni
    ningún uso de `acceptances`/`secure_actions`/`communication_events`.
  - **Sin motor de generación de documentos**: el flujo "Habitex-
    generado" usa un documento real que el owner sube vía el mismo
    input de archivo que el flujo externo — la distinción origin
    HABITEX/EXTERNAL es sobre el ciclo de vida (empieza sin firmar vs.
    se registra ya firmado), nunca sobre generación automática de
    contenido. Confirmado que esto no era un gap de producto sino una
    lectura incorrecta inicial de la investigación — el flujo se
    implementó completo y funcional, no como stub.
  - i18n: nuevo namespace `contracts` (es/es-CO, registrado en
    `i18n.ts`/`i18next.d.ts`) + una clave nueva en `rentals.json`
    (`list.contracts`, "Contratos").
- **Tests**: 609/609 en la suite completa, incluyendo cobertura
  explícita de exactamente lo pedido — RPC vs. UPDATE guardado vs.
  nunca-INSERT; race de versión detectada por código Postgres `23505`
  (no por texto de mensaje); acciones exactas por status (presencia Y
  ausencia); subida-sin-re-subida en reintento; gate de gestión uniforme
  en las 5 acciones; acceso vencido no oculta lectura histórica; sin UI
  de eliminación; sin código/copy de firma avanzada.
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó en vivo vía Supabase MCP read-only las policies/RPCs
  reales de `contracts`, confirmó que los guardados de status son
  reales en el código, no solo documentados) no encontró BLOCKER/HIGH.
- **Deuda no bloqueante registrada** (1 MEDIUM del reviewer, sin fix
  loop por debajo del umbral BLOCKER/HIGH):
  - MEDIUM: "Terminar contrato" (`SIGNED`→`TERMINATED`) no tiene
    confirmación de dos pasos, a diferencia de `LifecycleConfirmAction`
    (ya construido y probado en INC-009 para Cancelar/Terminar arriendo
    — acciones de la misma clase de severidad, "irreversible-negativa").
    Dado que no existe policy `DELETE`, y `contracts_update` bloquea
    cualquier UPDATE posterior una vez `TERMINATED`, terminar un
    contrato es un callejón sin salida en la práctica — el reviewer
    considera esto un gap real de consistencia UX, no un nitpick de
    estilo, precisamente porque el patrón ya existe en este código base
    para el mismo tipo de acción y simplemente no se reutilizó.
    Corrección sugerida: reutilizar `LifecycleConfirmAction` (cambio
    solo de presentación, sin tocar el repository/RPC).

**RESUELTO (2026-09-25, review-fix sin nuevo incremento)**: nuevo
componente local `TerminateContractAction` en `RentalContractsPage.tsx`
(no exportado, no compartido con `rentals` — reimplementación fiel del
mismo patrón de `LifecycleConfirmAction`, no un refactor cross-feature),
reemplaza el botón directo de "Terminar contrato" en la rama `SIGNED` de
`ContractCard`. Primer clic solo entra en estado `confirming` (nunca
llama a `terminate.mutate`); en confirmación se reemplaza por dos
botones nuevos y distintos ("Confirmar terminación" destructivo +
"Volver" secundario, nunca el mismo elemento reetiquetado); foco movido
al botón de confirmación vía ref+`useEffect`; confirmar deshabilitado
mientras `terminate.isPending` (sin duplicar submit); si la mutación
falla, se muestra el error mapeado, el badge permanece "Firmado" (nunca
optimista) y permanece en estado de confirmación (no resetea
silenciosamente, mismo principio que `LifecycleConfirmAction`). Las
claves i18n `actions.terminate.confirmCta`/`back` ya existían sin usar
en `contracts.json` (es/es-CO) desde la implementación original — no
requirió cambio de locale. 6 tests nuevos en
`RentalContractsPage.test.tsx` (primer clic no muta; confirmar muta
exactamente una vez; "Volver" no muta; pending previene doble submit;
fallo muestra error sin marcar TERMINATED falsamente y permanece
confirmable; acciones existentes — markShared/attachSignedCopy/las 2
formas de creación — sin regresión). Validación completa
(`typecheck`/`lint`/`test -- --run`/`build`) PASS — 614/614 tests.
Revisión independiente enfocada (`habitex-reviewer`, contexto
independiente, no el mismo que implementó el fix): **0 BLOCKER/HIGH/
MEDIUM/LOW nuevos**, MEDIUM original confirmado **RESUELTO**. Sin
cambios a `ContractRepository`, Supabase, RLS, migrations, dependencias
ni a ningún otro archivo/feature — fix acotado exactamente al alcance
pedido. Commit del fix: ver "Registro de checkpoints" (commit separado,
no amend de `f1d6ae1`).
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 82 archivos /
  609 tests (0 fallos), 0 errores de lint (mismos 4 warnings
  preexistentes, no relacionados). Build emite el chunk
  `RentalContractsPage` correctamente.
- **Human gates**: ninguno disparado — sin cambios de
  schema/RLS/grants/migrations/dependencias/arquitectura (confirmado por
  `git status`/`git diff --stat`, y por el reviewer vía MCP en vivo:
  las 3 policies + 3 RPCs de `contracts` sin cambios respecto a lo
  investigado, `supabase/migrations/` sin diff).
- **Seguridad verificada** (vía MCP read-only, por el reviewer):
  re-confirmó en vivo las 3 policies de `contracts` (sin `DELETE`), los
  2 CHECK de consistencia origin/status, las 2 FK `RESTRICT` hacia
  `files`, y que `shared_at`/`terminated_at` no tienen default/trigger
  (por lo que deben setearse explícitamente desde el cliente — aceptado
  como trade-off de severidad baja, no un hallazgo bloqueante, dado que
  RLS sigue siendo la autoridad real sobre la transición en sí).

### Incremento anterior: INC-010 — Generic file upload/download primitive
(`docs/agentic/HABITEX_COMPLETION_PLAN.md`, sección INC-010) — la
primitiva compartida de subida/descarga contra `files`/`storage.objects`
que consumirán INC-011 (contratos) e INC-013 (pagos). Backend gate
(migration de RLS) ya resuelto y documentado en "Infraestructura:
INC-010 — backend gate de Storage" más abajo; esta sección cubre el
primitive de frontend en sí, que completa el incremento.

- **Investigación previa a implementar** (sin RESEARCH GATE nuevo — el
  único gate real de este incremento fue el de backend, ya resuelto):
  confirmado que `public.files` **no tiene foreign key** hacia
  `storage.objects` — son dos tablas independientes, la app es la única
  responsable de mantenerlas consistentes. `public.files` ya tiene su
  propia RLS (`files_select`: miembro de administración O participante
  de la relación vía `can_view_relationship`; `files_insert`:
  `can_manage_administration` + `can_view_relationship` si está ligado a
  un rental; `files_delete`: `can_manage_administration`; sin policy de
  `UPDATE`) y sus propias constraints de seguridad
  (`files_storage_path_safe_ck` bloquea `../` y `/` inicial;
  `UNIQUE(storage_bucket, storage_path)`). La columna `original_name`
  existe precisamente para separar el nombre legible del path/identidad
  — confirma que el schema ya anticipaba no confiar en el filename como
  material de path. Sin RPC para `files` — insert/select/delete directo,
  mismo patrón que el resto de la app.
- **Qué se agregó**:
  - Nuevo `features/documents/` (`domain/`+`infrastructure/`+
    `composition.ts` — **sin `presentation/`**, sin pantalla/producto,
    por diseño explícito de este incremento).
  - `FileRepository` (`upload`/`download`/`remove`) — la primitiva
    encapsula la secuencia real de dos recursos (Storage + metadata)
    detrás de **una sola llamada**, para que ningún consumidor futuro
    (INC-011/INC-013) tenga que orquestar el orden él mismo.
  - `buildStoragePath(administrationId, blob, originalName?)`: función
    pura, `{administrationId}/{crypto.randomUUID()}{extensión?}` —
    `originalName` nunca se lee dentro de la función (verificado con
    tests usando inputs adversariales: `../../etc/passwd`, `a/b/c`,
    `../secret` — ninguno aparece en el path resultante, y el path
    siempre tiene exactamente un `/`). Extensión derivada de una tabla
    de mapeo MIME→extensión explícita y corta (`application/pdf`→`.pdf`,
    `image/jpeg`→`.jpg`, `image/png`→`.png`, `image/webp`→`.webp`; MIME
    no reconocido → sin extensión, nunca requerido para funcionar).
  - `upload`: siempre `upsert: false` explícito (asertado exactamente en
    tests, no solo "se llamó upload"); `mime_type`/`size_bytes` derivados
    de `blob.type`/`blob.size` reales, nunca de un valor separado que
    pudiera no coincidir; `sha256`/`uploaded_by_person_id` deliberadamente
    sin poblar (fuera de alcance). Falla parcial documentada y probada:
    si Storage falla, el insert de metadata nunca se intenta; si Storage
    tiene éxito pero el insert de metadata falla, se intenta una
    limpieza best-effort (`storage.remove`) cuyo propio fallo nunca
    enmascara el error original de metadata (el `.cause` original se
    preserva).
  - `download`: `.download()` autenticado (RLS re-chequeada en cada
    llamada contra la sesión actual), **no** `createSignedUrl` — un link
    firmado es una credencial portadora usable por cualquiera que lo
    tenga durante su ventana de validez, superficie de exposición mayor
    que una descarga autenticada directa; sin necesidad de compartir
    acceso fuera de una sesión autenticada en este incremento.
  - `remove`: borra la fila de `public.files` **antes** que el objeto de
    Storage (orden verificado con tracking explícito de secuencia en
    tests, no solo dos asserts independientes). Si el delete de metadata
    falla, el borrado de Storage nunca se intenta. Si el delete de
    metadata tiene éxito pero el borrado de Storage falla después, el
    error **se propaga** (no se silencia) — decisión documentada citando
    `ARCHITECTURE.md §7` ("un error remoto nunca se interpreta como
    éxito local"), distinta a propósito del comportamiento best-effort
    de `upload` (ahí la limpieza es secundaria a una operación que ya
    falló; aquí el borrado de Storage es la acción primaria que el
    usuario pidió).
  - `FileStorageBucket` restringido por tipo a `'receipts' | 'documents'`
    (nunca `string` suelto) — sin ningún `as any`/cast inseguro en toda
    la feature que pudiera burlar esa restricción.
  - Sin hooks de `application/` — decisión explícita: no existe todavía
    ningún consumidor real que ejercite `useUploadFile`/`useRemoveFile`
    con variables/UX reales; construirlos ahora sería boilerplate no
    probado contra ningún caso de uso genuino. El primer consumidor real
    (INC-011/INC-013) los agregará cuando sepa exactamente qué necesita.
  - Sin dependencia nueva — `crypto.randomUUID()` usado como global ya
    existente.
- **Tests**: 17 nuevos (`storage-path.test.ts` — 6; `supabase-file.repository.test.ts` — 8, más los ya contados en `storage-path.test.ts`), cubriendo exactamente lo listado arriba: shape/prefix/no-colisión del path, ausencia de `originalName` en el resultado con inputs adversariales, mapeo de extensión, `upsert:false` exacto, las 3 sub-casos de falla parcial de `upload`, orden y falla parcial de `remove`, y errores de Supabase siempre propagados vía `FileRepositoryError`. Cada archivo de test deja explícito que son tests unitarios del adapter (forma/orden/propagación de llamadas), no prueba de que la RLS desplegada funcione — eso lo re-verificó el reviewer en vivo.
- **Fix loop**: 0 ciclos — `habitex-reviewer` (contexto independiente,
  re-verificó en vivo vía Supabase MCP read-only que las policies de
  `storage.objects`/`public.files` son exactamente las esperadas, y que
  no hay foreign key entre ellas) no encontró BLOCKER/HIGH/MEDIUM.
- **Deuda no bloqueante registrada** (1 LOW del reviewer, sin fix loop
  por debajo del umbral BLOCKER/HIGH):
  - LOW: `mime_type` se deriva de `blob.type` sin validar que sea
    no-vacío — un `Blob`/`File` con `.type === ''` (tipo no reconocido
    por el navegador) insertaría `mime_type: ''` (la columna es
    `NOT NULL` pero sin `CHECK` de no-vacío). No explotable, sin
    regresión de nada existente. Un futuro consumidor con UI de subida
    debería validar/exigir un MIME type no vacío antes de llamar a
    `upload()`, o el repository podría agregar esa guarda.
- **Validación** (ejecutada de forma independiente por la sesión
  orquestadora y re-verificada por el reviewer): `pnpm typecheck && pnpm
  lint && pnpm test -- --run && pnpm build` — todos PASS. 78 archivos /
  553 tests (0 fallos), 0 errores de lint (mismos 4 warnings
  preexistentes, no relacionados). El build no referencia todavía la
  nueva feature en ningún chunk — esperado, sin consumidor aún.
- **Human gates**: ninguno disparado por el primitive de frontend en sí
  — sin cambios de schema/RLS/grants/migrations/dependencias en este
  paso (el único gate de este incremento fue el de backend, ya resuelto
  y documentado por separado). Confirmado por `git status`/`git diff
  --stat` (solo `src/features/documents/` nuevo) y por el reviewer vía
  MCP (`package.json`/`pnpm-lock.yaml` sin cambios).
- **Seguridad verificada** (vía MCP read-only, por el reviewer):
  re-confirmó en vivo que las policies de `storage.objects` y
  `public.files` son exactamente las descritas, sin UPDATE en ninguna de
  las dos, y sin foreign key entre ellas — consistente con el diseño del
  primitive (secuenciación explícita en la app, nunca asumida como
  garantizada por la base de datos).

### Incremento anterior: INC-009 — Rental lifecycle completion
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

## Infraestructura: INC-010 — backend gate de Storage (RLS aplicada)

Al seleccionar **INC-010 — Generic file upload/download primitive** como
siguiente incremento, el RESEARCH GATE encontró una contradicción real
entre el plan ("Existing Supabase support: completo... Backend work
required?: no") y el estado real de Supabase: `storage.objects` (la
tabla por la que pasan de verdad las subidas/descargas de Supabase
Storage) tenía RLS **habilitada** (`relrowsecurity = true`) pero **cero
policies** — verificado por tres vías independientes (`pg_policies`,
`information_schema.role_table_grants`, y finalmente `pg_class.relacl`
tras descubrir que la primera consulta subestimaba grants por una
limitación del rol read-only del MCP). Con RLS habilitada y ninguna
policy, cualquier operación se deniega por defecto — Storage estaba
completamente inalcanzable desde el frontend, para ambos buckets
existentes (`receipts`/`documents`, ambos privados). **SUPABASE/SCHEMA/
RLS GATE disparado** — la implementación de INC-010 quedó pausada hasta
resolver esto; no se implementó nada del primitive de frontend en `src/`
en ese momento.

Usuario aprobó explícitamente autorar una migration para resolverlo:

- **Migration autorada**:
  `supabase/migrations/20260924141732_storage_objects_administration_access.sql`
  — tres policies nuevas sobre `storage.objects`
  (`objects_select`/`objects_insert`/`objects_delete`), scoped a
  `bucket_id in ('receipts', 'documents')` y a la administración del
  llamante, derivada del primer segmento del path del objeto
  (`storage.foldername(name)[1]`), reutilizando las mismas funciones de
  autorización ya usadas por `public.files`
  (`is_administration_member`/`can_manage_administration`). Sin policy
  de `UPDATE` — objetos inmutables una vez subidos, mismo principio ya
  establecido para `public.files`.
- **Revisión independiente** (`habitex-reviewer`, contexto fresco, vía
  Supabase MCP read-only en vivo): 0 BLOCKER/HIGH. 2 MEDIUM corregidos
  antes de aplicar:
  - El primer borrador incluía un `GRANT SELECT, INSERT, DELETE ...` que
    resultó ser **redundante e inducía a un modelo mental incorrecto** —
    `authenticated`/`anon` ya tenían grants completos por defecto
    (otorgados por `supabase_storage_admin`, configuración estándar de
    todo proyecto Supabase) — el `GRANT` fue eliminado y el comentario
    de la migration corregido para reflejar que RLS era el único gap
    real.
  - Nomenclatura de policies renombrada de
    `storage_objects_administration_select/insert/delete` a
    `objects_select/insert/delete` para alinear con la convención ya
    establecida (`<table>_<action>`, sin prefijo de schema).
  - Nota de implementación (no bloqueante, para cuando se construya el
    primitive de frontend): `upload(..., { upsert: true })` de Supabase
    Storage requiere internamente privilegio `UPDATE` (vía `INSERT ...
    ON CONFLICT DO UPDATE`) — sin policy de `UPDATE`, cualquier upload
    con `upsert: true` sería denegado. El primitive debe construir un
    path único por subida, nunca usar `upsert: true` contra estos
    buckets.
- **Verificación pre-apply** (pedida explícitamente por el usuario,
  ejecutada antes de aplicar): archivo final re-leído completo y
  confirmado idéntico a la versión post-revisión; 52 migrations
  históricas confirmadas alineadas local/remoto (`supabase migration
  list`, `pg_class`/MCP `list_migrations`); exactamente 1 migration
  pendiente (`20260924141732`); `supabase db push --dry-run` confirmó
  que solo esa migration se aplicaría, sin seeds ni roles.
- **APLICADA (2026-09-24) contra el proyecto Supabase real**
  (`eurzpkgikzdvbblgtjwp`), vía `pnpm exec supabase db push --yes`
  ejecutado directamente por el usuario (mismo patrón que INC-001: el
  agente no ejecuta `db push` contra producción, la aprobación humana
  explícita y la ejecución son del usuario).
- **Verificación post-ejecución (MCP read-only)**: `list_migrations`
  confirma 53 migrations, `20260924141732` presente; `pg_policies` sobre
  `storage.objects` muestra exactamente las 3 policies esperadas
  (`objects_delete`/`objects_insert`/`objects_select`), con los
  predicados exactos autorados — sin extras; `get_advisors(security)`
  sin hallazgos nuevos (mismo baseline de 42 warnings `SECURITY DEFINER`
  + 1 de `leaked_password_protection`, ambos preexistentes, ninguno
  nuevo de esta migration).
- **Estado explícito**: **INC-010 Supabase/backend gate = RESOLVED.**
  Storage ahora es alcanzable, scoped por administración, con el mismo
  patrón de autorización que el resto de la app. La implementación
  frontend del primitive (ver sección de arriba, "Último incremento
  ejecutado") ya se hizo — con esto, **INC-010 queda completo**.
- **Archivo de la migration**: commiteado y pusheado (`14eb8b9`).

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
  actualización de `PROGRESS.md`, en el mismo commit — INC-012)_
- **Branch**: `chore/agentic-foundation`
- **Contenido del checkpoint**: nuevo `features/charges/` completo
  (domain/infrastructure/application/presentation/composition, 11
  archivos nuevos), nuevo namespace i18n `charges` (es/es-CO), acción
  "Cargos" nueva en `RentalListCard`, nueva ruta `/rentals/:id/charges`,
  más esta actualización de `PROGRESS.md`.
- **Fecha**: 2026-09-25
- **Estado**: commiteado localmente, **pendiente de push** — push/merge
  nunca son automáticos en este workflow.
- **No incluido**: ningún cambio de Supabase/schema/RLS/grants/migrations
  (INC-012 confirmó que no se necesitaba ninguno — `generate_rent_charges`
  y `charge_balances` ya estaban completamente soportados); ninguna
  creación/edición/eliminación de cargos; ninguna UI de pagos.

Checkpoint anterior, ya pusheado: INC-011 completo (`f1d6ae1` Contract
management, `6cb0f71` review-fix de la confirmación de dos pasos en
"Terminar contrato") — ver "Registro de checkpoints".

## Último resultado de validación

Medido sobre el resultado integrado de INC-012, ejecutado de forma
independiente por la sesión orquestadora y re-verificado por el
reviewer (incluyendo re-verificación en vivo vía Supabase MCP read-only
del cuerpo completo de `generate_rent_charges` y de la vista
`charge_balances`, sin cambios respecto a lo investigado):

| Check | Resultado |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS — 0 errores, 4 warnings preexistentes (React Compiler + `watch()` de React Hook Form en `ParkingForm`/`AddFullPropertyForm`/`AddRoomRentalPropertyForm`/`AddRentalDraftForm`, no relacionados, no introducidos por este cambio) |
| `pnpm test -- --run` | PASS — 655/655, 85 archivos |
| `pnpm build` | PASS — emite el chunk `RentalChargesPage` correctamente |

## Siguiente acción recomendada

Con INC-012 completo, una relación `ACTIVE`/`ENDING`/`ENDED` puede
generar y consultar sus cargos de renta reales, incluyendo su estado
financiero derivado del backend — de punta a punta, sin deuda
bloqueante. Deuda no bloqueante registrada (2 LOW, ver arriba): copy de
plural manual en `generate.success.created`, y reutilización de
`styles['termsAction']` para el botón "Cargos" — ambos triviales de
corregir si se retoma este archivo.

Candidatos sin dependencias técnicas pendientes:

- **INC-013** — Payments: report & confirm (depende de INC-008, ya
  completo; no depende de INC-012 — confirmado por la firma de
  `report_payment`, que no toma `charge_id`). Con INC-012 ya completo,
  `charge_balances` ya reflejará pagos reales en cuanto INC-013 exista.
- **INC-005** — Fix dead Dashboard CTAs (sin dependencias).
- **INC-007** — Tenant invitation & claim (depende de INC-001).
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
| 2026-09-23 | `1e79c3b` | `chore/agentic-foundation` | INC-009 — Rental lifecycle completion: `RentalRepository.cancelDraft/startEnding/end`, `RentalLifecycleError`/`RentalLifecycleErrorCode` (`not_draft`/`not_active`/`not_endable`/`end_before_start`/`management_access_required`), 3 hooks nuevos, confirmación inline de dos pasos (sin Modal nuevo) en `RentalListCard` para Cancelar/Terminar arriendo, "Iniciar cierre" de un clic para `ACTIVE`. Autorización asimétrica del backend respetada exactamente: `cancelDraft` gateado por `useManagementGate` (`can_manage_administration`), `startEnding`/`end` deliberadamente NO gateados (`has_administration_management_role` únicamente — verificado en vivo por el reviewer). `end_rental` llamado sin `p_actual_end_date` (default del backend). Sin backend gate/cambios. 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado (CSS duplicado). **Pusheado**. |
| 2026-09-24 | `14eb8b9` | `chore/agentic-foundation` | INC-010 backend gate: RESEARCH GATE encontró `storage.objects` con RLS habilitada y cero policies (Storage completamente inalcanzable). Migration `20260924141732_storage_objects_administration_access.sql` autorada (3 policies `objects_select/insert/delete`, scoped por bucket + administración vía el primer segmento del path), revisada independientemente (`habitex-reviewer`: 0 BLOCKER/HIGH, 2 MEDIUM corregidos — `GRANT` redundante eliminado, nomenclatura alineada), verificada pre-apply (dry-run, conteo local/remoto) y **APLICADA** contra el proyecto real vía `supabase db push --yes` ejecutado por el usuario, verificada post-apply vía MCP read-only. INC-010 backend gate = RESOLVED. **Pusheado**. |
| 2026-09-24 | `e29eed4` | `chore/agentic-foundation` | INC-010 primitive de frontend: nuevo `features/documents/` (`FileRepository` upload/download/remove, sin `presentation/`). Paths únicos vía `crypto.randomUUID()` que nunca leen `originalName`, `upsert: false` siempre, `download()` autenticado (no signed URL), limpieza best-effort si falla el insert de metadata tras upload exitoso, delete ordenado (metadata antes que storage, fallo de storage post-delete propagado). Sin hooks de `application/` (sin consumidor real todavía). 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 1 LOW no bloqueante registrado (mime_type vacío no validado). **INC-010 completo — Pusheado**. |
| 2026-09-24 | `f1d6ae1` | `chore/agentic-foundation` | INC-011 — Contract management: nuevo `features/contracts/` (`ContractRepository` sobre las 3 RPCs desplegadas + 2 UPDATE directos guardados por status, `computeSha256Hex` real vía Web Crypto, `buildTermsSnapshot` desde `RentalTermVersion`+`RentalRelationship`, subida-luego-registro sin re-subida en reintento). Extensión aditiva `FileRepository.getById`. Ruta `/rentals/:id/contracts`, acción "Contratos" en la lista solo para `ACTIVE`/`ENDING`/`ENDED`, creación de contrato solo para `ACTIVE`/`ENDING` (decisión de producto/UX, no autorización). Sin backend gate — las 3 RPCs y las 2 transiciones vía UPDATE ya estaban completamente soportadas. 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 1 MEDIUM no bloqueante registrado (sin confirmación de dos pasos en "Terminar contrato"). **INC-011 completo — local, pendiente de push**. |
| 2026-09-25 | `6cb0f71` | `chore/agentic-foundation` | INC-011 review-fix (no un nuevo incremento): resuelve el MEDIUM de `f1d6ae1` — nuevo componente local `TerminateContractAction` en `RentalContractsPage.tsx` reimplementa el patrón de confirmación inline de dos pasos de `LifecycleConfirmAction` (INC-009) para "Terminar contrato" (`SIGNED`→`TERMINATED`), sin Modal/Dialog nuevo, sin cambio a `ContractRepository`/Supabase/RLS/migrations. 6 tests nuevos. Revisión enfocada independiente (`habitex-reviewer`, contexto separado del fix): 0 BLOCKER/HIGH/MEDIUM/LOW nuevos, MEDIUM original **RESUELTO**. Validación completa PASS — 614/614 tests. **INC-011 completo — Pusheado** (junto con `f1d6ae1`). |
| 2026-09-25 | _(pendiente — este checkpoint)_ | `chore/agentic-foundation` | INC-012 — Charges: nuevo `features/charges/` (`ChargeRepository` con `listByRelationship` — dos `SELECT` separados contra `charges`/`charge_balances`, mezclados por id, financiero siempre desde la vista — y `generateRentCharges`, que envuelve `generate_rent_charges` llamado solo con `p_relationship_id`, sin lógica de periodos/monto en el frontend). Ruta `/rentals/:id/charges`, acción "Cargos" en la lista solo para `ACTIVE`/`ENDING`/`ENDED`, sin creación manual de cargos, sin UI de editar/eliminar/anular, sin UI de pagos (decisiones humanas explícitas). Sin backend gate — `generate_rent_charges` y `charge_balances` ya estaban completamente soportados. 1 ronda de `habitex-implementer`. 0 fix cycles — 0 BLOCKER/HIGH; 2 LOW no bloqueantes registrados. **INC-012 completo — local, pendiente de push**. |
