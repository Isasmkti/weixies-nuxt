<template>
    <div class="py-24 md:py-32 bg-surface">
        <div class="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
            <div class="lg:text-center mb-20 lg:mb-24">
                <h2 class="text-xs md:text-sm text-primary font-black tracking-[0.25em] h-8 uppercase flex items-center lg:justify-center">Why Choose Us</h2>
                <h3 class="mt-4 text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter text-text-main leading-tight">
                    A better way to shop online
                </h3>
                <p class="mt-6 max-w-2xl text-lg sm:text-xl text-text-muted lg:mx-auto font-medium">
                    We prioritize your experience with top-tier services and premium quality products.
                </p>
            </div>

            <div class="mt-16 sm:mt-24">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-16 md:gap-y-20">
                    <div v-for="feature in store.features" :key="feature.name" 
                        class="group relative flex flex-col p-8 bg-bg-alt/50 border border-text-main/5 rounded-3xl transition-all duration-300 hover:shadow-2xl hover:bg-white hover:-translate-y-2">
                        <div
                            class="mb-8 flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 group-hover:scale-110 transition-transform">
                            <component :is="getIcon(feature.icon)" class="h-8 w-8" aria-hidden="true" />
                        </div>
                        <h4 class="text-xl md:text-2xl font-black text-text-main mb-4">{{ feature.name }}</h4>
                        <p class="text-base md:text-lg text-text-muted font-medium leading-relaxed">
                            {{ feature.description }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { h } from 'vue'
import { useWelcomeStore } from '../stores/welcomeStore'

const store = useWelcomeStore()

const GlobeIcon = h('svg', { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, [
    h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" })
])

const ScaleIcon = h('svg', { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, [
    h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 6l3 1 m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" })
])

const LightningBoltIcon = h('svg', { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, [
    h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" })
])

const ShieldCheckIcon = h('svg', { fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, [
    h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" })
])

const iconMap = {
    'globe': GlobeIcon,
    'scale': ScaleIcon,
    'lightning': LightningBoltIcon,
    'shield': ShieldCheckIcon
}

const getIcon = (iconName) => {
    return iconMap[iconName] || GlobeIcon
}
</script>
