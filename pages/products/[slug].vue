<template>
  <div class="mx-auto max-w-[1120px] font-[Inter,sans-serif]">
    <div v-if="loading" class="flex flex-col items-center justify-center py-28"><span class="h-12 w-12 animate-spin rounded-full border-4 border-primary/25 border-t-primary"></span><p class="mt-4 font-medium text-text-muted">Loading product...</p></div>
    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700"><h1 class="text-xl font-black">Product not available</h1><p class="mt-2">{{ error }}</p><NuxtLink to="/products" class="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 font-bold text-white">Back to catalog</NuxtLink></div>

    <div v-else-if="product" class="flex flex-col gap-8">
      <button type="button" class="inline-flex w-fit items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-text-muted transition hover:text-primary" @click="goBack">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7" /></svg>
        Kembali
      </button>

      <section class="product-overview">
        <div class="product-gallery flex min-w-0 flex-col gap-2">
          <div class="group relative aspect-video overflow-hidden rounded-xl border border-bg-alt bg-surface shadow-sm">
            <img v-if="selectedImage" :src="selectedImage" :alt="product.name" class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
            <defaultProduct v-else class="h-full w-full p-20 text-text-muted/50" />
            <button class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-text-muted shadow-sm backdrop-blur transition hover:scale-110 hover:text-red-500" :class="wishlistStore.isWishlisted(product.id) ? 'bg-red-500 text-white hover:text-white' : ''" @click="toggleWishlist(product.id)">
              <svg xmlns="http://www.w3.org/2000/svg" :fill="wishlistStore.isWishlisted(product.id) ? 'currentColor' : 'none'" class="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0Z" /></svg>
            </button>
          </div>
          <div v-if="productImages.length" class="grid grid-cols-4 gap-2">
            <button v-for="(image, index) in productImages.slice(0, 4)" :key="image.id || image.image_url || index" class="aspect-video overflow-hidden rounded-lg border-2 bg-bg-alt transition" :class="selectedImage === image.image_url ? 'border-primary opacity-100' : 'border-bg-alt opacity-70 hover:border-primary/40 hover:opacity-100'" @click="selectedImage = image.image_url"><img :src="image.image_url" :alt="`${product.name} preview ${index + 1}`" class="h-full w-full object-cover"></button>
          </div>
        </div>

        <aside class="product-buy-panel flex min-w-0 flex-col gap-4">
          <div class="flex flex-wrap items-center gap-2">
            <span v-for="category in product.categories" :key="category.id" class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{{ category.name }}</span>
            <span class="inline-flex items-center gap-1 text-xs font-semibold text-text-muted"><span class="text-amber-500">&#9733;</span>{{ product.reviewCount ? product.averageRating.toFixed(1) : '0.0' }} ({{ product.reviewCount || 0 }})</span>
          </div>
          <div>
            <h1 class="text-2xl font-semibold leading-8 tracking-tight text-text-main md:text-[32px] md:leading-10">{{ product.name }}</h1>
            <p class="mt-1 text-sm leading-5 text-text-muted md:text-base md:leading-6">{{ shortDescription }}</p>
          </div>
          <p class="mt-2 text-4xl font-bold leading-tight tracking-tight text-primary md:text-5xl">{{ formattedPrice }}</p>

          <div class="mt-2 grid gap-2">
            <button :disabled="addingToCart === product.id" class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70" @click="buyNow"><span v-if="addingToCart === product.id" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span><svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Zm-3 4h18M16 10a4 4 0 0 1-8 0" /></svg><span>Beli Sekarang</span></button>
            <button :disabled="addingToCart === product.id" class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-bg-alt bg-transparent px-5 py-4 text-sm font-semibold text-text-main transition hover:bg-bg-alt/50 disabled:cursor-not-allowed disabled:opacity-70" @click="isInCart(product.id) ? router.push('/cart') : addToCart()"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3A1 1 0 0 0 5.8 17H17" /></svg><span v-if="isInCart(product.id)">Lihat Keranjang</span><span v-else>Tambah ke Keranjang</span></button>
          </div>

          <div class="mt-4 flex items-center gap-4 border-t border-bg-alt pt-4">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-bg-alt bg-bg-alt text-lg font-bold text-primary">
              <img v-if="sellerStore?.store_image_url" :src="sellerStore.store_image_url" :alt="sellerName" class="h-full w-full object-cover">
              <span v-else>{{ sellerName.charAt(0) }}</span>
            </div>
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-text-main">{{ sellerName }}</p><p class="mt-1 text-xs text-text-muted">{{ sellerMeta }}</p></div>
            <NuxtLink v-if="sellerStore" :to="`/stores/${sellerStore.store_slug}`" class="shrink-0 rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10">Lihat Toko</NuxtLink>
          </div>

          <div class="mt-2 rounded-xl border border-bg-alt bg-bg-alt/40 p-4">
            <h3 class="text-xs font-semibold uppercase tracking-wider text-text-main">Detail File</h3>
            <dl class="mt-3 space-y-2.5 text-xs">
              <div class="flex justify-between gap-4 border-b border-bg-alt pb-2.5"><dt class="text-text-muted">Format File</dt><dd class="text-right font-semibold text-text-main">{{ productFileFormat }}</dd></div>
              <div class="flex justify-between gap-4 border-b border-bg-alt pb-2.5"><dt class="text-text-muted">Ukuran File</dt><dd class="text-right font-semibold text-text-main">{{ productFileSize }}</dd></div>
              <div class="flex justify-between gap-4 border-b border-bg-alt pb-2.5"><dt class="text-text-muted">Versi</dt><dd class="text-right font-semibold text-text-main">{{ latestProductFile?.version || '-' }}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-text-muted">Update Terakhir</dt><dd class="text-right font-semibold text-text-main">{{ formatDate(latestProductFile?.created_at || product.created_at) }}</dd></div>
            </dl>
          </div>
        </aside>
      </section>

      <section class="border-t border-bg-alt pt-8">
        <h2 class="text-2xl font-semibold text-text-main">Deskripsi Produk</h2>
        <div class="mt-5 max-w-4xl whitespace-pre-line text-sm leading-6 text-text-muted md:text-base md:leading-7">{{ product.description || 'Belum ada deskripsi untuk produk ini.' }}</div>
      </section>

      <section v-if="productSpecs.length" class="border-t border-bg-alt pt-8">
        <h2 class="text-2xl font-semibold text-text-main">Product Specifications</h2>
        <dl class="mt-5 overflow-hidden rounded-xl border border-bg-alt bg-surface">
          <div v-for="spec in productSpecs" :key="spec.id" class="grid gap-1 border-b border-bg-alt px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(0,1.2fr)] sm:gap-6">
            <dt class="text-sm font-semibold text-text-main">{{ spec.spec_name }}</dt>
            <dd class="break-words text-sm leading-6 text-text-muted">{{ spec.spec_value }}</dd>
          </div>
        </dl>
      </section>

      <section class="border-t border-bg-alt pt-8">
        <h2 class="text-2xl font-semibold text-text-main">Ulasan Pelanggan</h2>
        <div v-if="reviewsStore.loading" class="py-10 text-center text-text-muted">Memuat ulasan...</div>
        <div v-else-if="!reviewsStore.reviews.length" class="mt-5 rounded-xl border border-dashed border-bg-alt p-8 text-center text-text-muted">Belum ada ulasan.</div>
        <div v-else class="mt-5 space-y-4">
          <article v-for="review in reviewsStore.reviews" :key="review.id" class="rounded-xl border border-bg-alt bg-surface p-5 shadow-sm">
            <div class="flex items-start gap-3"><img v-if="review.profiles?.profile_img" :src="review.profiles.profile_img" alt="Reviewer" class="h-10 w-10 rounded-full object-cover"><span v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-bg-alt font-semibold text-text-muted">{{ review.profiles?.full_name?.charAt(0) || 'U' }}</span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><p class="font-semibold text-text-main">{{ review.profiles?.full_name || 'Anonymous user' }}</p><time class="text-xs text-text-muted">{{ formatDate(review.created_at) }}</time></div><div class="mt-1 flex text-amber-500"><svg v-for="index in 5" :key="index" class="h-4 w-4" :class="index <= review.rating ? 'fill-current' : 'fill-none text-bg-alt'" viewBox="0 0 20 20" stroke="currentColor"><path d="m10 2 2.2 4.7 5.1.6-3.8 3.5 1 5-4.5-2.5-4.5 2.5 1-5-3.8-3.5 5.1-.6L10 2Z" /></svg></div></div></div>
            <p class="mt-4 leading-relaxed text-text-muted">{{ review.comment }}</p>
          </article>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import defaultProduct from '../../components/defaultProduct.vue'
