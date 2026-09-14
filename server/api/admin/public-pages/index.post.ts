import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { recordAdminActivity } from '~/server/utils/admin-activity';
import { normalizePublicPageInput, publicPageDatabaseError } from '~/server/utils/public-page-input';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const payload = normalizePublicPageInput(await readBody(event).catch(() => ({})));
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.from('public_pages').insert({ ...payload, created_by: user.id, updated_by: user.id }).select().single();
  if (error) publicPageDatabaseError(error, 'Public page could not be created.');
  if (!data) throw createError({ statusCode: 500, statusMessage: 'Public page could not be created.' });
  await recordAdminActivity(supabase, user, `public_page.${data.status === 'published' ? 'published' : 'created'}`, 'public_page', data.id, { path: data.path });
  return { page: data };
});
