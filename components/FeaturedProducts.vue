<template>
    <div class="bg-bg-alt overflow-hidden py-24 md:py-32">
        <div class="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 mb-16 md:mb-20">
            <h2 class="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-text-main text-center leading-tight">Products Overview</h2>
            <p class="mt-4 md:mt-8 max-w-2xl text-lg sm:text-xl md:text-2xl text-text-muted mx-auto text-center font-medium opacity-80">
                Explore our portfolio of successful products that drive value and innovation.
            </p>
        </div>

        <!-- Carousel Container -->
        <div class="relative w-full flex overflow-x-hidden group py-10">
            <!-- Scrolling Track (Duplicated for infinite effect) -->
            <div class="animate-scroll flex space-x-12 px-6">
                <!-- Combined set of products -->
                <div v-for="project in [...store.products, ...store.products, ...store.products]" :key="project.id + '-' + Math.random()"
                    class="flex-none w-[280px] sm:w-[500px] h-[350px] sm:h-[450px] relative rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-700 transform hover:scale-[1.03] hover:rotate-1 group/card">
                    <img :src="project.imageSrc" :alt="project.imageAlt" class="w-full h-full object-cover grayscale transition-all duration-700 group-hover/card:grayscale-0 scale-105 group-hover/card:scale-100">
                    <div
                        class="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 group-hover/card:opacity-60 transition-opacity duration-500">
                    </div>
                    <div class="absolute bottom-0 left-0 right-0 p-8 sm:p-12 transform translate-y-4 group-hover/card:translate-y-0 transition-transform duration-500">
                        <p class="text-primary text-xs font-black tracking-widest uppercase mb-2">Featured Project</p>
                        <h3 class="text-white text-2xl sm:text-3xl font-black tracking-tight">{{ project.name }}</h3>
                        <div class="mt-4 flex items-center text-white/50 group-hover/card:text-white transition-colors">
                            <span class="text-sm font-bold border-b border-transparent group-hover/card:border-white pb-1">View Details</span>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
