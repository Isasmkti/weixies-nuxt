export const SEO_SITE_NAME = 'Weixies'
export const SEO_DEFAULT_TITLE = 'Weixies - Digital Products Marketplace'
export const SEO_DEFAULT_DESCRIPTION = 'Discover premium digital products, design assets, templates, and creative tools from trusted sellers on Weixies.'

export function normalizeSiteOrigin(value, fallback = '') {
  for (const candidate of [value, fallback]) {
    try {
      const url = new URL(String(candidate || '').trim())
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin
    } catch {
      // Try the fallback origin.
    }
  }
  return ''
}

export function toAbsoluteSeoUrl(value, origin) {
  const normalizedOrigin = normalizeSiteOrigin(origin)
  if (!normalizedOrigin) return String(value || '')
  try {
    return new URL(String(value || '/'), `${normalizedOrigin}/`).toString()
  } catch {
    return normalizedOrigin
  }
}

export function seoDescription(value, fallback = SEO_DEFAULT_DESCRIPTION) {
  const plainText = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (plainText || fallback).slice(0, 160)
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
