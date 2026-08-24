import { supabase } from '../utils/supabase'

const SELLER_IMAGE_BUCKET = 'seller-shop-images'
const MAX_STORE_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_STORE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const STORE_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const PAYOUT_ROUTING_TYPES = new Set([
  'SWIFT', 'IBAN', 'SORT_CODE', 'ABA', 'BSB', 'WALLET',
  'CLABE', 'MOBILE_NO', 'BUSINESS_REG_NO', 'NATIONAL_ID',
])
const SELLER_PRIVATE_SELECT = 'id, profile_id, store_name, store_slug, store_description, store_image_url, bank_name, bank_account, payout_recipient_type, payout_account_holder_name, payout_given_name, payout_surname, payout_business_name, payout_routing_type, payout_routing_value, payout_address_line_1, payout_city, payout_province, payout_postal_code, commission_rate, status, rejection_reason, created_at'

async function getAuthenticatedUser(message) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error(message)
  return session.user
}

function validateStoreImage(file) {
  if (!file) throw new Error('Store photo is required.')
  if (!ALLOWED_STORE_IMAGE_TYPES.has(file.type)) {
    throw new Error('Store photo must be a JPG, PNG, WEBP, or GIF image.')
  }
  if (file.size > MAX_STORE_IMAGE_SIZE) {
    throw new Error('Store photo must be 5 MB or smaller.')
  }
}

function storagePathFromPublicUrl(publicUrl) {
  const marker = `/storage/v1/object/public/${SELLER_IMAGE_BUCKET}/`
  const markerIndex = String(publicUrl || '').indexOf(marker)
  if (markerIndex === -1) return null
  return decodeURIComponent(String(publicUrl).slice(markerIndex + marker.length))
}

async function uploadStoreImage(userId, file) {
  validateStoreImage(file)

  const extension = STORE_IMAGE_EXTENSIONS[file.type]
  const safeBaseName = String(file.name || 'store')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'store'
  const filePath = `${userId}/${Date.now()}-${safeBaseName}.${extension}`

  const { error } = await supabase.storage
    .from(SELLER_IMAGE_BUCKET)
    .upload(filePath, file, { contentType: file.type, upsert: false })

  if (error) throw error

  const { data } = supabase.storage.from(SELLER_IMAGE_BUCKET).getPublicUrl(filePath)
  return { filePath, publicUrl: data.publicUrl }
}

async function removeStoreImage(filePathOrUrl) {
  const filePath = String(filePathOrUrl || '').includes('/storage/v1/object/public/')
    ? storagePathFromPublicUrl(filePathOrUrl)
    : filePathOrUrl
  if (!filePath) return
  await supabase.storage.from(SELLER_IMAGE_BUCKET).remove([filePath])
}

