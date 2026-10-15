// Deterministic seed for the authenticated E2E visual baseline.
//
// Creates ONE disposable owner account + a minimal, representative dataset
// against a LOCAL Supabase stack only (`pnpm exec supabase start`) - never
// the remote project. Every write goes through the exact same RPCs/tables
// the real app uses (never a schema/RLS bypass, never service_role): a real
// signUp, bootstrap_account, create_full_property_asset, create_rental_draft,
// a direct rental_relationships/rental_term_versions write (the same two
// operations RentalRepository.updateSchedule/RentalTermsRepository.create
// perform), activate_rental_relationship, generate_rent_charges,
// report_payment, confirm_payment, allocate_payment, issue_receipt.
//
// Run with: node --env-file=.env.e2e-local scripts/e2e-local-seed.mjs
//
// Not fully idempotent (properties/rentals are created unconditionally on
// each run) - bootstrap_account itself IS idempotent (returns the existing
// account if one already exists for this email), so the script exits early
// with a clear message instead of creating duplicate properties/rentals on a
// second run. To re-seed cleanly, run `pnpm exec supabase db reset` first.

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
const USER_EMAIL = process.env.E2E_LOCAL_USER_EMAIL
const USER_PASSWORD = process.env.E2E_LOCAL_USER_PASSWORD

function failClosed(condition, message) {
  if (!condition) {
    console.error(`[e2e-local-seed] REFUSING TO RUN: ${message}`)
    process.exit(1)
  }
}

failClosed(Boolean(SUPABASE_URL), 'VITE_SUPABASE_URL is not set (see .env.e2e-local.example).')
failClosed(
  SUPABASE_URL.includes('127.0.0.1') || SUPABASE_URL.includes('localhost'),
  `VITE_SUPABASE_URL ("${SUPABASE_URL}") does not look like a local Supabase stack. ` +
    'This script only ever runs against 127.0.0.1/localhost - never a remote project.',
)
failClosed(Boolean(SUPABASE_PUBLISHABLE_KEY), 'VITE_SUPABASE_PUBLISHABLE_KEY is not set.')
failClosed(Boolean(USER_EMAIL) && Boolean(USER_PASSWORD), 'E2E_LOCAL_USER_EMAIL/E2E_LOCAL_USER_PASSWORD are not set.')

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function firstRow(data) {
  return Array.isArray(data) ? (data[0] ?? null) : data
}

async function rpc(name, args) {
  const response = await supabase.rpc(name, args)
  if (response.error) {
    throw new Error(`${name} failed: ${response.error.message}`)
  }
  return response.data
}

console.log(`[e2e-local-seed] Signing up ${USER_EMAIL} against ${SUPABASE_URL} ...`)
const signUp = await supabase.auth.signUp({ email: USER_EMAIL, password: USER_PASSWORD })
if (signUp.error) {
  const alreadyRegistered = signUp.error.status === 422 || /already registered/i.test(signUp.error.message)
  if (alreadyRegistered) {
    console.log(
      '[e2e-local-seed] This email is already registered on the local stack - exiting without creating ' +
        'properties/rentals, to avoid duplicates. Run `pnpm exec supabase db reset` first to re-seed cleanly.',
    )
    process.exit(0)
  }
  throw new Error(`signUp failed: ${signUp.error.message}`)
}
failClosed(Boolean(signUp.data.session), 'signUp did not return an immediate session (unexpected locally).')

console.log('[e2e-local-seed] Bootstrapping account/administration ...')
const bootstrap = firstRow(
  await rpc('bootstrap_account', {
    p_full_name: 'Admin E2E Local',
    p_administration_name: 'Administración E2E Local',
  }),
)

if (bootstrap.created === false) {
  console.log(
    '[e2e-local-seed] This user already has an account/administration - exiting without creating ' +
      'properties/rentals, to avoid duplicates. Run `pnpm exec supabase db reset` first to re-seed cleanly.',
  )
  process.exit(0)
}

const administrationId = bootstrap.administration_id
console.log(`[e2e-local-seed] administrationId=${administrationId}`)

