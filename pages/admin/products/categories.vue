<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useCategoriesStore } from '../../../stores/categoriesStore'
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  slugifyCategory,
  updateAdminCategory,
} from '../../../services/adminCategoriesService'
import { confirmAction, showErrorDialog, showSuccess } from '../../../utils/sweetAlert'

const categoriesStore = useCategoriesStore()
const categories = ref([])
const loading = ref(true)
const saving = ref(false)
const deletingId = ref(null)
const search = ref('')
const editorOpen = ref(false)
const editingId = ref(null)
const slugWasEdited = ref(false)
const form = reactive({ name: '', slug: '' })

const filteredCategories = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return categories.value
  return categories.value.filter(category => `${category.name} ${category.slug}`.toLowerCase().includes(query))
})

const assignedProductCount = computed(() => categories.value.reduce(
  (total, category) => total + Number(category.product_count || 0),
  0,
))
const unusedCategoryCount = computed(() => categories.value.filter(category => !Number(category.product_count)).length)
const editorTitle = computed(() => editingId.value ? 'Edit category' : 'Add category')

const errorText = (error, fallback) => error?.data?.statusMessage
  || error?.data?.message
  || error?.statusMessage
  || error?.message
  || fallback

watch(() => form.name, (name) => {
  if (!slugWasEdited.value) form.slug = slugifyCategory(name)
})

const loadCategories = async () => {
  loading.value = true
  try {
    categories.value = await getAdminCategories()
  } catch (error) {
    await showErrorDialog('Categories could not be loaded', errorText(error, 'Please refresh and try again.'))
  } finally {
    loading.value = false
  }
}

const resetEditor = () => {
  editingId.value = null
  slugWasEdited.value = false
  form.name = ''
  form.slug = ''
}

const openCreate = () => {
  resetEditor()
  editorOpen.value = true
}

const openEdit = (category) => {
  editingId.value = category.id
  form.name = category.name
  form.slug = category.slug
  slugWasEdited.value = true
  editorOpen.value = true
}

const closeEditor = () => {
  if (saving.value) return
  editorOpen.value = false
  resetEditor()
}

const handleSlugInput = (event) => {
  slugWasEdited.value = true
  form.slug = slugifyCategory(event.target.value)
}

const refreshSharedCategories = async () => {
  categoriesStore.fetchedAt = 0
  await categoriesStore.fetchCategories({ force: true })
}

const saveCategory = async () => {
  saving.value = true
  let saved = false
  try {
    if (editingId.value) {
      const current = categories.value.find(category => String(category.id) === String(editingId.value))
      const updated = await updateAdminCategory(editingId.value, form)
      categories.value = categories.value.map(category => String(category.id) === String(editingId.value)
        ? { ...category, ...updated, product_count: current?.product_count || 0 }
        : category)
      await showSuccess('Category updated', `${updated.name} is ready to use.`)
    } else {
      const created = await createAdminCategory(form)
      categories.value = [...categories.value, created].sort((a, b) => a.name.localeCompare(b.name))
      await showSuccess('Category created', `${created.name} is ready to assign to products.`)
    }
    await refreshSharedCategories()
    saved = true
  } catch (error) {
    await showErrorDialog('Category could not be saved', errorText(error, 'Please check the form and try again.'))
  } finally {
    saving.value = false
  }
  if (saved) closeEditor()
}

const removeCategory = async (category) => {
  const productCount = Number(category.product_count || 0)
  const confirmed = await confirmAction({
    title: 'Delete category?',
    text: productCount
      ? `This removes “${category.name}” from ${productCount} product${productCount === 1 ? '' : 's'} before deleting it.`
      : `“${category.name}” will be permanently deleted.`,
    confirmButtonText: 'Delete category',
    confirmButtonColor: 'rgb(var(--color-danger))',
  })
  if (!confirmed) return

  deletingId.value = category.id
  try {
    await deleteAdminCategory(category.id)
    categories.value = categories.value.filter(item => String(item.id) !== String(category.id))
    await refreshSharedCategories()
    await showSuccess('Category deleted', 'The category has been removed.')
  } catch (error) {
    await showErrorDialog('Category could not be deleted', errorText(error, 'Please try again.'))
  } finally {
    deletingId.value = null
  }
}

