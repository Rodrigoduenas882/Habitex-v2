// A minimal AWS SigV4-signing S3-compatible client, written for Cloudflare
// R2 (R2's object API is S3-compatible; region is always "auto", service
// is "s3"). No new dependency - SigV4 is implemented directly with Node's
// built-in crypto, following the published AWS algorithm exactly, so this
// same code works against either a real R2 endpoint (once real credentials
// exist - not yet, per this increment's own restrictions) or the local
// mock-r2-server.mjs used for this increment's own tests. Swapping from
// mock to real R2 is purely a config change (endpoint/credentials), never
// a code change - that is the entire point of signing requests exactly as
// AWS/R2 expect, rather than only ever matching a hand-rolled mock.
//
// Supports exactly what this backup pipeline needs: putObject (optionally
// conditional via If-None-Match, for collision detection at the
// destination - R2 supports this header for conditional writes), getObject,
// and headObject. No multipart upload (snapshot sizes for Habitex's current
// data volume don't need it yet - a real limitation for very large
// snapshots, named here rather than silently assumed away).

import { createHash, createHmac } from 'node:crypto'

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest()
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '')
}

/**
 * AWS SigV4's own URI-encoding rule (RFC 3986 "unreserved" characters only:
 * A-Za-z0-9-_.~), which is stricter than `encodeURIComponent` -
 * `encodeURIComponent` leaves `! * ' ( )` unescaped, but SigV4's own
 * canonical-request algorithm requires them percent-encoded too (uppercase
 * hex). A real S3/R2 endpoint independently re-derives its own canonical
 * request from the decoded key, so disagreeing with this exact rule - not
 * just producing *a* valid URL-encoding - breaks the signature against a
 * real endpoint. Found by independent review: unreachable with this
 * pipeline's own internally-generated keys (always `<runId>/<runId>.
 * <ext>`, never derived from arbitrary filenames), but this module is
 * written as a reusable client, so the gap was real.
 */
function uriEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/** AWS SigV4's header-value normalization: trim, and collapse internal runs of whitespace to one space. */
function normalizeHeaderValue(value) {
  return String(value).trim().replace(/\s+/g, ' ')
}

function signRequest({ method, host, path: requestPath, headers, payloadHash, accessKeyId, secretAccessKey, region, date }) {
  const dateStamp = amzDate(date).slice(0, 8)
  const amzDateStamp = amzDate(date)
  // All callers below only ever pass already-lowercase header names
  // (enforced by convention, not re-derived here, to keep this function's
  // own logic simple and avoid a second lookup that could silently produce
  // "undefined" in a signed header if it ever mismatched).
  const allHeaders = { ...headers, host, 'x-amz-date': amzDateStamp, 'x-amz-content-sha256': payloadHash }
  const sortedHeaderNames = Object.keys(allHeaders).sort()
  const canonicalHeaders = sortedHeaderNames.map((h) => `${h}:${normalizeHeaderValue(allHeaders[h])}\n`).join('')
  const signedHeaders = sortedHeaderNames.join(';')

  const canonicalRequest = [method, requestPath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDateStamp, credentialScope, sha256Hex(Buffer.from(canonicalRequest))].join('\n')

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return { authorization, amzDateStamp, payloadHash }
}

export class R2CollisionError extends Error {}
export class R2RequestError extends Error {}

export function createS3Client({ endpoint, region = 'auto', accessKeyId, secretAccessKey, bucket }) {
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('endpoint, accessKeyId, secretAccessKey, and bucket are all required')
  }
  const url = new URL(endpoint)

  async function request(method, key, { body, ifNoneMatch } = {}) {
    const requestPath = `/${bucket}/${key.split('/').map(uriEncode).join('/')}`
    const payloadHash = sha256Hex(body ?? Buffer.alloc(0))
    const headers = {}
    if (ifNoneMatch) {
      headers['if-none-match'] = ifNoneMatch
    }
    const { authorization, amzDateStamp } = signRequest({
      method,
      host: url.host,
      path: requestPath,
      headers,
      payloadHash,
      accessKeyId,
      secretAccessKey,
      region,
      date: new Date(),
    })

    // Node's fetch always sends the real connection target as the Host
    // header regardless of what's passed here, which is fine - it's
    // identical to `url.host`, the value already used when signing above.
    const res = await fetch(`${url.origin}${requestPath}`, {
      method,
      headers: {
        ...headers,
        'x-amz-date': amzDateStamp,
        'x-amz-content-sha256': payloadHash,
        Authorization: authorization,
      },
      body,
    })
    return res
  }

  return {
    /** Uploads `body` to `key`. If `ifNoneMatch: '*'`, fails with R2CollisionError when the key already exists (atomic conditional write, not check-then-write). */
    async putObject(key, body, { ifNoneMatch } = {}) {
      const res = await request('PUT', key, { body, ifNoneMatch })
      if (res.status === 412) {
        throw new R2CollisionError(`object "${key}" already exists in bucket (conditional write rejected)`)
      }
      if (!res.ok) {
        throw new R2RequestError(`PUT ${key} failed: ${res.status} ${await res.text()}`)
      }
      return { etag: res.headers.get('etag') }
    },

    async getObject(key) {
      const res = await request('GET', key)
      if (res.status === 404) {
        return null
      }
      if (!res.ok) {
        throw new R2RequestError(`GET ${key} failed: ${res.status} ${await res.text()}`)
      }
      return Buffer.from(await res.arrayBuffer())
    },

    async headObject(key) {
      const res = await request('HEAD', key)
      if (res.status === 404) {
        return null
      }
      if (!res.ok) {
        throw new R2RequestError(`HEAD ${key} failed: ${res.status}`)
      }
      return { etag: res.headers.get('etag'), contentLength: Number(res.headers.get('content-length')) }
    },
  }
}
