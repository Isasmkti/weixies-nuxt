const DEFAULT_USAGE_TERMS = 'For use by one purchaser in personal, non-commercial end products. Redistribution or resale of the source files is not permitted.'

export function createDefaultProductLicense(price = 0) {
  const normalizedPrice = Number(price)
  return {
    name: 'Personal Use',
    price: Number.isInteger(normalizedPrice) && normalizedPrice >= 0 ? normalizedPrice : 0,
    usage_terms: DEFAULT_USAGE_TERMS,
    max_end_products: 1,
    allow_resale: false,
    allow_commercial_use: false,
    is_active: true,
    sort_order: 0,
  }
}

export function normalizeProductLicenses(licenses, fallbackPrice = 0) {
  const source = Array.isArray(licenses) && licenses.length
    ? licenses
    : [createDefaultProductLicense(fallbackPrice)]

  const normalized = source.map((license, index) => {
    const name = String(license?.name || '').trim()
    const usageTerms = String(license?.usage_terms || '').trim()
    const price = Number(license?.price)
    const maxEndProducts = license?.max_end_products === null || license?.max_end_products === ''
      ? null
      : Number(license?.max_end_products)

    if (!name) throw new Error(`License ${index + 1} requires a name.`)
    if (!usageTerms) throw new Error(`License ${index + 1} requires usage terms.`)
    if (!Number.isInteger(price) || price <= 0) throw new Error(`License ${index + 1} price must be a positive whole number.`)
    if (maxEndProducts !== null && (!Number.isInteger(maxEndProducts) || maxEndProducts <= 0)) {
      throw new Error(`License ${index + 1} project limit must be a positive whole number.`)
    }

    return {
      ...(license?.id ? { id: String(license.id) } : {}),
      license_type_id: license?.license_type_id || null,
      name,
      price,
      usage_terms: usageTerms,
      max_end_products: maxEndProducts,
      allow_resale: Boolean(license?.allow_resale),
      allow_commercial_use: Boolean(license?.allow_commercial_use),
      is_active: license?.is_active !== false,
      sort_order: index,
    }
  })

  if (!normalized.some((license) => license.is_active)) {
    throw new Error('At least one product license must be active.')
  }

  return normalized
}
