import {
  createClient,
  isAuthRetryableFetchError,
  type User,
} from '@supabase/supabase-js';

const AUTH_VERIFICATION_ATTEMPTS = 3;
const AUTH_RETRY_DELAYS_MS = [150, 400];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText(error: unknown): string {
  const candidate = error as any;
  return [
    candidate?.message,
    candidate?.details,
    candidate?.code,
    candidate?.cause?.message,
    candidate?.cause?.code,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isTransientAuthNetworkError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true;

  const text = errorText(error);
  return [
    'fetch failed',
    'econnreset',
    'etimedout',
    'eai_again',
    'socket hang up',
    'network request failed',
  ].some((marker) => text.includes(marker));
}

function authUpstreamUnavailable(): never {
  throw createError({
    statusCode: 503,
    statusMessage: 'Authentication service is temporarily unavailable. Please try again.',
    data: { code: 'AUTH_UPSTREAM_UNAVAILABLE' },
  });
}

async function verifyAccessToken(supabase: any, accessToken: string): Promise<User> {
  for (let attempt = 0; attempt < AUTH_VERIFICATION_ATTEMPTS; attempt += 1) {
    try {
      // Passing the JWT explicitly avoids Supabase Auth's internal session
      // lookup path on the server and verifies this exact request token.
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);

      if (!error && user) return user;
      if (!isTransientAuthNetworkError(error)) {
        throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
      }
    } catch (error) {
      if ((error as any)?.statusCode === 401) throw error;
      if (!isTransientAuthNetworkError(error)) {
        throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
      }
    }

    if (attempt < AUTH_VERIFICATION_ATTEMPTS - 1) {
      await sleep(AUTH_RETRY_DELAYS_MS[attempt] || 400);
    }
  }

  authUpstreamUnavailable();
}

export async function optionalRequestUser(event: any): Promise<{ supabase: any; user: User } | null> {
  const config = useRuntimeConfig();
  const authorization = String(getRequestHeader(event, 'authorization') || '').trim();

  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid authorization header.' });
  }

  const accessToken = authorization.slice(7).trim();
  if (!accessToken || accessToken.length > 10000) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid authorization header.' });
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const user = await verifyAccessToken(supabase, accessToken);

  return { supabase, user };
}

export async function requireRequestUser(event: any): Promise<{ supabase: any; user: User }> {
  const requestUser = await optionalRequestUser(event);
  if (!requestUser) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }
  return requestUser;
}
