<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  createAiChatClientMessageId,
  getAiChatErrorMessage,
  getAiChatHistory,
  getAiChatIdentity,
  isAiChatAbortError,
  sendAiChatMessage,
  subscribeToAiChatIdentity,
} from '../../services/aiChatService'

const MAX_MESSAGE_LENGTH = 2000
const MAX_MESSAGE_SOURCES = 6
const MAX_SOURCE_TITLE_LENGTH = 120
const SAFE_PRODUCT_SOURCE_URL = /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/
const route = useRoute()
const isOpen = ref(false)
const conversation = ref(null)
const messages = ref([])
const draft = ref('')
const historyLoaded = ref(false)
const historyLoading = ref(false)
const sending = ref(false)
const errorMessage = ref('')
const errorAction = ref(null)
const pendingRetry = ref(null)
const launcherRef = ref(null)
const composerRef = ref(null)
const messageListRef = ref(null)
const canShow = computed(() => !route.path.startsWith('/admin'))
const canSend = computed(() => (
  Boolean(draft.value.trim())
  && !sending.value
  && !historyLoading.value
))
const charactersRemaining = computed(() => MAX_MESSAGE_LENGTH - draft.value.length)

let historyController = null
let sendController = null
let unsubscribeIdentity = null
let identityInitialized = false
let activeIdentity = null

function normalizeMessageSources(value) {
  if (!Array.isArray(value)) return []

  const sources = []
  const seen = new Set()

  for (const source of value) {
    if (sources.length >= MAX_MESSAGE_SOURCES) break

    const type = String(source?.type || '').trim().toLowerCase()
    if (!['knowledge', 'product'].includes(type)) continue

    const title = String(source?.title || source?.label || '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_SOURCE_TITLE_LENGTH)
    if (!title) continue

    const requestedUrl = String(source?.url || '').trim()
    const url = type === 'product' && SAFE_PRODUCT_SOURCE_URL.test(requestedUrl)
      ? requestedUrl
      : null
    const sourceKey = `${type}:${title}:${url || ''}`
    if (seen.has(sourceKey)) continue

    seen.add(sourceKey)
    sources.push({ type, title, url })
  }

  return sources
}

function normalizeMessage(message) {
  const role = String(message?.role || '').toLowerCase()
  const content = String(message?.content || '').trim()
  if (!['user', 'assistant'].includes(role) || !content) return null

  return {
    id: String(message?.id || createAiChatClientMessageId()),
    role,
    content,
    status: String(message?.status || 'completed'),
    createdAt: message?.createdAt || message?.created_at || new Date().toISOString(),
    sources: normalizeMessageSources(message?.sources),
  }
}

function normalizeConversation(value) {
  if (!value?.id) return null
  return {
    id: String(value.id),
    status: String(value.status || 'active'),
    createdAt: value.createdAt || value.created_at || null,
    updatedAt: value.updatedAt || value.updated_at || null,
  }
}

function formatMessageTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

async function scrollToLatest() {
  await nextTick()
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight
  }
}

function focusComposer() {
  nextTick(() => composerRef.value?.focus())
}

function clearError() {
  errorMessage.value = ''
  errorAction.value = null
}

async function loadHistory({ force = false } = {}) {
  if (historyLoading.value || (historyLoaded.value && !force)) return

  historyController?.abort()
  historyController = new AbortController()
  historyLoading.value = true
  clearError()

  try {
    const data = await getAiChatHistory({ signal: historyController.signal })
    conversation.value = normalizeConversation(data?.conversation)
    messages.value = (Array.isArray(data?.messages) ? data.messages : [])
      .map(normalizeMessage)
      .filter(Boolean)
    historyLoaded.value = true
    await scrollToLatest()
  } catch (error) {
    if (isAiChatAbortError(error)) return
    errorMessage.value = getAiChatErrorMessage(error)
    errorAction.value = 'history'
  } finally {
    historyLoading.value = false
  }
}

async function openChat() {
  isOpen.value = true
  focusComposer()
  await loadHistory()
}

function closeChat({ restoreFocus = false } = {}) {
  isOpen.value = false
  if (restoreFocus) nextTick(() => launcherRef.value?.focus())
}

function replaceOptimisticMessage(localId, serverMessage) {
  const index = messages.value.findIndex((message) => message.id === localId)
  if (index >= 0) {
    messages.value.splice(index, 1, serverMessage)
    return
  }
  if (!messages.value.some((message) => message.id === serverMessage.id)) {
    messages.value.push(serverMessage)
  }
}

function appendUniqueMessage(message) {
  if (!messages.value.some((existing) => existing.id === message.id)) {
    messages.value.push(message)
  }
}

