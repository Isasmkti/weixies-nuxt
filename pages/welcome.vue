<template>
  <div class="min-h-screen flex flex-col">
    <Navbar />
    <Hero />
    <Features />
    <About />
    <FeaturedProducts />
    <Testimonials />
    <CTA />
    <Footer />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWelcomeStore } from '../stores/welcomeStore'
import { SEO_DEFAULT_DESCRIPTION, seoDescription, serializeJsonLd } from '../utils/seo'

definePageMeta({ layout: false })

const welcomeStore = useWelcomeStore()
const { canonicalUrl, absoluteUrl } = useSeoSite()

await callOnce('welcome-public-content', () => welcomeStore.stAll())

const welcomeDescription = computed(() => seoDescription(welcomeStore.hero?.description, SEO_DEFAULT_DESCRIPTION))
const welcomeImage = computed(() => absoluteUrl(welcomeStore.hero?.image || '/weixies-logo.svg'))

useSeoMeta({
  title: 'Premium Digital Products Marketplace',
  description: () => welcomeDescription.value,
  ogTitle: 'Premium Digital Products Marketplace | Weixies',
  ogDescription: () => welcomeDescription.value,
  ogUrl: () => canonicalUrl.value,
  ogImage: () => welcomeImage.value,
  twitterTitle: 'Premium Digital Products Marketplace | Weixies',
  twitterDescription: () => welcomeDescription.value,
  twitterImage: () => welcomeImage.value,
})

useHead(() => ({
  script: [{
    key: 'website-jsonld',
    type: 'application/ld+json',
    textContent: serializeJsonLd({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Weixies',
      url: canonicalUrl.value,
      description: welcomeDescription.value,
    }),
  }],
}))
</script>

<script>
import Navbar from '../components/Navbar.vue';
import Footer from '../components/Footer.vue';
import Hero from '../components/Hero.vue';
import About from '../components/About.vue';
import Features from '../components/Features.vue';
import FeaturedProducts from '../components/FeaturedProducts.vue';
import Testimonials from '../components/Testimonials.vue';
import CTA from '../components/CTA.vue';

export default {
  name: 'Welcome',
  components: {
    Navbar,
    Footer,
    Hero,
    Features,
    About,
    FeaturedProducts,
    Testimonials,
    CTA,
  },
};
</script>