async function createRental({ propertyName, rentAmount, tenantName }) {
  console.log(`[e2e-local-seed] Creating property "${propertyName}" ...`)
  const subjectRow = firstRow(
    await rpc('create_full_property_asset', {
      p_administration_id: administrationId,
      p_property_type: 'APARTMENT',
      p_name: propertyName,
      p_city: 'Bogotá',
      p_address: 'Calle 1 # 2-3',
      p_country_code: 'CO',
      p_has_administration: false,
      p_administration_fee: null,
    }),
  )
  const rentalSubjectId = subjectRow.id

  console.log(`[e2e-local-seed] Creating rental draft for tenant "${tenantName}" ...`)
  const draft = firstRow(
    await rpc('create_rental_draft', {
      p_administration_id: administrationId,
      p_rental_subject_id: rentalSubjectId,
      p_tenant_person_id: null,
      p_tenant_full_name: tenantName,
      p_tenant_document_type: 'CC',
      p_tenant_document_number: String(Math.floor(10000000 + Math.random() * 89999999)),
      p_tenant_document_country: 'CO',
      p_tenant_nationality_country: 'CO',
      p_tenant_email: null,
      p_tenant_phone: null,
    }),
  )
  const rentalRelationshipId = draft.rental_relationship_id

  console.log('[e2e-local-seed] Setting the rental schedule ...')
  const today = new Date()
  const realStartDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
  const { error: scheduleError } = await supabase
    .from('rental_relationships')
    .update({
      real_start_date: realStartDate,
      tracking_start_date: realStartDate,
      payment_day: 5,
      payment_timing: 'ARREARS',
      expected_end_date: null,
    })
    .eq('id', rentalRelationshipId)
  if (scheduleError) throw new Error(`rental_relationships update failed: ${scheduleError.message}`)

  console.log('[e2e-local-seed] Creating the initial rental term version ...')
  const { error: termsError } = await supabase.from('rental_term_versions').insert({
    rental_relationship_id: rentalRelationshipId,
    version_number: 1,
    effective_from: realStartDate,
    effective_until: null,
    rent_amount: rentAmount,
    administration_mode: 'NONE',
    utilities_mode: 'TENANT',
  })
  if (termsError) throw new Error(`rental_term_versions insert failed: ${termsError.message}`)

  console.log('[e2e-local-seed] Activating the rental ...')
  await rpc('activate_rental_relationship', { p_relationship_id: rentalRelationshipId })

  console.log('[e2e-local-seed] Generating the current month rent charge ...')
  const charges = await rpc('generate_rent_charges', { p_relationship_id: rentalRelationshipId })
  const chargeId = firstRow(charges)?.id
  failClosed(Boolean(chargeId), `generate_rent_charges returned no charge for ${propertyName}.`)

  return { rentalRelationshipId, chargeId, rentAmount }
}

const paid = await createRental({
  propertyName: 'Apartamento 302',
  rentAmount: 1_500_000,
  tenantName: 'Camila Restrepo',
})

console.log('[e2e-local-seed] Reporting, confirming and allocating a payment, then issuing a receipt ...')
const payment = firstRow(
  await rpc('report_payment', {
    p_relationship_id: paid.rentalRelationshipId,
    p_amount: paid.rentAmount,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_method: 'BANK_TRANSFER',
    p_reference: 'E2E-LOCAL-SEED',
    p_proof_file_id: null,
    p_notes: 'Pago sembrado por el baseline visual local.',
  }),
)
await rpc('confirm_payment', { p_payment_id: payment.id })
await rpc('allocate_payment', {
  p_payment_id: payment.id,
  p_charge_id: paid.chargeId,
  p_amount: paid.rentAmount,
})
await rpc('issue_receipt', { p_payment_id: payment.id })

const pending = await createRental({
  propertyName: 'Casa 14 — Barrio Laureles',
  rentAmount: 1_200_000,
  tenantName: 'Julián Gómez',
})

console.log('[e2e-local-seed] Reporting (not confirming) a second payment, for the Dashboard attention panel ...')
await rpc('report_payment', {
  p_relationship_id: pending.rentalRelationshipId,
  p_amount: pending.rentAmount,
  p_payment_date: new Date().toISOString().slice(0, 10),
  p_method: 'CASH',
  p_reference: null,
  p_proof_file_id: null,
  p_notes: null,
})

const output = {
  administrationId,
  paidRentalRelationshipId: paid.rentalRelationshipId,
  pendingRentalRelationshipId: pending.rentalRelationshipId,
}
mkdirSync('e2e-authenticated', { recursive: true })
writeFileSync('e2e-authenticated/.seed-output.json', JSON.stringify(output, null, 2))
console.log('[e2e-local-seed] Done. Wrote e2e-authenticated/.seed-output.json:', output)
