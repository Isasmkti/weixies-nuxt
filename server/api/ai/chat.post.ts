import { aiChatIpHash, resolveAiChatIdentity } from '~/server/utils/ai-chat-auth';
import { buildAiChatSystemInstruction } from '~/server/utils/ai-chat-prompt';
import {
  assertAiChatPostRequest,
  optionalAiChatUuid,
  readAiChatJsonBody,
  requireAiChatMessage,
  requireAiChatUuid,
  setAiChatResponseHeaders,
} from '~/server/utils/ai-chat-security';
import {
  claimAiGeneration,
  completeAiGeneration,
  currentAiReply,
  failAiGeneration,
  getAiPromptHistory,
  getOrCreateAiConversation,
  insertOrGetAiUserMessage,
  toPublicAiMessage,
} from '~/server/utils/ai-chat-store';
import {
  retrieveAiRagContext,
  sanitizeAiRagSource,
  type AiRagRetrievalResult,
} from '~/server/utils/ai-rag';
import {
  createGeminiInteraction,
  GeminiServiceError,
} from '~/server/utils/gemini';
import { enforceRateLimit } from '~/server/utils/rate-limit';

async function enforceGenerationLimits(identity: NonNullable<Awaited<ReturnType<typeof resolveAiChatIdentity>>>) {
  const minuteLimit = identity.kind === 'user' ? 10 : 5;
  const dailyLimit = identity.kind === 'user' ? 100 : 30;
  await enforceRateLimit(`ai-chat:generation:minute:${identity.rateLimitId}`, minuteLimit, 60);
  await enforceRateLimit(`ai-chat:generation:day:${identity.rateLimitId}`, dailyLimit, 86_400);
  await enforceRateLimit('ai-chat:generation:global', 100, 60);
}

