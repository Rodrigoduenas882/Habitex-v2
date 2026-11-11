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
| Neutrales | `--color-background`, `--color-surface`, `--color-surface-hover`, `--color-foreground`, `--color-muted`, `--color-border`, `--color-control-border` | Redefinidos por tema. |
| Brand | `--color-primary(-hover\|-foreground\|-subtle\|-subtle-foreground\|-accent)`, `--color-link(-hover)` | Acento aprobado en Figma ("Habitex - Design Lab", actualizado por el usuario 2026-11-03): `#4667a9` claro / `#79A9D1` oscuro. En Dark, Figma dio un solo hex por tema pero `tokens.css` lo reparte en dos roles — igual que ya hacía con el verde anterior — porque ese valor claro falla contraste (2.50:1) usado directamente como fondo de botón con texto blanco: `--color-primary-accent` se queda en el valor exacto de Figma (usos no-fondo: borde activo, foco, gráficos), y `--color-primary` usa un azul más oscuro calculado aparte, solo para fondo de botón. Ver `tokens.css` para los contrastes medidos de cada uno. |
| Semantic tones | `success` / `warning` / `danger` / `info`, cada uno con la misma tripleta base/subtle/subtle-foreground | Ver §6. |
| Shadows | `--shadow-sm/md/lg` | Redefinidas por tema (más planas y oscuras en Dark — un blur claro no se ve sobre superficies oscuras). |
| Spacing | `--space-1` (4px) … `--space-10` (64px) | Escala de 4px. |
| Radius | `--radius-sm/md/lg/full` | |
| Transitions | `--transition-fast/base/slow` | Ver §9 para la excepción del hero. |
| Layout | `--container-max-width`, `--sidebar-width`, `--topbar-height` | |

**Cuándo reutilizar un token**: siempre que el valor exista ya y comunique lo
mismo. Un `border` es siempre `--color-border`; un fondo tenue de éxito es
siempre `--color-success-subtle`.

**`--color-border` vs. `--color-control-border`**: dos tokens, dos
propósitos distintos, no intercambiables. `--color-border` es un divisor
estructural (borde de sidebar/card/drawer) — contraste bajo contra
la superficie es aceptable ahí, es decoración de layout, no una superficie
interactiva. `--color-control-border` es el límite de un control editable
(`Input`/`Select`/`Textarea`, y el borde de `Button` `secondary`) — la única
señal visual de que esa superficie es editable/accionable, por lo que debe
alcanzar ~3:1 contra `--color-surface` (WCAG 1.4.11). Nunca usar
`--color-border` en un control interactivo nuevo, ni `--color-control-border`
en un divisor puramente estructural.

**Cuándo se justifica crear uno nuevo**: cuando el valor existente cambiaría
un significado establecido, y el nuevo uso lo documenta explícitamente. Los
precedentes son `--transition-hero-crossfade`, el grupo `--hero-card-*`
(tarjeta flotante del Login), y el par `--color-link`/`--color-link-hover`
(enlaces de texto en las pantallas de autenticación) — los tres con un
comentario en `tokens.css` explicando por qué no podían ser un token
existente. `--color-link(-hover)` existe porque un enlace de texto es
contenido normal sobre `--color-surface`, y necesita el mismo 4.5:1 de
cualquier texto — `--color-primary`/`--color-primary-hover` están afinados
para texto blanco encima de un botón del color de marca, no para sí mismos
como color de texto; reutilizarlos así midió 2.49:1/2.09:1 en Dark,
encontrado en una revisión independiente del incremento de navegación+color
(2026-10). Un token nuevo sin ese tipo de justificación escrita no se
acepta.

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
- `ThemeControl` (`src/shared/theme/ThemeControl.tsx`): el único selector de
  apariencia de la app — radiogroup de **2** opciones visibles, Claro/Oscuro
  únicamente (decisión Sprint 1, issue #23; antes exponía "Sistema" como
  tercera opción seleccionable). `system` sigue existiendo como preferencia
  interna (`ThemePreference`, `theme.ts`/`useTheme.ts`): sin preferencia
  explícita guardada, el tema inicial se detecta de `prefers-color-scheme`
  y se sigue en vivo — el control solo deja de ofrecerlo como botón propio,
  y resalta Claro/Oscuro según el tema resuelto (`resolvedTheme`), no la
  preferencia cruda. No montar más de una instancia por página — cada una
  tiene su propio estado y podrían desincronizarse.
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

