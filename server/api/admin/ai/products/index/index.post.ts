import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { AiRagError, indexAiProducts } from '~/server/utils/ai-rag';
import { GeminiEmbeddingError } from '~/server/utils/gemini-embeddings';
import { enforceRateLimit } from '~/server/utils/rate-limit';

interface ProductIndexRequestBody {
  limit?: unknown;
  force?: unknown;
}

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
  await enforceRateLimit(`admin:ai-product-index:${user.id}`, 4, 60);

  const body = await readBody<ProductIndexRequestBody>(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'A JSON request body is required.' });
  }

  const requestedLimit = body.limit === undefined ? 25 : Number(body.limit);
  if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
    throw createError({ statusCode: 422, statusMessage: 'Product index limit must be an integer from 1 to 100.' });
  }
  if (body.force !== undefined && typeof body.force !== 'boolean') {
    throw createError({ statusCode: 422, statusMessage: 'Product force option must be a boolean.' });
  }

  setResponseHeader(event, 'Cache-Control', 'no-store');

  try {
    const counts = await indexAiProducts({
      limit: requestedLimit,
      force: body.force === true,
      actorId: user.id,
    });
    return { counts };
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
