import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { escapeXml, resolveSeoSiteOrigin, sitemapUrl } from '~/server/utils/seo';

const PAGE_SIZE = 1000;
const MAX_DYNAMIC_URLS = 49_000;

async function getPublishedProducts(supabase: SupabaseClient) {
  const rows: Array<{ slug: string; created_at: string | null }> = [];
  for (let offset = 0; offset < MAX_DYNAMIC_URLS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('products')
      .select('slug, created_at')
      .eq('status', 'published')
      .not('slug', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data || []) as Array<{ slug: string; created_at: string | null }>));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

async function getApprovedStores(supabase: SupabaseClient, remaining: number) {
  const rows: Array<{ store_slug: string; created_at: string | null }> = [];
  for (let offset = 0; offset < remaining; offset += PAGE_SIZE) {
    const end = Math.min(offset + PAGE_SIZE - 1, remaining - 1);
    const { data, error } = await supabase
      .from('approved_seller_stores')
      .select('store_slug, created_at')
      .not('store_slug', 'is', null)
      .order('store_slug', { ascending: true })
      .range(offset, end);
    if (error) throw error;
    rows.push(...((data || []) as Array<{ store_slug: string; created_at: string | null }>));
    if (!data || data.length < end - offset + 1) break;
  }
  return rows;
}

export default defineEventHandler(async (event) => {
  const origin = resolveSeoSiteOrigin(event);
  const config = useRuntimeConfig(event);
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const products = await getPublishedProducts(supabase);
  const stores = await getApprovedStores(supabase, Math.max(0, MAX_DYNAMIC_URLS - products.length));
  const entries = [
    { path: '/welcome', priority: '1.0', changefreq: 'weekly', lastmod: null },
    { path: '/products', priority: '0.9', changefreq: 'daily', lastmod: null },
    ...products.map(product => ({
      path: `/products/${encodeURIComponent(product.slug)}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: product.created_at,
    })),
    ...stores.map(store => ({
      path: `/stores/${encodeURIComponent(store.store_slug)}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: store.created_at,
    })),
  ];

  const nodes = entries.map((entry) => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${escapeXml(new Date(entry.lastmod).toISOString())}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(sitemapUrl(origin, entry.path))}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
  }).join('\n');

  setResponseHeader(event, 'Content-Type', 'application/xml; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${nodes}\n</urlset>\n`;
});
