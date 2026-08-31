import crypto from 'node:crypto';
import type { AiChatIdentity } from '~/server/utils/ai-chat-auth';
import {
  AI_CHAT_FALLBACK_MESSAGE,
  AI_CHAT_SYSTEM_PROMPT,
  aiConversationTitle,
  buildAiChatHistory,
} from '~/server/utils/ai-chat-prompt';
import type { GeminiInteractionResult, GeminiInteractionStep } from '~/server/utils/gemini';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const CONVERSATION_COLUMNS = 'id, title, status, created_at, updated_at';
const MESSAGE_COLUMNS = 'id, conversation_id, role, content, status, client_message_id, created_at, metadata, generation_claim_token, generation_started_at, generation_attempts, reply_to_message_id';
const GENERATION_LEASE_MS = 45_000;

interface StoredConversation {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface StoredMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  client_message_id: string | null;
  created_at: string;
  metadata?: unknown;
  generation_claim_token?: string | null;
  generation_started_at?: string | null;
  generation_attempts?: number;
  reply_to_message_id?: string | null;
}

export interface PublicAiConversation {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: string;
  clientMessageId: string | null;
  createdAt: string;
  sources: PublicAiSource[];
}

export interface PublicAiSource {
  type: 'knowledge' | 'product';
  title: string;
  url: string | null;
}

