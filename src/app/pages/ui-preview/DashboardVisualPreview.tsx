import { useState } from 'react'
import { DashboardContent, type DashboardContentProps } from '@/features/dashboard/presentation/DashboardPage'
import type { Charge } from '@/features/charges/domain/charge.types'
import type { Payment } from '@/features/payments/domain/payment.types'
import type { Property } from '@/features/properties/domain/property.types'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'
import { AppShellPreview } from './AppShellPreview'
import styles from './DashboardVisualPreview.module.css'

// Design fixtures only. Never consumed by the authenticated Dashboard route.
const properties: Property[] = ['Apartamento 302 · Rosales', 'Casa 14 · El Retiro', 'Apartamento 501 · Cedritos'].map((name, i) => ({
  id: 'demo-property-' + String(i), administrationId: 'demo', name, propertyType: i === 1 ? 'HOUSE' : 'APARTMENT', rentalMode: 'FULL_PROPERTY', countryCode: 'CO', city: 'Bogotá', address: ['Carrera 7 # 72-35', 'Calle 85 # 12-18', 'Carrera 19 # 142-30'][i] ?? '', hasAdministration: false, administrationFee: null,
}))
const payments: Payment[] = [1250000, 980000, 1600000].map((amount, i) => ({
  id: 'demo-payment-' + String(i), administrationId: 'demo', rentalRelationshipId: 'demo-rental-' + String(i), reportedByPersonId: null, confirmedByPersonId: null, status: 'REPORTED', amount, currency: 'COP', paymentDate: '2026-11-0' + String(i + 1), paymentMethod: 'BANK_TRANSFER', externalReference: null, proofFileId: null, notes: null, reportedAt: '', confirmedAt: null, rejectedAt: null, rejectionReason: null, createdAt: '', updatedAt: '',
}))
const overdue: Charge = {
  id: 'demo-charge-1', administrationId: 'demo', rentalRelationshipId: 'demo-rental-1',
  chargeType: 'RENT', origin: 'SYSTEM', description: 'Arriendo de demostración',
  periodStart: null, periodEnd: null, dueDate: '2026-10-25', amount: 980000,
  currency: 'COP', sourceType: null, sourceId: null, createdAt: '',
  paidAmount: 0, balance: 980000, financialStatus: 'OVERDUE',
}
export default function DashboardVisualPreview() {
  const [empty, setEmpty] = useState(false)
  const data: DashboardContentProps = {
    name: 'Rodrigo',
    propertiesQuery: { data: empty ? [] : properties, isLoading: false, isError: false },
    occupancy: { status: 'ready', occupiedUnits: empty ? 0 : 2, totalUnits: empty ? 0 : 3, percentage: empty ? null : 67 },
    financials: { status: 'ready', monthlyIncome: empty ? 0 : 4100000, monthlyReceivable: empty ? 0 : 2150000, monthlySeries: ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov'].map((label, i) => ({ label, income: empty ? 0 : [2900000, 3400000, 3150000, 3800000, 3650000, 4100000][i] ?? 0 })) },
    identities: { status: 'ready', byRelationshipId: new Map(properties.map((property, i) => [
      'demo-rental-' + String(i), { subjectLabel: property.name, tenantName: null, rentAmount: null },
    ])) },
    overdueChargesQuery: { isLoading: false, isError: false, data: empty ? [] : [overdue] },
    attention: { status: 'ready', reportedPayments: empty ? [] : payments },
    propertyOccupancy: { status: 'ready', byPropertyId: new Map(properties.map((property, i) => [property.id, { isOccupied: i !== 2, occupiedRooms: 0, totalRooms: 0 }])) },
  }
  return <AppShellPreview fullViewport>
    <div className={styles['notice']}>
      <Alert tone="info" title="Vista de demostración · Dashboard">Todos los importes, pagos e inmuebles de esta vista son ficticios. Las acciones de navegación llevan a rutas reales que requieren sesión.</Alert>
      <Button variant="secondary" size="sm" aria-pressed={empty} onClick={() => { setEmpty(!empty) }}>{empty ? 'Ver datos de demostración' : 'Ver estados vacíos'}</Button>
    </div>
    <DashboardContent {...data} />
  </AppShellPreview>
}
