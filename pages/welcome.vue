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
definePageMeta({ layout: false })
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
