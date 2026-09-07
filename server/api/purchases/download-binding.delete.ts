import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { privateDownloadResponse, requireSameOriginDownload, downloadBinding, DOWNLOAD_COOKIE } from '~/server/utils/purchase-download';

export default defineEventHandler(async (event) => {
  privateDownloadResponse(event);
  requireSameOriginDownload(event);
  const bindingHash = downloadBinding(event);
  deleteCookie(event, DOWNLOAD_COOKIE, { path: '/api/purchases' });
  if (bindingHash) {
    const { error } = await useSupabaseAdmin().from('purchase_download_sessions')
      .update({ status: 'revoked' }).eq('binding_hash', bindingHash).eq('status', 'pending');
    if (error) throw createError({ statusCode: 503, statusMessage: 'Download sessions could not be revoked.' });
  }
  return { revoked: true };
});
