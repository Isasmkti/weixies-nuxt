const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyCategory(value: unknown) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

export function normalizeCategoryInput(input: any) {
  const name = String(input?.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) {
    throw createError({ statusCode: 400, statusMessage: 'Category name must be between 2 and 80 characters.' });
  }

  const slug = slugifyCategory(input?.slug || name);
  if (!slug || !CATEGORY_SLUG_PATTERN.test(slug)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug may contain lowercase letters, numbers, and single hyphens only.',
    });
  }

  return { name, slug };
}

export function requireCategoryId(value: unknown) {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid category ID is required.' });
  }
  const categoryId = Number(normalized);
  if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
    throw createError({ statusCode: 400, statusMessage: 'A valid category ID is required.' });
  }
  return categoryId;
}

export function categoryDatabaseError(error: any, fallback: string): never {
  if (error?.code === '23505') {
    throw createError({ statusCode: 409, statusMessage: 'That category slug is already in use.' });
  }
  if (error?.code === 'P0002') {
    throw createError({ statusCode: 404, statusMessage: 'Category was not found.' });
  }
  console.error('[Admin categories] Database operation failed:', { code: error?.code || 'unknown' });
  throw createError({ statusCode: 500, statusMessage: fallback });
}
