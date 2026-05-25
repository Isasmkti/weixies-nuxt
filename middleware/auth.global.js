import { getUser, getUserProfile } from '~/services/authService'

export default defineNuxtRouteMiddleware(async (to, from) => {
  // In a real SSR app with Supabase, we would use useSupabaseUser()
  // But since we're using the existing client-side auth service:
  
  // Skip on server side if auth service is purely client-side
  if (import.meta.server) return

  const user = await getUser()

  // Pages that require auth
  const authRoutes = ['/cart', '/wishlist', '/dashboard', '/admin', '/admin/products', '/admin/products/create']
  const isAdminRoute = to.path.startsWith('/admin')
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

  if (to.path === '/' && !user) {
    return navigateTo('/welcome')
  }

  if (to.path === '/welcome' && user) {
    return navigateTo('/')
  }
})
