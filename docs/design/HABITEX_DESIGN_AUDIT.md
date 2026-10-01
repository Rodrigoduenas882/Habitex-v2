# Habitex — Design & UX Audit

**Fecha:** 2026-10-01
**Baseline:** `chore/agentic-foundation` @ `3f5be6901b7f83ddae6456a5617f932b6f06f86f`
**Alcance:** Auditoría exclusivamente de lectura. Cero cambios de código, estilos, componentes, commits o push. Este documento es el único artefacto generado.
**Método:** (1) lectura completa de `docs/DESIGN.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`, tokens, primitives y páginas reales; (2) greps dirigidos para verificar o refutar cada regla de `DESIGN.md` contra el código real; (3) inspección visual real vía Playwright contra `pnpm dev` (solo rutas públicas, cero mutación, cero dato inventado); (4) cómputo exacto de contraste WCAG sobre los tokens de color reales (no estimación visual); (5) consulta de `habitex-design-review`, `ui-ux-pro-max` y `apple-design` como lentes evaluativas, nunca como fuente de reglas nuevas.

---

## 1. Executive Summary

Habitex tiene un **sistema de diseño real, no ad-hoc**. `docs/DESIGN.md` no es aspiracional: cada regla que describe (tokens únicos, tonos semánticos centralizados, un solo shell, breakpoints fijos, cero glassmorphism fuera del Login) se verificó contra el código y **se cumple**. Esto es inusual para un producto construido en incrementos rápidos y es la conclusión más importante de esta auditoría: **el problema de Habitex no es inconsistencia visual difusa — es un pequeño número de gaps concretos, localizados y corregibles**, más una ausencia estructural de continuidad de workflow.

Los tres hallazgos más importantes, en orden de impacto:

1. **Identidad cero en el objeto central del producto.** `RentalListCard` — la tarjeta que representa cada arriendo — no muestra ni el nombre del inquilino, ni la propiedad, ni el monto de renta. Solo un título genérico derivado del status ("Arriendo activo") y una pila de botones. Un administrador con más de un arriendo no puede distinguirlos sin abrir cada uno.
2. **Dos fallas de contraste objetivas, medidas con precisión**, no estimadas: el texto de los botones primario/destructivo en tema oscuro cae por debajo de WCAG AA (4.5:1), y el borde de todo input/select/textarea tiene ~1.2:1 de contraste contra su superficie en ambos temas — muy por debajo del 3:1 que exige WCAG 1.4.11 para límites de componentes de UI.
3. **Cero continuidad visual de workflow.** Las 4 páginas angostas de un arriendo (Términos, Contratos, Cargos, Pagos) no muestran ningún identificador del arriendo ni un breadcrumb — cada una es una isla alcanzable solo por un botón en la lista y abandonable solo con el botón "atrás" del navegador.

Ningún hallazgo compromete la arquitectura de tokens, la paleta, la tipografía o el principio de marca — esos siguen siendo sólidos y no requieren rediseño. El trabajo recomendado es de **cierre de gaps e integración**, no de "repensar Habitex desde cero".

---

## 2. Current Visual System

Fuente: `docs/DESIGN.md` (339 líneas), verificado línea por línea contra el código.

| Área | Estado real | Evidencia |
|---|---|---|
| Tokens de color | Único archivo, `src/shared/theme/tokens.css`. **Cero** colores hardcodeados fuera de él en todo `src/**/*.css` (grep `#[0-9a-fA-F]{3,8}` → 1 archivo: el propio `tokens.css`). | Grep ejecutado en esta auditoría. |
| Tonos semánticos | `src/shared/theme/tone.module.css`, 6 clases. La única violación histórica documentada (`KpiCard` redeclarando el mapeo) está corregida y **no recurrió** en ningún componente construido después (verificado en `RentalListCard`, `AdministrationPicker`, `RentalContractsPage`, `RentalChargesPage`, `RentalPaymentsPage`, `PropertyCard` — 6 features independientes, 6 usos correctos de `Badge`/`IconBadge`/tone). | Lectura directa + fork de revisión. |
| Tipografía | Escala única en `typography.css`, 8 niveles, cada uno token + clase utilitaria. | `src/shared/theme/typography.css`. |
| Light/Dark/System | Mecanismo único (`theme.ts`/`useTheme.ts`/`ThemeControl.tsx`), inicialización pre-paint vía script inline. | `docs/DESIGN.md` §3, confirmado visualmente (capturas Light/Dark idénticas en estructura, solo tokens cambian). |
| Layout | Un solo `AppShell`, usado tanto por el layout autenticado real como por `/ui-preview`. Breakpoints: **solo** 640px y 1024px en todo el repo (grep `@media` → 16 archivos, cero valor fuera de esos dos). | Grep ejecutado en esta auditoría. |
| Primitives | 14 primitives en `src/shared/ui/`, cada uno con una regla explícita de "cuándo no crear variante local". | `docs/DESIGN.md` §5. |
| Iconografía | Sistema único hand-rolled (`icons.tsx`), 23 íconos, un solo `IconBase` (24×24, `stroke-width 1.75`, `currentColor`), cero mezcla de packs. | Fork de revisión, confirmado. |
| Motion | Tokens únicos (`--transition-fast/base/slow`), una sola excepción documentada (`--transition-hero-crossfade`, Login), `prefers-reduced-motion` resuelto globalmente una sola vez. | `tokens.css` + `global.css`. |
| Marca | `BrandMark`/`BrandLogo` únicos, el "cuadrado alrededor de la marca" que existía antes ya fue eliminado en todas las pantallas. | `docs/DESIGN.md` §11. |

**Veredicto de coherencia: el sistema es coherente, no fragmentado.** Donde hay deuda, está documentada en el propio código con comentarios explícitos ("intentional, not a bug", "Visual only for this iteration") — es deuda consciente, no deriva accidental.

---

## 3. Screen Inventory

Inventario construido desde `src/app/router/router.tsx` (fuente real, no asumida).

