<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'

const welcomeStore = useWelcomeStore()
await callOnce('public-layout-content', () => welcomeStore.stContent())
</script>

<template>
  <div class="min-h-screen bg-bg font-poppins text-text-main">
    <header class="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/welcome" class="flex items-center gap-2 font-extrabold text-text-main" aria-label="Weixies home">
          <img src="/weixies-logo.svg" alt="" class="h-9 w-9 object-contain">
          <span>{{ welcomeStore.footer.brandName || 'Weixies' }}</span>
        </NuxtLink>
        <nav class="flex items-center gap-2 sm:gap-4" aria-label="Public navigation">
          <NuxtLink to="/products" class="rounded-ui-sm px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-bg-alt hover:text-primary">Catalog</NuxtLink>
          <NuxtLink to="/login" class="rounded-ui-sm bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark">Sign in</NuxtLink>
        </nav>
      </div>
    </header>
    <main><slot /></main>
    <Footer />
  </div>
</template>
