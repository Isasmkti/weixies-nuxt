<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { getAdminDashboard } from '../../services/adminDashboardService'
import { useThemeStore } from '../../stores/themeStore'

const themeStore = useThemeStore()
const ApexChart = defineAsyncComponent(() => import('vue3-apexcharts'))
const dashboard = ref({
  metrics: {
    gmv: 0,
    gmvChange: 0,
    transactions: 0,
    transactionChange: 0,
    users: 0,
    userChange: 0,
    activeSellers: 0,
    sellerChange: 0,
  },
  pendingSellers: 0,
  chart: [],
  recentOrders: [],
})
const loading = ref(true)
const errorMessage = ref('')
const lastUpdated = ref(null)
const activeChartRange = ref(30)

const formatIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(Number(value) || 0)

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0)
const formatCompactIDR = (value) => `Rp ${new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(Number(value) || 0)}`
const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'
const formatTime = (value) => value
  ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(value)
  : '-'

const metricCards = computed(() => [
  { label: 'Total GMV', value: formatIDR(dashboard.value.metrics.gmv), change: dashboard.value.metrics.gmvChange, icon: 'wallet' },
  { label: 'Total Transactions', value: formatNumber(dashboard.value.metrics.transactions), change: dashboard.value.metrics.transactionChange, icon: 'receipt' },
  { label: 'Total Users', value: formatNumber(dashboard.value.metrics.users), change: dashboard.value.metrics.userChange, icon: 'users' },
  { label: 'Active Sellers', value: formatNumber(dashboard.value.metrics.activeSellers), change: dashboard.value.metrics.sellerChange, icon: 'store' },
])

const chartRanges = [
  { label: '7D', days: 7 },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
]

const revenuePoints = computed(() => dashboard.value.chart.map((point) => [
  new Date(`${point.date}T00:00:00`).getTime(),
  point.revenue,
]))

const chartMax = computed(() => revenuePoints.value.at(-1)?.[0])
const chartMin = computed(() => {
  if (!chartMax.value) return undefined
  return chartMax.value - ((activeChartRange.value - 1) * 24 * 60 * 60 * 1000)
})

const chartSeries = computed(() => [
  { name: 'Revenue', data: revenuePoints.value },
])

const chartOptions = computed(() => ({
  chart: {
    id: 'admin-revenue-datetime',
    type: 'area',
    fontFamily: 'Inter, sans-serif',
    background: 'transparent',
    toolbar: {
      show: true,
      tools: {
        download: false,
        selection: true,
        zoom: true,
        zoomin: true,
        zoomout: true,
        pan: true,
        reset: true,
      },
    },
    zoom: { enabled: true, autoScaleYaxis: true },
  },
  theme: { mode: themeStore.isDark ? 'dark' : 'light' },
  colors: ['#4f46e5'],
  dataLabels: { enabled: false },
  markers: {
    size: 0,
    strokeWidth: 2,
    hover: { size: 5 },
  },
  stroke: { curve: 'straight', width: 3 },
  fill: {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.65, opacityTo: 0.08, stops: [0, 90, 100] },
  },
  grid: {
    borderColor: themeStore.isDark ? '#3f3f46' : '#e5e7eb',
    strokeDashArray: 4,
    padding: { left: 8, right: 8 },
  },
  legend: { show: false },
  xaxis: {
    type: 'datetime',
    min: chartMin.value,
    max: chartMax.value,
    tickAmount: 6,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      datetimeUTC: false,
      style: { colors: themeStore.isDark ? '#a1a1aa' : '#71717a' },
    },
  },
  yaxis: {
    min: 0,
    forceNiceScale: true,
    labels: {
      style: { colors: themeStore.isDark ? '#a1a1aa' : '#71717a' },
      formatter: (value) => formatCompactIDR(value),
    },
  },
  tooltip: {
    theme: themeStore.isDark ? 'dark' : 'light',
    x: { format: 'dd MMM yyyy' },
    y: { formatter: (value) => formatIDR(value) },
  },
  noData: { text: 'No revenue data available' },
}))

const statusClasses = {
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  expired: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  refunded: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
}

const statusLabels = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

const productSummary = (order) => {
  const names = order.product_names || []
  if (!names.length) return 'Product unavailable'
  if (names.length === 1) return names[0]
  return `${names[0]} +${names.length - 1} more`
}