- **Jerarquía**: `display` solo en el hero de las pantallas públicas de auth
  (§10); `h1` para el valor
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
  `overflow: hidden`. El sidebar y el menú de usuario conservan su posición.
- **`.main` es la única zona de scroll** (`overflow-y: auto`, `min-height: 0`
  en toda la cadena de flex hasta ahí). Esto corrigió un bug real: antes, el
  shell crecía con el contenido y dejaba una columna vacía bajo un sidebar
  corto en F5. No revertir a `min-height` en `.shell`.
- **Sidebar** (desktop): ancho fijo `--sidebar-width` (248px), con
  `BrandLogo` arriba, navegación abajo. Colapsable a un riel de 80px vía el
  botón con chevrón (icons-only); mientras está colapsado, hover o
  focus-within sobre el riel lo expande visualmente de forma temporal (CSS
  puro, `AppShell.module.css`) para que las etiquetas sigan siendo legibles
  al pasar el mouse o tabular — no cambia el estado persistido
  `isSidebarCollapsed`, que solo el botón explícito modifica.
- **Ítem de navegación sin ruta todavía ("Próximamente")**: un
  `AppShellNavItem` sin `to` (sección planeada, sin pantalla aún) se
  renderiza como `<button disabled>` — nunca un `<Link>`/botón con la misma
  apariencia que uno real. Tratamiento: opacidad reducida (`0.55`, igual
  convención que `Button`'s `:disabled`), sin estado `:hover`, y en
  sidebar/drawer un label secundario compacto ("Próximamente",
  `AppShellProps.comingSoonLabel`) junto al nombre — en el bottom nav móvil
  (sin espacio) esa misma etiqueta solo existe como descripción accesible
  (`aria-describedby`, `sr-only`), nunca visible. `disabled` nativo ya
  resuelve que no sea alcanzable por teclado ni dispare navegación — no se
  simula con `aria-disabled` a mano.
- **Menú de usuario flotante**: nombre y avatar arriba a la derecha. Al abrir,
  muestra correo, `ThemeControl` y cierre de sesión. Sin barra superior.
  En escritorio el sidebar se contrae a un riel con un chevrón.
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
  fotográfico completo en las cuatro pantallas públicas de auth (§10),
  controles de carrusel visibles.
- **Tablet** (640–1023px): sidebar se reemplaza por hamburguesa + drawer; el
  hero de auth se reduce a un banner fijo (280px) con marca + headline, sin
  tagline (ni tarjeta de métricas, exclusiva del Login) — no porque no
  quepan, sino porque a ese tamaño compiten con el formulario.
- **Mobile** (<640px): el formulario/contenido es protagonista. Ninguna
  pantalla de auth muestra foto por debajo de 640px; el AppShell usa bottom
  nav en vez de drawer. "Mobile" nunca significa "el mismo layout de
  desktop, más angosto".
- El carrusel de `PropertiesOverview` es el ejemplo de referencia:
  desktop tiene flechas de scroll (solo cuando hay overflow real en esa
  dirección); táctil confía en swipe nativo — no se duplica la flecha en
  touch "por si acaso".

---

## 9. Motion

- **Tokens**: `--transition-fast` (120ms), `--transition-base` (180ms),
  `--transition-slow` (280ms) — hover, drawers, fades de UI en general.
- **Excepción explícita**: `--transition-hero-crossfade` (400ms), solo para
  el crossfade día/noche del hero de auth público (§10). No reutilizar este token para otra cosa;
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

## 10. Fotografía del auth público / Login

**Actualizado**: el hero fotográfico (`AuthHeroPanel`/`AuthPageLayout`,
`src/features/auth/presentation/`) es el lenguaje visual compartido de
**toda la superficie pública de autenticación de Habitex** — `/login`,
`/signup`, `/forgot-password` y `/reset-password` — no solo de Login. Decisión
explícita y documentada (no una deriva accidental): unifica la experiencia
entre las cuatro pantallas reutilizando los mismos assets ya existentes, sin
fotografía nueva ni dependencia de terceros. Sigue sin ser el punto de
partida para ningún dashboard ni formulario autenticado — solo para estas
cuatro pantallas públicas.

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
  sobre la foto de día). **El glassmorphism en sí sigue siendo exclusivo de
  Login** — `/signup`, `/forgot-password` y `/reset-password` comparten el
  hero fotográfico pero nunca muestran esta tarjeta ni ningún otro elemento
  de vidrio; sus propios formularios siguen siendo tarjetas sólidas
  (`Card` normal, sin `backdrop-filter`). Esta es una excepción localizada y
  documentada en `tokens.css` — **no generalizar glassmorphism al resto del
  producto.** Ningún otro componente de Habitex usa `backdrop-filter`.

