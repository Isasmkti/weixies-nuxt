<script setup>
import { computed, ref, watch } from 'vue'
import { useCategoriesStore } from '../../stores/categoriesStore'
import { createProductSlug } from '../../services/sellerProductsService'
import ProductImageUploader from '../products/ProductImageUploader.vue'

const props = defineProps({
  initialProduct: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
  submitLabel: { type: String, default: 'Submit for review' },
})

const emit = defineEmits(['submit'])
const categoriesStore = useCategoriesStore()
const zipFile = ref(null)
const form = ref({ name: '', slug: '', description: '', price: 0, images: [], categoryIds: [], specs: [] })
const categories = computed(() => categoriesStore.categories)
const existingZipFile = computed(() => props.initialProduct?.product_files?.[0] || null)
let specKey = 0
const createEmptySpec = () => ({ _key: `new-spec-${++specKey}`, spec_name: '', spec_value: '' })

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
  }
  zipFile.value = null
}, { immediate: true })

categoriesStore.fetchCategories()

const addSpec = () => {
  if (form.value.specs.length < 30) form.value.specs.push(createEmptySpec())
}
const removeSpec = (index) => form.value.specs.splice(index, 1)
const moveSpec = (index, direction) => {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= form.value.specs.length) return
  const [spec] = form.value.specs.splice(index, 1)
  form.value.specs.splice(targetIndex, 0, spec)
}
const handleZipChange = (event) => {
  const file = event.target.files?.[0] || null
  if (file && !file.name.toLowerCase().endsWith('.zip')) {
    event.target.value = ''
    zipFile.value = null
    return
  }
  zipFile.value = file
}
const suggestedSlug = computed(() => createProductSlug(form.value.name))
const submit = () => emit('submit', {
  ...form.value,
  slug: form.value.slug || suggestedSlug.value,
  images: form.value.images,
  specs: form.value.specs
    .map((spec) => ({
      spec_name: String(spec.spec_name || '').trim(),
      spec_value: String(spec.spec_value || '').trim(),
    }))
    .filter((spec) => spec.spec_name || spec.spec_value),
  zipFile: zipFile.value,
})
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
      <input v-model.number="form.price" required type="number" min="0" step="1" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 outline-none focus:ring-2 focus:ring-primary/30">
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

    <section class="space-y-4 border-t border-bg-alt pt-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-text-main">Product specifications</h2>
          <p class="mt-1 text-xs leading-5 text-text-muted">Add flexible details such as software, compatibility, dimensions, or language.</p>
        </div>
        <button type="button" :disabled="form.specs.length >= 30" class="text-sm font-bold text-primary transition hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50" @click="addSpec">+ Add specification</button>
      </div>

      <div v-if="form.specs.length" class="space-y-3">
        <div v-for="(spec, index) in form.specs" :key="spec._key" class="grid gap-3 rounded-xl border border-bg-alt bg-bg/50 p-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-end">
          <label class="block min-w-0">
            <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">Specification name</span>
            <input v-model="spec.spec_name" required maxlength="80" class="w-full rounded-lg border border-bg-alt bg-bg px-3 py-2.5 text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. Software">
          </label>
          <label class="block min-w-0">
            <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">Value</span>
            <input v-model="spec.spec_value" required maxlength="500" class="w-full rounded-lg border border-bg-alt bg-bg px-3 py-2.5 text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/30" placeholder="e.g. Adobe Photoshop">
          </label>
          <div class="flex h-10 items-center justify-end gap-1">
            <button type="button" :disabled="index === 0" :aria-label="`Move specification ${index + 1} up`" class="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" @click="moveSpec(index, -1)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 15 7-7 7 7" /></svg>
            </button>
            <button type="button" :disabled="index === form.specs.length - 1" :aria-label="`Move specification ${index + 1} down`" class="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" @click="moveSpec(index, 1)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" /></svg>
            </button>
            <button type="button" :aria-label="`Remove specification ${index + 1}`" class="h-9 rounded-lg px-2 text-sm font-bold text-red-600 transition hover:bg-red-500/10" @click="removeSpec(index)">Remove</button>
          </div>
        </div>
      </div>
      <p v-else class="rounded-xl border border-dashed border-bg-alt p-4 text-sm text-text-muted">No custom specifications added. This section is optional.</p>
      <p class="text-right text-xs text-text-muted">{{ form.specs.length }}/30 specifications</p>
    </section>

    <div class="space-y-4">
      <ProductImageUploader v-model="form.images" input-name="seller-main-image" :disabled="submitting" />

      <div>
        <label class="mb-2 block text-sm font-bold text-text-main">Product ZIP file</label>
        <input type="file" accept=".zip" class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" @change="handleZipChange">
        <p class="mt-1 text-xs text-text-muted">The ZIP stays private and is delivered to buyers after payment.</p>
        <p v-if="zipFile" class="mt-2 text-sm font-semibold text-text-main">Selected: {{ zipFile.name }}</p>
        <p v-else-if="existingZipFile" class="mt-2 text-sm text-text-muted">Current file: {{ existingZipFile.file_name }}</p>
      </div>
    </div>

    <button :disabled="submitting" class="w-full rounded-xl bg-primary px-5 py-3 font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70">{{ submitting ? 'Saving...' : submitLabel }}</button>
  </form>
</template>
