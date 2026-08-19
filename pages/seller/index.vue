<script setup>
import { onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../services/sellerService'

const seller = ref(null)
const errorMessage = ref('')

onMounted(async () => {
  try {
    seller.value = await getCurrentSeller()
  } catch (error) {
    errorMessage.value = 'Unable to load your seller workspace.'
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto py-8 font-poppins">
    <div v-if="errorMessage" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">{{ errorMessage }}</div>

    <div v-else-if="!seller" class="min-h-[16rem] flex items-center justify-center text-text-muted">Loading your seller workspace...</div>

    <template v-else>
      <section class="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-8 md:p-10 text-white shadow-xl shadow-primary/15">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Seller workspace</p>
        <h1 class="mt-3 text-3xl md:text-4xl font-black">{{ seller.store_name }}</h1>
        <p class="mt-3 text-white/80">Your store is approved and ready for marketplace operations.</p>
      </section>

      <section class="mt-6 grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl bg-surface border border-bg-alt/50 p-6">
          <p class="text-sm font-semibold text-text-muted">Store status</p>
          <p class="mt-2 text-xl font-black text-green-600 capitalize">{{ seller.status }}</p>
        </div>
        <div class="rounded-2xl bg-surface border border-bg-alt/50 p-6 md:col-span-2">
          <p class="text-sm font-semibold text-text-muted">Store URL</p>
          <p class="mt-2 text-xl font-black text-text-main">/stores/{{ seller.store_slug }}</p>
        </div>
      </section>

      <section class="mt-6 rounded-2xl border border-bg-alt/50 bg-surface p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-xl font-black text-text-main">Products</h2>
            <p class="mt-1 text-text-muted">Add products and track their moderation status.</p>
          </div>
          <div class="flex flex-wrap gap-3">
            <NuxtLink to="/seller/products" class="rounded-xl border border-primary/25 px-4 py-2.5 font-bold text-primary hover:bg-primary/5">My products</NuxtLink>
            <NuxtLink to="/seller/products/new" class="rounded-xl bg-primary px-4 py-2.5 font-bold text-white hover:bg-primary-dark">Add product</NuxtLink>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