onMounted(loadCategories)
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] font-poppins">
    <header class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-2 text-xs font-black uppercase tracking-[0.22em] text-primary">Product organization</p>
        <h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Product Categories</h1>
        <p class="mt-2 font-montserrat text-sm text-text-muted">Create and organize the categories used across the catalog.</p>
      </div>
      <button type="button" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-ui-md bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark" @click="openCreate">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add category
      </button>
    </header>

    <section class="mb-6 grid gap-3 sm:grid-cols-3" aria-label="Category summary">
      <article class="rounded-ui-lg border border-border bg-surface p-5">
        <p class="text-xs font-bold uppercase tracking-wider text-text-muted">Total categories</p>
        <p class="mt-2 text-3xl font-extrabold text-text-main">{{ categories.length }}</p>
      </article>
      <article class="rounded-ui-lg border border-border bg-surface p-5">
        <p class="text-xs font-bold uppercase tracking-wider text-text-muted">Product assignments</p>
        <p class="mt-2 text-3xl font-extrabold text-primary">{{ assignedProductCount }}</p>
      </article>
      <article class="rounded-ui-lg border border-border bg-surface p-5">
        <p class="text-xs font-bold uppercase tracking-wider text-text-muted">Unused categories</p>
        <p class="mt-2 text-3xl font-extrabold text-text-main">{{ unusedCategoryCount }}</p>
      </article>
    </section>

    <section class="overflow-hidden rounded-ui-lg border border-border bg-surface shadow-sm">
      <div class="border-b border-border p-4 sm:p-5">
        <label class="relative block max-w-md">
          <span class="sr-only">Search categories</span>
          <svg class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input v-model="search" type="search" placeholder="Search by name or slug..." class="min-h-11 w-full rounded-ui-md border border-border bg-bg py-2.5 pl-11 pr-4 text-sm text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15">
        </label>
      </div>

      <div v-if="loading" class="space-y-3 p-5" aria-label="Loading categories">
        <div v-for="item in 4" :key="item" class="h-16 animate-pulse rounded-ui-md bg-bg-alt motion-reduce:animate-none" />
      </div>

      <div v-else-if="!filteredCategories.length" class="px-6 py-16 text-center">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 0 0-2-2h-5.5a2 2 0 0 0-1.4.58L4.58 11.1a2 2 0 0 0 0 2.82l5.5 5.5a2 2 0 0 0 2.82 0l6.52-6.52A2 2 0 0 0 20 13Z" />
          </svg>
        </div>
        <h2 class="mt-4 font-bold text-text-main">{{ search ? 'No matching categories' : 'No categories yet' }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ search ? 'Try a different search term.' : 'Add the first category to organize your products.' }}</p>
      </div>

      <template v-else>
      <div class="divide-y divide-border md:hidden">
        <article v-for="category in filteredCategories" :key="`mobile-${category.id}`" class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><h2 class="truncate font-bold text-text-main">{{ category.name }}</h2><code class="mt-1 block truncate text-xs text-text-muted">{{ category.slug }}</code></div>
            <span class="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{{ category.product_count || 0 }} products</span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-2">
            <button type="button" class="min-h-10 rounded-ui-sm border border-border px-3 py-2 text-xs font-bold text-primary" @click="openEdit(category)">Edit</button>
            <button type="button" class="min-h-10 rounded-ui-sm bg-danger/10 px-3 py-2 text-xs font-bold text-danger disabled:opacity-50" :disabled="deletingId === category.id" @click="removeCategory(category)">Delete</button>
          </div>
        </article>
      </div>
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full min-w-[680px] text-left">
          <thead class="bg-bg-alt/60 text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th class="px-5 py-4 font-bold">Category</th>
              <th class="px-5 py-4 font-bold">Slug</th>
              <th class="px-5 py-4 font-bold">Products</th>
              <th class="px-5 py-4 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="category in filteredCategories" :key="category.id" class="transition hover:bg-bg-alt/35">
              <td class="px-5 py-4">
                <p class="font-bold text-text-main">{{ category.name }}</p>
                <p class="mt-0.5 text-xs text-text-muted">ID {{ category.id }}</p>
              </td>
              <td class="px-5 py-4"><code class="rounded bg-bg-alt px-2 py-1 text-xs text-text-muted">{{ category.slug }}</code></td>
              <td class="px-5 py-4">
                <span class="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{{ category.product_count || 0 }}</span>
              </td>
              <td class="px-5 py-4">
                <div class="flex justify-end gap-2">
                  <button type="button" class="rounded-ui-sm p-2 text-text-muted transition hover:bg-primary/10 hover:text-primary" title="Edit category" @click="openEdit(category)">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.86 3.49a2.1 2.1 0 0 1 2.97 2.97L8.7 17.59 4.5 18.5l.91-4.2L16.86 3.49Z" /></svg>
                    <span class="sr-only">Edit {{ category.name }}</span>
                  </button>
                  <button type="button" class="rounded-ui-sm p-2 text-danger transition hover:bg-danger/10 disabled:cursor-wait disabled:opacity-50" :disabled="deletingId === category.id" title="Delete category" @click="removeCategory(category)">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7 18.1 19a2 2 0 0 1-2 1.85H7.9A2 2 0 0 1 5.9 19L5 7m4 4v6m6-6v6m1-10V4.5A1.5 1.5 0 0 0 14.5 3h-5A1.5 1.5 0 0 0 8 4.5V7M3 7h18" /></svg>
                    <span class="sr-only">Delete {{ category.name }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>
    </section>

    <Teleport to="body">
      <Transition name="category-modal">
        <div v-if="editorOpen" class="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="dialog" aria-modal="true" :aria-label="editorTitle" @click.self="closeEditor">
          <form class="w-full rounded-t-ui-lg border border-border bg-surface p-6 shadow-2xl sm:max-w-lg sm:rounded-ui-lg" @submit.prevent="saveCategory">
            <div class="mb-6 flex items-start justify-between gap-4">
              <div>
                <p class="text-xs font-black uppercase tracking-[0.2em] text-primary">Catalog structure</p>
                <h2 class="mt-1 text-2xl font-extrabold text-text-main">{{ editorTitle }}</h2>
              </div>
              <button type="button" class="rounded-full p-2 text-text-muted transition hover:bg-bg-alt hover:text-text-main" aria-label="Close category editor" @click="closeEditor">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 6 12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div class="space-y-5">
              <label class="block">
                <span class="mb-2 block text-sm font-bold text-text-main">Category name</span>
                <input v-model="form.name" required minlength="2" maxlength="80" autocomplete="off" placeholder="e.g. Graphic Design" class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 py-2.5 text-text-main outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/15">
              </label>
              <label class="block">
                <span class="mb-2 block text-sm font-bold text-text-main">Slug</span>
                <div class="flex min-h-11 items-center rounded-ui-md border border-border bg-bg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <span class="pl-4 text-sm text-text-muted">/category/</span>
                  <input :value="form.slug" required maxlength="80" autocomplete="off" placeholder="graphic-design" class="min-w-0 flex-1 bg-transparent px-1 py-2.5 pr-4 text-sm text-text-main outline-none" @input="handleSlugInput">
                </div>
                <p class="mt-1.5 text-xs text-text-muted">Generated from the name until you edit it manually.</p>
              </label>
            </div>

            <div class="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" class="min-h-11 rounded-ui-md border border-border px-5 py-2.5 font-semibold text-text-main transition hover:bg-bg-alt" :disabled="saving" @click="closeEditor">Cancel</button>
              <button type="submit" class="min-h-11 rounded-ui-md bg-primary px-5 py-2.5 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60" :disabled="saving">
                {{ saving ? 'Saving...' : (editingId ? 'Save changes' : 'Create category') }}
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.category-modal-enter-active,
.category-modal-leave-active {
  transition: opacity 180ms ease;
}

.category-modal-enter-active form,
.category-modal-leave-active form {
  transition: transform 180ms ease, opacity 180ms ease;
}

.category-modal-enter-from,
.category-modal-leave-to {
  opacity: 0;
}

.category-modal-enter-from form,
.category-modal-leave-to form {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}
</style>
