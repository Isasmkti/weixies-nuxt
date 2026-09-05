<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  sAdminHomeCarouselItems,
  sCreateHomeCarouselItem,
  sDeleteHomeCarouselItem,
  sRemoveHomeCarouselImage,
  sUpdateHomeCarouselItem,
  sUploadHomeCarouselImage,
} from '../../services/homeCarouselService'
import { confirmAction } from '../../utils/sweetAlert'

const items = ref([])
const loading = ref(true)
const saving = ref(false)
const uploading = ref(false)
const reordering = ref(false)
const editorOpen = ref(false)
const editingId = ref(null)
const form = ref(blankItem())
const originalImagePath = ref('')
const originalImageUrl = ref('')
const temporaryImagePath = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const inputClass = 'mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15'
const labelClass = 'block text-sm font-bold text-text-main'
const editorTitle = computed(() => editingId.value ? 'Edit carousel item' : 'Create carousel item')

function localDateTime(value = null) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function blankItem() {
  return {
    content_type: 'promo',
    badge: 'Featured Promo',
    title: '',
    description: '',
    image_path: '',
    image_url: '',
    button_label: 'Explore Offer',
    link_url: '/products',
    is_active: true,
    sort_order: items.value?.length || 0,
    published_at: localDateTime(),
    starts_at: '',
    ends_at: '',
  }
}

function editShape(item) {
  return {
    ...item,
    published_at: localDateTime(item.published_at),
    starts_at: item.starts_at ? localDateTime(item.starts_at) : '',
    ends_at: item.ends_at ? localDateTime(item.ends_at) : '',
  }
}

function clearMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

async function loadItems() {
  loading.value = true
  clearMessages()
  try {
    items.value = await sAdminHomeCarouselItems()
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load home carousel items. Make sure migration 0025 has been applied.'
  } finally {
    loading.value = false
  }
}

async function discardTemporaryImage() {
  if (!temporaryImagePath.value) return
  const discardedPath = temporaryImagePath.value
  try {
    await sRemoveHomeCarouselImage(discardedPath)
  } catch (error) {
    console.warn('[Home carousel] Temporary image cleanup failed.', error)
  }
  temporaryImagePath.value = ''
  if (form.value.image_path === discardedPath) {
    form.value.image_path = originalImagePath.value
    form.value.image_url = originalImageUrl.value
  }
}

async function openCreate() {
  await discardTemporaryImage()
  editingId.value = null
  originalImagePath.value = ''
  originalImageUrl.value = ''
  form.value = blankItem()
  editorOpen.value = true
  clearMessages()
}

async function openEdit(item) {
  await discardTemporaryImage()
  editingId.value = item.id
  originalImagePath.value = item.image_path || ''
  originalImageUrl.value = item.image_url || ''
  form.value = editShape(item)
  editorOpen.value = true
  clearMessages()
}

async function closeEditor() {
  await discardTemporaryImage()
  editorOpen.value = false
  editingId.value = null
  originalImagePath.value = ''
  originalImageUrl.value = ''
  form.value = blankItem()
}

async function uploadImage(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploading.value = true
  clearMessages()
  try {
    await discardTemporaryImage()
    const uploaded = await sUploadHomeCarouselImage(file)
    temporaryImagePath.value = uploaded.image_path
    form.value.image_path = uploaded.image_path
    form.value.image_url = uploaded.image_url
  } catch (error) {
    errorMessage.value = error.message || 'Failed to upload carousel image.'
  } finally {
    uploading.value = false
  }
}

async function saveItem() {
  saving.value = true
  clearMessages()
  try {
    const saved = editingId.value
      ? await sUpdateHomeCarouselItem(editingId.value, form.value)
      : await sCreateHomeCarouselItem(form.value)

    if (editingId.value && originalImagePath.value && originalImagePath.value !== saved.image_path) {
      try {
        await sRemoveHomeCarouselImage(originalImagePath.value)
      } catch (error) {
        console.warn('[Home carousel] Previous image cleanup failed.', error)
      }
    }

    temporaryImagePath.value = ''
    const existingIndex = items.value.findIndex((item) => item.id === saved.id)
    if (existingIndex >= 0) items.value.splice(existingIndex, 1, saved)
    else items.value.push(saved)
    items.value.sort((a, b) => a.sort_order - b.sort_order)

    editorOpen.value = false
    editingId.value = null
    originalImagePath.value = ''
    originalImageUrl.value = ''
    successMessage.value = 'Carousel item has been saved.'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to save carousel item.'
  } finally {
    saving.value = false
  }
}

async function removeItem(item) {
  const confirmed = await confirmAction({
    title: 'Delete carousel item?',
    text: `“${item.title}” and its stored image will be removed.`,
    confirmButtonText: 'Delete item',
    confirmButtonColor: 'rgb(var(--color-danger))',
  })
  if (!confirmed) return
  clearMessages()
  try {
    await sDeleteHomeCarouselItem(item)
    items.value = items.value.filter((entry) => entry.id !== item.id)
    successMessage.value = 'Carousel item has been deleted.'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to delete carousel item.'
  }
}