export function createStoreSlug(storeName) {
  const normalized = String(storeName || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return normalized || 'store'
}

export async function getSellerByProfileId(profileId) {
  const { data, error } = await supabase
    .from('sellers')
    .select(SELLER_PRIVATE_SELECT)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateSellerStoreProfile({
  sellerId,
  storeName,
  storeDescription = '',
  bankName = '',
  bankAccount = '',
  payoutRecipientType = 'INDIVIDUAL',
  payoutAccountHolderName = '',
  payoutGivenName = '',
  payoutSurname = '',
  payoutBusinessName = '',
  payoutRoutingType = '',
  payoutRoutingValue = '',
  payoutAddressLine1 = '',
  payoutCity = '',
  payoutProvince = '',
  payoutPostalCode = '',
  storeImageFile = null,
  currentStoreImageUrl = null,
  removeCurrentImage = false,
}) {
  const trimmedStoreName = String(storeName || '').trim()
  if (!trimmedStoreName) throw new Error('Store name is required.')

  const recipientType = String(payoutRecipientType || 'INDIVIDUAL').trim().toUpperCase()
  const normalizedPayout = {
    bankName: String(bankName || '').trim(),
    bankAccount: String(bankAccount || '').trim(),
    accountHolderName: String(payoutAccountHolderName || '').trim(),
    givenName: String(payoutGivenName || '').trim(),
    surname: String(payoutSurname || '').trim(),
    businessName: String(payoutBusinessName || '').trim(),
    routingType: String(payoutRoutingType || '').trim().toUpperCase(),
    routingValue: String(payoutRoutingValue || '').trim(),
    addressLine1: String(payoutAddressLine1 || '').trim(),
    city: String(payoutCity || '').trim(),
    province: String(payoutProvince || '').trim(),
    postalCode: String(payoutPostalCode || '').trim(),
  }
  const hasPayoutAccount = Boolean(normalizedPayout.bankName || normalizedPayout.bankAccount)

  if (!['INDIVIDUAL', 'BUSINESS'].includes(recipientType)) {
    throw new Error('Invalid payout recipient type.')
  }
  if (normalizedPayout.routingType && !PAYOUT_ROUTING_TYPES.has(normalizedPayout.routingType)) {
    throw new Error('Invalid Xendit routing type.')
  }
  if (hasPayoutAccount && (
    !normalizedPayout.bankName
    || !normalizedPayout.bankAccount
    || !normalizedPayout.accountHolderName
    || !normalizedPayout.routingType
    || !normalizedPayout.routingValue
    || !normalizedPayout.addressLine1
    || !normalizedPayout.city
    || !normalizedPayout.province
    || !normalizedPayout.postalCode
    || (recipientType === 'INDIVIDUAL' && (!normalizedPayout.givenName || !normalizedPayout.surname))
    || (recipientType === 'BUSINESS' && !normalizedPayout.businessName)
  )) {
    throw new Error('Complete all Xendit beneficiary fields before saving a payout account.')
  }

  const user = await getAuthenticatedUser('You must be signed in to update your store.')
  const uploadedImage = storeImageFile ? await uploadStoreImage(user.id, storeImageFile) : null
  const shouldRemoveOldImage = Boolean(currentStoreImageUrl) && (Boolean(uploadedImage) || removeCurrentImage)
  const updatePayload = {
    store_name: trimmedStoreName,
    store_description: String(storeDescription || '').trim() || null,
    bank_name: normalizedPayout.bankName || null,
    bank_account: normalizedPayout.bankAccount || null,
    payout_recipient_type: recipientType,
    payout_account_holder_name: normalizedPayout.accountHolderName || null,
    payout_given_name: normalizedPayout.givenName || null,
    payout_surname: normalizedPayout.surname || null,
    payout_business_name: normalizedPayout.businessName || null,
    payout_routing_type: normalizedPayout.routingType || null,
    payout_routing_value: normalizedPayout.routingValue || null,
    payout_address_line_1: normalizedPayout.addressLine1 || null,
    payout_city: normalizedPayout.city || null,
    payout_province: normalizedPayout.province || null,
    payout_postal_code: normalizedPayout.postalCode || null,
  }

  if (uploadedImage) updatePayload.store_image_url = uploadedImage.publicUrl
  else if (removeCurrentImage) updatePayload.store_image_url = null

  const { data, error } = await supabase
    .from('sellers')
    .update(updatePayload)
    .eq('id', sellerId)
    .eq('profile_id', user.id)
    .eq('status', 'approved')
    .select(SELLER_PRIVATE_SELECT)
    .single()

  if (error) {
    if (uploadedImage) await removeStoreImage(uploadedImage.filePath)
    throw error
  }

  if (shouldRemoveOldImage) await removeStoreImage(currentStoreImageUrl)
  return data
}

export async function getCurrentSeller() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  return getSellerByProfileId(session.user.id)
}

export async function createSellerApplication(storeName, storeDescription = '', storeImageFile = null) {
  const trimmedStoreName = String(storeName || '').trim()
  const trimmedStoreDescription = String(storeDescription || '').trim()
  if (!trimmedStoreName) {
    throw new Error('Store name is required.')
  }

  const user = await getAuthenticatedUser('You must be signed in to become a seller.')
  const uploadedImage = await uploadStoreImage(user.id, storeImageFile)

  const baseSlug = createStoreSlug(trimmedStoreName)

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = attempt === 0
        ? ''
        : `-${Date.now().toString(36).slice(-5)}${attempt}`
      const storeSlug = `${baseSlug.slice(0, 60 - suffix.length)}${suffix}`

      const { data, error } = await supabase
        .from('sellers')
        .insert({
          profile_id: user.id,
          store_name: trimmedStoreName,
          store_slug: storeSlug,
          store_description: trimmedStoreDescription || null,
          store_image_url: uploadedImage.publicUrl,
        })
        .select('id, store_name, store_slug, store_image_url, status')
        .single()

      if (!error) return data

      // Retry only a generated-slug collision. A duplicate profile or any other
      // RLS/database error must be surfaced to the user as-is.
      if (error.code !== '23505' || !String(error.message || '').includes('store_slug')) {
        throw error
      }
    }

    throw new Error('Unable to generate a unique store URL. Please try again.')
  } catch (error) {
    await removeStoreImage(uploadedImage.filePath)
    throw error
  }
}

export async function resubmitSellerApplication(sellerId, storeName, storeDescription = '', storeImageFile = null, currentStoreImageUrl = null) {
  const trimmedStoreName = String(storeName || '').trim()
  const trimmedStoreDescription = String(storeDescription || '').trim()
  if (!trimmedStoreName) {
    throw new Error('Store name is required.')
  }

  const user = await getAuthenticatedUser('You must be signed in to resubmit your application.')
  if (!storeImageFile && !currentStoreImageUrl) throw new Error('Store photo is required.')

  const uploadedImage = storeImageFile ? await uploadStoreImage(user.id, storeImageFile) : null
  const updatePayload = {
    store_name: trimmedStoreName,
    store_description: trimmedStoreDescription || null,
    status: 'pending',
    rejection_reason: null,
  }
  if (uploadedImage) updatePayload.store_image_url = uploadedImage.publicUrl

  const { data, error } = await supabase
    .from('sellers')
    .update(updatePayload)
    .eq('id', sellerId)
    .eq('profile_id', user.id)
    .select('id, store_name, store_slug, store_description, store_image_url, status, rejection_reason')
    .single()

  if (error) {
    if (uploadedImage) await removeStoreImage(uploadedImage.filePath)
    throw error
  }

  if (uploadedImage && currentStoreImageUrl) {
    await removeStoreImage(currentStoreImageUrl)
  }
  return data
}
