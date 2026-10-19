import { expect, test } from '@playwright/test'
import {
  attachSignedCopy,
  createInMemoryTestFile,
  goToContracts,
  markContractShared,
  readContractsForRelationship,
  readVisibleContracts,
  registerExternalContract,
  registerHabitexContract,
  sha256HexOfBuffer,
  terminateContract,
} from './support/habitex-contracts-flows.js'
import { readVisibleRentalRelationships } from './support/habitex-invitation-flows.js'
import {
  completeRentalTerms,
  createProperty,
  createRentalDraft,
  expectNoPageErrors,
  expectRentalCardTenant,
  findRentalCard,
  signUpAndBootstrap,
  verifyDisposableStack,
} from './support/habitex-ui-flows.js'

// Rental contracts (register_habitex_generated_contract /
// register_external_signed_contract / attach_signed_contract_copy / direct
// RLS-guarded UPDATEs for markShared+terminate) through the REAL UI,
// against a disposable, isolated local Supabase stack - never the shared
// dev stack, never remote. Every write is driven by the actual app
// forms/buttons, never a direct RPC/SQL call, never service_role.
//
// Each test signs up its OWN brand-new account(s) (unique email/RUN_ID) and
// creates its own property/draft/rental - no shared fixtures, no order
// dependency, no reuse of data across tests or across this suite's other
// spec files. Uploaded files are small, deterministic, in-memory buffers -
// never written to disk, never a fixture committed to the repo.

const stack = await verifyDisposableStack()

function uniqueRunId() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
}

test('registra un contrato Habitex y recorre su ciclo de vida completo hasta terminarlo', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-contracts-cycle-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-ContractsCycle-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Ciclo Contrato ${RUN_ID}`
  const TENANT_NAME = `Inquilino Ciclo Contrato ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Ciclo Contrato',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 12 # 34-56', city: 'Bogotá' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: '2026-11-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await goToContracts(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await expect(page.getByText('Todavía no hay contratos registrados para este arriendo.')).toBeVisible()

  // --- Registrar contrato Habitex: nace en GENERADO, versión 1. ---
  const documentFile = createInMemoryTestFile('contrato-habitex')
  await registerHabitexContract(page, documentFile)
  await expect(page.getByText('Generado', { exact: true })).toBeVisible()
  await expect(page.getByText('Versión 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Generado en Habitex', { exact: true })).toBeVisible()
  await expect(page.getByText('Descargar documento')).toBeVisible()

  // --- Marcar como compartido: GENERADO -> COMPARTIDO (UPDATE directo, sin RPC). ---
  await markContractShared(page)
  await expect(page.getByText('Compartido', { exact: true })).toBeVisible()

  // --- Adjuntar copia firmada: COMPARTIDO -> FIRMADO, con ambos documentos referenciados. ---
  const signedFile = createInMemoryTestFile('contrato-habitex-firmado')
  await attachSignedCopy(page, signedFile)
  await expect(page.getByText('Firmado', { exact: true })).toBeVisible()
  await expect(page.getByText('Descargar documento')).toBeVisible()
  await expect(page.getByText('Descargar copia firmada')).toBeVisible()

  // --- Persistencia real: recargar y confirmar que el estado sobrevive, no solo el mensaje de éxito. ---
  await page.reload()
  await expect(page.getByText('Firmado', { exact: true })).toBeVisible()
  await expect(page.getByText('Descargar copia firmada')).toBeVisible()

  // --- Verificación read-only del hash SHA-256 real, con la propia sesión del administrador. ---
  const relationships = await readVisibleRentalRelationships(stack, { email: OWNER_EMAIL, password: OWNER_PASSWORD })
  expect(relationships).toHaveLength(1)
  const relationshipId = relationships[0]?.id
  if (!relationshipId) {
    throw new Error('Expected exactly one visible rental relationship for this administration')
  }

  const contracts = await readContractsForRelationship(stack, { email: OWNER_EMAIL, password: OWNER_PASSWORD }, relationshipId)
  expect(contracts).toHaveLength(1)
  expect(contracts[0]?.status).toBe('SIGNED')
  expect(contracts[0]?.origin).toBe('HABITEX')
  expect(
    contracts[0]?.documentHash,
    'Expected contracts.document_hash to match the real SHA-256 of the uploaded document bytes',
  ).toBe(sha256HexOfBuffer(documentFile.buffer))

  // --- Terminar contrato (confirmación de dos pasos) y verificar ausencia de acciones. ---
  await terminateContract(page)
  await expect(page.getByText('Terminado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Marcar como compartido', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adjuntar copia firmada', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Terminar contrato', exact: true })).toHaveCount(0)

  // --- Persistencia real tras terminar. ---
  await page.reload()
  await expect(page.getByText('Terminado', { exact: true })).toBeVisible()

  expectNoPageErrors(pageErrors)
})

