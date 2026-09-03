import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeProductLicenses } from '../utils/productLicenses.js'
import { validateProductSubmission, validateProductZip } from '../utils/productSubmission.js'

const image = { image_url: 'https://example.test/product.webp' }
const zip = { name: 'product.zip', type: 'application/zip', size: 1024 }

test('a new product requires a positive whole-number price', () => {
  assert.throws(
    () => validateProductSubmission({ name: 'Asset', description: 'Description', price: 0, images: [image], zipFile: zip }),
    /positive whole number/,
  )
})

test('a new product requires at least one image and a ZIP file', () => {
  assert.throws(
    () => validateProductSubmission({ name: 'Asset', description: 'Description', price: 1000, images: [], zipFile: zip }),
    /at least one product image/i,
  )
  assert.throws(
    () => validateProductSubmission({ name: 'Asset', description: 'Description', price: 1000, images: [image] }),
    /ZIP file is required/,
  )
})

test('an edit may retain its existing ZIP but an uploaded replacement is still validated', () => {
  assert.doesNotThrow(() => validateProductSubmission(
    { name: 'Asset', description: 'Description', price: 1000, images: [image] },
    { hasExistingZip: true },
  ))
  assert.throws(
    () => validateProductZip({ name: 'malware.exe', type: 'application/octet-stream', size: 100 }),
    /valid ZIP/,
  )
})

test('active product licenses cannot be free', () => {
  assert.throws(() => normalizeProductLicenses([{
    name: 'Personal Use',
    price: 0,
    usage_terms: 'Personal projects only.',
    max_end_products: 1,
    is_active: true,
  }]), /positive whole number/)
})
