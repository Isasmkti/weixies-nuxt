<template>
  <nav :class="[
  'fixed z-50 flex justify-between items-center transition-all duration-1000 ease-in-out rounded-[40px]',

  isScrolled
    ? 'top-5 left-1/2 -translate-x-1/2 w-[95%] max-w-6xl bg-surface/40 backdrop-blur-md shadow-md py-4 px-8 text-text-main dark:text-white '
    : 'top-0 left-0 w-full bg-transparent py-12 px-12 text-white'
]">
    <div class="flex items-center gap-2">
      <img src="../assets/weixies-logo.svg" alt="Weixies Logo" class="w-8 h-8 object-contain" />
      <span class="text-xl font-bold">Weixies</span>
    </div>

    <div class="flex items-center space-x-6">
      <template v-if="profile">
        <NuxtLink to="/dashboard"
          class="bg-primary text-white px-4 py-2 rounded-xl shadow-lg hover:bg-primary-dark transition transform hover:-translate-y-0.5 font-medium">
          Dashboard
        </NuxtLink>
      </template>

      <template v-if="!profile">
        <NuxtLink to="/login" class=" hover:text-primary transition font-medium">
          Login
        </NuxtLink>

        <NuxtLink to="/signup"
          class="bg-primary text-white px-4 py-2 rounded-xl shadow-lg hover:bg-primary-dark transition transform hover:-translate-y-0.5">
          Sign Up
        </NuxtLink>
      </template>

    </div>
  </nav>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { profile, fetchProfile } = useAuth()
const isScrolled = ref(false)

const handleScroll = () => {
  isScrolled.value = window.scrollY > 100
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)
  await fetchProfile()
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>
