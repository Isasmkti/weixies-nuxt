const GEMINI_INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_SERIALIZED_INPUT_LENGTH = 200_000;

type GeminiThinkingLevel = 'low' | 'medium' | 'high';

interface GeminiRuntimeConfig {
  geminiApiKey?: string;
  geminiModel?: string;
}

interface GeminiErrorPayload {
  error?: {
    status?: string;
  };
}

export interface GeminiInteractionStep extends Record<string, unknown> {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
    [key: string]: unknown;
  }>;
}

export type GeminiInteractionInput = string | GeminiInteractionStep[];

interface GeminiInteractionPayload {
  id?: string;
  model?: string;
  status?: string;
  steps?: GeminiInteractionStep[];
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    total_tokens?: number;
  };
}

export type GeminiServiceErrorCode =
  | 'GEMINI_NOT_CONFIGURED'
  | 'GEMINI_INVALID_INPUT'
  | 'GEMINI_REQUEST_REJECTED'
  | 'GEMINI_UNAUTHORIZED'
  | 'GEMINI_MODEL_UNAVAILABLE'
  | 'GEMINI_RATE_LIMITED'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_UNAVAILABLE'
  | 'GEMINI_INVALID_RESPONSE';

export class GeminiServiceError extends Error {
  readonly code: GeminiServiceErrorCode;
  readonly retryable: boolean;
  readonly upstreamStatus?: number;
  readonly providerCode?: string;

  constructor(
    code: GeminiServiceErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      upstreamStatus?: number;
      providerCode?: string;
    } = {},
  ) {
    super(message);
    this.name = 'GeminiServiceError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.upstreamStatus = options.upstreamStatus;
    this.providerCode = options.providerCode;
  }
}

export interface CreateGeminiInteractionOptions {
  systemInstruction?: string;
  maxOutputTokens?: number;
  thinkingLevel?: GeminiThinkingLevel;
  timeoutMs?: number;
}

export interface GeminiInteractionResult {
  id: string | null;
  model: string;
  status: string;
  text: string;
  steps: GeminiInteractionStep[];
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    thoughtTokens: number | null;
    totalTokens: number | null;
  };
}

function optionalTokenCount(value: unknown): number | null {
  const numericValue = Number(value);
  return Number.isSafeInteger(numericValue) && numericValue >= 0 ? numericValue : null;
}

async function readGeminiErrorPayload(response: Response): Promise<GeminiErrorPayload | null> {
  try {
    return await response.json() as GeminiErrorPayload;
  } catch {
    return null;
  }
}

function upstreamError(
  status: number,
  providerCode?: string,
): GeminiServiceError {
  const details = { upstreamStatus: status, providerCode };

  if (status === 401 || status === 403) {
    return new GeminiServiceError(
      'GEMINI_UNAUTHORIZED',
      'Gemini API credentials were rejected.',
      details,
    );
  }
  if (status === 404) {
    return new GeminiServiceError(
      'GEMINI_MODEL_UNAVAILABLE',
      'The configured Gemini model is unavailable.',
      details,
    );
  }
  if (status === 429) {
    return new GeminiServiceError(
      'GEMINI_RATE_LIMITED',
      'Gemini API rate limit was exceeded.',
      { ...details, retryable: true },
    );
  }
  if (status === 408 || status >= 500) {
    return new GeminiServiceError(
      'GEMINI_UNAVAILABLE',
      'Gemini API is temporarily unavailable.',
      { ...details, retryable: true },
    );
  }

  return new GeminiServiceError(
    'GEMINI_REQUEST_REJECTED',
    'Gemini API rejected the request.',
    details,
  );
}

