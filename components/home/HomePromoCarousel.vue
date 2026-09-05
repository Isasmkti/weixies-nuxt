<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
})

const currentIndex = ref(0)
const paused = ref(false)
let rotationTimer = null

const currentItem = computed(() => props.items[currentIndex.value] || null)
const hasMultipleItems = computed(() => props.items.length > 1)

function stopRotation() {
  if (rotationTimer) clearInterval(rotationTimer)
  rotationTimer = null
}

function startRotation() {
  stopRotation()
  if (!hasMultipleItems.value || paused.value) return
  rotationTimer = setInterval(() => {
    currentIndex.value = (currentIndex.value + 1) % props.items.length
  }, 6000)
}

function setPaused(value) {
  paused.value = value
  if (value) stopRotation()
  else startRotation()
}

function goTo(index) {
  currentIndex.value = (index + props.items.length) % props.items.length
  startRotation()
}

function formatPublishedDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

watch(() => props.items.length, (length) => {
  if (!length || currentIndex.value >= length) currentIndex.value = 0
  startRotation()
})

onMounted(startRotation)
onBeforeUnmount(stopRotation)
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-bg-alt/70 bg-surface shadow-sm"
    aria-label="Promotions and news"
    @mouseenter="setPaused(true)"
    @mouseleave="setPaused(false)"
    @focusin="setPaused(true)"
    @focusout="setPaused(false)"
  >
    <div v-if="loading" class="h-[230px] animate-pulse bg-bg-alt sm:h-[310px] md:h-[380px]">
      <div class="flex h-full items-end p-6 md:p-10">
        <div class="w-full max-w-xl space-y-4">
          <div class="h-6 w-24 rounded-full bg-surface/70"></div>
          <div class="h-10 w-3/4 rounded-xl bg-surface/70"></div>
          <div class="h-5 w-full rounded-lg bg-surface/60"></div>
        </div>
      </div>
    </div>

    <div v-else-if="!currentItem" class="flex h-[230px] items-center bg-gradient-to-br from-primary via-primary-dark to-indigo-900 px-6 text-white sm:h-[310px] md:h-[380px] md:px-10">
      <div class="max-w-xl">
        <span class="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] backdrop-blur">Weixies Updates</span>
        <h2 class="mt-4 font-poppins text-3xl font-black tracking-tight md:text-5xl">Promotions and news are coming soon.</h2>
        <p class="mt-3 max-w-lg text-sm leading-6 text-white/75 md:text-base">Check back for marketplace offers, product highlights, and platform announcements.</p>
      </div>
    </div>

    <Transition v-else name="home-carousel" mode="out-in">
      <article :key="currentItem.id" class="relative h-[230px] overflow-hidden sm:h-[310px] md:h-[380px]">
        <img
          v-if="currentItem.image_url"
          :src="currentItem.image_url"
          :alt="currentItem.title"
          width="1600"
          height="900"
          decoding="async"
          fetchpriority="high"
          class="absolute inset-0 h-full w-full object-cover"
        >
        <div
          v-else
          :class="currentItem.content_type === 'news'
            ? 'bg-gradient-to-br from-sky-500 via-indigo-600 to-primary-dark'
            : 'bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600'"
          class="absolute inset-0"
        ></div>

        <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/5"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10"></div>

        <div class="relative z-10 flex h-full max-w-3xl flex-col justify-end p-5 text-white sm:p-7 md:justify-center md:p-10">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-md md:text-xs">
              {{ currentItem.badge || (currentItem.content_type === 'news' ? 'Latest News' : 'Featured Promo') }}
            </span>
            <time v-if="currentItem.content_type === 'news'" class="text-[10px] font-semibold text-white/70 md:text-xs">
              {{ formatPublishedDate(currentItem.published_at) }}
            </time>
          </div>

          <h2 class="mt-3 max-w-2xl font-poppins text-2xl font-black leading-tight tracking-tight drop-shadow-sm sm:text-4xl md:text-5xl">
            {{ currentItem.title }}
          </h2>
          <p class="mt-2 line-clamp-2 max-w-xl text-xs leading-5 text-white/80 sm:text-sm md:mt-3 md:text-base md:leading-7">
            {{ currentItem.description }}
          </p>

          <div class="mt-4 md:mt-6">
            <NuxtLink
              v-if="currentItem.link_url.startsWith('/')"
              :to="currentItem.link_url"
              class="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-gray-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white/90 md:px-5 md:py-3 md:text-sm"
            >
              {{ currentItem.button_label }}
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6" /></svg>
            </NuxtLink>
            <a
              v-else
              :href="currentItem.link_url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-gray-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-white/90 md:px-5 md:py-3 md:text-sm"
            >
              {{ currentItem.button_label }}
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 6H18v4.5M18 6l-7.5 7.5M15 13v5H6V9h5" /></svg>
            </a>
          </div>
        </div>
      </article>
    </Transition>

    <template v-if="hasMultipleItems">
      <button type="button" class="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/45 sm:flex" aria-label="Previous slide" @click="goTo(currentIndex - 1)">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 18-6-6 6-6" /></svg>
      </button>
      <button type="button" class="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur transition hover:bg-black/45 sm:flex" aria-label="Next slide" @click="goTo(currentIndex + 1)">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 18 6-6-6-6" /></svg>
      </button>

      <div class="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-2.5 py-2 backdrop-blur-md md:bottom-5 md:right-5">
        <button
          v-for="(item, index) in items"
          :key="item.id"
          type="button"
          :class="currentIndex === index ? 'w-6 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'"
          class="h-2 rounded-full transition-all duration-300"
          :aria-label="`Show slide ${index + 1}: ${item.title}`"
          :aria-current="currentIndex === index ? 'true' : undefined"
          @click="goTo(index)"
        ></button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.home-carousel-enter-active,
.home-carousel-leave-active {
  transition: opacity 450ms ease, transform 550ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.home-carousel-enter-from {
  opacity: 0;
  transform: scale(1.02);
}

.home-carousel-leave-to {
  opacity: 0;
  transform: scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .home-carousel-enter-active,
  .home-carousel-leave-active {
    transition-duration: 1ms;
  }
}
</style>
