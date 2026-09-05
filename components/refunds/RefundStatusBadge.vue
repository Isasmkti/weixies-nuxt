<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
})

const statusMeta = computed(() => ({
  requested: { label: 'Under review', classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  manual_action_required: { label: 'Manual processing', classes: 'bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  submitted: { label: 'Processing refund', classes: 'bg-primary/10 text-primary' },
  succeeded: { label: 'Refund processed', classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  failed: { label: 'Needs attention', classes: 'bg-danger/10 text-danger' },
  cancelled: { label: 'Cancelled', classes: 'bg-bg-alt text-text-muted' },
}[props.status] || { label: String(props.status || 'Unknown').replaceAll('_', ' '), classes: 'bg-bg-alt text-text-muted' }))
</script>

<template>
  <span class="inline-flex items-center gap-2 rounded-ui-full px-3 py-1.5 text-xs font-bold" :class="statusMeta.classes">
    <span class="h-1.5 w-1.5 rounded-ui-full bg-current"></span>
    {{ statusMeta.label }}
  </span>
</template>
