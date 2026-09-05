<script setup>
import { onMounted, ref } from 'vue'
import {
  sAll,
  sSaveAll,
  sUploadWelcomeAsset,
} from '../../services/welcomeService'
import {
  cloneWelcomeContent,
  WELCOME_CONTENT_DEFAULTS,
} from '../../utils/welcomeContent'
import { confirmAction } from '../../utils/sweetAlert'

const form = ref(cloneWelcomeContent())
const loading = ref(true)
const saving = ref(false)
const uploading = ref('')
const errorMessage = ref('')
const successMessage = ref('')

const inputClass = 'mt-2 w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 text-text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
const labelClass = 'block text-sm font-bold text-text-main'

const createId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const loadContent = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    form.value = await sAll()
  } catch (error) {
    errorMessage.value = error.message || 'Failed to load welcome content. Make sure migration 0014 has been applied.'
  } finally {
    loading.value = false
  }
}

const saveContent = async () => {
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    form.value = await sSaveAll(form.value)
    successMessage.value = 'Welcome page content has been saved.'
  } catch (error) {
    errorMessage.value = error.message || 'Failed to save welcome content.'
  } finally {
    saving.value = false
  }
}

const uploadImage = async (event, target, key, folder) => {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  uploading.value = folder
  errorMessage.value = ''
  try {
    target[key] = await sUploadWelcomeAsset(file, folder)
  } catch (error) {
    errorMessage.value = error.message || 'Failed to upload image.'
  } finally {
    uploading.value = ''
  }
}

const moveItem = (items, index, offset) => {
  const targetIndex = index + offset
  if (targetIndex < 0 || targetIndex >= items.length) return
  const [item] = items.splice(index, 1)
  items.splice(targetIndex, 0, item)
}

const addFeature = () => {
  form.value.features.items.push({
    id: createId('feature'),
    name: 'New Feature',
    description: '',
    icon: 'globe',
  })
}

const addTestimonial = () => {
  form.value.testimonials.items.push({
    id: createId('testimonial'),
    quote: '',
    image: '',
    author: 'Customer name',
    role: '',
  })
}

const addFooterColumn = () => {
  form.value.footer.columns.push({ title: 'New Column', links: [] })
}

const addFooterLink = (column) => {
  column.links.push({ label: 'New Link', url: '#' })
}

const restoreDefaults = async () => {
  const confirmed = await confirmAction({
    title: 'Restore welcome defaults?',
    text: 'Every editor field will be reset locally. Changes are only published after you save them.',
    confirmButtonText: 'Restore defaults',
  })
  if (!confirmed) return
  form.value = cloneWelcomeContent(WELCOME_CONTENT_DEFAULTS)
  successMessage.value = 'Defaults restored locally. Save changes to publish them.'
}

onMounted(loadContent)
</script>

