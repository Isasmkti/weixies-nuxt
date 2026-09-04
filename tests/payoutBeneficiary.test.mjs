import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveXenditBankBeneficiary, splitAccountHolderName } from '../server/utils/xendit-beneficiary.js'
import { validatePayoutAccount } from '../utils/payoutBanks.js'

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
