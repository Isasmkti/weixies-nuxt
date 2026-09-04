<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <AiCustomerServiceChat v-if="isAuthenticated" />
  </ClientOnly>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { supabase } from './utils/supabase'
import { SEO_DEFAULT_DESCRIPTION, SEO_DEFAULT_TITLE, SEO_SITE_NAME } from './utils/seo'

const route = useRoute()
const { canonicalUrl, absoluteUrl } = useSeoSite()
const indexableRoute = computed(() => (
  route.path === '/welcome'
  || route.path === '/products'
  || route.path.startsWith('/products/')
  || route.path.startsWith('/stores/')
))

useHead(() => ({
  titleTemplate: (title) => {
    if (!title || title === SEO_SITE_NAME || title === SEO_DEFAULT_TITLE) return SEO_DEFAULT_TITLE
    return `${title} | ${SEO_SITE_NAME}`
  },
  link: [{ key: 'canonical', rel: 'canonical', href: canonicalUrl.value }],
}))

useSeoMeta({
  description: SEO_DEFAULT_DESCRIPTION,
  ogSiteName: SEO_SITE_NAME,
  ogType: 'website',
  ogDescription: SEO_DEFAULT_DESCRIPTION,
  ogImage: () => absoluteUrl('/weixies-logo.svg'),
  twitterCard: 'summary_large_image',
  robots: () => indexableRoute.value ? 'index, follow' : 'noindex, nofollow',
})

const isAuthenticated = ref(false)
let authSubscription = null

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  isAuthenticated.value = Boolean(data.session?.user)

  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    isAuthenticated.value = Boolean(session?.user)
  })

  authSubscription = authListener.subscription
})

onBeforeUnmount(() => {
  authSubscription?.unsubscribe()
})
</script>

<style>
/* Global transitions */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
