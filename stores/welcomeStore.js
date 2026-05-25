import { defineStore } from 'pinia'

const DUMMY_DATA = {
    hero: {
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1920&q=80',
        title: 'Welcome to Weixies',
        description: 'Discover premium products crafted for the modern lifestyle. Shop smart, live better.'
    },
    about: {
        title: 'About Us',
        subtitle: 'We exist to make great products accessible to everyone.',
        description: 'Weixies was founded with one simple belief — everyone deserves access to quality products at fair prices. We partner with the best brands and artisans to bring you a curated selection of goods that make life a little better every day.'
    },
    features: [
        { name: 'Global Shipping', description: 'Fast and reliable delivery to over 120 countries worldwide.', icon: 'globe' },
        { name: 'Best Prices', description: 'Competitive pricing with regular sales and exclusive member deals.', icon: 'scale' },
        { name: 'Lightning Fast', description: 'Optimized checkout in seconds. Your time is precious.', icon: 'lightning' },
        { name: 'Secure & Safe', description: 'End-to-end encrypted payments and buyer protection on every order.', icon: 'shield' }
    ],
    products: [
        { id: 1, name: 'Premium Wireless Headphones', imageSrc: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80', imageAlt: 'Wireless headphones' },
        { id: 2, name: 'Minimalist Watch Collection', imageSrc: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80', imageAlt: 'Minimalist watch' },
        { id: 3, name: 'Artisan Leather Bag', imageSrc: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&q=80', imageAlt: 'Leather bag' },
        { id: 4, name: 'Smart Home Speaker', imageSrc: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80', imageAlt: 'Smart speaker' },
        { id: 5, name: 'Ergonomic Office Chair', imageSrc: 'https://images.unsplash.com/photo-1592078615290-033ee584e267?w=500&q=80', imageAlt: 'Office chair' },
        { id: 6, name: 'Portable Camera Drone', imageSrc: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=500&q=80', imageAlt: 'Camera drone' }
    ],
    testimonials: [
        {
            id: 1,
            quote: 'Weixies transformed how our team shops for office supplies. Fast delivery, great prices, and the quality is consistently outstanding.',
            image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80',
            author: 'Sarah Johnson',
            role: 'Operations Manager, TechCorp'
        },
        {
            id: 2,
            quote: "I've been a loyal customer for two years. The curated selection and seamless checkout experience keeps me coming back.",
            image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&q=80',
            author: 'Michael Chen',
            role: 'Founder, Design Studio'
        },
        {
            id: 3,
            quote: 'The product quality exceeded my expectations. Customer support was responsive and resolved my query within minutes.',
            image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80',
            author: 'Emma Williams',
            role: 'Creative Director, Brand Co.'
        }
    ],
    cta: {
        title: 'Start shopping today.',
        subtitle: 'No subscriptions. Just great products.',
        btnPrimary: 'Browse Catalog',
        btnSecondary: 'Learn More'
    }
}

export const useWelcomeStore = defineStore('welcome', {
    state: () => ({
        hero: null,
        about: null,
        features: [],
        products: [],
        testimonials: [],
        cta: null,
        loading: false,
        error: null
    }),
    actions: {
        async stAll() {
            try {
                this.loading = true
                this.hero = DUMMY_DATA.hero
                this.about = DUMMY_DATA.about
                this.features = DUMMY_DATA.features
                this.products = DUMMY_DATA.products
                this.testimonials = DUMMY_DATA.testimonials
                this.cta = DUMMY_DATA.cta
            } catch (err) {
                this.error = err.message
            } finally {
                this.loading = false
            }
        }
    }
})
