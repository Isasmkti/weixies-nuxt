<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useCategoriesStore } from '../../stores/categoriesStore'
import { createAdminCategory, slugifyCategory } from '../../services/adminCategoriesService'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])
const categoriesStore = useCategoriesStore()
const dropdownOpen = ref(false)
const editorOpen = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ name: '', slug: '' })

const categories = computed(() => categoriesStore.categories)
const selectedCategories = computed(() => categories.value.filter(category =>
  props.modelValue.some(id => String(id) === String(category.id)),
))
const selectedSummary = computed(() => selectedCategories.value.map(category => category.name).join(', '))

watch(() => form.name, (name) => {
  form.slug = slugifyCategory(name)
})

const toggleCategory = (category, event) => {
  const selected = props.modelValue || []
  const next = event.target.checked
    ? [...selected, category.id]
    : selected.filter(id => String(id) !== String(category.id))
  emit('update:modelValue', next)
}

const resetEditor = () => {
  form.name = ''
  form.slug = ''
  error.value = ''
}

const openEditor = () => {
  dropdownOpen.value = false
  resetEditor()
  editorOpen.value = true
}

const closeEditor = () => {
  if (saving.value) return
  editorOpen.value = false
  resetEditor()
}

const errorText = (err) => err?.data?.statusMessage
  || err?.data?.message
  || err?.statusMessage
  || err?.message
  || 'Please check the category details and try again.'

const saveCategory = async () => {
  saving.value = true
  error.value = ''
  try {
    await categoriesStore.fetchCategories()
    const category = await createAdminCategory(form)
    categoriesStore.upsertCategory(category)
    emit('update:modelValue', [
      ...(props.modelValue || []).filter(id => String(id) !== String(category.id)),
      category.id,
    ])
    editorOpen.value = false
    resetEditor()
  } catch (err) {
    error.value = errorText(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <label class="mb-2 block text-sm font-semibold text-text-main">Categories</label>
    <div class="relative">
      <button
        type="button"
        class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-bg-alt bg-bg px-4 py-3 text-left transition hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        :aria-expanded="dropdownOpen"
        aria-haspopup="true"
        @click="dropdownOpen = !dropdownOpen"
      >
        <span class="min-w-0 truncate text-sm" :class="selectedSummary ? 'text-text-main' : 'text-text-muted'">
          {{ selectedSummary || (categoriesStore.loading ? 'Loading categories...' : 'Select categories') }}
        </span>
        <svg class="h-4 w-4 shrink-0 text-text-muted transition" :class="{ 'rotate-180': dropdownOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div v-if="dropdownOpen" class="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-bg-alt bg-surface p-2 shadow-xl">
        <p v-if="categoriesStore.loading" class="px-3 py-2 text-sm text-text-muted">Loading categories...</p>
        <template v-else>
          <label
            v-for="category in categories"
            :key="category.id"
            class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-main transition hover:bg-bg-alt"
          >
            <input
              type="checkbox"
              :checked="modelValue.some(id => String(id) === String(category.id))"
              class="h-4 w-4 rounded border-bg-alt text-primary focus:ring-primary/30"
              @change="toggleCategory(category, $event)"
            >
            <span>{{ category.name }}</span>
          </label>
          <p v-if="!categories.length" class="px-3 py-2 text-sm text-text-muted">No categories are available.</p>
        </template>
        <p v-if="categoriesStore.error" class="px-3 py-2 text-sm text-red-600">{{ categoriesStore.error }}</p>
        <button
          type="button"
          class="mt-1 w-full rounded-lg border-t border-bg-alt px-3 py-3 text-left text-sm font-semibold text-primary transition hover:bg-primary/5"
          @click="openEditor"
        >
          + Add new category
        </button>
      </div>
    </div>
    <p v-if="selectedCategories.length" class="mt-2 text-xs text-text-muted">
      {{ selectedCategories.length }} categor{{ selectedCategories.length === 1 ? 'y' : 'ies' }} selected
    </p>

    <Teleport to="body">
      <div v-if="editorOpen" class="fixed inset-0 z-[90] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="quick-category-title" @click.self="closeEditor">
        <form class="w-full rounded-t-2xl border border-bg-alt bg-surface p-6 shadow-2xl sm:max-w-lg sm:rounded-2xl" @submit.prevent="saveCategory">
          <div class="mb-6 flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-black uppercase tracking-[0.2em] text-primary">Product organization</p>
              <h2 id="quick-category-title" class="mt-1 text-2xl font-extrabold text-text-main">Add category</h2>
            </div>
            <button type="button" class="rounded-full p-2 text-text-muted transition hover:bg-bg-alt hover:text-text-main" aria-label="Close category editor" :disabled="saving" @click="closeEditor">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 6 12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <div class="space-y-5">
            <label class="block">
              <span class="mb-2 block text-sm font-bold text-text-main">Category name</span>
              <input v-model="form.name" required minlength="2" maxlength="80" autocomplete="off" placeholder="e.g. Graphic Design" class="min-h-11 w-full rounded-xl border border-bg-alt bg-bg px-4 py-2.5 text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15">
            </label>
            <label class="block">
              <span class="mb-2 block text-sm font-bold text-text-main">Slug</span>
              <div class="flex min-h-11 items-center rounded-xl border border-bg-alt bg-bg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                <span class="pl-4 text-sm text-text-muted">/category/</span>
                <input :value="form.slug" readonly required maxlength="80" autocomplete="off" placeholder="graphic-design" class="min-w-0 flex-1 bg-transparent px-1 py-2.5 pr-4 text-sm text-text-muted outline-none">
              </div>
              <p class="mt-1.5 text-xs text-text-muted">Generated from the name until you edit it manually.</p>
            </label>
          </div>

          <p v-if="error" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600" role="alert">{{ error }}</p>

          <div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" class="min-h-11 rounded-xl border border-bg-alt px-5 py-2.5 font-semibold text-text-main transition hover:bg-bg-alt" :disabled="saving" @click="closeEditor">Cancel</button>
            <button type="submit" class="min-h-11 rounded-xl bg-primary px-5 py-2.5 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60" :disabled="saving">
              {{ saving ? 'Saving...' : 'Create category' }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>
