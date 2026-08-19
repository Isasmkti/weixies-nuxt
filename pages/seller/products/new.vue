<script setup>
import { ref } from 'vue'
import { getCurrentSeller } from '../../../services/sellerService'
import { sCreateSellerProduct } from '../../../services/sellerProductsService'

const router = useRouter()
const saving = ref(false)
const errorMessage = ref('')
const submit = async (product) => {
  saving.value = true
  errorMessage.value = ''
  try {
    const seller = await getCurrentSeller()
    if (!seller?.id) throw new Error('Seller profile was not found.')
    await sCreateSellerProduct(seller.id, product)
    await router.push('/seller/products')
  } catch (error) {
    errorMessage.value = error.message || 'Unable to submit product.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 font-poppins">
    <NuxtLink to="/seller/products" class="inline-flex text-sm font-bold text-text-muted hover:text-primary">← My products</NuxtLink>
    <h1 class="mt-4 text-3xl font-black text-text-main">Add a product</h1>
    <p class="mt-2 text-text-muted">Your submission will be marked for review before it appears in the catalog.</p>

    <SellerProductForm class="mt-8" :submitting="saving" submit-label="Submit for review" @submit="submit" />
    <div v-if="errorMessage" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{{ errorMessage }}</div>
  </div>
</template>
