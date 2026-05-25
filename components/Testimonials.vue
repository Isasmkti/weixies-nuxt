<template>
    <section class="py-24 bg-surface overflow-hidden md:py-32 lg:py-48">
        <div class="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div class="relative">
                <div class="text-center mb-16 md:mb-24 lg:text-left lg:flex lg:items-end lg:justify-between">
                    <div class="lg:max-w-2xl">
                        <h2 class="text-xs md:text-sm font-black text-primary tracking-[0.3em] uppercase mb-6">Testimonials</h2>
                        <h3 class="text-4xl sm:text-5xl md:text-6xl font-black text-text-main tracking-tight leading-tight">
                            Trusted by industry leading <span class="text-primary italic">innovators</span>
                        </h3>
                    </div>
                    <div class="hidden lg:block">
                        <p class="text-lg text-text-muted max-w-sm font-medium leading-relaxed opacity-70">
                            Join 1,000+ companies worldwide who rely on Weixies for high-performance web products.
                        </p>
                    </div>
                </div>

                <div class="grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-12">
                    <div v-for="testimonial in store.testimonials" :key="testimonial.id"
                        class="group bg-bg-alt/40 border border-text-main/5 rounded-[2.5rem] p-10 md:p-12 transition-all duration-300 hover:shadow-2xl hover:bg-white hover:-translate-y-2 relative">
                        
                        <!-- Floating Quote Icon -->
                        <div class="absolute -top-6 -left-4 text-primary opacity-20 group-hover:opacity-100 transition-opacity">
                            <svg class="h-16 w-16 fill-current" viewBox="0 0 32 32" aria-hidden="true">
                                <path d="M10 8v8H6v-8h4zm12 8h-4v-8h4v8zm-4-10H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                            </svg>
                        </div>

                        <blockquote class="mt-4 text-text-main relative z-10">
                            <p class="text-lg sm:text-xl font-bold leading-relaxed tracking-tight group-hover:text-primary transition-colors">
                                "{{ testimonial.quote }}"
                            </p>
                        </blockquote>

                        <div class="mt-10 flex items-center">
                            <div class="relative">
                                <img class="h-14 w-14 rounded-2xl bg-gray-300 shadow-lg object-cover ring-4 ring-white group-hover:ring-primary/10 transition-all" :src="testimonial.image" alt="" />
                                <div class="absolute -bottom-1 -right-1 h-5 w-5 bg-green-500 border-4 border-white rounded-full shadow-sm"></div>
                            </div>
                            <div class="ml-6">
                                <div class="text-base sm:text-lg font-black text-text-main leading-tight">{{ testimonial.author }}</div>
                                <div class="text-sm sm:text-base text-text-muted font-bold tracking-tight mt-1">{{ testimonial.role }}</div>
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
