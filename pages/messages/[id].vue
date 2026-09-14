<template>
  <div class="conversation-shell mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-hidden bg-surface font-poppins md:rounded-2xl md:border md:border-bg-alt md:shadow-sm">
    <header class="conversation-header flex shrink-0 items-center gap-2 border-b border-bg-alt px-3 py-3 sm:gap-3 sm:px-5">
      <NuxtLink to="/messages" class="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" /></svg></NuxtLink>
      <div class="min-w-0 flex-1"><h1 class="truncate font-black text-text-main">{{ counterpartName }}</h1><p class="truncate text-xs text-text-muted">{{ conversationLabel }}</p></div>
      <button v-if="thread" type="button" class="rounded-lg px-2.5 py-2 text-xs font-bold text-text-muted transition hover:bg-red-500/10 hover:text-red-500" @click="reportConversation">Report</button>
      <span v-if="thread" class="rounded-full bg-bg-alt px-2.5 py-1 text-[10px] font-bold uppercase text-text-muted">{{ thread.status }}</span>
    </header>

    <section v-if="productContext" class="flex shrink-0 items-center gap-2 border-b border-bg-alt bg-bg/45 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3" aria-label="Conversation product">
      <NuxtLink v-if="productIsAvailable" :to="`/products/${productContext.slug}`" class="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-bg-alt bg-bg-alt sm:h-14 sm:w-[4.5rem]">
        <img v-if="productPrimaryImage" :src="productPrimaryImage" :alt="productContext.name" class="h-full w-full object-cover">
        <span v-else class="flex h-full w-full items-center justify-center text-lg font-black text-text-muted">{{ productContext.name?.charAt(0)?.toUpperCase() || 'P' }}</span>
      </NuxtLink>
      <div v-else class="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-bg-alt bg-bg-alt sm:h-14 sm:w-[4.5rem]">
        <img v-if="productPrimaryImage" :src="productPrimaryImage" :alt="productContext.name" class="h-full w-full object-cover opacity-70">
        <span v-else class="flex h-full w-full items-center justify-center text-lg font-black text-text-muted">{{ productContext.name?.charAt(0)?.toUpperCase() || 'P' }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Conversation product</p>
        <NuxtLink v-if="productIsAvailable" :to="`/products/${productContext.slug}`" class="mt-0.5 block truncate text-sm font-black text-text-main transition hover:text-primary sm:text-base">{{ productContext.name }}</NuxtLink>
        <p v-else class="mt-0.5 truncate text-sm font-black text-text-main sm:text-base">{{ productContext.name }}</p>
        <p class="mt-0.5 truncate text-[11px] font-medium text-text-muted sm:text-xs">{{ productCategoryLabel }}</p>
      </div>

      <div class="shrink-0 text-right">
        <div class="flex items-center justify-end gap-0.5" :aria-label="productReviewCount ? `${productAverageRating.toFixed(1)} out of 5 stars from ${productReviewCount} reviews` : 'No product ratings yet'">
          <svg v-for="star in 5" :key="star" class="h-3.5 w-3.5 sm:h-4 sm:w-4" :class="star <= Math.round(productAverageRating) ? 'fill-amber-400 text-amber-400' : 'fill-bg-alt text-bg-alt'" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292Z" /></svg>
        </div>
        <p class="mt-1 text-[10px] font-semibold text-text-muted sm:text-xs">{{ productReviewCount ? `${productAverageRating.toFixed(1)} (${productReviewCount})` : 'No ratings' }}</p>
        <span v-if="!productIsAvailable" class="mt-1 inline-block rounded-full bg-bg-alt px-2 py-0.5 text-[9px] font-bold uppercase text-text-muted">Unavailable</span>
      </div>
    </section>

    <div v-if="loading" class="flex min-h-0 flex-1 items-center justify-center"><span class="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span></div>
    <div v-else-if="error" class="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{{ error }}</div>
    <template v-else>
      <div ref="messageList" class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-bg/40 p-4 sm:p-6">
        <div v-if="!messages.length" class="py-16 text-center text-sm text-text-muted">Send the first message to begin this conversation.</div>
        <div v-for="message in messages" :key="message.id" class="flex" :class="message.sender_profile_id === profileId ? 'justify-end' : 'justify-start'">
          <div class="max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[70%]" :class="message.sender_profile_id === profileId ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-bg-alt bg-surface text-text-main'">
            <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
            <p class="mt-1 text-right text-[10px]" :class="message.sender_profile_id === profileId ? 'text-white/70' : 'text-text-muted'">{{ formatTime(message.created_at) }}<span v-if="message.sender_profile_id === profileId"> · {{ message.is_read ? 'Read' : 'Sent' }}</span></p>
          </div>
        </div>
      </div>

      <form class="conversation-composer shrink-0 border-t border-bg-alt bg-surface p-3 sm:p-4" @submit.prevent="sendMessage">
        <div class="flex items-end gap-2 rounded-2xl border border-bg-alt bg-bg px-3 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <textarea v-model="draft" :disabled="sending || thread?.status !== 'open'" rows="1" maxlength="5000" class="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-base text-text-main outline-none sm:text-sm" :placeholder="thread?.status === 'open' ? 'Write a message…' : 'This conversation is closed.'" @focus="handleComposerFocus" @keydown.enter.exact.prevent="sendMessage"></textarea>
          <button type="submit" :disabled="sending || !draft.trim() || thread?.status !== 'open'" class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"><span v-if="sending" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span><svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 12-3.269-9.53A59.768 59.768 0 0 1 21.485 12 59.768 59.768 0 0 1 2.731 21.53L6 12Zm0 0h7.5" /></svg></button>
        </div>
        <p v-if="sendError" class="mt-2 text-xs font-semibold text-red-500">{{ sendError }}</p>
      </form>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getUser } from '../../services/authService'
