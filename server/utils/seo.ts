export function resolveSeoSiteOrigin(event: any): string {
  const config = useRuntimeConfig(event);
  const configured = String(config.public.siteUrl || '').trim();

  try {
    const url = new URL(configured);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
  } catch {
    // Local development can safely fall back to the current request origin.
  }

  return getRequestURL(event).origin;
}

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function sitemapUrl(origin: string, path: string): string {
  return new URL(path, `${origin}/`).toString();
}
