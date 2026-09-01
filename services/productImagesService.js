import { supabase } from '../utils/supabase'
import {
  rGetProductImages,
  rRemoveProductImageFiles,
  rReplaceProductImages,
  rUploadProductImage,
} from '../repositories/productsRepository'

const MAX_PRODUCT_IMAGES = 8
const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024
const PRODUCT_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function validateImageFile(file) {
  if (!file || !PRODUCT_IMAGE_EXTENSIONS[file.type]) {
    throw new Error('Product images must be JPG, PNG, WEBP, or GIF files.')
  }
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAX_PRODUCT_IMAGE_SIZE) {
    throw new Error('Each product image must be 5 MB or smaller.')
  }
}

function createImagePath(productId, userId, file) {
  const extension = PRODUCT_IMAGE_EXTENSIONS[file.type]
  const safeBaseName = String(file.name || 'product-image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'product-image'
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  return `${Number(productId)}/${userId}/${uniquePart}-${safeBaseName}.${extension}`
}

export async function saveProductImages(productId, images = []) {
  const normalizedProductId = Number(productId)
  if (!Number.isSafeInteger(normalizedProductId) || normalizedProductId <= 0) {
    throw new Error('A valid product is required for image uploads.')
  }

  const requestedImages = Array.isArray(images) ? images : []
  if (requestedImages.length > MAX_PRODUCT_IMAGES) {
    throw new Error(`A product can have up to ${MAX_PRODUCT_IMAGES} images.`)
  }

  const [{ data: { session } }, currentImages] = await Promise.all([
    supabase.auth.getSession(),
    rGetProductImages(normalizedProductId),
  ])
  if (!session?.user) throw new Error('You must be signed in to upload product images.')

  const currentById = new Map(currentImages.map((image) => [String(image.id), image]))
  const retainedIds = new Set()
  const nextImages = []
  const uploadedPaths = []

  try {
    for (const requestedImage of requestedImages) {
      if (requestedImage?.file) {
        validateImageFile(requestedImage.file)
        const filePath = createImagePath(normalizedProductId, session.user.id, requestedImage.file)
        const uploadedImage = await rUploadProductImage(filePath, requestedImage.file)
        uploadedPaths.push(uploadedImage.storage_path)
        nextImages.push({ ...uploadedImage, is_primary: Boolean(requestedImage.is_primary) })
        continue
      }

      const existingImage = currentById.get(String(requestedImage?.id || ''))
      if (!existingImage || retainedIds.has(String(existingImage.id))) {
        throw new Error('One of the selected product images is invalid. Please reload the form and try again.')
      }
      retainedIds.add(String(existingImage.id))
      nextImages.push({
        id: existingImage.id,
        image_url: existingImage.image_url,
        storage_path: existingImage.storage_path,
        is_primary: Boolean(requestedImage.is_primary),
      })
    }

    const primaryIndex = Math.max(nextImages.findIndex((image) => image.is_primary), 0)
    nextImages.forEach((image, index) => { image.is_primary = index === primaryIndex })
    const savedImages = await rReplaceProductImages(normalizedProductId, nextImages)

    const retainedPaths = new Set(nextImages.map((image) => image.storage_path).filter(Boolean))
    const removedPaths = currentImages
      .map((image) => image.storage_path)
      .filter((path) => path && !retainedPaths.has(path))

    if (removedPaths.length) {
      try {
        await rRemoveProductImageFiles(removedPaths)
      } catch (cleanupError) {
        console.warn('Product image metadata was saved, but old storage objects could not be removed.', cleanupError)
      }
    }

    return savedImages
  } catch (error) {
    if (uploadedPaths.length) {
      try {
        await rRemoveProductImageFiles(uploadedPaths)
      } catch (cleanupError) {
        console.warn('Unable to clean up uploaded product images after a failed save.', cleanupError)
      }
    }
    throw error
  }
}
