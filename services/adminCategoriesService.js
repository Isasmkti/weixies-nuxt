import {
  rAdminCategories,
  rCreateAdminCategory,
  rDeleteAdminCategory,
  rUpdateAdminCategory,
} from '../repositories/adminCategoriesRepository'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function slugifyCategory(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

function normalizeCategoryPayload(input) {
  const name = String(input?.name || '').trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 80) {
    throw new Error('Category name must be between 2 and 80 characters.')
  }

  const slug = slugifyCategory(input?.slug || name)
  if (!slug || !SLUG_PATTERN.test(slug)) {
    throw new Error('Slug may contain lowercase letters, numbers, and single hyphens only.')
  }
  return { name, slug }
}

export const getAdminCategories = () => rAdminCategories()

export const createAdminCategory = input => rCreateAdminCategory(normalizeCategoryPayload(input))

export const updateAdminCategory = (categoryId, input) => {
  if (!/^\d+$/.test(String(categoryId || ''))) throw new Error('A valid category ID is required.')
  return rUpdateAdminCategory(categoryId, normalizeCategoryPayload(input))
}

export const deleteAdminCategory = (categoryId) => {
  if (!/^\d+$/.test(String(categoryId || ''))) throw new Error('A valid category ID is required.')
  return rDeleteAdminCategory(categoryId)
}
