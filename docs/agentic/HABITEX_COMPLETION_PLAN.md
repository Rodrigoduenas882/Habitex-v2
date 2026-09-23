# Habitex — MVP Completion Plan

> Este documento reconcilia el **product scope** (decisiones de producto ya
> tomadas fuera de este repo) con el **estado real de implementación**
> (auditoría técnica de `src/` + Supabase MCP read-only). No es un
> placeholder — es el roadmap real, normalizado tras la revisión humana del
> 2026-09-22 (ver `PROGRESS.md` para el checkpoint de esa revisión).
>
> Regla de lectura: **PRODUCT SCOPE** (MVP / POST-MVP / PENDING HUMAN
> DECISION) y **IMPLEMENTATION STATE** (IMPLEMENTED / PARTIAL / MOCKED /
> DISCONNECTED / NOT IMPLEMENTED) son dos ejes independientes. Que algo no
> esté implementado **nunca** implica por sí solo que esté fuera del MVP.

---

## Product source of truth

Sin cambios respecto a la versión anterior — estas decisiones no se
reinterpretan en esta normalización:

- **Mercado**: Colombia únicamente para MVP 1.0. Alcance funcional
  congelado salvo lo marcado explícitamente como pendiente.
- **Source of truth técnica**: Supabase Auth + PostgreSQL. Sin
  localStorage/mocks/fallbacks como fuente de verdad de negocio. Trial y
  datos de producto persisten cross-device.
- **Demo ≠ Trial**: Demo es una experiencia temporal/controlada (sin
  especificación de producto todavía — ver Unresolved product domains).
  Trial es autenticado, persistente, con datos reales.
- **Trial**: 14 días + 30 días de gracia, sin tarjeta para iniciar, datos
  nunca se borran al vencer, acceso de consulta se conserva, debe existir
  ruta clara a planes/suscripción. Confirmado contra schema real —
  `administration_subscriptions` ya tiene `trial_started_at`,
  `trial_ends_at`, `management_access_until`, `active_relationship_limit`,
  `status` (`subscription_status`: `TRIALING`/`ACTIVE`/`PAST_DUE`/
  `CANCELED`/`EXPIRED`).
- **Identity**: `Person != Account`. Una Person puede existir antes de
  tener Account (invitación crea una Person mínima; esa persona reclama su
  Account después). Nunca auto-merge por coincidencia de email/documento.
- **Administration** es el tenant/capacidad principal. La suscripción
  pertenece a la Administration, no al usuario. `administration_role` ya
  existe en schema con `OWNER`/`MANAGER`/`VIEWER` — **MVP: OWNER
  únicamente**; MANAGER/VIEWER son POST-MVP explícito, no blockers.
- **Assets**: PROPERTY, ROOM, PARKING. `rental_mode`
  (`FULL_PROPERTY`/`BY_ROOMS`) y `rental_subject_type`
  (`FULL_PROPERTY`/`ROOM`/`PARKING`) ya confirmados contra schema.
- **Rental domain**: `RentalRelationship` es el núcleo — lifecycle real
  (`rental_status`: `DRAFT`/`ACTIVE`/`ENDING`/`ENDED`/`CANCELLED`, con
  `activated_at`/`ending_started_at`/`ended_at` ya en schema). Rental
  terms (`rental_term_versions`, versionado) son parte del MVP. Contract y
  RentalRelationship son conceptos **independientes** — una relación puede
  activarse sin que un contrato sea el mecanismo que la habilita.
- **Tenants**: Person → posible Account → participación en
  RentalRelationship. Los tenant flows de backend sin frontend conectado
  son **IMPLEMENTATION GAP**, no POST-MVP.
- **Contracts/documents**: parte del MVP. El mecanismo final de firma
  avanzada es un spike legal/técnico **pendiente**, pero
  `contract_status` (`DRAFT`/`GENERATED`/`SHARED`/`SIGNED`/`TERMINATED`) y
  `contract_origin` (`HABITEX`/`EXTERNAL`) ya permiten un ciclo de vida
  completo sin firma digital avanzada. **Contract management ≠ advanced
  digital signature.**
- **Charges/payments/receipts**: parte del MVP. Habitex **no custodia
  dinero** — `payment_method` (`BANK_TRANSFER`/`CASH`/`DIGITAL_WALLET`/
  `OTHER`) es descriptivo, no una integración de pasarela. Registrar el
  estado financiero del arriendo ≠ mover dinero. Integraciones externas de
  pago son POST-MVP explícito.
- **Cross-cutting**: `files`, `secure_actions`, `acceptances`,
  `communication_events`/`communication_deliveries`, `audit_events` son
  infraestructura de dominio — no requieren pantalla dedicada por sí
  mismos; se usan **como soporte** de los flujos MVP que los necesiten.
- **Email/almacenamiento/firma**: pueden tener trabajo pendiente sin que
  eso saque del MVP a contratos/documentos/invitaciones — para v1, un
  link copiable/compartido manualmente y el storage de Supabase ya
  conectado son suficientes donde aplique.

## Definition of MVP Complete

Sin cambios — la normalización de incrementos no altera esta definición:

**HABITEX MVP 1.0 COMPLETE** significa que, en Colombia, un usuario nuevo
puede, de punta a punta, con datos reales persistidos en Supabase:

1. Crear cuenta (bootstrap) → su Administration entra en `TRIALING`
   automáticamente (14 días, sin tarjeta).
2. Agregar al menos una propiedad (FULL_PROPERTY, BY_ROOMS+room, o
   PARKING).
3. Registrar un tenant (existente vía invitación reclamada, o nuevo
   inline) y crear una `RentalRelationship` con términos reales (renta,
   fechas, forma de pago).
4. Activarla (`DRAFT` → `ACTIVE`), opcionalmente respaldada por un
   contrato (Habitex-generado o externo, sin requerir firma digital
   avanzada).
5. Registrar cargos, reportar/confirmar un pago, asignarlo a cargos,
   emitir un recibo.
6. Ver el estado real (no mock) de su Administration en el Dashboard,
   incluyendo el estado de su Trial y una ruta clara a planes.
7. Eventualmente terminar la relación (`ENDING`/`ENDED`) sin perder datos.
8. Si su Trial vence sin conversión: conserva acceso de consulta, no
   pierde datos, no puede seguir gestionando activamente, y ve claramente
   cómo continuar.

Todo esto con OWNER como único rol necesario, sin integración de pasarela
de pago, sin firma digital avanzada, sin MANAGER/VIEWER.

