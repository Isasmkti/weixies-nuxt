import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useProductsStore } from '../stores/productsStore'
import { useCartStore } from '../stores/cartStore'
import { useCategoriesStore } from '../stores/categoriesStore'
import { getUser } from '../services/authService'
import { getCurrentSeller } from '../services/sellerService'
import { useRouter } from 'vue-router'
import { formatIDR } from '../utils/currency'
import { usePurchasesStore } from '../stores/purchasesStore'
import { showErrorDialog } from '../utils/sweetAlert'

export function useCatalogUI({ initialSearch = '' } = {}) {
  const router = useRouter()
  const productsStore = useProductsStore()
  const cartStore = useCartStore()
  const categoriesStore = useCategoriesStore()
  const purchasesStore = usePurchasesStore()
  const profileId = ref(null)

  const products = computed(() => productsStore.products)
  const categories = computed(() => categoriesStore.categories)
  const selectedCategory = computed(() => productsStore.categorySlug)
  const loading = computed(() => productsStore.loading || categoriesStore.loading)
  const error = computed(() => productsStore.error || categoriesStore.error)

  const addingToCart = ref(null)
  const ownSellerId = ref(null)
  const searchInput = ref(initialSearch)
  let timeout = null

  watch(searchInput, (val) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      productsStore.setSearch(val)
    }, 400)
  })

  onMounted(async () => {
    const user = await getUser()
    profileId.value = user?.id || null
    const promises = [
      productsStore.ensureProductsLoaded({ force: false }),
      categoriesStore.fetchCategories()
    ]

    if (user) {
      promises.push(cartStore.stGetCart(user.id))
      promises.push(getCurrentSeller().then((seller) => { ownSellerId.value = seller?.id || null }))
    }

    await Promise.all(promises)
  })

  watch(() => [profileId.value, ...products.value.map(product => product.id)], () => {
    if (profileId.value) purchasesStore.loadOwnership(products.value.map(product => product.id)).catch(() => {})
  })
  onBeforeUnmount(() => clearTimeout(timeout))
  const isPurchased = productId => purchasesStore.isPurchased(productId)

  const onSortChange = (e) => {
    const [by, order] = e.target.value.split('-')
    productsStore.changeSort({ by, order })
  }

  const setCategory = (slug) => {
    productsStore.setCategory(slug)
  }

  const goToPage = async (page) => {
    const lastPage = Math.max(productsStore.totalPages, 1)
    const requestedPage = Number(page)
    const nextPage = Math.min(
      Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1),
      lastPage
    )

    if (productsStore.loading || nextPage === productsStore.page) return

    await productsStore.stAll(nextPage, { force: true })

    if (import.meta.client) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const addToCart = async (productId) => {
    const product = products.value.find((item) => item.id === productId)
    if (isOwnProduct(product)) return
    if (isPurchased(productId)) return router.push(`/purchases?product=${productId}`)
    const licenses = [...(product?.product_licenses || [])]
      .filter((license) => license.is_active !== false)
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    if (licenses.length !== 1) {
      if (product?.slug) router.push(`/products/${product.slug}`)
      return
    }
    const user = await getUser()
    if (!user) {
      router.push('/login')
      return
    }
    try {
      addingToCart.value = productId
      await cartStore.stAddToCart(user.id, productId, licenses[0].id)
    } catch (err) {
      await purchasesStore.loadOwnership([productId], { force: true }).catch(() => {})
      await showErrorDialog('Unable to add product', err?.message || 'Failed to add to cart.')
    } finally {
      addingToCart.value = null
    }
  }

  const getMainImage = (product) => {
    if (product?.product_images && product.product_images.length > 0) {
      const main = product.product_images.find(img => img.is_primary)
      if (main && main.image_url) return main.image_url
      if (product.product_images[0]?.image_url) return product.product_images[0].image_url
    }
    if (product?.image_url) return product.image_url
    return null
  }

  const isOwnProduct = (product) => Boolean(
    product?.seller_id
    && ownSellerId.value
    && String(product.seller_id) === String(ownSellerId.value)
  )

  return {
    products,
    categories,
    selectedCategory,
    loading,
    error,
    searchInput,
    addingToCart,
    onSortChange,
    setCategory,
    goToPage,
    addToCart,
    getMainImage,
    isOwnProduct,
    isPurchased,
    productsStore,
    cartStore,
    formatIDR
  }
}
