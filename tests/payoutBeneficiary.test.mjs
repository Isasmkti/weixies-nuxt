import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { validatePayoutAccount } from '../utils/payoutBanks.js'

// Node's test runner does not know Nuxt's `~/` alias. Load the exact server
// module source with that one specifier resolved to its local file URL.
const beneficiarySource = readFileSync(resolve('server/utils/xendit-beneficiary.js'), 'utf8')
  .replace("'~/utils/payoutBanks.js'", `'${pathToFileURL(resolve('utils/payoutBanks.js')).href}'`)
const beneficiaryModule = await import(`data:text/javascript;base64,${Buffer.from(beneficiarySource).toString('base64')}`)
const {
  resolveXenditBankBeneficiary,
  resolveXenditRecipientAddress,
  splitAccountHolderName,
} = beneficiaryModule

test('normalizes the selected bank and account number', () => {
  assert.deepEqual(validatePayoutAccount({
    bankCode: 'id_bca',
    accountNumber: '001 234 5678',
    accountHolderName: '  Budi   Santoso  ',
  }), {
    bankCode: 'BCA',
    accountNumber: '0012345678',
    accountHolderName: 'Budi Santoso',
  })
})

test('derives Xendit routing and personal names on the server', () => {
  assert.deepEqual(resolveXenditBankBeneficiary({
    bankCode: 'MANDIRI',
    accountNumber: '123456789012',
    accountHolderName: 'Siti Nur Aisyah',
  }), {
    bankCode: 'MANDIRI',
    accountNumber: '123456789012',
    accountHolderName: 'Siti Nur Aisyah',
    recipientType: 'INDIVIDUAL',
    routingType: 'SWIFT',
    routingValue: 'BMRIIDJA',
    givenName: 'Siti',
    surname: 'Nur Aisyah',
  })
})

test('reuses a single-word name as surname', () => {
  assert.deepEqual(splitAccountHolderName('Sukarno'), {
    givenName: 'Sukarno',
    surname: 'Sukarno',
  })
})

test('adds Xendit required prefix to a 14-digit BRI account', () => {
  assert.equal(validatePayoutAccount({
    bankCode: 'BRI',
    accountNumber: '12345678901234',
    accountHolderName: 'Budi Santoso',
  }).accountNumber, '012345678901234')
})

test('rejects an invalid bank account length', () => {
  assert.throws(() => validatePayoutAccount({
    bankCode: 'BCA',
    accountNumber: '123',
    accountHolderName: 'Budi Santoso',
  }), /10 digits/)
})

test('always supplies Xendit required recipient address fields', () => {
  assert.deepEqual(resolveXenditRecipientAddress({}), {
    country: 'ID',
    street_line_1: 'Indonesia',
    city: 'Indonesia',
  })

  assert.deepEqual(resolveXenditRecipientAddress({
    addressLine1: 'Jl. Sudirman 10',
    city: 'Jakarta',
    province: 'DKI Jakarta',
    postalCode: '10220',
  }), {
    country: 'ID',
    street_line_1: 'Jl. Sudirman 10',
    city: 'Jakarta',
    province_state: 'DKI Jakarta',
    postal_code: '10220',
  })
})
