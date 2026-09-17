---
name: habitex-design-review
description: "Diseña o revisa trabajo UI/UX específico de Habitex: pantallas nuevas o modificadas, flujos, componentes, responsive, accesibilidad, jerarquía visual, estados loading/empty/error/success, formularios, navegación o UX de una feature. docs/DESIGN.md es la máxima autoridad visual y docs/ARCHITECTURE.md la máxima autoridad técnica; UI/UX Pro Max (.claude/skills/ui-ux-pro-max/) es únicamente consultiva y queda subordinada a ambos documentos. No usar para trabajo puramente backend/infraestructura sin componente visual."
---

# Habitex Design Review

Esta skill **no crea un segundo design system**. Es el proceso obligatorio
para cualquier tarea de UI/UX de Habitex — asegura que `docs/DESIGN.md` y
`docs/ARCHITECTURE.md` sigan siendo la única autoridad, y que UI/UX Pro Max
se use solo como consulta filtrada, nunca como fuente de reglas.

## Cuándo se activa

Crear o modificar una pantalla; crear o revisar un flujo; crear o revisar
componentes; responsive; accesibilidad; jerarquía visual; estados
loading/empty/error/success; formularios; navegación; UX de una feature.

No se activa para trabajo puramente backend/infraestructura sin componente
visual.

## Orden obligatorio

1. **Leer `docs/DESIGN.md`.** Siempre, sin excepción, para cualquier tarea
   que esta skill cubra.
2. **Si la tarea afecta estructura técnica, datos, estado, repositories,
   adapters o arquitectura**, leer también `docs/ARCHITECTURE.md`.
3. **Inspeccionar la implementación existente relacionada** — la pantalla,
   componente o flujo más cercano ya construido.
4. **Identificar y reutilizar** antes de crear nada nuevo:
   - tokens (`src/shared/theme/tokens.css`);
   - primitives (`src/shared/ui/`);
   - semantic tones (`src/shared/theme/tone.module.css`);
   - layouts (`AppShell`, breakpoints existentes);
   - patrones ya resueltos en features comparables.
5. **Solo después**, consultar UI/UX Pro Max cuando aporte valor real —
   no como paso reflejo en cada tarea.
6. **Filtrar cualquier recomendación externa contra `DESIGN.md`.**
7. **Si hay conflicto, `DESIGN.md` gana.** Sin negociación.
8. **Implementar únicamente la solución compatible con Habitex.**

## Uso de UI/UX Pro Max

Puede apoyarse en `.claude/skills/ui-ux-pro-max/` principalmente para:
accessibility, UX heuristics, forms, responsive sanity checks, interaction
patterns, typography sanity checks, navigation, feedback, y charts —
cuando Habitex realmente tenga charts.

**No debe usarse para redefinir**: paleta, tipografía, tokens, branding,
theme, semantic tones, breakpoints, primitives, ni el design system en
general — esas decisiones ya están cerradas en `DESIGN.md`.

**No debe ejecutar ni generar**: `--design-system`, `--persist`, `--force`,
ningún `MASTER.md`, ni ninguna carpeta `design-system/`. Si una búsqueda de
UI/UX Pro Max sugiere alguno de estos modos, se ignora esa parte de la
sugerencia.

## Prohibiciones Habitex

Rechazar cualquier recomendación (propia o de UI/UX Pro Max) que introduzca,
sin una decisión explícita del usuario:

- Tailwind, shadcn, MUI, Chakra u otro UI kit;
- nuevas fuentes o nueva paleta;
- glassmorphism generalizado;
- gradientes decorativos como lenguaje general;
- neon;
- breakpoints ad hoc (fuera de 640px/1024px);
- duplicación de un primitive existente;
- valores visuales hardcodeados cuando ya existe un token.

Las excepciones ya documentadas en `DESIGN.md` (glass del Login, crossfade,
scrim) siguen siendo casos cerrados — no son precedente para una excepción
nueva.

## Checklist de revisión

Para una tarea UI relevante, revisar según corresponda — **no forzar puntos
sin relación con el cambio**:

Coherencia con `DESIGN.md` · reutilización de primitives · tokens ·
jerarquía · legibilidad · Light · Dark · System · desktop · tablet · mobile
· keyboard · focus · aria · contraste · reduced motion · loading · empty ·
error · success · disabled · permisos/estado cuando aplique · no horizontal
scroll · textos claros y no ambiguos.

## Disciplina de implementación

- No rediseñar áreas fuera del scope de la tarea.
- No hacer refactors visuales oportunistas.
- No crear un primitive nuevo hasta comprobar que los existentes no
  resuelven el caso.
- No convertir una recomendación de UI/UX Pro Max en una regla permanente
  de Habitex.
- Si aparece un patrón que parece merecer convertirse en regla global,
  **reportarlo primero**; no modificar `DESIGN.md` automáticamente.

## Salida

Cuando esta skill participe en una implementación o revisión importante, el
reporte debe indicar brevemente:

- reglas de `DESIGN.md` relevantes;
- primitives/patrones reutilizados;
- recomendaciones externas utilizadas, si hubo;
- recomendaciones descartadas por conflicto, si hubo;
- responsive/accessibility considerados;
- validaciones ejecutadas.