| Ruta | Guard | Componente | Notas |
|---|---|---|---|
| `/login` | `RedirectIfAuthenticated` (pública si no hay sesión) | `LoginPage` | Única pantalla con fotografía/glass. |
| `/bootstrap` | `ProtectedRoute` + `RedirectIfAccountExists` | `BootstrapAccountPage` | Requiere sesión, cero Account. |
| `/` (index) | `ProtectedRoute` + `RequiresAccount` | `DashboardPage` | Incluye selección de administración **inline** (`AdministrationPicker`, no es una ruta separada) cuando hay más de una. |
| `/properties` | autenticado | `PropertiesPage` | |
| `/properties/new` | autenticado | `AddPropertyPage` | |
| `/properties/:propertyId/rooms/setup` | autenticado | `RoomSetupPage` | |
| `/rentals` | autenticado | `RentalsPage` | |
| `/rentals/new` | autenticado | `AddRentalPage` | Incluye el flujo de creación de tenant + paso opcional de invitación. |
| `/rentals/:id/terms` | autenticado | `RentalTermsPage` | |
| `/rentals/:id/contracts` | autenticado | `RentalContractsPage` | |
| `/rentals/:id/charges` | autenticado | `RentalChargesPage` | |
| `/rentals/:id/payments` | autenticado | `RentalPaymentsPage` | |
| `/invitations/:token` | **pública**, fuera de `ProtectedRoute`/`RequiresAccount` | `InvitationClaimPage` | Nueva (INC-007). |
| `/ui-preview` | **pública** | `UiPreviewPage` | Herramienta interna, mismo `AppShell`. |
| `*` | pública | `NotFoundPage` | Ver hallazgo P1 — sin estilo alguno. |

**Pantallas que NO son rutas, sino estados dentro de una ruta** (no asumir que faltan — existen, solo no son URLs propias):
- Selección de administración → estado `selection-required` dentro de `DashboardPage` (y cualquier página que use `useActiveAdministration`).
- Trial / Grace / Expired → `SubscriptionStatusBanner`, montado globalmente en `AuthenticatedLayout`, no una pantalla dedicada.
- Loading / Empty / Error → estados locales de cada página (`Skeleton`/`EmptyState`/`Alert`), no rutas.

**Pantallas que NO existen todavía, confirmadas por ausencia real en el router** (no hipótesis): no hay `/rentals/:id` (hub de detalle del arriendo), no hay `/settings`, no hay `/people` (Personas), no hay `/finances` (Finanzas agregadas), no hay `/documents` (Documentos). Esto es consistente con el comentario explícito en `AuthenticatedLayout.tsx` (ver §9).

---

## 4. Screenshot / Visual Evidence

**Capturado realmente** (Playwright headless, contra `pnpm dev` en `localhost:5174`, sin ninguna escritura ni envío de formulario): `/login`, `/ui-preview`, `/invitations/<token-falso>` (estado no autenticado), y una ruta inexistente (404) — cada una en desktop (1440×900), tablet (820×1180) y mobile (390×844); `/login`, `/ui-preview` y `/invitations/...` además en tema Dark a resolución desktop. 20 capturas totales. Las capturas viven solo en el scratchpad de esta sesión (no son parte del repositorio, no se commitean) — este documento describe lo que muestran en vez de incrustar binarios.

**No se pudo capturar visualmente, y por qué (limitación documentada, no inventada):** Dashboard, Properties, Rentals, Terms, Contracts, Charges, Payments, Bootstrap, selección de administración, y los 5 estados de `SubscriptionStatusBanner` requieren una sesión autenticada con una Account y datos reales. `docs/ARCHITECTURE.md` §8 ya documenta esta limitación explícitamente: *"Playwright corre contra credenciales de Supabase no funcionales a propósito (`.env.e2e`)... no existe hoy E2E autenticado real — no hay forma de llegar al Dashboard/AppShell autenticado en un navegador real desde este repo."* Crear una cuenta real de Supabase Auth para sortear esto estaba fuera del mandato explícito de esta fase ("auditoría exclusivamente", "no modifiques Supabase", "documenta la limitación en vez de inventar contenido"). La evaluación de esas pantallas en este documento se basa en **lectura directa de código** (JSX + CSS Modules) — cada hallazgo que depende de esto está marcado explícitamente como "evaluado por código, no renderizado".

**Hallazgos visuales directos (de capturas reales):**

- **Login (`/login`, desktop, Light y Dark):** el screen más pulido del producto. Crossfade día/noche funcionando correctamente, tarjeta de métricas en vidrio oscuro legible en ambos temas, formulario limpio. Confirma `DESIGN.md` §10 al pie de la letra.
- **Login (mobile):** confirma `DESIGN.md` §8 — cero foto por debajo de 640px, barra sólida verde con marca + `ThemeControl`, formulario protagonista. Adaptación deliberada, no un desktop comprimido.
- **`/ui-preview` (desktop, Light y Dark):** el showcase del design system se ve exactamente como `DESIGN.md` lo describe — colores, tipografía, botones, controles de formulario, badges, cards, alerts, empty state, skeleton, y el `AppShell` de ejemplo, todo coherente entre temas.
- **`/invitations/<token>` (no autenticado, desktop):** visualmente coherente con el resto del producto — mismo `Card`, mismo `BrandLogo`, `Tabs` con indicador activo funcionando. La nueva pantalla de INC-007 no introduce ninguna inconsistencia visual.
- **404 (`/this-route-does-not-exist`):** **el hallazgo visual más severo de toda la captura.** Texto plano sin estilo, pegado a la esquina superior izquierda, sin `Card`, sin `BrandLogo`, sin botón de regreso, sin `AppShell`. Ver hallazgo P1 en §16 — la causa es literal: `NotFoundPage.tsx` no importa ningún primitive ni CSS Module.
- Un ícono circular flotante (paleta/palmera) aparece en la esquina inferior derecha de **todas** las capturas. Confirmado como `@tanstack/react-query-devtools`, gateado por `import.meta.env.DEV` (`AppProviders.tsx:14`) — **nunca aparece en producción**. Excluido de todos los hallazgos.

