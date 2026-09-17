# Habitex — DESIGN.md

Esta es la autoridad visual de Habitex. Describe el sistema que **ya existe y
fue aprobado** — no es una aspiración ni una lista de tendencias genéricas.
Toda regla de aquí tiene evidencia en el código citado junto a ella.

> **Precedencia.** Si una skill, herramienta, librería, referencia externa,
> agente de IA o sugerencia (incluida cualquier sugerencia de Claude Code)
> contradice una regla explícita de este documento, **este documento tiene
> precedencia**. Una skill puede ayudar a razonar, revisar o proponer
> alternativas; no puede sobrescribir una regla de Habitex.

---

## 1. Principios de diseño Habitex

Habitex es un producto de administración de arriendos, no un SaaS genérico.
Cada decisión visual se mide contra esto:

- **Premium, sobrio, moderno** — tipografía, jerarquía y espaciado hacen el
  trabajo; nunca gradientes, neón ni efectos decorativos.
- **Confiable** — es donde alguien administra dinero e inmuebles ajenos. La
  interfaz nunca debe sentirse juguetona ni informal.
- **Claridad antes que decoración** — si un elemento no comunica jerarquía o
  estado, no se agrega.
- **Densidad equilibrada** — ni vacío tipo landing page, ni denso como una
  hoja de cálculo. Ver KPI cards / `FinancialOverview` como referencia de
  cuánta información por bloque es aceptable.
- **Evitar apariencia de SaaS genérico** — sin componentes de un UI kit
  reconocible, sin iconografía de stock, sin plantillas de dashboard
  intercambiables.

---

## 2. Tokens

Fuente única: `src/shared/theme/tokens.css`. Todo color/espaciado/radio/sombra
de la interfaz sale de un token — nunca un valor literal, salvo las dos
excepciones documentadas en el §9 y §10.

| Categoría | Tokens | Notas |
|---|---|---|
| Neutrales | `--color-background`, `--color-surface`, `--color-surface-hover`, `--color-foreground`, `--color-muted`, `--color-border` | Redefinidos por tema. |
| Brand | `--color-primary(-hover|-foreground|-subtle|-subtle-foreground)` | |
| Semantic tones | `success` / `warning` / `danger` / `info`, cada uno con la misma tripleta base/subtle/subtle-foreground | Ver §6. |
| Shadows | `--shadow-sm/md/lg` | Redefinidas por tema (más planas y oscuras en Dark — un blur claro no se ve sobre superficies oscuras). |
| Spacing | `--space-1` (4px) … `--space-10` (64px) | Escala de 4px. |
| Radius | `--radius-sm/md/lg/full` | |
| Transitions | `--transition-fast/base/slow` | Ver §9 para la excepción del hero. |
| Layout | `--container-max-width`, `--sidebar-width`, `--topbar-height` | |

**Cuándo reutilizar un token**: siempre que el valor exista ya y comunique lo
mismo. Un `border` es siempre `--color-border`; un fondo tenue de éxito es
siempre `--color-success-subtle`.

**Cuándo se justifica crear uno nuevo**: cuando el valor existente cambiaría
un significado establecido, y el nuevo uso lo documenta explícitamente. Los
únicos dos precedentes son `--transition-hero-crossfade` y el grupo
`--hero-card-*` (tarjeta flotante del Login) — ambos con un comentario en
`tokens.css` explicando por qué no podían ser un token existente. Un token
nuevo sin ese tipo de justificación escrita no se acepta.

**Por qué evitar hardcode**: un color/spacing literal no reacciona a
Light/Dark, no se puede auditar de un solo lugar, y es exactamente el tipo de
inconsistencia que esta auditoría ya encontró y corrigió una vez (ver
`ARCHITECTURE.md` §Decisiones). Los únicos colores hardcodeados permitidos en
todo el repo son el `<style>` anti-FOUC de `index.html` (§3) — porque deben
pintar antes de que exista cualquier hoja de estilos — y los píxeles del
propio archivo `habitex-mark.png` (§11).

