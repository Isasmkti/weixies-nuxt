<script setup>
import { computed, ref, watch } from 'vue'
import { useCategoriesStore } from '../../stores/categoriesStore'
import { createProductSlug } from '../../services/sellerProductsService'
import ProductImageUploader from '../products/ProductImageUploader.vue'
import ProductSpecificationsEditor from '../products/ProductSpecificationsEditor.vue'
import ProductLicensesEditor from '../products/ProductLicensesEditor.vue'
import { createDefaultProductLicense } from '../../utils/productLicenses'
import { validateProductSubmission, validateProductZip } from '../../utils/productSubmission'

const props = defineProps({
  initialProduct: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
  submitLabel: { type: String, default: 'Submit for review' },
})

const emit = defineEmits(['submit'])
const categoriesStore = useCategoriesStore()
const zipFile = ref(null)
const imagesDirty = ref(false)
const validationError = ref('')
const form = ref({ name: '', slug: '', description: '', price: 0, images: [], categoryIds: [], specs: [], licenses: [createDefaultProductLicense(0)] })
const categories = computed(() => categoriesStore.categories)
const existingZipFile = computed(() => props.initialProduct?.product_files?.[0] || null)
watch(() => props.initialProduct, (product) => {
  form.value = {
    name: product?.name || '',
    slug: product?.slug || '',
    description: product?.description || '',
    price: product?.price ?? 0,
    images: product?.product_images
      ? [...product.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
      : [],
    categoryIds: product?.product_categories?.map((item) => item.category_id) || [],
    specs: product?.product_specs
      ? [...product.product_specs]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((spec) => ({ ...spec, _key: `saved-spec-${spec.id}` }))
      : [],
    licenses: product?.product_licenses?.length
      ? [...product.product_licenses]
        .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
        .map((license) => ({ ...license }))
      : [createDefaultProductLicense(product?.price ?? 0)],
  }
  zipFile.value = null
  imagesDirty.value = false
}, { immediate: true })

categoriesStore.fetchCategories()

const handleZipChange = (event) => {
  const file = event.target.files?.[0] || null
  validationError.value = ''
  try {
    validateProductZip(file)
  } catch (error) {
    event.target.value = ''
    zipFile.value = null
    validationError.value = error.message
    return
  }
  zipFile.value = file
}
const suggestedSlug = computed(() => createProductSlug(form.value.name))
const submit = () => {
  validationError.value = ''
  const payload = {
    ...form.value,
    slug: form.value.slug || suggestedSlug.value,
    images: form.value.images,
    syncImages: !props.initialProduct || imagesDirty.value,
    specs: form.value.specs
      .map((spec) => ({
        spec_name: String(spec.spec_name || '').trim(),
        spec_value: String(spec.spec_value || '').trim(),
      }))
      .filter((spec) => spec.spec_name || spec.spec_value),
    licenses: form.value.licenses,
    zipFile: zipFile.value,
  }

  try {
    validateProductSubmission(payload, { hasExistingZip: Boolean(existingZipFile.value) })
    emit('submit', payload)
  } catch (error) {
    validationError.value = error.message
  }
}
</script>

<template>
  <form class="rounded-2xl border border-bg-alt bg-surface p-6 sm:p-8 space-y-6" @submit.prevent="submit">
    <div>
      <label class="mb-2 block text-sm font-bold text-text-main">Product name</label>
      <input v-model="form.name" required maxlength="160" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. Premium design template">
    </div>
    <div>
      <label class="mb-2 block text-sm font-bold text-text-main">Product URL</label>
      <input v-model="form.slug" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/30" :placeholder="suggestedSlug">
      <p class="mt-1 text-xs text-text-muted">Leave blank to generate it from the product name.</p>
    </div>
    <div>
      <label class="mb-2 block text-sm font-bold text-text-main">Description</label>
      <textarea v-model="form.description" required rows="6" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Explain what buyers will receive."></textarea>
    </div>
    <div>
      <label class="mb-2 block text-sm font-bold text-text-main">Price (Rp)</label>
      <input v-model.number="form.price" required type="number" min="1" step="1" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30">
    </div>

    <div>
      <label class="mb-3 block text-sm font-bold text-text-main">Categories</label>
      <p v-if="categoriesStore.loading" class="text-sm text-text-muted">Loading categories...</p>
      <div v-else-if="categories.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label v-for="category in categories" :key="category.id" class="flex cursor-pointer items-center gap-2 rounded-xl border border-bg-alt bg-bg/50 p-3 text-sm font-medium text-text-main hover:border-primary/30">
          <input v-model="form.categoryIds" :value="category.id" type="checkbox" class="h-4 w-4 rounded border-bg-alt text-primary focus:ring-primary/30">
          <span>{{ category.name }}</span>
        </label>
      </div>
      <p v-else class="rounded-xl border border-dashed border-bg-alt p-4 text-sm text-text-muted">No categories are available.</p>
    </div>

    <ProductSpecificationsEditor v-model="form.specs" :disabled="submitting" />

    <ProductLicensesEditor v-model="form.licenses" :base-price="form.price" :disabled="submitting" />

    <div class="space-y-4">
      <ProductImageUploader v-model="form.images" input-name="seller-main-image" :disabled="submitting" @changed="imagesDirty = true" />

      <div>
        <label class="mb-2 block text-sm font-bold text-text-main">Product ZIP file</label>
        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" :required="!existingZipFile" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" @change="handleZipChange">
        <p class="mt-1 text-xs text-text-muted">Required. The ZIP stays private and is delivered to buyers after payment (maximum 200 MB).</p>
        <p v-if="zipFile" class="mt-2 text-sm font-semibold text-text-main">Selected: {{ zipFile.name }}</p>
        <p v-else-if="existingZipFile" class="mt-2 text-sm text-text-muted">Current file: {{ existingZipFile.file_name }}</p>
      </div>
    </div>

    <p v-if="validationError" role="alert" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">{{ validationError }}</p>

    <button :disabled="submitting" class="w-full rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70">{{ submitting ? 'Saving...' : submitLabel }}</button>
  </form>
</template>
