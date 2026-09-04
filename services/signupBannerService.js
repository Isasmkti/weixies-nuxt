import { supabase } from '../utils/supabase'
import {
  rAdminSignupBanner,
  rDeleteSignupBanner,
  rPublicSignupBanner,
  rSaveSignupBanner,
  rSignupBannerUrl,
  rUploadSignupBanner,
} from '../repositories/signupBannerRepository'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function withImageUrl(row) {
  if (!row) return null
  return { ...row, image_url: rSignupBannerUrl(row.image_path) }
}

export async function sPublicSignupBanner() {
  return withImageUrl(await rPublicSignupBanner())
}

export async function sAdminSignupBanner() {
  return withImageUrl(await rAdminSignupBanner())
}

export async function sSaveSignupBanner(value) {
  const imagePath = String(value?.image_path || '').trim()
  const isActive = Boolean(value?.is_active)
  const altText = String(value?.alt_text || '').trim()
  if (isActive && !imagePath) throw new Error('Upload a banner image before making it visible.')
  if (altText.length > 160) throw new Error('Alternative text must be 160 characters or fewer.')

  return withImageUrl(await rSaveSignupBanner({
    image_path: imagePath || null,
    alt_text: altText || 'Weixies marketplace sign-up banner',
    is_active: isActive,
  }))
}

export async function sUploadSignupBanner(file) {
  if (!file) throw new Error('Choose a banner image first.')
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Banner must be a JPG, PNG, or WEBP image.')
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Banner must be 5 MB or smaller.')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('You must be signed in as an admin.')

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const safeName = String(file.name || 'signup-banner')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'signup-banner'
  const path = `signup-banner/${session.user.id}/${Date.now()}-${safeName}.${extension}`

  await rUploadSignupBanner(path, file)
  return { image_path: path, image_url: rSignupBannerUrl(path) }
}

export async function sDeleteSignupBanner(path) {
  return rDeleteSignupBanner(path)
}
