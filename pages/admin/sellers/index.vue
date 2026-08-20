<script setup>
import { computed, onMounted, ref } from 'vue'
import { sAllSellers, sUpdateSellerStatus } from '../../../services/sellersService'

const sellers = ref([])
const statusFilter = ref('pending')
const loading = ref(false)
const updatingId = ref(null)
const errorMessage = ref('')
const rejectingSeller = ref(null)
const rejectionReason = ref('')

const filteredSellers = computed(() => {
  if (statusFilter.value === 'all') return sellers.value
  return sellers.value.filter((seller) => seller.status === statusFilter.value)
})

const pendingCount = computed(() => sellers.value.filter((seller) => seller.status === 'pending').length)

const statusClasses = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  suspended: 'bg-red-100 text-red-700',
  rejected: 'bg-slate-200 text-slate-700',
}

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
  : '-'

const loadSellers = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    sellers.value = await sAllSellers()
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load seller applications.'
  } finally {
    loading.value = false
  }
}

const updateStatus = async (seller, status, reason = null) => {
  if (seller.status === status) return

  const action = status === 'approved'
    ? 'approve'
    : status === 'rejected'
      ? 'reject'
      : status === 'suspended'
        ? 'suspend'
        : 'mark as pending'

  if (!confirm(`Are you sure you want to ${action} ${seller.store_name}?`)) return

  updatingId.value = seller.id
  errorMessage.value = ''
  try {
    const updatedSeller = await sUpdateSellerStatus(seller.id, status, reason)
    const index = sellers.value.findIndex((item) => item.id === seller.id)
    if (index !== -1) sellers.value[index] = updatedSeller
    rejectingSeller.value = null
    rejectionReason.value = ''
  } catch (error) {
    errorMessage.value = error.message || 'Failed to update seller status.'
  } finally {
    updatingId.value = null
  }
}

const openRejectDialog = (seller) => {
  rejectingSeller.value = seller
  rejectionReason.value = seller.rejection_reason || ''
}

const confirmRejection = async () => {
  if (!rejectingSeller.value) return
  if (!rejectionReason.value.trim()) {
    errorMessage.value = 'A rejection reason is required.'
    return
  }
  await updateStatus(rejectingSeller.value, 'rejected', rejectionReason.value)
}

onMounted(loadSellers)
</script>

<template>
  <div class="max-w-[1600px] mx-auto font-poppins">
    <div class="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between mb-10">
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-4xl font-extrabold text-text-main tracking-tight">Seller Applications</h1>
          <span v-if="pendingCount" class="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">{{ pendingCount }} pending</span>
        </div>
        <p class="mt-2 text-text-muted font-montserrat">Review store applications and manage seller access.</p>
      </div>
      <button
        :disabled="loading"
        class="rounded-xl border border-bg-alt bg-surface px-5 py-3 font-bold text-text-main transition hover:bg-bg-alt disabled:cursor-not-allowed disabled:opacity-60"
        @click="loadSellers"
      >
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>

    <div class="mb-6 flex flex-wrap gap-2">
      <button
        v-for="status in ['pending', 'approved', 'suspended', 'rejected', 'all']"
        :key="status"
        class="rounded-xl px-4 py-2 text-sm font-bold capitalize transition"
        :class="statusFilter === status ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-surface text-text-muted border border-bg-alt hover:text-text-main'"
        @click="statusFilter = status"
      >
        {{ status }}
      </button>
    </div>

    <p v-if="errorMessage" class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-600">{{ errorMessage }}</p>

    <div class="overflow-hidden rounded-2xl border border-bg-alt bg-surface shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[780px] text-left border-collapse">
          <thead>
            <tr class="bg-bg-alt/50 text-sm uppercase tracking-wider text-text-muted">
              <th class="p-6 font-semibold">Store</th>
              <th class="p-6 font-semibold">Description</th>
              <th class="p-6 font-semibold">Applied</th>
              <th class="p-6 font-semibold">Status</th>
              <th class="p-6 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-bg-alt">
            <tr v-if="loading">
              <td colspan="5" class="p-8 text-center text-text-muted">Loading seller applications...</td>
            </tr>
            <tr v-else-if="filteredSellers.length === 0">
              <td colspan="5" class="p-8 text-center text-text-muted">No {{ statusFilter === 'all' ? '' : statusFilter }} seller applications found.</td>
            </tr>
            <tr v-for="seller in filteredSellers" :key="seller.id" class="transition-colors hover:bg-bg-alt/30">
              <td class="p-6">
                <div class="flex items-center gap-3">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-bg-alt bg-bg-alt text-sm font-black text-text-muted">
                    <img v-if="seller.store_image_url" :src="seller.store_image_url" :alt="seller.store_name" class="h-full w-full object-cover">
                    <span v-else>{{ seller.store_name?.charAt(0) || 'S' }}</span>
                  </div>
                  <div class="min-w-0">
                    <p class="font-bold text-text-main">{{ seller.store_name }}</p>
                    <p class="mt-1 text-xs font-medium text-primary">/stores/{{ seller.store_slug }}</p>
                  </div>
                </div>
              </td>
              <td class="p-6 max-w-sm text-sm text-text-muted">{{ seller.store_description || 'No store description provided.' }}</td>
              <td class="p-6 text-sm text-text-muted">{{ formatDate(seller.created_at) }}</td>
              <td class="p-6">
                <span class="rounded-full px-3 py-1 text-xs font-bold capitalize" :class="statusClasses[seller.status] || 'bg-bg-alt text-text-muted'">{{ seller.status }}</span>
              </td>
              <td class="p-6">
                <div class="flex justify-end gap-2">
                  <NuxtLink :to="`/admin/sellers/${seller.id}`" class="rounded-lg border border-bg-alt px-3 py-2 text-xs font-bold text-text-main transition hover:text-primary">Details</NuxtLink>
                  <button
                    v-if="seller.status !== 'approved'"
                    :disabled="updatingId === seller.id"
                    class="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-60"
                    @click="updateStatus(seller, 'approved')"
                  >Approve</button>
                  <button
                    v-if="seller.status === 'pending'"
                    :disabled="updatingId === seller.id"
                    class="rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    @click="openRejectDialog(seller)"
                  >Reject</button>
                  <button
                    v-if="seller.status === 'approved'"
                    :disabled="updatingId === seller.id"
                    class="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                    @click="updateStatus(seller, 'suspended')"
                  >Suspend</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="rejectingSeller" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="rejectingSeller = null">
      <div class="w-full max-w-lg rounded-2xl border border-bg-alt bg-surface p-6 shadow-2xl">
        <p class="text-xs font-bold uppercase tracking-wider text-red-600">Reject application</p>
        <h2 class="mt-2 text-2xl font-black text-text-main">{{ rejectingSeller.store_name }}</h2>
        <p class="mt-2 text-sm text-text-muted">Explain what the seller needs to improve before resubmitting.</p>
        <textarea v-model="rejectionReason" rows="5" maxlength="1000" class="mt-5 w-full resize-y rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none focus:border-primary" placeholder="Rejection reason..."></textarea>
        <div class="mt-5 flex justify-end gap-3">
          <button class="rounded-xl px-4 py-2.5 font-bold text-text-muted hover:bg-bg-alt" :disabled="updatingId === rejectingSeller.id" @click="rejectingSeller = null">Cancel</button>
          <button class="rounded-xl bg-red-600 px-4 py-2.5 font-bold text-white hover:bg-red-700 disabled:opacity-60" :disabled="updatingId === rejectingSeller.id" @click="confirmRejection">{{ updatingId === rejectingSeller.id ? 'Rejecting...' : 'Reject seller' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
