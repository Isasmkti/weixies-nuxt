import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  const supabase = useSupabaseAdmin();

  const [{ data: categories, error: categoryError }, { data: assignments, error: assignmentError }] = await Promise.all([
    supabase.from('categories').select('id, name, slug, created_at').order('name', { ascending: true }),
    supabase.from('product_categories').select('category_id'),
  ]);

  if (categoryError || assignmentError) {
    console.error('[Admin categories] Load failed:', {
      categoryCode: categoryError?.code || null,
      assignmentCode: assignmentError?.code || null,
    });
    throw createError({ statusCode: 500, statusMessage: 'Categories could not be loaded.' });
  }

  const counts = new Map<string, number>();
  for (const assignment of assignments || []) {
    const key = String(assignment.category_id);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return {
    categories: (categories || []).map((category) => ({
      ...category,
      product_count: counts.get(String(category.id)) || 0,
    })),
  };
});
