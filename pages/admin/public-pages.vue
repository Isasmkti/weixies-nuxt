<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createAdminPublicPage,
  deleteAdminPublicPage,
  getAdminPublicPages,
  updateAdminPublicPage,
} from '../../services/adminPublicPagesService'
import { confirmAction, showErrorDialog, showSuccess } from '../../utils/sweetAlert'
import {
  CONTACT_DETAIL_TYPES,
  PUBLIC_PAGE_TYPES,
  getPublicPageTemplate,
  guidanceForSection,
} from '../../utils/publicPageTemplates'

const pages = ref([])
const loading = ref(true)
const saving = ref(false)
const deletingId = ref(null)
const editorOpen = ref(false)
const editingId = ref(null)
const search = ref('')
const statusFilter = ref('all')

const blankForm = () => ({
  path: '/help/', page_type: 'general', title: '', eyebrow: '', summary: '', effective_date: '',
  contact_details: [], seo_title: '', seo_description: '', status: 'draft',
  sections: getPublicPageTemplate('general'),
})
const form = reactive(blankForm())

const filteredPages = computed(() => {
  const query = search.value.trim().toLowerCase()
  return pages.value.filter(page => {
    const matchesStatus = statusFilter.value === 'all' || page.status === statusFilter.value
    const matchesQuery = !query || `${page.title} ${page.path}`.toLowerCase().includes(query)
    return matchesStatus && matchesQuery
  })
})
const publishedCount = computed(() => pages.value.filter(page => page.status === 'published').length)
const draftCount = computed(() => pages.value.length - publishedCount.value)

const errorText = (error, fallback) => error?.data?.statusMessage || error?.statusMessage || error?.message || fallback
const formatDate = value => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not published'

function resetForm() {
  Object.assign(form, blankForm())
  editingId.value = null
}
function openCreate() {
  resetForm()
  editorOpen.value = true
}
function openEdit(page) {
  editingId.value = page.id
  Object.assign(form, {
    path: page.path, page_type: page.page_type || 'general', title: page.title, eyebrow: page.eyebrow || '', summary: page.summary || '',
    effective_date: page.effective_date || '', contact_details: (page.contact_details || []).map(detail => ({ ...detail })),
    seo_title: page.seo_title || '', seo_description: page.seo_description || '', status: page.status,
    sections: (page.sections || []).map(section => ({ ...section, guidance: guidanceForSection(page.page_type, section.heading) })),
  })
  if (!form.sections.length) form.sections.push({ heading: '', body: '' })
  editorOpen.value = true
}
function closeEditor() {
  if (saving.value) return
  editorOpen.value = false
  resetForm()
}
function addSection() {
  form.sections.push({ heading: '', body: '', guidance: 'Add the verified information visitors need in this section.' })
}
function addContactDetail() {
  form.contact_details.push({ type: 'email', label: '', value: '' })
}
function removeContactDetail(index) {
  form.contact_details.splice(index, 1)
}
function useSuggestedPath() {
  form.path = PUBLIC_PAGE_TYPES.find(type => type.value === form.page_type)?.path || '/help/page-name'
}
async function loadSectionGuide() {
  const hasWrittenContent = form.sections.some(section => section.body)
  if (hasWrittenContent) {
    const confirmed = await confirmAction({
      title: 'Replace current sections?',
      text: 'This replaces the section editor with the suggested structure. Your current section text will be removed.',
      confirmButtonText: 'Load structure',
    })
    if (!confirmed) return
  }
  form.sections = getPublicPageTemplate(form.page_type)
}
function removeSection(index) {
  if (form.sections.length === 1) Object.assign(form.sections[0], { heading: '', body: '' })
  else form.sections.splice(index, 1)
}
function moveSection(index, direction) {
  const target = index + direction
  if (target < 0 || target >= form.sections.length) return
  const [section] = form.sections.splice(index, 1)
  form.sections.splice(target, 0, section)
}

async function savePage(status) {
  saving.value = true
  let savedSuccessfully = false
  try {
    const payload = {
      ...form,
      status,
      sections: form.sections.map(({ heading, body }) => ({ heading, body })),
      contact_details: form.contact_details.map(detail => ({ ...detail })),
    }
    const saved = editingId.value
      ? await updateAdminPublicPage(editingId.value, payload)
      : await createAdminPublicPage(payload)
    pages.value = editingId.value
      ? pages.value.map(page => page.id === editingId.value ? saved : page)
      : [saved, ...pages.value]
    await showSuccess(status === 'published' ? 'Page published' : 'Draft saved', status === 'published' ? `${saved.path} is now public.` : 'The page remains hidden from visitors.')
    savedSuccessfully = true
  } catch (error) {
    await showErrorDialog('Page could not be saved', errorText(error, 'Check the fields and try again.'))
  } finally {
    saving.value = false
  }
  if (savedSuccessfully) closeEditor()
}

