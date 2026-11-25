import { QueryClientProvider } from '@tanstack/react-query'
import { render as rtlRender, screen, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { Charge } from '@/features/charges/domain/charge.types'
import type { Payment } from '@/features/payments/domain/payment.types'
import type { Property } from '@/features/properties/domain/property.types'
import type { RentalRelationshipSubjectLink, RentalSubject } from '@/features/rentals/domain/rental-subject.types'
import type { RentalRelationship } from '@/features/rentals/domain/rental.types'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import DashboardPage, { DashboardContent, type DashboardContentProps } from './DashboardPage'

const { listParkings } = vi.hoisted(() => ({ listParkings: vi.fn().mockResolvedValue([]) }))
vi.mock('@/features/parking/infrastructure/supabase-parking.repository', () => ({ supabaseParkingRepository: { listByAdministration: listParkings } }))

vi.mock('@/features/rentals/application/useRentalIdentities', () => ({
  useRentalIdentities: () => ({ status: 'ready', byRelationshipId: new Map([['rel-1', { subjectLabel: 'Apartamento 302', tenantName: null, rentAmount: null }]]) }),
}))

vi.mock('@/features/auth/application/useAuthSession', () => ({
  useAuthSession: () => ({
    data: { userId: 'user-1', email: 'rodrigo.duenas@gmail.com', expiresAtUnix: null },
    isLoading: false,
  }),
}))

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { listProperties } = vi.hoisted(() => ({ listProperties: vi.fn() }))
const { listRooms } = vi.hoisted(() => ({ listRooms: vi.fn() }))
const { listRentalSubjects, listSubjectLinks } = vi.hoisted(() => ({
  listRentalSubjects: vi.fn(),
  listSubjectLinks: vi.fn(),
}))
const { listRentals } = vi.hoisted(() => ({ listRentals: vi.fn() }))
const { listCharges } = vi.hoisted(() => ({ listCharges: vi.fn() }))
const { listReportedPayments } = vi.hoisted(() => ({ listReportedPayments: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('@/features/properties/infrastructure/supabase-property.repository', () => ({
  supabasePropertyRepository: {
    listByAdministration: listProperties,
    createFullProperty: vi.fn(),
    createRoomRentalProperty: vi.fn(),
  },
}))

vi.mock('@/features/properties/infrastructure/supabase-room.repository', () => ({
  supabaseRoomRepository: {
    listByAdministration: listRooms,
    listByProperty: vi.fn(),
    createForProperty: vi.fn(),
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: listRentalSubjects,
    listRelationshipLinksByAdministration: listSubjectLinks,
  },
}))

vi.mock('@/features/rentals/infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: {
    listByAdministration: listRentals,
    createDraft: vi.fn(),
    activate: vi.fn(),
    updateSchedule: vi.fn(),
    cancelDraft: vi.fn(),
    startEnding: vi.fn(),
    end: vi.fn(),
  },
}))

vi.mock('@/features/charges/infrastructure/supabase-charge.repository', () => ({
  supabaseChargeRepository: {
    listByAdministration: listCharges,
    listByRelationship: vi.fn(),
    generateRentCharges: vi.fn(),
  },
}))

vi.mock('@/features/payments/infrastructure/supabase-payment.repository', () => ({
  supabasePaymentRepository: {
    listReportedByAdministration: listReportedPayments,
    listByRelationship: vi.fn(),
    reportPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment: vi.fn(),
    listAllocationsForPayment: vi.fn(),
    allocatePayment: vi.fn(),
    getReceiptForPayment: vi.fn(),
    issueReceipt: vi.fn(),
  },
}))

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    administrationId: 'admin-1',
    propertyType: 'APARTMENT',
    rentalMode: 'FULL_PROPERTY',
    name: 'Apartamento 302',
    countryCode: 'CO',
    city: 'Bogotá',
    address: 'Calle 1 # 2-30',
    hasAdministration: false,
    administrationFee: null,
    ...overrides,
  }
}

