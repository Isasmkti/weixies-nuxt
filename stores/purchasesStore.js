import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getUser } from '../services/authService'
import { getPurchases, getPurchaseOwnership } from '../services/purchasesService'

const CACHE_TTL = 20_000

export const usePurchasesStore = defineStore('purchases', () => {
  const profileId = ref(null)
  const items = ref([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(12)
  const loading = ref(false)
  const error = ref('')
  const ownershipError = ref('')
  const ownershipByProductId = ref({})
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  let generation = 0
  let listRequestNumber = 0
  let listCache = null
  const listRequests = new Map()
  const ownershipRequests = new Map()
  const ownershipFetchedAt = new Map()

  const isPurchased = productId => Boolean(ownershipByProductId.value[String(productId)])
  const matches = context => context.generation === generation && context.profileId === profileId.value

  const $reset = () => {
    generation += 1
    listRequestNumber += 1
    profileId.value = null
    items.value = []
    total.value = 0
    page.value = 1
    loading.value = false
    error.value = ''
    ownershipError.value = ''
    ownershipByProductId.value = {}
    listCache = null
    listRequests.clear()
    ownershipRequests.clear()
    ownershipFetchedAt.clear()
  }

  const accountContext = async () => {
    const startedGeneration = generation
    const user = await getUser()
    // An auth reset while this session lookup was pending invalidates its result.
    if (startedGeneration !== generation) return null
    if (!user) {
      $reset()
      return null
    }
    if (profileId.value !== user.id) {
      if (profileId.value) $reset()
      profileId.value = user.id
    }
    return { profileId: user.id, generation }
  }

  const rememberOwnership = entries => {
    const next = { ...ownershipByProductId.value }
    for (const entry of entries) {
      const key = String(entry.product_id)
      next[key] = entry
      ownershipFetchedAt.set(key, Date.now())
    }
    ownershipByProductId.value = next
  }

  const loadOwnership = async (productIds, { force = false } = {}) => {
    const context = await accountContext()
    if (!context) return []
    const ids = [...new Set((productIds || []).map(String).filter(id => /^[1-9]\d*$/.test(id)))]
    if (!ids.length) return []
    ownershipError.value = ''

    const missing = ids.filter(id => force || !ownershipFetchedAt.has(id) || Date.now() - ownershipFetchedAt.get(id) >= CACHE_TTL)
    const waits = new Set(missing.map(id => ownershipRequests.get(id)).filter(Boolean))
    const newIds = missing.filter(id => !ownershipRequests.has(id))

    for (let start = 0; start < newIds.length; start += 100) {
      const batch = newIds.slice(start, start + 100)
      const request = getPurchaseOwnership(context.profileId, batch)
        .then(ownership => {
          if (!matches(context)) return
          const byId = new Map(ownership.map(entry => [String(entry.product_id), entry]))
          const next = { ...ownershipByProductId.value }
          for (const id of batch) {
            // Explicit null distinguishes a checked non-purchase from an unknown ID.
            next[id] = byId.get(id) || null
            ownershipFetchedAt.set(id, Date.now())
          }
          ownershipByProductId.value = next
        })
        .catch(cause => {
          if (matches(context)) ownershipError.value = cause?.data?.statusMessage || cause?.message || 'Purchase status could not be checked.'
          throw cause
        })
        .finally(() => {
          for (const id of batch) if (ownershipRequests.get(id) === request) ownershipRequests.delete(id)
        })
      for (const id of batch) ownershipRequests.set(id, request)
      waits.add(request)
    }

    await Promise.all(waits)
    return matches(context) ? ids.map(id => ownershipByProductId.value[id]).filter(Boolean) : []
  }

  const fetchPurchases = async ({ page: requestedPage = 1, search = '', productId = null, force = false } = {}) => {
    const context = await accountContext()
    if (!context) return
    const filters = { page: Math.max(1, Math.trunc(Number(requestedPage) || 1)), pageSize: pageSize.value, search: String(search).trim(), productId }
    const key = JSON.stringify(filters)
    if (!force && listCache?.key === key && Date.now() - listCache.at < CACHE_TTL) return
    const requestNumber = ++listRequestNumber
    loading.value = true
    error.value = ''
    let request = listRequests.get(key)
    if (!request) {
      request = getPurchases(context.profileId, filters)
      listRequests.set(key, request)
    }
    try {
      const response = await request
      if (!matches(context) || requestNumber !== listRequestNumber) return
      items.value = response.items
      total.value = response.total
      page.value = response.page
      rememberOwnership(response.items)
      listCache = { key, at: Date.now() }
    } catch (cause) {
      if (matches(context) && requestNumber === listRequestNumber) {
        error.value = cause?.data?.statusMessage || cause?.message || 'Your purchases could not be loaded.'
      }
    } finally {
      if (listRequests.get(key) === request) listRequests.delete(key)
      if (matches(context) && requestNumber === listRequestNumber) loading.value = false
    }
  }

  const invalidate = () => {
    // Preserve visible data while refreshing, but reject all older responses.
    generation += 1
    listRequestNumber += 1
    loading.value = false
    listCache = null
    listRequests.clear()
    ownershipRequests.clear()
    ownershipFetchedAt.clear()
  }

  const applyDownload = (productId, download) => {
    if (!download) return
    const key = String(productId)
    const count = Math.max(0, Number(download.download_count) || 0)
    const limit = Math.max(0, Number(download.download_limit) || 0)
    const metadata = {
      is_downloaded: Boolean(download.is_downloaded),
      downloaded_at: download.downloaded_at || null,
      download_count: count,
      download_limit: limit,
      downloads_remaining: Math.max(0, Number(download.downloads_remaining) || 0),
      can_download: Boolean(download.can_download),
    }
    if (download.version || download.latest_version) metadata.latest_version = download.version || download.latest_version
    if (Object.prototype.hasOwnProperty.call(download, 'update_available')) metadata.update_available = Boolean(download.update_available)
    items.value = items.value.map(item => String(item.product_id) === key ? { ...item, ...metadata } : item)
    if (ownershipByProductId.value[key]) {
      ownershipByProductId.value = { ...ownershipByProductId.value, [key]: { ...ownershipByProductId.value[key], ...metadata } }
    }
    listCache = null
  }

  return {
    profileId, items, total, page, pageSize, totalPages, loading, error, ownershipError,
    ownershipByProductId, isPurchased, loadOwnership, fetchOwnership: loadOwnership,
    fetchPurchases, invalidate, applyDownload, $reset,
  }
})
