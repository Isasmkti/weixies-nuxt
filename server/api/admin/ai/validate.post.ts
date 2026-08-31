import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import {
  createGeminiInteraction,
  GeminiServiceError,
} from '~/server/utils/gemini';

function endpointStatus(error: GeminiServiceError): number {
  if (error.code === 'GEMINI_NOT_CONFIGURED') return 503;
  if (error.code === 'GEMINI_TIMEOUT') return 504;
  if (error.code === 'GEMINI_RATE_LIMITED' || error.code === 'GEMINI_UNAVAILABLE') return 503;
  return 502;
}

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);

  await enforceRateLimit(`admin:ai-validation:${user.id}`, 3, 60);

  const startedAt = Date.now();

  try {
    const result = await createGeminiInteraction(
      'This is a server connectivity check. Reply with exactly: GEMINI_CONNECTION_OK',
      {
        systemInstruction: 'Follow the validation instruction exactly and do not add other text.',
        maxOutputTokens: 64,
        thinkingLevel: 'low',
      },
    );

    return {
      success: true,
      status: 'connected',
      provider: 'gemini',
      model: result.model,
      response: result.text,
      latencyMs: Date.now() - startedAt,
      usage: result.usage,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      throw createError({
        statusCode: endpointStatus(error),
        statusMessage: error.message,
        data: {
          code: error.code,
          retryable: error.retryable,
          providerCode: error.providerCode || null,
          providerStatus: error.upstreamStatus || null,
        },
      });
    }

    throw createError({
      statusCode: 502,
      statusMessage: 'Gemini API validation failed.',
    });
  }
});
