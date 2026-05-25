import { defineStore } from 'pinia'
import * as categoriesService from '../services/categoriesService'

export const useCategoriesStore = defineStore('categories', {
    state: () => ({
        categories: [],
        loading: false,
        error: null
    }),

    actions: {
        async fetchCategories() {
            this.loading = true
            this.error = null
            try {
                const data = await categoriesService.sAll()
                this.categories = data
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
