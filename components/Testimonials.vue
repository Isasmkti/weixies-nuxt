<template>
    <section id="testimonials" class="overflow-hidden bg-surface py-20 md:py-28 lg:py-36">
        <div class="relative mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div class="relative">
                <div class="mb-14 text-center lg:flex lg:items-end lg:justify-between lg:text-left md:mb-16">
                    <div class="lg:max-w-2xl">
                        <h2 class="mb-6 text-xs font-black uppercase tracking-[0.3em] text-primary md:text-sm">{{ store.testimonialsContent.eyebrow }}</h2>
                        <h3 class="text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl md:text-5xl lg:text-6xl">
                            {{ store.testimonialsContent.title }} <span class="italic text-primary">{{ store.testimonialsContent.highlight }}</span>
                        </h3>
                    </div>
                    <div class="mt-6 hidden lg:block lg:mt-0">
                        <p class="max-w-sm text-base font-medium leading-relaxed text-text-muted opacity-70 sm:text-lg">
                            {{ store.testimonialsContent.description }}
                        </p>
                    </div>
                </div>

                <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
                    <div v-for="testimonial in store.testimonials" :key="testimonial.id"
                        class="group relative rounded-[2rem] border border-text-main/5 bg-bg-alt/40 p-8 transition-all duration-300 hover:-translate-y-2 hover:border-primary/20 hover:bg-surface hover:shadow-2xl hover:shadow-primary/10 md:p-10">

                        <div class="absolute -left-4 -top-6 text-primary opacity-20 transition-opacity group-hover:opacity-100">
                            <svg class="h-14 w-14 fill-current" viewBox="0 0 32 32" aria-hidden="true">
                                <path d="M10 8v8H6v-8h4zm12 8h-4v-8h4v8zm-4-10H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </div>

                        <blockquote class="relative z-10 mt-4 text-text-main">
                            <p class="text-base font-bold leading-relaxed tracking-tight transition-colors group-hover:text-primary sm:text-lg">
                                "{{ testimonial.quote }}"
                            </p>
                        </blockquote>

                        <div class="mt-8 flex items-center">
                            <div class="relative">
                                <img v-if="testimonial.image" class="h-12 w-12 rounded-2xl bg-bg-alt object-cover shadow-lg ring-4 ring-surface transition-all group-hover:ring-primary/10 sm:h-14 sm:w-14" :src="testimonial.image" :alt="testimonial.author" />
                                <span v-else class="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-black text-primary ring-4 ring-surface sm:h-14 sm:w-14">{{ testimonial.author?.charAt(0) || '?' }}</span>
                                <div class="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-surface bg-green-500 shadow-sm sm:h-5 sm:w-5"></div>
                            </div>
                            <div class="ml-4 sm:ml-6">
                                <div class="text-base font-black leading-tight text-text-main sm:text-lg">{{ testimonial.author }}</div>
                                <div class="mt-1 text-sm font-bold tracking-tight text-text-muted sm:text-base">{{ testimonial.role }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'
const store = useWelcomeStore()
</script>
