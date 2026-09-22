import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { createTestQueryClient } from '@/shared/testing/createTestQueryClient'
import { RentalRepositoryError } from '../domain/rental.types'
import { AddRentalDraftForm } from './AddRentalDraftForm'

const { listRentalSubjects } = vi.hoisted(() => ({ listRentalSubjects: vi.fn() }))
const { listTenantCandidates } = vi.hoisted(() => ({ listTenantCandidates: vi.fn() }))
const { createDraft } = vi.hoisted(() => ({ createDraft: vi.fn() }))

vi.mock('../infrastructure/supabase-rental-subject.repository', () => ({
  supabaseRentalSubjectRepository: { listByAdministration: listRentalSubjects },
}))

vi.mock('../infrastructure/supabase-tenant-candidate.repository', () => ({
  supabaseTenantCandidateRepository: { listByAdministration: listTenantCandidates },
}))

vi.mock('../infrastructure/supabase-rental.repository', () => ({
  supabaseRentalRepository: { createDraft, listByAdministration: vi.fn() },
}))

const SUBJECT_1 = { id: 'subj-1', administrationId: 'admin-1', subjectType: 'FULL_PROPERTY' as const, label: 'la florida' }
const CANDIDATE_1 = { id: 'person-1', fullName: 'María Pérez' }

