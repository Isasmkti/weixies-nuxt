import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { recordAdminActivity } from '~/server/utils/admin-activity';
import { publicPageDatabaseError, requirePublicPageId } from '~/server/utils/public-page-input';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const id = requirePublicPageId(getRouterParam(event, 'id'));
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.from('public_pages').delete().eq('id', id).select('id, path').maybeSingle();
  if (error) publicPageDatabaseError(error, 'Public page could not be deleted.');
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Public page was not found.' });
  await recordAdminActivity(supabase, user, 'public_page.deleted', 'public_page', id, { path: data.path });
  return { deleted: true };
});