import { getUser } from '../../services/authService'
import { useReviewsStore } from '../../stores/reviewsStore'
import { supabase } from '../../utils/supabase'

definePageMeta({ layout: 'product' })

const props = defineProps({ slug: { type: String, required: true } })
const router = useRouter()
const wishlistStore = useWishlistStore()
const reviewsStore = useReviewsStore()
const profileId = ref(null)
const sellerStore = ref(null)
const { product, loading, error, addingToCart, formattedPrice, addToCart, productImages, selectedImage, cartStore } = useProductDetailUI(props.slug)

const shortDescription = computed(() => String(product.value?.description || '').slice(0, 220) || 'Produk digital yang siap digunakan untuk proyek Anda berikutnya.')
const productSpecs = computed(() => [...(product.value?.product_specs || [])]
  .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)))
const latestProductFile = computed(() => [...(product.value?.product_files || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null)
const productFileFormat = computed(() => {
  const fileName = latestProductFile.value?.file_name
  if (!fileName?.includes('.')) return 'Digital file'
  return `.${fileName.split('.').pop().toUpperCase()}`
})
const productFileSize = computed(() => {
  const bytes = Number(latestProductFile.value?.file_size)
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / (1024 ** unitIndex)
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: unitIndex ? 1 : 0 }).format(size)} ${units[unitIndex]}`
})
const formatDate = (value) => value ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '-'
const sellerName = computed(() => sellerStore.value?.store_name || 'Weixies Marketplace')
const sellerMeta = computed(() => sellerStore.value?.created_at
  ? `Member sejak ${new Date(sellerStore.value.created_at).getFullYear()}`
  : 'Penjual produk digital')
const isInCart = (productId) => (cartStore?.items || []).some((item) => item.product_id === productId) || cartStore?.addingProducts?.[productId]
const goBack = () => {
  if (window.history.length > 1) return router.back()
  return router.push('/products')
}
const buyNow = async () => {
  if (isInCart(product.value.id)) return router.push('/cart')
  const user = await getUser()
  if (!user) return router.push('/login')
  await addToCart()
  return router.push('/cart')
}
const toggleWishlist = async (productId) => { if (!profileId.value) { const user = await getUser(); if (!user) return router.push('/login'); profileId.value = user.id }; await wishlistStore.stToggleWishlist(profileId.value, productId) }

onMounted(async () => { const user = await getUser(); if (user) { profileId.value = user.id; await wishlistStore.stGetWishlists(user.id) } })
watch(product, (nextProduct) => { if (nextProduct?.id) reviewsStore.fetchReviews(nextProduct.id) }, { immediate: true })
watch(product, async (nextProduct) => {
  sellerStore.value = null
  if (!nextProduct?.seller_id) return
  const { data } = await supabase.from('approved_seller_stores').select('store_name, store_slug, store_description, store_image_url, created_at').eq('id', nextProduct.seller_id).maybeSingle()
  sellerStore.value = data || null
}, { immediate: true })
</script>

<style scoped>
.product-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
}

.product-gallery > :first-child,
.product-gallery img {
  aspect-ratio: 16 / 9;
}

@media (min-width: 768px) {
  .product-overview {
    grid-template-columns: minmax(0, 56fr) minmax(20rem, 44fr);
  }
}
</style>
