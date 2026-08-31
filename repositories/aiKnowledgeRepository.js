import { supabase } from '../utils/supabase'

const ARTICLE_METADATA_SELECT = `
  id,
  slug,
  title,
  excerpt,
  source_type,
  source_reference,
  category,
  tags,
  status,
  embedding_model,
  content_hash,
  embedded_at,
  published_at,
  created_by,
  updated_by,
  created_at,
  updated_at
`

const ARTICLE_DETAIL_SELECT = `${ARTICLE_METADATA_SELECT}, content`

export async function rAllAiKnowledgeArticles() {
  const { data, error } = await supabase
    .from('kb_articles')
    .select(ARTICLE_METADATA_SELECT)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function rGetAiKnowledgeArticle(articleId) {
  const { data, error } = await supabase
    .from('kb_articles')
    .select(ARTICLE_DETAIL_SELECT)
    .eq('id', articleId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function rCreateAiKnowledgeArticle(payload) {
  const { data, error } = await supabase
    .from('kb_articles')
    .insert(payload)
    .select(ARTICLE_DETAIL_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function rUpdateAiKnowledgeArticle(articleId, payload) {
  const { data, error } = await supabase
    .from('kb_articles')
    .update(payload)
    .eq('id', articleId)
    .select(ARTICLE_DETAIL_SELECT)
    .single()

  if (error) throw error
  return data
}

export async function rDeleteAiKnowledgeArticle(articleId) {
  const { error } = await supabase
    .from('kb_articles')
    .delete()
    .eq('id', articleId)

  if (error) throw error
}