export default defineEventHandler(async (event) => {
  setAiChatResponseHeaders(event);
  assertAiChatPostRequest(event);
  const body = await readAiChatJsonBody(event);
  const message = requireAiChatMessage(body.message);
  const conversationId = optionalAiChatUuid(body.conversationId, 'conversationId');
  const clientMessageId = requireAiChatUuid(body.clientMessageId, 'clientMessageId');

  // This inexpensive IP gate runs before a guest cookie is issued, so rotating
  // cookies cannot create unlimited provider calls.
  const ipHash = aiChatIpHash(event);
  await enforceRateLimit(`ai-chat:request:minute:ip:${ipHash}`, 30, 60);
  await enforceRateLimit(`ai-chat:request:day:ip:${ipHash}`, 300, 86_400);

  const identity = await resolveAiChatIdentity(event, {
    createGuest: true,
    claimGuest: true,
  });
  if (!identity) throw createError({ statusCode: 401, statusMessage: 'Chat session is unavailable.' });

  const conversation = await getOrCreateAiConversation(
    identity,
    conversationId,
    message,
  );
  if (conversation.stored.status !== 'active') {
    throw createError({
      statusCode: 409,
      statusMessage: 'This conversation is no longer accepting AI messages.',
    });
  }

  const storedUser = await insertOrGetAiUserMessage(
    identity,
    conversation.stored,
    clientMessageId,
    message,
  );
  const claim = await claimAiGeneration(identity, conversation.stored, storedUser.message);

  if (claim.state === 'terminal') {
    return {
      conversation: conversation.public,
      userMessage: toPublicAiMessage(storedUser.message),
      assistantMessage: toPublicAiMessage(claim.assistant),
      replayed: true,
      degraded: claim.assistant.status !== 'completed',
    };
  }

  if (claim.state === 'processing') {
    setResponseStatus(event, 202);
    return {
      conversation: conversation.public,
      userMessage: toPublicAiMessage(storedUser.message),
      assistantMessage: null,
      status: 'processing',
      replayed: true,
      retryAfterMs: Math.min(3000, claim.retryAfterMs),
    };
  }

  // Cost-bearing limits are consumed only by the worker that owns the lease;
  // idempotent replays and pending polls do not spend Gemini quota.
  try {
    await enforceGenerationLimits(identity);
  } catch (error: any) {
    const rateLimited = Number(error?.statusCode || error?.status || 0) === 429;
    const failed = await failAiGeneration(
      conversation.stored,
      claim.assistant,
      claim.claimToken,
      rateLimited ? 'AI_CHAT_RATE_LIMITED' : 'AI_CHAT_RATE_LIMIT_CHECK_FAILED',
      true,
      0,
      rateLimited
        ? 'You are sending messages too quickly. Please wait a moment and send a new message.'
        : undefined,
    );
    if (!failed) throw error;
    return {
      conversation: conversation.public,
      userMessage: toPublicAiMessage(storedUser.message),
      assistantMessage: toPublicAiMessage(failed),
      replayed: storedUser.replayed,
      degraded: true,
      rateLimited,
    };
  }
  let history: Awaited<ReturnType<typeof getAiPromptHistory>>;
  try {
    history = await getAiPromptHistory(identity, conversation.stored);
  } catch (error) {
    // Once a worker owns a generation lease, do not leave the customer reply
    // hidden in `pending` when context preparation fails. A successful failure
    // write also makes an idempotent retry return the same terminal response.
    const failed = await failAiGeneration(
      conversation.stored,
      claim.assistant,
      claim.claimToken,
      'AI_CHAT_CONTEXT_UNAVAILABLE',
      true,
      0,
    );
    if (!failed) throw error;
    return {
      conversation: conversation.public,
      userMessage: toPublicAiMessage(storedUser.message),
      assistantMessage: toPublicAiMessage(failed),
      replayed: storedUser.replayed,
      degraded: true,
    };
  }

  let rag: AiRagRetrievalResult = { context: '', sources: [] };
  try {
    const retrieved = await retrieveAiRagContext(message);
    rag = {
      context: retrieved.context,
      // Re-validate immediately before this metadata is persisted. Customers
      // can read their own customer-visible message rows through Supabase RLS.
      sources: retrieved.sources
        .map((source) => sanitizeAiRagSource(source))
        .filter((source): source is NonNullable<typeof source> => Boolean(source)),
    };
  } catch (error: any) {
    // Retrieval is an enhancement, not a reason to strand a chat request. The
    // restricted base prompt remains active when embeddings or pgvector fail.
    console.warn('[AI chat] RAG retrieval unavailable:', {
      code: typeof error?.code === 'string' ? error.code : 'unknown',
    });
  }
  const startedAt = Date.now();

  try {
    const result = await createGeminiInteraction(history, {
      systemInstruction: buildAiChatSystemInstruction(rag.context),
      maxOutputTokens: 700,
      thinkingLevel: 'low',
      timeoutMs: 12_000,
    });
    const completed = await completeAiGeneration(
      conversation.stored,
      claim.assistant,
      claim.claimToken,
      result,
      Date.now() - startedAt,
      { rag_sources: rag.sources },
    );

    if (completed) {
      return {
        conversation: conversation.public,
        userMessage: toPublicAiMessage(storedUser.message),
        assistantMessage: toPublicAiMessage(completed),
        replayed: storedUser.replayed,
        degraded: false,
      };
    }

    const current = await currentAiReply(conversation.stored.id, storedUser.message.id);
    if (current && current.status !== 'pending') {
      return {
        conversation: conversation.public,
        userMessage: toPublicAiMessage(storedUser.message),
        assistantMessage: toPublicAiMessage(current),
        replayed: true,
        degraded: current.status !== 'completed',
      };
    }
    throw createError({ statusCode: 409, statusMessage: 'A newer chat request is still processing.' });
  } catch (error) {
    // HTTP/database errors raised after a lost lease must retain their status
    // and must not overwrite the response owned by another worker.
    if (!(error instanceof GeminiServiceError)) throw error;

    console.error('[AI chat] Gemini generation failed:', {
      code: error.code,
      retryable: error.retryable,
      upstreamStatus: error.upstreamStatus || null,
    });
    const failed = await failAiGeneration(
      conversation.stored,
      claim.assistant,
      claim.claimToken,
      error.code,
      error.retryable,
      Date.now() - startedAt,
    );
    const current = failed || await currentAiReply(conversation.stored.id, storedUser.message.id);
    if (!current || current.status === 'pending') {
      throw createError({ statusCode: 503, statusMessage: 'AI support is temporarily unavailable.' });
    }

    return {
      conversation: conversation.public,
      userMessage: toPublicAiMessage(storedUser.message),
      assistantMessage: toPublicAiMessage(current),
      replayed: storedUser.replayed,
      degraded: true,
    };
  }
});
