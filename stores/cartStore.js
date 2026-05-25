import { defineStore } from 'pinia'
import * as cartService from '../services/cartService'

export const useCartStore = defineStore('cart', {
    state: () => ({
        cart: null,
        items: [],
        loading: false,
        error: null,
        // Using an object for better reactivity and serialization compatibility
        addingProducts: {} 
    }),
    actions: {
        async stGetCart(profileId) {
            if (!profileId) return
            try {
                this.loading = true
                this.error = null
                const { cart, items } = await cartService.sGetCart(profileId)
                this.cart = cart
                this.items = items
            } catch (err) {
                this.error = err.message
            } finally {
                this.loading = false
            }
        },

        async stAddToCart(profileId, productId) {
            if (!profileId) return
            
            // 1. Trace the specific product being added
            if (this.addingProducts[productId]) return; 
            
            // 2. OPTIMISTIC UPDATE
            this.addingProducts[productId] = true;

            try {
                this.loading = true
                const newItems = await cartService.sAddToCart(profileId, productId)
                
                // 3. SECURE UPDATE
                this.items = newItems;
            } catch (err) {
                this.error = err.message
                console.error('Add to Cart failed:', err)
                throw err
            } finally {
                delete this.addingProducts[productId];
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
