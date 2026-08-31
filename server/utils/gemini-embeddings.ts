const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2';
const DEFAULT_TIMEOUT_MS = 12_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 30_000;
const MAX_RETRY_DELAY_MS = 2_000;
const DEFAULT_RETRY_DELAY_MS = 400;
const MAX_TEXT_LENGTH = 32_000;
const MAX_TITLE_LENGTH = 1_024;
const MAX_BATCH_INPUTS = 200;

export const GEMINI_EMBEDDING_DIMENSIONS = 768 as const;
export const GEMINI_EMBEDDING_REQUEST_BATCH_SIZE = 20 as const;

interface GeminiEmbeddingRuntimeConfig {
  geminiApiKey?: string;
  geminiEmbeddingModel?: string;
}

interface GeminiEmbeddingErrorPayload {
  error?: {
    status?: unknown;
  };
}

interface GeminiContentEmbeddingPayload {
  values?: unknown;
}

interface GeminiEmbeddingUsagePayload {
  promptTokenCount?: unknown;
}

interface GeminiEmbedContentPayload {
  embedding?: GeminiContentEmbeddingPayload;
  usageMetadata?: GeminiEmbeddingUsagePayload;
}

interface GeminiBatchEmbedContentsPayload {
  embeddings?: unknown;
  usageMetadata?: GeminiEmbeddingUsagePayload;
}

interface GeminiEmbeddingRequestBody {
  model: string;
  content: {
    parts: Array<{
      text: string;
    }>;
  };
  embedContentConfig: {
    outputDimensionality: typeof GEMINI_EMBEDDING_DIMENSIONS;
  };
}

export type GeminiEmbeddingErrorCode =
  | 'GEMINI_EMBEDDING_NOT_CONFIGURED'
  | 'GEMINI_EMBEDDING_INVALID_INPUT'
  | 'GEMINI_EMBEDDING_REQUEST_REJECTED'
  | 'GEMINI_EMBEDDING_UNAUTHORIZED'
  | 'GEMINI_EMBEDDING_MODEL_UNAVAILABLE'
  | 'GEMINI_EMBEDDING_RATE_LIMITED'
  | 'GEMINI_EMBEDDING_TIMEOUT'
  | 'GEMINI_EMBEDDING_UNAVAILABLE'
  | 'GEMINI_EMBEDDING_INVALID_RESPONSE';

export class GeminiEmbeddingError extends Error {
  readonly code: GeminiEmbeddingErrorCode;
  readonly retryable: boolean;
  readonly upstreamStatus?: number;
  readonly providerCode?: string;

  constructor(
    code: GeminiEmbeddingErrorCode,
    message: string,
    options: {
      retryable?: boolean;
      upstreamStatus?: number;
      providerCode?: string;
    } = {},
  ) {
    super(message);
    this.name = 'GeminiEmbeddingError';
    this.code = code;
    this.retryable = Boolean(options.retryable);
    this.upstreamStatus = options.upstreamStatus;
    this.providerCode = options.providerCode;
  }
}

export type GeminiEmbeddingQueryTask =
  | 'question-answering'
  | 'search-result'
  | 'fact-checking'
  | 'code-retrieval';

export interface GeminiEmbeddingOptions {
  timeoutMs?: number;
}

export interface GeminiEmbeddingUsage {
  promptTokens: number | null;
}

export interface GeminiEmbeddingResult {
  model: string;
  dimensions: typeof GEMINI_EMBEDDING_DIMENSIONS;
  values: number[];
  usage: GeminiEmbeddingUsage;
}

export interface GeminiBatchEmbeddingResult {
  model: string;
  dimensions: typeof GEMINI_EMBEDDING_DIMENSIONS;
  embeddings: number[][];
  usage: GeminiEmbeddingUsage;
  requestCount: number;
}

const QUERY_TASK_PREFIXES: Record<GeminiEmbeddingQueryTask, string> = {
  'question-answering': 'question answering',
  'search-result': 'search result',
  'fact-checking': 'fact checking',
  'code-retrieval': 'code retrieval',
};

function invalidInput(message: string): GeminiEmbeddingError {
  return new GeminiEmbeddingError('GEMINI_EMBEDDING_INVALID_INPUT', message);
}

function normalizeText(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw invalidInput(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw invalidInput(`${label} cannot be empty.`);
  }
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw invalidInput(`${label} is too large.`);
  }

  return normalized;
}

