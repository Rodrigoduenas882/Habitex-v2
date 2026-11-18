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


## 16. Arriendos, Términos y Contratos — Sprint 3

Issue #28. Referencia: Figma `Habitex-Design-Lab` (misma URL de §15).

**Nota de verificación.** Igual que en §15, Figma respondió 403 sin sesión
autenticada desde este entorno — no hay forma de comparar contra el diseño
real pixel a pixel. Esta sección documenta las decisiones tomadas para
mantener el mismo lenguaje visual ya aprobado en los Sprints 1 y 2
(`IconBadge` + identidad + Badge de estado, back-button con `ChevronLeftIcon`,
`Card` para contenedores con borde, agrupación de formularios por sección)
en vez de inventar un patrón nuevo sin poder verificarlo contra Figma.
Cualquier diferencia que una revisión con acceso real a Figma encuentre
manda sobre lo que está aquí.

### 16.1 Alcance de este sprint

Solo UI/UX sobre los módulos de Arriendos y Contratos ya existentes — sin
tocar RPC, RLS, migraciones, permisos, límites de plan ni el ciclo de vida
DRAFT→ACTIVE→ENDING→ENDED / DRAFT→CANCELLED. Las confirmaciones de dos
pasos para Cancelar/Terminar arriendo/Terminar contrato ya existían antes
de este sprint (`LifecycleConfirmAction`/`TerminateContractAction`) — se
conservan exactamente, no se tocaron.

### 16.2 Listado de arriendos (`RentalListCard`)

Mismo lenguaje de tarjeta que `PropertyListCard`/`ParkingListCard` (Sprint
2): una cabecera con `IconBadge` (`KeyIcon`, tono neutral — un solo ícono
para toda la tarjeta, no uno por tipo de sujeto, porque
`RentalRelationship` no trae `subjectType` y resolverlo exigiría un nuevo
cruce de datos que este incremento no necesita) + bloque de identidad
(sujeto arrendado en negrita, arrendatario como texto secundario) + Badge
de estado alineado a la derecha. El canon, las fechas de vigencia y el día/
momento de pago quedan como líneas de caption debajo, exactamente con el
mismo contenido/formato que ya tenían (ninguna prueba de contenido de texto
cambió). Las acciones (Activar, Cancelar, Iniciar cierre, Terminar
arriendo, navegación a Términos/Contratos/Cargos/Pagos) no se tocaron.

### 16.3 Crear arriendo (`AddRentalDraftForm`) y Términos (`RentalTermsPage`)

Dos cambios, ambos ya establecidos en el formulario de Propiedades
(`AddPropertyPage.module.css`), aplicados aquí por primera vez a Arriendos:

- El botón "Volver" ahora lleva `ChevronLeftIcon` antes del texto (antes
  era texto plano) — mismo patrón que `AddFullPropertyForm`.
- Cada sección (`¿Cuál inmueble?`/`¿A quién se lo arriendas?` en el
  formulario de creación; `Fechas y pago`/`Condiciones financieras` en
  Términos) se envuelve en un `div.formSection` propio (gap menor que el
  del formulario completo) en vez de ser un `h2` suelto dentro del mismo
  flex column que todo lo demás — la misma jerarquía visual que
  `AddFullPropertyForm`'s `formSection`, nunca un `Card` con borde
  (ese patrón no existe para secciones de formulario en ningún formulario
  existente del repo; introducirlo aquí habría sido inconsistente).
- Términos agrega un hint accesible al selector de "Momento de pago"
  explicando qué significa anticipado/vencido — pura aclaración de copy,
  no cambia la validación ni el guardado. El aviso de guardado parcial
  (`termsForm.errors.partialFailure`) y la vista de solo lectura ya
  existían; no se modificaron.

### 16.4 Contratos (`RentalContractsPage`)