---

## 3. Light / Dark / System

Mecanismo único — no crear un segundo sistema de temas.

- `src/shared/theme/theme.ts`: funciones puras (`resolveInitialPreference`,
  `getSystemTheme`, `persistPreference`, `applyResolvedTheme`). Clave de
  `localStorage`: `habitex:theme` (guarda la *preferencia* `light|dark|system`,
  no el tema resuelto).
- `useTheme()` (`src/shared/theme/useTheme.ts`): resuelve `system` en vivo
  vía `matchMedia('(prefers-color-scheme: dark)')` con un listener de
  cambio — si el SO cambia de tema, la app reacciona sin recargar.
- `ThemeControl` (`src/shared/theme/ThemeControl.tsx`): el único selector
  Light/Dark/System de la app (radiogroup de 3 opciones). No montar más de
  una instancia por página — cada una tiene su propio estado y podrían
  desincronizarse.
- **Inicialización antes del primer paint**: un `<script>` inline en
  `index.html` lee `habitex:theme`, resuelve `system` si aplica, y fija
  `data-theme` en `<html>` — todo antes de que React monte. Un `<style>`
  inline justo después fija el `background` de `body` por tema (los únicos
  colores hardcodeados del repo, ver §2) como refuerzo contra flash en dev,
  donde Vite inyecta CSS por JS en vez de un `<link>` bloqueante.
- Todo color de la interfaz reacciona automáticamente porque son variables
  CSS bajo `:root[data-theme='dark']` — ningún componente necesita lógica de
  tema propia.

---

## 4. Tipografía

Escala en `src/shared/theme/typography.css`: `display` (40px) / `h1` (30px) /
`h2` (24px) / `h3` (18px) / `body` (15px) / `body-sm` (13px) / `label` (13px,
600) / `caption` (12px, color `--color-muted`). Cada nivel es un token
(`--font-size-X`, `--line-height-X`, `--font-weight-X`) y una clase utilitaria
(`.text-h1`, etc.).

- **Jerarquía**: `display` solo en el hero del Login; `h1` para el valor
  protagonista de una KPI card; `h2` para títulos de página; `h3` para
  títulos de sección/card; `body`/`body-sm` para contenido; `caption` para
  metadatos secundarios.
- **Números financieros**: siempre `.tabular-nums` (`font-variant-numeric:
  tabular-nums`) junto al tamaño que corresponda — evita que las cifras
  "bailen" al cambiar de valor. Ver `KpiCard`, `FinancialOverview`,
  `AttentionPanel`.
- **Legibilidad**: nunca texto de marca/cifra sobre una foto sin un scrim
  detrás (ver §10); nunca depender de un color de bajo contraste para texto
  secundario — `--color-muted` ya está calibrado por tema para eso.

---

## 5. Primitives existentes

Todos en `src/shared/ui/` (más `HabitexBootScreen` en `src/shared/components/`).
No se documenta su API completa — está en el propio archivo. Regla general:
**si el primitive ya resuelve el caso, se usa tal cual o se le pasa una
prop nueva justificada; no se crea una variante local que reimplemente su
apariencia.**

