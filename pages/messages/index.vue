<template>
  <div class="mx-auto max-w-5xl font-poppins">
    <header class="mb-7">
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Direct support</p>
      <h1 class="mt-1 text-3xl font-black tracking-tight text-text-main sm:text-4xl">Messages</h1>
      <p class="mt-2 text-sm text-text-muted">Your product questions and order conversations with marketplace sellers.</p>
    </header>

    <div v-if="loading" class="flex min-h-[360px] items-center justify-center rounded-2xl border border-bg-alt bg-surface"><span class="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span></div>
    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{{ error }}</div>
    <div v-else-if="!threads.length" class="rounded-3xl border border-dashed border-bg-alt bg-surface px-6 py-16 text-center">
      <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025C3.36 16.94 2.25 14.97 2.25 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg></span>
      <h2 class="mt-5 text-xl font-black text-text-main">No conversations yet</h2>
      <p class="mt-2 text-sm text-text-muted">Open a product and use “Message seller” to start a conversation.</p>
      <NuxtLink to="/products" class="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-dark">Browse products</NuxtLink>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-bg-alt bg-surface shadow-sm">
      <NuxtLink v-for="thread in threads" :key="thread.id" :to="`/messages/${thread.id}`" class="flex items-center gap-4 border-b border-bg-alt p-4 transition last:border-b-0 hover:bg-primary/5 sm:p-5">
        <div class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-alt font-black text-primary">
          <img v-if="avatar(thread)" :src="avatar(thread)" :alt="title(thread)" class="h-full w-full object-cover">
          <span v-else>{{ title(thread).charAt(0) }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-3"><h2 class="truncate font-bold text-text-main">{{ title(thread) }}</h2><time class="shrink-0 text-xs text-text-muted">{{ formatDate(thread.last_message_at || thread.created_at) }}</time></div>
          <p class="mt-1 truncate text-sm text-text-muted">{{ thread.product?.name || 'General store conversation' }}</p>
        </div>
        <span v-if="unread(thread)" class="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-black text-white">{{ unread(thread) }}</span>
        <span class="rounded-full bg-bg-alt px-2 py-1 text-[10px] font-bold uppercase text-text-muted">{{ thread.status }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getUser } from '../../services/authService'
import { supabase } from '../../utils/supabase'

const router = useRouter()
const threads = ref([])
const profileId = ref('')
const loading = ref(true)
const error = ref('')

const authHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  return { Authorization: data.session?.access_token ? `Bearer ${data.session.access_token}` : '' }
}
const isBuyer = (thread) => thread.buyer_id === profileId.value
const title = (thread) => isBuyer(thread) ? (thread.seller?.store_name || 'Seller') : (thread.buyer?.full_name || 'Buyer')
const avatar = (thread) => isBuyer(thread) ? thread.seller?.store_image_url : thread.buyer?.profile_img
const unread = (thread) => Number(isBuyer(thread) ? thread.buyer_unread_count : thread.seller_unread_count) || 0
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value)) : ''

onMounted(async () => {
  const user = await getUser()
  if (!user) return router.push('/login')
  profileId.value = user.id
  try {
    const data = await $fetch('/api/direct-messages/threads', { headers: await authHeaders() })
    threads.value = data.threads || []
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Unable to load conversations.'
  } finally {
    loading.value = false
  }
})
</script>

