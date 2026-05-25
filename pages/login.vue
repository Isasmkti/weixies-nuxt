<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { getUserProfile } from '../services/authService'

definePageMeta({ layout: false })

const router = useRouter()
const { signIn } = useAuth()

const email = ref('')
const password = ref('')
const errorMsg = ref('')
const showPassword = ref(false)
const isLoading = ref(false)

const handleLogin = async () => {
    isLoading.value = true
    errorMsg.value = ''
    try {
        await signIn(email.value, password.value)
        const profile = await getUserProfile();

        if (profile.role === "admin") {
            router.push("/admin");
        } else {
            router.push("/");
        }
    } catch (err) {
        errorMsg.value = err.message
    } finally {
        isLoading.value = false
    }
}
</script>

<template>
  <div class="flex min-h-screen w-full font-poppins bg-bg">
    <!-- Left Side: Image / Brand Visual -->
    <div class="relative hidden w-0 flex-1 lg:block">
      <!-- Image with Overlay -->
      <div class="absolute inset-0 h-full w-full bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1618761714954-0b8cd0026356?q=80&w=2070&auto=format&fit=crop');">
      </div>
      <div class="absolute inset-0 bg-primary-dark/40 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
      <div class="absolute bottom-0 left-0 p-12 text-white z-10">
        <div class="mb-4 flex items-center gap-2">
          <img src="../assets/weixies-logo.svg" alt="Weixies" class="w-10 h-10 object-contain brightness-0 invert" />
          <span class="text-3xl font-extrabold tracking-tight">Weixies</span>
        </div>
        <p class="max-w-md text-lg font-medium text-white/90">
          Discover premium digital assets, design resources, templates, and tools curated just for you.
        </p>
      </div>
    </div>

    <!-- Right Side: Login Form -->
    <div class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-surface lg:w-[600px] xl:w-[680px]">
      <div class="mx-auto w-full max-w-sm lg:w-96">
        <!-- Mobile Logo (Visible only on small screens) -->
        <div class="mb-10 lg:hidden flex justify-center">
          <img src="../assets/weixies-logo.svg" alt="Weixies" class="w-16 h-16 object-contain" />
        </div>

        <div class="flex flex-col text-center lg:text-left mb-8">
          <h2 class="text-3xl font-bold tracking-tight text-text-main">Welcome Back</h2>
          <p class="mt-2 text-sm text-text-muted">
            Please enter your credentials to access your account.
          </p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-6">
          <div class="space-y-4">
            <!-- Email Input -->
            <div>
              <label class="block text-sm font-medium leading-6 text-text-main mb-1.5 ml-1" for="email">Email address</label>
              <div class="relative rounded-md shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input v-model="email" id="email" type="email" placeholder="Enter your email"
                  class="block w-full rounded-xl border border-bg-alt/50 py-3.5 pl-11 bg-bg-alt/50 focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-text-main placeholder:text-text-muted/50"
                  required />
              </div>
            </div>

            <!-- Password Input -->
            <div>
              <label class="block text-sm font-medium leading-6 text-text-main mb-1.5 ml-1" for="password">Password</label>
              <div class="relative rounded-md shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input v-model="password" id="password" :type="showPassword ? 'text' : 'password'" placeholder="••••••••"
                  class="block w-full rounded-xl border border-bg-alt/50 py-3.5 pl-11 pr-12 bg-bg-alt/50 focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-text-main placeholder:text-text-muted/50"
                  required />
                <button type="button" @click="showPassword = !showPassword"
                  class="absolute inset-y-0 right-0 flex items-center pr-4 text-text-muted hover:text-text-main transition-colors">
                  <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="errorMsg" class="p-3 rounded-lg bg-red-50 text-red-500 text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            {{ errorMsg }}
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input id="remember-me" name="remember-me" type="checkbox"
                class="h-4 w-4 rounded border-bg-alt/50 text-primary focus:ring-primary bg-bg-alt/50" />
              <label for="remember-me" class="ml-2 block text-sm text-text-muted">Remember me</label>
            </div>
            <div class="text-sm">
              <a href="#" class="font-semibold text-primary hover:text-primary-dark transition-colors">Forgot password?</a>
            </div>
          </div>

          <button :disabled="isLoading"
            class="flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-3 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-primary-dark/30 hover:-translate-y-0.5 hover:bg-primary-dark transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">
            <span v-if="isLoading">Logging in...</span>
            <span v-else>Log in</span>
            <svg v-if="!isLoading" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>

        <div class="mt-10">
          <div class="relative">
            <div class="absolute inset-0 flex items-center" aria-hidden="true">
              <div class="w-full border-t border-bg-alt/50"></div>
            </div>
            <div class="relative flex justify-center text-sm font-medium leading-6">
              <span class="bg-surface px-6 text-text-muted">New to Weixies?</span>
            </div>
          </div>
          
          <div class="mt-6 text-center">
            <NuxtLink to="/signup" class="text-primary font-bold hover:underline">Create an account</NuxtLink>
          </div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="mt-auto pt-10 sm:mx-auto w-full max-w-sm lg:w-96 text-center lg:text-left">
        <p class="text-xs text-text-muted/60">© 2026 Weixies Platform. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>
