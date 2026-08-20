<template>
    <section id="about" class="overflow-hidden bg-bg-alt py-20 md:py-28 lg:py-36" v-if="store.about">
        <div class="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
            <div class="flex flex-col items-center text-center">
                <h2 class="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary md:text-base">{{ store.about.title }}</h2>
                <h3 class="max-w-4xl text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl md:text-5xl lg:text-6xl">
                    {{ store.about.subtitle }}
                </h3>
                <p class="mt-8 max-w-2xl text-base font-medium leading-relaxed text-text-muted sm:text-lg lg:text-xl">
                    {{ store.about.description }}
                </p>
                <div class="mt-10 h-1 w-24 rounded-full bg-primary"></div>
            </div>
        </div>
    </section>
</template>

<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'
const store = useWelcomeStore()
</script>