function makeRentalSubject(overrides: Partial<RentalSubject> = {}): RentalSubject {
  return {
    id: 'subject-1',
    administrationId: 'admin-1',
    subjectType: 'FULL_PROPERTY',
    propertyId: 'prop-1',
    roomId: null,
    parkingId: null,
    label: 'Apartamento 302',
    ...overrides,
  }
}

function makeSubjectLink(overrides: Partial<RentalRelationshipSubjectLink> = {}): RentalRelationshipSubjectLink {
  return {
    rentalRelationshipId: 'rel-1',
    rentalSubjectId: 'subject-1',
    subjectRole: 'PRIMARY',
    ...overrides,
  }
}

function makeRental(overrides: Partial<RentalRelationship> = {}): RentalRelationship {
  return {
    id: 'rel-1',
    administrationId: 'admin-1',
    status: 'ACTIVE',
    jurisdictionCountry: 'CO',
    realStartDate: '2026-01-01',
    trackingStartDate: '2026-01-01',
    expectedEndDate: null,
    actualEndDate: null,
    paymentDay: 5,
    paymentTiming: 'ADVANCE',
    ...overrides,
  }
}

function makeCharge(overrides: Partial<Charge> = {}): Charge {
  return {
    id: 'charge-1',
    administrationId: 'admin-1',
    rentalRelationshipId: 'rel-1',
    chargeType: 'RENT',
    origin: 'SYSTEM',
    description: 'Renta',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    dueDate: '2026-09-05',
    amount: 500_000,
    currency: 'COP',
    sourceType: null,
    sourceId: null,
    createdAt: '2026-09-01T00:00:00Z',
    paidAmount: 0,
    balance: 500_000,
    financialStatus: 'PENDING',
    ...overrides,
  }
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'payment-1',
    administrationId: 'admin-1',
    rentalRelationshipId: 'rel-1',
    reportedByPersonId: 'person-1',
    confirmedByPersonId: null,
    status: 'REPORTED',
    amount: 500_000,
    currency: 'COP',
    paymentDate: '2026-01-05',
    paymentMethod: null,
    externalReference: null,
    proofFileId: null,
    notes: null,
    reportedAt: '2026-01-05T10:00:00Z',
    confirmedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: '2026-01-05T10:00:00Z',
    updatedAt: '2026-01-05T10:00:00Z',
    ...overrides,
  }
}

