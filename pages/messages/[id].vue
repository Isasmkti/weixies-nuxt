<template>
  <div class="mx-auto flex h-[calc(100vh-4rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-bg-alt bg-surface font-poppins shadow-sm md:h-[calc(100vh-4rem)]">
    <header class="flex items-center gap-3 border-b border-bg-alt px-4 py-3 sm:px-5">
      <NuxtLink to="/messages" class="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" /></svg></NuxtLink>
      <div class="min-w-0 flex-1"><h1 class="truncate font-black text-text-main">{{ counterpartName }}</h1><p class="truncate text-xs text-text-muted">{{ thread?.product?.name || 'General store conversation' }}</p></div>
      <button v-if="thread" type="button" class="rounded-lg px-2.5 py-2 text-xs font-bold text-text-muted transition hover:bg-red-500/10 hover:text-red-500" @click="reportConversation">Report</button>
      <span v-if="thread" class="rounded-full bg-bg-alt px-2.5 py-1 text-[10px] font-bold uppercase text-text-muted">{{ thread.status }}</span>
    </header>

    <div v-if="loading" class="flex flex-1 items-center justify-center"><span class="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span></div>
    <div v-else-if="error" class="m-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{{ error }}</div>
    <template v-else>
      <div ref="messageList" class="flex-1 space-y-3 overflow-y-auto bg-bg/40 p-4 sm:p-6">
        <div v-if="!messages.length" class="py-16 text-center text-sm text-text-muted">Send the first message to begin this conversation.</div>
        <div v-for="message in messages" :key="message.id" class="flex" :class="message.sender_profile_id === profileId ? 'justify-end' : 'justify-start'">
          <div class="max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:max-w-[70%]" :class="message.sender_profile_id === profileId ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-bg-alt bg-surface text-text-main'">
            <p class="whitespace-pre-wrap break-words">{{ message.content }}</p>
            <p class="mt-1 text-right text-[10px]" :class="message.sender_profile_id === profileId ? 'text-white/70' : 'text-text-muted'">{{ formatTime(message.created_at) }}<span v-if="message.sender_profile_id === profileId"> · {{ message.is_read ? 'Read' : 'Sent' }}</span></p>
          </div>
        </div>
      </div>

      <form class="border-t border-bg-alt bg-surface p-3 sm:p-4" @submit.prevent="sendMessage">
        <div class="flex items-end gap-2 rounded-2xl border border-bg-alt bg-bg px-3 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
          <textarea v-model="draft" :disabled="sending || thread?.status !== 'open'" rows="1" maxlength="5000" class="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-text-main outline-none" :placeholder="thread?.status === 'open' ? 'Write a message…' : 'This conversation is closed.'" @keydown.enter.exact.prevent="sendMessage"></textarea>
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
const authHeaders = async () => {
  const { data } = await supabase.auth.getSession()
  return { Authorization: data.session?.access_token ? `Bearer ${data.session.access_token}` : '' }
}
const scrollBottom = async () => { await nextTick(); if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight }
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
