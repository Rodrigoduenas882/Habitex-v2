---
name: habitex-orchestrator
description: "Workflow agentic para completar Habitex con mínima intervención humana sin sacrificar calidad ni seguridad: lee el estado persistente, selecciona el siguiente incremento del roadmap, lo descompone en subtareas, delega en habitex-implementer y habitex-reviewer, valida, corrige y actualiza el progreso. Usar cuando el usuario pida avanzar el plan de finalización de Habitex de forma agentic/autónoma, o pida explícitamente el orchestrator. No usar para una tarea puntual y aislada que el usuario ya describió por completo — esta skill es para el ciclo completo de selección + delegación + verificación de un incremento del roadmap."
---

# Habitex Orchestrator

Esta skill **no reemplaza** `CLAUDE.md`, `docs/ARCHITECTURE.md` ni
`docs/DESIGN.md` — es el bucle que los usa. Tampoco reemplaza
`habitex-design-review`, `ui-ux-pro-max` ni `apple-design` — los invoca
cuando corresponde, a través de `habitex-implementer`/`habitex-reviewer`.

**Estado real (2026-09-22): fase de fundación.** `docs/agentic/
HABITEX_COMPLETION_PLAN.md` es un template vacío. Esta skill no debe
seleccionar ni ejecutar ningún incremento de producto hasta que exista un
roadmap real ahí. Si se invoca esta skill antes de eso, el único resultado
válido es: leer el estado, confirmar que no hay incremento seleccionable,
y decírselo al usuario — nunca inventar un incremento para tener algo que
hacer.

## Flujo (READ STATE → ... → STOP / NEXT)

### 1. READ STATE

Leer, en este orden, antes de cualquier otra acción:

1. `docs/agentic/PROGRESS.md` — branch activa, incremento actual, estado,
   subtareas, blockers, decisiones pendientes, último checkpoint, último
   resultado de validación, siguiente acción recomendada.
2. `docs/agentic/HABITEX_COMPLETION_PLAN.md` — si no tiene backlog real
   (§2 vacía), detenerse aquí y decírselo al usuario. No continuar el
   resto del flujo.
3. `git status` / `git log -3` — confirmar que el estado real de git
   coincide con lo que dice `PROGRESS.md`. Si no coincide, reportar la
   discrepancia al usuario antes de seguir; `PROGRESS.md` puede estar
   desactualizado, git es la fuente de verdad para el árbol de trabajo.

### 2. SELECT INCREMENT

Elegir el siguiente incremento `pending` del backlog cuyas dependencias
(`Depende de`) ya estén `done`. Si hay varios candidatos sin dependencias
pendientes, preguntar al usuario cuál priorizar en vez de decidir por
orden arbitrario — la priorización de producto es del usuario, no del
orchestrator.

### 3. HUMAN GATE CHECK

Antes de investigar o planear, evaluar si el incremento **por su
naturaleza** ya requiere aprobación humana. Detenerse y preguntar si
cualquiera de estos aplica:

- Cambia arquitectura (nueva capa, framework de DI, decisión de
  `ARCHITECTURE.md` §13, introducir la Habitex API).
- Requiere una dependencia nueva no presente en `package.json`.
- Toca schema, RLS, políticas, Auth o migrations de Supabase (estas no
  viven en este repo — ver `ARCHITECTURE.md` §0; si un incremento las
  implica, el gate es automático, no una sugerencia).
- Implica cualquier operación de escritura en Supabase.
- Es una decisión de producto ambigua (reglas de negocio no especificadas
  en el incremento, comportamiento no obvio a partir del backlog).
- Implica merge a `main` o deploy.

Si ninguno aplica, continuar. Si alguno aplica, usar `AskUserQuestion` (o
preguntar directamente) y esperar respuesta antes de seguir.

### 4. RESEARCH

Investigación de bajo costo antes de planear: `Explore` o un `fork` para
entender el código relacionado, patrones existentes y estado real —
nunca leer archivos grandes completos en el hilo principal cuando un
subagente puede resumir lo relevante.

### 5. PLAN

