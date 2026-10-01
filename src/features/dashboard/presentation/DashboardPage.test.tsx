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
import DashboardPage from './DashboardPage'

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
    render(<DashboardPage />)

    expect(await screen.findByRole('heading', { name: /Hola, Rodrigo/ })).toBeInTheDocument()
  })

  it('never imports/renders a dashboard-mock-data business value - a real, distinctly-computed value renders instead', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty(), makeProperty({ id: 'prop-2' }), makeProperty({ id: 'prop-3' })])
    render(<DashboardPage />)

    // The old mock's "Inmuebles" value was the string '7' - a real count of 3
    // renders instead, which could never coincidentally match the mock.
    expect(await screen.findByText('3')).toBeInTheDocument()
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

  it('shows a loading skeleton for the properties KPI while useProperties is pending, never a stale/zero value', async () => {
    resolveOneAdministration()
    listProperties.mockImplementation(() => new Promise(() => {}))
    render(<DashboardPage />)

    expect(await screen.findByTestId('kpi-properties-loading')).toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows an error state when useProperties errors, never a mock/fabricated fallback', async () => {
    resolveOneAdministration()
    listProperties.mockRejectedValue(new Error('boom'))
    render(<DashboardPage />)

    expect(await screen.findByText('No pudimos cargar tus inmuebles.')).toBeInTheDocument()
    expect(screen.queryByText('7')).not.toBeInTheDocument()
  })

  it('renders each section\'s real empty state for a legitimately empty administration (zero properties, zero reported payments)', async () => {
    resolveOneAdministration()
    render(<DashboardPage />)

    expect(await screen.findByText('Todo al día')).toBeInTheDocument()
    await screen.findByTestId('properties-row')
    expect(screen.getAllByRole('button', { name: 'Agregar inmueble' })).toHaveLength(2)
    expect(screen.queryByText('Apartamento 302')).not.toBeInTheDocument()
  })

  it('renders the real property list with its own name/location derived from real Property fields', async () => {
    resolveOneAdministration()
    listProperties.mockResolvedValue([makeProperty()])
    render(<DashboardPage />)

    expect(await screen.findByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('Calle 1 # 2-30, Bogotá')).toBeInTheDocument()
  })

  it('renders one AttentionPanel item per REPORTED payment with the real amount/date, never a contract/document item', async () => {
    resolveOneAdministration()
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

  it('renders FinancialOverview with only the income series - no expenses bar/legend/total anywhere on the page', async () => {
    resolveOneAdministration()
    listCharges.mockResolvedValue([makeCharge()])
    render(<DashboardPage />)

    await screen.findByText('Ingresos del mes')
    expect(screen.queryByText('Gastos')).not.toBeInTheDocument()
  })

  it('renders all four KPI labels and the four quick action buttons', async () => {
    resolveOneAdministration()
    render(<DashboardPage />)

    expect(await screen.findByText('Ingresos del mes')).toBeInTheDocument()
    expect(screen.getByText('Por cobrar')).toBeInTheDocument()
    expect(screen.getByText('Ocupación')).toBeInTheDocument()
    expect(screen.getByText('Inmuebles')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: 'Crear arriendo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeInTheDocument()
    await screen.findByTestId('properties-row')
    expect(screen.getAllByRole('button', { name: 'Agregar inmueble' })).toHaveLength(2)
  })

  it('shows the AdministrationPicker when more than one administration is accessible', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    render(<DashboardPage />)

    expect(await screen.findByRole('radiogroup')).toBeInTheDocument()
  })

  it('shows an error state when the administration itself fails to resolve', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(new Error('boom'))
    render(<DashboardPage />)

    expect(await screen.findByText('No pudimos cargar tu administración')).toBeInTheDocument()
  })
})
