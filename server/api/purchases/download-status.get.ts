import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { privateDownloadResponse, UUID_PATTERN } from '~/server/utils/purchase-download';
import { downloadMetadata, downloadFailureMessage } from '~/utils/purchaseDownload.js';

export default defineEventHandler(async (event) => {
  privateDownloadResponse(event);
  const { user } = await requireRequestUser(event);
  const id = String(getQuery(event).session_id || '');
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Invalid download session.' });
  const db = useSupabaseAdmin();
  const { data: session, error } = await db.from('purchase_download_sessions')
    .select('status,failure_code,expires_at,product_file_id,item:order_items(id,order_id,product_id)')
    .eq('id', id).eq('profile_id', user.id).maybeSingle();
  if (error || !session) throw createError({ statusCode: 404, statusMessage: 'Download session not found.' });
  const item: any = Array.isArray(session.item) ? session.item[0] : session.item;
  if (!item || !session.product_file_id) throw createError({ statusCode: 404, statusMessage: 'Download session is incomplete.' });
  const [{ data: access, error: accessError }, { data: usage, error: usageError }, { data: file, error: fileError }, { data: latest, error: latestError }] = await Promise.all([
    db.from('user_products').select('order_id')
      .eq('profile_id', user.id).eq('product_id', item.product_id).eq('order_id', item.order_id).maybeSingle(),
    db.from('order_item_file_downloads').select('download_count,download_limit,last_downloaded_at')
      .eq('order_item_id', item.id).eq('product_file_id', session.product_file_id).maybeSingle(),
    db.from('product_files').select('version,version_sequence').eq('id', session.product_file_id).maybeSingle(),
    db.from('product_files').select('version_sequence').eq('product_id', item.product_id).eq('release_status', 'published')
      .order('version_sequence', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (accessError || usageError || fileError || latestError) throw createError({ statusCode: 503, statusMessage: 'Unable to verify purchase access.' });
  const status = session.status === 'pending' && new Date(session.expires_at).getTime() <= Date.now() ? 'expired' : session.status;
  const download = downloadMetadata({
    download_count: usage?.download_count || 0,
    download_limit: usage?.download_limit || 3,
    is_downloaded: Number(usage?.download_count) > 0,
    downloaded_at: usage?.last_downloaded_at || null,
  }, Boolean(access));
  return { status, download: { ...download, version: file?.version || null, version_sequence: file?.version_sequence || null,
    update_available: Number(latest?.version_sequence || 0) > Number(file?.version_sequence || 0) },
    message: session.failure_code ? downloadFailureMessage(session.failure_code)
      : ['expired', 'revoked'].includes(status) ? downloadFailureMessage('download_session_used_or_expired') : null };
});