function render(ui: ReactElement): RenderResult {
  const client = createTestQueryClient()
  return rtlRender(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

function resolveOneAdministration() {
  listAccessibleAdministrations.mockResolvedValueOnce([
    { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
  ])
}

describe('DashboardPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    // Defaults: an administration with no properties/rentals/charges/payments
    // at all - most tests only care about one dimension and override just
    // that one mock, the same beforeEach-defaults convention as
    // RentalPaymentsPage.test.tsx.
    listProperties.mockResolvedValue([])
    listRooms.mockResolvedValue([])
    listRentalSubjects.mockResolvedValue([])
    listSubjectLinks.mockResolvedValue([])
    listRentals.mockResolvedValue([])
    listCharges.mockResolvedValue([])
    listReportedPayments.mockResolvedValue([])
  })

  afterEach(() => {
    window.localStorage.clear()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('greets the user with a name derived from their session email, not a hardcoded one', async () => {
    resolveOneAdministration()
    // Estado C (has-rentals) only, so DashboardHeader's own greeting ("Hola,
    // {{name}}") renders - Estados A/B each have their own, different
    // first-run greeting (see their own dedicated tests below).
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    expect(await screen.findByRole('heading', { name: /Hola, Rodrigo/ })).toBeInTheDocument()
    expect(screen.queryByText(/Vista de demostración/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver estados vacíos' })).not.toBeInTheDocument()
  })

  it('never imports/renders a dashboard-mock-data business value - real, distinctly-named properties render instead', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([
      makeProperty({ name: 'Apartamento Real Uno' }),
      makeProperty({ id: 'prop-2', name: 'Apartamento Real Dos' }),
      makeProperty({ id: 'prop-3', name: 'Apartamento Real Tres' }),
    ])
    // At least one rental, so this reaches Estado C (the KPI grid) rather
    // than Estado B (has-properties, no KPI grid at all).
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    // The old mock-data module never produced these exact names - real data
    // flowing through PropertiesOverview, never a mock fossil.
    expect(await screen.findByText('Apartamento Real Uno')).toBeInTheDocument()
    expect(screen.getByText('Apartamento Real Dos')).toBeInTheDocument()
    expect(screen.getByText('Apartamento Real Tres')).toBeInTheDocument()
  })

  it('renders the real occupied/total occupancy percentage and its trend text for a specific scenario', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentalSubjects.mockImplementation((_administrationId: string, subjectType: 'FULL_PROPERTY' | 'ROOM') =>
      Promise.resolve(subjectType === 'FULL_PROPERTY' ? [makeRentalSubject()] : []),
    )
    listSubjectLinks.mockResolvedValue([makeSubjectLink()])
    listRentals.mockResolvedValue([makeRental({ status: 'ACTIVE' })])
    render(<DashboardPage />)

    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(screen.getByText('1 de 1 ocupados')).toBeInTheDocument()
  })

  it('shows the explicit no-data state (never a fabricated 0%) when there are zero rentable units', async () => {
    resolveOneAdministration()
    // A BY_ROOMS property with zero enabled rooms and no parkings has zero
    // rentable units even though properties.length > 0 - combined with a
    // rental (any rental, to reach Estado C/has-rentals so the KPI grid
    // renders at all) this reproduces totalUnits === 0 without relying on
    // the old "zero properties" case, which is now Estado A.
    listProperties.mockResolvedValue([makeProperty({ rentalMode: 'BY_ROOMS' })])
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    expect(await screen.findByText('Sin unidades registradas')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('renders the real monthly receivable and monthly income values, distinct from the 6-month series total', async () => {
    // useDashboardFinancials's currentMonthRange() is correctly based on the
    // real wall clock (see month-range.ts) - the fixture dates below are
    // deliberately fixed, so the clock is frozen to a matching date instead
    // of leaving this test dependent on whichever real month it happens to
    // run in (it previously assumed "today" would always be in September
    // 2026, which broke the instant the real clock crossed into October).
    // Only Date is faked (not setTimeout/setInterval) - findByText's own
    // internal waitFor polling still needs real timers to advance.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T12:00:00'))

    resolveOneAdministration()
    // Estado C (has-rentals), so the KPI grid/financial section render.
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listCharges.mockResolvedValue([
      makeCharge({ id: 'charge-current', dueDate: '2026-09-05', amount: 500_000, paidAmount: 200_000, balance: 300_000 }),
      makeCharge({ id: 'charge-previous', dueDate: '2026-08-05', amount: 400_000, paidAmount: 150_000, balance: 250_000 }),
    ])
    render(<DashboardPage />)

    expect(await screen.findByText('$300.000')).toBeInTheDocument()
    expect(screen.getByText('$200.000')).toBeInTheDocument()
    // FinancialOverview's own 6-month total (200_000 + 150_000) is a
    // different, real number - never confused with the current month's own
    // monthlyIncome KPI.
    expect(screen.getByText('$350.000')).toBeInTheDocument()
  })

  it('shows the lifecycle loading skeleton while useProperties is pending, never a stale/zero value or Estado A/B', async () => {
    resolveOneAdministration()
    listProperties.mockImplementation(() => new Promise(() => {}))
    render(<DashboardPage />)

    // useDashboardLifecycleState stays 'loading' while properties is still
    // pending (see its own tests), so DashboardView shows the generic
    // lifecycle skeleton - never the KPI grid, nor a 0/Estado A fallback.
    expect(await screen.findByTestId('dashboard-lifecycle-loading')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByText('Vencido · últimos 6 meses')).not.toBeInTheDocument()
    expect(screen.queryByText('Agregar inmueble')).not.toBeInTheDocument()
  })

  it('shows an explicit lifecycle error (never a mock/fabricated fallback) when useProperties errors', async () => {
    resolveOneAdministration()
    listProperties.mockRejectedValue(new Error('boom'))
    render(<DashboardPage />)

    expect(await screen.findByText('No pudimos cargar tu panel')).toBeInTheDocument()
    expect(screen.queryByText('7')).not.toBeInTheDocument()
    // Never confused with Estado A's legitimate "zero properties" empty state.
    expect(screen.queryByText('Agregar inmueble')).not.toBeInTheDocument()
  })

  it('renders AttentionPanel\'s real empty state ("Todo al día") within Estado C for an administration with legitimately zero reported payments/overdue charges', async () => {
    resolveOneAdministration()
    // Estado C (has-rentals) - zero reported payments/charges is a property
    // of AttentionPanel's own data, not of the lifecycle state.
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    expect(await screen.findByText('Todo al día')).toBeInTheDocument()
  })

  it('renders the real property list with its own name/location derived from real Property fields', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    // At least one rental, so this reaches Estado C's PropertiesOverview
    // carousel (the component under test here) rather than Estado B's own,
    // differently-laid-out property cards.
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    expect(await screen.findByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-30, Bogotá')).toBeInTheDocument()
  })

  it('renders one AttentionPanel item per REPORTED payment with the real amount/date, never a contract/document item', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listReportedPayments.mockResolvedValue([
      makePayment({ id: 'payment-a', amount: 950_000, paymentDate: '2026-01-05' }),
    ])
    render(<DashboardPage />)

    expect(await screen.findByText('Pago pendiente')).toBeInTheDocument()
    expect(screen.getByText('$950.000')).toBeInTheDocument()
    expect(screen.getByText('5 de ene de 2026')).toBeInTheDocument()
    expect(screen.queryByText('Contrato por vencer')).not.toBeInTheDocument()
    expect(screen.queryByText('Documento pendiente')).not.toBeInTheDocument()
  })

  it('wires the AttentionPanel item\'s "Ver" link to that REPORTED payment\'s own relationship id (DS-004)', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listReportedPayments.mockResolvedValue([
      makePayment({ id: 'payment-a', amount: 950_000, paymentDate: '2026-01-05', rentalRelationshipId: 'rel-1' }),
    ])
    render(<DashboardPage />)

    const link = await screen.findByRole('link', { name: 'Ver' })
    expect(link).toHaveAttribute('href', '/rentals/rel-1/payments')
  })

  it('none of the four KPI cards are links (DS-004) - the approved design has no 1:1 KPI-to-page match anymore', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    await screen.findByText('Cobrado de cargos del mes')
    expect(screen.queryByRole('link', { name: /Cobrado de cargos del mes/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Por cobrar/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Vencido/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ocupación/ })).not.toBeInTheDocument()
  })

  it('renders AttentionPanel\'s content before FinancialOverview\'s content in document order (DS-004 hierarchy swap)', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listReportedPayments.mockResolvedValue([makePayment({ id: 'payment-a' })])
    const { container } = render(<DashboardPage />)

    await screen.findByText('Pago pendiente')
    // Unique markers for each section - "Pago pendiente" only ever renders
    // inside AttentionPanel, "Últimos 6 meses" only inside FinancialOverview
    // (unlike "Cobrado de cargos del mes", which is also a KPI label).
    const attentionIndex = container.textContent.indexOf('Pago pendiente')
    const financialIndex = container.textContent.indexOf('Últimos 6 meses')

    expect(attentionIndex).toBeGreaterThan(-1)
    expect(financialIndex).toBeGreaterThan(-1)
    expect(attentionIndex).toBeLessThan(financialIndex)
  })

  it('renders FinancialOverview with only the income series - no expenses bar/legend/total anywhere on the page', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listCharges.mockResolvedValue([makeCharge()])
    render(<DashboardPage />)

    await screen.findByText('Cobrado de cargos del mes')
    expect(screen.queryByText('Gastos')).not.toBeInTheDocument()
  })

  it('uses the reported subject and only the backend OVERDUE status for the overdue charge link', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listReportedPayments.mockResolvedValue([makePayment({ id: 'reported', rentalRelationshipId: 'rel-1' })])
    listCharges.mockResolvedValue([
      makeCharge({ id: 'overdue', rentalRelationshipId: 'rel-1', balance: 780_000, financialStatus: 'OVERDUE' }),
      makeCharge({ id: 'partial', rentalRelationshipId: 'rel-2', balance: 123_000, financialStatus: 'PARTIAL' }),
    ])
    render(<DashboardPage />)
    expect(await screen.findByText('Cobro vencido')).toBeInTheDocument()
    // Two AttentionPanel rows (reported payment + overdue charge) plus the
    // real property's own PropertiesOverview card, all sharing the same
    // identity label/name by fixture design.
    expect(screen.getAllByText('Apartamento 302')).toHaveLength(3)
    // Appears twice by design, not a bug: once in AttentionPanel's overdue
    // row and once in the "Vencido" KPI (this fixture's only RENT OVERDUE
    // charge) - the two are deliberately not mutually exclusive categories.
    expect(screen.getAllByText('$780.000')).toHaveLength(2)
    const links = screen.getAllByRole('link', { name: 'Ver' })
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/rentals/rel-1/payments', '/rentals/rel-1/charges'])
  })

  it('renders all four approved KPI labels and the four quick action buttons', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    render(<DashboardPage />)

    expect(await screen.findByText('Cobrado de cargos del mes')).toBeInTheDocument()
    expect(screen.getByText('Por cobrar')).toBeInTheDocument()
    expect(screen.getByText('Vencido · últimos 6 meses')).toBeInTheDocument()
    expect(screen.getByText('Ocupación')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Crear arriendo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeInTheDocument()
  })

  it('renders the real overdueAmount (6-month window, RENT OVERDUE charges only) in the "Vencido" KPI', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-15T12:00:00'))

    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental()])
    listCharges.mockResolvedValue([
      // Overdue, 2 months before "today" - still counted (6-month window, not current-month-only).
      makeCharge({ id: 'overdue-old', dueDate: '2026-07-05', balance: 300_000, financialStatus: 'OVERDUE' }),
      // Overdue, current month.
      makeCharge({ id: 'overdue-current', dueDate: '2026-09-05', balance: 150_000, financialStatus: 'OVERDUE' }),
      // Partial, not overdue - must not count.
      makeCharge({ id: 'partial', dueDate: '2026-09-05', balance: 90_000, financialStatus: 'PARTIAL' }),
    ])
    render(<DashboardPage />)

    expect(await screen.findByText('Vencido · últimos 6 meses')).toBeInTheDocument()
    expect(screen.getByText('$450.000')).toBeInTheDocument()
  })

  it('shows Estado A (new-owner) when the administration has zero properties, with a real CTA link to /properties/new', async () => {
    resolveOneAdministration()
    // Both default to [] via beforeEach - the legitimate "brand-new owner" case.
    render(<DashboardPage />)

    expect(await screen.findByRole('heading', { name: /Rodrigo/ })).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: 'Agregar inmueble' })
    expect(cta).toHaveAttribute('href', '/properties/new')
    // Never the full KPI dashboard nor Estado B's portfolio copy.
    expect(screen.queryByText('Vencido · últimos 6 meses')).not.toBeInTheDocument()
    expect(screen.queryByText('Tu portafolio')).not.toBeInTheDocument()
  })

  it('shows Estado B (has-properties) when there is at least one property and zero rentals, with the real property and a CTA link to /rentals/new', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    // listRentals stays [] via beforeEach - properties exist, no rentals yet.
    render(<DashboardPage />)

    expect(await screen.findByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('Tu portafolio')).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: 'Registrar arriendo' })
    expect(cta).toHaveAttribute('href', '/rentals/new')
    // Never the full KPI dashboard nor Estado A's onboarding copy.
    expect(screen.queryByText('Vencido · últimos 6 meses')).not.toBeInTheDocument()
    expect(screen.queryByText('Agregar tu primer inmueble')).not.toBeInTheDocument()
  })

  it('shows the AdministrationPicker when more than one administration is accessible', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    render(<DashboardPage />)

    expect(await screen.findByRole('group', { name: 'Selecciona una administración' })).toBeInTheDocument()
  })

  it('shows an error state when the administration itself fails to resolve', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(new Error('boom'))
    render(<DashboardPage />)

    expect(await screen.findByText('No pudimos cargar tu administración')).toBeInTheDocument()
  })

  it('shows the no-active-rentals notice when every rental is ENDED (no ACTIVE/ENDING)', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental({ status: 'ENDED' })])
    render(<DashboardPage />)

    expect(
      await screen.findByText('No tienes arriendos activos actualmente. Puedes consultar el historial de tus arriendos finalizados o registrar uno nuevo.'),
    ).toBeInTheDocument()
    // Still Estado C (has-rentals, per the approved classification) - the
    // KPI grid renders alongside the notice, never Estado B's own copy.
    expect(screen.getByText('Cobrado de cargos del mes')).toBeInTheDocument()
    expect(screen.queryByText('Tu portafolio')).not.toBeInTheDocument()
  })

  it('does not show the no-active-rentals notice when at least one rental is ACTIVE', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([makeRental({ status: 'ACTIVE' })])
    render(<DashboardPage />)

    await screen.findByText('Cobrado de cargos del mes')
    expect(screen.queryByText(/No tienes arriendos activos/)).not.toBeInTheDocument()
  })

  it('does not show the no-active-rentals notice when at least one rental is ENDING, even mixed with ENDED/CANCELLED', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    listRentals.mockResolvedValue([
      makeRental({ id: 'rel-ended', status: 'ENDED' }),
      makeRental({ id: 'rel-cancelled', status: 'CANCELLED' }),
      makeRental({ id: 'rel-ending', status: 'ENDING' }),
    ])
    render(<DashboardPage />)

    await screen.findByText('Cobrado de cargos del mes')
    expect(screen.queryByText(/No tienes arriendos activos/)).not.toBeInTheDocument()
  })
})

