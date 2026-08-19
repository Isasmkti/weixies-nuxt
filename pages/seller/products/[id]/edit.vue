<script setup>
import { onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../../../services/sellerService'
import { sGetSellerProduct, sUpdateSellerProduct } from '../../../../services/sellerProductsService'

const route = useRoute()
const router = useRouter()
const sellerId = ref(null)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const product = ref(null)

onMounted(async () => {
  try {
    const seller = await getCurrentSeller()
    if (!seller?.id) throw new Error('Seller profile was not found.')
    sellerId.value = seller.id
    product.value = await sGetSellerProduct(route.params.id, seller.id)
    if (!product.value) throw new Error('Product not found or you do not have access to it.')
  } catch (error) {
    errorMessage.value = error.message || 'Unable to load product.'
  } finally {
    loading.value = false
  }
})

const submit = async (form) => {
  if (!sellerId.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await sUpdateSellerProduct(route.params.id, sellerId.value, form)
    await router.push('/seller/products')
  } catch (error) {
    errorMessage.value = error.message || 'Unable to update product.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 font-poppins">
    <NuxtLink to="/seller/products" class="inline-flex text-sm font-bold text-text-muted hover:text-primary">← My products</NuxtLink>
    <h1 class="mt-4 text-3xl font-black text-text-main">Edit product</h1>
    <p class="mt-2 text-text-muted">Changes are sent back for review before being published.</p>

    <div v-if="loading" class="mt-8 rounded-2xl border border-bg-alt bg-surface p-10 text-center text-text-muted">Loading product...</div>
    <SellerProductForm v-else-if="!errorMessage && product" class="mt-8" :initial-product="product" :submitting="saving" submit-label="Save and submit for review" @submit="submit" />
    <div v-else class="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{{ errorMessage }}</div>
  </div>
</template>
