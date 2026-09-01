<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <ClientOnly>
    <AiCustomerServiceChat v-if="isAuthenticated" />
  </ClientOnly>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { supabase } from './utils/supabase'

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
