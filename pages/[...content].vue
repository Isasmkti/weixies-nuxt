<script setup>
import { computed } from 'vue'
import PublicPageRichText from '../components/content/PublicPageRichText.vue'
import { publicPageRichTextToPlainText } from '../utils/publicPageRichText'
import { seoDescription, serializeJsonLd } from '../utils/seo'

definePageMeta({ layout: 'public' })

const route = useRoute()
const { canonicalUrl } = useSeoSite()
const path = computed(() => {
  const segments = Array.isArray(route.params.content) ? route.params.content : [route.params.content]
  return `/${segments.filter(Boolean).join('/')}`
})
const { data, error } = await useFetch('/api/public-pages', {
  query: { path },
  key: `public-page:${path.value}`,
})

if (error.value || !data.value?.page) {
  throw createError({ statusCode: error.value?.statusCode || 404, statusMessage: 'Page not found.' })
}

const page = computed(() => data.value.page)
const sections = computed(() => Array.isArray(page.value.sections) ? page.value.sections.filter(section => section?.heading && section?.body) : [])
const description = computed(() => seoDescription(
  page.value.seo_description
  || page.value.summary
  || publicPageRichTextToPlainText(sections.value[0]?.body),
))
const contactDetails = computed(() => Array.isArray(page.value.contact_details) ? page.value.contact_details.filter(detail => detail?.label && detail?.value) : [])
const pageCategory = computed(() => {
  if (page.value.page_type?.startsWith('legal_')) return 'Legal'
  if (page.value.page_type === 'help') return 'Help center'
  if (page.value.page_type === 'about') return 'Company'
  if (page.value.page_type === 'contact') return 'Contact'
  return 'Resource'
})
const formattedDate = (value, utc = false) => {
  if (!value) return ''
  const date = new Date(utc ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { dateStyle: 'long', ...(utc ? { timeZone: 'UTC' } : {}) }).format(date)
}
const updatedDate = computed(() => formattedDate(page.value.updated_at))
const effectiveDate = computed(() => formattedDate(page.value.effective_date, true))
const linkedDetail = detail => ['email', 'phone', 'url'].includes(detail.type)
const detailHref = (detail) => {
  if (detail.type === 'email') return `mailto:${detail.value}`
  if (detail.type === 'phone') return `tel:${String(detail.value).replace(/[^+\d]/g, '')}`
  if (detail.type === 'url') return detail.value
  return undefined
}

useSeoMeta({
  title: () => page.value.seo_title || page.value.title,
  description,
  ogTitle: () => page.value.seo_title || page.value.title,
  ogDescription: description,
  ogUrl: () => canonicalUrl.value,
  ogType: 'article',
  robots: 'index, follow',
})

useHead(() => ({
  script: [{
    key: `public-page-jsonld-${page.value.id}`,
    type: 'application/ld+json',
    textContent: serializeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.value.title,
      description: description.value,
      url: canonicalUrl.value,
      datePublished: page.value.published_at,
      dateModified: page.value.updated_at,
    }),
  }],
}))
</script>

