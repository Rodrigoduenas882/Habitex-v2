import { Tabs, type TabItem } from '@/shared/ui/Tabs'
import { StateFullDashboard } from './StateFullDashboard'
import { StateHasProperties } from './StateHasProperties'
import { StateNewOwner } from './StateNewOwner'

const ITEMS: TabItem[] = [
  { value: 'new-owner', label: 'Nuevo propietario', content: <StateNewOwner /> },
  { value: 'has-properties', label: 'Con inmuebles', content: <StateHasProperties /> },
  { value: 'full-dashboard', label: 'Dashboard completo', content: <StateFullDashboard /> },
]

/**
 * Thin wrapper over the shared Tabs primitive (full roving-tabindex
 * keyboard support, see shared/ui/Tabs.tsx) - genuinely interactive, not a
 * static mockup: switching tabs swaps the rendered owner state.
 */
export function StateSwitcher() {
  return <Tabs items={ITEMS} ariaLabel="Estado del propietario" />
}
