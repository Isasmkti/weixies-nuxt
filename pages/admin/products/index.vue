<template>
    
        <div class="max-w-[1600px] mx-auto font-poppins">
            <!-- Header -->
            <div class="flex justify-between items-end mb-10">
                <div>
                    <h1 class="text-4xl font-extrabold text-text-main tracking-tight mb-2">Manage Products</h1>
                    <p class="text-text-muted font-montserrat">Manage your products and inventory.</p>
                </div>
                <NuxtLink to="/admin/products/create"
                    class="bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-xl transition-all duration-300 shadow-lg shadow-primary/30 hover:shadow-primary/50 font-semibold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Product
                </NuxtLink>
            </div>

           

            <!-- Product List Table -->
            <div class="bg-surface rounded-2xl shadow-sm border border-bg-alt overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-bg-alt/50 text-text-muted text-sm uppercase tracking-wider">
                                <th class="p-6 font-semibold">Product</th>
                                <th class="p-6 font-semibold">Price</th>
                                <th class="p-6 font-semibold">Categories</th>
                                <th class="p-6 font-semibold">Stock</th>
                                <th class="p-6 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-bg-alt">
                            <tr v-if="loading" class="animate-pulse">
                                <td colspan="4" class="p-6 text-center text-text-muted">Loading products...</td>
                            </tr>
                            <tr v-else-if="products.length === 0">
                                <td colspan="4" class="p-6 text-center text-text-muted">No products found.</td>
                            </tr>
                            <tr v-for="product in products" :key="product.id"
                                class="hover:bg-bg-alt/30 transition-colors duration-200 group">
                                <td class="p-6">
                                    <div class="flex items-center gap-4">
                                        <div class="h-12 w-12 rounded-lg bg-bg-alt overflow-hidden flex-shrink-0">
                                            <img v-if="product.image_url" :src="product.image_url" :alt="product.name"
                                                class="h-full w-full object-cover">
                                            <div v-else
                                                class="h-full w-full flex items-center justify-center text-xs text-text-muted">
                                                No Img
                                            </div>
                                        </div>
                                        <div>
                                            <h3
                                                class="font-bold text-text-main group-hover:text-primary transition-colors">
                                                {{ product.name }}</h3>
                                            <p class="text-xs text-text-muted line-clamp-1 max-w-xs">{{
                                                product.description }}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-6 font-mono font-medium text-text-main">
                                    {{ formatIDR(product.price) }}
                                </td>
                                <td class="p-6">
                                    <div class="flex flex-wrap gap-1 max-w-[200px]">
                                        <span v-for="cat in product.categories" :key="cat.id"
                                            class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase whitespace-nowrap">
                                            {{ cat.name }}
                                        </span>
                                        <span v-if="!product.categories?.length" class="text-[10px] text-text-muted italic">Untagged</span>
                                    </div>
                                </td>
                                <td class="p-6 text-text-muted">
                                    {{ product.stock || '-' }}
                                </td>
                                <td class="p-6">
                                    <div class="flex items-center justify-end gap-3">
                                        <NuxtLink :to="`/admin/products/${product.id}/edit`"
                                            class="text-blue-500 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                            title="Edit">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </NuxtLink>
                                        <button @click="deleteProduct(product.id)"
                                            class="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                            title="Delete">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none"
                                                viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Simple Pagination (Reuse from Catalog or minimal version) -->
                <div class="p-6 border-t border-bg-alt flex justify-center gap-4">
                    <button :disabled="productsStore.page === 1" @click="productsStore.stAll(productsStore.page - 1)"
                        class="text-text-muted hover:text-primary disabled:opacity-50">Prev</button>
                    <span class="text-text-main font-semibold">{{ productsStore.page }} / {{ productsStore.totalPages
                        }}</span>
                    <button :disabled="productsStore.page === productsStore.totalPages"
                        @click="productsStore.stAll(productsStore.page + 1)"
                        class="text-text-muted hover:text-primary disabled:opacity-50">Next</button>
                </div>
            </div>
        </div>
    
</template>

<script setup>
import { onMounted, computed } from 'vue'

import { useProductsStore } from '../../../stores/productsStore'
import { formatIDR } from '../../../utils/currency'

const productsStore = useProductsStore()

const products = computed(() => productsStore.products)
const loading = computed(() => productsStore.loading)

onMounted(async () => {
    await productsStore.ensureProductsLoaded({ page: 1, force: true })
})

const deleteProduct = async (id) => {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        try {
            await productsStore.deleteProduct(id)
        } catch (error) {
            alert('Failed to delete product: ' + error.message)
        }
    }
}
</script>