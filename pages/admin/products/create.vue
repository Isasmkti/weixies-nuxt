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
                            <input v-model.number="form.price" type="number" step="1" min="0" required
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

                    <!-- Product Images -->
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <label class="block text-sm font-semibold text-text-main">Product Images</label>
                            <button type="button" @click="addImageUrl" class="text-sm text-primary hover:text-primary-dark font-semibold flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Image
                            </button>
                        </div>
                        
                        <div class="space-y-4">
                            <div v-for="(image, index) in form.images" :key="index" class="bg-bg-alt/30 p-4 rounded-xl border border-bg-alt flex flex-col gap-3">
                                <div class="flex items-center gap-2">
                                    <input v-model="form.images[index].image_url" type="url"
                                        class="flex-1 rounded-lg border border-bg-alt bg-bg px-3 py-2 focus:ring-2 focus:ring-primary/30 outline-none transition-all text-sm"
                                        placeholder="https://example.com/image.jpg">
                                    <button type="button" @click="removeImage(index)" class="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove image">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                                <div class="flex items-center justify-between">
                                    <label class="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                                        <input type="radio" name="main_image" :checked="form.images[index].is_primary" @change="setMainImage(index)" class="text-primary focus:ring-primary h-4 w-4">
                                        Set as Main Image
                                    </label>
                                    <div v-if="form.images[index].image_url" class="h-12 w-12 rounded bg-bg overflow-hidden border border-bg-alt">
                                        <img :src="form.images[index].image_url" alt="" class="w-full h-full object-cover">
                                    </div>
                                </div>
                            </div>
                            <div v-if="form.images.length === 0" class="text-center py-6 border-2 border-dashed border-bg-alt rounded-xl text-text-muted text-sm">
                                No images added yet.
                            </div>
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
    images: [], // Array of { image_url: string, is_primary: boolean }
    categoryIds: [] // Array of category UUIDs
})

const addImageUrl = () => {
    form.value.images.push({ image_url: '', is_primary: form.value.images.length === 0 })
}

const removeImage = (index) => {
    const wasMain = form.value.images[index].is_primary
    form.value.images.splice(index, 1)
    if (wasMain && form.value.images.length > 0) {
        form.value.images[0].is_primary = true
    }
}

const setMainImage = (index) => {
    form.value.images.forEach((img, i) => {
        img.is_primary = i === index
    })
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
                    categoryIds: product.product_categories ? product.product_categories.map(pc => pc.category_id) : []
                }
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
        if (isEditMode.value) {
            await productsStore.updateProduct(route.params.id, form.value)
        } else {
            await productsStore.createProduct(form.value)
        }
        router.push('/admin')
    } catch (err) {
        error.value = err.message || 'Failed to save product'
    } finally {
        loading.value = false
    }
}
</script>