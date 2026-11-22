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

const inputClass = 'mt-2 min-h-11 w-full rounded-ui-sm border border-border bg-bg px-3 py-2.5 text-sm text-text-main outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15'
const labelClass = 'block text-sm font-medium text-text-main'
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
    <header class="mb-7 flex flex-col gap-5 border-b border-border pb-6 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-primary">Content management</p>
        <h1 class="mt-1 text-3xl font-semibold tracking-tight text-text-main sm:text-4xl">Home Carousel</h1>
        <p class="mt-2 max-w-2xl text-sm leading-6 text-text-muted">Manage the promotions and marketplace news shown on your home page.</p>
      </div>
      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <NuxtLink to="/" target="_blank" class="inline-flex min-h-11 items-center justify-center rounded-ui-sm border border-border bg-surface px-4 text-sm font-semibold text-text-main transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Preview Home</NuxtLink>
        <button type="button" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-ui-sm bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" @click="openCreate">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14M5 12h14" /></svg>
          Add Item
        </button>
      </div>
    </header>

    <p v-if="errorMessage" role="alert" class="mb-5 rounded-ui-sm border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">{{ errorMessage }}</p>
    <p v-if="successMessage" role="status" class="mb-5 rounded-ui-sm border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">{{ successMessage }}</p>

    <section v-if="editorOpen" aria-labelledby="editor-heading" class="mb-8 overflow-hidden rounded-ui-md border border-border bg-surface">
      <div class="flex items-center justify-between border-b border-border px-4 py-4 sm:px-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">Carousel content</p>
          <h2 id="editor-heading" class="mt-1 text-xl font-semibold text-text-main">{{ editorTitle }}</h2>
        </div>
        <button type="button" class="flex h-10 w-10 items-center justify-center rounded-ui-sm text-text-muted transition hover:bg-bg hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Close editor" @click="closeEditor">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <form class="grid gap-7 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]" @submit.prevent="saveItem">
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
          <div class="flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-border pt-5">
            <label class="flex min-h-11 items-center gap-3 text-sm font-medium text-text-main"><input v-model="form.is_active" type="checkbox" class="h-4 w-4 rounded border-border text-primary focus:ring-primary">Visible on Home</label>
            <label class="flex min-h-11 items-center gap-3 text-sm font-medium text-text-main">Order<input v-model.number="form.sort_order" type="number" min="0" class="min-h-10 w-24 rounded-ui-sm border border-border bg-bg px-3 text-sm text-text-main outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15"></label>
          </div>
        </div>

        <div class="min-w-0">
          <p class="text-sm font-medium text-text-main">Carousel image</p>
          <div class="mt-2 aspect-[16/10] overflow-hidden rounded-ui-sm border border-border bg-bg">
            <img v-if="form.image_url" :src="form.image_url" :alt="form.title || 'Carousel preview'" class="h-full w-full object-cover">
            <div v-else class="flex h-full flex-col items-center justify-center px-6 text-center text-text-muted">
              <svg class="h-9 w-9 text-text-muted/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.5M3 16.5l4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.4-1.4a2 2 0 0 1 2.8 0l3.8 3.8M8.5 8.5h.01" /></svg>
              <p class="mt-3 text-xs leading-5">Use a landscape image, ideally 1600 × 700 px.</p>
            </div>
          </div>
          <label class="mt-3 flex min-h-11 cursor-pointer items-center justify-center rounded-ui-sm border border-border bg-surface px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/40">
            {{ uploading ? 'Uploading...' : (form.image_url ? 'Replace image' : 'Upload image') }}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="sr-only" :disabled="uploading" @change="uploadImage">
          </label>
          <p class="mt-2 text-xs leading-5 text-text-muted">JPG, PNG, WEBP, or GIF. Maximum 5 MB. Images are stored in the <code>home-carousel</code> bucket.</p>

          <div class="mt-6 flex flex-col gap-2 sm:flex-row lg:flex-col">
            <button type="submit" :disabled="saving || uploading" class="min-h-11 flex-1 rounded-ui-sm bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{{ saving ? 'Saving...' : 'Save Item' }}</button>
            <button type="button" class="min-h-11 flex-1 rounded-ui-sm border border-border px-4 text-sm font-semibold text-text-muted transition hover:bg-bg hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" @click="closeEditor">Cancel</button>
          </div>
        </div>
      </form>
    </section>

    <div v-if="loading" aria-label="Loading carousel items" class="divide-y divide-border rounded-ui-md border border-border bg-surface">
      <div v-for="index in 3" :key="index" class="flex animate-pulse items-center gap-4 p-4 motion-reduce:animate-none sm:p-5">
        <div class="h-16 w-20 shrink-0 rounded-ui-sm bg-bg-alt sm:h-20 sm:w-28"></div>
        <div class="min-w-0 flex-1 space-y-3"><div class="h-3 w-28 rounded bg-bg-alt"></div><div class="h-4 max-w-sm rounded bg-bg-alt"></div><div class="h-3 max-w-xs rounded bg-bg-alt"></div></div>
      </div>
    </div>

    <section v-else-if="!items.length" aria-labelledby="empty-heading" class="rounded-ui-md border border-border bg-surface px-5 py-12 text-center sm:px-8">
      <h2 id="empty-heading" class="text-lg font-semibold text-text-main">No carousel items yet</h2>
      <p class="mt-2 text-sm text-text-muted">Create a promotion or news item to feature it on your home page.</p>
      <button type="button" class="mt-5 min-h-11 rounded-ui-sm bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2" @click="openCreate">Create First Item</button>
    </section>

    <section v-else aria-labelledby="items-heading" class="overflow-hidden rounded-ui-md border border-border bg-surface">
      <div class="flex items-baseline justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <h2 id="items-heading" class="text-sm font-semibold text-text-main">Carousel items</h2>
        <p class="text-xs text-text-muted">{{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}</p>
      </div>
      <div class="divide-y divide-border">
        <article v-for="(item, index) in items" :key="item.id" class="grid grid-cols-[72px_minmax(0,1fr)] gap-x-4 gap-y-4 p-4 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-x-5 sm:p-5 lg:grid-cols-[112px_minmax(0,1fr)_minmax(150px,190px)_auto] lg:items-center">
          <div class="aspect-[4/3] overflow-hidden rounded-ui-sm bg-bg-alt">
            <img v-if="item.image_url" :src="item.image_url" :alt="item.title" class="h-full w-full object-cover">
            <div v-else class="flex h-full items-center justify-center text-text-muted">
              <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10.5M3 16.5l4.8-4.8a2 2 0 0 1 2.8 0l2.4 2.4 1.4-1.4a2 2 0 0 1 2.8 0l3.8 3.8" /></svg>
            </div>
          </div>

          <div class="min-w-0 self-center">
            <div class="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span class="font-semibold uppercase tracking-wide text-text-muted">{{ item.content_type }}</span>
              <span class="inline-flex items-center gap-1.5" :class="item.is_active ? 'text-success' : 'text-text-muted'">
                <span class="h-1.5 w-1.5 rounded-full" :class="item.is_active ? 'bg-success' : 'bg-text-muted/60'"></span>
                {{ item.is_active ? 'Visible' : 'Hidden' }}
              </span>
            </div>
            <h3 class="truncate text-base font-semibold leading-6 text-text-main">{{ item.title }}</h3>
            <p class="mt-1 line-clamp-2 text-sm leading-5 text-text-muted">{{ item.description || 'No description provided.' }}</p>
          </div>

          <dl class="col-span-2 grid grid-cols-2 gap-x-4 text-xs sm:col-span-1 sm:col-start-2 lg:col-start-auto lg:block lg:space-y-2">
            <div><dt class="text-text-muted">Position</dt><dd class="mt-0.5 font-medium tabular-nums text-text-main">{{ index + 1 }} of {{ items.length }}</dd></div>
            <div class="min-w-0"><dt class="text-text-muted">Published</dt><dd class="mt-0.5 truncate font-medium text-text-main">{{ formatDate(item.published_at) }}</dd></div>
          </dl>

          <div class="col-span-2 flex items-center justify-between gap-3 border-t border-border pt-3 sm:col-span-1 sm:col-start-3 sm:row-start-2 sm:border-0 sm:pt-0 lg:col-auto lg:row-auto">
            <div class="flex gap-1">
              <button type="button" :disabled="index === 0 || reordering" class="flex h-10 w-10 items-center justify-center rounded-ui-sm border border-border text-text-muted transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Move item earlier" @click="moveItem(index, -1)"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m18 15-6-6-6 6" /></svg></button>
              <button type="button" :disabled="index === items.length - 1 || reordering" class="flex h-10 w-10 items-center justify-center rounded-ui-sm border border-border text-text-muted transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Move item later" @click="moveItem(index, 1)"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg></button>
            </div>
            <div class="flex gap-2">
              <button type="button" class="min-h-10 rounded-ui-sm border border-border px-3 text-xs font-semibold text-text-main transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" @click="toggleActive(item)">{{ item.is_active ? 'Hide' : 'Show' }}</button>
              <button type="button" class="min-h-10 rounded-ui-sm px-3 text-xs font-semibold text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" @click="openEdit(item)">Edit</button>
              <button type="button" class="min-h-10 rounded-ui-sm px-3 text-xs font-semibold text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/40" @click="removeItem(item)">Delete</button>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
