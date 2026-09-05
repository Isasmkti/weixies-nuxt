import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import {
  categoryDatabaseError,
  normalizeCategoryInput,
  requireCategoryId,
} from '~/server/utils/category-input';
import { recordAdminActivity } from '~/server/utils/admin-activity';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const categoryId = requireCategoryId(getRouterParam(event, 'id'));
  const payload = normalizeCategoryInput(await readBody(event).catch(() => ({})));
  const supabase = useSupabaseAdmin();

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', categoryId)
    .select('id, name, slug, created_at')
    .maybeSingle();

  if (error) categoryDatabaseError(error, 'Category could not be updated.');
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Category was not found.' });

  await recordAdminActivity(supabase, user, 'category.updated', 'category', data.id, {
    name: data.name,
    slug: data.slug,
  });

  return { category: data };
});
