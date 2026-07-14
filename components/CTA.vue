<template>
    <div class="px-4 py-16 sm:px-6 md:py-20 lg:px-8" v-if="store.cta">
        <div class="group relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-primary p-8 shadow-2xl sm:p-10 md:rounded-[3rem] md:p-14 lg:p-16">
            <div class="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] -translate-y-1/2 translate-x-1/4 rounded-full bg-white/10 blur-3xl transition-transform duration-1000 group-hover:scale-125"></div>
            <div class="pointer-events-none absolute bottom-0 left-0 h-[400px] w-[400px] translate-y-1/2 -translate-x-1/4 rounded-full bg-primary-dark/30 blur-3xl transition-transform duration-1000 group-hover:scale-110"></div>

            <div class="relative z-10 flex flex-col gap-10 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left lg:gap-20">
                <div class="max-w-2xl">
                    <h2 class="mb-8 inline-block rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.35em] text-white md:text-sm">Call to action</h2>
                    <h3 class="text-3xl font-black leading-[1.05] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
                        {{ store.cta.title }}
                        <span class="mt-2 block text-white/70 italic">{{ store.cta.subtitle }}</span>
                    </h3>
                </div>

                <div class="flex w-full flex-col items-center justify-center gap-4 sm:flex-row lg:w-auto lg:justify-end">
                    <a href="#"
                        class="inline-flex w-full items-center justify-center rounded-3xl border-none bg-white px-8 py-4 text-sm font-black text-primary shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-bg-alt active:scale-95 sm:w-auto sm:text-base">
                        {{ store.cta.btnPrimary }}
                        <svg xmlns="http://www.w3.org/2000/svg" class="ml-3 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                    <a href="#"
                        class="inline-flex w-full items-center justify-center rounded-3xl border-2 border-white/30 bg-transparent px-8 py-4 text-sm font-black text-white transition-all duration-300 hover:border-white hover:bg-white/10 sm:w-auto sm:text-base">
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