<template>
  <article class="min-w-0">
    <header class="relative overflow-hidden border-b border-border bg-surface">
      <div class="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
      <div class="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-primary/5 blur-3xl" aria-hidden="true" />

      <div class="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <nav class="flex min-w-0 items-center gap-2 text-xs font-semibold text-text-muted" aria-label="Breadcrumb">
          <NuxtLink to="/welcome" class="inline-flex shrink-0 items-center gap-1.5 rounded-ui-sm py-1 transition hover:text-primary">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" /></svg>
            Back to Welcome
          </NuxtLink>
          <span aria-hidden="true">/</span>
          <span class="truncate">{{ pageCategory }}</span>
        </nav>

        <div class="mt-8 max-w-4xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">{{ pageCategory }}</span>
            <span v-if="page.eyebrow" class="text-xs font-black uppercase tracking-[0.2em] text-text-muted">{{ page.eyebrow }}</span>
          </div>
          <h1 class="mt-4 break-words text-3xl font-black tracking-tight text-text-main sm:text-5xl lg:text-6xl">{{ page.title }}</h1>
          <p v-if="page.summary" class="mt-5 max-w-3xl text-base leading-8 text-text-muted sm:text-lg">{{ page.summary }}</p>
          <div v-if="updatedDate || effectiveDate" class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-text-muted">
            <p v-if="updatedDate" class="inline-flex items-center gap-1.5"><svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>Last updated {{ updatedDate }}</p>
            <p v-if="effectiveDate" class="inline-flex items-center gap-1.5"><svg class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>Effective {{ effectiveDate }}</p>
          </div>
        </div>
      </div>
    </header>

    <div class="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <details v-if="sections.length > 1" class="group mb-6 overflow-hidden rounded-ui-lg border border-border bg-surface shadow-sm lg:hidden">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-bold text-text-main marker:content-none">
          <span class="inline-flex items-center gap-2"><svg class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M4 12h16M4 18h10" /></svg>On this page</span>
          <svg class="h-4 w-4 text-text-muted transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
        </summary>
        <nav class="space-y-1 border-t border-border p-3" aria-label="Mobile page sections">
          <a v-for="(section, index) in sections" :key="`mobile-nav-${index}`" :href="`#section-${index + 1}`" class="flex items-start gap-3 rounded-ui-sm px-3 py-2.5 text-sm text-text-muted transition hover:bg-primary/10 hover:text-primary"><span class="mt-0.5 text-[10px] font-black text-primary">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ section.heading }}</span></a>
        </nav>
      </details>

      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div class="min-w-0 space-y-6">
          <section v-if="contactDetails.length" class="rounded-ui-lg border border-border bg-surface p-5 shadow-sm sm:p-8" aria-labelledby="contact-information-title">
            <div class="flex items-start gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-md bg-primary/10 text-primary"><svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 6.75A2.75 2.75 0 0 1 5.75 4h12.5A2.75 2.75 0 0 1 21 6.75v10.5A2.75 2.75 0 0 1 18.25 20H5.75A2.75 2.75 0 0 1 3 17.25V6.75Zm1 .25 8 6 8-6" /></svg></span>
              <div><h2 id="contact-information-title" class="text-xl font-extrabold text-text-main sm:text-2xl">Contact information</h2><p class="mt-1 text-sm text-text-muted">Contact and business details published for this page.</p></div>
            </div>
            <dl class="mt-6 grid gap-3 sm:grid-cols-2">
              <div v-for="(detail, index) in contactDetails" :key="`${detail.label}-${index}`" class="min-w-0 rounded-ui-md border border-border bg-bg p-4">
                <dt class="text-[10px] font-black uppercase tracking-wider text-text-muted">{{ detail.label }}</dt>
                <dd class="mt-2 whitespace-pre-line break-words text-sm font-semibold text-text-main">
                  <a v-if="linkedDetail(detail)" :href="detailHref(detail)" :target="detail.type === 'url' ? '_blank' : undefined" :rel="detail.type === 'url' ? 'noopener noreferrer' : undefined" class="inline-flex max-w-full items-center gap-1 text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"><span class="break-all">{{ detail.value }}</span><svg v-if="detail.type === 'url'" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5h5v5m0-5-9 9M5 9v10h10" /></svg></a>
                  <span v-else>{{ detail.value }}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section v-for="(section, index) in sections" :id="`section-${index + 1}`" :key="`${section.heading}-${index}`" class="scroll-mt-24 rounded-ui-lg border border-border bg-surface p-5 shadow-sm sm:p-8">
            <div class="flex items-start gap-3 sm:gap-4">
              <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-black text-primary">{{ String(index + 1).padStart(2, '0') }}</span>
              <div class="min-w-0 flex-1">
                <h2 class="break-words text-xl font-extrabold text-text-main sm:text-2xl">{{ section.heading }}</h2>
                <PublicPageRichText :content="section.body" class="mt-4 break-words whitespace-pre-line font-montserrat text-sm leading-7 text-text-muted sm:text-base sm:leading-8" />
              </div>
            </div>
          </section>

          <section v-if="!sections.length" class="rounded-ui-lg border border-dashed border-border bg-surface px-5 py-12 text-center">
            <h2 class="font-extrabold text-text-main">Content is being prepared</h2>
            <p class="mt-2 text-sm text-text-muted">This page does not have any published sections yet.</p>
          </section>

          <nav class="flex flex-col gap-3 rounded-ui-lg border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5" aria-label="Public page actions">
            <div><p class="text-sm font-bold text-text-main">Finished reading?</p><p class="mt-0.5 text-xs text-text-muted">Continue exploring Weixies or return to the welcome page.</p></div>
            <div class="flex shrink-0 gap-2"><NuxtLink to="/welcome" class="inline-flex min-h-10 items-center justify-center rounded-ui-sm border border-border px-4 text-xs font-bold text-text-main transition hover:border-primary/40 hover:text-primary">Back to Welcome</NuxtLink><NuxtLink to="/products" class="inline-flex min-h-10 items-center justify-center rounded-ui-sm bg-primary px-4 text-xs font-bold text-white transition hover:bg-primary-dark">Browse Catalog</NuxtLink></div>
          </nav>
        </div>

        <aside v-if="sections.length > 1" class="hidden rounded-ui-lg border border-border bg-surface p-5 shadow-sm lg:sticky lg:top-24 lg:block">
          <p class="text-xs font-black uppercase tracking-wider text-text-muted">On this page</p>
          <nav class="mt-3 space-y-1" aria-label="Page sections">
            <a v-for="(section, index) in sections" :key="`nav-${index}`" :href="`#section-${index + 1}`" class="flex items-start gap-2 rounded-ui-sm px-3 py-2.5 text-sm text-text-muted transition hover:bg-primary/10 hover:text-primary"><span class="mt-0.5 text-[10px] font-black text-primary">{{ String(index + 1).padStart(2, '0') }}</span><span>{{ section.heading }}</span></a>
          </nav>
          <NuxtLink to="/welcome" class="mt-5 flex items-center gap-2 border-t border-border px-3 pt-4 text-xs font-bold text-primary hover:underline"><svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" /></svg>Back to Welcome</NuxtLink>
        </aside>
      </div>
    </div>
  </article>
</template>