## Current implementation baseline

Sin cambios respecto a la auditoría original:

- **IMPLEMENTED**: login, properties (crear+listar, FULL_PROPERTY y
  BY_ROOMS+rooms), parking (crear+listar), rentals (crear
  `DRAFT`+listar), resolución 0/1/N de administration.
- **PARTIAL/DISCONNECTED**: `useAccount()` existe con test pero no se
  consume en ningún componente; tenant candidates solo lectura.
- **MOCKED**: Dashboard completo (`dashboard-mock-data.ts`).
- **DISCONNECTED (dead ends)**: estado `'none'`/`'selection-required'` de
  administration en `/properties`, `/properties/new`, `/rentals`;
  `QuickActions` del Dashboard sin navegación.
- **NOT IMPLEMENTED (frontend) pero BACKEND READY**: bootstrap de cuenta,
  selección de administration, estado de Trial/suscripción/capacidad,
  rental terms, activación/cancelación/fin de rental, invitación/claim de
  tenant, contratos, files genérico, charges, payments, allocation,
  receipts.
- **Gobernanza desactualizada (no bloqueante)**: `ARCHITECTURE.md` §4 y el
  comentario de `session.types.ts` siguen afirmando que solo `auth` toca
  Supabase.
- **Seguridad**: ningún gap encontrado en el código auditado. Único
  advisory real: `auth_leaked_password_protection` deshabilitado —
  configuración de Supabase Auth, no de este repo.

## MVP gap matrix

| Dominio | Product scope | Implementation state | Backend | Frontend | Gap | Human gate |
|---|---|---|---|---|---|---|
| Authentication | MVP | IMPLEMENTED | Supabase Auth | real | ninguno | no |
| Account/Person bootstrap | MVP | DISCONNECTED | `bootstrap_account` RPC listo | ninguno | BACKEND READY / FRONTEND GAP | no |
| Trial/subscription visibility | MVP | NOT IMPLEMENTED | `administration_subscriptions` con columnas exactas | ninguno | BACKEND READY / FRONTEND GAP | no |
| Capacity/expiration gating | MVP | NOT IMPLEMENTED | mismas columnas + migration de cierre seguro | ninguno | BACKEND READY / FRONTEND GAP — confirmar qué cuenta como "relación activa" | investigación previa, condicional |
| Administration (selección) | MVP | PARTIAL (estado modelado, sin UI) | RLS + `is_administration_member` listos | ninguno | FRONTEND GAP | no |
| Administration (miembros/roles) | **POST-MVP explícito** | NOT IMPLEMENTED | enum `administration_role` ya tiene 3 valores | ninguno | fuera de alcance MVP | — |
| Properties/Rooms/Parking | MVP | IMPLEMENTED | completo | completo | ninguno | no |
| Property spaces / room access | No abordado por la fuente de verdad | NOT IMPLEMENTED | RPCs listos | ninguno | HUMAN DECISION | pendiente |
| Tenants (invitación/claim) | MVP | NOT IMPLEMENTED | RPCs + `secure_actions(TENANT_INVITATION)` listos | ninguno | BACKEND READY / FRONTEND GAP | no (email real es aparte) |
| RentalRelationship + Terms | MVP | PARTIAL (solo `DRAFT`) | `rental_term_versions` listo; mecanismo de escritura sin confirmar | solo creación | BACKEND READY (parcial) / FRONTEND GAP | **RESEARCH GATE** |
| Contracts/Documents | MVP (independiente de firma avanzada) | NOT IMPLEMENTED | ciclo completo listo | ninguno | BACKEND READY / FRONTEND GAP | no para gestión básica |
| Charges | MVP | NOT IMPLEMENTED | `charges` + `generate_rent_charges` listos | ninguno | BACKEND READY / FRONTEND GAP | no |
| Payments (report/confirm) | MVP | NOT IMPLEMENTED | `report_payment`/`confirm_payment` listos, sin dependencia de `charges` | ninguno | BACKEND READY / FRONTEND GAP | no |
| Payment allocation | MVP | NOT IMPLEMENTED | `allocate_payment` listo, requiere `charges` existentes | ninguno | BACKEND READY / FRONTEND GAP | no |
| Receipts | MVP | NOT IMPLEMENTED | `issue_receipt` listo, solo requiere `payment_id` | ninguno | BACKEND READY / FRONTEND GAP | no |
| Payment gateway/provider integration | **POST-MVP explícito** | NOT IMPLEMENTED | columnas `provider*` existen, vacías | ninguno | fuera de alcance MVP | sí — comercial + legal cuando se aborde |
| Advanced digital signature | **PENDING HUMAN DECISION (spike)** | NOT IMPLEMENTED | — | ninguno | separado del dominio Contracts | sí — legal/técnico |
| Dashboard | MVP (una vez existan datos reales) | MOCKED | n/a | mock | FRONTEND GAP, secuencial | no |
| House rules | No abordado por la fuente de verdad | NOT IMPLEMENTED | RPCs listos | ninguno | HUMAN DECISION | pendiente |
| Acts (move-in/move-out) | No abordado por la fuente de verdad | NOT IMPLEMENTED | RPCs listos | ninguno | HUMAN DECISION | pendiente |
| Utilities billing | No abordado por la fuente de verdad | NOT IMPLEMENTED | RPCs listos | ninguno | HUMAN DECISION | pendiente |
| Parking sublease authorization | No abordado por la fuente de verdad | NOT IMPLEMENTED | RPCs listos | ninguno | HUMAN DECISION (sin recomendación forzada — ver Unresolved domains) | pendiente |
| Communications (email real) | Infra cross-cutting, MVP donde un flujo MVP la necesite | NOT IMPLEMENTED | `communication_events`/`deliveries` | ninguno | soporta invitaciones; no bloquea su scope MVP | no para v1 con link manual |
| Demo experience | No especificado | NOT IMPLEMENTED | n/a | ninguno | HUMAN DECISION — necesita spec de producto | pendiente |
| Audit trail visible al usuario | Infra cross-cutting | NOT IMPLEMENTED (UI) | `audit_events` listo | ninguno | no necesita pantalla dedicada para MVP | no |

## Increment roadmap

**P0/P1/P2/P3 = secuencia de trabajo dentro del MVP. POST-MVP = fuera del
alcance del MVP. Nunca se usan como sinónimos.**

