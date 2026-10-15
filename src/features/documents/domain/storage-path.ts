/**
 * MIME type -> file extension, for a short, deliberately incomplete set of
 * types this app's file_purpose values actually imply (contracts/receipts
 * are PDFs, act photos are images) - not an attempt to cover every MIME type
 * in existence. An unmapped MIME type simply gets no extension appended -
 * the file still works correctly without one, this is purely a
 * download-experience nicety, never required for correctness.
 */
const MIME_TYPE_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

/**
 * Builds a storage.objects path for a new file upload: always
 * `{administrationId}/{uuid}{extension?}`.
 *
 * The administration id prefix is required by the deployed storage.objects
 * RLS policies, which read `(storage.foldername(name))[1]` as the
 * administration id - get this wrong and every operation is denied. The
 * `crypto.randomUUID()` segment (global, no import) guarantees a fresh,
 * never-before-used path on every call, which is required because
 * FileRepository.upload always calls Storage upload with `upsert: false`
 * (storage.objects has no UPDATE policy).
 *
 * `originalName` is intentionally accepted but never read anywhere in this
 * function body - the human-readable filename is stored only in
 * `public.files.original_name` for display, and must never influence path
 * construction in any way (that is the entire point of keeping the two
 * separate: the storage path never derives from, or trusts, user input).
 * The parameter exists purely so this "never touches the path" property is
 * directly testable, rather than merely implied by its absence.
 */
export function buildStoragePath(administrationId: string, blob: Blob, _originalName?: string | null): string {
  const extension = MIME_TYPE_EXTENSIONS[blob.type] ?? ''
  return `${administrationId}/${crypto.randomUUID()}${extension}`
}
