/**
 * Prototype-only fixtures for the Dashboard de Inicio redesign exploration
 * (src/app/pages/ui-preview/dashboard-redesign). Purely visual mock values -
 * never real production data, never wired into domain types, stores,
 * repositories or APIs. Kept in a different city (Medellín/Envigado) than
 * DashboardVisualPreview's own fixtures (Bogotá, see ../mock-data.ts and
 * ../DashboardVisualPreview.tsx) so the two previews are never confused for
 * the same dataset.
 *
 * The same fictitious owner (Camila) is reused across States A and B so the
 * three states read as one coherent "new owner adopting Habitex" story
 * rather than three unrelated people.
 */

export const REDESIGN_OWNER_NAME = 'Camila'

export type RedesignRentalMode = 'FULL_PROPERTY' | 'BY_ROOMS'
export type RedesignPropertyType = 'HOUSE' | 'APARTMENT'

export interface RedesignProperty {
  id: string
  name: string
  city: string
  address: string
  propertyType: RedesignPropertyType
  rentalMode: RedesignRentalMode
}

/** Used only by Estado B (owner already has properties, no rentals yet). */
export const REDESIGN_PROPERTIES: RedesignProperty[] = [
  {
    id: 'redesign-property-1',
    name: 'Apartamento Laureles 204',
    city: 'Medellín',
    address: 'Calle 33 # 76-21',
    propertyType: 'APARTMENT',
    rentalMode: 'FULL_PROPERTY',
  },
  {
    id: 'redesign-property-2',
    name: 'Casa Envigado 18',
    city: 'Envigado',
    address: 'Carrera 42 # 28-10',
    propertyType: 'HOUSE',
    rentalMode: 'BY_ROOMS',
  },
]

/** Parking is a separate domain entity from Property (see
 * features/parking/domain) - kept as a plain count here rather than a fake
 * Parking record, since Estado B only needs to mention it in the portfolio
 * summary line, not render a parking-shaped card. */
export const REDESIGN_PARKING_COUNT: number = 1

// ---------------------------------------------------------------------------
// Estado C fixtures (propietario con arriendos activos / "dashboard
// completo"). Camila's story continues here: she now has active rentals on
// both properties above. Every shape below mirrors a real concept already
// confirmed in features/dashboard|charges|payments|rentals - never a
// fabricated business metric - but values are 100% invented for this
// visual-only prototype.
// ---------------------------------------------------------------------------

/**
 * Mirrors useDashboardFinancials' own KPI trio: `collectedAmount` ~=
 * monthlyIncome (sum of `paidAmount` for this month's chargeType==='RENT'
 * charges, CONFIRMED-only via charge_balances), `pendingAmount` ~= the
 * balance of this month's RENT charges still in financialStatus 'PENDING'/
 * 'PARTIAL', and `overdueAmount` ~= the balance of RENT charges in
 * financialStatus 'OVERDUE' (never derived from dates on this frontend - the
 * real hook always reads status from charge_balances, never infers it).
 * `collectedAmount` intentionally equals REDESIGN_INCOME_SERIES's last
 * (November) point, so the KPI and the chart tell the same story.
 */
export interface RedesignFinancialSummary {
  collectedAmount: number
  pendingAmount: number
  overdueAmount: number
}

export const REDESIGN_FINANCIAL_SUMMARY: RedesignFinancialSummary = {
  collectedAmount: 3_200_000,
  pendingAmount: 450_000,
  overdueAmount: 280_000,
}

/**
 * Mirrors useDashboardOccupancy's own occupied/total "rentable units" count
 * (1 unit per FULL_PROPERTY property, 1 per enabled Room of a BY_ROOMS
 * property, 1 per Parking) - kept as a flat fixture rather than derived from
 * REDESIGN_PROPERTIES/REDESIGN_PARKING_COUNT, since this prototype doesn't
 * model rental_subjects/rooms. Story: Apto Laureles 204 (1 unit, occupied) +
 * 3 enabled rooms in Casa Envigado 18 (2 occupied, 1 vacant) + 1 parking
 * (occupied) = 5 units, 4 occupied.
 */
