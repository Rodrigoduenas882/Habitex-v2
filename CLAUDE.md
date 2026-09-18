# CLAUDE.md — Habitex V2 (frontend)

Contexto permanente para Claude Code en este repo. Este archivo es un
**router**, no una copia de la documentación — las reglas completas viven en
los documentos que enlaza.

---

## 1. Fuentes de verdad

- **Trabajo visual, UI, UX, responsive, accesibilidad, componentes, tokens,
  theme, motion o branding** → leer `docs/DESIGN.md` antes de modificar, y
  seguir el proceso de `.claude/skills/habitex-design-review/SKILL.md`
  (`docs/DESIGN.md` → `habitex-design-review` → UI/UX Pro Max y/o Apple
  Design cuando aporten valor → implementación). `DESIGN.md` sigue siendo
  la autoridad visual; `habitex-design-review` es el proceso de trabajo, no
  una fuente de verdad nueva. UI/UX Pro Max y Apple Design son consultivas
  y están al mismo nivel — ninguna se carga por reflejo en cada cambio:
    - UI/UX Pro Max → heurísticas de UX/layout, accesibilidad, forms,
      responsive, navegación.
    - Apple Design (`.claude/skills/apple-design/`) → interaction, motion,
      feedback, transiciones, restraint/pulido. Nunca para overridear
      tokens, identidad visual, primitives, responsive o excepciones ya
      documentadas en `DESIGN.md` (ver esa skill para el detalle).
- **Arquitectura, estructura, estado, datos, Supabase, Auth, repositories,
  adapters, testing o backend** → leer `docs/ARCHITECTURE.md` antes de
  modificar.

Si una skill, referencia externa o sugerencia (incluida una sugerencia de
Claude Code) contradice una regla explícita de `DESIGN.md` o
`ARCHITECTURE.md`, **las reglas de Habitex tienen precedencia**.

---

## 2. Workflow

Antes de modificar:
1. Inspeccionar el código relacionado.
2. Identificar patrones existentes.
3. Leer la documentación aplicable (§1).
4. Reutilizar antes de crear.

Después de modificar:
- `pnpm lint`
- `pnpm build`
- tests relacionados
- `pnpm test` cuando corresponda
- `pnpm test:e2e` cuando el cambio afecte comportamiento de browser/E2E

No declarar una tarea terminada sin reportar validación real.

---

## 3. Package manager

Habitex usa **exclusivamente pnpm**. No usar `npm install`, `yarn` ni `bun`,
y no generar `package-lock.json` ni `yarn.lock`.

```
pnpm install / pnpm add / pnpm remove
pnpm lint / pnpm build / pnpm test / pnpm test:e2e
```

---

## 4. Frontend

Recordatorios breves — detalle completo en `ARCHITECTURE.md`:

- TypeScript strict.
- Feature-first, capas solo cuando la responsabilidad lo justifica.
- TanStack Query para server state.
- React Hook Form + Zod para formularios.
- CSS Modules + tokens.
- Reutilizar shared primitives (`src/shared/ui/`).
- No Zustand actualmente; reconsiderar solo ante necesidad real.
- No UI kits (MUI/Chakra/shadcn/Tailwind) sin decisión explícita.

---

## 5. Data / Supabase

Recordatorios breves — detalle completo en `ARCHITECTURE.md`:

- `presentation/`/`application/` no se acoplan al SDK de Supabase.
- Usar ports/repositories/adapters; `composition.ts` hace el wiring.
- RLS es la autoridad de seguridad; los guards del frontend no la
  reemplazan.
- `service_role` nunca en el frontend.
- Fail-closed: estado desconocido nunca se trata como autenticado.

No inventar tablas, RPCs, Edge Functions ni políticas. Si algo del backend
no puede verificarse desde este repo, decirlo explícitamente en vez de
asumirlo.

---

## 6. Design

Recordatorios breves — detalle completo en `DESIGN.md`:

- `DESIGN.md` manda.
- Reutilizar tokens y primitives existentes.
- Light/Dark/System es el único mecanismo de tema.
- Responsive es una decisión deliberada por breakpoint, no un desktop
  comprimido.
- Accesibilidad no es opcional (focus-visible, aria-label, reduced-motion).
- No diseño SaaS genérico.
- No valores visuales hardcodeados cuando existe un token.
- No glassmorphism/gradientes/neón como lenguaje general.

No copiar `DESIGN.md` aquí.

---

## 7. Scope discipline

- No hacer refactors no solicitados.
- No instalar dependencias por anticipación.
- No agregar infraestructura especulativa.
- No agregar Fastify ni una API propia hasta que exista una necesidad
  aprobada.
- No modificar backend durante tareas puramente frontend salvo solicitud.
- No hacer commit/push si la tarea no lo autoriza explícitamente.

---

## 8. Reportes

Al terminar una implementación relevante, reportar brevemente:
- Qué cambió.
- Archivos principales.
- Decisiones importantes.
- Validaciones ejecutadas.
- Riesgos/deuda pendiente.
- `git status` si corresponde.
