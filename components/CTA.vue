<template>
    <div class="px-6 sm:px-12 py-16 md:py-24" v-if="store.cta">
        <div class="max-w-7xl mx-auto rounded-[3.5rem] bg-primary relative overflow-hidden shadow-2xl p-10 md:p-24 lg:p-32 group">
            
            <!-- Background Decoration -->
            <div class="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
            <div class="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 h-[400px] w-[400px] rounded-full bg-primary-dark/30 blur-3xl pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>

            <div class="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between text-center lg:text-left gap-12 lg:gap-20">
                <div class="max-w-2xl">
                    <h2 class="text-xs md:text-sm font-black text-white px-4 py-2 bg-white/10 rounded-full inline-block mb-10 tracking-[0.35em] uppercase border border-white/20">Call to action</h2>
                    <h3 class="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white leading-[1.1]">
                        {{ store.cta.title }}
                        <span class="block text-white/70 italic mt-2">{{ store.cta.subtitle }}</span>
                    </h3>
                </div>

                <div class="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-6 w-full lg:w-auto">
                    <a href="#"
                        class="w-full sm:w-auto inline-flex items-center justify-center px-10 py-5 border-none text-lg font-black rounded-3xl text-primary bg-white shadow-2xl hover:bg-bg-alt hover:scale-110 active:scale-95 transition-all duration-300">
                        {{ store.cta.btnPrimary }}
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                    <a href="#"
                        class="w-full sm:w-auto inline-flex items-center justify-center px-10 py-5 border-2 border-white/30 text-lg font-black rounded-3xl text-white bg-transparent hover:bg-white/10 hover:border-white transition-all duration-300">
                        {{ store.cta.btnSecondary }}
                    </a>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'
const store = useWelcomeStore()
</script>
