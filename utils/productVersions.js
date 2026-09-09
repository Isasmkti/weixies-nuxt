export function productVersionLabel(sequence) {
  const value = Math.trunc(Number(sequence))
  if (!Number.isFinite(value) || value < 10) return null
  return `${Math.floor(value / 10)}.${value % 10}`
}

export function releasedProductFiles(files) {
  return [...(Array.isArray(files) ? files : [])]
    .filter(file => !file.release_status || file.release_status === 'published')
    .sort((a, b) => {
      const bySequence = Number(b.version_sequence || 0) - Number(a.version_sequence || 0)
      return bySequence || String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || ''))
    })
}

export function latestProductRelease(files) {
  return releasedProductFiles(files)[0] || null
}

export function pendingProductRelease(files) {
  return [...(Array.isArray(files) ? files : [])]
    .filter(file => file.release_status === 'pending_review')
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null
}

export function nextProductVersion(files) {
  const current = latestProductRelease(files)
  return productVersionLabel(Math.max(10, Number(current?.version_sequence || 9) + 1))
}