| Primitive | Cuándo usarlo | Cuándo NO crear variante local |
|---|---|---|
| `Button` | Cualquier acción primaria/secundaria/ghost/destructiva. | Nunca reimplementar un botón con `<button>` + CSS propio. |
| `Input` / `Select` / `Textarea` | Cualquier campo de formulario. Comparten `Field.module.css` (label/hint/error). | No crear un input con borde/foco propios. |
| `Card` | Contenedor de superficie con borde+sombra. `interactive` para hover. | No hardcodear `border+radius+shadow` en un componente de feature. |
| `Badge` | Etiqueta corta de estado (una palabra/número). | No crear un "chip" propio con los mismos tonos. |
| `Alert` | Mensaje de nivel de página/formulario (info/success/warning/danger). | No crear un banner de error propio. |
| `Avatar` | Imagen o iniciales de usuario. | — |
| `EmptyState` | Lista/panel sin datos. | No escribir un `<p>` centrado a mano. |
| `Skeleton` | Placeholder de carga de contenido real (no bootstrap — ver §9). | — |
| `Tabs` | Navegación por pestañas con teclado (roving tabindex, ARIA completo). | No reimplementar tabs con `useState` + botones sueltos. |
| `IconButton` | Botón solo-ícono. Exige `aria-label` a nivel de tipos. | — |
| `IconBadge` | Ícono dentro de un contenedor tintado (KPI, quick action, fila de lista, tarjeta "agregar"). Props: `icon`, `tone`, `size`, `radius?`. Cada consumidor elige su propio tamaño/radio — el primitive comparte el patrón, no la jerarquía visual. | No volver a escribir `display:flex;align-items:center;...;background:var(--color-X-subtle)` en el CSS de una feature — eso es exactamente lo que `IconBadge` reemplazó en `KpiCard`, `QuickActions`, `AttentionPanel` y la tarjeta "Agregar inmueble". |
| `BrandMark` / `BrandLogo` | Ver §11. | — |
| `HabitexBootScreen` | Ver §9. | — |

---

## 6. Semantic tones

Vocabulario único: `neutral · primary · success · warning · danger · info`.

Fuente canónica: **`src/shared/theme/tone.module.css`**, un archivo de 6
clases (background + color, nada más). `Badge`, `Alert` e `IconBadge` hacen
`composes: <tono> from '.../tone.module.css'` en vez de declarar su propio
par de colores.

**Prohibido**: que un componente de feature vuelva a escribir
`background: var(--color-success-subtle); color: var(--color-success-subtle-foreground)`
a mano. Si un componente necesita un tono, importa `IconBadge` (para íconos)
o compone directamente desde `tone.module.css` (para otro tipo de superficie
tintada). Esto ya pasó una vez — `KpiCard` reconstruía este mapeo por su
cuenta — y quedó corregido; no debe volver a pasar.

---

## 7. Layout

`AppShell` (`src/shared/ui/AppShell.tsx` + `.module.css`) es el **único**
shell de la app — lo usan tanto el layout autenticado real como `/ui-preview`
(con datos mock), nunca una segunda implementación paralela.

- **Shell fijo**: `height: 100dvh` por defecto (configurable vía
  `--app-shell-height` solo para el caso contenido de `/ui-preview`),
  `overflow: hidden`. El sidebar y el topbar nunca se mueven.
- **`.main` es la única zona de scroll** (`overflow-y: auto`, `min-height: 0`
  en toda la cadena de flex hasta ahí). Esto corrigió un bug real: antes, el
  shell crecía con el contenido y dejaba una columna vacía bajo un sidebar
  corto en F5. No revertir a `min-height` en `.shell`.
- **Sidebar** (desktop): ancho fijo `--sidebar-width` (248px), con
  `BrandLogo` arriba, navegación abajo.
- **Topbar**: altura fija `--topbar-height` (64px), `ThemeControl` + email +
  `Avatar` + logout.
- **Navegación móvil**: drawer (`position: fixed`, `inert` cuando está
  cerrado — no solo oculto visualmente) + bottom nav fijo (<640px).
- **Breakpoints existentes: 640px y 1024px.** Son los únicos en toda la app
  (`AppShell`, `PropertiesOverview`, `LoginPage`). No introducir un tercer
  breakpoint sin una necesidad demostrable y documentada en el componente.

---

## 8. Responsive

Desktop, tablet y mobile son **decisiones de diseño explícitas**, no un
desktop comprimido con media queries genéricas.

- **Desktop** (≥1024px): experiencia completa — sidebar persistente, hero
  fotográfico completo en Login, controles de carrusel visibles.
- **Tablet** (640–1023px): sidebar se reemplaza por hamburguesa + drawer; el
  hero del Login se reduce a un banner fijo (280px) con marca + headline,
  sin tagline ni tarjeta de métricas — no porque no quepan, sino porque a
  ese tamaño compiten con el formulario.