<template>
  <div class="mx-auto max-w-6xl font-poppins">
    <header class="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.25em] text-primary">Content management</p>
        <h1 class="mt-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Welcome Page</h1>
        <p class="mt-2 max-w-2xl font-montserrat text-text-muted">
          Edit every public welcome section. The product carousel remains connected to the published catalog.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <NuxtLink to="/welcome?preview=1" target="_blank" class="rounded-xl border border-bg-alt bg-surface px-5 py-3 text-sm font-bold text-text-main transition hover:border-primary/30 hover:text-primary">
          Preview
        </NuxtLink>
        <button type="button" class="rounded-xl border border-bg-alt bg-surface px-5 py-3 text-sm font-bold text-text-muted transition hover:text-text-main" @click="restoreDefaults">
          Restore defaults
        </button>
        <button type="button" :disabled="saving || loading" class="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60" @click="saveContent">
          {{ saving ? 'Saving...' : 'Save Changes' }}
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-600 dark:text-red-300">
      {{ errorMessage }}
    </div>
    <div v-if="successMessage" class="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
      {{ successMessage }}
    </div>

    <div v-if="loading" class="flex min-h-[360px] items-center justify-center rounded-3xl border border-bg-alt bg-surface">
      <div class="text-center">
        <span class="mx-auto block h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span>
        <p class="mt-4 font-semibold text-text-muted">Loading welcome content...</p>
      </div>
    </div>

    <form v-else class="space-y-6" @submit.prevent="saveContent">
      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">Navigation</summary>
        <div class="grid gap-5 border-t border-bg-alt p-6 md:grid-cols-2">
          <label :class="labelClass">Brand name<input v-model.trim="form.navbar.brandName" required :class="inputClass"></label>
          <label :class="labelClass">Dashboard label<input v-model.trim="form.navbar.dashboardLabel" required :class="inputClass"></label>
          <label :class="labelClass">Login label<input v-model.trim="form.navbar.loginLabel" required :class="inputClass"></label>
          <label :class="labelClass">Sign-up label<input v-model.trim="form.navbar.signupLabel" required :class="inputClass"></label>
        </div>
      </details>

      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">Hero</summary>
        <div class="space-y-5 border-t border-bg-alt p-6">
          <div class="grid gap-5 md:grid-cols-2">
            <label :class="labelClass">Title<input v-model="form.hero.title" required :class="inputClass"></label>
            <label :class="labelClass">Background image URL<input v-model="form.hero.image" type="url" required :class="inputClass"></label>
          </div>
          <label :class="labelClass">Description<textarea v-model="form.hero.description" rows="3" required :class="inputClass"></textarea></label>
          <div class="flex flex-wrap items-center gap-4">
            <label class="cursor-pointer rounded-xl border border-bg-alt bg-bg px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/30">
              {{ uploading === 'hero' ? 'Uploading...' : 'Upload hero image' }}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" :disabled="Boolean(uploading)" @change="uploadImage($event, form.hero, 'image', 'hero')">
            </label>
            <img v-if="form.hero.image" :src="form.hero.image" alt="Hero preview" class="h-20 w-32 rounded-xl border border-bg-alt object-cover">
          </div>
          <div class="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <label :class="labelClass">Primary label<input v-model="form.hero.primaryLabel" required :class="inputClass"></label>
            <label :class="labelClass">Primary URL<input v-model="form.hero.primaryUrl" required :class="inputClass"></label>
            <label :class="labelClass">Secondary label<input v-model="form.hero.secondaryLabel" required :class="inputClass"></label>
            <label :class="labelClass">Secondary URL<input v-model="form.hero.secondaryUrl" required :class="inputClass"></label>
          </div>
        </div>
      </details>

      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">Features</summary>
        <div class="space-y-6 border-t border-bg-alt p-6">
          <div class="grid gap-5 md:grid-cols-2">
            <label :class="labelClass">Eyebrow<input v-model="form.features.eyebrow" required :class="inputClass"></label>
            <label :class="labelClass">Title<input v-model="form.features.title" required :class="inputClass"></label>
          </div>
          <label :class="labelClass">Description<textarea v-model="form.features.description" rows="2" required :class="inputClass"></textarea></label>

          <div class="space-y-4">
            <article v-for="(feature, index) in form.features.items" :key="feature.id" class="rounded-2xl border border-bg-alt bg-bg/50 p-5">
              <div class="mb-4 flex items-center justify-between gap-3">
                <p class="font-black text-text-main">Feature {{ index + 1 }}</p>
                <div class="flex gap-2">
                  <button type="button" :disabled="index === 0" class="rounded-lg border border-bg-alt px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-30" @click="moveItem(form.features.items, index, -1)">Up</button>
                  <button type="button" :disabled="index === form.features.items.length - 1" class="rounded-lg border border-bg-alt px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-30" @click="moveItem(form.features.items, index, 1)">Down</button>
                  <button type="button" class="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600" @click="form.features.items.splice(index, 1)">Remove</button>
                </div>
              </div>
              <div class="grid gap-4 md:grid-cols-[1fr_180px]">
                <label :class="labelClass">Name<input v-model="feature.name" required :class="inputClass"></label>
                <label :class="labelClass">Icon<select v-model="feature.icon" :class="inputClass"><option value="globe">Globe</option><option value="scale">Scale</option><option value="lightning">Lightning</option><option value="shield">Shield</option></select></label>
              </div>
              <label :class="`${labelClass} mt-4`">Description<textarea v-model="feature.description" rows="2" required :class="inputClass"></textarea></label>
            </article>
          </div>
          <button type="button" class="rounded-xl border border-dashed border-primary/40 px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary/5" @click="addFeature">+ Add feature</button>
        </div>
      </details>

      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">About</summary>
        <div class="space-y-5 border-t border-bg-alt p-6">
          <label :class="labelClass">Eyebrow<input v-model="form.about.title" required :class="inputClass"></label>
          <label :class="labelClass">Title<input v-model="form.about.subtitle" required :class="inputClass"></label>
          <label :class="labelClass">Description<textarea v-model="form.about.description" rows="4" required :class="inputClass"></textarea></label>
        </div>
      </details>

      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">Testimonials</summary>
        <div class="space-y-6 border-t border-bg-alt p-6">
          <div class="grid gap-5 md:grid-cols-2">
            <label :class="labelClass">Eyebrow<input v-model="form.testimonials.eyebrow" required :class="inputClass"></label>
            <label :class="labelClass">Heading<input v-model="form.testimonials.title" required :class="inputClass"></label>
            <label :class="labelClass">Highlighted word<input v-model="form.testimonials.highlight" required :class="inputClass"></label>
            <label :class="labelClass">Side description<textarea v-model="form.testimonials.description" rows="2" required :class="inputClass"></textarea></label>
          </div>

          <article v-for="(testimonial, index) in form.testimonials.items" :key="testimonial.id" class="rounded-2xl border border-bg-alt bg-bg/50 p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <p class="font-black text-text-main">Testimonial {{ index + 1 }}</p>
              <div class="flex gap-2">
                <button type="button" :disabled="index === 0" class="rounded-lg border border-bg-alt px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-30" @click="moveItem(form.testimonials.items, index, -1)">Up</button>
                <button type="button" :disabled="index === form.testimonials.items.length - 1" class="rounded-lg border border-bg-alt px-3 py-1.5 text-xs font-bold text-text-muted disabled:opacity-30" @click="moveItem(form.testimonials.items, index, 1)">Down</button>
                <button type="button" class="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600" @click="form.testimonials.items.splice(index, 1)">Remove</button>
              </div>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <label :class="labelClass">Author<input v-model="testimonial.author" required :class="inputClass"></label>
              <label :class="labelClass">Role<input v-model="testimonial.role" required :class="inputClass"></label>
            </div>
            <label :class="`${labelClass} mt-4`">Quote<textarea v-model="testimonial.quote" rows="3" required :class="inputClass"></textarea></label>
            <label :class="`${labelClass} mt-4`">Avatar URL<input v-model="testimonial.image" type="url" :class="inputClass"></label>
            <div class="mt-4 flex flex-wrap items-center gap-4">
              <label class="cursor-pointer rounded-xl border border-bg-alt bg-bg px-4 py-2.5 text-sm font-bold text-primary transition hover:border-primary/30">
                {{ uploading === `testimonial-${index}` ? 'Uploading...' : 'Upload avatar' }}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="hidden" :disabled="Boolean(uploading)" @change="uploadImage($event, testimonial, 'image', `testimonial-${index}`)">
              </label>
              <img v-if="testimonial.image" :src="testimonial.image" :alt="testimonial.author" class="h-14 w-14 rounded-xl border border-bg-alt object-cover">
            </div>
          </article>
          <button type="button" class="rounded-xl border border-dashed border-primary/40 px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary/5" @click="addTestimonial">+ Add testimonial</button>
        </div>
      </details>

      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">Call to Action</summary>
        <div class="grid gap-5 border-t border-bg-alt p-6 md:grid-cols-2">
          <label :class="labelClass">Eyebrow<input v-model="form.cta.eyebrow" required :class="inputClass"></label>
          <label :class="labelClass">Title<input v-model="form.cta.title" required :class="inputClass"></label>
          <label :class="labelClass">Subtitle<input v-model="form.cta.subtitle" required :class="inputClass"></label>
          <div></div>
          <label :class="labelClass">Primary label<input v-model="form.cta.primaryLabel" required :class="inputClass"></label>
          <label :class="labelClass">Primary URL<input v-model="form.cta.primaryUrl" required :class="inputClass"></label>
          <label :class="labelClass">Secondary label<input v-model="form.cta.secondaryLabel" required :class="inputClass"></label>
          <label :class="labelClass">Secondary URL<input v-model="form.cta.secondaryUrl" required :class="inputClass"></label>
        </div>
      </details>

      <details open class="group rounded-3xl border border-bg-alt bg-surface shadow-sm">
        <summary class="cursor-pointer list-none px-6 py-5 text-xl font-black text-text-main">Footer</summary>
        <div class="space-y-6 border-t border-bg-alt p-6">
          <div class="grid gap-5 md:grid-cols-2">
            <label :class="labelClass">Brand name<input v-model="form.footer.brandName" required :class="inputClass"></label>
            <label :class="labelClass">Description<textarea v-model="form.footer.description" rows="3" required :class="inputClass"></textarea></label>
            <label :class="labelClass">Facebook URL<input v-model="form.footer.facebookUrl" :class="inputClass"></label>
            <label :class="labelClass">GitHub URL<input v-model="form.footer.githubUrl" :class="inputClass"></label>
          </div>

          <article v-for="(column, columnIndex) in form.footer.columns" :key="columnIndex" class="rounded-2xl border border-bg-alt bg-bg/50 p-5">
            <div class="flex items-end gap-3">
              <label :class="`${labelClass} flex-1`">Column title<input v-model="column.title" required :class="inputClass"></label>
              <button type="button" class="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600" @click="form.footer.columns.splice(columnIndex, 1)">Remove</button>
            </div>
            <div class="mt-4 space-y-3">
              <div v-for="(link, linkIndex) in column.links" :key="linkIndex" class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <input v-model="link.label" required aria-label="Link label" :class="inputClass">
                <input v-model="link.url" required aria-label="Link URL" :class="inputClass">
                <button type="button" class="mt-2 rounded-xl border border-red-500/20 px-4 text-sm font-bold text-red-600" @click="column.links.splice(linkIndex, 1)">×</button>
              </div>
            </div>
            <button type="button" class="mt-4 text-sm font-bold text-primary" @click="addFooterLink(column)">+ Add link</button>
          </article>
          <button type="button" class="rounded-xl border border-dashed border-primary/40 px-5 py-3 text-sm font-bold text-primary transition hover:bg-primary/5" @click="addFooterColumn">+ Add footer column</button>

          <div class="grid gap-5 md:grid-cols-2">
            <label :class="labelClass">Copyright<input v-model="form.footer.copyright" required :class="inputClass"></label>
            <label :class="labelClass">Closing text<input v-model="form.footer.designedText" required :class="inputClass"></label>
          </div>
        </div>
      </details>

      <div class="sticky bottom-4 z-20 flex justify-end">
        <button type="submit" :disabled="saving" class="rounded-2xl bg-primary px-8 py-4 font-black text-white shadow-2xl shadow-primary/30 transition hover:bg-primary-dark disabled:cursor-wait disabled:opacity-60">
          {{ saving ? 'Saving...' : 'Save All Welcome Content' }}
        </button>
      </div>
    </form>
  </div>
</template>
