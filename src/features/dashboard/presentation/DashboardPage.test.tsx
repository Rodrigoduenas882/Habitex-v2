import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import DashboardPage from './DashboardPage'

vi.mock('@/features/auth/application/useAuthSession', () => ({
  useAuthSession: () => ({
    data: { userId: 'user-1', email: 'rodrigo.duenas@gmail.com', expiresAtUnix: null },
    isLoading: false,
  }),
}))

describe('DashboardPage', () => {
  it('greets the user with a name derived from their session email, not a hardcoded one', () => {
    render(<DashboardPage />)

    expect(screen.getByRole('heading', { name: /Hola, Rodrigo/ })).toBeInTheDocument()
  })

  it('renders all four KPI cards', () => {
    render(<DashboardPage />)

    expect(screen.getByText('Ingresos del mes')).toBeInTheDocument()
    expect(screen.getByText('Por cobrar')).toBeInTheDocument()
    expect(screen.getByText('Ocupación')).toBeInTheDocument()
    expect(screen.getByText('Inmuebles')).toBeInTheDocument()
  })

  it('renders the four quick actions as real, focusable (but inert) buttons', () => {
    render(<DashboardPage />)

    expect(screen.getByRole('button', { name: 'Crear arriendo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar pago' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subir documento' })).toBeInTheDocument()
    // "Agregar inmueble" appears both as a quick action and as the trailing
    // add-property card in the properties row.
    expect(screen.getAllByRole('button', { name: 'Agregar inmueble' })).toHaveLength(2)
  })

  it('renders the financial overview and the attention panel with its mock items', () => {
    render(<DashboardPage />)

    expect(screen.getByText('Ingresos vs. gastos')).toBeInTheDocument()
    expect(screen.getByText('Requiere tu atención')).toBeInTheDocument()
    expect(screen.getByText('Pago pendiente')).toBeInTheDocument()
    expect(screen.getByText('Contrato por vencer')).toBeInTheDocument()
  })

  it('renders the properties row', () => {
    render(<DashboardPage />)

    expect(screen.getByText('Mis inmuebles')).toBeInTheDocument()
    // "Apartamento 302" legitimately appears twice (it's also the subject of
    // the "Pago pendiente" attention item) - assert on the property card's
    // own location text instead, which is unique to it.
    expect(screen.getByText('Chapinero, Bogotá')).toBeInTheDocument()
  })
})
