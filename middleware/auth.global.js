import { getUser, getUserProfile } from '~/services/authService'
import { getSellerByProfileId } from '~/services/sellerService'

const AUTH_ROUTE_PREFIXES = [
  '/dashboard',
  '/cart',
  '/wishlist',
  '/purchases',
  '/orders',
  '/messages',
  '/refunds',
  '/become-seller',
  '/seller',
  '/admin',
]

const matchesPrefix = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`)
const redirectTo = path => navigateTo(path, { replace: true })

export default defineNuxtRouteMiddleware(async (to) => {
  // Private routes are client-rendered in nuxt.config because the current
  // Supabase session is stored in the browser and is not available during SSR.
  if (import.meta.server) return

  // `/` and `/welcome` stay server-rendered for SEO. On their initial load,
  // hydrate the server-rendered page first; app.vue performs the session-based
  // redirect after mount so pages with different layouts are never hydrated
  // against one another.
  const nuxtApp = useNuxtApp()
  const isInitialPublicHydration = nuxtApp.isHydrating
    && nuxtApp.payload.serverRendered
    && (to.path === '/' || to.path === '/welcome')
  if (isInitialPublicHydration) return

  const user = await getUser()
  const isAdminRoute = matchesPrefix(to.path, '/admin')
  const isSellerRoute = matchesPrefix(to.path, '/seller')
  const requiresAuth = AUTH_ROUTE_PREFIXES.some(prefix => matchesPrefix(to.path, prefix))

  if (requiresAuth && !user) {
    return redirectTo('/login')
  }

  if (isAdminRoute) {
    const profile = await getUserProfile()
    if (!profile || profile.role !== 'admin') {
      return redirectTo('/dashboard')
    }
  }

  if (isSellerRoute || to.path === '/become-seller') {
    try {
      const seller = await getSellerByProfileId(user.id)

      if (to.path === '/become-seller') {
        if (!seller) return
        if (seller.status === 'rejected') return
        return redirectTo(seller.status === 'approved' ? '/seller' : '/seller/pending')
      }

      if (!seller) {
        return redirectTo('/become-seller')
      }

      if (seller.status === 'approved') {
        if (to.path === '/seller/pending') {
          return redirectTo('/seller')
        }
        return
      }

      if (to.path !== '/seller/pending') {
        return redirectTo('/seller/pending')
      }
    } catch (error) {
      console.error('[Seller middleware] Failed to load seller status:', error)
      return redirectTo('/dashboard')
    }
  }

  if (to.path === '/' && !user) {
    return redirectTo('/welcome')
  }

  if (to.path === '/welcome' && user) {
    if (to.query.preview === '1') {
      const profile = await getUserProfile()
      if (profile?.role === 'admin') return
    }
    return redirectTo('/')
  }
})
