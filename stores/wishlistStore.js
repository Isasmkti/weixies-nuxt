import { defineStore } from 'pinia'
import * as wishlistService from '../services/wishlistService'
const pendingReads = new WeakMap()

export const useWishlistStore = defineStore('wishlist', {
    state: () => ({
        items: [],
        loading: false,
        error: null,
        profileId: null,
        togglingProducts: {} // to track which product is being toggled
    }),
    getters: {
        isWishlisted: (state) => (productId) => {
            return state.items.some(item => String(item.product_id) === String(productId))
        },
        isToggling: (state) => (productId) => {
            return Boolean(state.togglingProducts[String(productId)])
        }
    },
    actions: {
        async stGetWishlists(profileId) {
            if (!profileId) return
            const pending = pendingReads.get(this)
            if (pending?.profileId === profileId && this.profileId === profileId) return pending.promise
            if (this.profileId !== profileId) this.items = []
            this.profileId = profileId
            const request = this.loadWishlists(profileId)
            pendingReads.set(this, { profileId, promise: request })
            try {
                return await request
            } finally {
                if (pendingReads.get(this)?.promise === request) pendingReads.delete(this)
            }
        },
        async loadWishlists(profileId) {
            try {
                this.loading = true
                this.error = null
                const items = await wishlistService.sGetWishlists(profileId)
                if (this.profileId !== profileId) return
                this.items = items
            } catch (err) {
                if (this.profileId === profileId) this.error = err.message
            } finally {
                if (this.profileId === profileId) this.loading = false
            }
        },

        async stToggleWishlist(profileId, productId) {
            if (!profileId) return
            const productKey = String(productId)
            if (this.togglingProducts[productKey]) return

            this.togglingProducts = { ...this.togglingProducts, [productKey]: true }
            this.error = null

            // Find if currently wishlisted locally
            const currentlyWishlisted = this.isWishlisted(productId)
            
            // OPTIMISTIC UPDATE
            const backupItems = [...this.items]
            if (currentlyWishlisted) {
                this.items = this.items.filter(item => String(item.product_id) !== productKey)
            } else {
                // just a placeholder, full product data will be fetch on next reload or we can just fetch it all again
                this.items = [...this.items, { profile_id: profileId, product_id: productId, product: {} }]
            }

            try {
                await wishlistService.sToggleWishlist(profileId, productId, currentlyWishlisted)
                
                // Fetch the list again to have exact relationships and data
                this.items = await wishlistService.sGetWishlists(profileId)
            } catch (err) {
                this.error = err.message
                // ROLLBACK
                this.items = backupItems
                console.error('Toggle Wishlist failed:', err)
                throw err
            } finally {
                const remainingProducts = { ...this.togglingProducts }
                delete remainingProducts[productKey]
                this.togglingProducts = remainingProducts
            }
        }
    }
})