Todos los incrementos (incluidos P3 y POST-MVP) usan el mismo schema:
ID · Priority · Title · Goal · Product requirement · Current evidence ·
Scope · Out of scope · Dependencies · Likely domains/files · Existing
Supabase support · Backend work required? · Frontend work required? ·
Human gate? · Acceptance criteria · Validation strategy · Risk.

### P0 — Foundation / unblock complete user journey

#### INC-001 — Account & Administration Bootstrap
- **Priority**: P0
- **Goal**: un usuario autenticado sin `accounts` row puede crear su
  cuenta + primera administration.
- **Product requirement**: Authentication → Account/Person → Trial (MVP).
- **Current evidence**: `bootstrap_account(p_full_name,
  p_administration_name)` existe; `AccountRepository.getCurrentAccount()`
  documenta el estado "sin cuenta" como legítimo
  (`administration.types.ts:41-47`); `accounts`/`people` solo tienen
  policy `SELECT`, sin `INSERT`.
- **Scope**: repo/hook para invocar `bootstrap_account`; formulario
  mínimo; gate centralizado (layout/router) que redirija aquí cuando
  `useAccount()` resuelve `null`.
- **Out of scope**: elegir plan, invitar miembros, Demo.
- **Dependencies**: ninguna — primer incremento.
- **Likely domains/files**: `features/administration/` (nuevo
  repo+hook), `app/layouts/AuthenticatedLayout.tsx` o
  `app/router/router.tsx` (gate).
- **Existing Supabase support**: RPC ya desplegado y probado contra
  schema real.
- **Backend work required?**: no confirmado todavía — investigar si
  `bootstrap_account` ya provisiona la fila inicial de
  `administration_subscriptions`; si no, hay trabajo de backend
  pendiente fuera de este repo.
- **Frontend work required?**: sí — repo, hook, formulario y gate
  completos.
- **Human gate?**: RESEARCH GATE condicional — si la investigación
  revela que `bootstrap_account` no provisiona la subscription inicial,
  escala a SUPABASE/SCHEMA/RLS GATE (backend fuera de este repo). Sin
  gate para la parte de frontend.
- **Acceptance criteria**: usuario nuevo, sin cuenta previa, ve el
  formulario de bootstrap; al enviarlo, `useAccount()` y
  `useCurrentAdministration()` resuelven con datos reales.
- **Validation strategy**: tests de hook/repo, test de gate, `pnpm
  typecheck/lint/test/build`.
- **Risk**: MEDIUM — primer RPC de escritura fuera del patrón ya
  probado; cuidado con doble-envío.

#### INC-002 — Administration selection UI
- **Priority**: P0
- **Goal**: resolver el estado `'selection-required'`.
- **Product requirement**: Administration como tenant principal (MVP).
- **Current evidence**: `useCurrentAdministration.ts:14-18` — "No picker
  UI... is a later increment," por diseño.
- **Scope**: lista+selección sobre `useAccessibleAdministrations` ya
  existente; persistencia de la elección.
- **Out of scope**: creación de administration (INC-001), invitar
  miembros (POST-001).
- **Dependencies**: **dependency type: PRODUCT/SEQUENCING** respecto a
  INC-001 (conceptualmente sigue al bootstrap en el journey, y probarlo
  de punta a punta necesita ≥2 administrations reales). **Technical
  dependency: NONE** — el hook que consume (`useAccessibleAdministrations`)
  ya existe hoy, independiente de que INC-001 se haya implementado. Esto
  es lo que permite que sea candidato de piloto sin depender
  técnicamente de otro incremento.
- **Likely domains/files**: `features/administration/presentation`
  (nuevo).
- **Existing Supabase support**: completo, solo lectura.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: persona con 2+ administrations puede elegir
  una y ver `/properties`/`/rentals` scoped a ella.
- **Validation strategy**: test por estado, typecheck/lint/test.
- **Risk**: LOW.

#### INC-003 — Trial/Subscription status visibility
- **Priority**: P0
- **Goal**: la Administration muestra su estado real de Trial/suscripción
  (días restantes, gracia, expirado) — **solo lectura/visibilidad, sin
  gating de acciones todavía** (eso es INC-004).
- **Product requirement**: Trial 14+30 días visible, ruta clara a planes
  — explícito en la fuente de verdad. No implica construir billing nuevo.
- **Current evidence**: `administration_subscriptions` con `status`
  (`subscription_status`), `trial_started_at`, `trial_ends_at`,
  `management_access_until`, `current_period_starts_at/ends_at` ya en
  schema.
- **Scope**: repo/hook de lectura de `administration_subscriptions`;
  indicador de estado en el shell/Dashboard; CTA visible hacia "planes"
  (el checkout real de planes no es parte de este incremento).
- **Out of scope**: gating de acciones de gestión (INC-004); checkout de
  planes; integración de pasarela de pago (POST-002).
- **Dependencies**: INC-001 (la Administration debe existir para tener un
  estado de Trial que leer).
- **Likely domains/files**: `features/administration/` (nuevo
  domain/hook), banner en `AuthenticatedLayout` o Dashboard.
- **Existing Supabase support**: tabla y enum completos; falta confirmar
  si hay un RPC/vista de lectura ya pensado para esto o si es lectura
  directa con RLS.
- **Backend work required?**: posiblemente — depende de qué exponga ya
  el schema vía RLS/RPC vs. qué necesite el frontend.
- **Frontend work required?**: sí.
- **Human gate?**: RESEARCH GATE condicional — escala a SUPABASE/SCHEMA/RLS
  GATE solo si la investigación confirma que falta soporte de lectura en
  backend.
- **Acceptance criteria**: una Administration muestra su Trial activo con
  fecha de expiración y un CTA hacia planes.
- **Validation strategy**: tests de hook por cada estado de suscripción,
  typecheck/lint/test.
- **Risk**: LOW-MEDIUM.

#### INC-004 — Capacity & expiration gating
- **Priority**: P0
- **Goal**: las acciones de gestión (crear/activar/reportar pago, etc.)
  respetan `management_access_until`/`active_relationship_limit` sin
  borrar datos ni bloquear la consulta.
- **Product requirement**: 30 días de gracia, sin borrado de datos,
  acceso de consulta conservado, restricción de gestión según estado,
  capacidad por relaciones activas (no histórica) — explícito. No implica
  un sistema de billing nuevo, solo gating de UI/acciones existentes.
