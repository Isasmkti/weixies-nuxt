<template>
    <div class="py-20 md:py-32 lg:py-48 bg-bg-alt overflow-hidden" v-if="store.about">
        <div class="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
            <div class="flex flex-col items-center text-center">
                <h2 class="text-sm md:text-base font-bold text-primary tracking-[0.2em] uppercase mb-4">{{ store.about.title }}</h2>
                <h3 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-text-main tracking-tight leading-tight max-w-4xl">
                    {{ store.about.subtitle }}
                </h3>
                <p class="max-w-2xl mt-8 text-lg sm:text-xl lg:text-2xl text-text-muted leading-relaxed font-medium">
                    {{ store.about.description }}
                </p>
                <div class="mt-12 h-1 w-24 bg-primary rounded-full"></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'
const store = useWelcomeStore()
</script>
