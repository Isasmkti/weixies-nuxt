<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <button
      v-if="canShowChatLauncher && !showChat"
      type="button"
      class="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 items-center gap-2 rounded-full bg-primary-dark px-4 text-sm font-bold text-white shadow-[0_12px_34px_rgba(79,70,229,0.35)] transition hover:-translate-y-0.5 hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:bottom-6 sm:h-16 sm:px-5"
      aria-label="Open AI customer support chat"
      @click="showChat = true"
    >
      <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M8 10h.01M12 10h.01M16 10h.01M20 11.5c0 4.142-3.582 7.5-8 7.5a8.65 8.65 0 0 1-3.68-.81L4 19.5l1.36-3.4A7.1 7.1 0 0 1 4 12c0-4.142 3.582-7.5 8-7.5s8 2.858 8 7Z" /></svg>
      <span class="hidden sm:inline">AI Support</span>
    </button>
    <LazyAiCustomerServiceChat v-if="canShowChatLauncher && showChat" initially-open />
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
const showChat = ref(false)
const canShowChatLauncher = computed(() => isAuthenticated.value && !route.path.startsWith('/admin'))
const { user: authUser, resetProfile } = useAuth()
const cartStore = useCartStore()
const wishlistStore = useWishlistStore()
let authSubscription = null

onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  isAuthenticated.value = Boolean(data.session?.user)

  const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user || (authUser.value && authUser.value.id !== session.user.id)) {
      showChat.value = false
      resetProfile()
      cartStore.$reset()
      wishlistStore.$reset()
    }
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
