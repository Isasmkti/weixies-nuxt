<template>
    <section id="features" class="bg-surface py-20 md:py-28 lg:py-36">
        <div class="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
            <div class="mb-14 text-center lg:mb-16">
                <h2 class="flex h-8 items-center justify-center text-xs font-black uppercase tracking-[0.25em] text-primary md:text-sm">{{ store.featuresContent.eyebrow }}</h2>
                <h3 class="mt-4 text-3xl font-black leading-tight tracking-tight text-text-main sm:text-4xl md:text-5xl lg:text-6xl">
                    {{ store.featuresContent.title }}
                </h3>
                <p class="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-text-muted sm:text-lg md:text-xl">
                    {{ store.featuresContent.description }}
                </p>
            </div>

            <div class="mt-12 md:mt-14">
                <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4 lg:gap-10">
                    <div v-for="feature in store.features" :key="feature.id || feature.name"
                        class="group relative flex flex-col rounded-[1.75rem] border border-text-main/5 bg-bg-alt/60 p-6 transition-all duration-300 hover:-translate-y-2 hover:border-primary/20 hover:bg-surface hover:shadow-2xl hover:shadow-primary/10 sm:p-8">
                        <div
                            class="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30 transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16">
                            <component :is="getIcon(feature.icon)" class="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
                        </div>
                        <h4 class="mb-3 text-xl font-black text-text-main sm:text-2xl">{{ feature.name }}</h4>
                        <p class="text-base font-medium leading-relaxed text-text-muted sm:text-lg">
                            {{ feature.description }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>
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
