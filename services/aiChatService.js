import { supabase } from '../utils/supabase'

const AI_CHAT_ENDPOINT = '/api/ai/chat'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {}
}

export async function getAiChatHistory({ signal } = {}) {
  return $fetch(AI_CHAT_ENDPOINT, {
    method: 'GET',
    credentials: 'include',
    headers: await authHeaders(),
    signal,
  })
}

export async function sendAiChatMessage({
  message,
  conversationId = null,
  clientMessageId,
  signal,
}) {
  let activeConversationId = conversationId

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await $fetch(AI_CHAT_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: await authHeaders(),
      body: {
        message,
        conversationId: activeConversationId,
        clientMessageId,
      },
      signal,
    })

    if (response?.status !== 'processing') return response

    activeConversationId = response?.conversation?.id || activeConversationId
    const retryAfterMs = Math.min(3000, Math.max(750, Number(response?.retryAfterMs) || 1500))
    await new Promise((resolve, reject) => {
      const handleAbort = () => {
        clearTimeout(timer)
        reject(new DOMException('Request aborted.', 'AbortError'))
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', handleAbort)
        resolve()
      }, retryAfterMs)
      if (signal?.aborted) handleAbort()
      else signal?.addEventListener('abort', handleAbort, { once: true })
    })
  }

  throw new Error('AI_CHAT_RESPONSE_TIMEOUT')
}

export async function getAiChatIdentity() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user?.id || null
}

export function subscribeToAiChatIdentity(listener) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(session?.user?.id || null)
  })

  return () => data.subscription.unsubscribe()
}

export function createAiChatClientMessageId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}

export function isAiChatAbortError(error) {
  return error?.name === 'AbortError' || error?.cause?.name === 'AbortError'
}

export function getAiChatErrorMessage(error) {
  const status = Number(error?.statusCode || error?.status || error?.response?.status || 0)

  if (status === 429) {
    return 'You are sending messages too quickly. Please wait a moment and try again.'
  }
  if (status === 400 || status === 422) {
    return 'That message could not be sent. Please shorten it and try again.'
  }
  if (status === 401 || status === 403) {
    return 'We could not verify this chat session. Refresh the page and try again.'
  }

  return 'AI support is temporarily unavailable. Please try again in a moment.'
}
