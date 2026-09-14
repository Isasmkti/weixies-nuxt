import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { normalizePublicPagePath } from '~/server/utils/public-page-input';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const supabase = useSupabaseAdmin();

  if (!query.path) {
    const { data, error } = await supabase.from('public_pages').select('path, updated_at').eq('status', 'published').order('path');
    // Let the existing footer keep rendering while migration 0045 is waiting
    // to be deployed. No managed links will be shown in that interim state.
    if (error && ['42P01', 'PGRST205'].includes(error.code || '')) return { pages: [] };
    if (error) throw createError({ statusCode: 500, statusMessage: 'Published pages could not be loaded.' });
    setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    return { pages: data || [] };
  }

  let path: string;
  try {
    path = normalizePublicPagePath(query.path);
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Page not found.' });
  }
  const { data, error } = await supabase
    .from('public_pages')
    .select('id, path, page_type, title, eyebrow, summary, sections, effective_date, contact_details, seo_title, seo_description, published_at, updated_at')
    .eq('path', path)
    .eq('status', 'published')
    .maybeSingle();
  if (error) throw createError({ statusCode: 500, statusMessage: 'The page could not be loaded.' });
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Page not found.' });
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  return { page: data };
});