describe('DashboardContent - no-active-rentals notice, fail-closed branches', () => {
  // DashboardContent itself, rendered directly with controlled props - the
  // composed DashboardPage can never reach activeRentalStatus 'loading'/
  // 'error' while also rendering DashboardContent (DashboardView's own
  // useRentals call shares its queryKey/cache with
  // useDashboardLifecycleState's internal one, so a real rentals failure
  // surfaces as the page-level lifecycle error screen first - DashboardContent
  // never mounts). These two branches are still real, reachable states of
  // DashboardContentProps itself (e.g. a future caller, or a cache
  // invalidation race) and must stay fail-closed - tested in isolation here.
  function baseProps(): DashboardContentProps {
    return {
      name: 'Rodrigo',
      propertiesQuery: { data: [], isLoading: false, isError: false },
      occupancy: { status: 'ready', occupiedUnits: 0, totalUnits: 0, percentage: null },
      financials: { status: 'ready', monthlyIncome: 0, monthlyReceivable: 0, overdueAmount: 0, monthlySeries: [] },
      attention: { status: 'ready', reportedPayments: [] },
      propertyOccupancy: { status: 'ready', byPropertyId: new Map() },
    }
  }

  it('never claims "no active rentals" while the underlying query is loading', () => {
    render(<DashboardContent {...baseProps()} activeRentalStatus="loading" />)
    expect(screen.queryByText(/No tienes arriendos activos/)).not.toBeInTheDocument()
  })

  it('never claims "no active rentals" when the underlying query failed', () => {
    render(<DashboardContent {...baseProps()} activeRentalStatus="error" />)
    expect(screen.queryByText(/No tienes arriendos activos/)).not.toBeInTheDocument()
  })

  it('shows the notice only for the resolved "noActiveOrEnding" state', () => {
    render(<DashboardContent {...baseProps()} activeRentalStatus="noActiveOrEnding" />)
    expect(screen.getByText(/No tienes arriendos activos/)).toBeInTheDocument()
  })

  it('defaults to no notice when activeRentalStatus is omitted (DashboardVisualPreview\'s own fixture)', () => {
    render(<DashboardContent {...baseProps()} />)
    expect(screen.queryByText(/No tienes arriendos activos/)).not.toBeInTheDocument()
  })
})