async function submitMessage(retry = null) {
  if (sending.value) return

  const content = String(retry?.content || draft.value).trim()
  if (!content || content.length > MAX_MESSAGE_LENGTH) return

  const clientMessageId = retry?.clientMessageId || createAiChatClientMessageId()
  const localId = retry?.localId || clientMessageId
  let optimisticMessage = messages.value.find((message) => message.id === localId)

  if (optimisticMessage) {
    optimisticMessage.status = 'pending'
  } else {
    optimisticMessage = {
      id: localId,
      role: 'user',
      content,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    messages.value.push(optimisticMessage)
  }

  if (!retry) draft.value = ''
  pendingRetry.value = null
  clearError()
  sending.value = true
  sendController?.abort()
  sendController = new AbortController()
  await scrollToLatest()

  try {
    const data = await sendAiChatMessage({
      message: content,
      conversationId: conversation.value?.id || null,
      clientMessageId,
      signal: sendController.signal,
    })
    const serverUserMessage = normalizeMessage(data?.userMessage)
    const assistantMessage = normalizeMessage(data?.assistantMessage)

    if (!serverUserMessage || !assistantMessage || assistantMessage.role !== 'assistant') {
      throw new Error('INVALID_AI_CHAT_RESPONSE')
    }

    conversation.value = normalizeConversation(data?.conversation) || conversation.value
    replaceOptimisticMessage(localId, serverUserMessage)
    appendUniqueMessage(assistantMessage)
    historyLoaded.value = true
  } catch (error) {
    if (isAiChatAbortError(error)) return
    const failedMessage = messages.value.find((message) => message.id === localId)
    if (failedMessage) failedMessage.status = 'failed'
    pendingRetry.value = { content, clientMessageId, localId }
    errorMessage.value = getAiChatErrorMessage(error)
    errorAction.value = 'send'
  } finally {
    sending.value = false
    await scrollToLatest()
    focusComposer()
  }
}

function handleComposerKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (canSend.value) submitMessage()
  }
}

