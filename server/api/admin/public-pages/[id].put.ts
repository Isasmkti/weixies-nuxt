import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { recordAdminActivity } from '~/server/utils/admin-activity';
import { normalizePublicPageInput, publicPageDatabaseError, requirePublicPageId } from '~/server/utils/public-page-input';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const id = requirePublicPageId(getRouterParam(event, 'id'));
  const supabase = useSupabaseAdmin();
  const { data: existing, error: loadError } = await supabase.from('public_pages').select('status, published_at').eq('id', id).maybeSingle();
  if (loadError) publicPageDatabaseError(loadError, 'Public page could not be loaded.');
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Public page was not found.' });
  const payload = normalizePublicPageInput(await readBody(event).catch(() => ({})), existing.published_at);
  const { data, error } = await supabase.from('public_pages').update({ ...payload, updated_by: user.id }).eq('id', id).select().single();
  if (error) publicPageDatabaseError(error, 'Public page could not be updated.');
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Public page was not found.' });
  const transition = existing.status !== data.status ? data.status : 'updated';
  await recordAdminActivity(supabase, user, `public_page.${transition}`, 'public_page', id, { path: data.path });
  return { page: data };
});
