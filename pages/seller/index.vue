<script setup>
import { computed, onMounted, ref } from 'vue'
import { getCurrentSeller } from '../../services/sellerService'
import { getSellerDashboardSummary } from '../../services/sellerDashboardService'

const seller = ref(null)
const dashboard = ref(null)
const loading = ref(true)
const errorMessage = ref('')

const maxMonthlyRevenue = computed(() => Math.max(
  ...(dashboard.value?.monthlyRevenue || []).map((month) => month.value),
  1,
))

const formatIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value) || 0)

const formatCompactIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1,
}).format(Number(value) || 0)

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : '-'

const orderOf = (sale) => Array.isArray(sale.orders) ? sale.orders[0] : sale.orders
const productOf = (sale) => Array.isArray(sale.products) ? sale.products[0] : sale.products
const saleImage = (sale) => {
  const images = productOf(sale)?.product_images || []
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
}
const barHeight = (value) => `${Math.max((Number(value) / maxMonthlyRevenue.value) * 100, 4)}%`
const growthClasses = (value) => Number(value) >= 0 ? 'text-success' : 'text-danger'
const growthArrow = (value) => Number(value) >= 0 ? 'M12 19V5m0 0-6 6m6-6 6 6' : 'M12 5v14m0 0 6-6m-6 6-6-6'

