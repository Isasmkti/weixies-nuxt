import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  const { data, error } = await useSupabaseAdmin()
    .from('public_pages')
    .select('id, path, page_type, title, eyebrow, summary, sections, effective_date, contact_details, seo_title, seo_description, status, published_at, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('[Admin public pages] Load failed:', { code: error.code || 'unknown' });
    throw createError({ statusCode: 500, statusMessage: 'Public pages could not be loaded.' });
  }
  return { pages: data || [] };
});
