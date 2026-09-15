<template>
  <nav :class="[
  'welcome-navbar fixed z-50 flex justify-between items-center rounded-[40px]',

  isScrolled
    ? 'welcome-navbar--scrolled top-5 bg-surface/40 backdrop-blur-md shadow-md py-4 px-8 text-text-main dark:text-white'
    : 'top-0 bg-transparent py-12 px-12 text-white'
]">
    <div class="flex items-center gap-2">
      <img src="../assets/weixies-logo.svg" alt="Weixies Logo" class="w-8 h-8 object-contain" />
      <span class="text-xl font-bold">{{ welcomeStore.navbar.brandName }}</span>
    </div>

    <div class="flex items-center space-x-6">
      <template v-if="profile">
        <NuxtLink to="/dashboard"
          class="bg-primary text-white px-4 py-2 rounded-xl shadow-lg hover:bg-primary-dark transition transform hover:-translate-y-0.5 font-medium">
          {{ welcomeStore.navbar.dashboardLabel }}
        </NuxtLink>
      </template>

      <template v-if="!profile">
        <NuxtLink to="/login" class=" hover:text-primary transition font-medium">
          {{ welcomeStore.navbar.loginLabel }}
        </NuxtLink>

        <NuxtLink to="/signup"
          class="bg-primary text-white px-4 py-2 rounded-xl shadow-lg hover:bg-primary-dark transition transform hover:-translate-y-0.5">
          {{ welcomeStore.navbar.signupLabel }}
        </NuxtLink>
      </template>

    </div>
  </nav>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useWelcomeStore } from '../stores/welcomeStore'

const { profile, fetchProfile } = useAuth()
const welcomeStore = useWelcomeStore()
const isScrolled = ref(false)
const NAVBAR_COLLAPSE_AT = 100
const NAVBAR_EXPAND_AT = 72
let scrollFrame = null

const updateScrollState = () => {
  const scrollPosition = window.scrollY

  if (!isScrolled.value && scrollPosition > NAVBAR_COLLAPSE_AT) {
    isScrolled.value = true
  } else if (isScrolled.value && scrollPosition < NAVBAR_EXPAND_AT) {
    isScrolled.value = false
  }
}

const handleScroll = () => {
  if (scrollFrame !== null) return

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = null
    updateScrollState()
  })
}

onMounted(() => {
  // Sync before subscribing so a restored scroll position never renders the
  // expanded navbar until the next browser scroll event.
  updateScrollState()
  window.addEventListener('scroll', handleScroll, { passive: true })

  void fetchProfile().catch(() => {})
  if (!welcomeStore.contentAttempted) void welcomeStore.stContent()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollFrame !== null) window.cancelAnimationFrame(scrollFrame)
})
</script>

<style scoped>
.welcome-navbar {
  left: 0;
  right: 0;
  backface-visibility: hidden;
  transition-property:
    top,
    left,
    right,
    padding-top,
    padding-right,
    padding-bottom,
    padding-left,
    color,
    background-color,
    box-shadow,
    backdrop-filter,
    -webkit-backdrop-filter;
  transition-duration: 1000ms;
  transition-timing-function: ease-in-out;
  will-change: top, left, right;
}

.welcome-navbar--scrolled {
  /* Equivalent to width: 95%; max-width: 72rem, but both edges remain
     continuously interpolable instead of snapping max-width from `none`. */
  left: max(2.5%, calc(50% - 36rem));
  right: max(2.5%, calc(50% - 36rem));
}

@media (prefers-reduced-motion: reduce) {
  .welcome-navbar {
    transition-duration: 0.01ms;
  }
}
</style>
