import { rGetAdminDashboard } from '../repositories/adminDashboardRepository'

const numberValue = (value) => Number(value) || 0

export async function getAdminDashboard() {
  const data = await rGetAdminDashboard()
  const metrics = data.metrics || {}

  return {
    metrics: {
      gmv: numberValue(metrics.gmv),
      gmvChange: numberValue(metrics.gmv_change),
      transactions: numberValue(metrics.transactions),
      transactionChange: numberValue(metrics.transaction_change),
      users: numberValue(metrics.users),
      userChange: numberValue(metrics.user_change),
      activeSellers: numberValue(metrics.active_sellers),
      sellerChange: numberValue(metrics.seller_change),
    },
    pendingSellers: numberValue(data.pending_sellers),
    chart: Array.isArray(data.chart)
      ? data.chart.map((point) => ({
          date: point.date,
          revenue: numberValue(point.revenue),
          transactions: numberValue(point.transactions),
        }))
      : [],
    recentOrders: Array.isArray(data.recent_orders)
      ? data.recent_orders.map((order) => ({
          ...order,
          total_amount: numberValue(order.total_amount),
          product_names: Array.isArray(order.product_names) ? order.product_names : [],
        }))
      : [],
  }
}
