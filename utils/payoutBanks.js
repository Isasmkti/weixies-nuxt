export const INDONESIAN_PAYOUT_BANKS = Object.freeze([
  { code: 'BCA', name: 'Bank Central Asia (BCA)', minLength: 10, maxLength: 10 },
  { code: 'BRI', name: 'Bank Rakyat Indonesia (BRI)', minLength: 13, maxLength: 17 },
  { code: 'BNI', name: 'Bank Negara Indonesia (BNI)', minLength: 7, maxLength: 11 },
  { code: 'MANDIRI', name: 'Bank Mandiri', minLength: 12, maxLength: 17 },
  { code: 'PERMATA', name: 'PermataBank', minLength: 7, maxLength: 16 },
])

const BANK_BY_CODE = new Map(INDONESIAN_PAYOUT_BANKS.map(bank => [bank.code, bank]))
const BANK_CODE_ALIASES = Object.freeze({
  ID_BCA: 'BCA',
  'BANK CENTRAL ASIA': 'BCA',
  ID_BRI: 'BRI',
  'BANK RAKYAT INDONESIA': 'BRI',
  ID_BNI: 'BNI',
  'BANK NEGARA INDONESIA': 'BNI',
  ID_MANDIRI: 'MANDIRI',
  'BANK MANDIRI': 'MANDIRI',
  ID_PERMATA: 'PERMATA',
  PERMATABANK: 'PERMATA',
})

export function normalizePayoutBankCode(value) {
  const code = String(value || '').trim().toUpperCase()
  return BANK_CODE_ALIASES[code] || code
}

export function normalizePayoutAccountNumber(value) {
  return String(value || '').replace(/\D/g, '')
}

export function validatePayoutAccount({ bankCode, accountNumber, accountHolderName }) {
  const normalizedBankCode = normalizePayoutBankCode(bankCode)
  let normalizedAccountNumber = normalizePayoutAccountNumber(accountNumber)
  const normalizedAccountHolderName = String(accountHolderName || '').trim().replace(/\s+/g, ' ')
  const bank = BANK_BY_CODE.get(normalizedBankCode)

  if (!normalizedAccountHolderName) throw new Error('Account holder name is required.')
  if (!bank) throw new Error('Select a supported payout bank.')
  if (!normalizedAccountNumber) throw new Error('Account number is required.')
  // Xendit's Indonesia coverage requires a leading zero for 14-digit BRI
  // account numbers. Do this centrally so the seller never handles it.
  if (normalizedBankCode === 'BRI' && normalizedAccountNumber.length === 14) {
    normalizedAccountNumber = `0${normalizedAccountNumber}`
  }
  if (normalizedAccountNumber.length < bank.minLength || normalizedAccountNumber.length > bank.maxLength) {
    const expectedLength = bank.minLength === bank.maxLength
      ? `${bank.minLength} digits`
      : `${bank.minLength}-${bank.maxLength} digits`
    throw new Error(`${bank.name} account number must contain ${expectedLength}.`)
  }

  return {
    bankCode: normalizedBankCode,
    accountNumber: normalizedAccountNumber,
    accountHolderName: normalizedAccountHolderName,
  }
}
