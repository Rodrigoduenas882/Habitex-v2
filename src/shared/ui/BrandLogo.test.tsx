import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandLogo } from './BrandLogo'

describe('BrandLogo', () => {
  it('renders the mark (decorative) plus the given name as visible text', () => {
    render(<BrandLogo name="Habitex" />)

    expect(screen.getByText('Habitex')).toBeInTheDocument()
    // The mark stays decorative here - the visible wordmark carries the
    // accessible name, so the two aren't announced twice.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('does not translate internally - it renders exactly the name it is given', () => {
    render(<BrandLogo name="Anything" />)

    expect(screen.getByText('Anything')).toBeInTheDocument()
  })
})
