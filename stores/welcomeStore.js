import { defineStore } from 'pinia'
import { sAll as getPublishedProducts } from '../services/productsService'
import { sAll as getWelcomeContent } from '../services/welcomeService'
import {
    cloneWelcomeContent,
    mergeWelcomeContent,
} from '../utils/welcomeContent'

export const useWelcomeStore = defineStore('welcome', {
    state: () => {
        const content = cloneWelcomeContent()

        return {
            navbar: content.navbar,
            hero: content.hero,
            featuresContent: content.features,
            features: content.features.items,
            about: content.about,
            testimonialsContent: content.testimonials,
            testimonials: content.testimonials.items,
            cta: content.cta,
            footer: content.footer,
            products: [],
            contentLoading: false,
            contentLoaded: false,
            contentAttempted: false,
            contentError: null,
            productsLoading: false,
            productsError: null,
            loading: false,
            error: null,
        }
    },
    actions: {
        applyContent(value) {
            const content = mergeWelcomeContent(value)
            this.navbar = content.navbar
            this.hero = content.hero
            this.featuresContent = content.features
            this.features = content.features.items || []
            this.about = content.about
            this.testimonialsContent = content.testimonials
            this.testimonials = content.testimonials.items || []
            this.cta = content.cta
            this.footer = content.footer
        },

        async stContent(force = false) {
            if (this.contentLoading) return
            if (!force && this.contentAttempted) return

            this.contentLoading = true
            this.contentAttempted = true
            this.contentError = null

            try {
                this.applyContent(await getWelcomeContent())
                this.contentLoaded = true
            } catch (error) {
                this.contentError = error.message || 'Failed to load welcome content'
            } finally {
                this.contentLoading = false
            }
        },

        async stProducts(force = false) {
            if (this.productsLoading) return
            if (!force && this.products.length > 0) return

            this.productsLoading = true
            this.productsError = null

            try {
                const { data } = await getPublishedProducts(1, 12, 'created_at', 'desc', '', [], null, null)
                this.products = data || []
            } catch (error) {
                this.productsError = error.message || 'Failed to load products'
            } finally {
                this.productsLoading = false
            }
        },

        async stAll(options = {}) {
            const force = Boolean(options.force)
            await Promise.all([
                this.stContent(force),
                this.stProducts(force),
            ])
        },
    },
})
