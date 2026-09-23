import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  RentalActivationError,
  RentalRepositoryError,
  type CreateRentalDraftInput,
  type CreateRentalDraftResult,
  type PaymentTiming,
  type RentalRelationship,
  type RentalRepository,
  type RentalScheduleInput,
  type RentalStatus,
} from '../domain/rental.types'

interface RentalRow {
  id: string
  administration_id: string
  status: RentalStatus
  jurisdiction_country: string
  real_start_date: string | null
  tracking_start_date: string | null
  expected_end_date: string | null
  actual_end_date: string | null
  payment_day: number | null
  payment_timing: PaymentTiming | null
}

const RENTAL_COLUMNS =
  'id, administration_id, status, jurisdiction_country, real_start_date, tracking_start_date, expected_end_date, actual_end_date, payment_day, payment_timing'

function toRentalRelationship(row: RentalRow): RentalRelationship {
  return {
    id: row.id,
    administrationId: row.administration_id,
    status: row.status,
    jurisdictionCountry: row.jurisdiction_country,
    realStartDate: row.real_start_date,
    trackingStartDate: row.tracking_start_date,
    expectedEndDate: row.expected_end_date,
    actualEndDate: row.actual_end_date,
    paymentDay: row.payment_day,
    paymentTiming: row.payment_timing,
  }
}

interface CreateRentalDraftRow {
  rental_relationship_id: string
  tenant_person_id: string
}

/** create_rental_draft returns table(...), which PostgREST can serialize as
 * a one-element array or a single object depending on the client version -
 * handled defensively rather than assumed. */
function firstRow<T>(data: T | T[] | null): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data
}

/**
 * Translates activate_rental_relationship's bare exception string into our
 * own RentalActivationError so nothing above this repository ever depends
 * on the raw Postgres error message. Unmatched cases (every RPC exception
 * this increment doesn't distinguish in the UI - see RentalActivationError's
 * own doc comment) fall back to 'unknown' by design, same principle as
 * toSessionAuthError.
 */
function toRentalActivationError(error: { message: string }): RentalActivationError {
  if (error.message === 'MANAGEMENT_ACCESS_REQUIRED') {
    return new RentalActivationError('management_access_required', error)
  }

  if (error.message === 'RELATIONSHIP_CAPACITY_REACHED') {
    return new RentalActivationError('capacity_reached', error)
  }

  return new RentalActivationError('unknown', error)
}

function toRpcArgs(input: CreateRentalDraftInput) {
  const tenant = input.tenant
  return {
    p_administration_id: input.administrationId,
    p_rental_subject_id: input.rentalSubjectId,
    p_tenant_person_id: tenant.kind === 'existing' ? tenant.personId : null,
    p_tenant_full_name: tenant.kind === 'new' ? tenant.fullName : null,
    p_tenant_document_type: tenant.kind === 'new' ? tenant.documentType : null,
    p_tenant_document_number: tenant.kind === 'new' ? tenant.documentNumber : null,
    p_tenant_document_country: tenant.kind === 'new' ? tenant.documentCountry : null,
    p_tenant_nationality_country: tenant.kind === 'new' ? tenant.nationalityCountry : null,
    p_tenant_email: tenant.kind === 'new' ? tenant.email : null,
    p_tenant_phone: tenant.kind === 'new' ? tenant.phone : null,
  }
}

export const supabaseRentalRepository: RentalRepository = {
  async listByAdministration(administrationId: string) {
    // administration_id expresses this query's scope - RLS
    // (can_view_relationship(id)) remains the actual security authority
    // regardless of this filter. created_at is used only to order results
    // (PostgREST orders against the underlying column independently of the
    // select projection) - it is not part of the domain shape because
    // nothing here needs it.
    const { data, error } = await supabaseClient
      .from('rental_relationships')
      .select(RENTAL_COLUMNS)
      .eq('administration_id', administrationId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new RentalRepositoryError('Failed to list rental relationships for the administration', error)
    }

    return (data as RentalRow[]).map(toRentalRelationship)
  },

  async createDraft(input: CreateRentalDraftInput): Promise<CreateRentalDraftResult> {
    // LESSOR (current_person_id()), administration management access,
    // subject/administration ownership, tenant resolution (existing-linked
    // vs. new Person via create_tenant_person) and LESSOR != TENANT all
    // happen inside the RPC, atomically - no direct insert, no service
    // role, no bypass, no client-side compensation on partial failure.
    const response = await supabaseClient.rpc('create_rental_draft', toRpcArgs(input))

    if (response.error) {
      throw new RentalRepositoryError('Failed to create the rental draft', response.error)
    }

    const row = firstRow(response.data as CreateRentalDraftRow | CreateRentalDraftRow[] | null)
    if (!row) {
      throw new RentalRepositoryError('create_rental_draft returned no row')
    }

    return { rentalRelationshipId: row.rental_relationship_id, tenantPersonId: row.tenant_person_id }
  },

  async activate(relationshipId: string): Promise<RentalRelationship> {
    // MANAGEMENT_ACCESS_REQUIRED / RELATIONSHIP_CAPACITY_REACHED / DRAFT-only
    // / terms-complete / primary-subject / active-tenant / active-lessor /
    // initial-term-version / subject-not-already-occupied all happen inside
    // the RPC (SECURITY DEFINER), atomically - no direct update, no service
    // role, no bypass. RLS prevents a direct client UPDATE from ever setting
    // status to ACTIVE, so this RPC is the only real path regardless of what
    // any client-side gate computed beforehand.
    const response = await supabaseClient.rpc('activate_rental_relationship', {
      p_relationship_id: relationshipId,
    })

    if (response.error) {
      throw toRentalActivationError(response.error)
    }

    const row = firstRow(response.data as RentalRow | RentalRow[] | null)
    if (!row) {
      throw new RentalRepositoryError('activate_rental_relationship returned no row')
    }

    return toRentalRelationship(row)
  },

  async updateSchedule(relationshipId: string, input: RentalScheduleInput): Promise<RentalRelationship> {
    // Direct UPDATE, no RPC - RLS (rental_relationships_update_draft) is the
    // real authority: it rejects this outright unless the row is still
    // DRAFT and the caller can manage its administration. Same table
    // listByAdministration/activate already read, just a different
    // operation on it (see RentalRepository.updateSchedule's own doc
    // comment).
    const { data, error } = await supabaseClient
      .from('rental_relationships')
      .update({
        real_start_date: input.realStartDate,
        tracking_start_date: input.trackingStartDate,
        payment_day: input.paymentDay,
        payment_timing: input.paymentTiming,
        expected_end_date: input.expectedEndDate,
      })
      .eq('id', relationshipId)
      .select(RENTAL_COLUMNS)
      .single()

    if (error) {
      throw new RentalRepositoryError('Failed to update the rental relationship schedule', error)
    }

    return toRentalRelationship(data)
  },
}