- **Mobile** (<640px): el formulario/contenido es protagonista. El Login no
  muestra foto en absoluto por debajo de 640px; el AppShell usa bottom nav en
  vez de drawer. "Mobile" nunca significa "el mismo layout de desktop, más
  angosto".
- El carrusel de `PropertiesOverview` es el ejemplo de referencia:
  desktop tiene flechas de scroll (solo cuando hay overflow real en esa
  dirección); táctil confía en swipe nativo — no se duplica la flecha en
  touch "por si acaso".

---

## 9. Motion

- **Tokens**: `--transition-fast` (120ms), `--transition-base` (180ms),
  `--transition-slow` (280ms) — hover, drawers, fades de UI en general.
- **Excepción explícita**: `--transition-hero-crossfade` (400ms), solo para
  el crossfade día/noche del Login. No reutilizar este token para otra cosa;
  si algo más necesita una transición "cinematográfica", esa es señal de que
  merece su propia excepción documentada, no de reusar esta.
- **Reduced motion es global y automático**: `global.css` tiene una sola
  regla (`@media (prefers-reduced-motion: reduce) { *,*::before,*::after {
  animation-duration: 0.01ms !important; ... } }`) que colapsa **toda**
  animación de la app (Skeleton, spinner de Button, puntos de
  `HabitexBootScreen`, el crossfade del hero). Ningún componente nuevo debe
  implementar su propio chequeo de `prefers-reduced-motion` — ya está
  resuelto una vez, globalmente.
- **Loaders**: `HabitexBootScreen` (marca + 3 puntos animados con opacity +
  translateY mínimo, nunca scale/bounce) es el único loader de entrada a
  Habitex — bootstrap de rutas, restauración de sesión, logout instantáneo.
  `Skeleton`/el spinner de `Button` son para carga de contenido/acción ya
  dentro de la app, no para "entrar a Habitex".

**Prohibido:**
- Animaciones decorativas, rebotes o escalados exagerados.
- `setTimeout` o cualquier duración mínima artificial para mostrar un
  loading state — un loader se muestra exactamente mientras la operación
  real está pendiente, ni un ms más.
- Spinners genéricos para bootstrap/sesión cuando existe `HabitexBootScreen`.

---

## 10. Login / fotografía

El Login (`src/features/auth/presentation/LoginPage.tsx`) es la única
pantalla con fotografía y glass en todo Habitex — no es el punto de partida
para ningún otro dashboard o formulario.

- **Hero fotográfico**: par `property-light.webp` / `property-dark.webp`
  (`public/images/auth/`) — misma propiedad, mismo encuadre, día vs. noche.
  WebP real (no un PNG con extensión `.webp`).
- **Crossfade 100% CSS**: dos capas `background-image` superpuestas,
  visibilidad controlada por `:root[data-theme='dark']` — sin JS, sin
  estado. Ambas capas comparten una sola regla `background-position`/`size`
  para que el encuadre nunca pueda desalinearse entre Light y Dark.
- **Scrim**: un degradado radial + lineal sobre la foto, necesario para
  contraste del texto — no es decorativo y no cambia entre temas (si
  cambiara, el crossfade se leería como "dos fotos distintas" en vez de
  "un mismo lugar de día y de noche").
- **Glass card** (tarjeta de métricas flotante): `--hero-card-*`, vidrio
  oscuro + `backdrop-filter: blur(14px)`, **deliberadamente el mismo en
  Light y Dark** (una versión "vidrio claro" se probó y se veía lavada
  sobre la foto de día). Esta es una excepción localizada y documentada en
  `tokens.css` — **no generalizar glassmorphism al resto del producto.**
  Ningún otro componente de Habitex usa `backdrop-filter`.

---

## 11. Marca