const initials = (name) => String(name || 'U')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((word) => word.charAt(0))
  .join('')
  .toUpperCase()

const loadDashboard = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    dashboard.value = await getAdminDashboard()
    lastUpdated.value = new Date()
  } catch (error) {
    console.error('[Admin dashboard] Failed to load analytics:', error)
    errorMessage.value = error.message || 'The admin dashboard could not be loaded.'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="mx-auto w-full max-w-[1440px]">
    <header class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-1 text-sm font-medium text-primary">Platform overview</p>
        <h1 class="text-3xl font-semibold tracking-tight text-text-main">Admin dashboard</h1>
        <p class="mt-2 text-sm text-text-muted">Monitor marketplace performance and recent activity in one place.</p>
      </div>
      <div class="flex items-center gap-3">
        <p v-if="lastUpdated" class="hidden text-xs text-text-muted sm:block">Updated at {{ formatTime(lastUpdated) }}</p>
        <button
          type="button"
          :disabled="loading"
          class="inline-flex items-center justify-center gap-2 rounded-ui-sm border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-main transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
          @click="loadDashboard"
        >
          <svg class="h-4 w-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {{ loading ? 'Loading...' : 'Refresh data' }}
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="mb-6 flex flex-col gap-3 rounded-ui-md border border-danger/20 bg-danger/10 p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between">
      <span>{{ errorMessage }}</span>
      <button class="shrink-0 font-bold underline underline-offset-4" @click="loadDashboard">Try again</button>
    </div>

    <section class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article v-for="card in metricCards" :key="card.label" class="rounded-ui-lg border border-border bg-surface p-5 shadow-elevation-1">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm font-medium text-text-muted">{{ card.label }}</p>
            <div v-if="loading" class="mt-3 h-8 w-32 animate-pulse rounded-lg bg-bg-alt" />
            <p v-else class="mt-2 truncate text-2xl font-semibold tracking-tight text-text-main">{{ card.value }}</p>
          </div>
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary">
            <svg v-if="card.icon === 'wallet'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m0-6h2a2 2 0 012 2v2a2 2 0 01-2 2h-5a2 2 0 01-2-2v-2a2 2 0 012-2h3z" /></svg>
            <svg v-else-if="card.icon === 'receipt'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14h6m-6-4h6M5 4h14v16l-3-2-4 2-4-2-3 2V4z" /></svg>
            <svg v-else-if="card.icon === 'users'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H2v-2a4 4 0 014-4h3m8-5a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9l2-5h14l2 5M4 9h16v10H4V9zm5 10v-5h6v5" /></svg>
          </div>
        </div>
        <div v-if="!loading" class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="inline-flex items-center gap-1 font-bold" :class="card.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
            <svg class="h-3.5 w-3.5" :class="{ 'rotate-180': card.change < 0 }" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" /></svg>
            {{ card.change >= 0 ? '+' : '' }}{{ card.change }}%
          </span>
          <span class="text-text-muted">vs the previous 30 days</span>
        </div>
      </article>
    </section>

    <section class="mb-6 grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
      <article class="min-w-0 rounded-ui-lg border border-border bg-surface p-4 shadow-elevation-1 sm:p-6 xl:col-span-2">
        <div class="mb-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 class="text-lg font-bold text-text-main sm:text-xl">Revenue Growth</h2>
            <p class="mt-1 text-sm text-text-muted">Marketplace revenue from successful transactions</p>
          </div>
          <div class="flex w-fit items-center rounded-ui-full bg-bg-alt p-1">
            <button
              v-for="range in chartRanges"
              :key="range.days"
              type="button"
              class="rounded-ui-full px-3 py-1.5 text-xs font-medium transition"
              :class="activeChartRange === range.days ? 'bg-surface text-primary shadow-sm' : 'text-text-muted hover:text-text-main'"
              @click="activeChartRange = range.days"
            >
              {{ range.label }}
            </button>
          </div>
        </div>
        <div v-if="loading" class="h-[330px] animate-pulse rounded-xl bg-bg-alt" />
        <ClientOnly v-else>
          <ApexChart type="area" height="330" :options="chartOptions" :series="chartSeries" />
          <template #fallback><div class="h-[330px] animate-pulse rounded-xl bg-bg-alt" /></template>
        </ClientOnly>
      </article>

      <div class="flex flex-col gap-6">
        <article class="relative overflow-hidden rounded-ui-lg border border-border bg-surface p-6 shadow-elevation-1">
          <div class="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10" />
          <div class="relative flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-bold text-text-main">Seller Verification</p>
              <div class="mt-4 flex items-baseline gap-2">
                <span v-if="loading" class="h-10 w-16 animate-pulse rounded-lg bg-bg-alt" />
                <span v-else class="text-4xl font-semibold tracking-tight text-text-main">{{ dashboard.pendingSellers }}</span>
                <span class="text-sm text-text-muted">pending</span>
              </div>
            </div>
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75M12 3l7 3v5c0 4.4-2.99 8.47-7 9.75C7.99 19.47 5 15.4 5 11V6l7-3z" /></svg>
            </div>
          </div>
          <NuxtLink to="/admin/sellers" class="relative mt-5 flex w-full items-center justify-center gap-2 rounded-ui-md bg-primary px-4 py-3 text-sm font-semibold text-white shadow-elevation-1 transition hover:bg-primary-dark">
            Review now
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </NuxtLink>
        </article>

        <article class="flex-1 rounded-ui-lg border border-border bg-surface p-6 shadow-elevation-1">
          <h2 class="text-sm font-bold text-text-main">Data Status</h2>
          <ul class="mt-5 space-y-4 text-sm">
            <li v-for="item in ['Marketplace database', '30-day analytics', 'Administrator access']" :key="item" class="flex items-center gap-3">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="errorMessage ? 'bg-rose-500' : loading ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'" />
              <span class="min-w-0 flex-1 text-text-main">{{ item }}</span>
              <span class="text-xs font-semibold text-text-muted">{{ errorMessage ? 'Issue' : loading ? 'Loading' : 'Active' }}</span>
            </li>
          </ul>
          <NuxtLink to="/admin/logs" class="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            Open activity logs
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
          </NuxtLink>
        </article>
      </div>
    </section>

    <section class="overflow-hidden rounded-ui-lg border border-border bg-surface shadow-elevation-1">
      <div class="flex items-center justify-between gap-4 border-b border-bg-alt p-5 sm:p-6">
        <div>
          <h2 class="text-lg font-bold text-text-main sm:text-xl">Recent Transactions</h2>
          <p class="mt-1 text-sm text-text-muted">The latest orders from across the marketplace</p>
        </div>
        <NuxtLink to="/admin/logs" class="shrink-0 text-sm font-bold text-primary hover:underline">View activity</NuxtLink>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr class="border-b border-border bg-bg-alt/50 text-xs font-medium text-text-muted">
              <th class="p-4 sm:px-6">Transaction ID</th>
              <th class="p-4 sm:px-6">Customer</th>
              <th class="p-4 sm:px-6">Product</th>
              <th class="p-4 sm:px-6">Date</th>
              <th class="p-4 sm:px-6">Amount</th>
              <th class="p-4 sm:px-6">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-bg-alt text-sm">
            <tr v-if="loading"><td colspan="6" class="p-8 text-center text-text-muted">Loading recent transactions...</td></tr>
            <tr v-else-if="dashboard.recentOrders.length === 0"><td colspan="6" class="p-8 text-center text-text-muted">No transactions yet.</td></tr>
            <tr v-for="order in dashboard.recentOrders" v-else :key="order.id" class="transition hover:bg-bg-alt/40">
              <td class="p-4 font-bold text-text-main sm:px-6">#{{ order.order_number }}</td>
              <td class="p-4 sm:px-6"><div class="flex items-center gap-3"><span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-black text-primary">{{ initials(order.buyer_name) }}</span><span class="font-semibold text-text-main">{{ order.buyer_name || 'Customer' }}</span></div></td>
              <td class="max-w-[260px] truncate p-4 text-text-muted sm:px-6" :title="(order.product_names || []).join(', ')">{{ productSummary(order) }}</td>
              <td class="whitespace-nowrap p-4 text-text-muted sm:px-6">{{ formatDateTime(order.created_at) }}</td>
              <td class="whitespace-nowrap p-4 font-bold text-text-main sm:px-6">{{ formatIDR(order.total_amount) }}</td>
              <td class="p-4 sm:px-6"><span class="inline-flex rounded-ui-xs px-2.5 py-1 text-xs font-medium" :class="statusClasses[order.status] || 'bg-bg-alt text-text-muted'">{{ statusLabels[order.status] || order.status }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