Descomponer el incremento en subtareas pequeñas y explícitas. Cada
subtarea debe ser suficientemente autocontenida para el prompt de un
`habitex-implementer` — no delegar "implementa el incremento X" sin
acotar archivos/alcance.

### 6. SCOPE/OVERLAP CHECK

Antes de delegar, para cada par de subtareas candidatas a paralelizar,
verificar explícitamente (grep/`Explore`, no asumir) que **no** comparten:

- el mismo archivo,
- el mismo dominio/feature (`src/features/<feature>/`),
- `composition.ts` de una feature ya tocada por otra subtarea,
- `shared/ui/*`, tokens, query-keys,
- `CLAUDE.md`, `ARCHITECTURE.md`, `DESIGN.md`.

Reglas de paralelización:

- **Máximo 4 `habitex-implementer` concurrentes.**
- **Preferir 1–2** salvo independencia de archivo/dominio claramente
  verificada — el overhead de integrar más de 2 rara vez se justifica al
  tamaño actual de Habitex.
- Si hay cualquier duda razonable sobre overlap, **trabajar secuencial**
  (o usar `Agent{isolation:"worktree"}` para aislar) en vez de paralelizar
  "para ganar tiempo".
- Ninguna subtarea que toque Supabase schema/RLS/migrations se delega
  nunca — eso ya se resolvió en el HUMAN GATE CHECK (paso 3).

### 7. DELEGATE

Dispatch de `habitex-implementer` (una llamada `Agent` por subtarea; varias
en un mismo mensaje solo si el paso 6 las aprobó para paralelo). Cada
prompt de subtarea debe incluir: archivos/alcance esperado, qué NO tocar,
y qué validación debe correr antes de reportar.

### 8. INTEGRATE

El orchestrator (sesión principal) integra los resultados: revisa qué
archivos cambió cada implementer, confirma que no hay conflictos entre
subtareas paralelas, y deja el árbol de trabajo en un estado coherente
antes de validar.

### 9. VALIDATE

Ejecutar `pnpm typecheck && pnpm lint && pnpm test` (y `pnpm build` /
`pnpm test:e2e` cuando el incremento afecte ese comportamiento) sobre el
resultado integrado — no confiar únicamente en lo que cada implementer
reportó.

### 10. INDEPENDENT REVIEW

Dispatch de `habitex-reviewer` con contexto independiente del/los
implementer(s) — nunca el mismo contexto de conversación que implementó el
cambio. El reviewer no modifica código; devuelve findings clasificados
(BLOCKER/HIGH/MEDIUM/LOW).

### 11. FIX LOOP

Si hay findings BLOCKER o HIGH: volver a `habitex-implementer` con el
finding específico a corregir.

- **Máximo 2 ciclos implementer ↔ reviewer** por incremento.
- Si después de 2 ciclos persisten findings BLOCKER/HIGH, **detenerse y
  escalar al usuario** — no seguir iterando automáticamente. Reportar qué
  se intentó, qué sigue fallando, y por qué.
- Findings MEDIUM/LOW no bloquean el checkpoint por sí solos, pero se
  registran (en el reporte del incremento, no en `PROGRESS.md` a menos
  que queden pendientes al cerrar).

### 12. CHECKPOINT

Cuando VALIDATE pasa y no quedan findings BLOCKER/HIGH sin resolver:

- Si el incremento es **sustancial** (varias features/archivos, riesgo
  medio/alto), ofrecer `ultrareview` como gate opcional pre-merge — ver
  sección dedicada más abajo. Nunca ejecutarlo sin confirmación explícita.
- Preparar el commit (mensaje descriptivo) pero **no ejecutar merge**.

### 13. UPDATE PROGRESS

Actualizar `docs/agentic/PROGRESS.md`: incremento actual, subtareas,
resultado de validación, último checkpoint (SHA una vez commiteado),
siguiente acción recomendada. Este archivo debe quedar en un estado que
permita a una sesión nueva retomar sin leer esta conversación.

### 14. STOP / NEXT

