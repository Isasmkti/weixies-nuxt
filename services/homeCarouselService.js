import { supabase } from '../utils/supabase'
import {
  rAdminHomeCarouselItems,
  rCreateHomeCarouselItem,
  rDeleteHomeCarouselImage,
  rDeleteHomeCarouselItem,
  rHomeCarouselImageUrl,
  rPublicHomeCarouselItems,
  rUpdateHomeCarouselItem,
  rUploadHomeCarouselImage,
} from '../repositories/homeCarouselRepository'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function isWithinSchedule(item, now = Date.now()) {
  const startsAt = item.starts_at ? new Date(item.starts_at).getTime() : null
  const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt > now)
}

export function withHomeCarouselImage(item) {
  return {
    ...item,
    image_url: rHomeCarouselImageUrl(item.image_path),
  }
}

export async function sPublicHomeCarouselItems() {
  const rows = await rPublicHomeCarouselItems()
  return rows.filter((item) => isWithinSchedule(item)).map(withHomeCarouselImage)
}

export async function sAdminHomeCarouselItems() {
  return (await rAdminHomeCarouselItems()).map(withHomeCarouselImage)
}

function nullableDate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Enter a valid schedule date.')
  return date.toISOString()
}

function normalizedPayload(value) {
  const title = String(value.title || '').trim()
  const description = String(value.description || '').trim()
  const buttonLabel = String(value.button_label || '').trim()
  const linkUrl = String(value.link_url || '').trim()
  const contentType = value.content_type === 'news' ? 'news' : 'promo'

  if (!title) throw new Error('Title is required.')
  if (title.length > 120) throw new Error('Title must be 120 characters or fewer.')
  if (description.length > 320) throw new Error('Description must be 320 characters or fewer.')
  if (!buttonLabel) throw new Error('Button label is required.')
  if (!(linkUrl.startsWith('/') && !linkUrl.startsWith('//')) && !linkUrl.startsWith('https://')) {
    throw new Error('Link must be an internal path or a secure HTTPS URL.')
  }

  const startsAt = nullableDate(value.starts_at)
  const endsAt = nullableDate(value.ends_at)
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new Error('End date must be later than start date.')
  }

  return {
    content_type: contentType,
    badge: String(value.badge || '').trim().slice(0, 60),
    title,
    description,
    image_path: value.image_path || null,
    button_label: buttonLabel.slice(0, 40),
    link_url: linkUrl,
    is_active: Boolean(value.is_active),
    sort_order: Math.max(0, Number.parseInt(value.sort_order, 10) || 0),
    published_at: nullableDate(value.published_at) || new Date().toISOString(),
    starts_at: startsAt,
    ends_at: endsAt,
  }
}

export async function sCreateHomeCarouselItem(value) {
  if (!value.image_path) throw new Error('Upload a carousel image before publishing this item.')
  return withHomeCarouselImage(await rCreateHomeCarouselItem(normalizedPayload(value)))
}

export async function sUpdateHomeCarouselItem(id, value) {
  if (!id) throw new Error('Carousel item is missing an identifier.')
  if (!value.image_path) throw new Error('A carousel image is required.')
  return withHomeCarouselImage(await rUpdateHomeCarouselItem(id, normalizedPayload(value)))
}

export async function sDeleteHomeCarouselItem(item) {
  await rDeleteHomeCarouselItem(item.id)
  if (item.image_path) {
    try {
      await rDeleteHomeCarouselImage(item.image_path)
    } catch (error) {
      console.warn('[Home carousel] The database item was deleted but its image could not be removed.', error)
    }
  }
}

export async function sUploadHomeCarouselImage(file) {
  if (!file) throw new Error('Choose an image first.')
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Image must be JPG, PNG, WEBP, or GIF.')
  if (file.size > MAX_IMAGE_SIZE) throw new Error('Image must be 5 MB or smaller.')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('You must be signed in as an admin.')

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const safeName = String(file.name || 'carousel')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'carousel'
  const path = `${session.user.id}/${Date.now()}-${safeName}.${extension}`
  await rUploadHomeCarouselImage(path, file)
  return { image_path: path, image_url: rHomeCarouselImageUrl(path) }
}

export async function sRemoveHomeCarouselImage(path) {
  return rDeleteHomeCarouselImage(path)
}

