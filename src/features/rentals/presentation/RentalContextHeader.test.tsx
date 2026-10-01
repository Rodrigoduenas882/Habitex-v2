import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RentalContextHeader, type RentalContextSection } from './RentalContextHeader'

const { listByAdministration } = vi.hoisted(() => ({ listByAdministration: vi.fn() }))
const { subjectsListByAdministration, linksListByAdministration } = vi.hoisted(() => ({
  subjectsListByAdministration: vi.fn(),
  linksListByAdministration: vi.fn(),
}))
const { listActiveTenantNamesByRelationshipIds } = vi.hoisted(() => ({
  listActiveTenantNamesByRelationshipIds: vi.fn(),
}))
const { listCurrentRentAmountsByRelationshipIds } = vi.hoisted(() => ({
  listCurrentRentAmountsByRelationshipIds: vi.fn(),
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { listByAdministration },
}))
vi.mock('../infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: {
    listByAdministration: subjectsListByAdministration,
    listRelationshipLinksByAdministration: linksListByAdministration,
  },
}))
vi.mock('../infrastructure/supabase-rental-participant.repository', () => ({
  supabaseRentalParticipantRepository: { listActiveTenantNamesByRelationshipIds },
}))
vi.mock('../infrastructure/supabase-rental-terms.repository', () => ({
  supabaseRentalTermsRepository: {
    create: vi.fn(),
    getCurrent: vi.fn(),
    listRelationshipIdsWithTerms: vi.fn(),
    listCurrentRentAmountsByRelationshipIds,
  },
}))

const RELATIONSHIP = {
  id: 'rel-1',
  administrationId: 'admin-1',
  status: 'ACTIVE' as const,
  jurisdictionCountry: 'CO',
  realStartDate: null,
  trackingStartDate: null,
  expectedEndDate: null,
  actualEndDate: null,
  paymentDay: null,
  paymentTiming: null,
}

