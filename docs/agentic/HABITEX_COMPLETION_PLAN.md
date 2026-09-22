# Habitex — Completion Plan

> **Estado de este documento: TEMPLATE VACÍO.**
> Todavía no contiene el roadmap real de Habitex. No inventar incrementos,
> features ni prioridades aquí hasta completar el paso 0.

Este documento es la fuente de verdad de **qué falta para terminar
Habitex** — el plan grande que el `habitex-orchestrator` recorre incremento
por incremento. No sustituye a `docs/ARCHITECTURE.md` (cómo construir) ni a
`docs/DESIGN.md` (cómo debe verse); este documento responde **qué construir
y en qué orden**.

---

## 0. Prerequisito: auditoría funcional conjunta

Antes de que este documento tenga contenido real, se necesita una sesión
conjunta (usuario + Claude Code) que audite el estado funcional completo
del producto y construya el roadmap real a partir de eso — no una lista
generada unilateralmente por el orchestrator ni por una sesión aislada.

Hasta que esa auditoría exista:

- La sección 2 (Backlog de incrementos) permanece vacía.
- El `habitex-orchestrator` **no debe seleccionar ningún incremento** —
  no hay incremento que seleccionar todavía.
- `docs/agentic/PROGRESS.md` debe reflejar esto explícitamente (ver ese
  archivo).

---

## 1. Estructura de un incremento

Cuando la auditoría exista, cada incremento del backlog (sección 2) debe
seguir esta forma — ni más liviana (pierde trazabilidad) ni más pesada
(vuelve el documento inmantenible):

```
### INC-XXX — <título corto>

- **Área de producto**: <feature/dominio afectado>
- **Descripción**: qué cambia y por qué, en 1-3 frases.
- **Depende de**: <INC-YYY, o "ninguno">
- **Toca backend/Supabase**: sí/no — si sí, requiere gate humano antes de
  empezar (ver `habitex-orchestrator` SKILL.md, human gates).
- **Riesgo**: bajo/medio/alto — y por qué.
- **Estado**: `pending` | `active` | `blocked` | `done`
- **Decisión humana pendiente**: <si aplica, o "ninguna">
```

No crear un incremento sin al menos "Área de producto" y "Descripción"
verificables contra el código o el producto real — evitar backlog
especulativo.

---

## 2. Backlog de incrementos

_Vacío. Se llena junto con el usuario después de la auditoría funcional
(sección 0). No agregar entradas de relleno._

| ID | Título | Área | Estado |
|----|--------|------|--------|
| — | — | — | — |

---

## 3. Áreas de producto conocidas (referencia, no roadmap)

Lista de dominios ya presentes en el código (`src/features/`), solo como
referencia para la futura auditoría — **no implica que estén completos ni
que sean el orden de trabajo**:

- `auth` — sesión, login/logout, guards.
- `dashboard` — presentation-only hoy (ver `ARCHITECTURE.md` §2).
- `administration` — contexto de administración.
- `properties` — alta de propiedades, rooms, parking.
- `rentals` — lectura y creación de borradores de arriendo.

Cualquier área adicional (contratos, pagos, utilities, actas,
comunicaciones, etc.) existe hoy solo como esquema/RPCs en Supabase (ver
`list_migrations` vía MCP) — **no como funcionalidad de frontend** todavía.
Confirmar el estado real de cada una es parte de la auditoría, no algo que
este documento puede asumir de antemano.

---

## 4. Decisiones abiertas relevantes para el plan

No duplicar `docs/ARCHITECTURE.md` §13 — remitirse ahí. Este documento solo
anota cuándo una decisión abierta de arquitectura **bloquea** un incremento
específico del backlog (sección 2), una vez que ese backlog exista.

---

## 5. Registro de cambios al plan

_Vacío. Cada vez que el backlog (sección 2) cambie de forma sustancial
(no un ajuste de estado de un incremento), agregar una línea aquí con
fecha y motivo._

| Fecha | Cambio | Motivo |
|-------|--------|--------|
| — | — | — |
