// Shared, pure helpers: counters are authoritative server values, never +1 in UI.
export function downloadMetadata(item, access = true, fileAvailable = true) {
  const count = Math.max(0, Number(item?.download_count) || 0)
  const limit = Math.max(1, Number(item?.download_limit) || 3)
  const remaining = Math.max(0, limit - count)
  return {
    is_downloaded: Boolean(item?.is_downloaded),
    downloaded_at: item?.downloaded_at || null,
    download_count: count,
    download_limit: limit,
    downloads_remaining: remaining,
    can_download: Boolean(access && fileAvailable && remaining > 0),
  }
}

export function validProductZipPath(path, productId) {
  if (typeof path !== 'string' || !path || path.length > 1024) return false
  const parts = path.split('/')
  return parts.length >= 2 && parts[0] === String(productId)
    && parts.every(part => part && part !== '.' && part !== '..')
    && !/[\\\u0000-\u001f%?#]/.test(path) && /\.zip$/i.test(path)
}

export function downloadFailureMessage(code) {
  const messages = {
    download_limit_reached: 'Download limit reached. Each purchase includes three downloads.',
    purchase_access_revoked: 'This purchase is no longer available. Refresh My Purchases.',
    download_session_signed_out: 'Your session has ended. Please sign in again.',
    download_session_used_or_expired: 'This download request has expired or was already used. Please try again.',
    download_session_invalid: 'This download request is not valid for this browser session.',
    file_unavailable: 'The product file is unavailable. No download was used. Please contact the seller.',
    transfer_unavailable: 'The file could not be started. No download was used. Please try again.',
  }
  return messages[code] || 'Unable to start this download. Refresh your purchases before retrying.'
}
