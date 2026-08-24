<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import defaultProduct from '../../components/defaultProduct.vue'
import { getCurrentSeller, updateSellerStoreProfile } from '../../services/sellerService'
import { supabase } from '../../utils/supabase'

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))
const currentSeller = ref(null)
const editingStore = ref(false)
const savingStore = ref(false)
const settingsMessage = ref('')
const settingsError = ref('')
const imageFile = ref(null)
const imagePreview = ref('')
const removeCurrentImage = ref(false)
const settingsForm = reactive({
  storeName: '',
  storeDescription: '',
  bankName: '',
  bankAccount: '',
  payoutRecipientType: 'INDIVIDUAL',
  payoutAccountHolderName: '',
  payoutGivenName: '',
  payoutSurname: '',
  payoutBusinessName: '',
  payoutRoutingType: 'SWIFT',
  payoutRoutingValue: '',
  payoutAddressLine1: '',
  payoutCity: '',
  payoutProvince: '',
  payoutPostalCode: '',
})

const payoutRoutingTypes = [
  'SWIFT', 'IBAN', 'SORT_CODE', 'ABA', 'BSB', 'WALLET',
  'CLABE', 'MOBILE_NO', 'BUSINESS_REG_NO', 'NATIONAL_ID',
]

const { data: store, error: storeError } = await useAsyncData(
  () => `store-${slug.value}`,
  async () => {
    const { data, error } = await supabase
      .from('approved_seller_stores')
      .select('id, store_name, store_slug, store_description, store_image_url, created_at')
      .eq('store_slug', slug.value)
      .maybeSingle()
    if (error) throw error
    return data
  },
  { watch: [slug] },
)

const { data: products, pending: productsLoading, error: productsError, refresh: refreshProducts } = await useAsyncData(
  () => `store-products-${slug.value}`,
  async () => {
    if (!store.value?.id) return []
    const { data, error } = await supabase
      .from('products')
      .select('id, name, slug, description, price, product_images(image_url, is_primary)')
      .eq('seller_id', store.value.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
  },
  { watch: [store] },
)

watch(store, () => refreshProducts())

const isStoreOwner = computed(() => (
  currentSeller.value?.status === 'approved' && currentSeller.value?.id === store.value?.id
))
const displayedSettingsImage = computed(() => {
  if (imagePreview.value) return imagePreview.value
  if (removeCurrentImage.value) return ''
  return currentSeller.value?.store_image_url || ''
})

const clearImagePreview = () => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = ''
}

const resetSettingsForm = () => {
  if (!currentSeller.value) return
  settingsForm.storeName = currentSeller.value.store_name || ''
  settingsForm.storeDescription = currentSeller.value.store_description || ''
  settingsForm.bankName = currentSeller.value.bank_name || ''
  settingsForm.bankAccount = currentSeller.value.bank_account || ''
  settingsForm.payoutRecipientType = currentSeller.value.payout_recipient_type || 'INDIVIDUAL'
  settingsForm.payoutAccountHolderName = currentSeller.value.payout_account_holder_name || ''
  settingsForm.payoutGivenName = currentSeller.value.payout_given_name || ''
  settingsForm.payoutSurname = currentSeller.value.payout_surname || ''
  settingsForm.payoutBusinessName = currentSeller.value.payout_business_name || ''
  settingsForm.payoutRoutingType = currentSeller.value.payout_routing_type || 'SWIFT'
  settingsForm.payoutRoutingValue = currentSeller.value.payout_routing_value || ''
  settingsForm.payoutAddressLine1 = currentSeller.value.payout_address_line_1 || ''
  settingsForm.payoutCity = currentSeller.value.payout_city || ''
  settingsForm.payoutProvince = currentSeller.value.payout_province || ''
  settingsForm.payoutPostalCode = currentSeller.value.payout_postal_code || ''
  imageFile.value = null
  removeCurrentImage.value = false
  clearImagePreview()
  settingsError.value = ''
}

const handleStoreImage = (event) => {
  const file = event.target.files?.[0] || null
  settingsError.value = ''
  clearImagePreview()
  imageFile.value = null
  if (!file) return

  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
    event.target.value = ''
    settingsError.value = 'Store photo must be a JPG, PNG, WEBP, or GIF image.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    event.target.value = ''
    settingsError.value = 'Store photo must be 5 MB or smaller.'
    return
  }

  imageFile.value = file
  removeCurrentImage.value = false
  imagePreview.value = URL.createObjectURL(file)
}

const markImageForRemoval = () => {
  imageFile.value = null
  clearImagePreview()
  removeCurrentImage.value = true
}

