import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { AiRagError, indexAiKnowledgeArticle } from '~/server/utils/ai-rag';
import { GeminiEmbeddingError } from '~/server/utils/gemini-embeddings';
import { enforceRateLimit } from '~/server/utils/rate-limit';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function embeddingHttpError(error: GeminiEmbeddingError) {
  const statusCode = error.code === 'GEMINI_EMBEDDING_TIMEOUT'
    ? 504
    : error.code === 'GEMINI_EMBEDDING_INVALID_INPUT'
      ? 422
      : error.code === 'GEMINI_EMBEDDING_REQUEST_REJECTED'
        || error.code === 'GEMINI_EMBEDDING_INVALID_RESPONSE'
        || error.code === 'GEMINI_EMBEDDING_UNAUTHORIZED'
        || error.code === 'GEMINI_EMBEDDING_MODEL_UNAVAILABLE'
        ? 502
        : 503;

  return createError({
    statusCode,
    statusMessage: error.message,
    data: { code: error.code, retryable: error.retryable },
  });
}

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const articleId = String(getRouterParam(event, 'id') || '').trim();
  if (!UUID_PATTERN.test(articleId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid knowledge article ID is required.' });
  }

  await enforceRateLimit(`admin:ai-knowledge-index:${user.id}`, 10, 60);
  setResponseHeader(event, 'Cache-Control', 'no-store');

  try {
    return { article: await indexAiKnowledgeArticle(articleId, user.id) };
  } catch (error) {
    if (error instanceof GeminiEmbeddingError) throw embeddingHttpError(error);
    if (error instanceof AiRagError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
        data: { code: error.code },
      });
    }
    throw error;
  }
});
