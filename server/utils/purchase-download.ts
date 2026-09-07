import { createHash, createHmac, randomBytes } from 'node:crypto';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { downloadMetadata, downloadFailureMessage, validProductZipPath } from '~/utils/purchaseDownload.js';

export const DOWNLOAD_COOKIE = 'weixies-download-binding';
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hashDownloadSecret = (value: string) => createHash('sha256').update(value).digest('hex');

export function privateDownloadResponse(event: any) {
  setResponseHeaders(event, {
    'Cache-Control': 'private, no-store, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
  });
}

export function requireSameOriginDownload(event: any) {
  const origin = getRequestHeader(event, 'origin');
  const fetchSite = getRequestHeader(event, 'sec-fetch-site');
  // Cookie-only actions (redeem/revoke) never accept cross-origin requests.
  if (!origin || origin !== getRequestURL(event).origin || (fetchSite && fetchSite !== 'same-origin')) {
    throw createError({ statusCode: 403, statusMessage: 'Same-origin request required.' });
  }
}

export function downloadBinding(event: any, create = false) {
  let binding = getCookie(event, DOWNLOAD_COOKIE);
  if (!binding || !/^[a-f0-9]{64}$/.test(binding)) binding = create ? randomBytes(32).toString('hex') : undefined;
  if (binding && create) setCookie(event, DOWNLOAD_COOKIE, binding, {
    httpOnly: true, secure: getRequestURL(event).protocol === 'https:', sameSite: 'strict',
    path: '/api/purchases', maxAge: 300,
  });
  return binding ? hashDownloadSecret(binding) : null;
}

export function downloadToken(profileId: string, requestKey: string, bindingHash: string) {
  const secret = String(useRuntimeConfig().supabaseServiceRoleKey || '');
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Downloads are not configured.' });
  return createHmac('sha256', secret).update(`purchase-download:${profileId}:${requestKey}:${bindingHash}`).digest('hex');
}

export function verifiedDownloadAuthSession(event: any) {
  // Call only AFTER requireRequestUser verified this exact JWT with Supabase.
  try {
    const jwt = String(getRequestHeader(event, 'authorization')).slice(7).trim();
    const claims = JSON.parse(Buffer.from(jwt.split('.')[1] || '', 'base64url').toString());
    if (!UUID_PATTERN.test(claims.session_id) || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) throw new Error();
    return { id: claims.session_id, expiresAt: new Date(Math.min(claims.exp * 1000, Date.now() + 300000)).toISOString() };
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in again before downloading.' });
  }
}

export async function loadDownloadPurchase(profileId: string, orderId: string, productId: number) {
  const db = useSupabaseAdmin();
  const { data: ownership, error: ownershipError } = await db.from('user_products').select('order_id')
    .eq('profile_id', profileId).eq('product_id', productId).eq('order_id', orderId).maybeSingle();
  if (ownershipError) throw createError({ statusCode: 503, statusMessage: 'Unable to verify this purchase.' });
  const { data: order, error: orderError } = await db.from('orders').select('id,status,purchase_conflict')
    .eq('id', orderId).eq('profile_id', profileId).maybeSingle();
  if (orderError) throw createError({ statusCode: 503, statusMessage: 'Unable to verify this order.' });
  if (!ownership || order?.status !== 'paid' || order.purchase_conflict) throwDownloadFailure('purchase_access_revoked');
  const { data: item, error: itemError } = await db.from('order_items')
    .select('id,download_count,download_limit,is_downloaded,downloaded_at').eq('order_id', orderId).eq('product_id', productId).maybeSingle();
  if (itemError || !item) throw createError({ statusCode: 503, statusMessage: 'Purchase metadata is unavailable.' });
  if (!downloadMetadata(item).can_download) throwDownloadFailure('download_limit_reached', downloadMetadata(item));
  const { data: file, error: fileError } = await db.from('product_files').select('file_url,file_name')
    .eq('product_id', productId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (fileError || !file || !validProductZipPath(file.file_url, productId)) throwDownloadFailure('file_unavailable');
  return { item, file, download: downloadMetadata(item) };
}

export function throwDownloadFailure(code: string, download?: any): never {
  throw createError({ statusCode: code.includes('unavailable') ? 503 : 403,
    statusMessage: downloadFailureMessage(code), data: { code, download } });
}
