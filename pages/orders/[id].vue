<template>
  <div class="max-w-4xl mx-auto font-poppins px-4 sm:px-6 lg:px-0">
    <!-- Back -->
    <div class="mb-6">
      <NuxtLink to="/orders" class="inline-flex items-center gap-2 text-text-muted hover:text-primary font-semibold transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Orders
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24">
      <div class="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-primary shadow-lg shadow-primary/30"></div>
      <p class="mt-4 text-text-muted font-medium animate-pulse">Loading order details...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-surface rounded-3xl border border-bg-alt p-12 text-center">
      <h2 class="text-2xl font-bold text-text-main mb-2">Order not found</h2>
      <p class="text-text-muted mb-6">{{ error }}</p>
      <NuxtLink to="/orders" class="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white hover:bg-primary-dark transition-colors">
        Back to Orders
      </NuxtLink>
    </div>

    <!-- Order Detail -->
    <div v-else-if="order" class="space-y-6">
      <h1 class="text-3xl sm:text-4xl font-extrabold text-text-main tracking-tight">Order Detail</h1>

      <!-- Order Info Card -->
      <section class="relative overflow-hidden rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface p-6 sm:p-8 shadow-xl">
        <div class="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-[80px]"></div>
        <div class="relative grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Order Number</p>
            <p class="font-bold text-text-main font-mono text-sm">{{ order.order_number }}</p>
          </div>
          <div>
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Status</p>
            <span :class="['inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide', statusClass(order.status)]">
              <span :class="['h-1.5 w-1.5 rounded-full', statusDotClass(order.status)]"></span>
              {{ order.status }}
            </span>
          </div>
          <div>
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Total</p>
            <p class="font-extrabold text-primary text-lg">{{ formatIDR(order.total_amount) }}</p>
          </div>
          <div>
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Order Date</p>
            <p class="font-semibold text-text-main text-sm">{{ formatDate(order.created_at) }}</p>
          </div>
          <div v-if="order.paid_at">
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Paid At</p>
            <p class="font-semibold text-emerald-500 text-sm">{{ formatDate(order.paid_at) }}</p>
          </div>
          <div v-if="order.payment_url">
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Payment URL</p>
            <a :href="order.payment_url" target="_blank" rel="noreferrer" class="font-semibold text-primary text-xs break-all underline">
              Open payment page
            </a>
          </div>
          <div v-if="order.payment_method">
            <p class="text-xs text-text-muted font-semibold uppercase tracking-widest mb-1">Payment Method</p>
            <p class="font-semibold text-text-main capitalize">{{ order.payment_method }}</p>
          </div>
        </div>
      </section>

      <!-- Items Section -->
      <section class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface overflow-hidden shadow-lg">
        <div class="px-6 py-4 border-b border-bg-alt/60">
          <h2 class="text-xl font-bold text-text-main">Purchased Items</h2>
        </div>
        <div class="divide-y divide-bg-alt/60">
          <div
            v-for="item in order.order_items"
            :key="item.id"
            class="p-6 flex items-center gap-5 group"
          >
            <!-- Image -->
            <div class="h-20 w-20 flex-shrink-0 rounded-2xl overflow-hidden border border-bg-alt bg-bg-alt">
              <img
                v-if="item.product?.product_images?.[0]?.image_url"
                :src="item.product.product_images[0].image_url"
                :alt="item.product?.name"
                class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div v-else class="h-full w-full flex items-center justify-center text-text-muted/40">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>

            <!-- Info -->
            <div class="flex-grow min-w-0">
              <h3 class="font-bold text-text-main text-lg group-hover:text-primary transition-colors">{{ item.product?.name }}</h3>
              <p class="text-sm text-text-muted font-montserrat line-clamp-2 mt-1">{{ item.product?.description }}</p>
              <p class="font-extrabold text-primary mt-2">{{ formatIDR(item.price) }}</p>
            </div>

            <!-- Actions -->
            <div class="flex-shrink-0 flex flex-col items-end gap-2">
              <!-- Download (paid only) -->
              <button
                v-if="order.status === 'paid'"
                @click="handleDownload(item)"
                :disabled="downloadingItem === item.product?.id"
                class="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-5 py-2.5 font-semibold text-white transition-all duration-300 shadow-md shadow-emerald-500/30 disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5"
              >
                <span v-if="downloadingItem === item.product?.id" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {{ downloadingItem === item.product?.id ? 'Preparing...' : 'Download ZIP' }}
              </button>

              <!-- Pending state -->
              <div v-else-if="order.status === 'pending'" class="flex flex-col items-end gap-1">
                <span class="text-xs text-yellow-500 font-semibold flex items-center gap-1">
                  <span class="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
                  Waiting for payment
                </span>
                <button
                  v-if="order.payment_url"
                  @click="continuePayment"
                  class="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-white transition-colors hover:bg-primary-dark"
                >
                  Continue Payment
                </button>
              </div>

              <!-- Other states -->
              <span v-else class="text-xs text-text-muted italic capitalize">{{ order.status }}</span>

              <!-- View Product -->
              <NuxtLink
                v-if="item.product?.slug"
                :to="`/products/${item.product.slug}`"
                class="text-xs text-primary font-semibold hover:underline"
              >
                View Product →
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Payment History -->
      <section v-if="order.payments && order.payments.length > 0" class="rounded-2xl sm:rounded-[2rem] border border-bg-alt/60 bg-surface overflow-hidden shadow-lg">
        <div class="px-6 py-4 border-b border-bg-alt/60">
          <h2 class="text-xl font-bold text-text-main">Payment History</h2>
        </div>
        <div class="divide-y divide-bg-alt/60">
          <div
            v-for="payment in order.payments"
            :key="payment.id"
            class="px-6 py-4 flex items-center justify-between flex-wrap gap-3"
          >
            <div>
              <p class="font-semibold text-text-main capitalize">{{ payment.payment_method || payment.provider || 'Payment' }}</p>
              <p class="text-xs text-text-muted font-montserrat">{{ formatDate(payment.created_at) }}</p>
              <p v-if="payment.provider_invoice_id" class="text-[11px] text-text-muted font-mono break-all mt-1">
                {{ payment.provider_invoice_id }}
              </p>
            </div>
            <div class="flex items-center gap-4">
              <p class="font-bold text-text-main">{{ payment.paid_at ? formatDate(payment.paid_at) : formatDate(payment.created_at) }}</p>
              <span :class="['px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide', statusClass(payment.status)]">
                {{ payment.status }}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getUser } from '../../services/authService'
