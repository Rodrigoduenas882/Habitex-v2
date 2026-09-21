import { supabaseClient } from '@/infrastructure/supabase/client'
import {
  RentalSubjectRepositoryError,
  type RentalSubject,
  type RentalSubjectRepository,
  type RentalSubjectType,
} from '../domain/rental-subject.types'

interface RentalSubjectRow {
  id: string
  administration_id: string
  subject_type: RentalSubjectType
  property_id: string | null
  room_id: string | null
  parking_id: string | null
}

const RENTAL_SUBJECT_COLUMNS = 'id, administration_id, subject_type, property_id, room_id, parking_id'

/** Which real table/FK column/label column resolves a human label, per subjectType. */
const ASSET_LOOKUP = {
  FULL_PROPERTY: { table: 'properties', fkColumn: 'property_id', labelColumn: 'name' },
  ROOM: { table: 'rooms', fkColumn: 'room_id', labelColumn: 'name' },
  PARKING: { table: 'parkings', fkColumn: 'parking_id', labelColumn: 'identifier' },
} as const satisfies Record<RentalSubjectType, { table: string; fkColumn: keyof RentalSubjectRow; labelColumn: string }>

export const supabaseRentalSubjectRepository: RentalSubjectRepository = {
  async listByAdministration(administrationId, subjectType) {
    const { data, error } = await supabaseClient
      .from('rental_subjects')
      .select(RENTAL_SUBJECT_COLUMNS)
      .eq('administration_id', administrationId)
      .eq('subject_type', subjectType)

    if (error) {
      throw new RentalSubjectRepositoryError('Failed to list rental subjects for the administration', error)
    }

    const rows = data as RentalSubjectRow[]
    if (rows.length === 0) {
      return []
    }

    const { table, fkColumn, labelColumn } = ASSET_LOOKUP[subjectType]
    const assetIds = rows.map((row) => row[fkColumn]).filter((id): id is string => id != null)

    const { data: assets, error: assetsError } = await supabaseClient
      .from(table)
      .select(`id, ${labelColumn}`)
      .in('id', assetIds)

    if (assetsError) {
      throw new RentalSubjectRepositoryError(`Failed to resolve ${table} for rental subjects`, assetsError)
    }

    const labelById = new Map(
      (assets as Record<string, string>[]).map((asset) => [asset['id'], asset[labelColumn]]),
    )

    return rows.map((row): RentalSubject => {
      const assetId = row[fkColumn]
      return {
        id: row.id,
        administrationId: row.administration_id,
        subjectType: row.subject_type,
        // Falls back to the subject's own id only if the referenced asset
        // row is somehow missing (should not happen under FK integrity) -
        // never a fabricated name.
        label: (assetId && labelById.get(assetId)) || row.id,
      }
    })
  },
}
