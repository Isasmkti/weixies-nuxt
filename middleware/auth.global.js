import { getUser, getUserProfile } from '~/services/authService'
import { getSellerByProfileId } from '~/services/sellerService'

export default defineNuxtRouteMiddleware(async (to, from) => {
  // In a real SSR app with Supabase, we would use useSupabaseUser()
  // But since we're using the existing client-side auth service:
  
  // Skip on server side if auth service is purely client-side
  if (import.meta.server) return

  const user = await getUser()

  // Pages that require auth
  const authRoutes = ['/cart', '/wishlist', '/dashboard', '/admin', '/admin/products', '/admin/products/create', '/become-seller', '/seller']
  const isAdminRoute = to.path.startsWith('/admin')
  const isSellerRoute = to.path === '/seller' || to.path.startsWith('/seller/')
  const requiresAuth = authRoutes.some(route => to.path === route || to.path.startsWith(route + '/'))

  if (requiresAuth && !user) {
    return navigateTo('/login')
  }

  if (isAdminRoute) {
    const profile = await getUserProfile()
    if (!profile || profile.role !== 'admin') {
      return navigateTo('/dashboard')
    }
  }

  if (isSellerRoute || to.path === '/become-seller') {
    try {
      const seller = await getSellerByProfileId(user.id)

      if (to.path === '/become-seller') {
        if (!seller) return
        if (seller.status === 'rejected') return
        return navigateTo(seller.status === 'approved' ? '/seller' : '/seller/pending')
      }

      if (!seller) {
        return navigateTo('/become-seller')
      }

      if (seller.status === 'approved') {
        if (to.path === '/seller/pending') {
          return navigateTo('/seller')
        }
        return
      }

      if (to.path !== '/seller/pending') {
        return navigateTo('/seller/pending')
      }
    } catch (error) {
      console.error('[Seller middleware] Failed to load seller status:', error)
      return navigateTo('/dashboard')
    }
  }

  if (to.path === '/' && !user) {
    return navigateTo('/welcome')
  }

  if (to.path === '/welcome' && user) {
    return navigateTo('/')
  }
})