---

## 5. Cross-product Consistency Findings

- **Primitives**: cero reimplementación de `Button`/`Card`/`Badge`/`Alert`/`IconBadge` encontrada en todo el código leído (shared UI + 15+ páginas de feature). Los únicos `<button>` crudos encontrados son formas estructuralmente distintas a lo que `Button` resuelve (tabs ARIA, nav links, radio-cards, tiles icono+label) — no son violaciones.
- **Tonos**: 6+ features construidas de forma independiente (`rentals`, `administration`, `contracts`, `charges`, `payments`, `properties`) mapean su propio enum de dominio a `BadgeTone`/`IconBadgeTone` de forma idéntica — mismo patrón, nunca un color redeclarado a mano.
- **Inconsistencia real encontrada**: `PropertyCard` (Dashboard) calcula y muestra ocupación real por propiedad; `PropertyListCard` (`/properties`) **explícitamente no la muestra** ("no rented/available badge, because occupancy isn't known here", comentario propio del archivo). Son la misma entidad (`Property`) mostrada con información distinta según en qué pantalla la mires — un administrador que revisa ambas pantallas lo notará.
- **`@supabase/supabase-js`**: confirmado exactamente 2 archivos en todo `src/` (`infrastructure/supabase/client.ts` y el adapter legacy de sesión). Frontera de arquitectura intacta, sin relación con este audit pero confirmado como parte de la inspección de "estructura de estilos".

---

## 6. Color & Brand Analysis

**Identidad**: reconocible y deliberada — verde profundo (`#0e6b5c` light / `#17876f` dark) como primary, fondo cálido off-white (`#f7f6f2`) en vez de blanco puro, tipografía sobria sin adornos. No se siente como una plantilla de dashboard genérica ni copia un competidor reconocible. **No hay "demasiados colores"**: la paleta completa son 6 familias (neutral, primary, success, warning, danger, info), cada una con 3 tonos (base/subtle/subtle-foreground) — una paleta pequeña y disciplinada, no inflada.

**Contraste — medido con precisión, no estimado visualmente** (fórmula WCAG relative luminance, sobre los valores hex reales de `tokens.css`):

| Par | Contraste | Umbral WCAG AA | Resultado |
|---|---|---|---|
| Light `success-subtle` bg/fg | 6.31:1 | 4.5:1 (texto normal) | ✅ Pasa |
| Light `warning-subtle` bg/fg | 5.20:1 | 4.5:1 | ✅ Pasa |
| Light `danger-subtle` bg/fg | 6.78:1 | 4.5:1 | ✅ Pasa |
| Light `info-subtle` bg/fg | 7.20:1 | 4.5:1 | ✅ Pasa |
| Dark `success/warning/danger/info-subtle` | 7.22 – 8.82:1 | 4.5:1 | ✅ Pasa, con margen amplio |
| `--color-muted` sobre `--color-background`/`--color-surface` (ambos temas) | 5.71 – 8.94:1 | 4.5:1 | ✅ Pasa |
| **Botón primario, texto, Dark** (`#17876f` bg / `#ffffff` fg) | **4.44:1** | 4.5:1 | ❌ **Falla, por un margen mínimo** |
| **Botón destructivo, texto, Dark** (`#d9463a` bg / `#ffffff` fg) | **4.30:1** | 4.5:1 | ❌ **Falla** |
| **Botón primario, texto, Dark, estado `:hover`** (`#1fa084` bg / `#ffffff` fg) | **3.27:1** | 4.5:1 | ❌ **Falla con margen amplio — y es PEOR que el estado de reposo** |
| Botón primario, texto, Light (reposo y hover) | 6.41 / 8.73:1 | 4.5:1 | ✅ Pasa cómodamente |
| **Borde de Input/Select/Textarea vs. su superficie** (`--color-border` vs `--color-surface`, ambos temas) | **1.24 – 1.30:1** | 3:1 (WCAG 1.4.11, límites de componentes de UI) | ❌ **Falla con margen muy amplio** |

**Por qué esto importa concretamente**: el tema Dark de Habitex (el que `ThemeControl` ofrece como opción de primer nivel, no un modo secundario) tiene **tres estados de botón real que no cumplen el estándar de contraste que el propio producto necesita para ser confiable** (es un producto financiero — "Confiable" es el primer principio de `DESIGN.md` §1). Y **todo campo de formulario en todo el producto** (que incluye los flujos financieros de reportar pagos, crear arriendos, generar invitaciones) tiene un borde que, medido, es casi invisible contra su propia tarjeta — sin sombra ni cambio de fondo que lo compense, a diferencia de `Card` (que sí se apoya en `box-shadow` para separarse de la página, una técnica válida que los inputs no usan).

No se encontró ningún otro color hardcodeado, gradiente decorativo, neón o glassmorphism fuera del Login — el resto de §13 de `DESIGN.md` ("Prohibiciones visuales") se cumple sin excepción.

---

## 7. Typography

Escala de 8 niveles, coherente, usada correctamente en todo lo leído: `display` solo en el hero del Login (confirmado — cero otro uso), `h1` para el valor protagonista de una KPI card, `h2` para títulos de página, `h3` para títulos de sección. `.tabular-nums` aplicado consistentemente a cifras financieras (`KpiCard`, `FinancialOverview`, montos en `PaymentCard`/`ChargeCard`).

**Sin hallazgos de inconsistencia.** El único comentario consultivo (Apple Design, §15, "tracking debe ser size-specific") no aplica como corrección — `tokens.css` ya define `--letter-spacing-display`/`--letter-spacing-h1` por separado del body, que es exactamente lo que esa guía pide; no hay un valor fijo de tracking aplicado a todos los tamaños.

---

## 8. Layout & Spacing

