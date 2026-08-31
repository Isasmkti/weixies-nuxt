import {
  rAllAiKnowledgeArticles,
  rCreateAiKnowledgeArticle,
  rDeleteAiKnowledgeArticle,
  rGetAiKnowledgeArticle,
  rUpdateAiKnowledgeArticle,
} from '../repositories/aiKnowledgeRepository'
import { supabase } from '../utils/supabase'

const SOURCE_TYPES = new Set(['faq', 'policy', 'guide', 'other'])
const ARTICLE_STATUSES = new Set(['draft', 'published', 'archived'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_TAGS = 20
const MAX_TAG_LENGTH = 60

export function slugifyAiKnowledgeTitle(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '')
}

function requireArticleId(articleId) {
  const normalized = String(articleId || '').trim()
  if (!UUID_PATTERN.test(normalized)) throw new Error('A valid knowledge article ID is required.')
  return normalized
}

function nullableText(value, maxLength, label) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  if (normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer.`)
  return normalized
}

function normalizeTags(value) {
  const rawTags = Array.isArray(value) ? value : String(value || '').split(',')
  const seen = new Set()
  const tags = []

  for (const rawTag of rawTags) {
    const tag = String(rawTag || '').trim().toLowerCase()
    if (!tag || seen.has(tag)) continue
    if (tag.length > MAX_TAG_LENGTH) {
      throw new Error(`Each tag must be ${MAX_TAG_LENGTH} characters or fewer.`)
    }
    seen.add(tag)
    tags.push(tag)
  }

  if (tags.length > MAX_TAGS) throw new Error(`Use no more than ${MAX_TAGS} tags.`)
  return tags
}

function normalizeArticlePayload(input) {
  const title = String(input?.title || '').trim()
  if (!title || title.length > 240) throw new Error('Title must be between 1 and 240 characters.')

  const slug = slugifyAiKnowledgeTitle(input?.slug || title)
  if (!slug || slug.length > 160 || !SLUG_PATTERN.test(slug)) {
    throw new Error('Slug may contain lowercase letters, numbers, and single hyphens only.')
  }

  const content = String(input?.content || '').trim()
  if (!content || content.length > 100000) {
    throw new Error('Content must be between 1 and 100,000 characters.')
  }

  const sourceType = String(input?.source_type || 'faq').trim().toLowerCase()
  if (!SOURCE_TYPES.has(sourceType)) throw new Error('Choose a valid source type.')

  const status = String(input?.status || 'draft').trim().toLowerCase()
  if (!ARTICLE_STATUSES.has(status)) throw new Error('Choose a valid article status.')

  return {
    slug,
    title,
    excerpt: nullableText(input?.excerpt, 500, 'Excerpt'),
    content,
    source_type: sourceType,
    source_reference: nullableText(input?.source_reference, 2000, 'Source reference'),
    category: nullableText(input?.category, 160, 'Category'),
    tags: normalizeTags(input?.tags),
    status,
  }
}

async function authenticatedAdminSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.user || !session.access_token) {
    throw new Error('You must be signed in as an administrator.')
  }
  return session
}

function friendlyDatabaseError(error) {
  if (error?.code === '23505') return new Error('That slug is already used by another knowledge article.')
  if (error?.code === '42501') return new Error('Administrator access is required for this action.')
  return error
}

export async function getAiKnowledgeArticles() {
  return rAllAiKnowledgeArticles()
}

export async function getAiKnowledgeArticle(articleId) {
  const article = await rGetAiKnowledgeArticle(requireArticleId(articleId))
  if (!article) throw new Error('Knowledge article was not found.')
  return article
}

export async function createAiKnowledgeArticle(input) {
  const session = await authenticatedAdminSession()
  const payload = normalizeArticlePayload(input)
  const now = new Date().toISOString()

  try {
    return await rCreateAiKnowledgeArticle({
      ...payload,
      created_by: session.user.id,
      updated_by: session.user.id,
      published_at: payload.status === 'published' ? now : null,
    })
  } catch (error) {
    throw friendlyDatabaseError(error)
  }
}

export async function updateAiKnowledgeArticle(articleId, input) {
  const normalizedId = requireArticleId(articleId)
  const session = await authenticatedAdminSession()
  const current = await getAiKnowledgeArticle(normalizedId)
  const payload = normalizeArticlePayload({ ...current, ...input })

  try {
    return await rUpdateAiKnowledgeArticle(normalizedId, {
      ...payload,
      updated_by: session.user.id,
      published_at: payload.status === 'published'
        ? (current.published_at || new Date().toISOString())
        : current.published_at,
    })
  } catch (error) {
    throw friendlyDatabaseError(error)
  }
}

export async function deleteAiKnowledgeArticle(articleId) {
  await authenticatedAdminSession()
  try {
    await rDeleteAiKnowledgeArticle(requireArticleId(articleId))
  } catch (error) {
    throw friendlyDatabaseError(error)
  }
}

async function callAdminAiApi(path, body) {
  const session = await authenticatedAdminSession()
  return $fetch(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body,
  })
}

export async function indexAiKnowledgeArticle(articleId) {
  const response = await callAdminAiApi(
    `/api/admin/ai/knowledge/${encodeURIComponent(requireArticleId(articleId))}/index`,
  )
  return response?.article || response
}

export async function indexAiProducts({ limit = 25, force = false } = {}) {
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 25))
  return callAdminAiApi('/api/admin/ai/products/index', {
    limit: normalizedLimit,
    force: Boolean(force),
  })
}

export const AI_KNOWLEDGE_SOURCE_TYPES = [...SOURCE_TYPES]
export const AI_KNOWLEDGE_STATUSES = [...ARTICLE_STATUSES]

