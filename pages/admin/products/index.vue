<template>
    
        <div class="max-w-[1600px] mx-auto font-poppins">
            <!-- Header -->
            <div class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:mb-10">
                <div>
                    <h1 class="mb-2 text-3xl font-extrabold tracking-tight text-text-main sm:text-4xl">Manage Products</h1>
                    <p class="text-text-muted font-montserrat">Manage your products and inventory.</p>
                </div>
                <NuxtLink to="/admin/products/create"
                    class="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:bg-primary-dark hover:shadow-primary/50 sm:w-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Product
                </NuxtLink>
            </div>

           

            <!-- Product List Table -->
            <div class="bg-surface rounded-2xl shadow-sm border border-bg-alt overflow-hidden">
                <div class="divide-y divide-border md:hidden">
                    <div v-if="loading" class="p-8 text-center text-sm text-text-muted">Loading products...</div>
                    <div v-else-if="products.length === 0" class="p-8 text-center text-sm text-text-muted">No products found.</div>
                    <article v-for="product in products" v-else :key="`mobile-${product.id}`" class="p-4">
                        <div class="flex gap-3">
                            <div class="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-bg-alt">
                                <img v-if="product.image_url" :src="product.image_url" :alt="product.name" class="h-full w-full object-cover">
                                <div v-else class="flex h-full items-center justify-center text-[10px] text-text-muted">No image</div>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-start justify-between gap-2">
                                    <h2 class="line-clamp-2 font-bold text-text-main">{{ product.name }}</h2>
                                    <span class="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold capitalize" :class="product.status === 'published' ? 'bg-emerald-100 text-emerald-800' : product.status === 'pending_review' ? 'bg-amber-100 text-amber-800' : product.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'">{{ String(product.status || 'published').replace('_', ' ') }}</span>
                                </div>
                                <p class="mt-1 font-mono text-sm font-bold text-primary">{{ formatIDR(product.price) }}</p>
                                <div class="mt-2 flex flex-wrap gap-1"><span v-for="cat in product.categories" :key="cat.id" class="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">{{ cat.name }}</span><span v-if="!product.categories?.length" class="text-[10px] italic text-text-muted">Untagged</span></div>
                            </div>
                        </div>
                        <div class="mt-4 grid grid-cols-2 gap-2">
                            <NuxtLink :to="`/admin/products/${product.id}/edit`" class="min-h-10 rounded-ui-sm border border-border px-3 py-2.5 text-center text-xs font-bold text-primary">Edit product</NuxtLink>
                            <button type="button" class="min-h-10 rounded-ui-sm bg-danger/10 px-3 py-2 text-xs font-bold text-danger" @click="deleteProduct(product.id)">Delete</button>
                        </div>
                    </article>
                </div>
                <div class="hidden overflow-x-auto md:block">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-bg-alt/50 text-text-muted text-sm uppercase tracking-wider">
                                <th class="p-6 font-semibold">Product</th>
                                <th class="p-6 font-semibold">Price</th>
                                <th class="p-6 font-semibold">Categories</th>
                                <th class="p-6 font-semibold">Status</th>
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
                                <td class="p-6">
                                    <span class="rounded-full px-2.5 py-1 text-xs font-bold capitalize" :class="product.status === 'published' ? 'bg-emerald-100 text-emerald-800' : product.status === 'pending_review' ? 'bg-amber-100 text-amber-800' : product.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'">
                                        {{ String(product.status || 'published').replace('_', ' ') }}
                                    </span>
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
import { confirmAction, showErrorDialog, showSuccess } from '../../../utils/sweetAlert'

const productsStore = useProductsStore()

const products = computed(() => productsStore.products)
const loading = computed(() => productsStore.loading)

onMounted(async () => {
    await productsStore.ensureProductsLoaded({ page: 1, force: true })
})

const deleteProduct = async (id) => {
    const confirmed = await confirmAction({
        title: 'Delete product?',
        text: 'This product will be permanently deleted. This action cannot be undone.',
        confirmButtonText: 'Delete product',
        confirmButtonColor: 'rgb(var(--color-danger))',
    })
    if (!confirmed) return

    try {
        await productsStore.deleteProduct(id)
        await showSuccess('Product deleted', 'The product has been removed from the catalog.')
    } catch (error) {
        await showErrorDialog('Product could not be deleted', error.message || 'Please try again.')
    }
}
</script>