Escala de espaciado de 4px (`--space-1` a `--space-10`), usada de forma consistente — no se encontró un solo valor de padding/margin/gap hardcodeado en píxeles fuera de la escala en los ~35 archivos CSS leídos en esta auditoría (las únicas excepciones son `max-width` de contenido, p.ej. `880px`/`480px` en páginas de feature — un ancho de lectura, no un spacing, y no está prohibido por `DESIGN.md`).

**Grids responsivos**: la mayoría usa `repeat(auto-fit/auto-fill, minmax(Npx, 1fr))` — responsive por construcción, sin necesitar un breakpoint explícito. Esto explica por qué muchas páginas de feature (`RentalsPage`, `PropertiesPage`, `RentalContractsPage`) no tienen ningún `@media` propio: no es negligencia, es una estrategia intrínsecamente responsiva, y es sólida.

**Único hallazgo real de layout**: las páginas de lista de tipo "card financiera densa" (`RentalPaymentsPage`) no usan grid ni tabla — usan `flex-direction: column` + `flex-wrap: wrap` en sub-secciones. Funciona para evitar overflow horizontal, pero combinado con la ausencia total de sub-headers dentro del card (§10/§16), la página se vuelve un bloque de texto largo sin anclas visuales internas.

---

## 9. Components

Inventario de 14 primitives en `src/shared/ui/` + `HabitexBootScreen`. Todos usan tokens, ninguno hardcodea color/shadow/radius. `Tabs` implementa roving tabindex completo (confirmado en `InvitationClaimPage`, que lo consume). `IconButton` exige `aria-label` a nivel de tipos — no compila sin él.

**Hallazgo de navegación (el más consecuente de esta sección)**: `AppShellNavItem.to` es **opcional por diseño** (`AppShell.tsx:15-17`, comentario propio: *"Omit to keep it inert (planned section, no screen yet) - same visual treatment either way"*). `AuthenticatedLayout.tsx:21-38` usa esto para 4 de los 7 ítems de navegación reales del producto:

```ts
// AuthenticatedLayout.tsx
/**
 * "Inicio", "Arriendos" and "Inmuebles" are real routes; the rest are
 * planned sections shown for navigation context, matching the approved
 * Design System shell. They don't navigate anywhere yet - that's
 * intentional, not a bug.
 */
const NAV_KEYS = [
  { key: 'home', ..., to: '/' },
  { key: 'rentals', ..., to: '/rentals' },
  { key: 'properties', ..., to: '/properties' },
  { key: 'people' },      // sin `to` — no navega
  { key: 'finances' },    // sin `to` — no navega
  { key: 'documents' },   // sin `to` — no navega
  { key: 'settings' },    // sin `to` — no navega
]
```

El propio `AppShell.tsx` confirma "same visual treatment either way" — un ítem sin `to` se renderiza como `<button>` en vez de `<Link>`, pero con **la misma clase CSS, el mismo ícono, el mismo label** que uno real. Un usuario no tiene ninguna señal visual de que "Personas"/"Finanzas"/"Documentos"/"Configuración" no hacen nada. Además, `'finances'` está en `BOTTOM_NAV_KEYS` — en mobile, uno de los 4 ítems del bottom nav (25% de la navegación principal en ese breakpoint) es inerte.

Esto es una decisión ya tomada y documentada ("intentional, not a bug") — no es un bug de implementación. Pero desde el punto de vista de UX es un hallazgo real: contradice `ui-ux-pro-max`'s propia regla citada en este mismo audit (`empty-nav-state`: *"When a nav destination is unavailable, explain why instead of silently hiding it"*) y el principio de *Wayfinding* de Apple Design ("¿A dónde puedo ir?" debe tener una respuesta honesta). Ver P1 en §16.

---

## 10. Dashboard Deep Dive

Evaluado por código (no renderizable sin sesión real — ver §4), pero el código fue leído en su totalidad (`DashboardPage.tsx`, `FinancialOverview.tsx`, `AttentionPanel.tsx`, `PropertiesOverview.tsx`, `QuickActions.tsx`, `DashboardHeader.tsx`, `KpiCard.tsx`, `usePropertyOccupancy.ts`).

**Veredicto explícito pedido por el brief: ¿centro de control o pila de cards?** → **Pila de cards, no centro de control**, con evidencia concreta:

- **KPIs sin drill-through**: "Cartera" (monto pendiente del mes) no lleva a ningún lado al hacer click/tap — es un número aislado. No hay forma de ir del KPI a los cargos/pagos que lo componen.
- **`AttentionPanel` con una acción muerta**: cada fila de pago `REPORTED` tiene un botón "Ver" (`AttentionPanel.tsx:52`) **sin `onClick` en absoluto** — ni siquiera navega a `/rentals/:id/payments`, a pesar de que el dato que lo generó (`payment.id`, `rental_relationship_id` indirectamente) existiría para construir ese link. Es el ejemplo más claro de "parece interactivo, no hace nada".
- **`QuickActions` con fallback genérico conocido**: 2 de 4 tiles (`registerPayment`/`uploadDocument`) navegan a `/rentals` en general, no a un arriendo específico — decisión humana ya documentada (Dashboard no tiene `relationshipId`), pero sigue siendo una discontinuidad de flujo real.
- **`FinancialOverview` es honesto pero delgado**: una sola serie (ingreso), un solo total, sin anotación de tendencia por barra — funcionalmente correcto (no fabrica "gastos" que no existen en el backend) pero visualmente es el componente menos desarrollado de los cinco.
- **`PropertiesOverview` es la excepción — la pieza de mayor calidad del Dashboard**: carrusel con scroll medido (no hardcodeado), respeta `prefers-reduced-motion`, cross-referencing de ocupación real con un estado `'unknown'` honesto mientras carga (nunca una suposición).

**Conclusión de la sección**: el Dashboard no necesita un rediseño visual — cada pieza individual ya es sólida y usa el design system correctamente. Necesita **cableado**: convertir los KPIs y filas de atención en puntos de entrada reales a su detalle correspondiente. Este es el gap de mayor apalancamiento de todo el audit (bajo esfuerzo de implementación, alto impacto de percepción — "se siente como un panel de control real" vs. "cinco widgets").