- **Current evidence**: mismas columnas que INC-003; migration
  `habitex_v2_031_expired_subscription_safe_rental_closure` sugiere que
  el backend ya tiene lógica de cierre seguro ante expiración — alcance
  exacto sin confirmar.
- **Scope**: gate reutilizable que envuelve acciones de escritura
  (crear property/rental, activar, reportar pago, etc.) consultando el
  hook de INC-003; mensajes claros de "solo consulta" cuando aplique.
- **Out of scope**: definir qué cuenta exactamente como "relación activa"
  si no está ya resuelto server-side (es investigación de este mismo
  incremento, no se asume); checkout/billing.
- **Dependencies**: INC-003 (reutiliza su hook de lectura de
  suscripción).
- **Likely domains/files**: `features/administration/` (gate
  compartido), consumido por `properties`/`rentals`/`payments`
  (una vez existan).
- **Existing Supabase support**: tabla/enum completos; **falta
  confirmar** qué estados de `rental_relationships` cuentan hacia
  `active_relationship_limit`.
- **Backend work required?**: posiblemente — depende de si el conteo de
  capacidad ya se resuelve server-side (RPC/trigger) o si el frontend
  necesita calcularlo, lo cual sería frágil y debería evitarse.
- **Frontend work required?**: sí.
- **Human gate?**: RESEARCH GATE — no resuelto todavía qué cuenta como
  capacidad activa; escala a SUPABASE/SCHEMA/RLS GATE si se confirma que
  falta lógica server-side para eso.
- **Acceptance criteria**: pasado `management_access_until`, las acciones
  de gestión se restringen con un mensaje claro; los datos siguen
  visibles; nada se borra.
- **Validation strategy**: tests de gating por estado de suscripción,
  typecheck/lint/test.
- **Risk**: MEDIUM — depende de lógica de servidor no verificable desde
  este repo sin investigación adicional.

#### INC-005 — Fix dead Dashboard CTAs
- **Priority**: P0
- **Goal**: `QuickActions` navega a rutas que ya existen.
- **Product requirement**: ninguno nuevo — corrección de un dead end ya
  documentado.
- **Scope**: wire `addProperty`→`/properties/new`,
  `createRental`→`/rentals/new`; actualizar el comentario stale.
- **Out of scope**: `registerPayment`/`uploadDocument` (se wirean cuando
  INC-011/INC-013 existan).
- **Dependencies**: ninguna.
- **Likely domains/files**: `features/dashboard/presentation/QuickActions.tsx`.
- **Existing Supabase support**: n/a.
- **Backend work required?**: no.
- **Frontend work required?**: sí, mínimo.
- **Human gate?**: NONE.
- **Acceptance criteria**: los 2 botones navegan correctamente.
- **Validation strategy**: test de interacción, typecheck/lint/test.
- **Risk**: LOW.

### P1 — Core rental lifecycle

#### INC-006 — Rental Terms
- **Priority**: P1
- **Goal**: una `RentalRelationship` puede tener términos reales (renta,
  fechas, forma de pago, modo de administración/utilities).
- **Product requirement**: "Rental terms forman parte del dominio del
  MVP" — explícito.
- **Current evidence**: `rental_term_versions` con `rent_amount`,
  `effective_from/until`, `administration_mode`, `utilities_mode`,
  `special_terms`, `version_number`; policies
  `rental_terms_insert/select/update/delete` ya existen en `public`; los
  42 RPCs `SECURITY DEFINER` conocidos **no incluyen** uno explícito de
  creación de versión de términos.
- **Scope**: repo/hook para crear/leer versiones de términos; UI desde el
  rental.
- **Out of scope**: pantalla de detalle de rental completa con historial
  visual de versiones — alcanza con crear+leer la versión vigente.
- **Dependencies**: INC-001 (Administration real para probar).
- **Likely domains/files**: `features/rentals/` (nuevo repo/hook/domain
  type).
- **Existing Supabase support**: tabla y RLS completos.
- **Backend work required?**: no confirmado — la escritura podría ser
  insert directo (RLS-gated) o requerir un RPC no descubierto en el
  advisor de seguridad. No se resuelve esta incertidumbre en este
  documento.
- **Frontend work required?**: sí.
- **Human gate?**: **RESEARCH GATE** — no puede quedar `NONE` mientras
  el mecanismo de escritura (insert directo vs. RPC) no esté confirmado.
  Si la investigación concluye que se necesita un RPC nuevo, un cambio de
  schema, un cambio de RLS o una migration, este gate **escala a
  SUPABASE/SCHEMA/RLS GATE** y requiere aprobación humana antes de
  continuar. No se resuelve el gate en este documento — solo se marca.
- **Acceptance criteria**: un rental `DRAFT` puede recibir términos y se
  leen de vuelta correctamente.
- **Validation strategy**: tests de repo/hook/form, typecheck/lint/test.
- **Risk**: MEDIUM — depende de confirmar el mecanismo de escritura.

#### INC-007 — Tenant invitation & claim
- **Priority**: P1
- **Goal**: invitar a un tenant existente/nuevo por un canal seguro; esa
  persona reclama su Account sin auto-merge inseguro.
- **Product requirement**: "Person puede existir antes de Account...
  Nunca auto-merge por coincidencia de email/documento" — explícito.
- **Current evidence**: `create_tenant_invitation`/`claim_tenant_invitation`
  RPCs; `secure_actions` con `action_type: TENANT_INVITATION`,
  `token_hash`, `expires_at`.
- **Scope**: flujo de invitación desde la UI de administración (genera
  un secure link); página pública de "reclamar invitación" que valida el
  token y vincula/crea la Account de forma segura.
- **Out of scope**: envío de email real (v1 usa link copiable); UI de
  otros `secure_action_type` (`ACT_REVIEW`/`CONTRACT_REVIEW`/
  `PAYMENT_REPORT`) — no son de este incremento.
- **Dependencies**: INC-001.
- **Likely domains/files**: `features/rentals/` o nuevo
  `features/tenants/`, nueva ruta pública.
- **Existing Supabase support**: completo.
- **Backend work required?**: no.
- **Frontend work required?**: sí, incluyendo una ruta pública nueva
  (fuera de `ProtectedRoute`).
- **Human gate?**: NONE para el mecanismo con link manual; EXTERNAL
  INTEGRATION GATE condicional si en el camino se decide integrar un
  proveedor real de email (fuera de este incremento).
- **Acceptance criteria**: un OWNER puede invitar a un tenant; el tenant
  puede reclamar la invitación sin duplicar/mezclar identidades.
