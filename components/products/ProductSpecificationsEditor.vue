<script setup>
import { computed } from 'vue'
import { MAX_PRODUCT_SPECS, MAX_SPEC_NAME_LENGTH, MAX_SPEC_VALUE_LENGTH } from '../../utils/productSpecs'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const specs = computed(() => Array.isArray(props.modelValue) ? props.modelValue : [])

let newSpecKey = 0
const createSpec = () => ({
  _key: `new-spec-${Date.now()}-${++newSpecKey}`,
  spec_name: '',
  spec_value: '',
})

const addSpec = () => {
  if (props.disabled || specs.value.length >= MAX_PRODUCT_SPECS) return
  emit('update:modelValue', [...specs.value, createSpec()])
}

const updateSpec = (index, field, value) => {
  const updated = specs.value.map((spec, specIndex) => (
    specIndex === index ? { ...spec, [field]: value } : spec
  ))
  emit('update:modelValue', updated)
}

const removeSpec = (index) => {
  if (props.disabled) return
  emit('update:modelValue', specs.value.filter((_, specIndex) => specIndex !== index))
}

const moveSpec = (index, direction) => {
  if (props.disabled) return
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= specs.value.length) return
  const updated = [...specs.value]
  const [spec] = updated.splice(index, 1)
  updated.splice(targetIndex, 0, spec)
  emit('update:modelValue', updated)
}
</script>

<template>
  <section class="space-y-4 border-t border-bg-alt pt-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-sm font-bold text-text-main">Product specifications</h2>
        <p class="mt-1 text-xs leading-5 text-text-muted">Add flexible details such as software, compatibility, dimensions, or language.</p>
      </div>
      <button type="button" :disabled="disabled || specs.length >= MAX_PRODUCT_SPECS" class="text-sm font-bold text-primary transition hover:text-primary-dark disabled:cursor-not-allowed disabled:opacity-50" @click="addSpec">+ Add specification</button>
    </div>

    <div v-if="specs.length" class="space-y-3">
      <div v-for="(spec, index) in specs" :key="spec.id || spec._key || index" class="grid gap-3 rounded-xl border border-bg-alt bg-bg/50 p-4 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-end">
        <label class="block min-w-0">
          <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">Specification name</span>
          <input :value="spec.spec_name" required :maxlength="MAX_SPEC_NAME_LENGTH" :disabled="disabled" class="w-full rounded-lg border border-bg-alt bg-bg px-3 py-2.5 text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60" placeholder="e.g. Software" @input="updateSpec(index, 'spec_name', $event.target.value)">
        </label>
        <label class="block min-w-0">
          <span class="mb-2 block text-xs font-bold uppercase tracking-wider text-text-muted">Value</span>
          <input :value="spec.spec_value" required :maxlength="MAX_SPEC_VALUE_LENGTH" :disabled="disabled" class="w-full rounded-lg border border-bg-alt bg-bg px-3 py-2.5 text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60" placeholder="e.g. Adobe Photoshop" @input="updateSpec(index, 'spec_value', $event.target.value)">
        </label>
        <div class="flex h-10 items-center justify-end gap-1">
          <button type="button" :disabled="disabled || index === 0" :aria-label="`Move specification ${index + 1} up`" class="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" @click="moveSpec(index, -1)">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m5 15 7-7 7 7" /></svg>
          </button>
          <button type="button" :disabled="disabled || index === specs.length - 1" :aria-label="`Move specification ${index + 1} down`" class="flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-alt hover:text-primary disabled:cursor-not-allowed disabled:opacity-30" @click="moveSpec(index, 1)">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19 9-7 7-7-7" /></svg>
          </button>
          <button type="button" :disabled="disabled" :aria-label="`Remove specification ${index + 1}`" class="h-9 rounded-lg px-2 text-sm font-bold text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50" @click="removeSpec(index)">Remove</button>
        </div>
      </div>
    </div>
    <p v-else class="rounded-xl border border-dashed border-bg-alt p-4 text-sm text-text-muted">No custom specifications added. This section is optional.</p>
    <p class="text-right text-xs text-text-muted">{{ specs.length }}/{{ MAX_PRODUCT_SPECS }} specifications</p>
  </section>
</template>
