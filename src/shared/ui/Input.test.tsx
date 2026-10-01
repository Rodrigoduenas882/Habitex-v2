import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Input } from './Input'

describe('Input', () => {
  it('renders its label and associates it with the control', () => {
    render(<Input label="Correo electrónico" />)

    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
  })

  it('shows an error message and marks the field invalid', () => {
    render(<Input label="Correo electrónico" error="Ingresa tu correo electrónico." />)

    const input = screen.getByLabelText('Correo electrónico')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Ingresa tu correo electrónico.')
  })

  it('renders a type="file" input with its own visual-coherence modifier', () => {
    render(<Input label="Comprobante de pago" type="file" />)

    const input = screen.getByLabelText('Comprobante de pago')
    expect(input).toHaveAttribute('type', 'file')
    // The native "Choose file" button needs its own styling hook
    // (::file-selector-button in Input.module.css) since it can't be
    // targeted by an external className - this confirms the modifier class
    // is applied only for type="file", not for every other input type.
    expect(input.className).toMatch(/inputFile/)
  })

  it('does not apply the file-input modifier to a regular text input', () => {
    render(<Input label="Nombre" type="text" />)

    const input = screen.getByLabelText('Nombre')
    expect(input.className).not.toMatch(/inputFile/)
  })
})