- **Validation strategy**: tests de repo/hook, test de la ruta pública,
  typecheck/lint/test.
- **Risk**: MEDIUM-HIGH — superficie pública nueva, más atención de
  seguridad en la revisión.

#### INC-008 — Rental Activation (UX restante para fallas de validación)
- **Priority**: P1
- **Goal**: **reconciliado tras INC-004** (ver `PROGRESS.md`). El
  mecanismo de activación (`DRAFT` → `ACTIVE` vía
  `activate_rental_relationship` — RPC, repository, hook, mutation
  lifecycle, invalidación de query, acción en la lista, reflejo de
  `ACTIVE` tras refetch, y el gating de suscripción/capacidad vía
  `MANAGEMENT_ACCESS_REQUIRED`/`RELATIONSHIP_CAPACITY_REACHED`) **ya fue
  entregado por INC-004** y no se duplica aquí. Lo que queda de este
  incremento es terminar la UX para el resto de fallas de validación del
  RPC que INC-004 dejó deliberadamente en un fallback genérico.
- **Product requirement**: "Una RentalRelationship puede activarse sin
  que Contract sea obligatoriamente el mecanismo que la habilita" —
  explícito, sigue vigente sin cambios por esta reducción de alcance.
- **Current evidence**: leyendo el cuerpo real del RPC (no solo el
  advisor de seguridad) durante la investigación de INC-004, se confirmó
  que `activate_rental_relationship` también puede fallar con
  `RENTAL_NOT_DRAFT`, `RENTAL_TERMS_INCOMPLETE`,
  `INITIAL_TERM_VERSION_REQUIRED`, `PRIMARY_SUBJECT_REQUIRED`,
  `ACTIVE_TENANT_REQUIRED`, `ACTIVE_LESSOR_REQUIRED`,
  `RENTAL_SUBJECT_ALREADY_IN_USE`, `PARKING_ALREADY_SUBLEASED`. De estos,
  `PRIMARY_SUBJECT_REQUIRED`/`ACTIVE_TENANT_REQUIRED`/
  `ACTIVE_LESSOR_REQUIRED` ya están satisfechos de forma transitiva por
  `create_rental_draft` (inserta ambos participantes `ACTIVE` y el
  subject `PRIMARY` al crear el draft) y hoy no son alcanzables en el
  flujo real de la app — no requieren UX dedicada salvo que un flujo
  futuro cambie esa garantía.
- **Scope**: **reducido respecto a la versión original** — ya NO incluye
  nada del mecanismo de activación (ver "Goal"), que no se reconstruye ni
  se duplica. Lo que sigue en alcance: copy/UX dedicada para las fallas de
  validación del RPC que sean realmente alcanzables y útiles para el
  usuario, como mínimo las relacionadas con Rental Terms
  (`RENTAL_TERMS_INCOMPLETE`, `INITIAL_TERM_VERSION_REQUIRED`). Al
  ejecutar este incremento: inspeccionar los códigos de validación
  restantes contra el estado real de la app en ese momento y agregar copy
  dedicada solo donde la falla sea alcanzable — no construir UI para
  invariantes que los flujos existentes ya hacen inalcanzables (ver
  "Current evidence").
- **Out of scope**: contrato como prerrequisito (explícitamente no lo
  es); una vista de detalle de rental dedicada — **decisión de producto
  explícita**: para el MVP actual, activar desde la lista existente
  (`RentalsPage`/`RentalListCard`, ya construida por INC-004) es
  suficiente. El texto original de este incremento asumía una "vista de
  detalle del rental" que ningún incremento de este plan construye
  (INC-006 la excluye explícitamente de su propio alcance) — esa
  suposición queda retirada; no se crea un incremento nuevo para ella. Una
  experiencia de detalle de rental dedicada puede reconsiderarse más
  adelante, cuando el producto tenga suficiente información/acciones
  relacionadas para justificarla.
- **Dependencies**: INC-006 — **dependencia dura, no solo de producto**.
  El RPC desplegado exige `rental_term_versions`/campos de términos
  completos antes de activar (`RENTAL_TERMS_INCOMPLETE`,
  `INITIAL_TERM_VERSION_REQUIRED`), confirmado leyendo el cuerpo real del
  RPC. Corrige el texto original de este incremento, que decía "aunque el
  RPC no lo exija técnicamente" — esa afirmación era incorrecta.
- **Likely domains/files**: `features/rentals/` — extender el mapeo de
  errores tipados que INC-004 ya introdujo
  (`RentalActivationError`/`RentalActivationErrorCode` en
  `domain/rental.types.ts`, `toRentalActivationError` en
  `infrastructure/supabase-rental.repository.ts`) más i18n, no un
  mecanismo nuevo.
- **Existing Supabase support**: completo, sin cambios pendientes.
- **Backend work required?**: no.
- **Frontend work required?**: sí, pero acotado a extender lo que INC-004
  ya construyó.
- **Human gate?**: NONE.
- **Acceptance criteria**: al intentar activar un rental `DRAFT` sin
  términos completos, el usuario ve un mensaje específico y accionable
  (no el fallback genérico de INC-004) que referencia la causa real
  (términos incompletos); el resto de las fallas de validación reciben
  copy dedicada solo si son alcanzables en el flujo real de la app en ese
  momento.
- **Validation strategy**: tests de mapeo de error por código,
  typecheck/lint/test.
- **Risk**: LOW — el mecanismo de mayor riesgo ya fue entregado y
  revisado de forma independiente en INC-004; lo que queda es
  principalmente copy/UX.

#### INC-009 — Rental lifecycle completion (cancel/ending/end)
- **Priority**: P1
- **Goal**: completar la máquina de estados —
  `cancel_draft_rental`/`start_ending_rental`/`end_rental`.
- **Product requirement**: lifecycle real del dominio (explícito).
- **Current evidence**: RPCs en el advisor de seguridad;
  `ending_started_at`/`ended_at` ya en schema.
- **Scope**: acciones de cancelar (solo `DRAFT`), iniciar cierre, y
  terminar (`ACTIVE`/`ENDING` → `ENDED`).
- **Out of scope**: `relationship_clearances` (move-out formal) — no
  abordado por la fuente de verdad, ver Unresolved domains si aplica a
  Acts.