function extractInteractionText(payload: GeminiInteractionPayload): string {
  return (payload.steps || [])
    .filter((step) => step?.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => String(part.text).trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function normalizeInteractionInput(input: GeminiInteractionInput): GeminiInteractionInput {
  if (typeof input === 'string') {
    const normalized = input.trim();
    if (!normalized || normalized.length > MAX_SERIALIZED_INPUT_LENGTH) {
      throw new GeminiServiceError(
        'GEMINI_INVALID_INPUT',
        'Gemini input is empty or too large.',
      );
    }
    return normalized;
  }

  if (!Array.isArray(input) || input.length === 0 || input.some((step) => !step || typeof step !== 'object')) {
    throw new GeminiServiceError(
      'GEMINI_INVALID_INPUT',
      'Gemini interaction history is invalid.',
    );
  }

  let serializedInput = '';
  try {
    serializedInput = JSON.stringify(input);
  } catch {
    throw new GeminiServiceError(
      'GEMINI_INVALID_INPUT',
      'Gemini interaction history is invalid.',
    );
  }

  if (serializedInput.length > MAX_SERIALIZED_INPUT_LENGTH) {
    throw new GeminiServiceError(
      'GEMINI_INVALID_INPUT',
      'Gemini interaction history is too large.',
    );
  }

  return input;
}

/**
 * Sends a stateless, server-only Gemini Interactions API request.
 * Conversation persistence remains owned by this application because store is
 * always false and no previous_interaction_id is accepted here.
 */
export async function createGeminiInteraction(
  input: GeminiInteractionInput,
  options: CreateGeminiInteractionOptions = {},
): Promise<GeminiInteractionResult> {
  const config = useRuntimeConfig() as ReturnType<typeof useRuntimeConfig> & GeminiRuntimeConfig;
  const apiKey = String(config.geminiApiKey || '').trim();
  const model = String(config.geminiModel || '').trim();
  const normalizedInput = normalizeInteractionInput(input);

  if (!apiKey || !model) {
    throw new GeminiServiceError(
      'GEMINI_NOT_CONFIGURED',
      'Gemini API is not configured.',
    );
  }
  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(1_000, Math.trunc(options.timeoutMs || DEFAULT_TIMEOUT_MS)),
  );
  const maxOutputTokens = Math.min(
    8_192,
    Math.max(1, Math.trunc(options.maxOutputTokens || 1_024)),
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const generationConfig: Record<string, string | number> = {
    max_output_tokens: maxOutputTokens,
  };

  if (options.thinkingLevel) {
    generationConfig.thinking_level = options.thinkingLevel;
  }

  const body: Record<string, unknown> = {
    model,
    input: normalizedInput,
    store: false,
    generation_config: generationConfig,
  };
  const systemInstruction = String(options.systemInstruction || '').trim();
  if (systemInstruction) body.system_instruction = systemInstruction;

  try {
    const response = await fetch(GEMINI_INTERACTIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorPayload = await readGeminiErrorPayload(response);
      throw upstreamError(response.status, errorPayload?.error?.status);
    }

    const payload = await response.json() as GeminiInteractionPayload;
    const text = extractInteractionText(payload);
    if (payload.status !== 'completed' || !text) {
      throw new GeminiServiceError(
        'GEMINI_INVALID_RESPONSE',
        'Gemini API returned an incomplete response.',
      );
    }

    return {
      id: typeof payload.id === 'string' ? payload.id : null,
      model: typeof payload.model === 'string' && payload.model ? payload.model : model,
      status: payload.status,
      text,
      steps: Array.isArray(payload.steps) ? payload.steps : [],
      usage: {
        inputTokens: optionalTokenCount(payload.usage?.total_input_tokens),
        outputTokens: optionalTokenCount(payload.usage?.total_output_tokens),
        thoughtTokens: optionalTokenCount(payload.usage?.total_thought_tokens),
        totalTokens: optionalTokenCount(payload.usage?.total_tokens),
      },
    };
  } catch (error) {
    if (error instanceof GeminiServiceError) throw error;
    if (controller.signal.aborted) {
      throw new GeminiServiceError(
        'GEMINI_TIMEOUT',
        'Gemini API request timed out.',
        { retryable: true },
      );
    }
    throw new GeminiServiceError(
      'GEMINI_UNAVAILABLE',
      'Gemini API could not be reached.',
      { retryable: true },
    );
  } finally {
    clearTimeout(timeout);
  }
}
