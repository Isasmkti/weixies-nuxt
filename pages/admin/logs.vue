<script setup>
import { computed, onMounted, ref } from 'vue'
import { sAllActivityLogs } from '../../services/activityLogsService'

const logs = ref([])
const actorFilter = ref('all')
const entityFilter = ref('all')
const loading = ref(false)
const errorMessage = ref('')

const filteredLogs = computed(() => logs.value.filter((log) => {
  const actorMatches = actorFilter.value === 'all' || log.actor_type === actorFilter.value
  const entityMatches = entityFilter.value === 'all' || log.entity_type === entityFilter.value
  return actorMatches && entityMatches
}))

const actorClasses = {
  buyer: 'bg-sky-100 text-sky-700',
  seller: 'bg-violet-100 text-violet-700',
  admin: 'bg-rose-100 text-rose-700',
  system: 'bg-slate-200 text-slate-700',
}

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'

const formatMetadata = (metadata) => {
  if (!metadata || Object.keys(metadata).length === 0) return '-'
  return Object.entries(metadata)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ')
}

const loadLogs = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    logs.value = await sAllActivityLogs()
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load activity logs.'
  } finally {
    loading.value = false
  }
}

onMounted(loadLogs)
</script>

<template>
  <div class="max-w-[1600px] mx-auto font-poppins">
    <div class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:mb-10">
      <div>
        <h1 class="text-3xl font-extrabold text-text-main tracking-tight sm:text-4xl">Activity Logs</h1>
        <p class="mt-2 text-text-muted font-montserrat">Recent buyer, seller, admin, and system activity.</p>
      </div>
      <button
        :disabled="loading"
        class="w-full rounded-xl border border-bg-alt bg-surface px-5 py-3 font-bold text-text-main transition hover:bg-bg-alt disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        @click="loadLogs"
      >
        {{ loading ? 'Refreshing...' : 'Refresh logs' }}
      </button>
    </div>

    <div class="mb-6 grid gap-3 sm:grid-cols-2">
      <label class="text-sm font-bold text-text-muted">
        Actor type
        <select v-model="actorFilter" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 text-text-main outline-none focus:border-primary">
          <option value="all">All actors</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
          <option value="system">System</option>
        </select>
      </label>
      <label class="text-sm font-bold text-text-muted">
        Activity category
        <select v-model="entityFilter" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 text-text-main outline-none focus:border-primary">
          <option value="all">All categories</option>
          <option value="profile">Profiles</option>
          <option value="seller">Sellers</option>
          <option value="product">Products</option>
          <option value="order">Orders</option>
          <option value="payment">Payments</option>
          <option value="review">Reviews</option>
          <option value="wishlist">Wishlists</option>
          <option value="seller_payout">Seller payouts</option>
          <option value="order_refund">Order refunds</option>
          <option value="ai_knowledge">AI Knowledge</option>
          <option value="category">Product categories</option>
        </select>
      </label>
    </div>

    <p v-if="errorMessage" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">{{ errorMessage }}</p>

    <div class="overflow-hidden rounded-2xl border border-bg-alt bg-surface shadow-sm">
      <div class="divide-y divide-border md:hidden">
        <div v-if="loading" class="p-8 text-center text-sm text-text-muted">Loading activity logs...</div>
        <div v-else-if="filteredLogs.length === 0" class="p-8 text-center text-sm text-text-muted">No activity logs match these filters.</div>
        <article v-for="log in filteredLogs" v-else :key="`mobile-${log.id}`" class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><p class="truncate font-mono text-sm font-semibold text-primary">{{ log.action }}</p><p class="mt-1 text-xs text-text-muted">{{ formatDateTime(log.created_at) }}</p></div>
            <span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" :class="actorClasses[log.actor_type] || 'bg-bg-alt text-text-muted'">{{ log.actor_type }}</span>
          </div>
          <dl class="grid grid-cols-2 gap-3 rounded-ui-sm bg-bg p-3 text-xs">
            <div class="min-w-0"><dt class="text-text-muted">Actor</dt><dd class="mt-1 truncate font-bold text-text-main">{{ log.actor_name || 'System' }}</dd></div>
            <div class="min-w-0"><dt class="text-text-muted">Resource</dt><dd class="mt-1 truncate font-semibold capitalize text-text-main">{{ log.entity_type.replace('_', ' ') }}</dd></div>
          </dl>
          <p class="break-words text-xs leading-5 text-text-muted">{{ formatMetadata(log.metadata) }}</p>
        </article>
      </div>
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full min-w-[1000px] text-left border-collapse">
          <thead>
            <tr class="bg-bg-alt/50 text-sm uppercase tracking-wider text-text-muted">
              <th class="p-6 font-semibold">Time</th>
              <th class="p-6 font-semibold">Actor</th>
              <th class="p-6 font-semibold">Activity</th>
              <th class="p-6 font-semibold">Resource</th>
              <th class="p-6 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-bg-alt">
            <tr v-if="loading">
              <td colspan="5" class="p-8 text-center text-text-muted">Loading activity logs...</td>
            </tr>
            <tr v-else-if="filteredLogs.length === 0">
              <td colspan="5" class="p-8 text-center text-text-muted">No activity logs match these filters.</td>
            </tr>
            <tr v-for="log in filteredLogs" :key="log.id" class="transition-colors hover:bg-bg-alt/30">
              <td class="p-6 whitespace-nowrap text-sm text-text-muted">{{ formatDateTime(log.created_at) }}</td>
              <td class="p-6">
                <p class="font-bold text-text-main">{{ log.actor_name || 'System' }}</p>
                <span class="mt-1 inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase" :class="actorClasses[log.actor_type] || 'bg-bg-alt text-text-muted'">{{ log.actor_type }}</span>
              </td>
              <td class="p-6 font-mono text-sm font-semibold text-primary">{{ log.action }}</td>
              <td class="p-6">
                <p class="font-semibold capitalize text-text-main">{{ log.entity_type.replace('_', ' ') }}</p>
                <p class="mt-1 max-w-[180px] truncate font-mono text-xs text-text-muted">{{ log.entity_id || '-' }}</p>
              </td>
              <td class="p-6 max-w-sm text-sm text-text-muted">{{ formatMetadata(log.metadata) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
