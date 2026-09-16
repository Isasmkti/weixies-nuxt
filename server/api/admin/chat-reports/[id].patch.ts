import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { validateReportReview } from '~/utils/chatReports.js';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const input = validateReportReview(await readBody(event));
  if (input.error) throw createError({ statusCode: 400, statusMessage: input.error });
  const { data, error } = await useSupabaseAdmin().from('buyer_seller_reports')
    .update({ status: input.status, resolution_note: input.resolution_note, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq('id', String(getRouterParam(event, 'id') || '')).eq('status', 'open').select('id').maybeSingle();
  if (error) throw createError({ statusCode: 500, statusMessage: 'Review could not be saved.' });
  if (!data) throw createError({ statusCode: 409, statusMessage: 'This report has already been reviewed or is unavailable. Refresh the page.' });
  return { ok: true };
});
