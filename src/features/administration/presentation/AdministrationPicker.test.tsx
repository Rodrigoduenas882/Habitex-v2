import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import type { AccessibleAdministration } from '../domain/administration.types'
import { AdministrationPicker } from './AdministrationPicker'

const ADMIN_1: AccessibleAdministration = { id: 'admin-1', name: 'Administración Uno', status: 'ACTIVE' }
const ADMIN_2: AccessibleAdministration = { id: 'admin-2', name: 'Administración Dos', status: 'SUSPENDED' }
const ADMIN_3: AccessibleAdministration = { id: 'admin-3', name: 'Administración Tres', status: 'ARCHIVED' }

describe('AdministrationPicker', () => {
  it('renders one selectable option per administration, as a radiogroup', () => {
    render(<AdministrationPicker options={[ADMIN_1, ADMIN_2]} onSelect={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: 'Selecciona una administración' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(2)
  })

  it('shows each administration name and its translated status, never the raw enum', () => {
    render(<AdministrationPicker options={[ADMIN_1, ADMIN_2, ADMIN_3]} onSelect={vi.fn()} />)

    expect(screen.getByText('Administración Uno')).toBeInTheDocument()
    expect(screen.getByText('Activa')).toBeInTheDocument()
    expect(screen.getByText('Administración Dos')).toBeInTheDocument()
    expect(screen.getByText('Suspendida')).toBeInTheDocument()
    expect(screen.getByText('Administración Tres')).toBeInTheDocument()
    expect(screen.getByText('Archivada')).toBeInTheDocument()
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument()
    expect(screen.queryByText('SUSPENDED')).not.toBeInTheDocument()
    expect(screen.queryByText('ARCHIVED')).not.toBeInTheDocument()
  })

  it('keeps SUSPENDED and ARCHIVED administrations selectable - this is a navigation preference, not a business guard', () => {
    render(<AdministrationPicker options={[ADMIN_2, ADMIN_3]} onSelect={vi.fn()} />)

    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeEnabled()
    }
  })

  it('calls onSelect with the id of the clicked administration', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AdministrationPicker options={[ADMIN_1, ADMIN_2]} onSelect={onSelect} />)

    await user.click(screen.getByRole('radio', { name: /Administración Dos/ }))

    expect(onSelect).toHaveBeenCalledWith('admin-2')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('is operable by keyboard - each option is a real <button>, not a div with a click handler', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AdministrationPicker options={[ADMIN_1]} onSelect={onSelect} />)

    const [radio] = screen.getAllByRole('radio')
    if (!radio) {
      throw new Error('expected a radio option to render')
    }
    radio.focus()
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith('admin-1')
  })
})
