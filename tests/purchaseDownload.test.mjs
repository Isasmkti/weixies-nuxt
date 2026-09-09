import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadMetadata, validProductZipPath } from '../utils/purchaseDownload.js'
import { preparePurchaseStream, attachmentDisposition, MAX_PURCHASE_BYTES } from '../server/utils/purchase-stream.js'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { createApp, defineEventHandler, setHeader, toNodeListener } from 'h3'

test('third download exhausts one release quota and legacy counts stay intact', () => {
  for (const count of [0, 1, 2, 3, 8]) {
    const result = downloadMetadata({ download_count: count, download_limit: 3 })
    assert.equal(result.download_count, count)
    assert.equal(result.downloads_remaining, Math.max(0, 3 - count))
    assert.equal(result.can_download, count < 3)
  }
  assert.equal(downloadMetadata({ download_count: 0 }, false).can_download, false)
  assert.equal(downloadMetadata({ download_count: 0 }, true, false).can_download, false)
})

test('ZIP paths cannot cross product folders or normalize to another object', () => {
  assert.equal(validProductZipPath('7/assets pack.zip', 7), true)
  for (const path of ['8/a.zip', '7/../8/a.zip', '7/%2e%2e/a.zip', '7/a.zip?x=y', '7//a.zip', '7/a.svg', '7/a\\b.zip']) {
    assert.equal(validProductZipPath(path, 7), false, path)
  }
})

test('missing, oversized, empty and pre-stream failed files fail before quota claim', async () => {
  for (const response of [new Response(null, { status: 404 }), new Response('x', { headers: { 'content-length': String(MAX_PURCHASE_BYTES + 1) } }), new Response('')]) {
    await assert.rejects(preparePurchaseStream(response, () => {}), /file_unavailable/)
  }
  const response = new Response(new ReadableStream({ start(controller) { controller.error(new Error('network failed')) } }))
  await assert.rejects(preparePurchaseStream(response, () => {}), /network failed/)
})

test('stream preparation buffers only the first chunk then streams all bytes with cleanup', async () => {
  let reads = 0
  let aborted = false
  const body = new ReadableStream({
    pull(controller) {
      reads++
      if (reads <= 100) controller.enqueue(new Uint8Array(65536).fill(42))
      else controller.close()
    },
  }, { highWaterMark: 0 })
  const prepared = await preparePurchaseStream(new Response(body), () => { aborted = true })
  assert.equal(reads, 1)
  let size = 0
  for await (const bytes of prepared.stream) size += bytes.length
  assert.equal(size, 6553600)
  assert.equal(aborted, true)
})

test('cancel before database claim aborts the upstream without starting a transfer', async () => {
  let aborted = false
  const prepared = await preparePurchaseStream(new Response('zip data'), () => { aborted = true })
  await prepared.cancel()
  assert.equal(aborted, true)
})

test('attachment headers reject newline injection and support unicode filenames', () => {
  const value = attachmentDisposition('Design 日本語\r\n".zip')
  assert.equal(/[\r\n]/.test(value), false)
  assert.match(value, /filename\*=UTF-8''/)
  assert.match(value, /%E6%97%A5/)
})

test('installed H3 Node adapter streams a response above 4.5 MB without a storage redirect', async () => {
  const app = createApp()
  let claimed = 0
  app.use('/download', defineEventHandler(async event => {
    let chunks = 0
    const response = new Response(new ReadableStream({ pull(controller) {
      if (++chunks <= 100) controller.enqueue(new Uint8Array(65536).fill(7))
      else controller.close()
    } }, { highWaterMark: 0 }))
    const prepared = await preparePurchaseStream(response, () => {})
    claimed++
    setHeader(event, 'Content-Type', 'application/zip')
    setHeader(event, 'Content-Disposition', attachmentDisposition('large.zip'))
    setHeader(event, 'Cache-Control', 'private, no-store')
    return prepared.stream
  }))
  const server = createServer(toNodeListener(app))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/download`, { method: 'POST' })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('location'), null)
    assert.match(response.headers.get('content-disposition'), /attachment/)
    let size = 0
    for await (const chunk of response.body) size += chunk.length
    assert.equal(size, 6553600)
    assert.equal(claimed, 1)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