function normalizeTitle(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'none';
  if (typeof value !== 'string') {
    throw invalidInput('Embedding document title must be a string.');
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'none';
  if (normalized.length > MAX_TITLE_LENGTH) {
    throw invalidInput('Embedding document title is too large.');
  }

  return normalized;
}

/**
 * Formats a text query using Gemini Embedding 2's documented instruction
 * prefixes. Gemini Embedding 2 does not accept the taskType request field.
 */
export function prepareGeminiEmbeddingQuery(
  query: string,
  task: GeminiEmbeddingQueryTask = 'question-answering',
): string {
  const prefix = QUERY_TASK_PREFIXES[task];
  if (!prefix) {
    throw invalidInput('Embedding query task is invalid.');
  }

  return normalizeText(
    `task: ${prefix} | query: ${normalizeText(query, 'Embedding query')}`,
    'Formatted embedding query',
  );
}

/**
 * Formats a retrievable document using Gemini Embedding 2's documented
 * asymmetric retrieval structure.
 */
export function prepareGeminiEmbeddingDocument(
  content: string,
  title?: string | null,
): string {
  return normalizeText(
    `title: ${normalizeTitle(title)} | text: ${normalizeText(content, 'Embedding document')}`,
    'Formatted embedding document',
  );
}

function normalizeModel(value: unknown): string {
  const configured = String(value || DEFAULT_EMBEDDING_MODEL).trim();
  const model = configured.startsWith('models/') ? configured.slice('models/'.length) : configured;

  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/i.test(model) || !model.includes('embedding')) {
    throw new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_NOT_CONFIGURED',
      'The Gemini embedding model configuration is invalid.',
    );
  }

  return model;
}

function resolveRuntime(): { apiKey: string; model: string } {
  const config = useRuntimeConfig() as ReturnType<typeof useRuntimeConfig> & GeminiEmbeddingRuntimeConfig;
  const apiKey = String(config.geminiApiKey || '').trim();
  const model = normalizeModel(config.geminiEmbeddingModel);

  if (!apiKey) {
    throw new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_NOT_CONFIGURED',
      'Gemini embeddings are not configured.',
    );
  }

  return { apiKey, model };
}

function normalizeTimeout(value: unknown): number {
  const numeric = Number(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(numeric)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(numeric)));
}

function optionalTokenCount(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : null;
}

function sanitizeProviderCode(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9_]{1,64}$/.test(normalized) ? normalized : undefined;
}

async function readErrorPayload(response: Response): Promise<GeminiEmbeddingErrorPayload | null> {
  try {
    return await response.json() as GeminiEmbeddingErrorPayload;
  } catch {
    return null;
  }
}

function upstreamError(status: number, providerCode?: string): GeminiEmbeddingError {
  const details = { upstreamStatus: status, providerCode };

  if (status === 401 || status === 403) {
    return new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_UNAUTHORIZED',
      'Gemini API credentials were rejected.',
      details,
    );
  }
  if (status === 404) {
    return new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_MODEL_UNAVAILABLE',
      'The configured Gemini embedding model is unavailable.',
      details,
    );
  }
  if (status === 429) {
    return new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_RATE_LIMITED',
      'Gemini embedding rate limit was exceeded.',
      { ...details, retryable: true },
    );
  }
  if (status >= 500) {
    return new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_UNAVAILABLE',
      'Gemini embeddings are temporarily unavailable.',
      { ...details, retryable: true },
    );
  }

  return new GeminiEmbeddingError(
    'GEMINI_EMBEDDING_REQUEST_REJECTED',
    'Gemini API rejected the embedding request.',
    details,
  );
}

function retryDelayMs(response: Response): number {
  const retryAfter = response.headers.get('retry-after');
  if (!retryAfter) return DEFAULT_RETRY_DELAY_MS;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, Math.round(seconds * 1_000)));
  }

  const retryAt = Date.parse(retryAfter);
  if (!Number.isFinite(retryAt)) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_RETRY_DELAY_MS, Math.max(0, retryAt - Date.now()));
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildEmbeddingRequest(text: string, model: string): GeminiEmbeddingRequestBody {
  return {
    model: `models/${model}`,
    content: {
      parts: [{ text }],
    },
    embedContentConfig: {
      outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
    },
  };
}

function validateEmbeddingVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== GEMINI_EMBEDDING_DIMENSIONS) {
    throw new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_INVALID_RESPONSE',
      'Gemini API returned an invalid embedding dimension.',
    );
  }

  if (value.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_INVALID_RESPONSE',
      'Gemini API returned invalid embedding values.',
    );
  }

  return [...value] as number[];
}