---

## 11. Workflow UX

Se recorrieron los 4 journeys pedidos, por código (ver §4 para la limitación de renderizado):

- **Property → Rental → Terms → Activation**: la progresión de datos es correcta y está bien gateada (términos deben existir antes de poder activar, verificado en incrementos previos). La progresión **visual** es: lista de arriendos → botón → página aislada de términos → guardar → de vuelta a la lista. Ningún breadcrumb, ningún indicador de "paso 2 de 3".
- **Rental → Contract**: mismo patrón — botón en la lista → `/rentals/:id/contracts`, página sin ningún identificador del arriendo salvo el `<h1>` genérico (`t('title')`, el mismo string para cualquier arriendo).
- **Rental → Charges → Payment → Allocation → Receipt**: el journey más largo y el más crítico financieramente. Las 4 etapas viven en 2 rutas (`/charges`, `/payments`, con allocation/receipt anidados dentro de `/payments`) — correcto a nivel de dato, pero `RentalPaymentsPage`'s `PaymentCard` comprime status + monto + fecha + método + referencia + notas + comprobante + allocation + receipt + acciones de confirmar/rechazar **en un solo bloque de texto plano sin sub-headers** (`RentalPaymentsPage.tsx`, confirmado por el fork de revisión línea por línea). Es la pantalla más densa de información y la que menos estructura visual tiene para esa densidad.
- **Rental Draft → Tenant Invitation → Claim**: el **único journey con continuidad visual real** en todo el producto. `AddRentalDraftForm` mantiene al administrador en la misma página a través de creación-de-borrador → invitación-opcional → "Ir a arriendos", sin navegación intermedia perdida. Esto demuestra que el equipo ya sabe construir continuidad cuando el incremento lo pide explícitamente — el gap en los otros 3 journeys es de alcance no abordado, no de capacidad.

**Patrón repetido en los 4 journeys (salvo el último)**: "lista → click → página aislada → atrás del navegador." Ninguna página de arriendo (`terms`/`contracts`/`charges`/`payments`) muestra qué arriendo es, de qué propiedad, de qué inquilino — porque esa información tampoco existe en `RentalListCard` de origen (§12/§16).

---

## 12. States & Feedback

