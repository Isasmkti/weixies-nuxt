import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { categoryDatabaseError, requireCategoryId } from '~/server/utils/category-input';
import { recordAdminActivity } from '~/server/utils/admin-activity';

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const categoryId = requireCategoryId(getRouterParam(event, 'id'));
  const supabase = useSupabaseAdmin();

  const { data, error } = await supabase.rpc('delete_category_with_assignments', {
    p_category_id: categoryId,
  });

  if (error) categoryDatabaseError(error, 'Category could not be deleted.');
  await recordAdminActivity(supabase, user, 'category.deleted', 'category', categoryId, {
    detached_product_count: Number(data) || 0,
  });
  return { deleted: true, detached_product_count: Number(data) || 0 };
});
