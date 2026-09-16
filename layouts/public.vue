<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'

const welcomeStore = useWelcomeStore()
await callOnce('public-layout-content', () => welcomeStore.stContent())
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg font-poppins text-text-main">
    <a href="#public-page-content" class="sr-only z-[60] rounded-ui-sm bg-primary px-4 py-2 font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <header class="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NuxtLink to="/welcome" class="flex items-center gap-2 font-extrabold text-text-main" aria-label="Weixies home">
          <img src="/weixies-logo.svg" alt="" class="h-9 w-9 object-contain">
          <span>{{ welcomeStore.footer.brandName || 'Weixies' }}</span>
        </NuxtLink>
        <nav class="flex items-center gap-2 sm:gap-4" aria-label="Public navigation">
          <NuxtLink to="/welcome" aria-label="Welcome" class="inline-flex items-center gap-1.5 rounded-ui-sm px-2.5 py-2 text-sm font-semibold text-text-muted transition hover:bg-bg-alt hover:text-primary" active-class="bg-primary/10 text-primary">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6" /></svg>
            <span class="hidden sm:inline">Welcome</span>
          </NuxtLink>
          <NuxtLink to="/products" class="rounded-ui-sm px-3 py-2 text-sm font-semibold text-text-muted transition hover:bg-bg-alt hover:text-primary">Catalog</NuxtLink>
          <NuxtLink to="/login" class="rounded-ui-sm bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark">Sign in</NuxtLink>
        </nav>
      </div>
    </header>
    <main id="public-page-content" class="flex-1"><slot /></main>
    <Footer />
  </div>
</template>