function renderForm() {
  const client = createTestQueryClient()
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/rentals/new']}>
        <Routes>
          <Route
            path="/rentals/new"
            element={<AddRentalDraftForm administrationId="admin-1" subjectType="FULL_PROPERTY" onBack={() => {}} />}
          />
          <Route path="/rentals" element={<div>Rentals list page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function waitForSubjectsToSettle() {
  await waitFor(() => {
    expect(screen.queryByTestId('add-rental-subjects-loading')).not.toBeInTheDocument()
  })
}

describe('AddRentalDraftForm', () => {
  it('shows a loading state while rental subjects are resolving, and calls the real port with administrationId + subjectType', () => {
    listRentalSubjects.mockReturnValueOnce(new Promise(() => {}))
    listTenantCandidates.mockReturnValueOnce(new Promise(() => {}))
    renderForm()

    expect(screen.getByTestId('add-rental-subjects-loading')).toBeInTheDocument()
    expect(listRentalSubjects).toHaveBeenCalledWith('admin-1', 'FULL_PROPERTY')
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('shows an error state when listing rental subjects fails', async () => {
    listRentalSubjects.mockRejectedValueOnce(new Error('boom'))
    listTenantCandidates.mockResolvedValueOnce([])
    renderForm()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('shows the empty state for this category when there are zero real subjects, never a bare form', async () => {
    listRentalSubjects.mockResolvedValueOnce([])
    listTenantCandidates.mockResolvedValueOnce([])
    renderForm()
    await waitForSubjectsToSettle()

    expect(await screen.findByText('No tienes inmuebles completos disponibles')).toBeInTheDocument()
    expect(screen.queryByLabelText('Activo a arrendar')).not.toBeInTheDocument()
  })

  it('lists the real rental subject in the Select, never a fabricated one', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    renderForm()
    await waitForSubjectsToSettle()

    expect(screen.getByRole('option', { name: 'la florida' })).toBeInTheDocument()
  })

  it('disables "Persona existente" and shows a hint when there are zero tenant candidates', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    renderForm()
    await waitForSubjectsToSettle()

    expect(screen.getByRole('option', { name: 'Persona existente' })).toBeDisabled()
    expect(
      screen.getByText('Todavía no tienes personas registradas en esta administración. Usa "Nuevo arrendatario".'),
    ).toBeInTheDocument()
  })

  it('enables "Persona existente" and lists the real candidate when at least one exists', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([CANDIDATE_1])
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    expect(screen.getByRole('option', { name: 'Persona existente' })).toBeEnabled()

    await user.selectOptions(screen.getByLabelText('Arrendatario'), 'existing')

    expect(await screen.findByLabelText('Persona')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'María Pérez' })).toBeInTheDocument()
  })

  it('requires selecting a subject before submitting', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Selecciona qué vas a arrendar.')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('requires selecting an existing tenant when that mode is chosen', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([CANDIDATE_1])
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.selectOptions(screen.getByLabelText('Arrendatario'), 'existing')
    await screen.findByLabelText('Persona')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Selecciona una persona.')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('submits with an existing tenant, calling create_rental_draft exactly once with the real ids', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([CANDIDATE_1])
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-1', tenantPersonId: 'person-1' })
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.selectOptions(screen.getByLabelText('Arrendatario'), 'existing')
    await user.selectOptions(await screen.findByLabelText('Persona'), 'person-1')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => {
      expect(createDraft).toHaveBeenCalledTimes(1)
    })
    expect(createDraft).toHaveBeenCalledWith({
      administrationId: 'admin-1',
      rentalSubjectId: 'subj-1',
      tenant: { kind: 'existing', personId: 'person-1' },
    })
  })

  it('requires a full name for a new tenant', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Ingresa el nombre completo del arrendatario.')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('submits with a new tenant (document fields left blank), sending null for all document/contact fields', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-2', tenantPersonId: 'person-2' })
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => {
      expect(createDraft).toHaveBeenCalledTimes(1)
    })
    expect(createDraft).toHaveBeenCalledWith({
      administrationId: 'admin-1',
      rentalSubjectId: 'subj-1',
      tenant: {
        kind: 'new',
        fullName: 'Nuevo Arrendatario',
        documentType: null,
        documentNumber: null,
        documentCountry: null,
        nationalityCountry: 'CO',
        email: null,
        phone: null,
      },
    })
  })

  it('document type is a Select showing human labels, with real internal codes as values - never raw codes as visible text', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    renderForm()
    await waitForSubjectsToSettle()

    const documentType = screen.getByLabelText('Tipo de documento')
    expect(screen.getByRole('option', { name: 'Sin documento' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cédula de ciudadanía' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cédula de extranjería' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pasaporte' })).toBeInTheDocument()
    // The internal codes exist as option values, never as visible label text.
    expect(documentType.querySelector('option[value="CC"]')).not.toBeNull()
    expect(documentType.querySelector('option[value="CE"]')).not.toBeNull()
    expect(documentType.querySelector('option[value="PASSPORT"]')).not.toBeNull()
    expect(screen.queryByText('CC', { selector: 'option' })).not.toBeInTheDocument()
  })

  it('document country and nationality are Selects showing "Colombia", with internal value "CO" - never a raw code as visible text', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    renderForm()
    await waitForSubjectsToSettle()

    const documentCountry = screen.getByLabelText('País del documento')
    const nationality = screen.getByLabelText('Nacionalidad')

    expect(documentCountry.querySelector('option[value="CO"]')?.textContent).toBe('Colombia')
    expect(nationality.querySelector('option[value="CO"]')?.textContent).toBe('Colombia')
    expect(screen.queryByText('CO', { selector: 'option' })).not.toBeInTheDocument()
  })

  it('explicitly selecting Colombia as nationality sends "CO"', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-6', tenantPersonId: 'person-6' })
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.selectOptions(screen.getByLabelText('Nacionalidad'), 'Colombia')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => {
      expect(createDraft).toHaveBeenCalledTimes(1)
    })
    const [[submittedInput]] = createDraft.mock.calls as [[{ tenant: { nationalityCountry: string | null } }]]
    expect(submittedInput.tenant.nationalityCountry).toBe('CO')
  })

  it('rejects a document number without document type/country (incomplete document group)', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.type(screen.getByLabelText('Número de documento'), '123456')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Completa tipo, número y país de documento, o deja los tres vacíos.'),
    ).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('accepts a fully completed document group, sending all three real values', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-3', tenantPersonId: 'person-3' })
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.selectOptions(screen.getByLabelText('Tipo de documento'), 'CC')
    await user.type(screen.getByLabelText('Número de documento'), '123456')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => {
      expect(createDraft).toHaveBeenCalledTimes(1)
    })
    expect(createDraft).toHaveBeenCalledWith({
      administrationId: 'admin-1',
      rentalSubjectId: 'subj-1',
      tenant: {
        kind: 'new',
        fullName: 'Nuevo Arrendatario',
        documentType: 'CC',
        documentNumber: '123456',
        documentCountry: 'CO',
        nationalityCountry: 'CO',
        email: null,
        phone: null,
      },
    })
  })

  it('rejects an invalid email for a new tenant', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.type(screen.getByLabelText('Correo electrónico'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Ingresa un correo electrónico válido.')).toBeInTheDocument()
    expect(createDraft).not.toHaveBeenCalled()
  })

  it('disables the form and shows the pending label while submitting (blocks double submit)', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    let resolveCreateDraft: (value: { rentalRelationshipId: string; tenantPersonId: string }) => void = () => {}
    createDraft.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCreateDraft = resolve
      }),
    )
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    const pendingButton = await screen.findByRole('button', { name: 'Creando arriendo…' })
    expect(pendingButton).toBeDisabled()

    await user.click(pendingButton)
    expect(createDraft).toHaveBeenCalledTimes(1)

    resolveCreateDraft({ rentalRelationshipId: 'rel-4', tenantPersonId: 'person-4' })
  })

  it('shows a human error message on a real RPC failure, and does not navigate away', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    createDraft.mockRejectedValueOnce(new RentalRepositoryError('Failed to create the rental draft'))
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('No pudimos crear el arriendo. Intenta de nuevo.')).toBeInTheDocument()
    expect(screen.queryByText('Rentals list page')).not.toBeInTheDocument()
    expect(screen.queryByText(/postgres/i)).not.toBeInTheDocument()
  })

  it('navigates to /rentals only on real success', async () => {
    listRentalSubjects.mockResolvedValueOnce([SUBJECT_1])
    listTenantCandidates.mockResolvedValueOnce([])
    createDraft.mockResolvedValueOnce({ rentalRelationshipId: 'rel-5', tenantPersonId: 'person-5' })
    const user = userEvent.setup()
    renderForm()
    await waitForSubjectsToSettle()

    await user.selectOptions(screen.getByLabelText('Activo a arrendar'), 'subj-1')
    await user.type(screen.getByLabelText('Nombre completo'), 'Nuevo Arrendatario')
    await user.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Rentals list page')).toBeInTheDocument()
  })
})