const saveStoreSettings = async () => {
  if (!currentSeller.value) return
  savingStore.value = true
  settingsError.value = ''
  settingsMessage.value = ''
  try {
    const updatedSeller = await updateSellerStoreProfile({
      sellerId: currentSeller.value.id,
      storeName: settingsForm.storeName,
      storeDescription: settingsForm.storeDescription,
      bankName: settingsForm.bankName,
      bankAccount: settingsForm.bankAccount,
      payoutRecipientType: settingsForm.payoutRecipientType,
      payoutAccountHolderName: settingsForm.payoutAccountHolderName,
      payoutGivenName: settingsForm.payoutGivenName,
      payoutSurname: settingsForm.payoutSurname,
      payoutBusinessName: settingsForm.payoutBusinessName,
      payoutRoutingType: settingsForm.payoutRoutingType,
      payoutRoutingValue: settingsForm.payoutRoutingValue,
      payoutAddressLine1: settingsForm.payoutAddressLine1,
      payoutCity: settingsForm.payoutCity,
      payoutProvince: settingsForm.payoutProvince,
      payoutPostalCode: settingsForm.payoutPostalCode,
      storeImageFile: imageFile.value,
      currentStoreImageUrl: currentSeller.value.store_image_url,
      removeCurrentImage: removeCurrentImage.value,
    })
    currentSeller.value = { ...currentSeller.value, ...updatedSeller }
    store.value = {
      ...store.value,
      store_name: updatedSeller.store_name,
      store_description: updatedSeller.store_description,
      store_image_url: updatedSeller.store_image_url,
    }
    resetSettingsForm()
    editingStore.value = false
    settingsMessage.value = 'Store settings have been updated.'
  } catch (error) {
    settingsError.value = error.message || 'Store settings could not be updated.'
  } finally {
    savingStore.value = false
  }
}

onMounted(async () => {
  try {
    currentSeller.value = await getCurrentSeller()
    if (isStoreOwner.value) resetSettingsForm()
  } catch {
    currentSeller.value = null
  }
})

onBeforeUnmount(clearImagePreview)

const mainImage = (product) => {
  const images = product.product_images || []
  return images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
}

