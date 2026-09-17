import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import '@/infrastructure/i18n/i18n'
import { PropertiesOverview } from './PropertiesOverview'
import type { PropertySummary } from './dashboard-mock-data'

const properties: PropertySummary[] = [
  {
    id: 'p1',
    name: 'Apartamento 302',
    location: 'Chapinero, Bogotá',
    status: 'rented',
    detail: '3 habitaciones · 2 baños',
  },
  {
    id: 'p2',
    name: 'Casa 14',
    location: 'Laureles, Medellín',
    status: 'rented',
    detail: '4 habitaciones · 3 baños',
  },
]

/** jsdom never lays out real pixels, so scroll metrics stay 0 unless the
 * test asserts them explicitly - this simulates "the row has overflowing
 * content" at a given scroll position. */
function mockRowMetrics(
  row: HTMLElement,
  metrics: { scrollLeft: number; scrollWidth: number; clientWidth: number },
) {
  Object.defineProperty(row, 'scrollLeft', { value: metrics.scrollLeft, configurable: true })
  Object.defineProperty(row, 'scrollWidth', { value: metrics.scrollWidth, configurable: true })
  Object.defineProperty(row, 'clientWidth', { value: metrics.clientWidth, configurable: true })
}

describe('PropertiesOverview carousel', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps every property card and the trailing add-property card', () => {
    render(<PropertiesOverview properties={properties} />)

    expect(screen.getByText('Apartamento 302')).toBeInTheDocument()
    expect(screen.getByText('Casa 14')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agregar inmueble' })).toBeInTheDocument()
  })

  it('sin overflow: shows no controls and reserves no side gutter', () => {
    render(<PropertiesOverview properties={properties} />)

    expect(
      screen.queryByRole('button', { name: 'Ver inmuebles anteriores' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más inmuebles' })).not.toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).not.toMatch(/hasControls/)
  })

  it('inicio: shows only the "next" control, with the gutter reserved on both sides', () => {
    render(<PropertiesOverview properties={properties} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    expect(
      screen.queryByRole('button', { name: 'Ver inmuebles anteriores' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).toMatch(/hasControls/)
  })

  it('posición intermedia: shows both controls', () => {
    render(<PropertiesOverview properties={properties} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 300, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).toMatch(/hasControls/)
  })

  it('final: shows only the "previous" control', () => {
    render(<PropertiesOverview properties={properties} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 700, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más inmuebles' })).not.toBeInTheDocument()
    expect(screen.getByTestId('properties-carousel').className).toMatch(/hasControls/)
  })

  it('updates which controls are visible as the row scrolls across start/middle/end', () => {
    render(<PropertiesOverview properties={properties} />)
    const row = screen.getByTestId('properties-row')
    row.scrollBy = vi.fn()

    mockRowMetrics(row, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(
      screen.queryByRole('button', { name: 'Ver inmuebles anteriores' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()

    mockRowMetrics(row, { scrollLeft: 300, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver más inmuebles' })).toBeInTheDocument()

    mockRowMetrics(row, { scrollLeft: 700, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)
    expect(screen.getByRole('button', { name: 'Ver inmuebles anteriores' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver más inmuebles' })).not.toBeInTheDocument()
  })

  it('scrolls by about one card (the first card\'s measured width) when a control is clicked', () => {
    render(<PropertiesOverview properties={properties} />)
    const row = screen.getByTestId('properties-row')
    const scrollBySpy = vi.fn()
    row.scrollBy = scrollBySpy
    vi.spyOn(row.firstElementChild as Element, 'getBoundingClientRect').mockReturnValue({
      width: 240,
    } as DOMRect)

    mockRowMetrics(row, { scrollLeft: 300, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    fireEvent.click(screen.getByRole('button', { name: 'Ver más inmuebles' }))
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' })

    fireEvent.click(screen.getByRole('button', { name: 'Ver inmuebles anteriores' }))
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' })
  })

  it('scrolls instantly instead of smoothly when the user prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('reduce'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      })),
    )

    render(<PropertiesOverview properties={properties} />)
    const row = screen.getByTestId('properties-row')
    const scrollBySpy = vi.fn()
    row.scrollBy = scrollBySpy
    vi.spyOn(row.firstElementChild as Element, 'getBoundingClientRect').mockReturnValue({
      width: 240,
    } as DOMRect)

    mockRowMetrics(row, { scrollLeft: 0, scrollWidth: 1000, clientWidth: 300 })
    fireEvent.scroll(row)

    fireEvent.click(screen.getByRole('button', { name: 'Ver más inmuebles' }))
    expect(scrollBySpy).toHaveBeenLastCalledWith({ left: 240, behavior: 'auto' })
  })
})
