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
  const releasedFiles = [...(product?.product_files || [])]
    .filter(file => !file.release_status || file.release_status === 'published')
    .sort((a, b) => {
      const sequenceDifference = Number(b.version_sequence || 0) - Number(a.version_sequence || 0)
      return sequenceDifference || String(b.published_at || b.created_at || '').localeCompare(String(a.published_at || a.created_at || ''))
    })
  const file = releasedFiles[0] || null
  const usages = Array.isArray(item?.order_item_file_downloads) ? item.order_item_file_downloads : null
  const currentUsage = usages?.find(usage => String(usage.product_file_id) === String(file?.id)) || null
  // Legacy fallback is only used by callers/tests that do not yet project the
  // per-release relation. A projected empty array means a genuinely fresh quota.
  const counter = currentUsage || (usages === null ? item : {})
  const count = Math.max(0, Number(counter?.download_count) || 0)
  const limit = Math.max(1, Number(counter?.download_limit) || 3)
  const remaining = Math.max(0, limit - count)
  const purchasedFile = releasedFiles.find(candidate => String(candidate.id) === String(item?.product_file_id_at_purchase)) || null
  const lastDownloadedSequence = usages?.reduce((latest, usage) => {
    if (Number(usage.download_count) <= 0) return latest
    const usedFile = releasedFiles.find(candidate => String(candidate.id) === String(usage.product_file_id))
    return Math.max(latest, Number(usedFile?.version_sequence) || 0)
  }, 0) || 0
  const baselineSequence = Math.max(Number(purchasedFile?.version_sequence) || 0, lastDownloadedSequence)
  const updateAvailable = Boolean(file?.version_sequence && baselineSequence && Number(file.version_sequence) > baselineSequence)
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
    is_downloaded: currentUsage ? count > 0 : Boolean(counter?.is_downloaded),
    downloaded_at: currentUsage?.last_downloaded_at || counter?.downloaded_at || null,
    download_count: count,
    download_limit: limit,
    downloads_remaining: remaining,
    lifetime_download_count: Math.max(0, Number(item?.download_count) || 0),
    update_available: updateAvailable,
    purchased_version: purchasedFile?.version || null,
    latest_version: file?.version || null,
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
    file: file ? { name: file.file_name, size: file.file_size, version: file.version, published_at: file.published_at || file.created_at } : null,
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
