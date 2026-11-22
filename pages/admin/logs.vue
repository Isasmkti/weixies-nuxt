<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { sAllActivityLogs } from '../../services/activityLogsService'

const logs = ref([])
const actorFilter = ref('all')
const entityFilter = ref('all')
const page = ref(1)
const pageSize = 25
const expandedLogIds = ref(new Set())
const loading = ref(false)
const errorMessage = ref('')

const filteredLogs = computed(() => logs.value.filter((log) => {
  const actorMatches = actorFilter.value === 'all' || log.actor_type === actorFilter.value
  const entityMatches = entityFilter.value === 'all' || log.entity_type === entityFilter.value
  return actorMatches && entityMatches
}))

const totalPages = computed(() => Math.max(1, Math.ceil(filteredLogs.value.length / pageSize)))
const paginatedLogs = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredLogs.value.slice(start, start + pageSize)
})
const visibleStart = computed(() => filteredLogs.value.length ? (page.value - 1) * pageSize + 1 : 0)
const visibleEnd = computed(() => Math.min(page.value * pageSize, filteredLogs.value.length))

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '-'

const humanize = (value) => String(value || '')
  .replace(/[._]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
  .replace(/\bAi\b/g, 'AI') || '-'

const metadataEntries = (metadata) => {
  if (metadata == null) return []
  if (Array.isArray(metadata)) return metadata.map((value, index) => ({ key: String(index), value }))
  if (typeof metadata !== 'object') return [{ key: 'Value', value: metadata }]
  return Object.entries(metadata).map(([key, value]) => ({ key, value }))
}

const formatMetadataValue = (value) => value === null
  ? '-'
  : typeof value === 'object'
    ? JSON.stringify(value, null, 2)
    : String(value)

const toggleDetails = (id) => {
  const expanded = new Set(expandedLogIds.value)
  if (expanded.has(id)) expanded.delete(id)
  else expanded.add(id)
  expandedLogIds.value = expanded
}

watch([actorFilter, entityFilter], () => {
  page.value = 1
  expandedLogIds.value = new Set()
})

const loadLogs = async () => {
  loading.value = true
  errorMessage.value = ''
  page.value = 1
  expandedLogIds.value = new Set()
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
  <div class="mx-auto max-w-[1600px] font-poppins">
    <header class="mb-6 flex flex-col gap-5 border-b border-border pb-6 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-primary">Administration</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight text-text-main sm:text-4xl">Activity Logs</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Review recent actions by buyers, sellers, admins, and system processes.</p>
      </div>
      <button
        type="button"
        :disabled="loading"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-ui-sm border border-border bg-surface px-4 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        @click="loadLogs"
      >
        {{ loading ? 'Refreshing...' : 'Refresh logs' }}
      </button>
    </header>

    <section aria-label="Filter activity logs" class="mb-5 grid gap-4 rounded-ui-md border border-border bg-surface p-4 sm:grid-cols-2 sm:p-5">
      <label class="block text-sm font-medium text-text-main">
        Actor type
        <select v-model="actorFilter" class="mt-2 min-h-11 w-full rounded-ui-sm border border-border bg-bg px-3 text-sm text-text-main outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15">
          <option value="all">All actors</option>
          <option value="buyer">Buyers</option>
          <option value="seller">Sellers</option>
          <option value="admin">Admins</option>
          <option value="system">System</option>
        </select>
      </label>
      <label class="block text-sm font-medium text-text-main">
        Activity category
        <select v-model="entityFilter" class="mt-2 min-h-11 w-full rounded-ui-sm border border-border bg-bg px-3 text-sm text-text-main outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15">
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
    </section>

    <p v-if="errorMessage" role="alert" class="mb-5 rounded-ui-sm border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{{ errorMessage }}</p>

    <section aria-label="Activity log results" class="overflow-hidden rounded-ui-md border border-border bg-surface">
      <div class="flex items-baseline justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <h2 class="text-sm font-semibold text-text-main">Recent activity</h2>
        <p class="text-xs text-text-muted">{{ filteredLogs.length }} {{ filteredLogs.length === 1 ? 'entry' : 'entries' }}</p>
      </div>

      <div class="divide-y divide-border lg:hidden">
        <p v-if="loading" role="status" class="p-8 text-center text-sm text-text-muted">Loading activity logs...</p>
        <p v-else-if="filteredLogs.length === 0" class="p-8 text-center text-sm text-text-muted">No activity logs match these filters.</p>
        <template v-else>
          <article v-for="log in paginatedLogs" :key="`mobile-${log.id}`" class="space-y-3 p-4 sm:p-5">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <h3 class="break-words text-sm font-semibold text-text-main">{{ humanize(log.action) }}</h3>
                <time class="mt-1 block text-xs text-text-muted">{{ formatDateTime(log.created_at) }}</time>
              </div>
              <span class="shrink-0 text-xs font-medium text-text-muted">{{ humanize(log.actor_type) }}</span>
            </div>

            <dl class="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3 text-xs">
              <div class="min-w-0">
                <dt class="text-text-muted">Actor</dt>
                <dd class="mt-1 truncate font-medium text-text-main">{{ log.actor_name || 'System' }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-text-muted">Resource</dt>
                <dd class="mt-1 font-medium text-text-main">{{ humanize(log.entity_type) }}</dd>
                <dd v-if="log.entity_id" class="mt-0.5 break-all font-mono text-[11px] text-text-muted">{{ log.entity_id }}</dd>
              </div>
            </dl>

            <button
              type="button"
              :aria-expanded="expandedLogIds.has(log.id)"
              :aria-controls="`mobile-log-details-${log.id}`"
              class="ml-auto flex min-h-10 w-fit items-center justify-end gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              @click="toggleDetails(log.id)"
            >
              {{ expandedLogIds.has(log.id) ? 'Hide details' : 'View details' }}
              <svg class="h-4 w-4 transition-transform" :class="expandedLogIds.has(log.id) ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
            </button>

            <div v-if="expandedLogIds.has(log.id)" :id="`mobile-log-details-${log.id}`" class="rounded-ui-sm border border-border bg-bg p-3 sm:p-4">
              <dl class="grid gap-3 text-xs sm:grid-cols-2">
                <div>
                  <dt class="text-text-muted">Log ID</dt>
                  <dd class="mt-1 break-all font-mono text-text-main">{{ log.id }}</dd>
                </div>
                <div>
                  <dt class="text-text-muted">Action code</dt>
                  <dd class="mt-1 break-all font-mono text-text-main">{{ log.action }}</dd>
                </div>
                <div>
                  <dt class="text-text-muted">Actor type</dt>
                  <dd class="mt-1 text-text-main">{{ humanize(log.actor_type) }}</dd>
                </div>
                <div>
                  <dt class="text-text-muted">Actor profile ID</dt>
                  <dd class="mt-1 break-all font-mono text-text-main">{{ log.actor_profile_id || '-' }}</dd>
                </div>
                <div>
                  <dt class="text-text-muted">Resource ID</dt>
                  <dd class="mt-1 break-all font-mono text-text-main">{{ log.entity_id || '-' }}</dd>
                </div>
                <div class="sm:col-span-2">
                  <dt class="text-text-muted">Recorded at</dt>
                  <dd class="mt-1 text-text-main">{{ formatDateTime(log.created_at) }}</dd>
                </div>
              </dl>
              <div class="mt-4 border-t border-border pt-3">
                <h4 class="text-xs font-semibold text-text-main">Additional data</h4>
                <dl v-if="metadataEntries(log.metadata).length" class="mt-2 grid gap-3 sm:grid-cols-2">
                  <div v-for="entry in metadataEntries(log.metadata)" :key="entry.key" class="min-w-0">
                    <dt class="text-xs text-text-muted">{{ humanize(entry.key) }}</dt>
                    <dd class="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-text-main">{{ formatMetadataValue(entry.value) }}</dd>
                  </div>
                </dl>
                <p v-else class="mt-2 text-xs text-text-muted">No additional data recorded.</p>
              </div>
            </div>
          </article>
        </template>
      </div>

      <div class="hidden overflow-x-auto lg:block">
        <table class="w-full min-w-[960px] border-collapse text-left">
          <thead class="bg-bg text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th scope="col" class="w-44 px-4 py-3 font-semibold sm:px-5">Time</th>
              <th scope="col" class="w-48 px-4 py-3 font-semibold sm:px-5">Actor</th>
              <th scope="col" class="w-52 px-4 py-3 font-semibold sm:px-5">Activity</th>
              <th scope="col" class="w-52 px-4 py-3 font-semibold sm:px-5">Resource</th>
              <th scope="col" class="px-4 py-3 font-semibold sm:px-5"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-if="loading">
              <td colspan="5" class="p-8 text-center text-sm text-text-muted">Loading activity logs...</td>
            </tr>
            <tr v-else-if="filteredLogs.length === 0">
              <td colspan="5" class="p-8 text-center text-sm text-text-muted">No activity logs match these filters.</td>
            </tr>
            <template v-else>
              <template v-for="log in paginatedLogs" :key="log.id">
                <tr class="align-top transition-colors hover:bg-bg/70">
                  <td class="whitespace-nowrap px-4 py-4 text-xs text-text-muted sm:px-5">{{ formatDateTime(log.created_at) }}</td>
                  <td class="px-4 py-4 sm:px-5">
                    <p class="text-sm font-medium text-text-main">{{ log.actor_name || 'System' }}</p>
                    <p class="mt-1 text-xs text-text-muted">{{ humanize(log.actor_type) }}</p>
                  </td>
                  <td class="break-words px-4 py-4 text-sm font-medium text-text-main sm:px-5">{{ humanize(log.action) }}</td>
                  <td class="px-4 py-4 sm:px-5">
                    <p class="text-sm font-medium text-text-main">{{ humanize(log.entity_type) }}</p>
                    <p v-if="log.entity_id" class="mt-1 break-all font-mono text-[11px] text-text-muted">{{ log.entity_id }}</p>
                  </td>
                  <td class="px-4 py-4 text-right sm:px-5">
                    <button
                      type="button"
                      :aria-expanded="expandedLogIds.has(log.id)"
                      :aria-controls="`desktop-log-details-${log.id}`"
                      class="ml-auto flex min-h-10 w-fit items-center justify-end gap-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      @click="toggleDetails(log.id)"
                    >
                      {{ expandedLogIds.has(log.id) ? 'Hide details' : 'View details' }}
                      <svg class="h-4 w-4 transition-transform" :class="expandedLogIds.has(log.id) ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedLogIds.has(log.id)">
                  <td colspan="5" class="border-t border-border bg-bg/50 px-4 py-4 sm:px-5">
                    <div :id="`desktop-log-details-${log.id}`" class="rounded-ui-sm border border-border bg-surface p-4">
                      <dl class="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                          <dt class="text-text-muted">Log ID</dt>
                          <dd class="mt-1 break-all font-mono text-text-main">{{ log.id }}</dd>
                        </div>
                        <div>
                          <dt class="text-text-muted">Actor</dt>
                          <dd class="mt-1 break-words font-medium text-text-main">{{ log.actor_name || 'System' }}</dd>
                        </div>
                        <div>
                          <dt class="text-text-muted">Actor type</dt>
                          <dd class="mt-1 text-text-main">{{ humanize(log.actor_type) }}</dd>
                        </div>
                        <div>
                          <dt class="text-text-muted">Actor profile ID</dt>
                          <dd class="mt-1 break-all font-mono text-text-main">{{ log.actor_profile_id || '-' }}</dd>
                        </div>
                        <div>
                          <dt class="text-text-muted">Action code</dt>
                          <dd class="mt-1 break-all font-mono text-text-main">{{ log.action }}</dd>
                        </div>
                        <div>
                          <dt class="text-text-muted">Resource</dt>
                          <dd class="mt-1 text-text-main">{{ humanize(log.entity_type) }}</dd>
                        </div>
                        <div>
                          <dt class="text-text-muted">Resource ID</dt>
                          <dd class="mt-1 break-all font-mono text-text-main">{{ log.entity_id || '-' }}</dd>
                        </div>
                        <div class="sm:col-span-2 lg:col-span-3">
                          <dt class="text-text-muted">Recorded at</dt>
                          <dd class="mt-1 text-text-main">{{ formatDateTime(log.created_at) }}</dd>
                        </div>
                      </dl>
                      <div class="mt-4 border-t border-border pt-3">
                        <h3 class="text-xs font-semibold text-text-main">Additional data</h3>
                        <dl v-if="metadataEntries(log.metadata).length" class="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div v-for="entry in metadataEntries(log.metadata)" :key="entry.key" class="min-w-0">
                            <dt class="text-xs text-text-muted">{{ humanize(entry.key) }}</dt>
                            <dd class="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-5 text-text-main">{{ formatMetadataValue(entry.value) }}</dd>
                          </div>
                        </dl>
                        <p v-else class="mt-2 text-xs text-text-muted">No additional data recorded.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </section>

    <nav v-if="filteredLogs.length" aria-label="Activity log pagination" class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-xs text-text-muted">Showing {{ visibleStart }}–{{ visibleEnd }} of {{ filteredLogs.length }} entries</p>
      <div class="flex items-center justify-between gap-3 sm:justify-end">
        <button
          type="button"
          :disabled="page <= 1"
          class="min-h-10 rounded-ui-sm border border-border px-3 text-sm font-medium text-text-main transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
          @click="page = Math.max(1, page - 1)"
        >
          Previous
        </button>
        <span class="whitespace-nowrap text-xs tabular-nums text-text-muted">Page {{ page }} of {{ totalPages }}</span>
        <button
          type="button"
          :disabled="page >= totalPages"
          class="min-h-10 rounded-ui-sm border border-border px-3 text-sm font-medium text-text-main transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
          @click="page = Math.min(totalPages, page + 1)"
        >
          Next
        </button>
      </div>
    </nav>
  </div>
</template>