import { supabase } from '../../utils/supabase'
import { formatIDR } from '../../utils/currency'

const props = defineProps({
  id: { type: String, required: true }
})

const router = useRouter()

const order = ref(null)
const loading = ref(true)
const error = ref(null)
const currentUser = ref(null)
const downloadingItem = ref(null)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

const statusClass = (status) => {
  const map = {
    paid: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30',
    pending: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 ring-1 ring-yellow-500/30',
    failed: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',
    expired: 'bg-gray-50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 ring-1 ring-gray-400/30',
    cancelled: 'bg-gray-50 dark:bg-gray-900/20 text-gray-500 dark:text-gray-400 ring-1 ring-gray-400/30',
    refunded: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30',
    partially_refunded: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/30',
    chargeback: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 ring-1 ring-red-500/30',
  }
  return map[status] || 'bg-gray-100 text-gray-500'
}

const statusDotClass = (status) => {
  const map = {
    paid: 'bg-emerald-500',
    pending: 'bg-yellow-500 animate-pulse',
    failed: 'bg-red-500',
    expired: 'bg-gray-400',
    cancelled: 'bg-gray-400',
    refunded: 'bg-blue-500',
    partially_refunded: 'bg-blue-500',
    chargeback: 'bg-red-500',
  }
  return map[status] || 'bg-gray-400'
}

onMounted(async () => {
  const user = await getUser()
  if (!user) {
    router.push('/login')
    return
  }
  currentUser.value = user

  loading.value = true
  error.value = null
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token

    const data = await $fetch(`/api/orders/${props.id}`, {
      query: { profile_id: user.id },
      headers: { Authorization: token ? `Bearer ${token}` : '' }
    })
    order.value = data.order
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Order not found.'
  } finally {
    loading.value = false
  }
})

const handleDownload = async (item) => {
  const productId = item.product?.id
  if (!productId) return

  downloadingItem.value = productId
  try {
    const data = await $fetch(`/api/orders/${props.id}/download`, {
      query: {
        profile_id: currentUser.value?.id,
        product_id: productId
      }
    })
    // Trigger browser download via signed URL
    const link = document.createElement('a')
    link.href = data.url
    link.download = data.file_name || 'download.zip'
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('Download error:', err)
    alert(err?.data?.statusMessage || err?.message || 'Download failed. Please try again.')
  } finally {
    downloadingItem.value = null
  }
}

const continuePayment = () => {
  if (!order.value?.payment_url) return
  window.location.href = order.value.payment_url
}
</script>
