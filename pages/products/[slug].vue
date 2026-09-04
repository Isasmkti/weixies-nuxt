<template>
  <div class="mx-auto max-w-[1120px] font-[Inter,sans-serif]">
    <div v-if="loading" class="flex min-h-[520px] flex-col items-center justify-center rounded-3xl border border-bg-alt bg-surface"><span class="h-11 w-11 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></span><p class="mt-4 text-sm font-semibold text-text-muted">Loading product details...</p></div>
    <div v-else-if="error" class="rounded-3xl border border-red-200 bg-red-50 p-10 text-center text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400"><span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10"><svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg></span><h1 class="mt-5 text-xl font-black">Product not available</h1><p class="mt-2 text-sm">{{ error }}</p><NuxtLink to="/products" class="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-dark">Back to catalog</NuxtLink></div>

    <div v-else-if="product" class="flex flex-col gap-8">
      <div class="flex items-center justify-between gap-4">
        <button type="button" class="group inline-flex w-fit items-center gap-2 rounded-xl border border-bg-alt bg-surface px-3.5 py-2 text-sm font-bold text-text-muted shadow-sm transition hover:border-primary/30 hover:text-primary" @click="goBack">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m15 19-7-7 7-7" /></svg>
          Back
        </button>
        <NuxtLink to="/products" class="text-xs font-bold uppercase tracking-[0.16em] text-text-muted transition hover:text-primary">Marketplace</NuxtLink>
      </div>

      <section class="product-overview">
        <div class="product-main-column min-w-0 space-y-6">
          <div class="product-gallery flex min-w-0 flex-col gap-2">
            <div class="group relative aspect-video overflow-hidden rounded-xl border border-bg-alt bg-surface shadow-sm">
              <img v-if="selectedImage" :src="selectedImage" :alt="product.name" class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
              <defaultProduct v-else class="h-full w-full p-20 text-text-muted/50" />
              <button v-if="!isOwnProduct" class="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-text-muted shadow-sm backdrop-blur transition hover:scale-110 hover:text-red-500" :class="wishlistStore.isWishlisted(product.id) ? 'bg-red-500 text-white hover:text-white' : ''" @click="toggleWishlist(product.id)">
                <svg xmlns="http://www.w3.org/2000/svg" :fill="wishlistStore.isWishlisted(product.id) ? 'currentColor' : 'none'" class="h-5 w-5" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 0 0 0 6.364L12 20.364l7.682-7.682a4.5 4.5 0 0 0-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 0 0-6.364 0Z" /></svg>
              </button>
            </div>
            <div v-if="productImages.length" class="grid grid-cols-4 gap-2">
              <button v-for="(image, index) in productImages.slice(0, 4)" :key="image.id || image.image_url || index" class="aspect-video overflow-hidden rounded-lg border-2 bg-bg-alt transition" :class="selectedImage === image.image_url ? 'border-primary opacity-100' : 'border-bg-alt opacity-70 hover:border-primary/40 hover:opacity-100'" @click="selectedImage = image.image_url"><img :src="image.image_url" :alt="`${product.name} preview ${index + 1}`" class="h-full w-full object-cover"></button>
            </div>
          </div>

          <section class="product-description rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm md:p-6">
            <div class="flex items-center gap-3"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25M8.25 15h7.5M8.25 18H12m-5.25 3.75h10.5a2.25 2.25 0 0 0 2.25-2.25V11.25a9 9 0 0 0-9-9h-3.75A2.25 2.25 0 0 0 4.5 4.5v15a2.25 2.25 0 0 0 2.25 2.25Z" /></svg></span><div><p class="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">About this product</p><h2 class="mt-0.5 text-xl font-black text-text-main md:text-2xl">Product description</h2></div></div>
            <div class="mt-5 whitespace-pre-line text-sm leading-7 text-text-muted">{{ product.description || 'No description is available for this product.' }}</div>
          </section>

          <section v-if="productSpecs.length" class="product-specifications rounded-2xl border border-bg-alt bg-surface p-5 shadow-sm md:p-6">
            <div class="flex items-center justify-between gap-4"><div><p class="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Technical information</p><h2 class="mt-1 text-xl font-black text-text-main md:text-2xl">Product specifications</h2></div><span class="shrink-0 rounded-full bg-bg-alt px-3 py-1 text-xs font-bold text-text-muted">{{ productSpecs.length }} details</span></div>
            <dl class="mt-5 overflow-hidden rounded-xl border border-bg-alt">
              <div v-for="(spec, index) in productSpecs" :key="spec.id" class="grid gap-1 px-4 py-3.5 sm:grid-cols-[minmax(8rem,0.75fr)_minmax(0,1.25fr)] sm:gap-5" :class="index !== productSpecs.length - 1 ? 'border-b border-bg-alt' : ''">
                <dt class="text-sm font-bold text-text-main">{{ spec.spec_name }}</dt>
                <dd class="break-words text-sm leading-6 text-text-muted">{{ spec.spec_value }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside class="product-buy-panel flex min-w-0 self-start flex-col gap-4 rounded-2xl border border-bg-alt bg-surface p-5 shadow-lg shadow-black/[0.03] md:sticky md:top-6 md:p-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex flex-wrap gap-2">
              <span v-for="category in product.categories" :key="category.id" class="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">{{ category.name }}</span>
            </div>
            <a href="#customer-reviews" class="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-text-main transition hover:bg-amber-500/20"><span class="text-amber-500">&#9733;</span>{{ product.reviewCount ? product.averageRating.toFixed(1) : '0.0' }} <span class="font-medium text-text-muted">({{ product.reviewCount || 0 }})</span></a>
          </div>
          <div>
            <h1 class="text-2xl font-black leading-8 tracking-tight text-text-main md:text-[32px] md:leading-10">{{ product.name }}</h1>
            <p class="mt-2 text-sm leading-6 text-text-muted">{{ shortDescription }}</p>
          </div>
          <div class="border-y border-bg-alt py-4">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Selected license</p>
            <p class="mt-1 text-3xl font-black leading-tight tracking-tight text-primary md:text-4xl">{{ formattedPrice }}</p>
          </div>

          <div v-if="productLicenses.length" class="space-y-2.5">
            <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">Choose your license</p>
            <button
              v-for="license in productLicenses"
              :key="license.id"
              type="button"
              class="w-full rounded-xl border p-3.5 text-left transition"
              :class="selectedLicenseId === license.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-bg-alt bg-bg/30 hover:border-primary/30'"
              @click="selectedLicenseId = license.id"
            >
              <span class="flex items-center justify-between gap-3"><span class="text-sm font-bold text-text-main">{{ license.name }}</span><span class="text-sm font-black text-primary">{{ formatIDR(license.price) }}</span></span>
              <span class="mt-1.5 block line-clamp-2 text-xs leading-5 text-text-muted">{{ license.usage_terms }}</span>
              <span class="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                <span v-if="license.allow_commercial_use" class="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-600">Commercial use</span>
                <span v-if="license.allow_resale" class="rounded-full bg-blue-500/10 px-2 py-1 text-blue-600">Resale allowed</span>
                <span class="rounded-full bg-bg-alt px-2 py-1 text-text-muted">{{ license.max_end_products ? `${license.max_end_products} end product${license.max_end_products === 1 ? '' : 's'}` : 'Unlimited projects' }}</span>
              </span>
            </button>
          </div>
          <p v-else class="rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs font-semibold text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">This product currently has no license available for purchase.</p>

          <div v-if="isOwnProduct" class="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <div class="flex items-start gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15.75 6.75a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" /></svg></span>
              <div><p class="text-sm font-bold text-text-main">This product belongs to your store</p><p class="mt-1 text-xs leading-5 text-text-muted">Store owners cannot purchase or wishlist their own products.</p></div>
            </div>
            <NuxtLink :to="`/seller/products/${product.id}/edit`" class="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-primary/30 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/10">Manage this product</NuxtLink>
          </div>

          <div v-else class="grid gap-2.5">
            <button :disabled="addingToCart === product.id || !selectedLicenseId" class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0" @click="buyNow"><span v-if="addingToCart === product.id" class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span><svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Zm-3 4h18M16 10a4 4 0 0 1-8 0" /></svg><span>Buy now</span></button>
            <button :disabled="addingToCart === product.id || !selectedLicenseId" class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-bg-alt bg-bg/40 px-5 py-3.5 text-sm font-bold text-text-main transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-70" @click="isInCart(product.id, selectedLicenseId) ? router.push('/cart') : addToCart()"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3A1 1 0 0 0 5.8 17H17" /></svg><span v-if="isInCart(product.id, selectedLicenseId)">View cart</span><span v-else>Add to cart</span></button>
          </div>

          <div class="grid grid-cols-2 gap-2 rounded-xl bg-bg-alt/40 p-3 text-xs font-semibold text-text-muted">
            <span class="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m9 12.75 2.25 2.25L15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>Instant access</span>
            <span class="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>Secure payment</span>
          </div>

          <div class="flex items-center gap-3 rounded-xl border border-bg-alt p-3.5">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-bg-alt bg-bg-alt text-base font-black text-primary">
              <img v-if="sellerStore?.store_image_url" :src="sellerStore.store_image_url" :alt="sellerName" class="h-full w-full object-cover">
              <span v-else>{{ sellerName.charAt(0) }}</span>
            </div>
            <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-text-main">{{ sellerName }}</p><p class="mt-1 text-xs text-text-muted">{{ sellerMeta }}</p></div>
            <NuxtLink v-if="sellerStore" :to="`/stores/${sellerStore.store_slug}`" class="shrink-0 rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10">View store</NuxtLink>
          </div>
          <button v-if="sellerStore && !isOwnProduct" type="button" :disabled="startingConversation" class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/10 disabled:opacity-60" @click="startConversation">
            <span v-if="startingConversation" class="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary"></span>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025C3.36 16.94 2.25 14.97 2.25 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg>
            Message seller
          </button>

          <div class="rounded-xl border border-bg-alt bg-bg-alt/30 p-4">
            <div class="flex items-center gap-2"><span class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m6.75 12-3 3m0 0-3-3m3 3V10.5M6.75 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg></span><h3 class="text-xs font-bold uppercase tracking-wider text-text-main">File details</h3></div>
            <dl class="mt-3 space-y-2.5 text-xs">
              <div class="flex justify-between gap-4 border-b border-bg-alt pb-2.5"><dt class="text-text-muted">File format</dt><dd class="text-right font-semibold text-text-main">{{ productFileFormat }}</dd></div>
              <div class="flex justify-between gap-4 border-b border-bg-alt pb-2.5"><dt class="text-text-muted">File size</dt><dd class="text-right font-semibold text-text-main">{{ productFileSize }}</dd></div>
              <div class="flex justify-between gap-4 border-b border-bg-alt pb-2.5"><dt class="text-text-muted">Version</dt><dd class="text-right font-semibold text-text-main">{{ latestProductFile?.version || '-' }}</dd></div>
              <div class="flex justify-between gap-4"><dt class="text-text-muted">Last updated</dt><dd class="text-right font-semibold text-text-main">{{ formatDate(latestProductFile?.created_at || product.created_at) }}</dd></div>
            </dl>
          </div>
        </aside>
      </section>

      <section id="customer-reviews" class="scroll-mt-8 rounded-2xl border border-bg-alt bg-surface p-6 shadow-sm md:p-8">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p class="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Buyer feedback</p><h2 class="mt-1 text-2xl font-black text-text-main">Customer reviews</h2></div><div class="flex items-center gap-2"><span class="text-2xl font-black text-text-main">{{ product.reviewCount ? product.averageRating.toFixed(1) : '0.0' }}</span><div><div class="flex text-amber-500"><svg v-for="index in 5" :key="index" class="h-4 w-4" :class="index <= Math.round(product.averageRating || 0) ? 'fill-current' : 'fill-none text-bg-alt'" viewBox="0 0 20 20" stroke="currentColor"><path d="m10 2 2.2 4.7 5.1.6-3.8 3.5 1 5-4.5-2.5-4.5 2.5 1-5-3.8-3.5 5.1-.6L10 2Z" /></svg></div><p class="mt-0.5 text-[11px] font-semibold text-text-muted">Based on {{ product.reviewCount || 0 }} reviews</p></div></div></div>
        <div v-if="reviewsStore.loading" class="flex items-center justify-center py-12 text-sm font-semibold text-text-muted"><span class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary"></span>Loading reviews...</div>
        <div v-else-if="!reviewsStore.reviews.length" class="mt-6 rounded-xl border border-dashed border-bg-alt bg-bg/30 p-10 text-center"><span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-alt text-text-muted"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.76 9.76 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.455-.208-.894-.632-1.083C3.359 16.939 2.25 14.972 2.25 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" /></svg></span><p class="mt-4 font-bold text-text-main">No reviews yet</p><p class="mt-1 text-sm text-text-muted">Be the first buyer to share an experience with this product.</p></div>
        <div v-else class="mt-6 grid gap-4 md:grid-cols-2">
          <article v-for="review in reviewsStore.reviews" :key="review.id" class="rounded-xl border border-bg-alt bg-bg/30 p-5 transition hover:border-primary/20">
            <div class="flex items-start gap-3"><img v-if="review.profiles?.profile_img" :src="review.profiles.profile_img" alt="Reviewer" class="h-10 w-10 rounded-full object-cover"><span v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-bg-alt font-semibold text-text-muted">{{ review.profiles?.full_name?.charAt(0) || 'U' }}</span><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center justify-between gap-2"><p class="font-semibold text-text-main">{{ review.profiles?.full_name || 'Anonymous user' }}</p><time class="text-xs text-text-muted">{{ formatDate(review.created_at) }}</time></div><div class="mt-1 flex text-amber-500"><svg v-for="index in 5" :key="index" class="h-4 w-4" :class="index <= review.rating ? 'fill-current' : 'fill-none text-bg-alt'" viewBox="0 0 20 20" stroke="currentColor"><path d="m10 2 2.2 4.7 5.1.6-3.8 3.5 1 5-4.5-2.5-4.5 2.5 1-5-3.8-3.5 5.1-.6L10 2Z" /></svg></div></div></div>
            <p class="mt-4 text-sm leading-6 text-text-muted">{{ review.comment }}</p>
          </article>
        </div>
      </section>

    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import defaultProduct from '../../components/defaultProduct.vue'
import { getUser } from '../../services/authService'
import { getCurrentSeller } from '../../services/sellerService'
import { sGetBySlug } from '../../services/productsService'
import { useReviewsStore } from '../../stores/reviewsStore'
import { supabase } from '../../utils/supabase'
import { seoDescription, serializeJsonLd } from '../../utils/seo'

definePageMeta({ layout: 'product' })

const router = useRouter()
const route = useRoute()
const productSlug = computed(() => String(route.params.slug || ''))
const { data: initialProduct } = await useAsyncData(
  `public-product-${productSlug.value}`,
  () => sGetBySlug(productSlug.value),
)
const wishlistStore = useWishlistStore()
const reviewsStore = useReviewsStore()
const profileId = ref(null)
const sellerStore = ref(null)
const currentSeller = ref(null)
const startingConversation = ref(false)
const { product, loading, error, addingToCart, formattedPrice, addToCart, productImages, selectedImage, productLicenses, selectedLicenseId, cartStore, formatIDR } = useProductDetailUI(productSlug.value, initialProduct.value)
const { canonicalUrl, absoluteUrl } = useSeoSite()

const shortDescription = computed(() => String(product.value?.description || '').slice(0, 220) || 'A ready-to-use digital product for your next project.')
const productSpecs = computed(() => [...(product.value?.product_specs || [])]
  .sort((a, b) => Number(a.sort_order) - Number(b.sort_order)))
const latestProductFile = computed(() => [...(product.value?.product_files || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null)
const productFileFormat = computed(() => {
  const fileName = latestProductFile.value?.file_name
  if (!fileName?.includes('.')) return 'Digital file'
  return `.${fileName.split('.').pop().toUpperCase()}`
})
const productFileSize = computed(() => {
  const bytes = Number(latestProductFile.value?.file_size)
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / (1024 ** unitIndex)
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: unitIndex ? 1 : 0 }).format(size)} ${units[unitIndex]}`
})
const formatDate = (value) => value ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '-'
const sellerName = computed(() => sellerStore.value?.store_name || 'Weixies Marketplace')
const sellerMeta = computed(() => sellerStore.value?.created_at
  ? `Member since ${new Date(sellerStore.value.created_at).getFullYear()}`
  : 'Digital product seller')
const seoSummary = computed(() => seoDescription(
  product.value?.description,
  'Discover this premium digital product on Weixies.',
))
const seoImage = computed(() => absoluteUrl(productImages.value[0]?.image_url || '/weixies-logo.svg'))
const activeLicensePrices = computed(() => productLicenses.value
  .map(license => Number(license.price))
  .filter(price => Number.isSafeInteger(price) && price > 0))

useSeoMeta({
  title: () => product.value?.name || 'Product not available',
  description: () => seoSummary.value,
  robots: () => product.value ? 'index, follow' : 'noindex, nofollow',
  ogTitle: () => product.value ? `${product.value.name} | Weixies` : 'Product not available | Weixies',
  ogDescription: () => seoSummary.value,
  ogUrl: () => canonicalUrl.value,
  ogImage: () => seoImage.value,
  twitterTitle: () => product.value ? `${product.value.name} | Weixies` : 'Product not available | Weixies',
  twitterDescription: () => seoSummary.value,
  twitterImage: () => seoImage.value,
})

const productJsonLd = computed(() => {
  if (!product.value) return null
  const prices = activeLicensePrices.value.length
    ? activeLicensePrices.value
    : [Number(product.value.price)].filter(price => Number.isSafeInteger(price) && price > 0)
  const offer = prices.length ? {
    '@type': 'AggregateOffer',
    priceCurrency: 'IDR',
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: prices.length,
    availability: 'https://schema.org/InStock',
    url: canonicalUrl.value,
  } : undefined
  const aggregateRating = product.value.reviewCount > 0 ? {
    '@type': 'AggregateRating',
    ratingValue: Number(product.value.averageRating.toFixed(2)),
    reviewCount: product.value.reviewCount,
  } : undefined

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.value.name,
    description: seoSummary.value,
    image: productImages.value.map(image => absoluteUrl(image.image_url)).filter(Boolean),
    sku: String(product.value.id),
    category: product.value.categories?.map(category => category.name).filter(Boolean).join(', ') || undefined,
    offers: offer,
    aggregateRating,
  }
})

useHead(() => ({
  script: productJsonLd.value ? [{
    key: 'product-jsonld',
    type: 'application/ld+json',
    textContent: serializeJsonLd(productJsonLd.value),
  }] : [],
}))
const isOwnProduct = computed(() => Boolean(
  product.value?.seller_id
  && currentSeller.value?.id
  && String(product.value.seller_id) === String(currentSeller.value.id)
))
const isInCart = (productId, licenseId) => (cartStore?.items || []).some((item) => item.product_id === productId && item.product_license_id === licenseId) || cartStore?.addingProducts?.[`${productId}:${licenseId}`]
const goBack = () => {
  if (window.history.length > 1) return router.back()
  return router.push('/products')
}
const buyNow = async () => {
  if (isOwnProduct.value) return
  if (isInCart(product.value.id, selectedLicenseId.value)) return router.push('/cart')
  const user = await getUser()
  if (!user) return router.push('/login')
  await addToCart()
  return router.push('/cart')
}
const toggleWishlist = async (productId) => { if (isOwnProduct.value) return; if (!profileId.value) { const user = await getUser(); if (!user) return router.push('/login'); profileId.value = user.id }; await wishlistStore.stToggleWishlist(profileId.value, productId) }
const startConversation = async () => {
  const user = await getUser()
  if (!user) return router.push('/login')
  startingConversation.value = true
  try {
    const { data } = await supabase.auth.getSession()
    const response = await $fetch('/api/direct-messages/threads', {
      method: 'POST',
      headers: { Authorization: data.session?.access_token ? `Bearer ${data.session.access_token}` : '' },
      body: { seller_id: sellerStore.value.id, product_id: product.value.id },
    })
    if (response?.thread?.id) await router.push(`/messages/${response.thread.id}`)
  } catch (err) {
    alert(err?.data?.statusMessage || err?.message || 'Unable to start a conversation with this seller.')
  } finally {
    startingConversation.value = false
  }
}

onMounted(async () => {
  const user = await getUser()
  if (!user) return
  profileId.value = user.id
  const [seller] = await Promise.all([
    getCurrentSeller(),
    wishlistStore.stGetWishlists(user.id),
  ])
  currentSeller.value = seller
})
watch(product, (nextProduct) => { if (nextProduct?.id) reviewsStore.fetchReviews(nextProduct.id) }, { immediate: true })
watch(product, async (nextProduct) => {
  sellerStore.value = null
  if (!nextProduct?.seller_id) return
  const { data } = await supabase.from('approved_seller_stores').select('id, store_name, store_slug, store_description, store_image_url, created_at').eq('id', nextProduct.seller_id).maybeSingle()
  sellerStore.value = data || null
}, { immediate: true })
</script>

<style scoped>
.product-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
}

.product-gallery > :first-child,
.product-gallery img {
  aspect-ratio: 16 / 9;
}

@media (max-width: 767px) {
  .product-main-column {
    display: contents;
  }

  .product-main-column > * {
    margin-block: 0 !important;
  }

  .product-gallery {
    order: 1;
  }

  .product-buy-panel {
    order: 2;
  }

  .product-description {
    order: 3;
  }

  .product-specifications {
    order: 4;
  }
}

@media (min-width: 768px) {
  .product-overview {
    grid-template-columns: minmax(0, 56fr) minmax(20rem, 44fr);
  }
}
</style>
