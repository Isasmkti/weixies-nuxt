<template>
  <div class="relative min-h-[100vh] flex items-center justify-center overflow-hidden bg-bg-alt">

    <!-- Loading -->
    <div
      v-if="store.loading"
      class="absolute inset-0 z-50 flex items-center justify-center bg-bg-alt/70 backdrop-blur-md"
    >
      <div class="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="store.error"
      class="absolute inset-0 z-50 flex items-center justify-center"
    >
      <p class="bg-surface text-text px-6 py-4 rounded-xl shadow-lg font-medium">
        Error: {{ store.error }}
      </p>
    </div>

    <!-- Hero -->
    <template v-else-if="currentItem">
      <MotionGroup preset="fade" :duration="1000" :delay="500">
        <!-- Background -->
        <div class="absolute inset-0">
          <img
            :src="currentItem.image"
            alt="Hero Background"
            class="h-full w-full object-cover scale-110 animate-subtle-zoom"
          />
          
          <!-- Soft radial gradient -->
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.2),rgba(0,0,0,0.75))]"></div>

          <!-- Subtle primary tint -->
          <div class="absolute inset-0 bg-primary/10"></div>

          <!-- Bottom fade -->
          <div class="absolute bottom-0 inset-x-0 h-96 bg-gradient-to-t from-bg-alt via-bg-alt/80 to-transparent"></div>
        </div>
      </MotionGroup>

      <!-- Content -->
      <MotionGroup preset="fade" :duration="1000" :delay="1000">
        <main class="relative z-10 max-w-6xl mx-auto px-6 text-center pt-32 pb-20 md:pt-48 md:pb-36 lg:pt-56 lg:pb-44">
          <h1
            class="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-white leading-[1.1] drop-shadow-2xl"
          >
            {{ currentItem.title }}
          </h1>

          <p
            class="mt-8 max-w-2xl mx-auto text-base sm:text-lg md:text-xl lg:text-2xl text-white/90 leading-relaxed font-medium drop-shadow-lg"
          >
            {{ currentItem.description }}
          </p>

          <!-- CTA -->
          <div class="mt-12 flex flex-col sm:flex-row justify-center items-center gap-4 md:gap-6">
            <a
              href="#"
              class="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-primary px-8 md:px-10 py-4 text-base md:text-lg font-bold text-white shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300"
            >
              Get Started
            </a>

            <a
              href="#"
              class="w-full sm:w-auto inline-flex items-center justify-center rounded-full border-2 border-white/50 backdrop-blur-sm px-8 md:px-10 py-4 text-base md:text-lg font-bold text-white hover:bg-white hover:text-black transition-all duration-300"
            >
              Live Demo
            </a>
          </div>
        </main>
      </MotionGroup>
    </template>
   
  </div>
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
import { useWelcomeStore } from '../stores/welcomeStore'

const store = useWelcomeStore()

const currentItem = computed(() => {
    return store.hero
})

onMounted(() => {
    store.stAll()
})
</script>
