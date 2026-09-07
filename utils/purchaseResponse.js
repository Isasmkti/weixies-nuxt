import { validProductZipPath } from './purchaseDownload.js'

const relationOne = value => Array.isArray(value) ? value[0] || null : value || null

export function purchaseResponse(ownership) {
  const order = relationOne(ownership.order)
  const product = relationOne(ownership.product)
  const item = (order?.order_items || []).find(candidate => (
    String(candidate.product_id) === String(ownership.product_id)
  ))
  const license = relationOne(item?.order_item_licenses)
  const seller = relationOne(product?.seller)
  const images = Array.isArray(product?.product_images) ? product.product_images : []
  const file = [...(product?.product_files || [])].sort((a, b) => (
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  ))[0] || null
  const count = Math.max(0, Number(item?.download_count) || 0)
  const limit = Math.max(0, Number(item?.download_limit) || 0)
  const remaining = Math.max(0, limit - count)
  const productAvailable = Boolean(product)
  const fileAvailable = Boolean(file && validProductZipPath(file.file_url, ownership.product_id))

  return {
    id: ownership.id,
    product_id: ownership.product_id,
    order_id: ownership.order_id,
    order_item_id: item?.id || null,
    order_number: order?.order_number || null,
    purchased_at: order?.paid_at || ownership.created_at,
    price: item?.price ?? null,
    is_downloaded: Boolean(item?.is_downloaded),
    downloaded_at: item?.downloaded_at || null,
    download_count: count,
    download_limit: limit,
    downloads_remaining: remaining,
    product_available: productAvailable,
    public_product_available: product?.status === 'published',
    file_available: fileAvailable,
    has_access: Boolean(item && order?.status === 'paid' && !order.purchase_conflict),
    can_download: Boolean(item && order?.status === 'paid' && !order.purchase_conflict && productAvailable && fileAvailable && remaining > 0),
    product: product ? {
      id: product.id,
      name: product.name,
      slug: product.status === 'published' ? product.slug : null,
      image_url: images.find(image => image.is_primary)?.image_url || images[0]?.image_url || null,
    } : null,
    store: seller ? { id: seller.id, name: seller.store_name, slug: seller.store_slug } : null,
    file: file ? { name: file.file_name, size: file.file_size, version: file.version } : null,
    license: license ? {
      name: license.license_name_snapshot,
      usage_terms: license.usage_terms_snapshot,
      allow_commercial_use: license.allow_commercial_use_snapshot,
      allow_resale: license.allow_resale_snapshot,
    } : null,
  }
}

export function positivePurchaseId(value) {
  const id = String(value ?? '').trim()
  const postgresBigintMax = '9223372036854775807'
  if (!/^[1-9]\d{0,18}$/.test(id)) return null
  if (id.length === postgresBigintMax.length && id > postgresBigintMax) return null
  return id
}