- **Dependencies**: INC-008 — **matiz tras la reconciliación de
  INC-004/INC-008**: el mecanismo de activación en sí (necesario para
  tener un rental `ACTIVE` real sobre el cual probar
  `start_ending_rental`/`end_rental`) ya fue entregado por INC-004; lo que
  queda pendiente de INC-008 (copy de errores de validación) no bloquea
  este incremento. La cadena real de dependencias es INC-006 → (resto de
  INC-008) → INC-009 solo en el sentido de que llevar un rental real de
  punta a punta hasta `ACTIVE` requiere primero INC-006 (términos); la
  parte de `cancel_draft_rental` de este incremento no depende de nada de
  esto, ya que opera sobre `DRAFT`.
- **Likely domains/files**: `features/rentals/`.
- **Existing Supabase support**: completo.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: un `DRAFT` puede cancelarse; un `ACTIVE` puede
  iniciar y completar su cierre.
- **Validation strategy**: tests por transición de estado,
  typecheck/lint/test.
- **Risk**: MEDIUM.

### P2 — Financial/document completion required for MVP

#### INC-010 — Generic file upload/download primitive
- **Priority**: P2
- **Goal**: primitiva compartida de subida/descarga contra `files`,
  reutilizable por contratos y pagos.
- **Product requirement**: "Files/documents forman parte del dominio
  MVP" — explícito; evita duplicar lógica de upload por feature.
- **Current evidence**: `files` con `purpose`
  (`CONTRACT_GENERATED`/`CONTRACT_SIGNED`/`PAYMENT_PROOF`/`RECEIPT`/
  `ACT_PHOTO`/`ACT_ATTACHMENT`/`AUTHORIZATION`/`OTHER`),
  `storage_bucket`/`storage_path`/`mime_type`/`sha256`.
- **Scope**: componente/hook compartido en `shared/` o
  `features/documents/` mínimo (repo+hook, sin pantalla propia) que
  INC-011/INC-013 consumen.
- **Out of scope**: política final de retención/storage (no bloqueante,
  ver Unresolved domains).
- **Dependencies**: ninguna técnica — se secuencia antes de INC-011 e
  INC-013 porque ambos lo consumen.
- **Likely domains/files**: `shared/lib/` o nuevo `features/documents/`.
- **Existing Supabase support**: completo (Supabase Storage ya
  configurado, `habitex_v2_033_storage_metadata_hardening`).
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: un archivo puede subirse y descargarse
  correctamente contra `files`, con el `purpose` correcto.
- **Validation strategy**: tests de hook, typecheck/lint/test.
- **Risk**: LOW-MEDIUM.

#### INC-011 — Contract management (sin firma avanzada)
- **Priority**: P2
- **Goal**: registrar un contrato Habitex-generado o externo, adjuntar
  copia firmada manualmente, seguir su ciclo de vida.
- **Product requirement**: "Contracts forman parte del dominio MVP...
  Contract/document management ≠ advanced digital signature" —
  explícito.
- **Current evidence**: `contracts` (`status`: `DRAFT`/`GENERATED`/
  `SHARED`/`SIGNED`/`TERMINATED`; `origin`: `HABITEX`/`EXTERNAL`);
  `register_habitex_generated_contract`, `register_external_signed_contract`,
  `attach_signed_contract_copy` RPCs.
- **Scope**: registrar contrato, adjuntar archivo (usa INC-010), marcar
  compartido/firmado manualmente, terminar contrato.
- **Out of scope**: firma digital avanzada (POST-003).
- **Dependencies**: INC-008 (rental debe existir/estar activo), INC-010
  (subida de archivos).
- **Likely domains/files**: nuevo `features/contracts/` o dentro de
  `features/rentals/`.
- **Existing Supabase support**: completo para el ciclo manual.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE para gestión manual — la firma avanzada es una
  decisión/incremento separado (POST-003), no un gate de este.
- **Acceptance criteria**: se puede registrar, compartir y marcar como
  firmado un contrato sin ningún mecanismo de firma digital.
- **Validation strategy**: tests de repo/hook/form, typecheck/lint/test.
- **Risk**: MEDIUM.

#### INC-012 — Charges (incluyendo generación de renta)
- **Priority**: P2
- **Goal**: generar/registrar cargos sobre una relación activa vía
  `generate_rent_charges(p_relationship_id, p_through_date)`.
- **Product requirement**: parte de "registrar/administrar el estado
  financiero del arriendo" — explícito.
- **Current evidence**: `charges` con `charge_type`
  (`RENT`/`ADMINISTRATION`/`UTILITY`/`OTHER`), `charge_origin`
  (`SYSTEM`/`MANUAL`/`UTILITY_ALLOCATION`); firma de
  `generate_rent_charges` confirmada vía Supabase MCP
  (`p_relationship_id uuid, p_through_date date DEFAULT CURRENT_DATE`).
- **Scope**: vista de cargos de una relación; generación de cargo de
  renta según términos vigentes.
- **Out of scope**: cargos de tipo `UTILITY` (depende de utilities
  billing, sin decisión de producto — ver Unresolved domains).
- **Dependencies**: INC-006 (términos), INC-008 (activación).
- **Likely domains/files**: `features/rentals/` o nuevo
  `features/finance/`.
- **Existing Supabase support**: completo para `RENT`/`OTHER`/`MANUAL`.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: se pueden generar y listar cargos reales de
  renta para una relación activa.
- **Validation strategy**: tests de repo/hook, typecheck/lint/test.
- **Risk**: MEDIUM.

#### INC-013 — Payments: report & confirm
- **Priority**: P2
- **Goal**: reportar un pago sobre una relación y confirmarlo.
- **Product requirement**: "Habitex no custodia dinero... registra el
  estado financiero" — explícito.
- **Current evidence**: firmas confirmadas vía Supabase MCP —
  `report_payment(p_relationship_id, p_amount, p_payment_date, p_method
  DEFAULT NULL, p_reference DEFAULT NULL, p_proof_file_id DEFAULT NULL,
  p_notes DEFAULT NULL)` **no requiere ningún `charge_id`** — un pago se
  reporta contra la relación, no contra un cargo específico;
  `confirm_payment(p_payment_id)`. `payments.status`:
  `REPORTED`/`CONFIRMED`/`REJECTED`/`CANCELLED`.
- **Scope**: reportar pago (comprobante opcional vía INC-010,
  `p_proof_file_id` tiene `DEFAULT NULL` — no es obligatorio), listar
  pagos de una relación, confirmar/rechazar.
- **Out of scope**: asignación a cargos específicos (INC-014, RPC
  distinta con dependencia distinta), emisión de recibo (INC-015).
