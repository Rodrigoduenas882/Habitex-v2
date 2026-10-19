import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { expect } from '@playwright/test'
import type { DisposableStack } from './habitex-ui-flows.js'

// Direct-RPC flows for scenario #7 (report_payment idempotency). Unlike
// every other support file in this suite, several helpers here call
// report_payment DIRECTLY (never through the UI) with a real, authenticated
// administrator session (anon key + signInWithPassword) - never
// service_role. This is a deliberate, scoped exception to this suite's own
// "business actions go through the real UI" convention: retrying with an
// EXPLICIT, caller-controlled idempotency key, and two genuinely
// simultaneous requests, are exactly the two things a human clicking a
// button in a browser cannot reliably reproduce on demand. The RPC call
// itself is byte-for-byte what the browser's own fetch to PostgREST would
// send for the same real session - this never bypasses RLS or any
// authorization check report_payment itself performs.

async function signInAsAdministrator(
  stack: DisposableStack,
  credentials: { email: string; password: string },
): Promise<SupabaseClient> {
  const supabase = createClient(stack.url, stack.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await supabase.auth.signInWithPassword(credentials)
  expect(signIn.error, signIn.error?.message).toBeNull()
  return supabase
}

export interface ReportPaymentRpcInput {
  relationshipId: string
  amount: number
  paymentDate: string
  idempotencyKey: string
  method?: string
  reference?: string
  proofFileId?: string
  notes?: string
}

/** Calls report_payment directly with one administrator's real session -
 * returns the raw { data, error } response, never throwing, so callers can
 * assert on either outcome (including the expected IDEMPOTENCY_KEY_REUSED_
 * WITH_DIFFERENT_PAYLOAD error). */
export async function callReportPayment(
  stack: DisposableStack,
  credentials: { email: string; password: string },
  input: ReportPaymentRpcInput,
) {
  const supabase = await signInAsAdministrator(stack, credentials)
  return supabase.rpc('report_payment', {
    p_relationship_id: input.relationshipId,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_idempotency_key: input.idempotencyKey,
    p_method: input.method ?? null,
    p_reference: input.reference ?? null,
    p_proof_file_id: input.proofFileId ?? null,
    p_notes: input.notes ?? null,
  })
}

/** Fires two report_payment calls truly simultaneously (Promise.all, not
 * sequential awaits) using the SAME already-authenticated client for both -
 * the only way to exercise the primary-key-level race genuinely, never
 * simulated with mocks. */
export async function callReportPaymentTwiceConcurrently(
  stack: DisposableStack,
  credentials: { email: string; password: string },
  input: ReportPaymentRpcInput,
) {
  const supabase = await signInAsAdministrator(stack, credentials)
  const rpcArgs = {
    p_relationship_id: input.relationshipId,
    p_amount: input.amount,
    p_payment_date: input.paymentDate,
    p_idempotency_key: input.idempotencyKey,
    p_method: input.method ?? null,
    p_reference: input.reference ?? null,
    p_proof_file_id: input.proofFileId ?? null,
    p_notes: input.notes ?? null,
  }
  return Promise.all([supabase.rpc('report_payment', rpcArgs), supabase.rpc('report_payment', rpcArgs)])
}

/** Read-only verification of every payment visible for one relationship -
 * RLS (payments_select -> can_view_relationship) alone decides what comes
 * back. Used to confirm a retry/race never created a second row. */
export async function readPaymentsForRelationship(
  stack: DisposableStack,
  credentials: { email: string; password: string },
  relationshipId: string,
): Promise<Array<{ id: string; amount: number }>> {
  const supabase = await signInAsAdministrator(stack, credentials)
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount')
    .eq('rental_relationship_id', relationshipId)
  expect(error, error?.message).toBeNull()

  return (data ?? []).map((row) => ({ id: row.id as string, amount: row.amount as number }))
}
