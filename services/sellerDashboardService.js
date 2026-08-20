import { rGetSellerDashboardProducts, rGetSellerPaidSales } from '../repositories/sellerDashboardRepository'

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1)
const isWithin = (value, start, end) => {
  const timestamp = new Date(value).getTime()
  return timestamp >= start.getTime() && timestamp < end.getTime()
}

const percentageChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

const saleDate = (sale) => sale.orders?.created_at || sale.orders?.[0]?.created_at
const sellerEarning = (sale) => Number(sale.seller_earning) || 0

export async function getSellerDashboardSummary(sellerId) {
  const [products, sales] = await Promise.all([
    rGetSellerDashboardProducts(sellerId),
    rGetSellerPaidSales(sellerId),
  ])

  const sortedSales = [...sales].sort((left, right) => (
    new Date(saleDate(right) || 0) - new Date(saleDate(left) || 0)
  ))
  const now = new Date()
  const currentMonthStart = startOfMonth(now)
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const currentMonthSales = sortedSales.filter((sale) => isWithin(saleDate(sale), currentMonthStart, nextMonthStart))
  const previousMonthSales = sortedSales.filter((sale) => isWithin(saleDate(sale), previousMonthStart, currentMonthStart))
  const currentRevenue = currentMonthSales.reduce((total, sale) => total + sellerEarning(sale), 0)
  const previousRevenue = previousMonthSales.reduce((total, sale) => total + sellerEarning(sale), 0)
  const weekAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000))

  const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1)
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    return {
      key: `${monthStart.getFullYear()}-${monthStart.getMonth()}`,
      label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(monthStart),
      value: sortedSales
        .filter((sale) => isWithin(saleDate(sale), monthStart, monthEnd))
        .reduce((total, sale) => total + sellerEarning(sale), 0),
    }
  })

  return {
    totalSales: sortedSales.length,
    totalRevenue: sortedSales.reduce((total, sale) => total + sellerEarning(sale), 0),
    activeProducts: products.filter((product) => product.status === 'published').length,
    recentlyAddedProducts: products.filter((product) => new Date(product.created_at) >= weekAgo).length,
    salesGrowth: percentageChange(currentMonthSales.length, previousMonthSales.length),
    revenueGrowth: percentageChange(currentRevenue, previousRevenue),
    monthlyRevenue,
    recentSales: sortedSales.slice(0, 5),
  }
}

