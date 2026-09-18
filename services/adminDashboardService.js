import { rGetAdminDashboard } from '../repositories/adminDashboardRepository'

const numberValue = (value) => Number(value) || 0

export async function getAdminDashboard() {
  const data = await rGetAdminDashboard()
  const metrics = data.metrics || {}

  return {
    metrics: {
      grossGmv: numberValue(metrics.gross_gmv ?? metrics.gmv),
      grossGmvChange: numberValue(metrics.gross_gmv_change ?? metrics.gmv_change),
      refundAmount: numberValue(metrics.refund_amount),
      netGmv: numberValue(metrics.net_gmv ?? metrics.gmv),
      netGmvChange: numberValue(metrics.net_gmv_change ?? metrics.gmv_change),
      grossPlatformRevenue: numberValue(metrics.gross_platform_revenue),
      netPlatformRevenue: numberValue(metrics.net_platform_revenue),
      netRevenueChange: numberValue(metrics.net_revenue_change),
      netSellerEarnings: numberValue(metrics.net_seller_earnings),
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
          grossGmv: numberValue(point.gross_gmv),
          refunds: numberValue(point.refunds),
          netGmv: numberValue(point.net_gmv ?? point.revenue),
          netRevenue: numberValue(point.net_revenue),
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
