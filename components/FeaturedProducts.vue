<template>
    <div class="overflow-hidden bg-bg-alt py-20 md:py-28 lg:py-36">
        <div class="mx-auto mb-12 max-w-7xl px-6 sm:px-8 lg:px-12 md:mb-16">
            <h2 class="text-center text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl md:text-5xl lg:text-6xl">Products Overview</h2>
            <p class="mx-auto mt-4 max-w-2xl text-center text-base font-medium leading-relaxed text-text-muted opacity-80 sm:text-lg md:mt-6 md:text-xl">
                Explore our portfolio of successful products that drive value and innovation.
            </p>
        </div>

        <div class="group relative flex w-full overflow-x-hidden py-8 md:py-10">
            <div class="animate-scroll flex space-x-8 px-6 sm:space-x-10">
                <div v-for="project in [...store.products, ...store.products, ...store.products]" :key="project.id + '-' + Math.random()"
                    class="group/card relative h-[320px] w-[280px] flex-none overflow-hidden rounded-[1.75rem] shadow-2xl transition-all duration-700 hover:rotate-1 hover:scale-[1.03] sm:h-[380px] sm:w-[420px] md:h-[420px] md:w-[480px]">
                    <img :src="project.imageSrc" :alt="project.imageAlt" class="h-full w-full scale-105 object-cover grayscale transition-all duration-700 group-hover/card:scale-100 group-hover/card:grayscale-0">
                    <div
                        class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover/card:opacity-60">
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 translate-y-4 p-6 transition-transform duration-500 group-hover/card:translate-y-0 sm:p-8 md:p-10">
                        <p class="mb-2 text-xs font-black uppercase tracking-[0.25em] text-primary">Featured Project</p>
                        <h3 class="text-2xl font-black tracking-tight text-white sm:text-3xl">{{ project.name }}</h3>
                        <div class="mt-4 flex items-center text-white/60 transition-colors group-hover/card:text-white">
                            <span class="border-b border-transparent pb-1 text-sm font-bold group-hover/card:border-white">View Details</span>
                            <svg xmlns="http://www.w3.org/2000/svg" class="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M9 5l7 7-7 7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.animate-scroll {
    display: flex;
    width: max-content;
    animation: scroll 60s linear infinite;
}

/* Pause animation when the parent group is hovered */
.group:hover .animate-scroll {
    animation-play-state: paused;
}

@keyframes scroll {
    0% {
        transform: translateX(0);
    }
    100% {
        transform: translateX(calc(-33.33% - 1rem)); /* Account for duplicate segments */
    }
}
</style>

<script setup>
import { useWelcomeStore } from '../stores/welcomeStore'
const store = useWelcomeStore()
</script>
