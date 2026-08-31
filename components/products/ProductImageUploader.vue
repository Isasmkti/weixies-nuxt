<script setup>
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  inputName: { type: String, default: 'product-main-image' },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const errorMessage = ref('')
const MAX_IMAGES = 8
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

const imageSource = (image) => image.preview_url || image.image_url || ''

const releasePreview = (image) => {
  if (String(image?.preview_url || '').startsWith('blob:')) URL.revokeObjectURL(image.preview_url)
}

const selectImages = (event) => {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  errorMessage.value = ''
  if (!files.length) return

  if (props.modelValue.length + files.length > MAX_IMAGES) {
    errorMessage.value = `A product can have up to ${MAX_IMAGES} images.`
    return
  }

  const invalidType = files.find((file) => !ALLOWED_TYPES.has(file.type))
  if (invalidType) {
    errorMessage.value = 'Images must be JPG, PNG, WEBP, or GIF files.'
    return
  }

  const invalidSize = files.find((file) => file.size <= 0 || file.size > MAX_IMAGE_SIZE)
  if (invalidSize) {
    errorMessage.value = 'Each image must be 5 MB or smaller.'
    return
  }

  const hasPrimary = props.modelValue.some((image) => image.is_primary)
  const additions = files.map((file, index) => ({
    _key: `upload-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    file,
    preview_url: URL.createObjectURL(file),
    is_primary: !hasPrimary && index === 0,
  }))
  emit('update:modelValue', [...props.modelValue, ...additions])
}

const removeImage = (index) => {
  const nextImages = [...props.modelValue]
  const [removedImage] = nextImages.splice(index, 1)
  releasePreview(removedImage)
  if (removedImage?.is_primary && nextImages.length) {
    emit('update:modelValue', nextImages.map((image, imageIndex) => ({
      ...image,
      is_primary: imageIndex === 0,
    })))
    return
  }
  emit('update:modelValue', nextImages)
}

const setPrimary = (index) => {
  emit('update:modelValue', props.modelValue.map((image, imageIndex) => ({
    ...image,
    is_primary: imageIndex === index,
  })))
}

onBeforeUnmount(() => props.modelValue.forEach(releasePreview))
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <label class="block text-sm font-bold text-text-main">Product images</label>
        <p class="mt-1 text-xs text-text-muted">Upload up to 8 JPG, PNG, WEBP, or GIF images. Maximum 5 MB each.</p>
      </div>
      <label
        class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/5"
        :class="{ 'pointer-events-none opacity-50': disabled || modelValue.length >= MAX_IMAGES }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
        Choose images
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          class="hidden"
          :disabled="disabled || modelValue.length >= MAX_IMAGES"
          @change="selectImages"
        >
      </label>
    </div>

    <p v-if="errorMessage" class="rounded-lg bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600">{{ errorMessage }}</p>

    <div v-if="modelValue.length" class="grid gap-4 sm:grid-cols-2">
      <article v-for="(image, index) in modelValue" :key="image.id || image._key || image.image_url" class="overflow-hidden rounded-xl border border-bg-alt bg-bg/50">
        <div class="aspect-[4/3] bg-bg-alt/50">
          <img :src="imageSource(image)" :alt="`Product image ${index + 1}`" class="h-full w-full object-cover">
        </div>
        <div class="flex items-center justify-between gap-3 p-3">
          <label class="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input :name="inputName" :checked="image.is_primary" type="radio" class="text-primary focus:ring-primary" :disabled="disabled" @change="setPrimary(index)">
            Main image
          </label>
          <button type="button" class="rounded-lg px-2 py-1 text-sm font-bold text-red-600 transition hover:bg-red-500/10" :disabled="disabled" @click="removeImage(index)">Remove</button>
        </div>
      </article>
    </div>

    <div v-else class="rounded-xl border-2 border-dashed border-bg-alt px-5 py-8 text-center text-sm text-text-muted">
      No product images selected yet.
    </div>
  </div>
</template>
