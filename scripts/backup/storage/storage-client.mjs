// Thin wrapper over the same Storage REST API Habitex's own app code uses
// (src/features/documents/infrastructure/supabase-file.repository.ts calls
// supabaseClient.storage.from(bucket).upload/download() - this module talks
// to the identical HTTP endpoints, just with a privileged key instead of a
// user session, because listing/downloading every tenant's objects for a
// backup is cross-tenant by nature and cannot be done under a normal user's
// RLS-scoped session).
//
// Credential note (a real, documented limitation, not an oversight): unlike
// backup_reader (Postgres), self-hosted Supabase Storage has no built-in
// "read-only, cross-tenant" role to delegate to. The only JWT roles are
// `anon` (RLS-scoped, useless for a backup) and `service_role` (bypasses
// storage.objects RLS entirely, for both reads AND writes - there is no
// privilege barrier stopping this credential from also deleting objects,
// only this script's own discipline of never calling a destructive
// endpoint). This is a materially weaker guarantee than backup_reader's
// hard, grant-level "cannot write" property, and is called out explicitly
// in docs/ops/storage-backup-validation-findings.md as a residual risk and
// as a concrete requirement for the eventual R2 credential (which CAN be
// scoped to read-only via R2 API token permissions).

function must(value, name) {
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export function createStorageClient({ url, serviceRoleKey }) {
  must(url, 'url')
  must(serviceRoleKey, 'serviceRoleKey')
  const base = `${url.replace(/\/$/, '')}/storage/v1`
  const headers = {
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  }

  const LIST_PAGE_SIZE = 1000

  /**
   * Lists every immediate child of `prefix` within `bucket` (one level,
   * like the real API - not recursive), paginating until a page comes back
   * short of LIST_PAGE_SIZE. A single unpaginated call silently truncates
   * at 1000 entries per folder with no error and no signal in the
   * manifest - exactly the kind of gap this pipeline's own completeness
   * reporting exists to catch, so it cannot be the thing that creates one.
   */
  async function listOne(bucket, prefix) {
    const entries = []
    let offset = 0
    while (true) {
      const res = await fetch(`${base}/object/list/${encodeURIComponent(bucket)}`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, limit: LIST_PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } }),
      })
      if (!res.ok) {
        throw new Error(`list failed for ${bucket}/${prefix}: ${res.status} ${await res.text()}`)
      }
      const page = await res.json()
      entries.push(...page)
      if (page.length < LIST_PAGE_SIZE) {
        break
      }
      offset += LIST_PAGE_SIZE
    }
    return entries
  }

  /**
   * Recursively walks every folder under `bucket` and returns a flat list of
   * real objects (entries that have an `id` - the Storage API's own way of
   * distinguishing a file from a folder placeholder, which has `id: null`).
   */
  async function listAllObjects(bucket) {
    const objects = []
    async function walk(prefix) {
      const entries = await listOne(bucket, prefix)
      for (const entry of entries) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.id) {
          objects.push({
            bucket,
            path,
            id: entry.id,
            sizeBytes: entry.metadata?.size ?? null,
            mimeType: entry.metadata?.mimetype ?? null,
            storageEtag: entry.metadata?.eTag ?? null,
            storageUpdatedAt: entry.updated_at ?? null,
          })
        } else {
          await walk(path)
        }
      }
    }
    await walk('')
    return objects
  }

  /** Downloads one object's raw bytes. Returns null (never throws) on a 404 - the caller decides what a missing object means for completeness. */
  async function downloadObject(bucket, path) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const res = await fetch(`${base}/object/${encodeURIComponent(bucket)}/${encodedPath}`, { headers })
    if (res.status === 404) {
      return null
    }
    if (!res.ok) {
      throw new Error(`download failed for ${bucket}/${path}: ${res.status} ${await res.text()}`)
    }
    return Buffer.from(await res.arrayBuffer())
  }

  return { listAllObjects, downloadObject }
}