- **Dependencies**: INC-008 (relación debe existir/estar activa). **No
  depende de INC-012 (Charges)** — confirmado por la firma del RPC, que
  no toma `charge_id`. Dependencia opcional/soft con INC-010 (el
  comprobante es opcional, no bloqueante).
- **Likely domains/files**: nuevo `features/payments/`.
- **Existing Supabase support**: completo.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: se puede reportar un pago (con o sin
  comprobante) y confirmarlo/rechazarlo.
- **Validation strategy**: tests de repo/hook, typecheck/lint/test.
- **Risk**: MEDIUM — flujo financiero, requiere revisión cuidadosa de
  estados aunque no mueva dinero real.

#### INC-014 — Payment allocation
- **Priority**: P2
- **Goal**: asignar un pago confirmado a uno o más cargos específicos.
- **Product requirement**: parte de "registrar/administrar el estado
  financiero del arriendo" — explícito.
- **Current evidence**: firma confirmada vía Supabase MCP —
  `allocate_payment(p_payment_id, p_charge_id, p_amount)` — **esta es la
  única de las 4 RPCs de pago que requiere un `charge_id` existente**.
  Tabla `payment_allocations` (`payment_id`, `charge_id`, `amount`).
- **Scope**: UI para asignar (total o parcialmente) un pago confirmado a
  cargo(s) pendientes.
- **Out of scope**: generación de cargos (INC-012, ya debe existir),
  emisión de recibo (INC-015, no depende de esto).
- **Dependencies**: INC-013 (pago debe existir y estar confirmado),
  INC-012 (cargos deben existir para poder asignarse).
- **Likely domains/files**: `features/payments/`.
- **Existing Supabase support**: completo.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: un pago confirmado puede asignarse a uno o más
  cargos reales.
- **Validation strategy**: tests de repo/hook, typecheck/lint/test.
- **Risk**: MEDIUM.

#### INC-015 — Receipt issuance
- **Priority**: P2
- **Goal**: emitir un recibo a partir de un pago.
- **Product requirement**: "receipts" forman parte del MVP — explícito.
- **Current evidence**: firma confirmada vía Supabase MCP —
  `issue_receipt(p_payment_id)` — **solo requiere el `payment_id`, no
  depende de que exista una allocation.** `receipts` (`status`:
  `ISSUED`/`VOIDED`, `receipt_number`, `file_id`).
- **Scope**: emitir recibo desde un pago (confirmado, por lógica de
  producto aunque no esté forzado por la firma del RPC); listar/anular
  recibos.
- **Out of scope**: generación de PDF/plantilla específica más allá de lo
  que el RPC ya devuelva.
- **Dependencies**: INC-013 (pago debe existir). **No depende de INC-014**
  — confirmado por la firma del RPC.
- **Likely domains/files**: `features/payments/`.
- **Existing Supabase support**: completo.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: se puede emitir un recibo desde un pago
  confirmado y consultarlo después.
- **Validation strategy**: tests de repo/hook, typecheck/lint/test.
- **Risk**: MEDIUM.

### P3 — MVP hardening / release readiness

#### INC-016 — Dashboard con datos reales
- **Priority**: P3
- **Goal**: reemplazar `dashboard-mock-data.ts` por datos reales,
  incluyendo el banner de estado de Trial.
- **Product requirement**: Dashboard es MVP una vez existan datos reales
  que mostrar (no antes) — explícito en la matriz de gaps.
- **Current evidence**: `DashboardPage.tsx:22-26` — "no Supabase calls,
  no business logic" por diseño actual.
- **Scope**: KPIs/overview de properties/rentals/charges/payments reales;
  banner de Trial (reutiliza INC-003/INC-004).
- **Out of scope**: cualquier KPI que dependa de un dominio no decidido
  (utilities, acts).
- **Dependencies**: INC-001, INC-003, INC-004, INC-008, INC-012, INC-013.
- **Likely domains/files**: `features/dashboard/`.
- **Existing Supabase support**: completo, vía los repos ya construidos
  por las dependencias.
- **Backend work required?**: no.
- **Frontend work required?**: sí.
- **Human gate?**: NONE.
- **Acceptance criteria**: el Dashboard no usa `dashboard-mock-data.ts`
  para ningún dato mostrado.
- **Validation strategy**: tests de componente por estado,
  typecheck/lint/test.
- **Risk**: LOW-MEDIUM.

#### INC-017 — Corregir doc drift
- **Priority**: P3
- **Goal**: actualizar `ARCHITECTURE.md` §4 y el comentario de
  `session.types.ts` para reflejar que Supabase ya se usa desde múltiples
  features, no solo `auth`.
- **Product requirement**: ninguno — higiene de documentación.
- **Current evidence**: `ARCHITECTURE.md:131-134`, `session.types.ts:43-46`.
- **Scope**: edición de texto en ambos archivos.
- **Out of scope**: cualquier cambio de código.
- **Dependencies**: ninguna.
- **Likely domains/files**: `docs/ARCHITECTURE.md`,
  `src/features/auth/domain/session.types.ts`.
- **Existing Supabase support**: n/a.
- **Backend work required?**: no.
- **Frontend work required?**: no (solo documentación).
- **Human gate?**: NONE.
- **Acceptance criteria**: ambos textos reflejan el estado real.
- **Validation strategy**: revisión de texto; `pnpm lint`/`typecheck` no
  aplican a `.md`, se corre igual sobre `.ts` si el comentario cambia.
- **Risk**: LOW.

#### INC-018 — Habilitar `leaked_password_protection`
- **Priority**: P3
- **Goal**: activar la protección de contraseñas filtradas en Supabase
  Auth.
- **Product requirement**: ninguno de producto — hallazgo de seguridad
  del advisor.
- **Current evidence**: `get_advisors(security)` — `auth_leaked_password_protection`
  deshabilitado.
- **Scope**: **ninguno de código** — es un toggle en el dashboard de
  Supabase Auth.
- **Out of scope**: cualquier cambio en este repo.
- **Dependencies**: ninguna.
- **Likely domains/files**: n/a — fuera de este repo.
- **Existing Supabase support**: n/a — es configuración, no schema.
- **Backend work required?**: sí, pero es una acción de configuración,
  no de código/migration.
- **Frontend work required?**: no.
- **Human gate?**: SUPABASE/SCHEMA/RLS GATE-adyacente — es una acción
  100% humana en el dashboard de Supabase, fuera del alcance de
  `habitex-implementer`/`habitex-reviewer` (que solo tienen MCP
  read-only).
