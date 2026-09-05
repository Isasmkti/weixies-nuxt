<template>
  <section id="hero" class="relative min-h-[100vh] flex items-center justify-center overflow-hidden bg-bg-alt">

    <div
      v-if="store.loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-bg-alt/70 backdrop-blur-md"
    >
      <div class="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
    </div>

    <div
      v-else-if="store.error"
      class="absolute inset-0 z-50 flex items-center justify-center"
    >
      <p class="rounded-xl bg-surface px-6 py-4 font-medium text-text shadow-lg">
        Error: {{ store.error }}
      </p>
    </div>

    <template v-else-if="currentItem">
      <MotionGroup preset="fade" :duration="350">
        <div class="absolute inset-0">
          <img
            :src="currentItem.image"
            alt="Hero Background"
            width="1920"
            height="1080"
            decoding="async"
            fetchpriority="high"
            class="h-full w-full scale-110 object-cover animate-subtle-zoom"
          />

          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.2),rgba(0,0,0,0.75))]"></div>
          <div class="absolute inset-0 bg-primary/10"></div>
          <div class="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-bg-alt via-bg-alt/80 to-transparent"></div>
        </div>
      </MotionGroup>

      <MotionGroup preset="fade" :duration="350" :delay="100">
        <main class="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-20 pt-28 text-center sm:px-8 md:pb-28 md:pt-40 lg:px-12 lg:pb-36 lg:pt-48">
          <h1
            class="max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.02em] text-white drop-shadow-2xl sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {{ currentItem.title }}
          </h1>

          <p
            class="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/90 drop-shadow-lg sm:text-lg md:text-xl"
          >
            {{ currentItem.description }}
          </p>

          <div class="mt-10 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row md:gap-6">
            <NuxtLink
              :to="currentItem.primaryUrl || '/products'"
              class="inline-flex w-full items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-bold text-white shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:bg-primary-dark hover:shadow-primary/40 sm:w-auto sm:text-base"
            >
              {{ currentItem.primaryLabel }}
            </NuxtLink>

            <NuxtLink
              :to="currentItem.secondaryUrl || '#about'"
              class="inline-flex w-full items-center justify-center rounded-full border-2 border-white/50 bg-transparent px-8 py-4 text-sm font-bold text-white backdrop-blur-sm transition-all duration-300 hover:border-primary hover:bg-primary hover:text-white sm:w-auto sm:text-base"
            >
              {{ currentItem.secondaryLabel }}
            </NuxtLink>
          </div>
        </main>
      </MotionGroup>
    </template>
  </section>
</template>

<style scoped>
@keyframes subtle-zoom {
  0% { transform: scale(1.05); }
  100% { transform: scale(1.15); }
}
.animate-subtle-zoom {
  animation: subtle-zoom 20s ease-in-out infinite alternate;
}
</style>

<script setup>
import { onMounted, computed } from 'vue'
import { MotionGroupComponent as MotionGroup } from '@vueuse/motion'
import { useWelcomeStore } from '../stores/welcomeStore'

const store = useWelcomeStore()

const currentItem = computed(() => {
    return store.hero
})

onMounted(() => {
    store.stAll()
})
</script>
