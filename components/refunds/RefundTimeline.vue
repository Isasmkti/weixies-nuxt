<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true },
  requestedAt: { type: String, default: null },
  submittedAt: { type: String, default: null },
  resolvedAt: { type: String, default: null },
})

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Pending'

const steps = computed(() => {
  const submitted = ['submitted', 'succeeded'].includes(props.status)
  const resolved = ['succeeded', 'failed', 'cancelled'].includes(props.status)
  const resolutionLabel = props.status === 'succeeded'
    ? 'Refund processed'
    : props.status === 'failed'
      ? 'Processing failed'
      : props.status === 'cancelled'
        ? 'Review cancelled'
        : 'Final resolution'

  return [
    { label: 'Review opened', date: formatDate(props.requestedAt), complete: true, danger: false },
    {
      label: props.status === 'manual_action_required' ? 'Manual processing' : 'Sent to provider',
      date: props.status === 'manual_action_required' ? 'Administrator action required' : formatDate(props.submittedAt),
      complete: submitted || props.status === 'manual_action_required',
      danger: false,
    },
    {
      label: resolutionLabel,
      date: formatDate(props.resolvedAt),
      complete: resolved,
      danger: props.status === 'failed',
    },
  ]
})
</script>

<template>
  <ol class="grid gap-3 sm:grid-cols-3" aria-label="Refund progress">
    <li v-for="(step, index) in steps" :key="step.label" class="relative rounded-ui-md border border-border bg-bg/50 p-3">
      <div class="flex items-center gap-2">
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-ui-full text-[11px] font-black" :class="step.complete ? (step.danger ? 'bg-danger text-white' : 'bg-primary text-white') : 'bg-bg-alt text-text-muted'">{{ index + 1 }}</span>
        <p class="text-xs font-bold text-text-main">{{ step.label }}</p>
      </div>
      <p class="mt-2 pl-8 text-[11px] text-text-muted">{{ step.date }}</p>
    </li>
  </ol>
</template>