- **Loading**: `Skeleton` usado consistentemente — cero markup de carga ad hoc encontrado en las ~15 páginas leídas.
- **Empty**: `EmptyState` usado consistentemente (confirmado en `/ui-preview`'s propia sección + en el código de features).
- **Error**: `Alert tone="danger"` usado consistentemente para errores de query/mutación.
- **Disabled**: `Button`'s prop `disabled`/`loading` usada correctamente en todos los botones de mutación revisados (incl. los de dos pasos: `LifecycleConfirmAction`, `TerminateContractAction`, `RejectPaymentAction` — los 3 mueven foco al botón de confirmación vía el mismo patrón `ref`+`useEffect`, confirmado idéntico en 3 features independientes).
- **Success**: sin un patrón de "toast"/confirmación transitoria global — el éxito se comunica por el efecto resultante (ej. el estado cambia, el recibo aparece) más que por un mensaje explícito de "guardado correctamente". No es necesariamente un defecto (evita el anti-patrón de notificaciones ruidosas), pero es una decisión de producto que vale la pena hacer explícita (ver §20).
- **Trial / Grace / Expired** (evaluado por código, `SubscriptionStatusBanner.tsx`): 5 estados (`trial`→info, `grace`/`pastDue`→warning, `expired`/`canceled`→danger), cada uno un `Alert` tono-apropiado, nunca bloqueante (retorna `null` mientras no resuelto/erróneo/ACTIVE — por diseño, nunca un gate de seguridad). El CTA "Ver planes" está permanentemente deshabilitado — deuda ya reconocida en el propio código, no un hallazgo nuevo.
- **DRAFT/ACTIVE/ENDING/ENDED** (Rentals): mapeo de tono coherente y bien razonado (`DRAFT`→neutral, `ACTIVE`→success, `ENDING`→warning, `ENDED`→neutral, `CANCELLED`→danger), con comentario explícito justificando cada elección semántica. Ningún estado se comunica solo por color — siempre acompañado de texto vía `Badge`.

---

## 13. Responsive

- **Breakpoints**: únicos, consistentes, 640px/1024px — cero breakpoint ad hoc en todo el repo (grep exhaustivo, §2/§8).
- **Mobile real, no desktop comprimido**: confirmado visualmente en Login (foto desaparece, barra sólida) y en `AppShell` (drawer + bottom nav en vez de sidebar, con `inert` correcto cuando el drawer está cerrado).
- **Grids auto-fit/auto-fill**: responsive por construcción en Properties/Rentals/Contracts — no requieren mantenimiento de breakpoint manual.
- **Sin horizontal scroll encontrado**: ninguna página leída usa `overflow-x`/`white-space: nowrap` de forma que fuerce scroll horizontal.
- **Gap no verificable sin dato real**: `RentalPaymentsPage`'s card densa (§10/§16) no se pudo probar en mobile real (requiere sesión) — el patrón `flex-wrap: wrap` en el código sugiere que no debería romperse, pero con tantos sub-bloques (allocation + receipt + acciones) en una sola card, **se recomienda una verificación visual real en mobile antes de dar esto por cerrado** (ver §20, decisión pendiente).

---

## 14. Accessibility

Resumen de lo ya cuantificado en §6, más lo verificado adicionalmente:

- ❌ **Contraste de texto de botón, Dark theme**: primario 4.44:1, destructivo 4.30:1, primario en `:hover` 3.27:1 — los 3 por debajo de 4.5:1 (AA, texto normal). El caso de `:hover` es el más severo porque el contraste **empeora** con la interacción, no mejora.
- ❌ **Contraste de borde de campo de formulario (WCAG 1.4.11)**: ~1.2–1.3:1 contra la superficie en ambos temas, muy por debajo de 3:1. Afecta a `Input`/`Select`/`Textarea` — es decir, **todo formulario del producto**, incluidos los financieros (reportar pago, crear arriendo, generar invitación).
- ✅ **Resto de pares de color semántico** (tonos subtle, texto muted, botón primario en Light): todos pasan AA con margen amplio (5.2:1 a 8.9:1) — medido, no asumido.
- ✅ **`aria-label` en botones solo-ícono**: exigido a nivel de tipos por `IconButton`, confirmado presente en todos los usos leídos.
- ✅ **Focus management en confirmaciones de dos pasos**: idéntico y correcto en las 3 implementaciones independientes revisadas.
- ✅ **Cero indicador de estado solo-color**: cada `Badge`/`Alert` encontrado siempre empareja color con texto.
- ✅ **`inert` en drawer móvil**: correcto (no solo oculto visualmente).
- ❌ **`NotFoundPage`**: sin `role`/landmark alguno más allá de un `<main>` desnudo sin ningún otro primitive — no es un error de accesibilidad técnico per se, pero es la pantalla con menor cuidado estructural de todo el producto.
- **No verificado por esta auditoría** (fuera de alcance de una revisión de código + capturas estáticas): navegación por teclado de extremo a extremo en flujos autenticados reales, comportamiento con lector de pantalla real, `prefers-contrast: more`. Recomendado como seguimiento con herramienta automatizada (axe-core) — ver §20.

---

## 15. Design System Gaps

| Elemento pedido por el brief | Estado |
|---|---|
| Semantic color tokens | ✅ Completo y disciplinado — sin gap. |
| Typography scale | ✅ Completo — sin gap. |
| Spacing scale | ✅ Completo, 4px, sin excepciones encontradas. |
| Border radius | ✅ 4 tokens (`sm/md/lg/full`), usados consistentemente. |
| Elevation/shadows | ✅ 3 tokens (`sm/md/lg`), recalibrados por tema — sin valor ad hoc encontrado. |
| Surface hierarchy | ✅ `background`/`surface`/`surface-hover` consistentes — **pero ver el hallazgo de contraste surface-vs-background (~1.08–1.10:1) en §6**: la separación entre página y card depende *enteramente* de `box-shadow`, no de color. Funciona (la sombra es perceptible), pero es un punto único de falla si algún componente futuro omite la sombra. |
| Border hierarchy | ⚠️ Un solo `--color-border`, sin variante "fuerte"/"sutil" — suficiente hoy, pero es la causa directa del gap de contraste en inputs (§6/§14): no existe un token de borde con más contraste para usar en componentes interactivos. |
| Button hierarchy | ⚠️ 4 variantes (`primary/secondary/ghost/destructive`) bien definidas a nivel de componente, pero **sin una convención de cuántas secondary pueden coexistir en una misma tarjeta** — de ahí el hallazgo de `RentalListCard` con 4 botones secondary del mismo peso (§9/§16). |
| Status colors | ✅ Completo, 4 tonos semánticos + neutral/primary, usados consistentemente. |
| Icon rules | ✅ Completo — un sistema, cero mezcla. |
| Content width | ✅ `--container-max-width` + anchos locales por página (`880px`/`480px`) — consistente dentro de cada contexto. |
| Page spacing | ✅ Escala de 4px aplicada uniformemente. |
| Responsive behavior | ✅ Grids auto-fit + 2 breakpoints fijos — sin gap de mecanismo, aunque sin verificación visual real de la card más densa (`RentalPaymentsPage`) en mobile. |
| **Gap no listado por el brief pero encontrado**: patrón de "contexto de entidad persistente" | ❌ **No existe.** No hay ningún componente/convención para mostrar "estás viendo el arriendo de [Tenant] en [Property]" de forma consistente entre páginas relacionadas. Este es el gap estructural detrás de §11/§16. |
| **Gap no listado por el brief pero encontrado**: convención de "nav item sin destino" | ⚠️ Existe la capacidad (`to?` opcional) pero sin ningún tratamiento visual distinto (opacidad reducida, badge "Próximamente", tooltip) — se ve igual que un ítem real. |

---

## 16. P0 / P1 / P2 / P3 Findings

### P0 — comprensión, uso o accesibilidad

1. **`RentalListCard` no muestra identidad del arriendo.** *Pantalla*: `/rentals`. *Componente*: `RentalListCard.tsx`. *Problema*: título genérico derivado del status (`t('list.title.${rental.status}')`, ej. "Arriendo activo"), sin nombre de inquilino, propiedad/unidad ni monto de renta. *Por qué*: el propio código lo admite — *"No tenant/subject/rent amount yet - this increment only reads rental_relationships itself"*. *Impacto*: con 2+ arriendos activos, el administrador no puede distinguirlos sin abrir cada uno — bloquea la tarea más básica del producto a cualquier escala real.
2. **Contraste de borde de campo de formulario, WCAG 1.4.11.** *Componentes*: `Input`/`Select`/`Textarea` (`Field.module.css`/`Input.module.css`). *Medido*: 1.24–1.30:1 contra `--color-surface`, en Light y Dark. *Umbral*: 3:1. *Impacto*: afecta a **todo formulario del producto**, incluidos los financieros (reportar pago, crear arriendo draft, invitación de inquilino, login, signup). Sin sombra ni diferencia de fondo compensatoria (a diferencia de `Card`).
3. **Contraste de texto del botón primario en `:hover`, Dark theme.** *Medido*: 3.27:1 (peor que el estado de reposo, 4.44:1). *Umbral*: 4.5:1. *Impacto*: el botón más usado del producto (acción primaria) se vuelve menos legible exactamente cuando el usuario interactúa con él, en el tema que `ThemeControl` ofrece como opción de primer nivel.

### P1 — consistencia, jerarquía o percepción de calidad

4. **Nav items que no navegan, sin ninguna señal visual de que no lo hacen.** `AuthenticatedLayout.tsx`: "Personas"/"Finanzas"/"Documentos"/"Configuración" se renderizan con el mismo estilo que "Inicio"/"Arriendos"/"Inmuebles" pero no tienen `to`. "Finanzas" además vive en el bottom nav móvil (25% de esa navegación). Documentado como intencional en el código — igual es un hallazgo de UX real, no solo de implementación.
5. **Contraste de texto del botón primario/destructivo en reposo, Dark theme.** 4.44:1 / 4.30:1 — fallan AA por un margen pequeño pero real.
6. **Cero breadcrumb/identificador de arriendo en `RentalTermsPage`/`RentalContractsPage`/`RentalChargesPage`/`RentalPaymentsPage`.** Cada una muestra un `<h1>` genérico (mismo string sin importar qué arriendo). Combinado con el hallazgo #1, un usuario que llega a cualquiera de estas 4 páginas no tiene ninguna confirmación en pantalla de cuál arriendo está viendo.
7. **Jerarquía de botones plana en `RentalListCard`.** Hasta 4 botones `variant="secondary" size="sm"` idénticos ("Completar términos"/"Contratos"/"Cargos"/"Pagos") sin ninguna distinción de cuál es la siguiente acción más probable.
8. **`NotFoundPage.tsx` completamente sin estilo.** `<main><h1>{t(...)}</h1><p>{t(...)}</p></main>` — cero `Card`/`Button`/`BrandLogo`/`AppShell`, cero CSS Module. La pantalla con menor calidad percibida de todo el producto, por un margen muy amplio frente a cualquier otra.
9. **`PropertyCard` (Dashboard) y `PropertyListCard` (`/properties`) muestran información distinta para la misma `Property`.** El Dashboard calcula ocupación; `/properties` explícitamente no la muestra (comentario propio del archivo). Inconsistencia real entre dos vistas de la misma entidad.
10. **`AttentionPanel`'s botón "Ver" no tiene `onClick`.** Dead-end funcional — focuseable, con label, pero no hace nada.
11. **Dashboard funciona como una pila de 5 widgets independientes, no como un centro de control.** Ningún KPI ni fila de atención lleva a su detalle subyacente (ver §10 para el detalle completo).

### P2 — polish visual

12. **`PaymentCard` (`RentalPaymentsPage`) extremadamente denso sin estructura interna.** Status + monto + fecha + método + referencia + notas + comprobante + allocation + receipt + acciones, todo como líneas `<p>` planas en un solo `Card`, sin sub-headers ni dividers.
13. **Panel del Login en desktop deja mucho espacio en blanco** alrededor de una tarjeta de formulario relativamente pequeña — posiblemente intencional (restraint, per `DESIGN.md` §1), pero vale una revisión deliberada.
14. **CTA "Ver planes" de `SubscriptionStatusBanner` permanentemente deshabilitado** — deuda ya reconocida en el código.
15. **Selector de "período" en `DashboardHeader` es visual-only** — comentado explícitamente como tal en el propio archivo.
16. **5 usos de `style={{ ...: 'var(--space-X)' }}` inline** en vez de una clase CSS Module (`QuickActions.tsx` + 4 archivos de `/ui-preview`) — cero impacto visual, inconsistencia de higiene de código menor frente a la convención del propio proyecto.

### P3 — mejoras opcionales

17. **Naming de tono de `KpiCard`**: su tono `'neutral'` se mapea visualmente al tono `'primary'` de `IconBadge` — reconocido en el propio comentario del archivo, sin bug visual, solo nombres que podrían confundir a futuro.
18. **`FinancialOverview` de una sola serie**: honesto (no fabrica "gastos"), pero visualmente el componente menos desarrollado del Dashboard — candidato a enriquecerse cuando exista una segunda métrica real.
19. **Sistema de íconos**: sin hallazgos — mencionado aquí solo para reconocer que es una fortaleza consistente, no un gap.
20. **Sin testing de accesibilidad automatizado (axe-core o similar) en CI.** Los 2 hallazgos P0 de contraste de esta auditoría se encontraron por cómputo manual de tokens, no por una herramienta — una suite automatizada los habría detectado en el primer PR que los introdujo.

---

## 17. Visual Direction A — "Ledger Confidence" (cerrar gaps, no rediseñar)

**Personalidad**: la misma que hoy, pero sin los agujeros. Seriedad financiera tranquila, "tu operación de un vistazo" — sin ambición de cambio de lenguaje visual.

- **Color**: sin cambios — la paleta actual se queda igual. Solo se corrigen los 3 pares de contraste fallidos (ajuste quirúrgico de 2-3 valores hex en Dark theme, más un nuevo token de borde "fuerte" para campos interactivos).
- **Superficies**: sin cambios de token; se introduce un patrón de "fila de identidad" obligatorio (nombre + status) para toda tarjeta que represente una entidad del negocio (arriendo, propiedad).
- **Cards**: `RentalListCard`/lista de arriendos ganan tenant/propiedad/monto; `PaymentCard` gana sub-headers internos (sin nuevo primitive — un simple `<h4>`/divider ya resuelve esto con lo existente).
- **Tipografía**: sin cambios.
- **Densidad**: se rebalancea (más identidad, misma cantidad de acciones pero con jerarquía de botón clara: 1 primary, resto ghost/secondary agrupados bajo un "más acciones" si son más de 2).
- **Navegación**: se agrega un componente pequeño y reutilizable de "contexto de arriendo" (nombre + propiedad + status) en el header de las 4 páginas angostas; los 4 nav items inertes ganan un tratamiento visual distinto (opacidad reducida + tooltip "Próximamente") en vez de verse idénticos a los reales.
- **Dashboard**: AttentionPanel y KPIs ganan navegación real a su detalle.
- **Ventajas**: menor riesgo, más rápido de entregar, resuelve directamente los P0/P1 de este audit, no requiere aprobar un lenguaje visual nuevo.
- **Riesgos**: no eleva la "sensación premium" más allá de lo que ya existe — si la ambición real es un salto visual (no solo cerrar gaps), esta dirección se queda corta.

---

## 18. Visual Direction B — "Operator Console" (densificar para uso profesional diario)

**Personalidad**: herramienta de back-office seria, construida para un administrador que gestiona muchas unidades a diario — más cerca de un software de operaciones vertical que de un dashboard ligero.

- **Color**: misma paleta, usada de forma más contenida (el color queda reservado casi exclusivamente para status), más área neutra para escaneo rápido.
- **Superficies**: menos "card por ítem", más listas/tablas estructuradas para Rentals/Charges/Payments.
- **Cards**: reservadas para contexto de resumen/KPI; las listas operativas pasan a filas compactas u tabla con columnas.
- **Tipografía**: misma escala, con una excepción documentada de line-height más ajustado en contextos de lista densa (igual que ya existe la excepción del Login — mismo principio de excepción justificada).
- **Densidad**: alta, deliberada — el extremo "hoja de cálculo controlada" que `DESIGN.md` §1 ya menciona como aceptable en el contexto correcto.
- **Navegación**: layout maestro-detalle persistente (lista + panel de detalle del arriendo activo) reemplaza el patrón actual de "ruta completa por acción" — resuelve estructuralmente el gap de "¿cuál arriendo es?" en vez de solo agregar una etiqueta.
- **Dashboard**: más denso, más KPIs por fila, cards más pequeñas, más escaneable.
- **Ventajas**: el mejor ajuste para un usuario con 20+ unidades gestionando el producto a diario; resuelve de raíz (no con un parche) tanto la identidad como la continuidad de workflow.
- **Riesgos**: el mayor esfuerzo de implementación de las tres direcciones (nuevo primitive de layout, posible comportamiento de breakpoint nuevo); riesgo real de sentirse "más frío"/"más ocupado" si no se ejecuta con el mismo restraint ya demostrado; el patrón maestro-detalle no traduce directo a mobile y necesita su propia solución ahí.

---

## 19. Optional Visual Direction C — "Narrative Timeline" (lifecycle-first)

**Personalidad**: la más "diseñada" de las tres — prioriza contar la historia de un arriendo (progreso/completitud) sobre mostrar datos crudos.

- **Color**: misma paleta, usada para marcar hitos del timeline (success = paso completado, warning = requiere atención).
- **Superficies**: un hub único y scrolleable por arriendo, con cards segmentadas por etapa, en vez de rutas separadas por concepto.
- **Cards**: se convierten en "segmentos de timeline".
- **Tipografía**: sin cambios.
- **Densidad**: media — un timeline naturalmente espacía la información en vez de comprimirla.
- **Navegación**: el cambio más grande de arquitectura de las tres — consolidar `/rentals/:id/{terms,contracts,charges,payments}` en una sola ruta `/rentals/:id` con secciones/tabs. Afecta `router.tsx` y el deep-linking de cada sección individual.
- **Dashboard**: los ítems de `AttentionPanel` enlazarían directo al punto exacto del timeline, no solo a la página general.
- **Ventajas**: la respuesta más cohesiva al hallazgo más repetido de todo este audit (continuidad de workflow); el producto se sentiría considerado y guiado de punta a punta.
- **Riesgos**: el alcance más grande — es un cambio real de IA/routing, no solo visual; mayor riesgo de re-litigar features ya construidas, probadas y pusheadas (INC-006/009/011/012/013/014/015 asumen rutas independientes).

---

## 20. Recommended Decisions Needed From Human

1. **¿Arreglar primero los 3 hallazgos P0 de forma aislada (quirúrgica, sin esperar a elegir una Dirección Visual)?** Son cambios pequeños, localizados, sin riesgo de arquitectura (2-3 valores de color en Dark theme + un nuevo token de borde) — se puede decidir y ejecutar independientemente de cuál Dirección se elija después. *Recomendación: sí, independiente de lo demás.*
2. **¿Qué Dirección Visual perseguir — A, B, C, o ninguna (quedarse en el sistema actual y solo cerrar los P0/P1 puntuales)?** Esta es la decisión de mayor impacto de todo el documento — determina si el esfuerzo siguiente es "cerrar gaps" (semanas) o "rediseñar navegación/IA" (Dirección B o C, con alcance de varios incrementos).
3. **¿Se agregan tenant/propiedad/monto a `RentalListCard` ahora, como su propio incremento, independientemente de qué Dirección se elija?** El dato ya existe en el backend (los incrementos de `rentals`/`properties` ya lo persisten) — esto es una decisión de alcance de producto, no una exploración de diseño.
4. **¿Qué hacer con los 4 nav items inertes?** Opciones concretas: (a) ocultarlos hasta que la pantalla exista, (b) darles un tratamiento visual distinto ("Próximamente"), o (c) priorizar construir una de esas 4 secciones pronto. Mantenerlos como están, idénticos a los reales, es la única opción que esta auditoría no recomienda.
5. **¿Se invierte en un patrón de "contexto de arriendo persistente"** (breadcrumb simple en Dirección A, o panel maestro-detalle en Dirección B, o timeline en Dirección C)? Este patrón es necesario bajo **cualquiera** de las 3 direcciones — es la pieza de infraestructura de UI que vale la pena decidir primero, sin importar cuál dirección se elija después.
6. **¿Confirmar visualmente `RentalPaymentsPage` en mobile real** (requiere una sesión autenticada que esta auditoría no pudo crear) antes de dar su responsive por cerrado?
7. **¿Agregar axe-core (u otra herramienta automatizada de accesibilidad) al pipeline de CI?** Los 2 hallazgos de contraste más serios de este audit no habrían requerido una auditoría manual de diseño para detectarse si hubiera existido esta verificación automatizada desde el principio.

---

**Fin del documento. Sin cambios de código, commits ni push realizados durante esta auditoría.**
