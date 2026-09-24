import type { FileRepository } from './domain/file.types'
import { supabaseFileRepository } from './infrastructure/supabase-file.repository'

/**
 * The one place that decides which repository implementation this feature's
 * port gets. application/ (or, until a first consumer exists, a future
 * feature importing this directly) depends on this binding, never on the
 * concrete adapter's import path - same pattern as
 * features/rentals/composition.ts.
 */
export const fileRepository: FileRepository = supabaseFileRepository