- Los dos formularios de registro ("Registrar contrato Habitex"/
  "Registrar contrato externo firmado") reemplazan su `<div>` con
  `border`/`border-radius` manuales por el primitive `Card` (§5 — "no
  hardcodear border+radius+shadow cuando ya existe un primitive"). El
  `<form>` sigue siendo el elemento de formulario real (necesario para que
  `onSubmit` dispare con Enter) — `Card` se anida *dentro* de él, mismo
  patrón que `ParkingForm` ya usaba.
- `ContractCard` (la fila de cada contrato) ahora tiene la misma cabecera
  `IconBadge` (`FileTextIcon`) + identidad + Badge que el resto de las
  tarjetas de lista de la app, en vez de solo un Badge + caption de versión
  sueltos.
- Integridad SHA-256, origen EXTERNAL/HABITEX_GENERATED, los cuatro
  estados GENERATED/SHARED/SIGNED/TERMINATED, la subida/descarga de
  archivos y el manejo de fallos parciales no cambiaron — solo el envoltorio
  visual.

### 16.5 Preview de QA (`RentalsVisualPreview`)

Mismo mecanismo exacto que `PropertiesVisualPreview` (§15.6), con su propia
bandera independiente: `VITE_ENABLE_RENTALS_PREVIEW` /
`__ENABLE_RENTALS_PREVIEW__`, el mismo allowlist de modos
(`PREVIEW_ALLOWED_MODES`, solo `'e2e'`) y el mismo guard de contenido
(`scripts/assert-no-demo-chunk.mjs`, ahora con marcadores propios de este
preview). `pnpm build` normal nunca emite su chunk; `pnpm build:e2e` sí,
verificado en ambas direcciones.

Reutiliza los componentes reales (`RentalListCard`, y `ContractCard`
exportado desde `RentalContractsPage.tsx` con el mismo principio que
`PropertiesSection`/`ParkingsSection` en Sprint 2) en vez de una copia
visual aparte — así el preview no puede desviarse de lo que la página real
renderiza. `RentalListCard` recibe sus acciones como callbacks no-op
(`() => {}`), porque ese componente nunca llama una mutación por sí mismo —
es la página real (`RentalsPage`) quien las conecta, así que el preview
simplemente no las conecta a nada.

**Corrección (segunda auditoría de Codex, PR #29) — `ContractCard` sí hacía
tráfico real.** La versión anterior de esta sección decía que las
mutaciones de `ContractCard` (`useMarkContractShared`/`useTerminateContract`)
podían quedarse reales porque un clic contra un fixture "simplemente falla
igual que una llamada no autenticada" — pero `useContractFile` (detrás de
los botones de descarga) es un `useQuery` que se dispara automáticamente al
montar en cuanto un fixture trae `documentFileId`/`signedFileId`, es decir
un GET real sin sesión contra Supabase apenas carga esta página pública, no
solo una falla disparada por clic. Corregido con la prop `previewMode` de
`ContractCard` (ver `ContractCardProps`, `RentalContractsPage.tsx`): omite
los botones de descarga por completo (ese `useQuery` nunca llega a montarse)
y convierte las acciones mutantes (marcar compartido, adjuntar copia
firmada, terminar) en no-op — la UI de confirmación en dos pasos de
"Terminar contrato" sigue siendo demostrable igual que antes, solo la
llamada final queda suprimida. El Alert del preview ya no afirma que las
acciones "fallarán de forma segura"; dice explícitamente que no hacen
ninguna llamada real.

Cubierto en `e2e/rentals-preview.spec.ts`: alcanzabilidad sin sesión,
variedad completa de estados de Arriendos y Contratos, ausencia de UUIDs/
copy de firma avanzada, Light/Dark, overflow horizontal en
320/375/768/1024/1440 (los anchos pedidos en el Issue #28) en ambos temas, y
ausencia total de peticiones de red reales (ver §16.6).

### 16.6 Corrección del P1 visual y de los tres P2 — segunda auditoría de Codex (PR #29)

**P1 — jerarquía visual de Creación/Condiciones/Contrato.** Verificación
directa de Figma (conexión autenticada del usuario, no de este entorno) de
los candidatos `370:3` (01 Selección), `370:477` (03 Condiciones) y
`370:716` (Contrato externo). Decisión de producto: recuperar la jerarquía
en las rutas existentes (`/rentals/new`, `/rentals/:id/terms`,
`/rentals/:id/contracts`), sin pantalla nueva de revisión/activación (esa
sigue viviendo en `/rentals`, sin tocar) y sin inventar campos/RPC.

- **`RentalStepper`** (`src/features/rentals/presentation/RentalStepper.tsx`):
  indicador puramente informativo de 4 pasos (Selección → Arrendatario →
  Condiciones → Contrato). `currentStep` lo deriva cada página de en qué
  ruta/sub-estado real está el usuario — nunca hay `onStepClick`, nunca crea
  una ruta nueva, nunca simula un wizard transaccional. Un paso anterior al
  actual se muestra "completado" solo porque llegar al paso siguiente ya
  implica que su precondición real en el backend se cumplió (p. ej. llegar a
  `/rentals/:id/terms` implica que `create_rental_draft` ya tuvo éxito) —
  nunca una suposición del cliente sobre datos que podrían no existir. Se
  renderiza como `<ol>` plano, nunca como heading, para no introducir un
  segundo nivel de encabezado en ninguna página.
- **`RentalSummaryPanel`** (mismo directorio): "resumen del arriendo"
  (inmueble/arrendatario/canon/fechas) de solo lectura, nunca un formulario.
  Cada página le pasa exactamente los datos reales que ya tiene resueltos —
  `useRentalIdentities` para inmueble/arrendatario (mismo caché que
  `RentalContextHeader` ya usa, DS-002), y en el formulario de creación/
  condiciones, los valores que react-hook-form ya tiene en vivo (`watch`) —
  nunca un dato inventado. Un campo no resuelto todavía muestra "Sin
  definir" (i18n), igual convención que `RentalListCard`.
- **`RentalFlowLayout`** (mismo directorio): shell compartido que siempre
  renderiza `RentalStepper` primero; lo que sigue depende de `variant`:
  - `variant="sidebar"` (default, sin cambios desde el primer fix de este
    P1) — grid de dos columnas (contenido / resumen lateral en ≥1024px,
    apilado debajo en mobile/tablet — reutiliza el breakpoint existente de
    1024px, §7/§8, sin introducir uno nuevo). Es el único modo que usa
    `RentalContractsPage` (paso 4, vía import cross-feature, mismo patrón ya
    establecido por `RentalContextHeader`) — ver la corrección más abajo
    sobre por qué el resto de los pasos ya no usa este modo.
  - `variant="stacked"` (`AddRentalPage` paso 1, `AddRentalDraftForm` paso
    2, `RentalTermsPage` paso 3) — sin grid, sin columna lateral: el
    componente solo envuelve `children` tal cual, sin inyectar ni reordenar
    nada. Quien llama decide dónde exactamente va `RentalSummaryPanel`
    dentro de `children` — ver la corrección siguiente.

**Corrección (segunda auditoría de Codex, PR #29) — el resumen quedaba
después del contenido, no antes.** La primera versión de este fix inyectaba
`RentalSummaryPanel` siempre como columna lateral (`variant="sidebar"`
único, vía una prop `summary`) para los 4 pasos — en desktop quedaba al lado
del contenido, pero en mobile/tablet el grid de una columna lo apilaba
**debajo** del selector/formulario, nunca antes, contradiciendo los
candidatos de Figma `370:3` (01 Selección), `370:477` (03 Condiciones) y
`370:622`, donde el resumen aparece justo después del título/stepper y
antes del contenido principal, en cualquier ancho. Corregido eliminando el
slot de resumen fijo de `RentalFlowLayout` para el modo `stacked`: ahora
`AddRentalPage`, `AddRentalDraftForm` y `RentalTermsPage` (sus dos retornos,
editable y solo-lectura) renderizan `<RentalSummaryPanel>` ellos mismos,
como un elemento más de `children`, inmediatamente después de su propio
título/`RentalContextHeader` y antes del selector/primer campo. Como
`.pageStacked` (el contenedor de este modo) es una columna flex simple sin
ningún `@media`, el orden en el DOM es el orden en pantalla **en cualquier
ancho** — no hay forma de que 320px y 1440px difieran, porque ninguna regla
responsive reordena esos tres bloques (el único `@media` de
`RentalFlowLayout.module.css` pertenece exclusivamente al grid de
`variant="sidebar"`, y el único `@media` de `RentalTermsPage.module.css`
solo reordena los *campos dentro* del formulario, nunca el resumen frente
al formulario). Verificado con aserciones de orden real en el DOM
(`compareDocumentPosition`) en `AddRentalPage.test.tsx`,
`AddRentalDraftForm.test.tsx` y `RentalTermsPage.test.tsx` (ambas ramas).
`RentalContractsPage` (paso 4) no se tocó — conserva `variant="sidebar"`
(default) con su resumen lateral en escritorio, tal como pidió esta
corrección explícitamente.

**Nota de verificación en navegador real.** No fue posible correr la
confirmación visual en Chromium contra las rutas autenticadas reales
(`/rentals/new`, `/rentals/:id/terms`) desde este entorno: el harness de
E2E autenticado (`e2e-authenticated/`, `playwright.e2e-local.config.ts`)
requiere una pila local de Supabase vía Docker (`pnpm exec supabase
start`), y el daemon de Docker no estaba corriendo en esta sesión
(`supabase status` falló con `dockerDesktopLinuxEngine` inalcanzable).
Arrancar Docker Desktop y la pila completa de Supabase para esta
verificación puntual se consideró una acción desproporcionada frente al
alcance pedido ("limita el cambio al layout... y a sus pruebas"). La
garantía de orden documentada arriba (ausencia de `@media` entre esos tres
bloques, más las aserciones de `compareDocumentPosition`) es la evidencia
disponible; no sustituye una captura real si en algún momento se corre el
harness autenticado.
- **Condiciones** (`RentalTermsPage`): `.formSection` pasa de columna única
  a grid de 2 columnas en ≥1024px / 1 columna en mobile (el `h2` de cada
  sección ocupa el ancho completo vía `grid-column: 1 / -1`), tanto en el
  formulario editable como en la vista de solo lectura.
- **Contrato externo** (`RegisterExternalSignedForm` en
  `RentalContractsPage.tsx`): se separa visualmente en tres subsecciones —
  "Documento del contrato" (el input de archivo real, sin cambios de
  comportamiento), "Fecha de firma" y "Partes del contrato". La fecha de
  firma **no es un campo**: es una nota de texto explicando honestamente que
  este formulario/RPC (`register_external_signed_contract`) no tiene una
  fecha de firma persistente propia — inventar un input (editable o incluso
  solo-lectura) habría fabricado un dato que el modelo no respalda. "Partes
  del contrato" muestra solo lo que este frontend ya resuelve: el nombre del
  arrendatario actual (`useRentalIdentities`, mismo origen que
  `RentalSummaryPanel`) y "Sin definir" para el arrendador, honesto porque
  ningún repository de esta feature lee el nombre del participante LESSOR.

**P2.1 — foco al cancelar confirmaciones.** `LifecycleConfirmAction`
(`RentalListCard.tsx`) y `TerminateContractAction`
(`RentalContractsPage.tsx`) ya movían el foco al botón de confirmación al
entrar en modo confirmación, pero al pulsar "Volver" el foco caía a
`<body>` — rompiendo la secuencia de Tab para cualquiera que saliera de la
confirmación sin completarla. Corregido con un segundo ref al botón
disparador original y un ref de "estaba confirmando" que detecta la
transición confirming→false específicamente (nunca en el montaje inicial) y
devuelve el foco a ese disparador.

**P2.2 — nombres largos sin espacios a 320px.** Un `subjectLabel`/
`tenantName` puede ser una cadena larga sin espacios. `RentalListCard`
(`.identity p`), `RentalContextHeader` (`.title`, con `min-width: 0` además
de `overflow-wrap`, necesario porque es un hijo flex) y `RentalSummaryPanel`
(`.rowValue`) ahora usan `overflow-wrap: anywhere` — mismo patrón ya
establecido por `KpiCard`/`AttentionPanel`. Fixture adversarial de ~72
caracteres sin espacios en `RentalsVisualPreview`, verificado por bounding
box en `e2e/rentals-preview.spec.ts` a 320px.

**P2.3 — preview aislado del backend real.** Ver la corrección documentada
arriba en §16.5.


## 17. Cobros, Pagos y Recibos — Sprint 4

Issue #30. Referencia: Figma `Habitex-Design-Lab` (misma URL de §15/§16).

**Nota de verificación.** Igual que en §15/§16, Figma respondió 403 sin
sesión autenticada desde este entorno — confirmado de nuevo para este
sprint, sin forma de comparar contra el diseño real pixel a pixel. Esta
sección documenta las decisiones tomadas para extender el mismo lenguaje
visual ya aprobado en los Sprints 2/3 (`IconBadge` + identidad + Badge de
estado, `Card` anidado dentro de `<form>`, `Alert` para estados de éxito
persistente) a Cobros y Pagos, en vez de inventar un patrón nuevo sin poder
verificarlo contra Figma. Cualquier diferencia que una revisión con acceso
real a Figma encuentre manda sobre lo que está aquí.

### 17.1 Alcance de este sprint

Cobros (`RentalChargesPage`), Pagos y Recibos (ambos dentro de
`RentalPaymentsPage` — Recibos no tiene feature/ruta propia, ver
`docs/agentic/PROGRESS.md` INC-015) ya eran visualmente maduros antes de
este sprint: ambas páginas ya usaban `Card`/`Badge`/`Alert`/`Button`/
`Input`/`Select`/`Textarea`/`EmptyState`/`Skeleton` y el `RentalContextHeader`
compartido de Sprint 3 — este no es un rediseño desde cero como Properties
(§15) o Rentals (§16), sino un pulido acotado de los huecos concretos
identificados. Solo UI/UX: sin cambios en dominio, infraestructura,
aplicación, `composition.ts`, RPC, reglas de negocio, permisos,
validaciones, redondeos, idempotencia de `report_payment` ni recuperación
ante fallos/reintentos — verificado explícitamente por `habitex-reviewer`
con `git diff` dirigido contra esas capas (0 resultados).

### 17.2 Cobros (`ChargeCard`)

El header pasa de un `Badge` + caption de tipo sueltos a el mismo patrón
`IconBadge` + identidad + `Badge` que `RentalListCard`/`ContractCard` ya
usan (§16.2/§16.4): `IconBadge icon={<WalletIcon/>} tone="neutral" size={36}
radius="md"` (reutiliza `WalletIcon`, ya usado en el `EmptyState` de esta
misma página — sin ícono nuevo) + un bloque de identidad con el tipo de
cargo como título en negrita y la descripción como línea secundaria muted
(antes un párrafo suelto debajo del header) + el `Badge` de estado
existente, ahora alineado a la derecha. `charge.description` es texto
libre, así que su contenedor usa `overflow-wrap: anywhere` (mismo patrón
que `RentalListCard.module.css`). El resto de la tarjeta (período,
vencimiento, `Valor`/`Pagado`/`Saldo`) no cambió. Los estados de carga/
error/vacío (`Skeleton`/`Alert`/`EmptyState`) ya existían y siguen
coherentes con el nuevo header sin necesitar cambios.

### 17.3 Pagos (`PaymentCard`, `PaymentReportForm`)

- **Header de `PaymentCard`**: mismo patrón `IconBadge`+identidad — título
  en negrita = el monto ya formateado (sin cambiar texto/estilo), línea
  secundaria muted = fecha + método (`"{{date}} · {{method}}"`, o solo la
  fecha cuando no hay método, sin separador colgante). Esta línea
  secundaria **duplica deliberadamente** datos que ya aparecen como
  captions independientes en la zona de Detalles — mismo principio
  "escaneo rápido arriba, detalle completo abajo" que `RentalListCard`/
  `ContractCard` ya establecieron, no un descuido.
- **`PaymentReportForm`**: se envuelve en `Card`, mismo patrón que
  `RegisterExternalSignedForm`/`RegisterHabitexGeneratedForm` (§16.4) — el
  `<form>` sigue siendo el elemento real (necesario para que `onSubmit`
  dispare con Enter), `Card` se anida *dentro* de él.

### 17.4 Recibos (`PaymentReceiptSummary`)

El recibo ya emitido pasa de dos `<p>` sueltas (sin ningún tratamiento
visual — la superficie menos pulida de las tres features antes de este
sprint) a un `Alert tone="success"` con el mismo número/fecha que ya se
mostraba, reutilizando el mismo vocabulario visual que esta página ya usa
para "éxito persistente" (la línea de allocation completa). Esto diferencia
visualmente el recibo que emite Habitex del comprobante que adjunta la
persona (`PaymentProofDownloadButton`, zona de Detalles, botón ghost de
descarga) — pedido explícito del Issue #30. **No se agregó ningún botón de
descarga/archivo para el recibo**: `issue_receipt` nunca setea `file_id` en
el backend desplegado (confirmado, ningún RPC/policy en todo el schema lo
popula) — inventar una descarga habría fabricado una funcionalidad
inexistente. El resto de la lógica (hint de "sin allocations", botón
"Emitir recibo", manejo de la carrera `receipt_already_issued`) no cambió.

### 17.5 i18n

Se agregaron `card.header.subtitle`/`card.header.subtitleNoMethod` a
`payments.json` (es y es-CO). De paso se corrigió un drift preexistente
sin relación con este sprint: `es/payments.json` le faltaba la key
`reportForm.errors.idempotency_key_reused` que `es-CO/payments.json` ya
tenía — copiada tal cual, ambos locales quedan de nuevo byte-idénticos.


## 18. Jerarquía financiera unificada y correcciones P2 — PR #31

Issue #30 (continuación). Referencia: Figma `Habitex-Design-Lab`
[escritorio 372:3](https://www.figma.com/design/JWScoQUWsRab9SFYq7mT2z/Habitex-Design-Lab?node-id=372-3)
y [móvil 372:330](https://www.figma.com/design/JWScoQUWsRab9SFYq7mT2z/Habitex-Design-Lab?node-id=372-330).

**Nota de verificación.** Igual que en §15/§16/§17, Figma respondió 403 sin
sesión autenticada desde este entorno — sin forma de comparar contra el
diseño real pixel a pixel. Esta sección documenta las decisiones tomadas a
partir de la descripción textual de la auditoría de Codex (resumen
financiero con monto/saldo prioritarios, cobros en filas compactas para
escritorio, historial de pagos dentro de una misma experiencia), nunca una
inspección directa de los nodos 372:3/372:330. Cualquier diferencia que una
revisión con acceso real a Figma encuentre manda sobre lo que está aquí.

### 18.1 Alcance

Se compone la jerarquía dentro de la ruta existente `/rentals/:id/charges`
(`RentalChargesPage`) — decisión explícita de la remediación ("se admite
una composición/overview en la ruta de Cobros existente si es la vía
mínima segura"). **No se creó ninguna ruta nueva**; `/rentals/:id/payments`
sigue siendo la única superficie con acciones de pago (reportar, confirmar,
rechazar, aplicar a cargos, emitir recibo) — Cobros solo navega ahí, nunca
duplica esa lógica. Cero cambios de dominio, RPC, RLS, consultas de
autorización o idempotencia — verificado con `git diff` dirigido contra
esas capas.

### 18.2 Resumen financiero (`FinancialSummary`)

Tres valores ("monto/saldo prioritarios"): Total facturado, Total abonado,
Saldo pendiente — sumas planas sobre los `charges` ya obtenidos
(`charge.amount`/`charge.paidAmount`/`charge.balance`, ya derivados
server-side desde `public.charge_balances`; `paid_amount`/`balance` solo
reflejan allocations `CONFIRMED`, ver `docs/agentic/PROGRESS.md`
INC-012/014). **Nunca se suma `Payment.amount`** para estos totales —
un pago `REPORTED`/`REJECTED` no es el mismo hecho financiero que uno ya
asignado y confirmado, y mezclarlos era exactamente el riesgo semántico que
la auditoría señaló. El resumen **no se muestra** cuando no hay cargos
(nunca "$0" fabricado en todas partes — mismo principio que
`RentalListCard`'s `rentAmountUnknown`).

Deliberadamente **no es** `KpiCard` (`features/dashboard/presentation/`):
ese primitive usa `--dashboard-glass-surface` + `backdrop-filter`, y
`DESIGN.md` §14 reserva ese vidrio **exclusivamente** a las 4 KPI cards del
Dashboard y el disparador del menú de usuario ("las tablas conservan
fondos sólidos"). `FinancialSummaryTile` es un `Card` sólido (mismo
`--color-surface` que el resto de la página) + `IconBadge` + valor
`text-h3 tabular-nums` — ningún vidrio nuevo, ningún primitive duplicado.
El tile de "Saldo pendiente" es la única navegación contextual al detalle
de pagos (`to="/rentals/:id/payments"`, mismo mecanismo DS-004 que
`KpiCard`'s propio `to`).

### 18.3 Cobros en filas compactas para escritorio (`ChargesTable`)

Mismo mecanismo exacto que Properties (§15.1/§15.3): un `<table>` real con
encabezados de columna accesibles (`<th scope="col">`) y la lista de
`ChargeCard` ya existente **siempre** se renderizan ambos en el DOM; CSS
(`.tableWrap`/`.compactList`, no JS) elige uno por el breakpoint existente
de 1024px — nunca uno nuevo. `display:none` saca al oculto del árbol de
accesibilidad también. Mismos datos, mismo `STATUS_TONE`, nunca una segunda
fuente de verdad. La columna "Valor pagado" (antes "Pagado") se renombró
para no colisionar textualmente con el Badge de estado `PAID` ("Pagado") —
mismo texto, significado distinto, encontrado al escribir las pruebas.

### 18.4 Historial de pagos (`PaymentsHistorySection`)

Lee `usePayments` (mismo query key que `/rentals/:id/payments` ya usa —
nunca una segunda petición de red en la práctica) y muestra cada pago real
como una fila de solo identidad (`IconBadge` + monto/fecha + Badge de
estado, mismo patrón de header que `PaymentCard`) — **nunca** ninguna de
las zonas de Detalles/Aplicación/Recibo/Acciones de `PaymentCard`, y
**nunca** un total agregado de montos de pago (ver §18.2 sobre por qué). Un
botón "Ver todos los pagos" (no un `<Link>` de texto — `--color-link` está
documentado como exclusivo de las pantallas públicas de auth, §2) es la
única salida hacia cualquier acción real. Estados de carga/error/vacío
propios, independientes de la lista de cargos (un arriendo puede tener
pagos reportados sin cargos generados todavía, `report_payment` no exige
`charge_id` — ver INC-013) — nunca gateado por `charges.length`. El
mensaje de "sin pagos" reutiliza textualmente `payments:empty.title`
(nunca una copia nueva duplicada).

### 18.5 P2 — overflow en Detalles de Pagos

`externalReference`/`notas` son texto libre que un usuario escribe — una
cadena de 130 caracteres sin espacios no tenía punto de quiebre válido y
desbordaba la tarjeta (956px de ancho desplazable a un viewport de 320px,
medido por la auditoría). Corregido con `max-width: 100%; overflow-wrap:
anywhere;` sobre **todas** las líneas de la zona de Detalles
(`.cardSection p`), no solo esos dos campos — mismo patrón ya establecido
por `RentalListCard`/`RentalContextHeader`. Verificado con un fixture
adversarial de 130 caracteres sin espacios en Chromium real (red simulada)
a 320/375/768/1024/1440px, claro y oscuro: 0px de desbordamiento horizontal
en los 20 casos.

### 18.6 P2 — foco al cancelar «Rechazar pago»

`RejectPaymentAction` (`RentalPaymentsPage.tsx`) tenía el mismo hueco que
`LifecycleConfirmAction`/`TerminateContractAction` ya corregido en el PR
#29 (§16.6): "Volver" devolvía el foco a `<body>`. Corregido con el mismo
mecanismo exacto — un segundo ref al botón disparador original y un ref de
"estaba confirmando" que detecta la transición confirming→false
específicamente. Verificado con un test de secuencia de teclado completa
(Enter→Tab→Enter→Tab) además de la aserción de foco directa.