async function removePage(page) {
  const confirmed = await confirmAction({
    title: 'Delete public page?',
    text: `${page.title} (${page.path}) will be permanently removed.`,
    confirmButtonText: 'Delete page',
    confirmButtonColor: 'rgb(var(--color-danger))',
  })
  if (!confirmed) return
  deletingId.value = page.id
  try {
    await deleteAdminPublicPage(page.id)
    pages.value = pages.value.filter(item => item.id !== page.id)
    await showSuccess('Page deleted', 'The public page has been removed.')
  } catch (error) {
    await showErrorDialog('Page could not be deleted', errorText(error, 'Please try again.'))
  } finally {
    deletingId.value = null
  }
}

async function loadPages() {
  loading.value = true
  try { pages.value = await getAdminPublicPages() }
  catch (error) { await showErrorDialog('Public pages could not be loaded', errorText(error, 'Refresh and try again.')) }
  finally { loading.value = false }
}

onMounted(loadPages)
</script>

<template>
  <div class="mx-auto w-full max-w-[1600px] font-poppins">
    <header class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="mb-2 text-xs font-black uppercase tracking-[0.22em] text-primary">Content management</p>
        <h1 class="text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Public Pages</h1>
        <p class="mt-2 max-w-2xl font-montserrat text-sm text-text-muted">Author help, company, contact, and legal pages. Nothing is generated or published automatically.</p>
      </div>
      <button type="button" class="inline-flex min-h-11 items-center justify-center gap-2 rounded-ui-md bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark" @click="openCreate">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Create page
      </button>
    </header>

    <section class="mb-6 grid gap-3 sm:grid-cols-3">
      <article class="rounded-ui-lg border border-border bg-surface p-5"><p class="text-xs font-bold uppercase tracking-wider text-text-muted">All pages</p><p class="mt-2 text-3xl font-extrabold text-text-main">{{ pages.length }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5"><p class="text-xs font-bold uppercase tracking-wider text-text-muted">Published</p><p class="mt-2 text-3xl font-extrabold text-primary">{{ publishedCount }}</p></article>
      <article class="rounded-ui-lg border border-border bg-surface p-5"><p class="text-xs font-bold uppercase tracking-wider text-text-muted">Drafts</p><p class="mt-2 text-3xl font-extrabold text-text-main">{{ draftCount }}</p></article>
    </section>

    <section class="overflow-hidden rounded-ui-lg border border-border bg-surface shadow-sm">
      <div class="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:p-5">
        <input v-model="search" type="search" placeholder="Search title or path..." class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:max-w-md">
        <select v-model="statusFilter" class="min-h-11 rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary">
          <option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option>
        </select>
      </div>
      <div v-if="loading" class="space-y-3 p-5"><div v-for="item in 4" :key="item" class="h-16 animate-pulse rounded-ui-md bg-bg-alt" /></div>
      <div v-else-if="!filteredPages.length" class="px-6 py-16 text-center"><h2 class="font-bold text-text-main">No public pages found</h2><p class="mt-1 text-sm text-text-muted">Create a draft when your approved content is ready.</p></div>
      <div v-else class="divide-y divide-border">
        <article v-for="page in filteredPages" :key="page.id" class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2"><h2 class="font-bold text-text-main">{{ page.title }}</h2><span :class="['rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', page.status === 'published' ? 'bg-primary/10 text-primary' : 'bg-bg-alt text-text-muted']">{{ page.status }}</span></div>
            <code class="mt-1 block text-xs text-text-muted">{{ page.path }}</code>
            <p class="mt-1 text-xs text-text-muted">Updated {{ formatDate(page.updated_at) }}</p>
          </div>
          <div class="grid grid-cols-3 gap-2 sm:flex">
            <NuxtLink v-if="page.status === 'published'" :to="page.path" target="_blank" class="min-h-10 rounded-ui-sm border border-border px-3 py-2 text-center text-xs font-bold text-text-main">View</NuxtLink>
            <button type="button" class="min-h-10 rounded-ui-sm border border-border px-3 py-2 text-xs font-bold text-primary" @click="openEdit(page)">Edit</button>
            <button type="button" class="min-h-10 rounded-ui-sm bg-danger/10 px-3 py-2 text-xs font-bold text-danger disabled:opacity-50" :disabled="deletingId === page.id" @click="removePage(page)">Delete</button>
          </div>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="editorOpen" class="fixed inset-0 z-[100] overflow-y-auto bg-black/45 p-3 sm:p-6" @click.self="closeEditor">
        <section class="mx-auto max-w-5xl rounded-ui-lg border border-border bg-surface shadow-2xl">
          <header class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-4 sm:px-6">
            <div><p class="text-xs font-black uppercase tracking-wider text-primary">{{ editingId ? 'Edit page' : 'New page' }}</p><h2 class="text-xl font-extrabold text-text-main">Page content</h2></div>
            <button type="button" class="rounded-full p-2 text-text-muted hover:bg-bg-alt" aria-label="Close editor" @click="closeEditor"><svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-width="2" d="m6 6 12 12M18 6 6 18" /></svg></button>
          </header>
          <form class="space-y-8 p-4 sm:p-6" @submit.prevent="savePage('draft')">
            <div class="grid gap-5 md:grid-cols-2">
              <label class="space-y-2"><span class="text-sm font-bold text-text-main">Page type *</span><select v-model="form.page_type" class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary"><option v-for="type in PUBLIC_PAGE_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option></select></label>
              <div class="space-y-2"><span class="block text-sm font-bold text-text-main">Editor guide</span><div class="flex flex-wrap gap-2"><button type="button" class="min-h-11 rounded-ui-md border border-border px-3 text-xs font-bold text-text-main hover:border-primary hover:text-primary" @click="useSuggestedPath">Use suggested path</button><button type="button" class="min-h-11 rounded-ui-md bg-primary/10 px-3 text-xs font-bold text-primary" @click="loadSectionGuide">Load section guide</button></div></div>
              <label class="space-y-2"><span class="text-sm font-bold text-text-main">Public path *</span><input v-model="form.path" list="public-page-paths" required placeholder="/legal/terms" class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary"><datalist id="public-page-paths"><option value="/about" /><option value="/contact" /><option value="/help" /><option value="/help/documentation" /><option value="/help/tutorials" /><option value="/legal/license" /><option value="/legal/refund-policy" /><option value="/legal/privacy-policy" /><option value="/legal/terms" /></datalist><span class="block text-xs text-text-muted">Allowed: /about, /contact, /help, /help/..., /legal/...</span></label>
              <label class="space-y-2"><span class="text-sm font-bold text-text-main">Eyebrow</span><input v-model="form.eyebrow" maxlength="80" placeholder="Help center" class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary"></label>
              <label v-if="form.page_type.startsWith('legal_')" class="space-y-2"><span class="text-sm font-bold text-text-main">Effective date *</span><input v-model="form.effective_date" type="date" required class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary"><span class="block text-xs text-text-muted">Required before a legal page can be published.</span></label>
              <label class="space-y-2 md:col-span-2"><span class="text-sm font-bold text-text-main">Title *</span><input v-model="form.title" required minlength="3" maxlength="160" class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-text-main outline-none focus:border-primary"></label>
              <label class="space-y-2 md:col-span-2"><span class="text-sm font-bold text-text-main">Summary</span><textarea v-model="form.summary" maxlength="600" rows="3" class="w-full rounded-ui-md border border-border bg-bg px-4 py-3 text-sm text-text-main outline-none focus:border-primary" /></label>
            </div>

            <div>
              <div class="mb-4 flex items-center justify-between"><div><h3 class="font-extrabold text-text-main">Content sections</h3><p class="text-xs text-text-muted">Plain text only; line breaks are preserved.</p></div><button type="button" class="rounded-ui-sm bg-primary/10 px-3 py-2 text-xs font-bold text-primary" @click="addSection">Add section</button></div>
              <div v-if="form.page_type.startsWith('legal_')" class="mb-4 rounded-ui-md border border-amber-300/60 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <strong>Legal review required.</strong> The guide only lists topics to address. It is not legal advice and does not create policy text for Weixies.
              </div>
              <div class="space-y-4">
                <article v-for="(section, index) in form.sections" :key="index" class="rounded-ui-md border border-border bg-bg p-4">
                  <div class="mb-3 flex items-center justify-between"><span class="text-xs font-black uppercase tracking-wider text-text-muted">Section {{ index + 1 }}</span><div class="flex gap-1"><button type="button" class="p-2 text-text-muted disabled:opacity-30" :disabled="index === 0" aria-label="Move up" @click="moveSection(index, -1)">↑</button><button type="button" class="p-2 text-text-muted disabled:opacity-30" :disabled="index === form.sections.length - 1" aria-label="Move down" @click="moveSection(index, 1)">↓</button><button type="button" class="p-2 text-danger" aria-label="Remove section" @click="removeSection(index)">×</button></div></div>
                  <input v-model="section.heading" maxlength="160" placeholder="Section heading" class="mb-3 min-h-11 w-full rounded-ui-sm border border-border bg-surface px-4 text-sm font-bold text-text-main outline-none focus:border-primary">
                  <textarea v-model="section.body" maxlength="20000" rows="7" placeholder="Write the approved content here..." class="w-full rounded-ui-sm border border-border bg-surface px-4 py-3 text-sm leading-7 text-text-main outline-none focus:border-primary" />
                  <p v-if="section.guidance" class="mt-2 rounded-ui-sm bg-primary/5 px-3 py-2 text-xs leading-5 text-text-muted"><strong class="text-primary">What to include:</strong> {{ section.guidance }}</p>
                </article>
              </div>
            </div>

            <div>
              <div class="mb-4 flex items-center justify-between"><div><h3 class="font-extrabold text-text-main">Contact and business details</h3><p class="text-xs text-text-muted">Optional structured facts such as support email, phone, address, service hours, or an external URL.</p></div><button type="button" class="rounded-ui-sm bg-primary/10 px-3 py-2 text-xs font-bold text-primary" @click="addContactDetail">Add detail</button></div>
              <div v-if="!form.contact_details.length" class="rounded-ui-md border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">No contact details added.</div>
              <div v-else class="space-y-3">
                <article v-for="(detail, index) in form.contact_details" :key="index" class="grid gap-3 rounded-ui-md border border-border bg-bg p-4 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.5fr)_44px]">
                  <select v-model="detail.type" class="min-h-11 rounded-ui-sm border border-border bg-surface px-3 text-sm text-text-main outline-none focus:border-primary"><option v-for="type in CONTACT_DETAIL_TYPES" :key="type.value" :value="type.value">{{ type.label }}</option></select>
                  <input v-model="detail.label" maxlength="80" placeholder="Label, e.g. Buyer support" class="min-h-11 rounded-ui-sm border border-border bg-surface px-3 text-sm text-text-main outline-none focus:border-primary">
                  <textarea v-if="detail.type === 'address'" v-model="detail.value" maxlength="500" rows="2" placeholder="Complete address" class="rounded-ui-sm border border-border bg-surface px-3 py-2 text-sm text-text-main outline-none focus:border-primary" />
                  <input v-else v-model="detail.value" :type="detail.type === 'email' ? 'email' : detail.type === 'url' ? 'url' : 'text'" maxlength="500" :placeholder="detail.type === 'email' ? 'support@example.com' : detail.type === 'url' ? 'https://...' : 'Value'" class="min-h-11 rounded-ui-sm border border-border bg-surface px-3 text-sm text-text-main outline-none focus:border-primary">
                  <button type="button" class="h-11 rounded-ui-sm text-xl text-danger hover:bg-danger/10" aria-label="Remove detail" @click="removeContactDetail(index)">×</button>
                </article>
              </div>
            </div>

            <div class="grid gap-5 border-t border-border pt-6 md:grid-cols-2">
              <label class="space-y-2"><span class="text-sm font-bold text-text-main">SEO title</span><input v-model="form.seo_title" maxlength="70" class="min-h-11 w-full rounded-ui-md border border-border bg-bg px-4 text-sm text-text-main outline-none focus:border-primary"><span class="block text-right text-xs text-text-muted">{{ form.seo_title.length }}/70</span></label>
              <label class="space-y-2"><span class="text-sm font-bold text-text-main">SEO description</span><textarea v-model="form.seo_description" maxlength="160" rows="3" class="w-full rounded-ui-md border border-border bg-bg px-4 py-3 text-sm text-text-main outline-none focus:border-primary" /><span class="block text-right text-xs text-text-muted">{{ form.seo_description.length }}/160</span></label>
            </div>

            <footer class="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button type="button" class="min-h-11 rounded-ui-md border border-border px-5 font-semibold text-text-main" :disabled="saving" @click="closeEditor">Cancel</button>
              <button type="submit" class="min-h-11 rounded-ui-md border border-primary px-5 font-semibold text-primary disabled:opacity-50" :disabled="saving">Save draft</button>
              <button type="button" class="min-h-11 rounded-ui-md bg-primary px-5 font-semibold text-white disabled:opacity-50" :disabled="saving" @click="savePage('published')">{{ saving ? 'Saving...' : 'Publish' }}</button>
            </footer>
          </form>
        </section>
      </div>
    </Teleport>
  </div>
</template>
