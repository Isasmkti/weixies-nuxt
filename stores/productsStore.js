import { defineStore } from 'pinia'
import * as productsService from '../services/productsService'

const FETCH_TIMEOUT_MS = 15000

function withTimeout(promise, timeoutMs = FETCH_TIMEOUT_MS) {
    let timeoutId

    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Request timed out while loading products'))
            }, timeoutMs)
        })
    ]).finally(() => {
        clearTimeout(timeoutId)
    })
}

export const useProductsStore = defineStore('products', {
    state: () => ({
        products: [],
        total: 0,
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc',
        search: '',
        categorySlug: [],
        minPrice: null,
        maxPrice: null,
        requestId: 0,
        loading: false,
        error: null
    }),
    getters: {
        totalPages(state) {
            return Math.ceil(state.total / state.limit)
        }
    },

    actions: {


        _mapProduct(product) {
            if (!product) return null;

            let main = null;
            if (product?.product_images && product.product_images.length > 0) {
                const primary = product.product_images.find(img => img.is_primary);
                if (primary && primary.image_url) main = primary.image_url;
                else if (product.product_images[0]?.image_url) main = product.product_images[0].image_url;
            } else if (product?.image_url) {
                main = product.image_url;
            }

            // Reconstruct categories from the product_categories join table
            // to match the requested relational structure (p.id, p.name, c.id, c.name).
            const categories = (product.product_categories || [])
                .map(pc => {
                    if (!pc.categories) return null;
                    return {
                        category_id: pc.categories.id,
                        category_name: pc.categories.name,
                        ...pc.categories // keep original properties like name, slug
                    };
                })
                .filter(Boolean);

            const reviews = product.reviews || [];
            const reviewCount = reviews.length;
            const averageRating = reviewCount > 0
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
                : 0;

            return {
                ...product,
                // Explicitly alias to match the SQL query's preferred names
                product_id: product.id,
                product_name: product.name,
                image_url: main,
                main_image: main,
                categories,
                reviews,
                reviewCount,
                averageRating
            };
        },

        async stAll(page, options = {}) {
            const parsedPage = Number(page)
            const targetPage = Number.isFinite(parsedPage) && parsedPage > 0
                ? Math.floor(parsedPage)
                : this.page
            const {
                limit = this.limit,
                sortBy = this.sortBy,
                sortOrder = this.sortOrder,
                search = this.search,
                categorySlug = this.categorySlug,
                minPrice = this.minPrice,
                maxPrice = this.maxPrice,
                force = false
            } = options
            const parsedLimit = Number(limit)
            const targetLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
                ? Math.floor(parsedLimit)
                : this.limit

            const normalizedCategorySlug = Array.isArray(categorySlug)
                ? categorySlug
                : (categorySlug ? [categorySlug] : [])

            const filtersChanged = (
                targetPage !== this.page ||
                targetLimit !== Number(this.limit) ||
                sortBy !== this.sortBy ||
                sortOrder !== this.sortOrder ||
                search !== this.search ||
                JSON.stringify(normalizedCategorySlug) !== JSON.stringify(this.categorySlug) ||
                Number(minPrice) !== Number(this.minPrice) ||
                Number(maxPrice) !== Number(this.maxPrice)
            )

            const shouldSkip = !force && !this.loading && this.products.length > 0 && this.total > 0 && !filtersChanged

            if (shouldSkip) {
                return { data: this.products, total: this.total, page: this.page }
            }

            const current = ++this.requestId
            this.loading = true
            this.error = null

            try {
                let resolvedPage = targetPage
                let res = await withTimeout(
                    productsService.sAll(
                        targetPage,
                        targetLimit,
                        sortBy,
                        sortOrder,
                        search,
                        normalizedCategorySlug,
                        minPrice,
                        maxPrice
                    )
                )

                if (current !== this.requestId) return

                const firstTotal = Number(res?.total) || 0
                const lastAvailablePage = Math.ceil(firstTotal / targetLimit)

                // A product can disappear between page changes (for example after
                // moderation). Recover to the final valid page instead of leaving
                // the catalog on an empty, out-of-range page.
                if (lastAvailablePage > 0 && targetPage > lastAvailablePage) {
                    resolvedPage = lastAvailablePage
                    res = await withTimeout(
                        productsService.sAll(
                            resolvedPage,
                            targetLimit,
                            sortBy,
                            sortOrder,
                            search,
                            normalizedCategorySlug,
                            minPrice,
                            maxPrice
                        )
                    )

                    if (current !== this.requestId) return
                } else if (firstTotal === 0) {
                    resolvedPage = 1
                }

                const rawData = Array.isArray(res?.data) ? res.data : []
                this.products = rawData.map(p => this._mapProduct(p))
                this.total = Number(res?.total) || 0
                this.page = resolvedPage
                this.limit = targetLimit
                this.sortBy = sortBy
                this.sortOrder = sortOrder
                this.search = search
                this.categorySlug = normalizedCategorySlug
                this.minPrice = minPrice !== null && minPrice !== '' && Number.isFinite(Number(minPrice)) && Number(minPrice) >= 0 ? Number(minPrice) : null
                this.maxPrice = maxPrice !== null && maxPrice !== '' && Number.isFinite(Number(maxPrice)) && Number(maxPrice) >= 0 ? Number(maxPrice) : null

                return { data: this.products, total: this.total, page: this.page }
            } catch (err) {
                if (current === this.requestId) {
                    this.error = err.message || 'Failed to load products'
                }
                throw err
            } finally {
                if (current === this.requestId) {
                    this.loading = false
                }
            }
        },

        async ensureProductsLoaded(options = {}) {
            return this.stAll(options.page, options)
        },

        setSearch(val) {
            this.search = val
            this.page = 1
            this.stAll(1, { force: true })
        },

        setCategory(slug) {
            if (!Array.isArray(this.categorySlug)) {
                this.categorySlug = this.categorySlug ? [this.categorySlug] : []
            }
            const index = this.categorySlug.indexOf(slug)
            if (index > -1) {
                this.categorySlug.splice(index, 1) // hapus jika sudah ada
            } else {
                this.categorySlug.push(slug) // tambah jika belum ada
            }
            this.page = 1
            this.stAll(1, { force: true })
        },

        clearCategories() {
            this.categorySlug = []
            this.page = 1
            this.stAll(1, { force: true })
        },

        setPriceRange(minPrice, maxPrice) {
            const normalizedMin = minPrice !== null && minPrice !== '' && Number.isFinite(Number(minPrice)) && Number(minPrice) >= 0 ? Number(minPrice) : null
            const normalizedMax = maxPrice !== null && maxPrice !== '' && Number.isFinite(Number(maxPrice)) && Number(maxPrice) >= 0 ? Number(maxPrice) : null

            if (normalizedMin !== null && normalizedMax !== null && normalizedMin > normalizedMax) {
                throw new Error('Minimum price cannot be greater than maximum price.')
            }

            this.minPrice = normalizedMin
            this.maxPrice = normalizedMax
            this.page = 1
            return this.stAll(1, { force: true })
        },

        changeSort(sort) {
            this.sortBy = sort.by
            this.sortOrder = sort.order
            this.page = 1
            this.stAll(1, { force: true })
        },

        async sGetBySlug(slug) {
            try {
                const raw = await productsService.sGetBySlug(slug)
                return this._mapProduct(raw)
            } catch (error) {
                throw error
            }
        },

        async createProduct(payload) {
            this.loading = true
            try {
                const { images, categoryIds, specs, licenses, syncImages, zipFile, ...productData } = payload
                const rawProduct = await productsService.sCreate(productData, images, categoryIds, zipFile, specs, syncImages, licenses)
                const newProduct = this._mapProduct(rawProduct)
                this.products.unshift(newProduct)
                return newProduct
            } catch (error) {
                this.error = error.message
                throw error
            } finally {
                this.loading = false
            }
        },

        async updateProduct(id, payload) {
            this.loading = true
            try {
                const { images, categoryIds, specs, licenses, syncImages, zipFile, ...productData } = payload
                const rawUpdated = await productsService.sUpdate(id, productData, images, categoryIds, zipFile, specs, syncImages, licenses)
                const updated = this._mapProduct(rawUpdated)
                const index = this.products.findIndex(p => p.id === id)
                if (index !== -1) {
                    this.products[index] = updated
                }
                return updated
            } catch (error) {
                this.error = error.message
                throw error
            } finally {
                this.loading = false
            }
        },

        async deleteProduct(id) {
            this.loading = true
            try {
                await productsService.sDelete(id)
                this.products = this.products.filter(p => p.id !== id)
            } catch (error) {
                this.error = error.message
                throw error
            } finally {
                this.loading = false
            }
        }

    }
})
