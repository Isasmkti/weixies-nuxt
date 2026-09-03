import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProductsStore } from '../stores/productsStore'
import { useCartStore } from '../stores/cartStore'
import { getUser } from '../services/authService'
import { formatIDR } from '../utils/currency'

export function useProductDetailUI(initialSlug) {
  const router = useRouter()
  const route = useRoute()
  const productsStore = useProductsStore()
  const cartStore = useCartStore()

  const product = ref(null)
  const loading = ref(true)
  const error = ref('')
  const addingToCart = ref(null)

  const productImages = computed(() => {
    if (!product.value) return []
    if (product.value.product_images && product.value.product_images.length > 0) {
      return [...product.value.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    }
    if (product.value.image_url) {
      return [{ image_url: product.value.image_url, is_primary: true }]
    }
    return []
  })

  const selectedImage = ref('')
  const selectedLicenseId = ref('')

  const productLicenses = computed(() => [...(product.value?.product_licenses || [])]
    .filter((license) => license.is_active !== false)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)))
  const selectedLicense = computed(() => productLicenses.value.find((license) => license.id === selectedLicenseId.value) || null)

  watch(productImages, (images) => {
    if (images.length > 0) {
      const primary = images.find(img => img.is_primary)
      selectedImage.value = primary ? primary.image_url : images[0].image_url
    } else {
      selectedImage.value = ''
    }
  }, { immediate: true })

  watch(productLicenses, (licenses) => {
    if (!licenses.some((license) => license.id === selectedLicenseId.value)) {
      selectedLicenseId.value = licenses[0]?.id || ''
    }
  }, { immediate: true })

  const formattedPrice = computed(() => {
    return formatIDR(selectedLicense.value?.price ?? product.value?.price)
  })

  const randomProducts = ref([])

  const fetchRandomProducts = async () => {
    try {
      if (productsStore.products.length === 0) {
        await productsStore.ensureProductsLoaded({ force: false })
      }

      const allProducts = productsStore.products
      const currentSlug = route.params.slug || initialSlug

      const others = allProducts.filter(p => p.slug !== currentSlug)
      const shuffled = [...others].sort(() => 0.5 - Math.random())
      randomProducts.value = shuffled.slice(0, 3)
    } catch (err) {
      console.error('Error fetching random products:', err)
    }
  }

  const fetchProduct = async () => {
    const slug = route.params.slug || initialSlug
    if (!slug) return
    loading.value = true
    error.value = ''
    try {
      const foundProduct = await productsStore.sGetBySlug(slug)
      if (!foundProduct) {
        throw new Error('The product could not be found.')
      }

      product.value = foundProduct

      await fetchRandomProducts()

      const user = await getUser()
      if (user && cartStore.items.length === 0) {
        await cartStore.stGetCart(user.id)
      }
    } catch (err) {
      product.value = null
      error.value = err.message || 'Failed to load this product.'
      console.error('Error fetching product:', err)
    } finally {
      loading.value = false
    }
  }

  const addToCart = async (productId) => {
    const id = productId || product.value?.id
    if (!id) return
    if (!selectedLicenseId.value) throw new Error('This product does not have an active license.')
    const user = await getUser()
    if (!user) {
      router.push('/login')
      return
    }
    try {
      addingToCart.value = id
      await cartStore.stAddToCart(user.id, id, selectedLicenseId.value)
    } catch (err) {
      console.error('Failed to add to cart:', err)
    } finally {
      addingToCart.value = null
    }
  }

  onMounted(fetchProduct)
  watch(() => route.params.slug, fetchProduct)

  return {
    product,
    loading,
    error,
    addingToCart,
    formattedPrice,
    addToCart,
    productImages,
    selectedImage,
    productLicenses,
    selectedLicense,
    selectedLicenseId,
    randomProducts,
    cartStore,
    formatIDR
  }
}