---

## 11. Marca

- **`BrandMark`** (`src/shared/ui/BrandMark.tsx`): el símbolo solo. Envuelve
  el asset oficial `public/images/brand/habitex-mark.png` (PNG raster,
  fondo transparente verificado). Tamaño configurable vía `size`.
- **`BrandLogo`**: `BrandMark` + wordmark "Habitex", con el espaciado/
  tipografía ya resueltos. El wordmark usa `color: inherit` — se adapta al
  contexto (oscuro en el sidebar, blanco sobre la foto del hero de auth
  público) sin que el componente conozca temas.
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
- No glassmorphism generalizado — solo la tarjeta de métricas del Login
  (§10). El hero fotográfico en sí ya es compartido por las cuatro
  pantallas públicas de auth; el vidrio (`backdrop-filter`) no — eso sigue
  siendo exclusivo de esa tarjeta.
- No sombras exageradas — `--shadow-sm/md/lg` son el techo.
- No mezclar icon packs — todo ícono sale de `src/shared/ui/icons.tsx`.
- No duplicar un componente cuando ya existe un primitive (§5).
- No breakpoints ad hoc — solo 640px/1024px (§7), salvo necesidad
  demostrable y documentada.
- No diseño genérico de dashboard/SaaS por defecto — cada pantalla se mide
  contra §1.

Las excepciones ya existentes y justificadas (glass de la tarjeta de
métricas del Login — exclusivo de esa tarjeta; crossfade y scrim —
compartidos por las cuatro pantallas públicas de auth, §10) son casos
cerrados y documentados — **no son precedente** para pedir
una excepción nueva en otra pantalla sin la misma justificación explícita.


## 14. Primer corte del Dashboard — incremento 2

La instrucción del usuario de 2026-11-03 actualiza el acento oscuro a
#79A9D1. Los fondos primarios de botón siguen separados para conservar
contraste de texto blanco. Esta decisión sustituye el azul oscuro anterior
del incremento 1.

Como excepción a §10/§13, se permite vidrio moderado exclusivamente en las
cuatro KPI cards del Dashboard y el disparador del menú de usuario:
--dashboard-glass-surface, casi opaco, con borde y blur de 12px. El panel
del menú y las tablas conservan fondos sólidos.

El Dashboard de producción conserva sus consultas existentes y los estados
loading/error/empty. El preview local usa la misma presentación con datos
de demostración, marcados visiblemente y sin consultas de producto.


## 15. Inmuebles y Parqueaderos — Sprint 2

Referencia: Figma `Habitex-Design-Lab`, página 353:2, frame 353:3.

**Nota de verificación.** Figma no es accesible desde el entorno de
implementación (la URL responde 403 sin sesión autenticada), así que esta
sección documenta la especificación tal como quedó **escrita** en la
decisión de producto del PR #26 — no una comparación visual pixel a pixel.
Cualquier diferencia que una revisión con acceso real a Figma encuentre
manda sobre lo que está aquí.

### 15.1 Propiedades — tabla de escritorio (≥1024px)

Cinco columnas, en este orden:

