<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { sPublicSignupBanner } from '../services/signupBannerService'

definePageMeta({ layout: false })

const router = useRouter()
const { signUp } = useAuth()

const email = ref('')
const password = ref('')
const fullName = ref('')
const errorMsg = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const signupBanner = ref(null)

onMounted(async () => {
  try {
    signupBanner.value = await sPublicSignupBanner()
  } catch (error) {
    console.warn('[Sign-up] Managed banner could not be loaded; using the default image.', error)
  }
})

const handleRegister = async () => {
  isLoading.value = true
  errorMsg.value = ''
  try {
    await signUp(email.value, password.value, fullName.value)
    alert('Register sukses, silakan login')
    router.push('/login')
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
      <img
        v-if="signupBanner?.image_url"
        :src="signupBanner.image_url"
        :alt="signupBanner.alt_text"
        class="absolute inset-0 h-full w-full object-cover"
        @error="signupBanner = null"
      >
      <div v-else class="absolute inset-0 h-full w-full bg-cover bg-center" style="background-image: url('https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=1964&auto=format&fit=crop');"></div>
      <div class="absolute inset-0 bg-primary-dark/60 mix-blend-multiply"></div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
      <div class="absolute bottom-0 left-0 p-12 text-white z-10">
        <div class="mb-4 flex items-center gap-2">
          <img src="../assets/weixies-logo.svg" alt="Weixies" class="w-10 h-10 object-contain brightness-0 invert" />
          <span class="text-3xl font-extrabold tracking-tight">Weixies</span>
        </div>
        <p class="max-w-md text-lg font-medium text-white/90">
          Join our creative community today and get instant access to the best digital resources.
        </p>
      </div>
    </div>

    <!-- Right Side: Register Form -->
    <div class="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:flex-none lg:px-20 xl:px-24 bg-surface lg:w-[600px] xl:w-[680px]">
      <div class="mx-auto w-full max-w-sm lg:w-96">
        <!-- Mobile Logo (Visible only on small screens) -->
        <div class="mb-10 lg:hidden flex justify-center">
          <img src="../assets/weixies-logo.svg" alt="Weixies" class="w-16 h-16 object-contain" />
        </div>

        <div class="flex flex-col text-center lg:text-left mb-8">
          <h2 class="text-3xl font-bold tracking-tight text-text-main">Create Account</h2>
          <p class="mt-2 text-sm text-text-muted">
            Join Weixies today to start browsing and downloading.
          </p>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-5">
          <div class="space-y-4">
            <!-- Full Name Input -->
            <div>
              <label class="block text-sm font-medium leading-6 text-text-main mb-1.5 ml-1">Full Name</label>
              <div class="relative rounded-md shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input v-model="fullName" type="text" placeholder="John Doe"
                  class="block w-full rounded-xl border border-bg-alt/50 py-3.5 pl-11 bg-bg-alt/50 focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-text-main placeholder:text-text-muted/50"
                  required />
              </div>
            </div>

            <!-- Email Input -->
            <div>
              <label class="block text-sm font-medium leading-6 text-text-main mb-1.5 ml-1">Email address</label>
              <div class="relative rounded-md shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <input v-model="email" type="email" placeholder="Enter your email"
                  class="block w-full rounded-xl border border-bg-alt/50 py-3.5 pl-11 bg-bg-alt/50 focus:bg-surface focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-text-main placeholder:text-text-muted/50"
                  required />
              </div>
            </div>

            <!-- Password Input -->
            <div>
              <label class="block text-sm font-medium leading-6 text-text-main mb-1.5 ml-1">Password</label>
              <div class="relative rounded-md shadow-sm">
                <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input v-model="password" :type="showPassword ? 'text' : 'password'" placeholder="••••••••"
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

          <button :disabled="isLoading"
            class="flex w-full justify-center items-center gap-2 rounded-xl bg-primary px-3 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:shadow-primary-dark/30 hover:-translate-y-0.5 hover:bg-primary-dark transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none mt-4">
            <span v-if="isLoading">Creating account...</span>
            <span v-else>Sign Up</span>
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
              <span class="bg-surface px-6 text-text-muted">Already registered?</span>
            </div>
          </div>
          
          <div class="mt-6 text-center">
            <NuxtLink to="/login" class="text-primary font-bold hover:underline">Log in to your account</NuxtLink>
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