export interface RedesignOccupancy {
  occupiedUnits: number
  totalUnits: number
}

export const REDESIGN_OCCUPANCY: RedesignOccupancy = {
  occupiedUnits: 4,
  totalUnits: 5,
}

/**
 * Mirrors the two real "needs attention now" sources the actual
 * AttentionPanel renders (a reported Payment awaiting confirmation -
 * PaymentStatus 'REPORTED' - and a Charge in financialStatus 'OVERDUE'),
 * plus one case the real Dashboard doesn't surface today but that the task
 * asked for: a RentalRelationship approaching its `expectedEndDate` while
 * still ACTIVE/ENDING. All three are "something already happened or needs a
 * decision now" - never a future scheduled item (see
 * RedesignUpcomingObligation for that).
 */
export type RedesignAttentionKind = 'reportedPayment' | 'overdueCharge' | 'endingContract'

export interface RedesignAttentionItem {
  id: string
  kind: RedesignAttentionKind
  title: string
  subtitle: string
  amountLabel: string
}

export const REDESIGN_ATTENTION_ITEMS: RedesignAttentionItem[] = [
  {
    id: 'redesign-attention-1',
    kind: 'reportedPayment',
    title: 'Pago reportado por confirmar',
    subtitle: 'Apartamento Laureles 204 · reportado hace 2 días',
    amountLabel: '$1.200.000',
  },
  {
    id: 'redesign-attention-2',
    kind: 'overdueCharge',
    title: 'Cargo de arriendo vencido',
    subtitle: 'Casa Envigado 18, Habitación 2 · vencido hace 5 días',
    amountLabel: '$280.000',
  },
  {
    id: 'redesign-attention-3',
    kind: 'endingContract',
    title: 'Contrato por vencer',
    subtitle: 'Apartamento Laureles 204 · vence en 12 días',
    amountLabel: 'Fin: 5 dic 2026',
  },
]

/**
 * Mirrors a future `charges` row (chargeType 'RENT' or 'ADMINISTRATION')
 * that hasn't come due yet - a scheduled obligation, not something already
 * late or awaiting action. Deliberately a separate fixture/section from
 * REDESIGN_ATTENTION_ITEMS so "ya pasó / necesita acción ahora" and "va a
 * pasar" are never visually merged.
 */
export interface RedesignUpcomingObligation {
  id: string
  dueDate: string
  description: string
  amount: number
}

export const REDESIGN_UPCOMING_OBLIGATIONS: RedesignUpcomingObligation[] = [
  {
    id: 'redesign-upcoming-1',
    dueDate: '2026-12-01',
    description: 'Cargo de arriendo · Casa Envigado 18, Habitación 1',
    amount: 900_000,
  },
  {
    id: 'redesign-upcoming-2',
    dueDate: '2026-12-05',
    description: 'Cargo de administración · Apartamento Laureles 204',
    amount: 150_000,
  },
  {
    id: 'redesign-upcoming-3',
    dueDate: '2026-12-10',
    description: 'Cargo de arriendo · Apartamento Laureles 204',
    amount: 1_200_000,
  },
]

/**
 * Mirrors useDashboardFinancials' own `monthlySeries` (6 months, income-only
 * - `paidAmount` sum of RENT charges per month; no "expenses" concept exists
 * anywhere in the deployed schema, same note as FinancialOverview's own).
 * The last point (nov) intentionally matches
 * REDESIGN_FINANCIAL_SUMMARY.collectedAmount.
 */
export interface RedesignIncomeMonth {
  label: string
  income: number
}

export const REDESIGN_INCOME_SERIES: RedesignIncomeMonth[] = [
  { label: 'jun', income: 2_100_000 },
  { label: 'jul', income: 2_400_000 },
  { label: 'ago', income: 2_250_000 },
  { label: 'sep', income: 2_800_000 },
  { label: 'oct', income: 3_000_000 },
  { label: 'nov', income: 3_200_000 },
]