async function requestGeminiEmbedding<T>(
  operation: 'embedContent' | 'batchEmbedContents',
  body: unknown,
  runtime: { apiKey: string; model: string },
  timeoutMs: number,
): Promise<T> {
  const url = `${GEMINI_API_BASE_URL}/${encodeURIComponent(runtime.model)}:${operation}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': runtime.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const shouldRetry = attempt === 0 && (response.status === 429 || response.status >= 500);
        const delayMs = shouldRetry ? retryDelayMs(response) : 0;
        const errorPayload = await readErrorPayload(response);
        const error = upstreamError(
          response.status,
          sanitizeProviderCode(errorPayload?.error?.status),
        );

        if (shouldRetry) {
          await wait(delayMs);
          continue;
        }
        throw error;
      }

      try {
        return await response.json() as T;
      } catch {
        throw new GeminiEmbeddingError(
          'GEMINI_EMBEDDING_INVALID_RESPONSE',
          'Gemini API returned malformed embedding data.',
        );
      }
    } catch (error) {
      if (error instanceof GeminiEmbeddingError) throw error;
      if (controller.signal.aborted) {
        throw new GeminiEmbeddingError(
          'GEMINI_EMBEDDING_TIMEOUT',
          'Gemini embedding request timed out.',
          { retryable: true },
        );
      }
      throw new GeminiEmbeddingError(
        'GEMINI_EMBEDDING_UNAVAILABLE',
        'Gemini embeddings could not be reached.',
        { retryable: true },
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new GeminiEmbeddingError(
    'GEMINI_EMBEDDING_UNAVAILABLE',
    'Gemini embeddings are temporarily unavailable.',
    { retryable: true },
  );
}

export async function createGeminiEmbedding(
  input: string,
  options: GeminiEmbeddingOptions = {},
): Promise<GeminiEmbeddingResult> {
  const text = normalizeText(input, 'Embedding input');
  const runtime = resolveRuntime();
  const payload = await requestGeminiEmbedding<GeminiEmbedContentPayload>(
    'embedContent',
    buildEmbeddingRequest(text, runtime.model),
    runtime,
    normalizeTimeout(options.timeoutMs),
  );

  return {
    model: runtime.model,
    dimensions: GEMINI_EMBEDDING_DIMENSIONS,
    values: validateEmbeddingVector(payload?.embedding?.values),
    usage: {
      promptTokens: optionalTokenCount(payload?.usageMetadata?.promptTokenCount),
    },
  };
}

export async function createGeminiEmbeddings(
  inputs: string[],
  options: GeminiEmbeddingOptions = {},
): Promise<GeminiBatchEmbeddingResult> {
  if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > MAX_BATCH_INPUTS) {
    throw invalidInput(`Embedding batch must contain between 1 and ${MAX_BATCH_INPUTS} inputs.`);
  }

  const normalizedInputs = inputs.map((input, index) => normalizeText(input, `Embedding input ${index + 1}`));
  const runtime = resolveRuntime();
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const embeddings: number[][] = [];
  let promptTokens = 0;
  let hasUsage = false;

  for (let start = 0; start < normalizedInputs.length; start += GEMINI_EMBEDDING_REQUEST_BATCH_SIZE) {
    const chunk = normalizedInputs.slice(start, start + GEMINI_EMBEDDING_REQUEST_BATCH_SIZE);
    const payload = await requestGeminiEmbedding<GeminiBatchEmbedContentsPayload>(
      'batchEmbedContents',
      {
        requests: chunk.map((text) => buildEmbeddingRequest(text, runtime.model)),
      },
      runtime,
      timeoutMs,
    );

    if (!Array.isArray(payload?.embeddings) || payload.embeddings.length !== chunk.length) {
      throw new GeminiEmbeddingError(
        'GEMINI_EMBEDDING_INVALID_RESPONSE',
        'Gemini API returned an invalid embedding batch.',
      );
    }

    for (const embedding of payload.embeddings) {
      if (!embedding || typeof embedding !== 'object') {
        throw new GeminiEmbeddingError(
          'GEMINI_EMBEDDING_INVALID_RESPONSE',
          'Gemini API returned invalid embedding data.',
        );
      }
      embeddings.push(validateEmbeddingVector((embedding as GeminiContentEmbeddingPayload).values));
    }

    const chunkTokens = optionalTokenCount(payload?.usageMetadata?.promptTokenCount);
    if (chunkTokens !== null) {
      promptTokens += chunkTokens;
      hasUsage = true;
    }
  }

  if (embeddings.length !== normalizedInputs.length) {
    throw new GeminiEmbeddingError(
      'GEMINI_EMBEDDING_INVALID_RESPONSE',
      'Gemini API returned an incomplete embedding batch.',
    );
  }

  return {
    model: runtime.model,
    dimensions: GEMINI_EMBEDDING_DIMENSIONS,
    embeddings,
    usage: {
      promptTokens: hasUsage ? promptTokens : null,
    },
    requestCount: normalizedInputs.length,
  };
}
