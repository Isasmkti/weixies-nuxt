import { defineStore } from 'pinia'
import * as categoriesService from '../services/categoriesService'
const pendingRequests = new WeakMap()

export const useCategoriesStore = defineStore('categories', {
    state: () => ({
        categories: [],
        loading: false,
        error: null,
        fetchedAt: 0,
    }),

    actions: {
        async fetchCategories({ force = false } = {}) {
            if (pendingRequests.has(this)) return pendingRequests.get(this)
            if (!force && this.fetchedAt && Date.now() - this.fetchedAt < 60_000) return this.categories
            const request = this.loadCategories()
            pendingRequests.set(this, request)
            try {
                return await request
            } finally {
                pendingRequests.delete(this)
            }
        },
        async loadCategories() {
            this.loading = true
            this.error = null
            try {
                const data = await categoriesService.sAll()
                this.categories = data
                this.fetchedAt = Date.now()
                return data
            } catch (err) {
                this.error = err.message || 'Failed to fetch categories'
                console.error(err)
            } finally {
                this.loading = false
            }
        }
    }
})
