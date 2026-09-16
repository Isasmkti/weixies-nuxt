import { rGetAdminOperationsHealth } from '../repositories/adminOperationsRepository'

const numberValue = (value) => Number(value) || 0

export async function getAdminOperationsHealth() {
  const data = await rGetAdminOperationsHealth()
  const counts = data?.counts || {}

  return {
    status: data?.status === 'attention' ? 'attention' : 'healthy',
    attentionCount: numberValue(data?.attentionCount),
    checkedAt: data?.checkedAt || null,
    counts: {
      stalePendingOrders: numberValue(counts.stalePendingOrders),
      recentPaymentErrors: numberValue(counts.recentPaymentErrors),
      refundAttention: numberValue(counts.refundAttention),
      payoutExceptions: numberValue(counts.payoutExceptions),
      stalledPayouts: numberValue(counts.stalledPayouts),
      automationAttention: numberValue(counts.automationAttention),
    },
    jobs: Array.isArray(data?.jobs) ? data.jobs : [],
  }
}
