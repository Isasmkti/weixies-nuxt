import { validatePayoutAccount } from '../../utils/payoutBanks.js'

const BANK_SWIFT_CODES = Object.freeze({
  BCA: 'CENAIDJA',
  BRI: 'BRINIDJA',
  BNI: 'BNINIDJA',
  MANDIRI: 'BMRIIDJA',
  PERMATA: 'BBBAIDJA',
})

export function splitAccountHolderName(accountHolderName) {
  const words = String(accountHolderName || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
  if (!words.length) throw new Error('Account holder name is required.')

  const givenName = words[0].slice(0, 50)
  const surname = (words.length > 1 ? words.slice(1).join(' ') : words[0]).slice(0, 50)
  return { givenName, surname }
}

export function resolveXenditBankBeneficiary(input) {
  const payoutAccount = validatePayoutAccount(input)
  const routingValue = BANK_SWIFT_CODES[payoutAccount.bankCode]
  if (!routingValue) throw new Error('The selected bank does not have an Xendit routing configuration.')

  return {
    ...payoutAccount,
    recipientType: 'INDIVIDUAL',
    routingType: 'SWIFT',
    routingValue,
    ...splitAccountHolderName(payoutAccount.accountHolderName),
  }
}