async function toggleActive(item) {
  clearMessages()
  try {
    const updated = await sUpdateHomeCarouselItem(item.id, { ...item, is_active: !item.is_active })
    Object.assign(item, updated)
    successMessage.value = updated.is_active ? 'Item is now visible on Home.' : 'Item has been hidden from Home.'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to update visibility.'
  }
}

async function moveItem(index, offset) {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= items.value.length || reordering.value) return

  reordering.value = true
  clearMessages()
  const reordered = [...items.value]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(targetIndex, 0, moved)
  const previous = items.value
  items.value = reordered.map((item, sortIndex) => ({ ...item, sort_order: sortIndex }))

  try {
    const saved = await Promise.all(items.value.map((item) => sUpdateHomeCarouselItem(item.id, item)))
    items.value = saved.sort((a, b) => a.sort_order - b.sort_order)
    successMessage.value = 'Carousel order has been updated.'
  } catch (error) {
    items.value = previous
    errorMessage.value = error.message || 'Failed to update carousel order.'
  } finally {
    reordering.value = false
  }
}

function formatDate(value) {
  if (!value) return 'No schedule'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

onMounted(loadItems)
</script>

<template>
  <div class="mx-auto max-w-7xl font-poppins">
    <header class="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.25em] text-primary">Content management</p>
        <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Home Carousel</h1>
        <p class="mt-2 max-w-2xl font-montserrat text-text-muted">Publish promotional campaigns and marketplace news in the automatic Home carousel.</p>
      </div>
      <div class="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:flex-wrap">
        <NuxtLink to="/" target="_blank" class="text-center rounded-xl border border-bg-alt bg-surface px-3 py-3 text-sm font-bold text-text-main transition hover:border-primary/30 hover:text-primary sm:px-5">Preview Home</NuxtLink>
        <button type="button" class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark sm:px-5" @click="openCreate">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14" /></svg>
          Add Item
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-600 dark:text-red-300">{{ errorMessage }}</div>
    <div v-if="successMessage" class="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{{ successMessage }}</div>

    <section v-if="editorOpen" class="mb-8 overflow-hidden rounded-3xl border border-primary/20 bg-surface shadow-xl shadow-primary/5">
      <div class="flex items-center justify-between border-b border-bg-alt px-4 py-4 sm:px-6 sm:py-5">
        <div>
          <p class="text-xs font-black uppercase tracking-[0.18em] text-primary">Editor</p>
          <h2 class="mt-1 text-xl font-black text-text-main">{{ editorTitle }}</h2>
        </div>
        <button type="button" class="flex h-10 w-10 items-center justify-center rounded-xl text-text-muted transition hover:bg-bg hover:text-text-main" aria-label="Close editor" @click="closeEditor">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form class="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]" @submit.prevent="saveItem">
        <div class="space-y-5">
          <div class="grid gap-5 sm:grid-cols-2">
            <label :class="labelClass">Content type<select v-model="form.content_type" :class="inputClass"><option value="promo">Promotion</option><option value="news">News</option></select></label>
            <label :class="labelClass">Badge<input v-model="form.badge" maxlength="60" placeholder="Featured Promo" :class="inputClass"></label>
          </div>
          <label :class="labelClass">Title<input v-model="form.title" required maxlength="120" placeholder="Campaign or news headline" :class="inputClass"></label>
          <label :class="labelClass">Description<textarea v-model="form.description" rows="3" maxlength="320" placeholder="A short summary displayed over the image." :class="inputClass"></textarea></label>
          <div class="grid gap-5 sm:grid-cols-2">
            <label :class="labelClass">Button label<input v-model="form.button_label" required maxlength="40" :class="inputClass"></label>
            <label :class="labelClass">Destination URL<input v-model="form.link_url" required placeholder="/products or https://..." :class="inputClass"></label>
          </div>
          <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <label :class="labelClass">Published at<input v-model="form.published_at" type="datetime-local" required :class="inputClass"></label>
            <label :class="labelClass">Start showing<input v-model="form.starts_at" type="datetime-local" :class="inputClass"></label>
            <label :class="labelClass">Stop showing<input v-model="form.ends_at" type="datetime-local" :class="inputClass"></label>
          </div>
          <div class="flex flex-wrap items-center gap-5">
            <label class="flex items-center gap-3 text-sm font-bold text-text-main"><input v-model="form.is_active" type="checkbox" class="h-5 w-5 rounded border-bg-alt text-primary focus:ring-primary">Visible on Home</label>
            <label class="flex items-center gap-3 text-sm font-bold text-text-main">Order<input v-model.number="form.sort_order" type="number" min="0" class="w-24 rounded-xl border border-bg-alt bg-bg px-3 py-2 text-text-main outline-none focus:border-primary"></label>
          </div>
        </div>

        <div>
          <p class="text-sm font-bold text-text-main">Carousel image</p>
          <div class="mt-2 aspect-[16/10] overflow-hidden rounded-2xl border border-dashed border-bg-alt bg-bg">
            <img v-if="form.image_url" :src="form.image_url" :alt="form.title || 'Carousel preview'" class="h-full w-full object-cover">
            <div v-else class="flex h-full flex-col items-center justify-center px-6 text-center text-text-muted">
              <svg class="h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.5M3 16.5l4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.4-1.4a2 2 0 0 1 2.8 0l3.8 3.8M8.5 8.5h.01" /></svg>
              <p class="mt-3 text-xs leading-5">Use a landscape image, ideally 1600 × 700 px.</p>
            </div>
          </div>
          <label class="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-bg-alt bg-bg px-4 py-3 text-sm font-bold text-primary transition hover:border-primary/30 hover:bg-primary/5">
            {{ uploading ? 'Uploading...' : (form.image_url ? 'Replace image' : 'Upload image') }}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" :disabled="uploading" @change="uploadImage">
          </label>
          <p class="mt-2 text-xs leading-5 text-text-muted">JPG, PNG, WEBP, or GIF. Maximum 5 MB. Images are stored in the <code>home-carousel</code> bucket.</p>

          <div class="mt-6 flex gap-3">
            <button type="button" class="flex-1 rounded-xl border border-bg-alt px-4 py-3 text-sm font-bold text-text-muted transition hover:text-text-main" @click="closeEditor">Cancel</button>
            <button type="submit" :disabled="saving || uploading" class="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60">{{ saving ? 'Saving...' : 'Save Item' }}</button>
          </div>
        </div>
      </form>
    </section>

    <div v-if="loading" class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="index in 3" :key="index" class="h-80 animate-pulse rounded-3xl border border-bg-alt bg-surface"><div class="h-44 rounded-t-3xl bg-bg-alt"></div></div>
    </div>

    <div v-else-if="!items.length" class="rounded-3xl border border-dashed border-bg-alt bg-surface px-6 py-20 text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><svg class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M3 16.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.5M3 16.5l4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.4-1.4a2 2 0 0 1 2.8 0l3.8 3.8" /></svg></div>
      <h2 class="mt-5 text-xl font-black text-text-main">No carousel items yet</h2>
      <p class="mt-2 text-sm text-text-muted">Create your first promotion or marketplace news story.</p>
      <button type="button" class="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white" @click="openCreate">Create First Item</button>
    </div>

    <div v-else class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="(item, index) in items" :key="item.id" class="group overflow-hidden rounded-3xl border border-bg-alt bg-surface shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        <div class="relative aspect-[16/9] overflow-hidden bg-bg-alt">
          <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
          <div v-else class="flex h-full items-center justify-center bg-gradient-to-br from-primary/80 to-primary-dark text-white/70"><svg class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.5M3 16.5l4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.4-1.4a2 2 0 0 1 2.8 0l3.8 3.8" /></svg></div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10"></div>
          <div class="absolute left-4 top-4 flex gap-2">
            <span class="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-900">{{ item.content_type }}</span>
            <span :class="item.is_active ? 'bg-emerald-500 text-white' : 'bg-gray-800/80 text-white/80'" class="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">{{ item.is_active ? 'Visible' : 'Hidden' }}</span>
          </div>
          <p class="absolute bottom-4 left-4 right-4 line-clamp-2 text-lg font-black leading-snug text-white">{{ item.title }}</p>
        </div>
        <div class="p-5">
          <p class="line-clamp-2 min-h-10 text-sm leading-5 text-text-muted">{{ item.description || 'No description provided.' }}</p>
          <dl class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-xl bg-bg p-3"><dt class="font-bold text-text-muted">Order</dt><dd class="mt-1 font-black text-text-main">#{{ index + 1 }}</dd></div>
            <div class="rounded-xl bg-bg p-3"><dt class="font-bold text-text-muted">Published</dt><dd class="mt-1 truncate font-black text-text-main">{{ formatDate(item.published_at) }}</dd></div>
          </dl>
          <div class="mt-5 flex items-center justify-between gap-2 border-t border-bg-alt pt-4">
            <div class="flex gap-1">
              <button type="button" :disabled="index === 0 || reordering" class="flex h-9 w-9 items-center justify-center rounded-lg border border-bg-alt text-text-muted transition hover:text-primary disabled:opacity-30" aria-label="Move item earlier" @click="moveItem(index, -1)"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m18 15-6-6-6 6" /></svg></button>
              <button type="button" :disabled="index === items.length - 1 || reordering" class="flex h-9 w-9 items-center justify-center rounded-lg border border-bg-alt text-text-muted transition hover:text-primary disabled:opacity-30" aria-label="Move item later" @click="moveItem(index, 1)"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg></button>
            </div>
            <div class="flex gap-2">
              <button type="button" class="rounded-lg border border-bg-alt px-3 py-2 text-xs font-bold text-text-muted transition hover:text-text-main" @click="toggleActive(item)">{{ item.is_active ? 'Hide' : 'Show' }}</button>
              <button type="button" class="rounded-lg bg-primary/10 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/15" @click="openEdit(item)">Edit</button>
              <button type="button" class="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-500/15" @click="removeItem(item)">Delete</button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
