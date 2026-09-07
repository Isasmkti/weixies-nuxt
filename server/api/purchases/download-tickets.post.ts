import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { privateDownloadResponse, requireSameOriginDownload, verifiedDownloadAuthSession, downloadBinding,
  downloadToken, hashDownloadSecret, loadDownloadPurchase, UUID_PATTERN } from '~/server/utils/purchase-download';

export default defineEventHandler(async (event) => {
  privateDownloadResponse(event);
  requireSameOriginDownload(event);
  const { user } = await requireRequestUser(event);
  const authSession = verifiedDownloadAuthSession(event);
  await enforceRateLimit(`purchase-ticket:${user.id}`, 20, 60);
  const body = await readBody(event);
  const productId = Number(body?.product_id);
  if (!UUID_PATTERN.test(body?.order_id || '') || !UUID_PATTERN.test(body?.idempotency_key || '')
    || !Number.isSafeInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Valid order, product and request IDs are required.' });
  }
  const bindingHash = downloadBinding(event, true)!;
  const token = downloadToken(user.id, body.idempotency_key, bindingHash);
  const tokenHash = hashDownloadSecret(token);
  const db = useSupabaseAdmin();
  // Logging into a different account/session in this browser revokes old intents.
  const { error: revokeError } = await db.from('purchase_download_sessions').update({ status: 'revoked' })
    .eq('binding_hash', bindingHash).neq('auth_session_id', authSession.id).eq('status', 'pending');
  if (revokeError) throw createError({ statusCode: 503, statusMessage: 'Unable to verify download sessions.' });
  const { item, file, download } = await loadDownloadPurchase(user.id, body.order_id, productId);
  const { error } = await db.from('purchase_download_sessions').upsert({
    profile_id: user.id, order_item_id: item.id, auth_session_id: authSession.id,
    token_hash: tokenHash, binding_hash: bindingHash, idempotency_key: body.idempotency_key,
    storage_path: file.file_url, file_name: file.file_name || `product-${productId}.zip`, expires_at: authSession.expiresAt,
  }, { onConflict: 'profile_id,idempotency_key', ignoreDuplicates: true }).select('id');
  if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to prepare this download.' });
  const { data: ticket, error: lookupError } = await db.from('purchase_download_sessions')
    .select('id,order_item_id,token_hash,auth_session_id,status,expires_at')
    .eq('profile_id', user.id).eq('idempotency_key', body.idempotency_key).single();
  if (lookupError || !ticket || ticket.token_hash !== tokenHash || ticket.order_item_id !== item.id
    || ticket.auth_session_id !== authSession.id) throw createError({ statusCode: 409, statusMessage: 'Download request ID was already used. Refresh and try again.' });
  return { session_id: ticket.id, token, status: ticket.status, expires_at: ticket.expires_at, download };
});
