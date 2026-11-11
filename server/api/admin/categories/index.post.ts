import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { categoryDatabaseError, normalizeCategoryInput } from '~/server/utils/category-input';
import { recordAdminActivity } from '~/server/utils/admin-activity';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const payload = normalizeCategoryInput(await readBody(event).catch(() => ({})));
  const supabase = useSupabaseAdmin();

  const escapedName = payload.name.replace(/[\\%_]/g, '\\$&');
  const { data: existingCategory, error: duplicateCheckError } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', escapedName)
    .limit(1)
    .maybeSingle();

  if (duplicateCheckError) {
    console.error('[Admin categories] Duplicate check failed:', { code: duplicateCheckError.code || 'unknown' });
    throw createError({ statusCode: 500, statusMessage: 'Category could not be created.' });
  }
  if (existingCategory) {
    throw createError({ statusCode: 409, statusMessage: 'A category with this name already exists.' });
  }

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select('id, name, slug, created_at')
    .single();

  if (error) categoryDatabaseError(error, 'Category could not be created.');
  if (!data) throw createError({ statusCode: 500, statusMessage: 'Category could not be created.' });
  await recordAdminActivity(supabase, user, 'category.created', 'category', data.id, {
    name: data.name,
    slug: data.slug,
  });
  return { category: { ...data, product_count: 0 } };
});