- **`BrandMark`** (`src/shared/ui/BrandMark.tsx`): el símbolo solo. Envuelve
  el asset oficial `public/images/brand/habitex-mark.png` (PNG raster,
  fondo transparente verificado). Tamaño configurable vía `size`.
- **`BrandLogo`**: `BrandMark` + wordmark "Habitex", con el espaciado/
  tipografía ya resueltos. El wordmark usa `color: inherit` — se adapta al
  contexto (oscuro en el sidebar, blanco sobre la foto del Login) sin que el
  componente conozca temas.
- **Símbolo vs. logo completo**: usar `BrandMark` solo cuando aparece
  completamente aislado y necesita su propio nombre accesible (ej.
  `HabitexBootScreen`, vía `aria-label`). Usar `BrandLogo` en cualquier
  lugar donde el símbolo va acompañado del nombre visible (sidebar, drawer,
  Login) — nunca reconstruir manualmente "cuadrado + texto" al lado.
- **No volver a crear un cuadrado/placeholder alrededor de la marca.** Esto
  existía en varias pantallas (AppShell, Login, `/ui-preview`) y ya se
  reemplazó en todas — no reintroducirlo en una pantalla nueva.
- **No reinterpretar ni redibujar la marca.** El PNG actual es la referencia
  oficial tal cual. Si en algún momento se crea una versión SVG (para
  favicon/PWA), debe salir del archivo de diseño original — nunca de
  recalcar curvas a ojo sobre este export.

---

## 12. Accesibilidad

Mínimos ya vigentes en todo el código, no aspiracionales:

- **focus-visible**: outline global y tokenizado (`global.css`), aplica a
  todo elemento interactivo sin que cada componente lo declare.
- **aria-label**: obligatorio a nivel de tipos en `IconButton` para
  cualquier botón solo-ícono — no compila sin él.
- **sr-only**: clase global basada en `clip` (no `display:none`) para texto
  solo para lectores de pantalla — ver el "Cargando…" de `HabitexBootScreen`.
- **reduced-motion**: ver §9 — global, automático.
- **inert en drawers**: el drawer móvil usa `inert` cuando está cerrado, no
  solo oculto visualmente — sus botones dejan de ser alcanzables por
  teclado.
- **Navegación por teclado**: `Tabs` implementa roving tabindex completo
  (flechas izquierda/derecha, `aria-selected`, `aria-controls`).
- **Contraste**: la tarjeta de métricas del Login usa tokens fijos de alto
  contraste (`--hero-card-foreground-muted`, `--hero-card-trend-foreground`)
  precisamente porque su fondo oscuro es fijo — nunca depender de un token
  que varía por tema si la superficie que lo usa no varía con él.
- **Estados no comunicados solo por color**: un tono (`Badge`/`IconBadge`)
  siempre va acompañado de texto o ícono — nunca un punto de color como
  único indicador de estado.

---

## 13. Prohibiciones visuales

- No Tailwind actualmente.
- No MUI / Chakra / shadcn ni otro UI kit sin una decisión arquitectónica
  explícita (esto cambiaría todo `shared/ui/`).
- No colores hardcodeados cuando existe un token (excepciones: el `<style>`
  anti-FOUC de `index.html` y los píxeles del propio `habitex-mark.png`).
- No gradientes decorativos como lenguaje general de la interfaz.
- No neón.
- No glassmorphism generalizado — solo la tarjeta del Login (§10).
- No sombras exageradas — `--shadow-sm/md/lg` son el techo.
- No mezclar icon packs — todo ícono sale de `src/shared/ui/icons.tsx`.
- No duplicar un componente cuando ya existe un primitive (§5).
- No breakpoints ad hoc — solo 640px/1024px (§7), salvo necesidad
  demostrable y documentada.
- No diseño genérico de dashboard/SaaS por defecto — cada pantalla se mide
  contra §1.

Las excepciones ya existentes y justificadas (glass del Login, crossfade,
scrim) son casos cerrados y documentados — **no son precedente** para pedir
una excepción nueva en otra pantalla sin la misma justificación explícita.