function renderHeader(activeSection: RentalContextSection) {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RentalContextHeader administrationId="admin-1" relationshipId="rel-1" activeSection={activeSection} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function setUpResolvedFixture() {
  listByAdministration.mockResolvedValue([RELATIONSHIP])
  subjectsListByAdministration.mockImplementation((_administrationId: string, subjectType: string) => {
    if (subjectType === 'FULL_PROPERTY') return Promise.resolve([{ id: 'subj-1', label: 'La Florida 101' }])
    return Promise.resolve([])
  })
  linksListByAdministration.mockResolvedValue([
    { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subj-1', subjectRole: 'PRIMARY' },
  ])
  listActiveTenantNamesByRelationshipIds.mockResolvedValue(new Map([['rel-1', 'María Pérez']]))
  listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map([['rel-1', 1500000]]))
}

describe('RentalContextHeader', () => {
  it('shows a loading skeleton while rentals/identities are resolving', () => {
    listByAdministration.mockReturnValue(new Promise(() => {}))
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValue([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValue(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map())

    renderHeader('terms')

    expect(screen.getByTestId('rental-context-header-loading')).toBeInTheDocument()
  })

  it('shows a not-found alert when the rentals read fails', async () => {
    listByAdministration.mockRejectedValue(new Error('boom'))
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValue([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValue(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map())

    renderHeader('terms')

    expect(await screen.findByText('No encontramos este arriendo en tu administración.')).toBeInTheDocument()
  })

  it('shows a not-found alert when the relationship id is not in the resolved list', async () => {
    listByAdministration.mockResolvedValue([])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValue([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValue(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map())

    renderHeader('terms')

    expect(await screen.findByText('No encontramos este arriendo en tu administración.')).toBeInTheDocument()
  })

  it('renders the resolved subject label as the only heading, the status badge, and the tenant line', async () => {
    setUpResolvedFixture()

    renderHeader('terms')

    expect(await screen.findByRole('heading', { name: 'La Florida 101' })).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('María Pérez')).toBeInTheDocument()
  })

  it('falls back to the honest subject placeholder when subjectLabel is null, never a raw UUID', async () => {
    listByAdministration.mockResolvedValue([RELATIONSHIP])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValue([])
    listActiveTenantNamesByRelationshipIds.mockResolvedValue(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map())

    renderHeader('terms')

    expect(await screen.findByRole('heading', { name: 'Inmueble sin identificar' })).toBeInTheDocument()
    expect(screen.queryByText('rel-1')).not.toBeInTheDocument()
  })

  it('omits the tenant line entirely when tenantName is null (never an empty/broken line)', async () => {
    listByAdministration.mockResolvedValue([RELATIONSHIP])
    subjectsListByAdministration.mockImplementation((_administrationId: string, subjectType: string) => {
      if (subjectType === 'FULL_PROPERTY') return Promise.resolve([{ id: 'subj-1', label: 'La Florida 101' }])
      return Promise.resolve([])
    })
    linksListByAdministration.mockResolvedValue([
      { rentalRelationshipId: 'rel-1', rentalSubjectId: 'subj-1', subjectRole: 'PRIMARY' },
    ])
    listActiveTenantNamesByRelationshipIds.mockResolvedValue(new Map())
    listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map())

    renderHeader('terms')

    await screen.findByRole('heading', { name: 'La Florida 101' })
    expect(screen.queryByText('Sin inquilino asignado')).not.toBeInTheDocument()
  })

  it('a failed identity resolution degrades to the honest fallback - the header itself still renders, never the not-found alert', async () => {
    // The rentals read (and the relationship lookup it feeds) resolves
    // fine; only an identity-contributing read fails. This must land in
    // the normal render branch, not the not-found Alert reserved for a
    // failed rentals read or a relationship missing from the list.
    listByAdministration.mockResolvedValue([RELATIONSHIP])
    subjectsListByAdministration.mockResolvedValue([])
    linksListByAdministration.mockResolvedValue([])
    listActiveTenantNamesByRelationshipIds.mockRejectedValue(new Error('boom'))
    listCurrentRentAmountsByRelationshipIds.mockResolvedValue(new Map())

    renderHeader('contracts')

    expect(await screen.findByRole('heading', { name: 'Inmueble sin identificar' })).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.queryByText('No encontramos este arriendo en tu administración.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Contratos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Términos' })).not.toHaveAttribute('aria-current')
  })

  it('renders all 4 nav links with the real relationshipId interpolated', async () => {
    setUpResolvedFixture()

    renderHeader('terms')
    await screen.findByRole('heading', { name: 'La Florida 101' })

    expect(screen.getByRole('link', { name: 'Términos' })).toHaveAttribute('href', '/rentals/rel-1/terms')
    expect(screen.getByRole('link', { name: 'Contratos' })).toHaveAttribute('href', '/rentals/rel-1/contracts')
    expect(screen.getByRole('link', { name: 'Cargos' })).toHaveAttribute('href', '/rentals/rel-1/charges')
    expect(screen.getByRole('link', { name: 'Pagos' })).toHaveAttribute('href', '/rentals/rel-1/payments')
  })

  const SECTIONS: { section: RentalContextSection; label: string }[] = [
    { section: 'terms', label: 'Términos' },
    { section: 'contracts', label: 'Contratos' },
    { section: 'charges', label: 'Cargos' },
    { section: 'payments', label: 'Pagos' },
  ]

  for (const { section, label } of SECTIONS) {
    it(`marks exactly "${label}" as aria-current="page" when activeSection is "${section}"`, async () => {
      setUpResolvedFixture()

      renderHeader(section)
      await screen.findByRole('heading', { name: 'La Florida 101' })

      for (const other of SECTIONS) {
        const link = screen.getByRole('link', { name: other.label })
        if (other.section === section) {
          expect(link).toHaveAttribute('aria-current', 'page')
        } else {
          expect(link).not.toHaveAttribute('aria-current')
        }
      }
    })
  }
})