function publicAiSources(metadata: unknown): PublicAiSource[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];
  const candidates = (metadata as Record<string, unknown>).rag_sources;
  if (!Array.isArray(candidates)) return [];

  const sources: PublicAiSource[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates.slice(0, 8)) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const row = candidate as Record<string, unknown>;
    const type = row.type === 'knowledge' || row.type === 'product' ? row.type : null;
    const title = typeof row.title === 'string'
      ? row.title.replace(/\s+/g, ' ').trim().slice(0, 200)
      : '';
    if (!type || !title) continue;

    const rawUrl = typeof row.url === 'string' ? row.url.trim() : '';
    const url = type === 'product' && /^\/products\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawUrl)
      ? rawUrl
      : null;
    const identity = `${type}:${title}:${url || ''}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    sources.push({ type, title, url });
  }
  return sources;
}

function databaseFailure(operation: string, error: any): never {
  console.error(`[AI chat] ${operation} failed:`, { code: error?.code || 'unknown' });
  throw createError({ statusCode: 500, statusMessage: 'Chat data could not be saved.' });
}

function scopeConversationQuery(query: any, identity: AiChatIdentity) {
  if (identity.kind === 'user') return query.eq('profile_id', identity.profileId);
  return query
    .eq('guest_session_hash', identity.guestSessionHash)
    .gt('guest_expires_at', new Date().toISOString());
}

export function toPublicAiConversation(conversation: StoredConversation): PublicAiConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
  };
}

export function toPublicAiMessage(message: StoredMessage): PublicAiMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    status: message.status,
    clientMessageId: message.client_message_id || null,
    createdAt: message.created_at,
    sources: publicAiSources(message.metadata),
  };
}

async function refreshGuestConversation(identity: AiChatIdentity, conversationId: string) {
  if (identity.kind !== 'guest') return;
  const supabase = useSupabaseAdmin();
  const { error } = await supabase
    .from('conversations')
    .update({ guest_expires_at: identity.guestExpiresAt })
    .eq('id', conversationId)
    .eq('guest_session_hash', identity.guestSessionHash)
    .gt('guest_expires_at', new Date().toISOString());
  if (error) databaseFailure('Guest session refresh', error);
}

export async function findOwnedAiConversation(
  identity: AiChatIdentity,
  conversationId?: string | null,
): Promise<StoredConversation | null> {
  const supabase = useSupabaseAdmin();
  let query = supabase.from('conversations').select(CONVERSATION_COLUMNS);

  if (conversationId) query = query.eq('id', conversationId);
  else query = query.eq('status', 'active').order('updated_at', { ascending: false }).limit(1);

  const { data, error } = await scopeConversationQuery(query, identity).maybeSingle();
  if (error) databaseFailure('Conversation lookup', error);
  return (data as StoredConversation | null) || null;
}

export async function getOrCreateAiConversation(
  identity: AiChatIdentity,
  conversationId: string | null,
  firstMessage: string,
): Promise<{ stored: StoredConversation; public: PublicAiConversation; created: boolean }> {
  const existing = await findOwnedAiConversation(identity, conversationId);
  if (existing) {
    if (identity.kind === 'guest') await refreshGuestConversation(identity, existing.id);
    return { stored: existing, public: toPublicAiConversation(existing), created: false };
  }
  if (conversationId) {
    throw createError({ statusCode: 404, statusMessage: 'Chat conversation was not found.' });
  }

  const supabase = useSupabaseAdmin();
  const owner = identity.kind === 'user'
    ? { profile_id: identity.profileId, guest_session_hash: null, guest_expires_at: null }
    : {
        profile_id: null,
        guest_session_hash: identity.guestSessionHash,
        guest_expires_at: identity.guestExpiresAt,
      };
  const { data, error } = await supabase
    .from('conversations')
    .insert({
      ...owner,
      title: aiConversationTitle(firstMessage),
      status: 'active',
      channel: 'web',
      language: 'en',
    })
    .select(CONVERSATION_COLUMNS)
    .single();
  if (error || !data) databaseFailure('Conversation creation', error);

  const conversation = data as StoredConversation;
  const { error: systemMessageError } = await supabase.from('messages').insert({
    conversation_id: conversation.id,
    role: 'system',
    sender_type: 'system',
    visibility: 'internal',
    status: 'completed',
    content: AI_CHAT_SYSTEM_PROMPT,
    metadata: { prompt_version: 'phase-3-rag-v1' },
  });
  if (systemMessageError) {
    await supabase.from('conversations').delete().eq('id', conversation.id);
    databaseFailure('System prompt persistence', systemMessageError);
  }

  return { stored: conversation, public: toPublicAiConversation(conversation), created: true };
}

export async function getAiConversationHistory(
  identity: AiChatIdentity,
  conversation: StoredConversation,
): Promise<PublicAiMessage[]> {
  const stillOwned = await findOwnedAiConversation(identity, conversation.id);
  if (!stillOwned) throw createError({ statusCode: 404, statusMessage: 'Chat conversation was not found.' });

  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, role, content, status, client_message_id, created_at, metadata')
    .eq('conversation_id', conversation.id)
    .eq('visibility', 'customer')
    .in('role', ['user', 'assistant'])
    .in('status', ['completed', 'failed', 'blocked'])
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) databaseFailure('Conversation history lookup', error);
  return (data || []).map((message: any) => toPublicAiMessage(message as StoredMessage));
}

export async function insertOrGetAiUserMessage(
  identity: AiChatIdentity,
  conversation: StoredConversation,
  clientMessageId: string,
  content: string,
): Promise<{ message: StoredMessage; replayed: boolean }> {
  const stillOwned = await findOwnedAiConversation(identity, conversation.id);
  if (!stillOwned) throw createError({ statusCode: 404, statusMessage: 'Chat conversation was not found.' });

  const supabase = useSupabaseAdmin();
  const findExisting = () => supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversation.id)
    .eq('client_message_id', clientMessageId)
    .maybeSingle();
  const { data: existing, error: lookupError } = await findExisting();
  if (lookupError) databaseFailure('Idempotency lookup', lookupError);
  if (existing) {
    if (existing.content !== content || existing.role !== 'user') {
      throw createError({ statusCode: 409, statusMessage: 'This message identifier is already in use.' });
    }
    return { message: existing as StoredMessage, replayed: true };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      role: 'user',
      sender_type: 'customer',
      author_profile_id: identity.kind === 'user' ? identity.profileId : null,
      visibility: 'customer',
      status: 'completed',
      content,
      client_message_id: clientMessageId,
      metadata: {},
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (!error && data) return { message: data as StoredMessage, replayed: false };
  if (error?.code !== '23505') databaseFailure('Customer message persistence', error);

  const { data: racedMessage, error: racedError } = await findExisting();
  if (racedError || !racedMessage) databaseFailure('Idempotent message recovery', racedError);
  if (racedMessage.content !== content || racedMessage.role !== 'user') {
    throw createError({ statusCode: 409, statusMessage: 'This message identifier is already in use.' });
  }
  return { message: racedMessage as StoredMessage, replayed: true };
}

export type AiGenerationClaim =
  | { state: 'claimed'; assistant: StoredMessage; claimToken: string }
  | { state: 'processing'; assistant: StoredMessage; retryAfterMs: number }
  | { state: 'terminal'; assistant: StoredMessage };

async function findAiReply(conversationId: string, userMessageId: string): Promise<StoredMessage | null> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .eq('reply_to_message_id', userMessageId)
    .maybeSingle();
  if (error) databaseFailure('AI response lookup', error);
  return (data as StoredMessage | null) || null;
}

export async function claimAiGeneration(
  identity: AiChatIdentity,
  conversation: StoredConversation,
  userMessage: StoredMessage,
): Promise<AiGenerationClaim> {
  const stillOwned = await findOwnedAiConversation(identity, conversation.id);
  if (!stillOwned) throw createError({ statusCode: 404, statusMessage: 'Chat conversation was not found.' });

  const supabase = useSupabaseAdmin();
  const claimToken = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      role: 'assistant',
      sender_type: 'ai',
      visibility: 'internal',
      status: 'pending',
      content: '',
      metadata: { generation_state: 'pending' },
      reply_to_message_id: userMessage.id,
      generation_claim_token: claimToken,
      generation_started_at: startedAt,
      generation_attempts: 1,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (!error && data) return { state: 'claimed', assistant: data as StoredMessage, claimToken };
  if (error?.code !== '23505') databaseFailure('AI generation claim', error);

  let assistant = await findAiReply(conversation.id, userMessage.id);
  if (!assistant) databaseFailure('AI generation claim recovery', error);
  if (assistant.status !== 'pending') return { state: 'terminal', assistant };

  const startedTime = new Date(assistant.generation_started_at || 0).getTime();
  const ageMs = Date.now() - startedTime;
  if (Number.isFinite(startedTime) && ageMs < GENERATION_LEASE_MS) {
    return {
      state: 'processing',
      assistant,
      retryAfterMs: Math.max(1000, GENERATION_LEASE_MS - Math.max(0, ageMs)),
    };
  }

  const attempts = Number(assistant.generation_attempts || 1);
  if (attempts >= 10) {
    const { data: failed, error: failedError } = await supabase
      .from('messages')
      .update({
        status: 'failed',
        visibility: 'customer',
        content: AI_CHAT_FALLBACK_MESSAGE,
        generation_claim_token: null,
        metadata: { error_code: 'GENERATION_RETRY_EXHAUSTED', retryable: false },
      })
      .eq('id', assistant.id)
      .eq('conversation_id', conversation.id)
      .eq('status', 'pending')
      .eq('generation_claim_token', assistant.generation_claim_token)
      .select(MESSAGE_COLUMNS)
      .maybeSingle();
    if (failedError) databaseFailure('AI retry exhaustion persistence', failedError);
    if (failed) return { state: 'terminal', assistant: failed as StoredMessage };
    assistant = await findAiReply(conversation.id, userMessage.id) as StoredMessage;
    return assistant.status === 'pending'
      ? { state: 'processing', assistant, retryAfterMs: 1500 }
      : { state: 'terminal', assistant };
  }

  const replacementToken = crypto.randomUUID();
  const { data: claimed, error: claimError } = await supabase
    .from('messages')
    .update({
      generation_claim_token: replacementToken,
      generation_started_at: new Date().toISOString(),
      generation_attempts: attempts + 1,
    })
    .eq('id', assistant.id)
    .eq('conversation_id', conversation.id)
    .eq('status', 'pending')
    .eq('generation_claim_token', assistant.generation_claim_token)
    .eq('generation_attempts', attempts)
    .select(MESSAGE_COLUMNS)
    .maybeSingle();
  if (claimError) databaseFailure('Stale AI generation takeover', claimError);
  if (claimed) return { state: 'claimed', assistant: claimed as StoredMessage, claimToken: replacementToken };

  assistant = await findAiReply(conversation.id, userMessage.id) as StoredMessage;
  return assistant.status === 'pending'
    ? { state: 'processing', assistant, retryAfterMs: 1500 }
    : { state: 'terminal', assistant };
}

export async function getAiPromptHistory(
  identity: AiChatIdentity,
  conversation: StoredConversation,
): Promise<GeminiInteractionStep[]> {
  const stillOwned = await findOwnedAiConversation(identity, conversation.id);
  if (!stillOwned) throw createError({ statusCode: 404, statusMessage: 'Chat conversation was not found.' });

  const supabase = useSupabaseAdmin();
  const { data: newestMessages, error } = await supabase
    .from('messages')
    .select('id, role, content, status')
    .eq('conversation_id', conversation.id)
    .eq('visibility', 'customer')
    .eq('status', 'completed')
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) databaseFailure('AI prompt history lookup', error);

  const messages = (newestMessages || []).reverse();
  const assistantIds = messages
    .filter((message: any) => message.role === 'assistant')
    .map((message: any) => message.id);
  let states: any[] = [];
  if (assistantIds.length > 0) {
    const { data: stateRows, error: stateError } = await supabase
      .from('ai_interaction_states')
      .select('assistant_message_id, provider_steps')
      .eq('conversation_id', conversation.id)
      .in('assistant_message_id', assistantIds);
    if (stateError) databaseFailure('Private interaction state lookup', stateError);
    states = stateRows || [];
  }

  return buildAiChatHistory(messages as any, states);
}

export async function completeAiGeneration(
  conversation: StoredConversation,
  assistant: StoredMessage,
  claimToken: string,
  result: GeminiInteractionResult,
  latencyMs: number,
  metadata: Record<string, unknown> = {},
): Promise<StoredMessage | null> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .update({
      visibility: 'customer',
      status: 'completed',
      content: result.text,
      model: result.model,
      finish_reason: result.status,
      provider_response_id: result.id,
      input_tokens: result.usage.inputTokens,
      output_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens,
      latency_ms: latencyMs,
      generation_claim_token: null,
      metadata,
    })
    .eq('id', assistant.id)
    .eq('conversation_id', conversation.id)
    .eq('status', 'pending')
    .eq('generation_claim_token', claimToken)
    .select(MESSAGE_COLUMNS)
    .maybeSingle();
  if (error) databaseFailure('AI response persistence', error);
  if (!data) return null;

  if (result.steps.length > 0) {
    const { error: stateError } = await supabase.from('ai_interaction_states').insert({
      conversation_id: conversation.id,
      assistant_message_id: data.id,
      provider_response_id: result.id,
      model: result.model,
      provider_steps: result.steps,
    });
    if (stateError) {
      console.error('[AI chat] Private interaction state persistence failed:', {
        conversationId: conversation.id,
        messageId: data.id,
        code: stateError.code,
      });
    }
  }

  return data as StoredMessage;
}

export async function failAiGeneration(
  conversation: StoredConversation,
  assistant: StoredMessage,
  claimToken: string,
  errorCode: string,
  retryable: boolean,
  latencyMs: number,
  publicMessage = AI_CHAT_FALLBACK_MESSAGE,
): Promise<StoredMessage | null> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase
    .from('messages')
    .update({
      visibility: 'customer',
      status: 'failed',
      content: publicMessage,
      latency_ms: latencyMs,
      generation_claim_token: null,
      metadata: { error_code: errorCode, retryable },
    })
    .eq('id', assistant.id)
    .eq('conversation_id', conversation.id)
    .eq('status', 'pending')
    .eq('generation_claim_token', claimToken)
    .select(MESSAGE_COLUMNS)
    .maybeSingle();
  if (error) databaseFailure('AI failure persistence', error);
  return (data as StoredMessage | null) || null;
}

export async function currentAiReply(
  conversationId: string,
  userMessageId: string,
): Promise<StoredMessage | null> {
  return findAiReply(conversationId, userMessageId);
}
