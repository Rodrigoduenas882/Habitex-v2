import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { expect, type Page } from '@playwright/test'
import { expectRentalCardTenant, findRentalCard, type DisposableStack } from './habitex-ui-flows.js'

// Contract-specific real-UI flows for scenario #5 (rental contracts:
// HABITEX origin GENERATED -> [SHARED optional] -> SIGNED -> TERMINATED;
// EXTERNAL origin straight to SIGNED -> TERMINATED). Kept separate from
// habitex-ui-flows.ts/habitex-invitation-flows.ts/habitex-charges-payments-flows.ts
// (used only by this scenario's own spec file) - same precedent as those
// files' own header comments on when shared extraction is warranted versus
// premature.
//
// markShared/terminate have NO RPC backing them - they are plain, RLS-guarded
// direct UPDATEs (see src/features/contracts/domain/contract.types.ts's own
// ContractRepository doc comment: contracts_update RLS + a client-side
// `.eq('status', ...)` guard against a stale/racing transition). These
// helpers drive the exact same real UI buttons regardless - the absence of
// an RPC is a backend implementation detail, invisible from here.

/** A small, deterministic in-memory file - never written to disk, never a
 * fixture committed to the repo. `label` + a timestamp keep the bytes
 * distinguishable across calls within the same test, which also makes the
 * SHA-256 verification below meaningful (not just hashing an empty/constant
 * buffer). */
export interface InMemoryTestFile {
  name: string
  mimeType: string
  buffer: Buffer
}

export function createInMemoryTestFile(label: string): InMemoryTestFile {
  return {
    name: `${label}.pdf`,
    mimeType: 'application/pdf',
    buffer: Buffer.from(`Contenido de prueba E2E - ${label} - ${Date.now()}-${Math.random()}`, 'utf-8'),
  }
}

/** The exact SHA-256 hex digest `computeSha256Hex` (src/features/contracts/domain/sha256.ts)
 * would compute in the browser for the same bytes - used to verify, via a
 * direct read-only DB check, that the value actually persisted in
 * contracts.document_hash matches the real file content end-to-end, not
 * just a success message. */
export function sha256HexOfBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Navigates to a rental's "Contratos" sub-page through the REAL list
 * (RentalListCard's own "Contratos" button, visible only once
 * ACTIVE/ENDING/ENDED), always starting fresh from /rentals - same
 * principle as habitex-charges-payments-flows.ts's own goToRentalSection,
 * kept local here rather than importing/widening that one (this round is
 * scoped to new files only). */
export async function goToContracts(
  page: Page,
  { propertyName, tenantName }: { propertyName: string; tenantName: string },
): Promise<void> {
  await page.goto('/rentals')
  const card = findRentalCard(page, propertyName, tenantName)
  await expectRentalCardTenant(card, tenantName)
  await card.getByRole('button', { name: 'Contratos' }).click()
  await page.waitForURL('**/contracts')
}

/** "Registrar contrato Habitex" (register_habitex_generated_contract) -
 * uploads `file` as the document, always lands the new contract at
 * GENERATED, version_number = max(existing)+1 for this relationship. */
export async function registerHabitexContract(page: Page, file: InMemoryTestFile): Promise<void> {
  await page.getByLabel('Documento del contrato').setInputFiles(file)
  await page.getByRole('button', { name: 'Registrar contrato', exact: true }).click()
}

/** "Registrar contrato externo firmado" (register_external_signed_contract) -
 * uploads `file` as the already-signed copy, always lands the new contract
 * directly at SIGNED (never GENERATED/SHARED). */
export async function registerExternalContract(page: Page, file: InMemoryTestFile): Promise<void> {
  await page.getByLabel('Documento firmado').setInputFiles(file)
  await page.getByRole('button', { name: 'Registrar contrato externo', exact: true }).click()
}

/** "Marcar como compartido" - GENERATED -> SHARED. Optional step (see this
 * file's own header comment): attach_signed_contract_copy accepts GENERATED
 * or SHARED, so a test may skip straight from GENERATED to SIGNED. */
export async function markContractShared(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Marcar como compartido', exact: true }).click()
}

/** "Adjuntar copia firmada" - GENERATED|SHARED -> SIGNED, uploading `file` as
 * the signed copy. */
export async function attachSignedCopy(page: Page, file: InMemoryTestFile): Promise<void> {
  await page.getByLabel('Archivo de la copia firmada').setInputFiles(file)
  await page.getByRole('button', { name: 'Adjuntar copia firmada', exact: true }).click()
}

/** "Terminar contrato" - SIGNED -> TERMINATED, two-step confirmation
 * (TerminateContractAction's own doc comment: the first click only flips
 * local UI state, "Confirmar terminación" is the real action). */
export async function terminateContract(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Terminar contrato', exact: true }).click()
  await page.getByRole('button', { name: 'Confirmar terminación', exact: true }).click()
}

/**
 * Independent, read-only verification using an administrator's own real,
 * authenticated session (anon key + signInWithPassword) - never
 * service_role. Same dual-layer precedent as scenario #3/#4's own
 * readOwnAccountLink/readVisibleRentalRelationships/readVisibleCharges.
 */
async function signInAsAdministrator(stack: DisposableStack, credentials: { email: string; password: string }) {
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword(credentials)
  expect(signIn.error, signIn.error?.message).toBeNull()
  return supabase
}

export interface ContractRow {
  id: string
  versionNumber: number
  origin: string
  status: string
  documentHash: string | null
}

/** Reads every contract of ONE specific relationship, ordered by
 * version_number - used to verify real persistence (version sequencing,
 * origin/status, and document_hash integrity) beyond what badges/success
 * messages alone show. */
export async function readContractsForRelationship(
  stack: DisposableStack,
  credentials: { email: string; password: string },
  relationshipId: string,
): Promise<ContractRow[]> {
  const supabase = await signInAsAdministrator(stack, credentials)
  const { data, error } = await supabase
    .from('contracts')
    .select('id, version_number, origin, status, document_hash')
    .eq('rental_relationship_id', relationshipId)
    .order('version_number', { ascending: true })
  expect(error, error?.message).toBeNull()

  return (data ?? []).map((row) => ({
    id: row.id as string,
    versionNumber: row.version_number as number,
    origin: row.origin as string,
    status: row.status as string,
    documentHash: (row.document_hash as string | null) ?? null,
  }))
}

/** Unfiltered read of every contract visible to this session - RLS
 * (contracts_select -> can_view_relationship) alone decides what comes
 * back. Used only for scenario #4-style isolation checks (there is no
 * dedicated UI for "every contract across my administrations", mirroring
 * readVisibleCharges/readVisiblePayments's own precedent). */
export async function readVisibleContracts(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<Array<{ id: string; rentalRelationshipId: string }>> {
  const supabase = await signInAsAdministrator(stack, credentials)
  const { data, error } = await supabase.from('contracts').select('id, rental_relationship_id')
  expect(error, error?.message).toBeNull()

  return (data ?? []).map((row) => ({ id: row.id as string, rentalRelationshipId: row.rental_relationship_id as string }))
}
