/**
 * Presentation-only preview data for the Dashboard Visual Foundation.
 *
 * There is no Account/Administration/Rentals/Payments integration yet - this
 * is a clearly isolated stand-in so the visual layer can be built and
 * evaluated now. Every component that consumes this expects the same shapes
 * a real data layer would eventually provide (see each type below), so
 * swapping this file for real queries later should not require changing the
 * components themselves.
 */

export interface DashboardKpi {
  key: 'monthlyIncome' | 'receivable' | 'occupancy' | 'properties'
  value: string
  tone: 'success' | 'warning' | 'info' | 'neutral'
  /** Short, optional context line - a real % delta/count once data exists. */
  trend?: string
  trendTone?: 'positive' | 'neutral'
}

export interface FinancialMonth {
  label: string
  income: number
  expenses: number
}

export interface AttentionItem {
  id: string
  /** Drives both the icon/tone and the translated title - never a free string. */
  kind: 'payment' | 'contract' | 'document'
  subtitle: string
  meta: string
}

export interface PropertySummary {
  id: string
  name: string
  location: string
  status: 'rented' | 'available'
  /** One short, useful secondary line - not a full detail dump. */
  detail: string
}

export const dashboardMockData = {
  kpis: [
    {
      key: 'monthlyIncome',
      value: '$3.850.000',
      tone: 'success',
      trend: '↑ 8,4% vs. mes anterior',
      trendTone: 'positive',
    },
    {
      key: 'receivable',
      value: '$950.000',
      tone: 'warning',
      trend: '2 pagos pendientes',
      trendTone: 'neutral',
    },
    {
      key: 'occupancy',
      value: '86%',
      tone: 'info',
      trend: '6 de 7 ocupados',
      trendTone: 'neutral',
    },
    { key: 'properties', value: '7', tone: 'neutral' },
  ] satisfies DashboardKpi[],

  financials: [
    { label: 'Abr', income: 3200000, expenses: 900000 },
    { label: 'May', income: 3400000, expenses: 1100000 },
    { label: 'Jun', income: 3100000, expenses: 950000 },
    { label: 'Jul', income: 3600000, expenses: 1200000 },
    { label: 'Ago', income: 3700000, expenses: 1000000 },
    { label: 'Sep', income: 3850000, expenses: 950000 },
  ] satisfies FinancialMonth[],

  attentionItems: [
    {
      id: 'attention-1',
      kind: 'payment',
      subtitle: 'Apartamento 302',
      meta: '$950.000',
    },
    {
      id: 'attention-2',
      kind: 'contract',
      subtitle: 'Casa 14 — Barrio Laureles',
      meta: '12 días',
    },
    {
      id: 'attention-3',
      kind: 'document',
      subtitle: 'Habitación 2',
      meta: 'Cédula del inquilino',
    },
  ] satisfies AttentionItem[],

  properties: [
    {
      id: 'property-1',
      name: 'Apartamento 302',
      location: 'Chapinero, Bogotá',
      status: 'rented',
      detail: '3 habitaciones · 2 baños',
    },
    {
      id: 'property-2',
      name: 'Casa 14',
      location: 'Laureles, Medellín',
      status: 'rented',
      detail: '4 habitaciones · 3 baños',
    },
    {
      id: 'property-3',
      name: 'Habitación 2',
      location: 'La Candelaria, Bogotá',
      status: 'available',
      detail: '1 habitación · baño compartido',
    },
    {
      id: 'property-4',
      name: 'Local comercial 5',
      location: 'Envigado, Antioquia',
      status: 'available',
      detail: '85 m² · uso comercial',
    },
  ] satisfies PropertySummary[],
} as const
