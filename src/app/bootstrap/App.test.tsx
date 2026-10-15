import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App bootstrap', () => {
  it('mounts providers and router, redirecting unauthenticated users to /login', async () => {
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Bienvenido de nuevo' }, { timeout: 5000 }),
    ).toBeInTheDocument()
  })
})
