import { resolveSeoSiteOrigin } from '~/server/utils/seo';

export default defineEventHandler((event) => {
  const origin = resolveSeoSiteOrigin(event);
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=3600');

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
});
