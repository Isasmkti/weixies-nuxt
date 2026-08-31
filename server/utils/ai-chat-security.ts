const MAX_CHAT_BODY_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function setAiChatResponseHeaders(event: any) {
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  setResponseHeader(event, 'Vary', 'Authorization, Cookie');
}

function configuredAiChatOrigin(event: any): string {
  const config = useRuntimeConfig();
  const configuredSiteUrl = String(config.public.siteUrl || '').trim();

  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      throw createError({ statusCode: 500, statusMessage: 'NUXT_PUBLIC_SITE_URL is invalid.' });
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_PUBLIC_SITE_URL is not configured.' });
  }

  return getRequestURL(event).origin;
}

export function assertAiChatPostRequest(event: any) {
  const origin = String(getRequestHeader(event, 'origin') || '').trim();
  const fetchSite = String(getRequestHeader(event, 'sec-fetch-site') || '').toLowerCase();
  const contentType = String(getRequestHeader(event, 'content-type') || '').toLowerCase();
  const contentLength = Number(getRequestHeader(event, 'content-length') || 0);

  if (!origin || origin === 'null' || origin !== configuredAiChatOrigin(event) || fetchSite === 'cross-site') {
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin chat requests are not allowed.' });
  }
  if (!contentType.startsWith('application/json')) {
    throw createError({ statusCode: 415, statusMessage: 'Content-Type must be application/json.' });
  }
  if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Chat request is too large.' });
  }
}

export async function readAiChatJsonBody(event: any): Promise<Record<string, unknown>> {
  const rawBody = await readRawBody(event, 'utf8');
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_CHAT_BODY_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'A JSON request body is required.' });
  }

  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed as Record<string, unknown>;
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Request body must be valid JSON.' });
  }
}

export function requireAiChatUuid(value: unknown, fieldName: string): string {
  const normalized = String(value || '').trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: `${fieldName} must be a valid UUID.` });
  }
  return normalized.toLowerCase();
}

export function optionalAiChatUuid(value: unknown, fieldName: string): string | null {
  if (value == null || String(value).trim() === '') return null;
  return requireAiChatUuid(value, fieldName);
}

export function requireAiChatMessage(value: unknown): string {
  const message = typeof value === 'string' ? value.trim() : '';
  if (!message || message.length > 4000) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Message must contain between 1 and 4,000 characters.',
    });
  }
  return message;
}