test('registra un contrato externo firmado y lo termina', async ({ page }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-contracts-external-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-ContractsExternal-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Contrato Externo ${RUN_ID}`
  const TENANT_NAME = `Inquilino Contrato Externo ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Contrato Externo',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 45 # 67-89', city: 'Medellín' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: '2026-11-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await goToContracts(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })

  // --- Registrar contrato externo: nace DIRECTO en FIRMADO, nunca pasa por Generado/Compartido. ---
  const signedFile = createInMemoryTestFile('contrato-externo')
  await registerExternalContract(page, signedFile)
  await expect(page.getByText('Firmado', { exact: true })).toBeVisible()
  await expect(page.getByText('Versión 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Externo', { exact: true })).toBeVisible()
  await expect(page.getByText('Generado', { exact: true })).not.toBeVisible()
  await expect(page.getByText('Compartido', { exact: true })).not.toBeVisible()
  // EXTERNAL nunca tiene documentFileId - solo signedFileId.
  await expect(page.getByText('Descargar documento')).not.toBeVisible()
  await expect(page.getByText('Descargar copia firmada')).toBeVisible()

  await terminateContract(page)
  await expect(page.getByText('Terminado', { exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Terminado', { exact: true })).toBeVisible()

  expectNoPageErrors(pageErrors)
})

test('permite que un contrato Habitex y uno externo convivan en la misma relación con versiones consecutivas', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_EMAIL = `e2e-contracts-coexist-${RUN_ID}@habitex.test`
  const OWNER_PASSWORD = `Habitex-E2E-ContractsCoexist-${RUN_ID}!`
  const PROPERTY_NAME = `Apartamento Convivencia ${RUN_ID}`
  const TENANT_NAME = `Inquilino Convivencia ${RUN_ID}`

  await signUpAndBootstrap(page, stack, {
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    fullName: 'Propietaria E2E Convivencia',
  })
  await createProperty(page, { name: PROPERTY_NAME, address: 'Calle 78 # 90-12', city: 'Cali' })
  await createRentalDraft(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_NAME,
    tenantName: TENANT_NAME,
    realStartDate: '2026-11-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCard = findRentalCard(page, PROPERTY_NAME, TENANT_NAME)
  await expectRentalCardTenant(rentalCard, TENANT_NAME)
  await rentalCard.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCard).toContainText('Activo')

  await goToContracts(page, { propertyName: PROPERTY_NAME, tenantName: TENANT_NAME })

  const habitexFile = createInMemoryTestFile('convivencia-habitex')
  await registerHabitexContract(page, habitexFile)
  await expect(page.getByText('Versión 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Generado', { exact: true })).toBeVisible()

  const externalFile = createInMemoryTestFile('convivencia-externo')
  await registerExternalContract(page, externalFile)
  await expect(page.getByText('Versión 2', { exact: true })).toBeVisible()
  await expect(page.getByText('Firmado', { exact: true })).toBeVisible()

  // --- Ninguno sobrescribe al otro: ambos siguen visibles simultáneamente, cada uno con su propio origen/estado. ---
  await expect(page.getByText('Versión 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Generado', { exact: true })).toBeVisible()
  await expect(page.getByText('Generado en Habitex', { exact: true })).toBeVisible()
  await expect(page.getByText('Versión 2', { exact: true })).toBeVisible()
  await expect(page.getByText('Externo', { exact: true })).toBeVisible()

  // --- Verificación read-only de la numeración de versión y del aislamiento entre ambos registros. ---
  const relationships = await readVisibleRentalRelationships(stack, { email: OWNER_EMAIL, password: OWNER_PASSWORD })
  expect(relationships).toHaveLength(1)
  const relationshipId = relationships[0]?.id
  if (!relationshipId) {
    throw new Error('Expected exactly one visible rental relationship for this administration')
  }

  const contracts = await readContractsForRelationship(stack, { email: OWNER_EMAIL, password: OWNER_PASSWORD }, relationshipId)
  expect(contracts).toHaveLength(2)
  expect(contracts[0]).toMatchObject({ versionNumber: 1, origin: 'HABITEX', status: 'GENERATED' })
  expect(contracts[1]).toMatchObject({ versionNumber: 2, origin: 'EXTERNAL', status: 'SIGNED' })

  expectNoPageErrors(pageErrors)
})

test('aísla la información contractual de una administración frente a otra', async ({ page, browser }) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => {
    pageErrors.push(error)
  })

  const RUN_ID = uniqueRunId()
  const OWNER_A_EMAIL = `e2e-contracts-isolationA-${RUN_ID}@habitex.test`
  const OWNER_A_PASSWORD = `Habitex-E2E-ContractsIsolationA-${RUN_ID}!`
  const OWNER_B_EMAIL = `e2e-contracts-isolationB-${RUN_ID}@habitex.test`
  const OWNER_B_PASSWORD = `Habitex-E2E-ContractsIsolationB-${RUN_ID}!`
  const PROPERTY_A = `Apartamento Aislamiento Contrato A ${RUN_ID}`
  const TENANT_A = `Inquilino Aislamiento Contrato A ${RUN_ID}`

  // --- Administración A: un contrato real registrado (nunca una prueba vacía). ---
  await signUpAndBootstrap(page, stack, {
    email: OWNER_A_EMAIL,
    password: OWNER_A_PASSWORD,
    fullName: 'Propietaria E2E Aislamiento Contrato A',
  })
  await createProperty(page, { name: PROPERTY_A, address: 'Calle 33 # 44-55', city: 'Barranquilla' })
  await createRentalDraft(page, { propertyName: PROPERTY_A, tenantName: TENANT_A })
  await completeRentalTerms(page, {
    propertyName: PROPERTY_A,
    tenantName: TENANT_A,
    realStartDate: '2026-11-01',
    paymentDay: '5',
    rentAmount: '1500000',
  })

  const rentalCardA = findRentalCard(page, PROPERTY_A, TENANT_A)
  await expectRentalCardTenant(rentalCardA, TENANT_A)
  await rentalCardA.getByRole('button', { name: 'Activar' }).click()
  await expect(rentalCardA).toContainText('Activo')

  await goToContracts(page, { propertyName: PROPERTY_A, tenantName: TENANT_A })
  const file = createInMemoryTestFile('aislamiento-habitex')
  await registerHabitexContract(page, file)
  await expect(page.getByText('Generado', { exact: true })).toBeVisible()

  // --- Captura, con la propia sesión real de A, el id de SU relación - ninguna UI expone este id crudo. ---
  const relationshipsA = await readVisibleRentalRelationships(stack, { email: OWNER_A_EMAIL, password: OWNER_A_PASSWORD })
  expect(relationshipsA).toHaveLength(1)
  const relationshipAId = relationshipsA[0]?.id
  expect(relationshipAId).toBeTruthy()

  // --- Administración B: cuenta y contexto de navegador completamente independientes, sin ningún arriendo propio. ---
  const administrationBContext = await browser.newContext()
  const administrationBPage = await administrationBContext.newPage()
  administrationBPage.on('pageerror', (error) => {
    pageErrors.push(error)
  })
  await signUpAndBootstrap(administrationBPage, stack, {
    email: OWNER_B_EMAIL,
    password: OWNER_B_PASSWORD,
    fullName: 'Propietaria E2E Aislamiento Contrato B',
  })

  // --- Denegación por UI: B navega directamente a los contratos de A y la página real responde "no encontrado". ---
  await administrationBPage.goto(`/rentals/${relationshipAId}/contracts`)
  await expect(administrationBPage.getByText('No encontramos este arriendo en tu administración.')).toBeVisible()

  // --- Refuerzo: lectura read-only directa con la sesión real de B (clave pública, nunca service_role). ---
  const contractsVisibleToB = await readVisibleContracts(stack, { email: OWNER_B_EMAIL, password: OWNER_B_PASSWORD })
  expect(contractsVisibleToB.some((contract) => contract.rentalRelationshipId === relationshipAId)).toBe(false)

  await administrationBContext.close()
  expectNoPageErrors(pageErrors)
})
