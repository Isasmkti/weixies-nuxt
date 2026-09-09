import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { preparePurchaseStream, attachmentDisposition } from '~/server/utils/purchase-stream.js';
import { privateDownloadResponse, requireSameOriginDownload, downloadBinding, hashDownloadSecret,
  throwDownloadFailure, UUID_PATTERN } from '~/server/utils/purchase-download';
import { validProductZipPath } from '~/utils/purchaseDownload.js';

// Native form POST allows large downloads without a browser Blob or token URL.
export default defineEventHandler(async (event) => {
  privateDownloadResponse(event);
  // Only this same-origin attachment response may appear in the hidden download
  // frame. Other pages retain frame-ancestors 'none'.
  setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'");
  requireSameOriginDownload(event);
  if (getRequestHeader(event, 'range')) throw createError({ statusCode: 416, statusMessage: 'Download resume is not supported.' });
  const body = await readBody(event);
  const bindingHash = downloadBinding(event);
  if (!UUID_PATTERN.test(body?.session_id || '') || !/^[a-f0-9]{64}$/.test(body?.token || '') || !bindingHash) {
    throwDownloadFailure('download_session_invalid');
  }
  const tokenHash = hashDownloadSecret(body.token);
  const db = useSupabaseAdmin();
  const { data: ticket, error } = await db.from('purchase_download_sessions')
    .select('id,profile_id,product_file_id,status,expires_at,storage_path,file_name,item:order_items(product_id)')
    .eq('id', body.session_id).eq('token_hash', tokenHash).eq('binding_hash', bindingHash).maybeSingle();
  if (error) throw createError({ statusCode: 503, statusMessage: 'Unable to verify this download.' });
  if (!ticket) throwDownloadFailure('download_session_invalid');
  if (ticket.status !== 'pending' || new Date(ticket.expires_at).getTime() <= Date.now()) throwDownloadFailure('download_session_used_or_expired');
  await enforceRateLimit(`purchase-stream:${ticket.profile_id}`, 10, 60);
  const item: any = Array.isArray(ticket.item) ? ticket.item[0] : ticket.item;
  if (!validProductZipPath(ticket.storage_path, item?.product_id)) throwDownloadFailure('file_unavailable');
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 260000);
  timeout.unref?.();
  const openingTimeout = setTimeout(() => abortController.abort(), 20000);
  openingTimeout.unref?.();
  const stop = () => { clearTimeout(timeout); clearTimeout(openingTimeout); abortController.abort(); };
  event.node.res.once('close', stop);
  let prepared: Awaited<ReturnType<typeof preparePurchaseStream>> | undefined;
  let started = false;
  try {
    const config = useRuntimeConfig();
    const storageUrl = `${String(config.public.supabaseUrl).replace(/\/$/, '')}/storage/v1/object/authenticated/products/${ticket.storage_path.split('/').map(encodeURIComponent).join('/')}`;
    // Private server-to-storage request; no storage URL/key reaches the buyer.
    const upstream = await fetch(storageUrl, {
      headers: { Authorization: `Bearer ${config.supabaseServiceRoleKey}`, apikey: String(config.supabaseServiceRoleKey) },
      redirect: 'error', signal: abortController.signal,
    });
    // A separate short timeout covers opening/reading the first chunk only.
    prepared = await preparePurchaseStream(upstream, stop);
    clearTimeout(openingTimeout);
    if (abortController.signal.aborted || event.node.res.destroyed) throw new Error('transfer_unavailable');
    const { error: claimError } = await db.rpc('start_product_version_download', {
      p_session_id: ticket.id, p_token_hash: tokenHash, p_binding_hash: bindingHash,
      p_ip_address: null, p_user_agent: getRequestHeader(event, 'user-agent') || null,
    });
    if (claimError) {
      const code = ['download_limit_reached', 'purchase_access_revoked', 'download_session_signed_out',
        'download_session_invalid', 'download_session_used_or_expired'].find(value => claimError.message.includes(value));
      throw new Error(code || 'transfer_unavailable');
    }
    started = true;
    setResponseHeaders(event, { 'Content-Type': 'application/zip', 'Content-Disposition': attachmentDisposition(ticket.file_name), 'Accept-Ranges': 'none' });
    // Do not copy upstream cache, cookies, redirects, compression or credentials.
    // Return the stream: Nitro may consume it after this handler has returned.
    prepared.stream.once('close', () => { stop(); event.node.res.off('close', stop); });
    prepared.stream.once('error', () => console.warn('[Purchase download] Started transfer interrupted.', { session_id: ticket.id }));
    return prepared.stream;
  } catch (failure: any) {
    await prepared?.cancel();
    if (!started) {
      const known = ['file_unavailable', 'download_limit_reached', 'purchase_access_revoked', 'download_session_signed_out',
        'download_session_invalid', 'download_session_used_or_expired'];
      const code = known.includes(failure?.message) ? failure.message : 'transfer_unavailable';
      // Never overwrite a concurrent successful claim or restore charged quota.
      await db.from('purchase_download_sessions').update({ status: 'failed', failure_code: code }).eq('id', ticket.id).eq('status', 'pending');
      throwDownloadFailure(code);
    }
    // A started transfer stays charged even if the browser disconnects.
    console.warn('[Purchase download] Started transfer interrupted.', { session_id: ticket.id });
    if (!event.node.res.destroyed) event.node.res.destroy();
  } finally {
    if (!started) {
      stop();
      event.node.res.off('close', stop);
    }
  }
});
