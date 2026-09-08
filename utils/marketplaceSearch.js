export const MIN_MARKETPLACE_SEARCH_LENGTH = 2
export const MAX_MARKETPLACE_SEARCH_LENGTH = 80

export function normalizeMarketplaceSearchQuery(value) {
  const raw = Array.isArray(value) ? value[0] : value
  return String(raw || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MARKETPLACE_SEARCH_LENGTH)
}

export function escapePostgresLikePattern(value) {
  return String(value || '').replace(/[\\%_]/g, '\\$&')
}

export function mergeUniqueSearchRows(...collections) {
  const rowsById = new Map()

  for (const rows of collections) {
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row?.id == null || rowsById.has(String(row.id))) continue
      rowsById.set(String(row.id), row)
    }
  }

  return [...rowsById.values()]
}
