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
const description = computed(() => seoDescription(
  page.value.seo_description
  || page.value.summary
  || publicPageRichTextToPlainText(page.value.sections?.[0]?.body),
))
const contactDetails = computed(() => page.value.contact_details || [])
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
  <article class="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
    <header class="max-w-3xl">
      <p v-if="page.eyebrow" class="text-xs font-black uppercase tracking-[0.22em] text-primary">{{ page.eyebrow }}</p>
      <h1 class="mt-3 text-4xl font-extrabold tracking-tight text-text-main sm:text-5xl">{{ page.title }}</h1>
      <p v-if="page.summary" class="mt-5 text-base leading-8 text-text-muted sm:text-lg">{{ page.summary }}</p>
      <div class="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-muted">
        <p>Last updated {{ new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(new Date(page.updated_at)) }}</p>
        <p v-if="page.effective_date">Effective {{ new Intl.DateTimeFormat('en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${page.effective_date}T00:00:00Z`)) }}</p>
      </div>
    </header>

    <div class="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
      <div class="space-y-6">
        <section v-if="contactDetails.length" class="rounded-ui-lg border border-border bg-surface p-5 shadow-sm sm:p-8" aria-labelledby="contact-information-title">
          <h2 id="contact-information-title" class="text-xl font-extrabold text-text-main sm:text-2xl">Contact information</h2>
          <dl class="mt-5 grid gap-3 sm:grid-cols-2">
            <div v-for="(detail, index) in contactDetails" :key="`${detail.label}-${index}`" class="rounded-ui-md bg-bg p-4">
              <dt class="text-xs font-bold uppercase tracking-wider text-text-muted">{{ detail.label }}</dt>
              <dd class="mt-2 whitespace-pre-line break-words text-sm font-semibold text-text-main">
                <a v-if="linkedDetail(detail)" :href="detailHref(detail)" :target="detail.type === 'url' ? '_blank' : undefined" :rel="detail.type === 'url' ? 'noopener noreferrer' : undefined" class="text-primary hover:underline">{{ detail.value }}</a>
                <span v-else>{{ detail.value }}</span>
              </dd>
            </div>
          </dl>
        </section>
        <section v-for="(section, index) in page.sections" :id="`section-${index + 1}`" :key="`${section.heading}-${index}`" class="scroll-mt-24 rounded-ui-lg border border-border bg-surface p-5 shadow-sm sm:p-8">
          <h2 class="text-xl font-extrabold text-text-main sm:text-2xl">{{ section.heading }}</h2>
          <PublicPageRichText :content="section.body" class="mt-4 whitespace-pre-line font-montserrat text-sm leading-7 text-text-muted sm:text-base" />
        </section>
      </div>
      <aside v-if="page.sections.length > 1" class="rounded-ui-lg border border-border bg-surface p-5 lg:sticky lg:top-24">
        <p class="text-xs font-black uppercase tracking-wider text-text-muted">On this page</p>
        <nav class="mt-3 space-y-1" aria-label="Page sections">
          <a v-for="(section, index) in page.sections" :key="`nav-${index}`" :href="`#section-${index + 1}`" class="block rounded-ui-sm px-3 py-2 text-sm text-text-muted transition hover:bg-primary/10 hover:text-primary">{{ section.heading }}</a>
        </nav>
      </aside>
    </div>
  </article>
</template>
