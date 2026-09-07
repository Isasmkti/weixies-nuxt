import { Readable } from 'node:stream'

export const MAX_PURCHASE_BYTES = 209715200

// Read one chunk before charging; never buffer the full (up to 200 MB) ZIP.
// Node Readable.pipe respects backpressure in the installed H3 Node adapter.
export async function preparePurchaseStream(response, abort) {
  if (!response.ok || !response.body) throw new Error('file_unavailable')
  const length = Number(response.headers.get('content-length'))
  if (Number.isFinite(length) && length > MAX_PURCHASE_BYTES) throw new Error('file_unavailable')
  const reader = response.body.getReader()
  let first
  try {
    first = await reader.read()
    if (first.done || !first.value?.byteLength) throw new Error('file_unavailable')
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  }
  async function* chunks() {
    let total = 0
    let next = first
    try {
      while (!next.done) {
        total += next.value.byteLength
        if (total > MAX_PURCHASE_BYTES) throw new Error('Product file exceeds the download size limit.')
        yield next.value
        next = await reader.read()
      }
    } finally {
      await reader.cancel().catch(() => {})
      abort()
    }
  }
  return {
    stream: Readable.from(chunks(), { objectMode: false, highWaterMark: 65536 }),
    cancel: async () => { abort(); await reader.cancel().catch(() => {}) },
  }
}

export function attachmentDisposition(fileName) {
  let safe = Array.from(String(fileName || 'product.zip').replace(/[\u0000-\u001f\u007f"\\/]/g, '_')).slice(0, 170).join('')
  if (!/\.zip$/i.test(safe)) safe += '.zip'
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
