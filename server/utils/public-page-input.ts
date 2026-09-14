const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_PATH_PATTERN = /^\/(help|legal)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXACT_PATHS = new Set(['/about', '/contact', '/help']);
const PAGE_TYPES = new Set([
  'general', 'about', 'contact', 'help',
  'legal_terms', 'legal_privacy', 'legal_refund', 'legal_license',
]);
const DETAIL_TYPES = new Set(['business', 'registration', 'email', 'phone', 'address', 'hours', 'url', 'text']);

function cleanText(value: unknown, max: number) {
  return String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);
}

export function normalizePublicPagePath(value: unknown) {
  let path = cleanText(value, 120).toLowerCase().split(/[?#]/, 1)[0] || '';
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/').replace(/\/$/, '');
  if (!EXACT_PATHS.has(path) && !SAFE_PATH_PATTERN.test(path)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Path must be /about, /contact, /help, /help/page-name, or /legal/page-name.',
    });
  }
  return path;
}

export function requirePublicPageId(value: unknown) {
  const id = String(value || '').trim();
  if (!UUID_PATTERN.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid public page ID is required.' });
  }
  return id;
}

export function normalizePublicPageInput(input: any, existingPublishedAt: string | null = null) {
  const title = cleanText(input?.title, 160);
  if (title.length < 3) {
    throw createError({ statusCode: 400, statusMessage: 'Page title must contain at least 3 characters.' });
  }

  const status = input?.status === 'published' ? 'published' : 'draft';
  const rawSections = (Array.isArray(input?.sections) ? input.sections : []).filter((section: any) => (
    cleanText(section?.heading, 160) || cleanText(section?.body, 20_000)
  ));
  if (rawSections.length > 30) {
    throw createError({ statusCode: 400, statusMessage: 'A page may contain at most 30 sections.' });
  }
  const sections = rawSections.map((section: any, index: number) => {
    const heading = cleanText(section?.heading, 160);
    const body = cleanText(section?.body, 20_000);
    if (status === 'published' && (!heading || !body)) {
      throw createError({ statusCode: 400, statusMessage: `Section ${index + 1} requires a heading and content.` });
    }
    return { heading, body };
  });

  if (status === 'published' && sections.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Add at least one complete section before publishing.' });
  }

  const path = normalizePublicPagePath(input?.path);
  const pageType = PAGE_TYPES.has(input?.page_type) ? input.page_type : 'general';
  if (pageType === 'about' && path !== '/about') {
    throw createError({ statusCode: 400, statusMessage: 'The About page type must use /about.' });
  }
  if (pageType === 'contact' && path !== '/contact') {
    throw createError({ statusCode: 400, statusMessage: 'The Contact page type must use /contact.' });
  }
  if (pageType === 'help' && path !== '/help' && !path.startsWith('/help/')) {
    throw createError({ statusCode: 400, statusMessage: 'Help pages must use /help or /help/page-name.' });
  }
  if (pageType.startsWith('legal_') && !path.startsWith('/legal/')) {
    throw createError({ statusCode: 400, statusMessage: 'Legal page types must use a /legal/page-name path.' });
  }

  const effectiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(input?.effective_date || ''))
    ? String(input.effective_date)
    : null;
  if (status === 'published' && pageType.startsWith('legal_') && !effectiveDate) {
    throw createError({ statusCode: 400, statusMessage: 'Set an effective date before publishing a legal page.' });
  }

  const rawDetails = (Array.isArray(input?.contact_details) ? input.contact_details : []).filter((detail: any) => (
    cleanText(detail?.label, 80) || cleanText(detail?.value, 500)
  ));
  if (rawDetails.length > 12) {
    throw createError({ statusCode: 400, statusMessage: 'A page may contain at most 12 contact details.' });
  }
  const contactDetails = rawDetails.map((detail: any, index: number) => {
    const type = DETAIL_TYPES.has(detail?.type) ? detail.type : 'text';
    const label = cleanText(detail?.label, 80);
    const value = cleanText(detail?.value, 500);
    if (status === 'published' && (!label || !value)) {
      throw createError({ statusCode: 400, statusMessage: `Contact detail ${index + 1} requires a label and value.` });
    }
    if (status === 'published' && type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Contact detail ${index + 1} must contain a valid email address.` });
    }
    if (status === 'published' && type === 'url' && !/^https?:\/\/[^\s]+$/i.test(value)) {
      throw createError({ statusCode: 400, statusMessage: `Contact detail ${index + 1} must contain a complete http(s) URL.` });
    }
    return { type, label, value };
  });

  return {
    path,
    title,
    eyebrow: cleanText(input?.eyebrow, 80) || null,
    summary: cleanText(input?.summary, 600) || null,
    sections,
    seo_title: cleanText(input?.seo_title, 70) || null,
    seo_description: cleanText(input?.seo_description, 160) || null,
    page_type: pageType,
    effective_date: effectiveDate,
    contact_details: contactDetails,
    status,
    published_at: status === 'published' ? (existingPublishedAt || new Date().toISOString()) : null,
  };
}

export function publicPageDatabaseError(error: any, fallback: string): never {
  if (error?.code === '23505') {
    throw createError({ statusCode: 409, statusMessage: 'That public path is already assigned to another page.' });
  }
  if (error?.code === '23514') {
    throw createError({ statusCode: 400, statusMessage: 'The page does not meet the publishing requirements.' });
  }
  console.error('[Public pages] Database operation failed:', { code: error?.code || 'unknown' });
  throw createError({ statusCode: 500, statusMessage: fallback });
}