function resizeComposer(event) {
  const textarea = event.currentTarget
  textarea.style.height = 'auto'
  textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`
}

function retryErrorAction() {
  if (errorAction.value === 'history') return loadHistory({ force: true })
  if (errorAction.value === 'send' && pendingRetry.value) return submitMessage(pendingRetry.value)
}

function resetLocalConversation() {
  historyController?.abort()
  sendController?.abort()
  conversation.value = null
  messages.value = []
  draft.value = ''
  historyLoaded.value = false
  historyLoading.value = false
  sending.value = false
  pendingRetry.value = null
  clearError()
}

function applyIdentity(identity) {
  if (!identityInitialized) {
    identityInitialized = true
    activeIdentity = identity
    return
  }
  if (identity === activeIdentity) return

  activeIdentity = identity
  resetLocalConversation()
  if (isOpen.value) loadHistory({ force: true })
}

function handleGlobalKeydown(event) {
  if (event.key === 'Escape' && isOpen.value) closeChat({ restoreFocus: true })
}

watch(canShow, (visible) => {
  if (!visible && isOpen.value) closeChat()
})

watch(() => messages.value.length, () => scrollToLatest())

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown)
  unsubscribeIdentity = subscribeToAiChatIdentity(applyIdentity)

  try {
    applyIdentity(await getAiChatIdentity())
  } catch {
    applyIdentity(null)
  }
})

onBeforeUnmount(() => {
  historyController?.abort()
  sendController?.abort()
  unsubscribeIdentity?.()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div v-if="canShow" class="font-montserrat">
    <Transition name="ai-chat-panel">
      <section
        v-if="isOpen"
        id="ai-customer-service-dialog"
        class="ai-chat-panel fixed z-40 flex overflow-hidden rounded-3xl border border-bg-alt/80 bg-surface text-text-main shadow-2xl"
        role="dialog"
        aria-labelledby="ai-chat-title"
        aria-describedby="ai-chat-description"
        :aria-busy="historyLoading || sending"
      >
        <div class="flex min-h-0 w-full flex-col">
          <header class="flex items-center gap-3 border-b border-bg-alt/80 px-4 py-3.5 sm:px-5">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 0h-.375m4.875 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 0H13.5m4.875 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 0h-.375M21 12c0 4.142-4.03 7.5-9 7.5a10.6 10.6 0 0 1-4.151-.82L3 20.25l1.44-3.84A6.857 6.857 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z" />
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <h2 id="ai-chat-title" class="truncate font-poppins text-sm font-bold text-text-main sm:text-base">Weixies AI Support</h2>
              <p id="ai-chat-description" class="truncate text-xs text-text-muted">General guidance for using Weixies</p>
            </div>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-text-muted transition hover:bg-bg-alt hover:text-text-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close AI support chat"
              @click="closeChat({ restoreFocus: true })"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div
            ref="messageListRef"
            class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-bg/60 px-4 py-5 sm:px-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <div v-if="historyLoading && !messages.length" class="flex h-full min-h-52 flex-col items-center justify-center gap-3 text-center text-text-muted" role="status">
              <span class="h-7 w-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
              <p class="text-sm">Loading your conversation…</p>
            </div>

            <div v-else-if="!messages.length" class="flex h-full min-h-52 flex-col items-center justify-center px-4 text-center">
              <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.813 15.904 9 18l-.813-2.096a4.5 4.5 0 0 0-2.591-2.591L3.5 12.5l2.096-.813a4.5 4.5 0 0 0 2.591-2.591L9 7l.813 2.096a4.5 4.5 0 0 0 2.591 2.591l2.096.813-2.096.813a4.5 4.5 0 0 0-2.591 2.591ZM18.259 8.715 18 9.5l-.259-.785a2.25 2.25 0 0 0-1.456-1.456L15.5 7l.785-.259a2.25 2.25 0 0 0 1.456-1.456L18 4.5l.259.785a2.25 2.25 0 0 0 1.456 1.456L20.5 7l-.785.259a2.25 2.25 0 0 0-1.456 1.456Z" />
                </svg>
              </div>
              <h3 class="font-poppins text-lg font-bold text-text-main">How can we help?</h3>
              <p class="mt-2 max-w-xs text-sm leading-6 text-text-muted">Send a question and our AI support assistant will reply here.</p>
            </div>

            <ol v-else class="space-y-4">
              <li
                v-for="message in messages"
                :key="message.id"
                :class="['flex', message.role === 'user' ? 'justify-end' : 'justify-start']"
              >
                <div :class="['max-w-[86%]', message.role === 'user' ? 'items-end' : 'items-start']" class="flex flex-col gap-1">
                  <span class="sr-only">{{ message.role === 'user' ? 'You' : 'AI support' }}</span>
                  <div
                    :class="message.role === 'user'
                      ? 'rounded-2xl rounded-br-md bg-primary-dark text-white dark:bg-indigo-700'
                      : 'rounded-2xl rounded-bl-md border border-bg-alt bg-surface text-text-main'"
                    class="whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-6 shadow-sm"
                  >
                    {{ message.content }}
                  </div>
                  <ul
                    v-if="message.role === 'assistant' && message.sources.length"
                    class="flex max-w-full flex-wrap gap-1.5 px-1 pt-0.5"
                    aria-label="Sources"
                  >
                    <li
                      v-for="(source, sourceIndex) in message.sources"
                      :key="`${message.id}-source-${source.type}-${source.title}-${sourceIndex}`"
                      class="min-w-0 max-w-full"
                    >
                      <NuxtLink
                        v-if="source.type === 'product' && source.url"
                        :to="source.url"
                        :title="source.title"
                        class="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-semibold leading-4 text-primary transition hover:border-primary/40 hover:bg-primary/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        :aria-label="`View product: ${source.title}`"
                      >
                        <svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.75 6.75h16.5M5.25 6.75l.75 12h12l.75-12M9 10.5v4.5m6-4.5v4.5M8.25 6.75l.75-3h6l.75 3" />
                        </svg>
                        <span class="truncate">{{ source.title }}</span>
                      </NuxtLink>
                      <span
                        v-else
                        :title="source.title"
                        class="inline-flex max-w-full items-center gap-1 rounded-full border border-bg-alt bg-surface px-2 py-1 text-[10px] font-semibold leading-4 text-text-muted"
                      >
                        <svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 5.25A2.25 2.25 0 0 1 6.75 3h10.5a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 17.25 21H6.75a2.25 2.25 0 0 1-2.25-2.25V5.25Zm4.5 3h6m-6 3h6m-6 3h3" />
                        </svg>
                        <span class="truncate">{{ source.title }}</span>
                      </span>
                    </li>
                  </ul>
                  <div class="flex items-center gap-1.5 px-1 text-[10px] text-text-muted">
                    <span>{{ formatMessageTime(message.createdAt) }}</span>
                    <span v-if="message.status === 'pending'">Sending…</span>
                    <span v-else-if="message.status === 'failed'" class="font-semibold text-red-500">
                      {{ message.role === 'user' ? 'Not sent' : 'Service unavailable' }}
                    </span>
                  </div>
                </div>
              </li>
            </ol>

            <div v-if="sending" class="mt-4 flex justify-start" role="status" aria-label="AI support is typing">
              <div class="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-bg-alt bg-surface px-4 py-3 shadow-sm">
                <span class="ai-typing-dot h-1.5 w-1.5 rounded-full bg-text-muted" />
                <span class="ai-typing-dot h-1.5 w-1.5 rounded-full bg-text-muted" />
                <span class="ai-typing-dot h-1.5 w-1.5 rounded-full bg-text-muted" />
                <span class="sr-only">AI support is typing</span>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" class="border-t border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300" role="alert">
            <div class="flex items-start justify-between gap-3">
              <p class="leading-5">{{ errorMessage }}</p>
              <button
                v-if="errorAction"
                type="button"
                class="shrink-0 rounded-lg px-2 py-1 font-bold transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-900/50"
                :disabled="sending || historyLoading"
                @click="retryErrorAction"
              >
                Try again
              </button>
            </div>
          </div>

          <form class="border-t border-bg-alt/80 bg-surface px-3 py-3 sm:px-4" @submit.prevent="submitMessage()">
            <label for="ai-customer-service-input" class="sr-only">Message AI support</label>
            <div class="flex items-end gap-2 rounded-2xl border border-bg-alt bg-bg px-3 py-2 transition focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
              <textarea
                id="ai-customer-service-input"
                ref="composerRef"
                v-model="draft"
                rows="1"
                :maxlength="MAX_MESSAGE_LENGTH"
                class="max-h-28 min-h-7 flex-1 resize-none bg-transparent py-1 text-sm leading-5 text-text-main outline-none placeholder:text-text-muted/80"
                placeholder="Type your question…"
                :disabled="sending || historyLoading"
                @keydown="handleComposerKeydown"
                @input="resizeComposer"
              />
              <button
                type="submit"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-dark text-white shadow-sm transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-indigo-700 dark:hover:bg-indigo-600"
                :disabled="!canSend"
                aria-label="Send message"
              >
                <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5-15 7.5Z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 18.75v-6h-6" />
                </svg>
              </button>
            </div>
            <div class="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-text-muted">
              <p>AI may make mistakes. Do not share passwords or payment details.</p>
              <span v-if="charactersRemaining <= 200" class="shrink-0">{{ charactersRemaining }}</span>
            </div>
          </form>
        </div>
      </section>
    </Transition>

    <Transition name="ai-chat-launcher">
      <button
        v-if="!isOpen"
        ref="launcherRef"
        type="button"
        class="ai-chat-launcher fixed z-40 flex h-14 items-center gap-2 rounded-full bg-primary-dark px-4 text-sm font-bold text-white shadow-[0_12px_34px_rgba(79,70,229,0.35)] transition hover:-translate-y-0.5 hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg dark:bg-indigo-700 dark:hover:bg-indigo-600 sm:h-16 sm:px-5"
        aria-label="Open AI customer support chat"
        aria-controls="ai-customer-service-dialog"
        aria-expanded="false"
        @click="openChat"
      >
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 0h-.375m4.875 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 0H13.5m4.875 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm.375 0h-.375M21 12c0 4.142-4.03 7.5-9 7.5a10.6 10.6 0 0 1-4.151-.82L3 20.25l1.44-3.84A6.857 6.857 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z" />
        </svg>
        <span class="hidden sm:inline">AI Support</span>
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.ai-chat-panel {
  inset-inline: 0.75rem;
  bottom: calc(5.5rem + env(safe-area-inset-bottom));
  height: min(38rem, calc(100dvh - 7rem - env(safe-area-inset-bottom)));
}

.ai-chat-launcher {
  right: 1rem;
  bottom: calc(5.25rem + env(safe-area-inset-bottom));
}

.ai-chat-panel-enter-active,
.ai-chat-panel-leave-active,
.ai-chat-launcher-enter-active,
.ai-chat-launcher-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.ai-chat-panel-enter-from,
.ai-chat-panel-leave-to {
  opacity: 0;
  transform: translateY(1rem) scale(0.97);
}

.ai-chat-launcher-enter-from,
.ai-chat-launcher-leave-to {
  opacity: 0;
  transform: translateY(0.75rem) scale(0.9);
}

.ai-typing-dot {
  animation: ai-chat-typing 1.2s ease-in-out infinite;
}

.ai-typing-dot:nth-child(2) {
  animation-delay: 140ms;
}

.ai-typing-dot:nth-child(3) {
  animation-delay: 280ms;
}

@keyframes ai-chat-typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-0.2rem); opacity: 1; }
}

@media (min-width: 768px) {
  .ai-chat-panel {
    inset-inline: auto 1.5rem;
    bottom: 1.5rem;
    width: 24rem;
    height: min(40rem, calc(100dvh - 3rem));
  }

  .ai-chat-launcher {
    right: 1.5rem;
    bottom: 1.5rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-chat-panel-enter-active,
  .ai-chat-panel-leave-active,
  .ai-chat-launcher-enter-active,
  .ai-chat-launcher-leave-active,
  .ai-typing-dot {
    animation: none;
    transition-duration: 1ms;
  }
}
</style>
