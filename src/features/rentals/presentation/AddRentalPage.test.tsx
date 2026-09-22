import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import AddRentalPage from './AddRentalPage'

const { listAccessibleAdministrations } = vi.hoisted(() => ({
  listAccessibleAdministrations: vi.fn(),
}))
const { listRentalSubjects } = vi.hoisted(() => ({ listRentalSubjects: vi.fn() }))
const { listTenantCandidates } = vi.hoisted(() => ({ listTenantCandidates: vi.fn() }))
const { createDraft } = vi.hoisted(() => ({ createDraft: vi.fn() }))

vi.mock('@/features/administration/infrastructure/supabase-administration.repository', () => ({
  supabaseAdministrationRepository: { listAccessibleAdministrations },
}))

vi.mock('../infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: { listByAdministration: listRentalSubjects },
}))

vi.mock('../infrastructure/supabase-tenant-candidate.repository', () => ({
  supabaseTenantCandidateRepository: { listByAdministration: listTenantCandidates },
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { createDraft, listByAdministration: vi.fn() },
}))

function renderPage() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rentals/new']}>
        <Routes>
          <Route path="/rentals/new" element={<AddRentalPage />} />
          <Route path="/rentals" element={<div>Rentals list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function resolveOneAdministration() {
  listAccessibleAdministrations.mockResolvedValueOnce([
    { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
  ])
}

describe('AddRentalPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('gates on Administration Context: shows loading while resolving', () => {
    listAccessibleAdministrations.mockReturnValueOnce(new Promise(() => {}))
    renderPage()

    expect(screen.getByTestId('add-rental-loading')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('gates on Administration Context: shows an error state', async () => {
    listAccessibleAdministrations.mockRejectedValueOnce(new Error('boom'))
    renderPage()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('gates on Administration Context: shows an explicit state for zero administrations, never a bare selector', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([])
    renderPage()

    expect(await screen.findByText('Todavía no tienes una administración')).toBeInTheDocument()
    expect(screen.queryByText('¿Qué vas a arrendar?')).not.toBeInTheDocument()
  })

  it('gates on Administration Context: shows the AdministrationPicker for multiple administrations, never a bare selector', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    renderPage()

    expect(await screen.findByText('Selecciona una administración')).toBeInTheDocument()
    expect(screen.queryByText('¿Qué vas a arrendar?')).not.toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('selecting an administration from the picker resolves to the "¿Qué vas a arrendar?" selector', async () => {
    listAccessibleAdministrations.mockResolvedValueOnce([
      { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' },
      { id: 'admin-2', name: 'Administración Dos', status: 'ACTIVE' },
    ])
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('radio', { name: 'Administración Dos, Activa' }))

    expect(await screen.findByText('¿Qué vas a arrendar?')).toBeInTheDocument()
  })

  it('shows "¿Qué vas a arrendar?" once resolved, and never writes anything to the backend just by opening', async () => {
    resolveOneAdministration()
    renderPage()

    expect(await screen.findByText('¿Qué vas a arrendar?')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Inmueble completo' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Habitación' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Parqueadero' })).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
    expect(listRentalSubjects).not.toHaveBeenCalled()
  })

  it('choosing a category shows the subject/tenant form, still without calling create_rental_draft', async () => {
    resolveOneAdministration()
    listRentalSubjects.mockReturnValueOnce(new Promise(() => {}))
    listTenantCandidates.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('¿Qué vas a arrendar?')

    await user.click(screen.getByRole('radio', { name: 'Inmueble completo' }))

    expect(listRentalSubjects).toHaveBeenCalledWith('admin-1', 'FULL_PROPERTY')
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('goes back to the selector when "Volver" is clicked', async () => {
    resolveOneAdministration()
    listRentalSubjects.mockReturnValueOnce(new Promise(() => {}))
    listTenantCandidates.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('radio', { name: 'Inmueble completo' }))
    await screen.findByRole('button', { name: 'Volver' })

    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(await screen.findByText('¿Qué vas a arrendar?')).toBeInTheDocument()
  })
})
