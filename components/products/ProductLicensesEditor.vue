<script setup>
import { watch } from 'vue'
import { createDefaultProductLicense } from '../../utils/productLicenses'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  basePrice: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

watch(() => props.basePrice, (nextPrice, previousPrice) => {
  if (props.modelValue.length !== 1) return
  const license = props.modelValue[0]
  if (Number(license.price) !== 0 && Number(license.price) !== Number(previousPrice)) return
  const normalized = Number(nextPrice)
  if (!Number.isInteger(normalized) || normalized < 0) return
  emit('update:modelValue', [{ ...license, price: normalized }])
})

const update = (index, field, value) => {
  const next = props.modelValue.map((license, itemIndex) => (
    itemIndex === index ? { ...license, [field]: value } : license
  ))
  emit('update:modelValue', next)
}

const addLicense = () => {
  emit('update:modelValue', [
    ...props.modelValue,
    {
      ...createDefaultProductLicense(props.basePrice),
      name: props.modelValue.length ? 'Commercial Use' : 'Personal Use',
      allow_commercial_use: props.modelValue.length > 0,
    },
  ])
}

const removeLicense = (index) => {
  if (props.modelValue.length <= 1) return
  emit('update:modelValue', props.modelValue.filter((_, itemIndex) => itemIndex !== index))
}
</script>

<template>
  <section class="space-y-4 rounded-2xl border border-bg-alt bg-bg/30 p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-bold text-text-main">License tiers</h3>
        <p class="mt-1 text-xs leading-5 text-text-muted">Set the price and usage rights buyers choose before adding this product to their cart.</p>
      </div>
      <button type="button" :disabled="disabled" class="rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:opacity-50" @click="addLicense">Add license</button>
    </div>

    <div v-if="modelValue.length" class="space-y-4">
      <article v-for="(license, index) in modelValue" :key="license.id || `new-license-${index}`" class="rounded-xl border border-bg-alt bg-surface p-4">
        <div class="mb-4 flex items-center justify-between gap-3">
          <p class="text-xs font-black uppercase tracking-[0.14em] text-primary">Tier {{ index + 1 }}</p>
          <button type="button" :disabled="disabled || modelValue.length <= 1" class="text-xs font-bold text-red-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30" @click="removeLicense(index)">Remove</button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-xs font-bold text-text-main">License name
            <input :value="license.name" required maxlength="120" :disabled="disabled" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="Personal Use" @input="update(index, 'name', $event.target.value)">
          </label>
          <label class="block text-xs font-bold text-text-main">Price (Rp)
            <input :value="license.price" required type="number" min="0" step="1" :disabled="disabled" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" @input="update(index, 'price', Number($event.target.value))">
          </label>
          <label class="block text-xs font-bold text-text-main">Maximum end products
            <input :value="license.max_end_products" type="number" min="1" step="1" :disabled="disabled" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30" placeholder="Unlimited" @input="update(index, 'max_end_products', $event.target.value === '' ? null : Number($event.target.value))">
          </label>
          <div class="flex flex-col justify-end gap-2 pb-1 text-xs font-semibold text-text-main">
            <label class="flex items-center gap-2"><input :checked="license.allow_commercial_use" type="checkbox" :disabled="disabled" class="h-4 w-4 rounded accent-primary" @change="update(index, 'allow_commercial_use', $event.target.checked)"> Commercial use</label>
            <label class="flex items-center gap-2"><input :checked="license.allow_resale" type="checkbox" :disabled="disabled" class="h-4 w-4 rounded accent-primary" @change="update(index, 'allow_resale', $event.target.checked)"> Resale allowed</label>
            <label class="flex items-center gap-2"><input :checked="license.is_active !== false" type="checkbox" :disabled="disabled" class="h-4 w-4 rounded accent-primary" @change="update(index, 'is_active', $event.target.checked)"> Available for purchase</label>
          </div>
        </div>

        <label class="mt-4 block text-xs font-bold text-text-main">Usage terms
          <textarea :value="license.usage_terms" required rows="3" maxlength="5000" :disabled="disabled" class="mt-2 w-full rounded-xl border border-bg-alt bg-bg px-3 py-2.5 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/30" placeholder="Describe what buyers may and may not do with this license." @input="update(index, 'usage_terms', $event.target.value)"></textarea>
        </label>
      </article>
    </div>

    <button v-else type="button" :disabled="disabled" class="w-full rounded-xl border border-dashed border-bg-alt p-5 text-sm font-bold text-primary transition hover:border-primary/40 hover:bg-primary/5" @click="addLicense">Create the first license tier</button>
  </section>
</template>
