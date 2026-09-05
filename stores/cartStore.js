import { defineStore } from 'pinia'
import * as cartService from '../services/cartService'
const pendingReads = new WeakMap()

export const useCartStore = defineStore('cart', {
    state: () => ({
        cart: null,
        items: [],
        loading: false,
        error: null,
        profileId: null,
        // Using an object for better reactivity and serialization compatibility
        addingProducts: {} 
    }),
    actions: {
        async stGetCart(profileId) {
            if (!profileId) return
            const pending = pendingReads.get(this)
            if (pending?.profileId === profileId && this.profileId === profileId) return pending.promise
            if (this.profileId !== profileId) {
                this.cart = null
                this.items = []
            }
            this.profileId = profileId
            const request = this.loadCart(profileId)
            pendingReads.set(this, { profileId, promise: request })
            try {
                return await request
            } finally {
                if (pendingReads.get(this)?.promise === request) pendingReads.delete(this)
            }
        },
        async loadCart(profileId) {
            try {
                this.loading = true
                this.error = null
                const { cart, items } = await cartService.sGetCart(profileId)
                if (this.profileId !== profileId) return
                this.cart = cart
                this.items = items
            } catch (err) {
                if (this.profileId === profileId) this.error = err.message
            } finally {
                if (this.profileId === profileId) this.loading = false
            }
        },

        async stAddToCart(profileId, productId, productLicenseId) {
            if (!profileId) return
            if (!productLicenseId) throw new Error('Choose a product license before adding this item to the cart.')
            const addingKey = `${productId}:${productLicenseId}`
            
            // 1. Trace the specific product being added
            if (this.addingProducts[addingKey]) return;
            
            // 2. OPTIMISTIC UPDATE
            this.addingProducts[addingKey] = true;

            try {
                this.loading = true
                const newItems = await cartService.sAddToCart(profileId, productId, productLicenseId)
                
                // 3. SECURE UPDATE
                this.items = newItems;
            } catch (err) {
                this.error = err.message
                console.error('Add to Cart failed:', err)
                throw err
            } finally {
                delete this.addingProducts[addingKey];
                this.loading = false
            }
        },
        async stRemoveFromCart(itemId) {
            try {
                this.loading = true
                await cartService.sRemoveFromCart(itemId)
                this.items = this.items.filter(i => i.id !== itemId)
            } catch (err) {
                this.error = err.message
            } finally {
                this.loading = false
            }
        }
    }
})
