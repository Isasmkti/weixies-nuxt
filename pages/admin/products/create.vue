<template>
    
        <div class="max-w-3xl mx-auto font-poppins">
            <div class="flex items-center gap-4 mb-8">
                <NuxtLink to="/admin" class="text-text-muted hover:text-primary transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </NuxtLink>
                <h1 class="text-3xl font-extrabold text-text-main tracking-tight">{{ isEditMode ? 'Edit Product' :
                    'Create Product' }}</h1>
            </div>

            <div class="bg-surface p-8 rounded-2xl shadow-lg border border-bg-alt">
                <form @submit.prevent="handleSubmit" class="space-y-6">

                    <!-- Name -->
                    <div>
                        <label class="block text-sm font-semibold text-text-main mb-2">Product Name</label>
                        <input v-model="form.name" type="text" required
                            class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            placeholder="e.g. Premium Wireless Headphones">
                    </div>

                    <!-- Slug (Auto-generated or Manual) -->
                    <div>
                        <label class="block text-sm font-semibold text-text-main mb-2">Slug</label>
                        <input v-model="form.slug" type="text" 
                            class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 focus:ring-2 focus:ring-primary/30 outline-none transition-all font-mono text-sm"
                            placeholder="e.g. premium-wireless-headphones">
                        <p class="text-xs text-text-muted mt-1">Unique identifier for URL.</p>
                    </div>

                    <!-- Description -->
                    <div>
                        <label class="block text-sm font-semibold text-text-main mb-2">Description</label>
                        <textarea v-model="form.description" rows="4" required
                            class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                            placeholder="Detailed product description..."></textarea>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Price -->
                        <div>
                            <label class="block text-sm font-semibold text-text-main mb-2">Price (Rp)</label>
                            <input v-model.number="form.price" type="number" step="1" min="1" required
                                class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="0">
                        </div>
                    </div>

                    <!-- Categories -->
                    <div>
                        <label class="block text-sm font-semibold text-text-main mb-4">Categories</label>
                        <div v-if="categoriesStore.loading" class="text-text-muted text-sm italic">Loading categories...</div>
                        <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <label v-for="cat in categories" :key="cat.id" 
                                class="flex items-center gap-3 p-3 rounded-xl border border-bg-alt hover:border-primary/30 cursor-pointer transition-all bg-bg/50">
                                <input type="checkbox" :value="cat.id" v-model="form.categoryIds"
                                    class="h-5 w-5 rounded border-bg-alt text-primary focus:ring-primary/30">
                                <span class="text-sm font-medium text-text-main">{{ cat.name }}</span>
                            </label>
                        </div>
                        <div v-if="!categoriesStore.loading && categories.length === 0" class="text-text-muted text-sm border-2 border-dashed border-bg-alt rounded-xl p-4 text-center">
                            No categories defined in database.
                        </div>
                    </div>

                    <ProductSpecificationsEditor v-model="form.specs" :disabled="loading" />

                    <ProductLicensesEditor v-model="form.licenses" :base-price="form.price" :disabled="loading" />

                    <!-- Product Images -->
                    <div>
                        <ProductImageUploader v-model="form.images" input-name="admin-main-image" :disabled="loading" @changed="imagesDirty = true" />
                        <div>
                            <label class="block text-sm font-semibold text-text-main mb-2">Product ZIP File</label>
                            <input type="file" accept=".zip,application/zip,application/x-zip-compressed" :required="!existingZipFile" @change="handleZipChange"
                                class="w-full rounded-xl border border-bg-alt bg-bg px-4 py-3 focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm" />
                            <p class="text-xs text-text-muted mt-1">A ZIP file is required for new products. Maximum size: 200 MB.</p>
                            <p v-if="zipFile" class="text-sm font-medium text-text-main mt-2">Selected file: {{ zipFile.name }}</p>
                            <p v-else-if="existingZipFile" class="text-sm text-text-muted mt-2">Current ZIP: {{ existingZipFile.file_name }}</p>
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <div class="pt-4">
                        <button type="submit" :disabled="loading"
                            class="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-xl font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                            <svg v-if="loading" class="animate-spin h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                    stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                </path>
                            </svg>
                            <span>{{ isEditMode ? 'Update Product' : 'Create Product' }}</span>
                        </button>
                    </div>

                    <!-- Error Message -->
                    <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-200">
                        {{ error }}
                    </div>
                </form>
            </div>
        </div>
    
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useProductsStore } from '../../../stores/productsStore'
import { useCategoriesStore } from '../../../stores/categoriesStore'
import { sGetById } from '../../../services/productsService'
import ProductImageUploader from '../../../components/products/ProductImageUploader.vue'
import ProductSpecificationsEditor from '../../../components/products/ProductSpecificationsEditor.vue'
import ProductLicensesEditor from '../../../components/products/ProductLicensesEditor.vue'
import { createDefaultProductLicense } from '../../../utils/productLicenses'
import { validateProductSubmission, validateProductZip } from '../../../utils/productSubmission'

const route = useRoute()
const router = useRouter()
const productsStore = useProductsStore()
const categoriesStore = useCategoriesStore()

const isEditMode = computed(() => !!route.params.id)
const loading = ref(false)
const error = ref(null)

const categories = computed(() => categoriesStore.categories)

const form = ref({
    name: '',
    description: '',
    price: 0,
    slug: '',
    images: [],
    categoryIds: [], // Array of category UUIDs
    specs: [],
    licenses: [createDefaultProductLicense(0)]
})
const zipFile = ref(null)
const existingZipFile = ref(null)
const imagesDirty = ref(false)

const handleZipChange = (event) => {
    const file = event.target.files?.[0] ?? null
    try {
        validateProductZip(file)
    } catch (err) {
        event.target.value = ''
        error.value = err.message
        zipFile.value = null
        return
    }
    error.value = null
    zipFile.value = file
}

onMounted(async () => {
    // Always load categories
    categoriesStore.fetchCategories()

    if (isEditMode.value) {
        loading.value = true
        try {
            const product = await sGetById(route.params.id)
            if (product) {
                form.value = {
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    slug: product.slug,
                    images: product.product_images ? [...product.product_images].sort((a,b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)) : [],
                    categoryIds: product.product_categories ? product.product_categories.map(pc => pc.category_id) : [],
                    specs: product.product_specs ? [...product.product_specs].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)) : [],
                    licenses: product.product_licenses?.length
                        ? [...product.product_licenses].sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
                        : [createDefaultProductLicense(product.price)]
                }
                if (product.product_files && product.product_files.length > 0) {
                    existingZipFile.value = [...product.product_files].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                }
                imagesDirty.value = false
            }
        } catch (err) {
            error.value = 'Failed to load product details'
            console.error(err)
        } finally {
            loading.value = false
        }
    }
})

const handleSubmit = async () => {
    loading.value = true
    error.value = null

    try {
        validateProductSubmission(
            { ...form.value, zipFile: zipFile.value },
            { hasExistingZip: Boolean(existingZipFile.value) },
        )
        const payload = {
            ...form.value,
            syncImages: !isEditMode.value || imagesDirty.value,
            zipFile: zipFile.value
        }

        if (isEditMode.value) {
            await productsStore.updateProduct(route.params.id, payload)
        } else {
            await productsStore.createProduct(payload)
        }
        router.push('/admin')
    } catch (err) {
        error.value = err.message || 'Failed to save product'
    } finally {
        loading.value = false
    }
}
</script>
