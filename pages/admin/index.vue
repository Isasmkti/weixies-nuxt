<template>
    
        <div class="max-w-[1600px] mx-auto font-poppins">
            <!-- Header -->
            <div class="flex justify-between items-end mb-10">
                <div>
                    <h1 class="text-4xl font-extrabold text-text-main tracking-tight mb-2">Admin Dashboard</h1>
                    <p class="text-text-muted font-montserrat">Admin insights and analytics.</p>
                </div>
                
            </div>

            <!-- Stats/Metrics (Optional placeholder) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <!-- <div class="bg-surface p-6 rounded-2xl shadow-sm border border-bg-alt">
                    <h3 class="text-text-muted font-semibold mb-4">Total Products</h3>
                    <apexchart type="bar" height="280" :options="chartOptions" :series="series" />
                </div> -->
                <!-- Add more stats here if needed -->
                <div class="bg-surface p-6 rounded-2xl shadow-sm border border-bg-alt">
                    <h3 class="text-text-muted font-semibold mb-2">Total Products</h3>
                    <p class="text-3xl font-extrabold text-text-main">{{ productsStore.total }}</p>
                </div>
            </div>

         
        </div>
    
</template>

<script setup>
import { onMounted, computed } from 'vue'

import { useProductsStore } from '../../stores/productsStore'


const productsStore = useProductsStore()


// const chartOptions = {
//     chart: {
//         id: 'basic-bar'
//     },
//     xaxis: {
//         categories: ['Products']
//     }
// }

// const series = computed(() => [
//     {
//         name: 'Total Products',
//         data: [Number(productsStore.total) || 0]
//     }
// ])

onMounted(async () => {
    await productsStore.stAll(1)
})

// const deleteProduct = async (id) => {
//     if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
//         try {
//             await productsStore.deleteProduct(id)
//         } catch (error) {
//             alert('Failed to delete product: ' + error.message)
//         }
//     }
// }
</script>
