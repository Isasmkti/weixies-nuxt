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
    .select('status,failure_code,expires_at,item:order_items(order_id,product_id,download_count,download_limit,is_downloaded,downloaded_at)')
    .eq('id', id).eq('profile_id', user.id).maybeSingle();
  if (error || !session) throw createError({ statusCode: 404, statusMessage: 'Download session not found.' });
  const item: any = Array.isArray(session.item) ? session.item[0] : session.item;
  const { data: access, error: accessError } = await db.from('user_products').select('order_id')
    .eq('profile_id', user.id).eq('product_id', item.product_id).eq('order_id', item.order_id).maybeSingle();
  if (accessError) throw createError({ statusCode: 503, statusMessage: 'Unable to verify purchase access.' });
  const status = session.status === 'pending' && new Date(session.expires_at).getTime() <= Date.now() ? 'expired' : session.status;
  return { status, download: downloadMetadata(item, Boolean(access)),
    message: session.failure_code ? downloadFailureMessage(session.failure_code)
      : ['expired', 'revoked'].includes(status) ? downloadFailureMessage('download_session_used_or_expired') : null };
});
