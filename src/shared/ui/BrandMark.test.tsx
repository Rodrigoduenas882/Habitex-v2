import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandMark } from './BrandMark'

describe('BrandMark', () => {
  it('renders the approved mark asset, decorative by default (no aria-label)', () => {
    render(<BrandMark />)

    const mark = document.querySelector('img')
    expect(mark).toHaveAttribute('src', '/images/brand/habitex-mark.png')
    // Empty alt (not aria-hidden) is the standard way to mark an image
    // decorative - assistive tech skips it, but it isn't removed outright.
    expect(mark).toHaveAttribute('alt', '')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('becomes an accessible image when used on its own with aria-label', () => {
    render(<BrandMark aria-label="Habitex" />)

    expect(screen.getByRole('img', { name: 'Habitex' })).toBeInTheDocument()
  })

  it('honors a custom size', () => {
    render(<BrandMark size={64} aria-label="Habitex" />)

    const mark = screen.getByRole('img', { name: 'Habitex' })
    expect(mark).toHaveAttribute('width', '64')
    expect(mark).toHaveAttribute('height', '64')
  })
})
