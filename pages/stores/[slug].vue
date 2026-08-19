<script setup>
import { computed, watch } from 'vue'
import defaultProduct from '../../components/defaultProduct.vue'
import { supabase } from '../../utils/supabase'

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

const { data: store, error: storeError } = await useAsyncData(
  () => `store-${slug.value}`,
  async () => {
    const { data, error } = await supabase
      .from('approved_seller_stores')
      .select('id, store_name, store_slug, store_description, created_at')
      .eq('store_slug', slug.value)
      .maybeSingle()
    if (error) throw error
    return data
  },
  { watch: [slug] },
)

const { data: products, pending: productsLoading, error: productsError, refresh: refreshProducts } = await useAsyncData(
  () => `store-products-${slug.value}`,
  async () => {
    if (!store.value?.id) return []
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, description, price, product_images(image_url, is_primary)')
      .eq('seller_id', store.value.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
  { watch: [store] },
)

watch(store, () => refreshProducts())

const mainImage = (product) => {
  const images = product.product_images || []
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
}

const formatIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value) || 0)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8 font-poppins sm:px-6 lg:px-0">
    <div v-if="storeError || !store" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
      This store is not available.
    </div>
    <template v-else>
      <section class="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-7 text-white shadow-xl shadow-primary/15 sm:p-10">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Marketplace store</p>
        <h1 class="mt-3 text-3xl font-black sm:text-4xl">{{ store.store_name }}</h1>
        <p v-if="store.store_description" class="mt-3 max-w-2xl text-white/80">{{ store.store_description }}</p>
      </section>

      <section class="mt-8">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-black text-text-main">Products</h2>
          <NuxtLink to="/products" class="text-sm font-bold text-primary hover:underline">Browse all products</NuxtLink>
        </div>
        <div v-if="productsLoading" class="mt-5 rounded-2xl border border-bg-alt bg-surface p-8 text-center text-text-muted">Loading products...</div>
        <div v-else-if="productsError" class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">Products could not be loaded.</div>
        <div v-else-if="!products?.length" class="mt-5 rounded-2xl border border-dashed border-bg-alt bg-surface p-8 text-center text-text-muted">No published products yet.</div>
        <div v-else class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink v-for="product in products" :key="product.id" :to="`/products/${product.slug}`" class="group overflow-hidden rounded-2xl border border-bg-alt bg-surface transition hover:-translate-y-1 hover:shadow-xl">
            <div class="aspect-[4/3] bg-bg-alt">
              <img v-if="mainImage(product)" :src="mainImage(product)" :alt="product.name" class="h-full w-full object-cover">
              <defaultProduct v-else class="h-full w-full p-12 text-text-muted/50" />
            </div>
            <div class="p-5">
              <h3 class="truncate text-lg font-black text-text-main group-hover:text-primary">{{ product.name }}</h3>
              <p class="mt-2 line-clamp-2 text-sm text-text-muted">{{ product.description }}</p>
              <p class="mt-4 font-black text-text-main">{{ formatIDR(product.price) }}</p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>