onMounted(async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    seller.value = await getCurrentSeller()
    if (!seller.value) throw new Error('Seller account was not found.')
    dashboard.value = await getSellerDashboardSummary(seller.value.id)
  } catch (error) {
    console.error('Unable to load seller dashboard:', error)
    errorMessage.value = error.message || 'Unable to load your seller workspace.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-[1440px] py-4 md:py-6">
    <div v-if="loading" class="flex min-h-[24rem] flex-col items-center justify-center rounded-ui-lg border border-border bg-surface">
      <span class="h-11 w-11 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span>
      <p class="mt-4 text-sm font-medium text-text-muted">Loading store overview...</p>
    </div>

    <div v-else-if="errorMessage" class="rounded-ui-md border border-danger/20 bg-danger/10 p-6 text-danger">
      <p class="font-semibold">The store dashboard could not be loaded.</p>
      <p class="mt-1 text-sm">{{ errorMessage }}</p>
    </div>

    <template v-else-if="seller && dashboard">
      <header class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-center gap-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-ui-lg border border-border bg-surface text-xl font-semibold text-primary shadow-elevation-1">
            <img v-if="seller.store_image_url" :src="seller.store_image_url" :alt="seller.store_name" class="h-full w-full object-cover">
            <span v-else>{{ seller.store_name?.charAt(0) || 'S' }}</span>
          </div>
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-primary">{{ seller.store_name }}</p>
            <h1 class="mt-1 text-2xl font-semibold tracking-tight text-text-main md:text-3xl">Seller dashboard</h1>
            <p class="mt-1 text-sm text-text-muted">Monitor your store performance and recent activity.</p>
          </div>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <NuxtLink :to="`/stores/${seller.store_slug}`" class="inline-flex items-center justify-center rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:border-primary/40 hover:text-primary">View store</NuxtLink>
          <NuxtLink to="/seller/products" class="inline-flex items-center justify-center rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:border-primary/40 hover:text-primary">Products</NuxtLink>
          <NuxtLink to="/seller/orders" class="inline-flex items-center justify-center rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:border-primary/40 hover:text-primary">Orders</NuxtLink>
          <NuxtLink to="/seller/refunds" class="inline-flex items-center justify-center rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:border-primary/40 hover:text-primary">Refunds</NuxtLink>
          <NuxtLink to="/seller/payouts" class="inline-flex items-center justify-center rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:border-primary/40 hover:text-primary">Payouts</NuxtLink>
          <NuxtLink to="/seller/products/new" class="inline-flex items-center justify-center gap-2 rounded-ui-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-elevation-1 transition hover:bg-primary-dark">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m-7-7h14" /></svg>
            Upload Asset
          </NuxtLink>
        </div>
      </header>

      <section class="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1">
          <div class="flex items-start justify-between gap-4">
            <div><p class="text-sm font-medium text-text-muted">Total sales</p><p class="mt-1 text-2xl font-semibold text-text-main">{{ dashboard.totalSales.toLocaleString('id-ID') }}</p></div>
            <span class="flex h-10 w-10 items-center justify-center rounded-ui-md bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.5 2m0 0H21l-2 8H7L5.5 5ZM8 19h.01M17 19h.01" /></svg></span>
          </div>
          <div class="mt-4 flex items-center gap-2 text-xs"><span class="inline-flex items-center gap-1 font-semibold" :class="growthClasses(dashboard.salesGrowth)"><svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="growthArrow(dashboard.salesGrowth)" /></svg>{{ Math.abs(dashboard.salesGrowth) }}%</span><span class="text-text-muted">vs last month</span></div>
        </article>

        <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1">
          <div class="flex items-start justify-between gap-4">
            <div><p class="text-sm font-medium text-text-muted">Total revenue</p><p class="mt-1 text-2xl font-semibold text-text-main">{{ formatCompactIDR(dashboard.totalRevenue) }}</p></div>
            <span class="flex h-10 w-10 items-center justify-center rounded-ui-md bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m3-9.5c0-1.1-1.34-2-3-2s-3 .9-3 2 1.34 2 3 2 3 .9 3 2-1.34 2-3 2-3-.9-3-2M4 6.5A2.5 2.5 0 0 0 6.5 4h11A2.5 2.5 0 0 0 20 6.5v11a2.5 2.5 0 0 0-2.5 2.5h-11A2.5 2.5 0 0 0 4 17.5v-11Z" /></svg></span>
          </div>
          <div class="mt-4 flex items-center gap-2 text-xs"><span class="inline-flex items-center gap-1 font-semibold" :class="growthClasses(dashboard.revenueGrowth)"><svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="growthArrow(dashboard.revenueGrowth)" /></svg>{{ Math.abs(dashboard.revenueGrowth) }}%</span><span class="text-text-muted">vs last month</span></div>
        </article>

        <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1">
          <div class="flex items-start justify-between gap-4">
            <div><p class="text-sm font-medium text-text-muted">Active products</p><p class="mt-1 text-2xl font-semibold text-text-main">{{ dashboard.activeProducts.toLocaleString('id-ID') }}</p></div>
            <span class="flex h-10 w-10 items-center justify-center rounded-ui-md bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 8-9 5-9-5m9 5v9m9-14-9-5-9 5v9l9 5 9-5V8Z" /></svg></span>
          </div>
          <p class="mt-4 text-xs text-text-muted">+{{ dashboard.recentlyAddedProducts }} added this week</p>
        </article>
      </section>

      <section class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1 lg:col-span-2">
          <div class="flex items-center justify-between gap-4">
            <div><h2 class="text-lg font-semibold text-text-main">Revenue trend</h2><p class="mt-1 text-xs text-text-muted">Net seller revenue over the last six months.</p></div>
            <span class="rounded-ui-sm border border-border bg-bg px-3 py-2 text-xs font-medium text-text-muted">6 months</span>
          </div>
          <div class="mt-7 flex h-64 items-end gap-3 rounded-ui-sm border border-border bg-bg/50 px-4 pb-4 pt-8 sm:gap-5 sm:px-6">
            <div v-for="month in dashboard.monthlyRevenue" :key="month.key" class="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <div class="mb-2 hidden whitespace-nowrap rounded-md bg-text-main px-2 py-1 text-[10px] font-semibold text-bg shadow-lg group-hover:block">{{ formatIDR(month.value) }}</div>
              <div class="w-full max-w-12 rounded-t-lg bg-primary/80 transition-all duration-500 group-hover:bg-primary" :style="{ height: barHeight(month.value) }"></div>
              <span class="mt-2 text-[10px] font-medium text-text-muted sm:text-xs">{{ month.label }}</span>
            </div>
          </div>
        </article>

        <article class="flex min-h-[22rem] flex-col rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1">
          <div class="flex items-center justify-between gap-4">
            <div><h2 class="text-lg font-semibold text-text-main">Recent orders</h2><p class="mt-1 text-xs text-text-muted">Paid transactions for your store products.</p></div>
            <NuxtLink to="/seller/products" class="shrink-0 text-xs font-semibold text-primary hover:underline">My products</NuxtLink>
          </div>
          <div v-if="dashboard.recentSales.length" class="mt-5 flex flex-1 flex-col gap-2">
            <NuxtLink v-for="sale in dashboard.recentSales" :key="sale.id" :to="`/products/${productOf(sale)?.slug || ''}`" class="flex items-center gap-3 rounded-ui-md border border-transparent p-3 transition hover:border-border hover:bg-bg/70">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-ui-sm bg-bg-alt text-sm font-semibold text-text-muted"><img v-if="saleImage(sale)" :src="saleImage(sale)" :alt="productOf(sale)?.name" class="h-full w-full object-cover"><span v-else>{{ productOf(sale)?.name?.charAt(0) || 'P' }}</span></div>
              <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-text-main">{{ productOf(sale)?.name || 'Digital product' }}</p><p class="mt-0.5 truncate text-xs text-text-muted">{{ orderOf(sale)?.order_number || 'Order' }} · {{ formatDate(orderOf(sale)?.created_at) }}</p></div>
              <div class="shrink-0 text-right"><p class="text-xs font-bold text-text-main">{{ formatCompactIDR(sale.seller_earning) }}</p><p class="mt-1 text-[10px] capitalize text-text-muted">{{ sale.payout_status }}</p></div>
            </NuxtLink>
          </div>
          <div v-else class="mt-5 flex flex-1 items-center justify-center rounded-ui-sm border border-dashed border-border bg-bg/40 p-6 text-center"><div><p class="font-semibold text-text-main">No sales yet</p><p class="mt-1 text-xs leading-5 text-text-muted">Paid orders will appear here.</p></div></div>
        </article>
      </section>
    </template>
  </div>
</template>