import { supabase } from '../../utils/supabase'

const route = useRoute()
const router = useRouter()
const thread = ref(null)
const messages = ref([])
const profileId = ref('')
const draft = ref('')
const loading = ref(true)
const sending = ref(false)
const error = ref('')
const sendError = ref('')
const messageList = ref(null)
let channel = null

const threadId = computed(() => String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id || ''))
const counterpartName = computed(() => thread.value?.buyer_id === profileId.value ? (thread.value?.seller?.store_name || 'Seller') : (thread.value?.buyer?.full_name || 'Buyer'))
const conversationLabel = computed(() => thread.value?.product ? 'Product conversation' : 'General store conversation')
const productContext = computed(() => {
  const product = thread.value?.product
  return Array.isArray(product) ? product[0] || null : product || null
})
const productIsAvailable = computed(() => productContext.value?.status === 'published' && Boolean(productContext.value?.slug))
const productPrimaryImage = computed(() => {
  const images = Array.isArray(productContext.value?.product_images) ? productContext.value.product_images : []
  return images.find(image => image.is_primary)?.image_url || images[0]?.image_url || ''
})
const productCategories = computed(() => {
  const links = Array.isArray(productContext.value?.product_categories) ? productContext.value.product_categories : []
  return links.flatMap((link) => {
    const categories = Array.isArray(link?.categories) ? link.categories : [link?.categories]
    return categories.filter(Boolean)
  })
})
const productCategoryLabel = computed(() => {
  const names = productCategories.value.map(category => category.name).filter(Boolean)
  return names.length ? names.join(' · ') : 'Uncategorized'
})
const productReviews = computed(() => Array.isArray(productContext.value?.reviews) ? productContext.value.reviews : [])
const productReviewCount = computed(() => productReviews.value.length)
const productAverageRating = computed(() => {
  if (!productReviewCount.value) return 0
  return productReviews.value.reduce((total, review) => total + Number(review?.rating || 0), 0) / productReviewCount.value
})
const authHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  return { Authorization: data.session?.access_token ? `Bearer ${data.session.access_token}` : '' }
}
const scrollBottom = async () => { await nextTick(); if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight }
const handleComposerFocus = () => {
  // The visual viewport settles shortly after the mobile keyboard opens.
  window.setTimeout(() => { void scrollBottom() }, 180)
}
const formatTime = (value) => value ? new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : ''

const markRead = async () => {
  await $fetch(`/api/direct-messages/${threadId.value}/read`, { method: 'POST', headers: await authHeaders() }).catch(() => {})
}
const loadConversation = async () => {
  const data = await $fetch(`/api/direct-messages/${threadId.value}`, { headers: await authHeaders() })
  thread.value = data.thread
  messages.value = data.messages || []
  await markRead()
  await scrollBottom()
}
const sendMessage = async () => {
  const content = draft.value.trim()
  if (!content || sending.value) return
  sending.value = true
  sendError.value = ''
  try {
    const data = await $fetch(`/api/direct-messages/${threadId.value}/messages`, { method: 'POST', headers: await authHeaders(), body: { content } })
    if (!messages.value.some((message) => message.id === data.message.id)) messages.value.push(data.message)
    draft.value = ''
    await scrollBottom()
  } catch (err) {
    sendError.value = err?.data?.statusMessage || err?.message || 'Message could not be sent.'
  } finally {
    sending.value = false
  }
}
const reportConversation = async () => {
  const reason = window.prompt('Why are you reporting this conversation?')?.trim()
  if (!reason) return
  try {
    await $fetch(`/api/direct-messages/${threadId.value}/reports`, { method: 'POST', headers: await authHeaders(), body: { reason } })
    window.alert('Your report was submitted for admin review.')
  } catch (err) {
    window.alert(err?.data?.statusMessage || err?.message || 'The report could not be submitted.')
  }
}

onMounted(async () => {
  const user = await getUser()
  if (!user) return router.push('/login')
  profileId.value = user.id
  try {
    await loadConversation()
    channel = supabase.channel(`direct-thread-${threadId.value}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'buyer_seller_messages', filter: `thread_id=eq.${threadId.value}` }, async () => {
        await loadConversation()
      })
      .subscribe()
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Unable to load this conversation.'
  } finally {
    loading.value = false
  }
})
onBeforeUnmount(() => { if (channel) supabase.removeChannel(channel) })
</script>

<style scoped>
@media (max-width: 767px) {
  .conversation-header {
    padding-top: max(0.75rem, env(safe-area-inset-top));
  }

  .conversation-composer {
    padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
  }
}
</style>