| Columna   | Contenido                                                      |
| --------- | -------------------------------------------------------------- |
| Inmueble  | Nombre + modalidad (`rentalMode`) como metadato secundario      |
| Dirección | Dirección como principal + ciudad como secundaria              |
| Tipo      | `propertyType` (Casa / Apartamento) en Badge neutral           |
| Unidades  | Número de unidades arrendables                                 |
| Ocupación | Fracción `ocupadas/totales` + Badge de estado                  |

La modalidad **no** es columna propia: vive dentro de la celda Inmueble.
Tampoco existe una columna «Estado» separada — el Badge de estado vive
dentro de Ocupación, complementando la fracción, nunca sustituyéndola
cuando la fracción existe.

### 15.2 Unidades y Ocupación — reglas sobre el modelo de datos real

Única fuente de la señal: `usePropertyOccupancy` (la misma que usa el
Dashboard). La derivación vive en `deriveUnitsAndOccupancy`.

- `FULL_PROPERTY` → Unidades `1`; Ocupación `0/1` o `1/1`.
- `BY_ROOMS` → Unidades `totalRooms` (solo habitaciones **habilitadas**);
  Ocupación `occupiedRooms/totalRooms`.
- Mientras `occupancy.status !== 'ready'` (cargando o fallida): Unidades
  muestra `—` con `aria-label` «Sin datos», Ocupación muestra **solo** el
  Badge «Sin datos» y ninguna fracción.

**Desviación forzada por el modelo de datos:** la especificación habla de
«unidades» como un dato del inmueble, pero en el esquema real no existe tal
columna — se deriva de `rentalMode` y del cruce de ocupación, que es una
consulta aparte y puede no haber resuelto todavía. De ahí el estado `—` /
«Sin datos»: es honesto y no inventa un `0` que parecería «cero unidades».
Nunca se presentan valores de fixtures como datos reales.

### 15.3 Propiedades — tarjetas compactas (<1024px)

Se conserva el formato compacto: cabecera de una línea (icono, nombre,
ciudad, dirección, Badge de estado), el caption de unidades/ocupación solo
cuando se conoce, y los Badges de tipo y modalidad. Sin cabecera gigante y
sin overflow horizontal. Parqueaderos mantiene su lista de filas compactas
en todos los anchos.

Tabla y tarjetas se renderizan **ambas** siempre; CSS (no JS) elige una por
breakpoint, igual que AppShell ya hace con sidebar vs. drawer. No se
inventan breakpoints: sigue siendo solo 1024px (§8).

### 15.4 Filtros locales

Ciudad, Tipo y Ocupación, combinables entre sí y con la búsqueda de texto
existente, **por AND**. Operan en memoria sobre la lista ya cargada: sin
consultas nuevas, sin RPC, sin paginación, sin conteos globales.

- Ciudad: valores únicos de `Property.city` ya presentes en la lista.
- Tipo: `HOUSE` / `APARTMENT`.
- Ocupación: el mismo estado derivado que muestra el Badge.

`unknown` **nunca** se clasifica como «Disponible». Se ofrece «Sin datos»
como opción real y seleccionable del filtro de Ocupación (se eligió esto en
vez de deshabilitar el filtro: el filtro sigue siendo útil, y reutiliza la
etiqueta que ya usa el Badge en lugar de inventar un sinónimo). Mientras la
señal no está `ready`, el propio `Select` lleva un hint accesible que lo
explica.