const formatIDR = (value) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(Number(value) || 0)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 py-8 font-poppins sm:px-6 lg:px-0">
    <div v-if="storeError || !store" class="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
      This store is not available.
    </div>
    <template v-else>
      <section class="rounded-3xl bg-gradient-to-br from-primary to-primary-dark p-7 text-white shadow-xl shadow-primary/15 sm:p-10">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-white/20 bg-white/10 text-3xl font-black shadow-xl">
            <img v-if="store.store_image_url" :src="store.store_image_url" :alt="store.store_name" class="h-full w-full object-cover">
            <span v-else>{{ store.store_name?.charAt(0) || 'S' }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Marketplace store</p>
            <h1 class="mt-3 text-3xl font-black sm:text-4xl">{{ store.store_name }}</h1>
            <p v-if="store.store_description" class="mt-3 max-w-2xl text-white/80">{{ store.store_description }}</p>
          </div>
          <button
            v-if="isStoreOwner"
            type="button"
            class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
            @click="editingStore = !editingStore; editingStore && resetSettingsForm()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
            {{ editingStore ? 'Close settings' : 'Edit store' }}
          </button>
        </div>
      </section>

      <p v-if="settingsMessage" class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{{ settingsMessage }}</p>

      <section v-if="isStoreOwner && editingStore" class="mt-6 rounded-3xl border border-bg-alt bg-surface p-6 shadow-lg sm:p-8">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-primary">Owner settings</p>
          <h2 class="mt-2 text-2xl font-black text-text-main">Manage your store</h2>
          <p class="mt-1 text-sm text-text-muted">Update public store information, store photo, and private payout account.</p>
        </div>

        <form class="mt-7 space-y-6" @submit.prevent="saveStoreSettings">
          <div class="grid gap-5 sm:grid-cols-2">
            <label class="text-sm font-bold text-text-main">Store name
              <input v-model="settingsForm.storeName" required maxlength="120" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
            </label>
            <label class="text-sm font-bold text-text-main">Store URL
              <input :value="`/stores/${store.store_slug}`" disabled class="mt-2 w-full cursor-not-allowed rounded-xl border border-bg-alt bg-bg-alt/40 px-4 py-3 font-normal text-text-muted">
            </label>
          </div>

          <label class="block text-sm font-bold text-text-main">Store description
            <textarea v-model="settingsForm.storeDescription" rows="4" maxlength="1000" class="mt-2 w-full resize-y rounded-xl border border-bg-alt bg-bg px-4 py-3 font-normal text-text-main outline-none focus:border-primary"></textarea>
          </label>

          <div>
            <p class="text-sm font-bold text-text-main">Store photo</p>
            <div class="mt-2 flex flex-col gap-4 rounded-2xl border border-bg-alt bg-bg/40 p-4 sm:flex-row sm:items-center">
              <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-bg-alt bg-surface text-2xl font-black text-text-muted">
                <img v-if="displayedSettingsImage" :src="displayedSettingsImage" alt="Store preview" class="h-full w-full object-cover">
                <span v-else>{{ settingsForm.storeName?.charAt(0) || 'S' }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="block w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 text-sm text-text-main file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:font-bold file:text-primary" @change="handleStoreImage">
                <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                  <span>JPG, PNG, WEBP, or GIF. Maximum 5 MB.</span>
                  <button v-if="displayedSettingsImage" type="button" class="font-bold text-red-600 hover:underline" @click="markImageForRemoval">Remove photo</button>
                  <button v-else-if="removeCurrentImage" type="button" class="font-bold text-primary hover:underline" @click="removeCurrentImage = false">Keep current photo</button>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border border-bg-alt bg-bg/30 p-5">
            <h3 class="font-black text-text-main">Payout account</h3>
            <p class="mt-1 text-xs text-text-muted">Private beneficiary information used only for Xendit payouts. Complete every field before the platform can send your balance.</p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="text-sm font-bold text-text-main">Recipient type
                <select v-model="settingsForm.payoutRecipientType" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="BUSINESS">Business</option>
                </select>
              </label>
              <label class="text-sm font-bold text-text-main">Account holder name
                <input v-model="settingsForm.payoutAccountHolderName" maxlength="255" autocomplete="name" placeholder="Exactly as registered at the bank" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <template v-if="settingsForm.payoutRecipientType === 'INDIVIDUAL'">
                <label class="text-sm font-bold text-text-main">Given name
                  <input v-model="settingsForm.payoutGivenName" maxlength="50" autocomplete="given-name" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
                </label>
                <label class="text-sm font-bold text-text-main">Surname
                  <input v-model="settingsForm.payoutSurname" maxlength="50" autocomplete="family-name" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
                </label>
              </template>
              <label v-else class="text-sm font-bold text-text-main sm:col-span-2">Registered business name
                <input v-model="settingsForm.payoutBusinessName" maxlength="50" autocomplete="organization" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main">Bank name
                <input v-model="settingsForm.bankName" maxlength="100" placeholder="e.g. BCA" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main">Account number
                <input v-model="settingsForm.bankAccount" maxlength="100" inputmode="numeric" autocomplete="off" placeholder="Account number" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main">Routing type
                <select v-model="settingsForm.payoutRoutingType" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
                  <option v-for="routingType in payoutRoutingTypes" :key="routingType" :value="routingType">{{ routingType }}</option>
                </select>
              </label>
              <label class="text-sm font-bold text-text-main">Routing value
                <input v-model="settingsForm.payoutRoutingValue" maxlength="100" autocomplete="off" placeholder="e.g. bank SWIFT/BIC code" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal uppercase text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main sm:col-span-2">Recipient address
                <input v-model="settingsForm.payoutAddressLine1" maxlength="255" autocomplete="street-address" placeholder="Street and building" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main">City
                <input v-model="settingsForm.payoutCity" maxlength="255" autocomplete="address-level2" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main">Province
                <input v-model="settingsForm.payoutProvince" maxlength="255" autocomplete="address-level1" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
              <label class="text-sm font-bold text-text-main">Postal code
                <input v-model="settingsForm.payoutPostalCode" maxlength="20" inputmode="numeric" autocomplete="postal-code" class="mt-2 w-full rounded-xl border border-bg-alt bg-surface px-4 py-3 font-normal text-text-main outline-none focus:border-primary">
              </label>
            </div>
          </div>

          <p v-if="settingsError" class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{{ settingsError }}</p>
          <div class="flex justify-end gap-3">
            <button type="button" class="rounded-xl px-5 py-3 font-bold text-text-muted hover:bg-bg-alt" :disabled="savingStore" @click="resetSettingsForm(); editingStore = false">Cancel</button>
            <button type="submit" class="rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:opacity-60" :disabled="savingStore">{{ savingStore ? 'Saving...' : 'Save changes' }}</button>
          </div>
        </form>
      </section>

      <section class="mt-8">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-2xl font-black text-text-main">Products</h2>
          <NuxtLink to="/products" class="text-sm font-bold text-primary hover:underline">Browse all products</NuxtLink>
        </div>
        <div v-if="productsLoading" class="mt-5 rounded-2xl border border-bg-alt bg-surface p-8 text-center text-text-muted">Loading products...</div>
        <div v-else-if="productsError" class="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">Products could not be loaded.</div>
        <div v-else-if="!products?.length" class="mt-5 rounded-2xl border border-dashed border-bg-alt bg-surface p-8 text-center text-text-muted">No published products yet.</div>
        <div v-else class="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <NuxtLink v-for="product in products" :key="product.id" :to="`/products/${product.slug}`" class="group overflow-hidden rounded-2xl border border-bg-alt bg-surface transition hover:-translate-y-1 hover:shadow-xl">
            <div class="aspect-[4/3] bg-bg-alt">
              <img v-if="mainImage(product)" :src="mainImage(product)" :alt="product.name" class="h-full w-full object-cover">
              <defaultProduct v-else class="h-full w-full p-12 text-text-muted/50" />
            </div>
            <div class="p-5">
              <h3 class="truncate text-lg font-black text-text-main group-hover:text-primary">{{ product.name }}</h3>
              <p class="mt-2 line-clamp-2 text-sm text-text-muted">{{ product.description }}</p>
              <p class="mt-4 font-black text-text-main">{{ formatIDR(product.price) }}</p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>