- **Merge**: siempre gate humano — el orchestrator nunca mergea a `main`.
- **Deploy**: no existe pipeline de deploy en este repo; nunca se agrega
  uno como parte de este flujo sin solicitud explícita (`CLAUDE.md` §7).
- Si el incremento quedó completo y aprobado: volver a SELECT INCREMENT
  para el siguiente, o detenerse si el usuario no pidió continuar
  automáticamente.
- Si quedó bloqueado (paso 11 o un gate humano): detenerse y reportar,
  nunca continuar con otro incremento como si el bloqueado no existiera
  sin que el usuario lo sepa.

## Reglas globales (nunca negociables dentro de esta skill)

- Nunca merge automático.
- Nunca deploy automático.
- Nunca escritura en Supabase (schema, RLS, políticas, Auth, migrations,
  datos) — el MCP configurado en este repo es read-only a nivel de
  servidor (`.mcp.json`), esto es refuerzo de política, no el único
  control.
- Nunca agregar una dependencia nueva sin aprobación humana explícita.
- Nunca resolver una decisión de producto ambigua adivinando — preguntar.
- Nunca un cambio de arquitectura sin aprobación humana explícita.
- Nunca inventar contenido de `HABITEX_COMPLETION_PLAN.md` para tener un
  incremento que ejecutar.

## Política de modelos

**Default: Sonnet**, para el orchestrator y para ambos agentes
(`habitex-implementer`, `habitex-reviewer`).

**Opus no se usa automáticamente.** El orchestrator se detiene y
**recomienda** (no decide) escalar a Opus únicamente cuando encuentra:

- una decisión arquitectónica compleja (no una tarea de implementación
  rutinaria);
- un riesgo de seguridad/RLS/Auth de alto impacto;
- un problema que ya falló repetidamente con Sonnet (por ejemplo, el
  fix loop del paso 11 agotó sus 2 ciclos sin resolver);
- una planificación excepcionalmente ambigua donde el costo de un error
  de alcance es alto.

En cualquiera de esos casos: reportar el motivo específico y dejar que
**el usuario decida** si cambia el modelo (`/model` o `model` en el
dispatch del `Agent`) — el orchestrator no cambia de modelo por su cuenta.

No diseñar ni asumir disponibilidad de Fable — su acceso en el plan actual
no está verificado; tratarlo como no disponible por defecto.

## Ultrareview (gate opcional, no ejecutar por defecto)

`claude ultrareview` / `/code-review ultra` es una revisión multi-agente en
la nube, nativa de Claude Code (no un plugin). Reglas para esta skill:

- Es un **gate opcional pre-merge**, reservado para incrementos
  **sustanciales** (no para cada subtarea ni cada incremento pequeño).
- **Requiere aprobación humana explícita antes de ejecutarse** — el
  orchestrator puede sugerirlo en el paso CHECKPOINT, nunca lo lanza solo.
- La cuenta Pro tiene **3 ejecuciones gratuitas de por vida** (no se
  renuevan); después de eso cada corrida cuesta ~$5–25 en usage credits.
  **No gastar las 3 gratuitas durante la fase experimental actual** — el
  usuario decide cuándo vale la pena usarlas.
- No sustituye a `habitex-reviewer` ni a `/code-review` local — esos
  corren en cada incremento; `ultrareview` es la capa adicional para
  incrementos grandes antes de mergear.

## Referencias

- Estado: `docs/agentic/PROGRESS.md`.
- Plan: `docs/agentic/HABITEX_COMPLETION_PLAN.md`.
- Agentes: `.claude/agents/habitex-implementer.md`,
  `.claude/agents/habitex-reviewer.md`.
- Gobierno del proyecto: `CLAUDE.md`, `docs/ARCHITECTURE.md`,
  `docs/DESIGN.md`.
- Proceso de diseño/UI: `.claude/skills/habitex-design-review/`.

## Fuera de alcance de esta versión

No incluye automatización en background/cron (`/schedule`, `CronCreate`,
`RemoteTrigger`) — se evalúa en una fase posterior, después de validar
este flujo de forma supervisada con al menos un incremento real.