- **Acceptance criteria**: el advisory deja de aparecer en
  `get_advisors(security)`.
- **Validation strategy**: re-correr `get_advisors(security)` (read-only)
  después del cambio.
- **Risk**: LOW.

### POST-MVP (fuera del alcance del MVP — decisión de producto ya tomada)

Normalizados con el mismo schema, sin convertirse en trabajo activo —
`Acceptance criteria`/`Validation strategy` quedan como "N/A, no
planificado" a propósito.

#### POST-001 — MANAGER/VIEWER + gestión de miembros
- **Priority**: POST-MVP
- **Goal**: administrar miembros de una Administration con roles
  MANAGER/VIEWER además de OWNER.
- **Product requirement**: explícito — "MVP: OWNER únicamente;
  MANAGER/VIEWER son posteriores."
- **Current evidence**: enum `administration_role` ya tiene los 3
  valores en schema; tabla `administration_members` ya existe.
- **Scope (cuando se aborde)**: invitar miembro, asignar rol, UI de
  gestión de permisos.
- **Out of scope (para MVP)**: todo lo anterior.
- **Dependencies**: INC-001 (Administration debe existir).
- **Likely domains/files**: `features/administration/`.
- **Existing Supabase support**: enum listo; **no se encontró RPC de
  invitación de miembros** entre los 42 RPCs conocidos — probablemente
  requiere trabajo de backend cuando se aborde.
- **Backend work required?**: sí, probable (sin RPC de invitación de
  miembros confirmado).
- **Frontend work required?**: sí, cuando se aborde.
- **Human gate?**: PRODUCT GATE — decisión de cuándo abordar esto es del
  usuario, no de este plan.
- **Acceptance criteria**: N/A — no planificado activamente.
- **Validation strategy**: N/A — no planificado activamente.
- **Risk**: no evaluado — fuera de alcance actual.

#### POST-002 — Integración con pasarela/proveedor de pago
- **Priority**: POST-MVP
- **Goal**: mover dinero real a través de un proveedor de pagos.
- **Product requirement**: explícito — "Habitex no custodia dinero...
  integraciones futuras con proveedores de pago no deben confundirse con
  registrar/gestionar charges/payments."
- **Current evidence**: columnas `provider`/`provider_customer_id`/
  `provider_subscription_id` en `administration_subscriptions` existen
  pero vacías — preparadas para el futuro, no implementadas.
- **Scope (cuando se aborde)**: elegir proveedor, checkout, webhooks.
- **Out of scope (para MVP)**: todo lo anterior — INC-012/013/014/015 ya
  cubren el registro financiero sin esto.
- **Dependencies**: no aplica todavía.
- **Likely domains/files**: no determinado.
- **Existing Supabase support**: columnas preparadas, sin lógica.
- **Backend work required?**: sí, cuando se aborde.
- **Frontend work required?**: sí, cuando se aborde.
- **Human gate?**: EXTERNAL INTEGRATION GATE + decisión comercial/legal.
- **Acceptance criteria**: N/A — no planificado activamente.
- **Validation strategy**: N/A — no planificado activamente.
- **Risk**: no evaluado.

#### POST-003 — Mecanismo final de firma digital avanzada
- **Priority**: POST-MVP (spike legal/técnico pendiente)
- **Goal**: firma electrónica avanzada con validez legal reforzada para
  contratos.
- **Product requirement**: explícito — "El mecanismo avanzado/final de
  firma contractual todavía puede requerir decisión/spike
  legal-técnico." Contract management (INC-011) ya funciona sin esto.
- **Current evidence**: `contract_status`/`contract_origin` ya soportan
  un ciclo manual completo (`SIGNED` vía copia externa adjunta); ningún
  RPC de firma digital encontrado.
- **Scope (cuando se aborde)**: elegir proveedor/mecanismo de firma,
  validez legal en Colombia, integración.
- **Out of scope (para MVP)**: todo lo anterior — no bloquea INC-011.
- **Dependencies**: INC-011 (el dominio Contract debe existir primero).
- **Likely domains/files**: no determinado.
- **Existing Supabase support**: no evaluado.
- **Backend work required?**: sí, cuando se aborde.
- **Frontend work required?**: sí, cuando se aborde.
- **Human gate?**: LEGAL GATE — spike legal/técnico explícitamente
  pendiente.
- **Acceptance criteria**: N/A — no planificado activamente.
- **Validation strategy**: N/A — no planificado activamente.
- **Risk**: no evaluado.

## Unresolved product domains

Dominios que **deliberadamente** no quedaron clasificados como MVP,
POST-MVP ni PENDING con recomendación — porque la fuente de verdad de
producto entregada no los aborda. No se decide su alcance en este
documento.

| Dominio | Backend | Por qué sigue sin decisión |
|---|---|---|
| Property spaces / room access | RPCs listos (`create_property_space`, `set_room_space_access`) | No mencionado en la fuente de verdad |
| House rules | RPCs listos (`publish_house_rules`, `accept_house_rules`) | No mencionado en la fuente de verdad |
| Acts (move-in/move-out) | RPCs listos (`create_act`, `confirm_act`, etc.) | No mencionado en la fuente de verdad |
| Utilities billing | RPCs listos (`configure_property_utility`, etc.) | No mencionado en la fuente de verdad |
| **Parking sublease authorization** | RPCs listos (`request_parking_sublease_authorization`, etc.) | No mencionado en la fuente de verdad — **movido aquí desde POST-MVP**: no existe una decisión de producto confirmada, solo una recomendación razonada previa que no debe tratarse como definitiva |
| Demo experience | n/a | Demo ≠ Trial es una decisión tomada, pero cómo debe funcionar Demo no tiene spec de producto todavía |

Ninguno de estos se planifica como incremento hasta recibir una decisión
explícita del usuario.

## Other pending clarifications (no bloquean el plan)

1. **¿`bootstrap_account` ya provisiona la fila inicial de
   `administration_subscriptions`?** — parte de la investigación de
   INC-001.
2. **¿Qué cuenta exactamente hacia `active_relationship_limit`?** — parte
   de la investigación de INC-004.
3. **Email real para `secure_actions`** (invitaciones): v1 opera con link
   manual sin bloquear INC-007/011/013.
4. **Política final de storage/retención de `files`**: no bloquea
   INC-010/011/013.
