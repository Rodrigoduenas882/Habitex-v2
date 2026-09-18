import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  RentalRepositoryError,
  type PaymentTiming,
  type RentalRelationship,
  type RentalRepository,
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
}
