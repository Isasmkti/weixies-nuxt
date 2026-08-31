import crypto from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { optionalRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const AI_GUEST_COOKIE = 'weixies_ai_guest';
const GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const GUEST_SESSION_SECONDS = 7 * 24 * 60 * 60;

export type AiChatIdentity =
  | {
      kind: 'user';
      profileId: string;
      user: User;
      rateLimitId: string;
    }
  | {
      kind: 'guest';
      guestSessionHash: string;
      guestExpiresAt: string;
      rateLimitId: string;
    };

function hashGuestToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function guestExpiry(): string {
  return new Date(Date.now() + GUEST_SESSION_SECONDS * 1000).toISOString();
}

function clearGuestCookie(event: any) {
  deleteCookie(event, AI_GUEST_COOKIE, { path: '/api/ai' });
}

function setGuestCookie(event: any, token: string) {
  const secure = process.env.NODE_ENV === 'production' || getRequestURL(event).protocol === 'https:';
  setCookie(event, AI_GUEST_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/api/ai',
    maxAge: GUEST_SESSION_SECONDS,
  });
}

async function claimGuestConversations(event: any, token: string, profileId: string) {
  const guestSessionHash = hashGuestToken(token);
  const supabase = useSupabaseAdmin();
  const { error } = await supabase
    .from('conversations')
    .update({
      profile_id: profileId,
      guest_session_hash: null,
      guest_expires_at: null,
    })
    .eq('guest_session_hash', guestSessionHash)
    .gt('guest_expires_at', new Date().toISOString());

  if (error) {
    console.error('[AI chat] Could not claim guest conversations:', {
      code: error.code,
    });
    throw createError({ statusCode: 500, statusMessage: 'Chat session could not be restored.' });
  }

  clearGuestCookie(event);
}

export async function resolveAiChatIdentity(
  event: any,
  options: { createGuest?: boolean; claimGuest?: boolean } = {},
): Promise<AiChatIdentity | null> {
  const requestUser = await optionalRequestUser(event);
  const rawCookie = String(getCookie(event, AI_GUEST_COOKIE) || '');
  const validGuestToken = GUEST_TOKEN_PATTERN.test(rawCookie) ? rawCookie : null;

  if (rawCookie && !validGuestToken) clearGuestCookie(event);

  if (requestUser) {
    if (options.claimGuest && validGuestToken) {
      await claimGuestConversations(event, validGuestToken, requestUser.user.id);
    }
    return {
      kind: 'user',
      profileId: requestUser.user.id,
      user: requestUser.user,
      rateLimitId: `user:${requestUser.user.id}`,
    };
  }

  if (!validGuestToken && !options.createGuest) return null;

  const token = validGuestToken || crypto.randomBytes(32).toString('base64url');
  const sessionHash = hashGuestToken(token);
  const expiresAt = guestExpiry();

  if (options.createGuest) setGuestCookie(event, token);

  return {
    kind: 'guest',
    guestSessionHash: sessionHash,
    guestExpiresAt: expiresAt,
    rateLimitId: `guest:${sessionHash}`,
  };
}

export function aiChatIpHash(event: any): string {
  const address = String(getRequestIP(event, { xForwardedFor: true }) || 'unknown');
  return crypto.createHash('sha256').update(address, 'utf8').digest('hex');
}
