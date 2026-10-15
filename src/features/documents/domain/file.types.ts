/** file_purpose enum, confirmed against the deployed schema (public.files). */
export type FilePurpose =
  | 'CONTRACT_GENERATED'
  | 'CONTRACT_SIGNED'
  | 'ACT_PHOTO'
  | 'ACT_ATTACHMENT'
  | 'PAYMENT_PROOF'
  | 'RECEIPT'
  | 'AUTHORIZATION'
  | 'OTHER'

/**
 * Storage bucket ids. Deliberately restricted to the two buckets that exist
 * and that the deployed storage.objects RLS policies cover
 * (objects_select/insert/delete all check
 * `bucket_id in ('receipts','documents')`) - not a bare `string`, so an
 * invalid bucket id is a compile-time error, not a runtime RLS denial.
 */
export type FileStorageBucket = 'receipts' | 'documents'

/**
 * A public.files row, mirrored into camelCase domain shape. Note there is
 * no foreign key between public.files and storage.objects - this row is the
 * application's own record of a storage object's existence/purpose, kept
 * consistent by this feature's repository, not by the database.
 */
export interface FileMetadata {
  id: string
  administrationId: string
  rentalRelationshipId: string | null
  purpose: FilePurpose
  storageBucket: FileStorageBucket
  storagePath: string
  originalName: string | null
  mimeType: string
  sizeBytes: number
  sha256: string | null
  uploadedByPersonId: string | null
  createdAt: string
}

/**
 * Input for FileRepository.upload. Deliberately does not carry mimeType or
 * sizeBytes - those are derived from blob.type/blob.size inside the
 * repository implementation, never trusted as separately-passed values that
 * could mismatch the actual blob (a Blob/File already carries accurate
 * .type/.size). Deliberately does not carry sha256 or uploadedByPersonId -
 * computing/resolving either is out of scope for this increment, so both
 * are left unset on insert (the columns accept null/omission).
 */
export interface UploadFileInput {
  administrationId: string
  rentalRelationshipId: string | null
  purpose: FilePurpose
  bucket: FileStorageBucket
  blob: Blob
  originalName: string | null
}

/**
 * Wraps any failed Supabase call (Storage API or public.files) so nothing
 * above infrastructure/ ever sees a raw Supabase/Postgres error. Deliberately
 * generic/coarse - this increment builds no UI itself, so no error-code
 * taxonomy is designed here; a future feature that actually presents these
 * errors to a user can inspect `.cause` or add a taxonomy then.
 */
export class FileRepositoryError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'FileRepositoryError'
    this.cause = cause
  }
}

/**
 * Generic file upload/download primitive - the one place the storage.objects
 * + public.files contract lives. Future features (contracts, payments,
 * receipts) depend on this interface, not on Storage/files details directly.
 */
export interface FileRepository {
  /**
   * Reads a single public.files row by id, or null if it doesn't exist/isn't
   * visible to the caller (RLS-filtered, same as any other read here - this
   * is a convenience lookup, not a new security surface). Added for callers
   * that only know a file id (e.g. a foreign key like contracts.document_
   * file_id/signed_file_id) and need the full FileMetadata - bucket/path in
   * particular - to call download() with it.
   */
  getById(id: string): Promise<FileMetadata | null>

  /**
   * Uploads `input.blob` to `input.bucket` at a freshly generated path (see
   * buildStoragePath), then inserts the corresponding public.files row.
   *
   * Always calls Storage upload with `upsert: false` - storage.objects has
   * no UPDATE policy (objects are immutable by design), so `upsert: true`
   * would always be denied by RLS. Every call must target a path that has
   * never been used before, which buildStoragePath's UUID segment
   * guarantees.
   *
   * If the Storage upload itself fails, throws immediately - nothing was
   * created, safe to retry from scratch. If the Storage upload succeeds but
   * the public.files insert then fails, attempts a best-effort compensating
   * removal of the just-uploaded storage object (its own failure is
   * swallowed - this is not a distributed transaction, just a best-effort
   * bound on the "orphaned object" window) and then throws the original
   * metadata-insert error.
   */
  upload(input: UploadFileInput): Promise<FileMetadata>

  /**
   * Downloads the file's bytes via Supabase Storage's authenticated
   * `download()` - re-checked against storage.objects RLS for the current
   * user on every call - rather than `createSignedUrl()`, which would mint a
   * bearer credential usable by anyone holding the link for its validity
   * window. Appropriate for a private, sensitive-document bucket setup with
   * no requirement (in this increment) to share access outside an
   * authenticated session. A future increment that specifically needs
   * share-by-link semantics can add a signed-URL method then, with its own
   * consideration of expiry/revocation.
   */
  download(file: FileMetadata): Promise<Blob>

  /**
   * Deletes the public.files row first, then the storage object. Once the
   * metadata row is gone, nothing in the app can discover or display this
   * file again (nothing lists raw storage.objects without going through a
   * public.files row), so from the user's perspective the delete has
   * already "succeeded" at that point - if the subsequent storage removal
   * fails, the result is an orphaned, unreferenced storage object (wasted
   * space, not a correctness/security issue). That failure still surfaces
   * via FileRepositoryError rather than being swallowed (see the
   * implementation's own doc comment for why). If the metadata delete
   * itself fails, throws immediately without attempting the storage
   * removal.
   */
  remove(file: FileMetadata): Promise<void>
}
