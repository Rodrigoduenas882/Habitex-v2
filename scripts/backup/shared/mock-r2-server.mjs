// Local-only mock of R2's S3-compatible object API, for this increment's
// own tests (step 9: "pruebas locales con mocks o servicios simulados").
// Never touches any real external service - this is an in-process HTTP
// server bound to 127.0.0.1 with a random port, backed by an in-memory Map.
//
// Deliberately implements its own, independent SigV4 signature check
// rather than calling into shared/s3-client.mjs's signing code. If the
// server reused the client's own signer to verify requests, a bug in that
// signer could sign and verify consistently while still being wrong against
// a real R2 endpoint - the whole point of this mock is to prove the client
// produces a signature a *different*, independently-written implementation
// of the same published algorithm accepts, which is a real correctness
// check, not just "the code agrees with itself."
//
// Scope of that independence, named precisely after review: this covers
// the HMAC/canonical-request/signing-key derivation genuinely
// independently. It does NOT independently re-derive key URI-encoding -
// both this file and the client reconstruct the canonical request from
// the literal HTTP request-line path, so a URI-encoding bug shared by both
// (there was one; see s3-client.mjs's `uriEncode` for the fix and its
// history) would not have been caught by this mock alone. Fixing the
// client's encoding to be AWS-strict (rather than trying to make this
// mock re-decode/re-encode independently, which would just be a second
// place to get the same rule right or wrong) is the correct fix for that
// axis - this mock's own value is specifically the signature-math check.

import { createHash, createHmac } from 'node:crypto'
import { createServer } from 'node:http'

function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest()
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function verifySignature({ method, path, headers, body, accessKeyId, secretAccessKey, region }) {
  const authHeader = headers['authorization']
  if (!authHeader || !authHeader.startsWith('AWS4-HMAC-SHA256 ')) {
    return { ok: false, reason: 'missing or malformed Authorization header' }
  }
  const credentialMatch = authHeader.match(/Credential=([^,]+)/)
  const signedHeadersMatch = authHeader.match(/SignedHeaders=([^,]+)/)
  const signatureMatch = authHeader.match(/Signature=([a-f0-9]+)/)
  if (!credentialMatch || !signedHeadersMatch || !signatureMatch) {
    return { ok: false, reason: 'Authorization header missing required fields' }
  }
  const [providedAccessKeyId, dateStamp, providedRegion, service] = credentialMatch[1].split('/')
  if (providedAccessKeyId !== accessKeyId) {
    return { ok: false, reason: 'access key mismatch' }
  }
  if (providedRegion !== region || service !== 's3') {
    return { ok: false, reason: 'region/service mismatch' }
  }
  const signedHeaderNames = signedHeadersMatch[1].split(';')
  const canonicalHeaders = signedHeaderNames
    .map((h) => `${h}:${String(headers[h]).trim().replace(/\s+/g, ' ')}\n`)
    .join('')
  const payloadHash = headers['x-amz-content-sha256']
  if (payloadHash !== sha256Hex(body ?? Buffer.alloc(0))) {
    return { ok: false, reason: 'x-amz-content-sha256 does not match actual body' }
  }
  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaderNames.join(';'), payloadHash].join('\n')
  const amzDateStamp = headers['x-amz-date']
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDateStamp, credentialScope, sha256Hex(Buffer.from(canonicalRequest))].join('\n')

  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const expectedSignature = hmac(kSigning, stringToSign).toString('hex')

  if (expectedSignature !== signatureMatch[1]) {
    return { ok: false, reason: 'signature mismatch' }
  }
  return { ok: true }
}

/** Starts the mock server and returns { url, accessKeyId, secretAccessKey, bucket, objects, close }. */
export async function startMockR2Server({ bucket = 'habitex-backups', region = 'auto' } = {}) {
  const accessKeyId = 'mock-access-key-id'
  const secretAccessKey = 'mock-secret-access-key'
  const objects = new Map()

  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const body = Buffer.concat(chunks)
      const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v]))
      const verification = verifySignature({
        method: req.method,
        path: req.url,
        headers,
        body,
        accessKeyId,
        secretAccessKey,
        region,
      })
      if (!verification.ok) {
        res.writeHead(403, { 'content-type': 'text/plain' })
        res.end(`signature verification failed: ${verification.reason}`)
        return
      }

      const expectedPrefix = `/${bucket}/`
      if (!req.url.startsWith(expectedPrefix)) {
        res.writeHead(404, { 'content-type': 'text/plain' })
        res.end('bucket not found')
        return
      }
      const key = decodeURIComponent(req.url.slice(expectedPrefix.length))

      if (req.method === 'PUT') {
        const ifNoneMatch = headers['if-none-match']
        if (ifNoneMatch === '*' && objects.has(key)) {
          res.writeHead(412, { 'content-type': 'text/plain' })
          res.end('precondition failed: object already exists')
          return
        }
        const etag = `"${sha256Hex(body)}"`
        objects.set(key, { body, etag })
        res.writeHead(200, { etag })
        res.end()
        return
      }

      if (req.method === 'GET') {
        const object = objects.get(key)
        if (!object) {
          res.writeHead(404)
          res.end('not found')
          return
        }
        res.writeHead(200, { etag: object.etag, 'content-length': String(object.body.length) })
        res.end(object.body)
        return
      }

      if (req.method === 'HEAD') {
        const object = objects.get(key)
        if (!object) {
          res.writeHead(404)
          res.end()
          return
        }
        res.writeHead(200, { etag: object.etag, 'content-length': String(object.body.length) })
        res.end()
        return
      }

      res.writeHead(405)
      res.end()
    })
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()

  return {
    url: `http://127.0.0.1:${port}`,
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
    objects,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