**Corrección (tercera auditoría de Codex, PR #26).** El filtro de Ciudad
usaba `'all'` como valor centinela de «sin filtro», igual que Tipo y
Ocupación — pero a diferencia de esos dos (uniones cerradas que nunca
pueden ser literalmente `'all'`), Ciudad es texto libre
(`z.string().min(1)`, ver `property-base-form.ts`): un inmueble cuya ciudad
real fuera literalmente «all» colisionaba con el centinela y el filtro lo
trataba como «sin filtro» en vez de filtrar por esa ciudad. La auditoría lo
demostró sustituyendo un fixture. Corregido usando `null` como centinela de
Ciudad (nunca puede ser una ciudad real) en vez de un string — el `<select>`
HTML sigue usando `""` como valor de la opción «Todas las ciudades», pero
ese valor nunca se confunde con uno de los `<option>` reales porque una
ciudad real nunca es cadena vacía.

Los filtros y la búsqueda se limpian al cambiar de administración: un valor
que existía en la anterior podría ocultar todo en la nueva y parecer «esta
administración no tiene inmuebles». Hoy /properties no tiene selector de
administración en página, así que el reset es defensivo (cubierto por
`PropertiesPage.administrationSwitch.test.tsx`).

Los estados vacíos siguen diferenciados: «no hay datos» ≠ «sin resultados
para "término"» ≠ «ningún inmueble coincide con los filtros». Propiedades y
Parqueaderos conservan estados de carga/error independientes.

### 15.5 Región de estado accesible

Cada sección con datos monta su `role="status"` + `aria-live="polite"`
**vacía desde el principio**; al buscar solo cambia su texto, nunca se
monta ni desmonta el nodo. Algunas tecnologías asistivas solo anuncian de
forma fiable las *actualizaciones* de una región viva, no una región que
aparece ya con su primer valor. El foco nunca se mueve.

**Corrección (tercera auditoría de Codex, PR #26).** La región solo
anunciaba algo mientras había texto en la búsqueda (`searchTerm.trim()`):
aplicar un filtro de Ciudad/Tipo/Ocupación sin escribir nada dejaba la
región vacía aunque la lista visible cambiara. Corregido: en Propiedades,
la región se activa con texto de búsqueda **o** con cualquier filtro
activo (`isFiltering`), y el mensaje de «sin resultados» elige entre la
redacción de búsqueda («Intenta con otro nombre, dirección o ciudad.») y la
de filtros («Ajusta la ciudad, el tipo o la ocupación seleccionados.»)
según si hay texto escrito. Parqueaderos no tiene filtros propios, así que
conserva el criterio original (solo texto).

### 15.6 Módulo de demostración fuera del build productivo

`PropertiesVisualPreview` (fixtures ficticios) se excluye en tiempo de
build, no solo por ruta: `__ENABLE_PROPERTIES_PREVIEW__` (define de
`vite.config.ts`) condiciona el propio `import()`, de modo que Rollup no
emite su chunk en un `pnpm build` normal. `scripts/assert-no-demo-chunk.mjs`
verifica el artefacto real de `dist/` y rompe el build si reaparece.
`pnpm build:e2e` sí lo incluye a propósito: es el build de revisión/E2E.

**Corrección (tercera auditoría de Codex, PR #26) — dos defectos
encontrados en esta misma protección:**

1. **La bandera por sí sola no bastaba.** `__ENABLE_PROPERTIES_PREVIEW__`
   se calculaba como `env['VITE_ENABLE_PROPERTIES_PREVIEW'] === 'true'`,
   donde `env` viene de `loadEnv(mode, cwd, 'VITE_')` — y `loadEnv` fusiona
   las variables de entorno reales del proceso (`process.env`) por encima
   del `.env*` que corresponde al modo, sin restringir *qué* modos pueden
   traer esa variable. La auditoría lo demostró exportando
   `VITE_ENABLE_PROPERTIES_PREVIEW=true` en el shell y corriendo
   `pnpm build` (modo `production`): el chunk se emitía igual, aunque
   ningún `.env` del repo la define. Corregido con una lista explícita de
   modos autorizados (`PREVIEW_ALLOWED_MODES`, hoy solo `'e2e'`) evaluada
   **antes** de mirar la bandera — el modo lo decide qué script de
   `package.json` corre, no una variable ambiental fuera de control del
   repo.
2. **El guard verificaba el nombre del chunk, no su contenido.** La
   auditoría renombró el chunk generado a `index-audit.js` y el guard
   devolvió 0 (falso «limpio»). `scripts/assert-no-demo-chunk.mjs` ahora
   recorre `dist/` completo y busca literales de texto que solo existen en
   los fixtures/copy de `PropertiesVisualPreview` (p. ej. `demo-prop-1`,
   el texto de su Alert de aviso) dentro del contenido de cada archivo —
   un minificador no altera el contenido de un string literal, así que
   esto sobrevive sin importar cómo Rollup nombre el chunk.
