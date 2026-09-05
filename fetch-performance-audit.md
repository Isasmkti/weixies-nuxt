# Fetching and rendering audit

## FILES ANALYZED

- `pages/login.vue`, `composables/useAuth.js`, `services/authService.js`, `middleware/auth.global.js`, `app.vue`.
- `layouts/default.vue`, `layouts/product.vue`, `components/Sidebar.vue`, `components/admin/AdminSidebar.vue`, `components/MobileNavbar.vue`, `components/Navbar.vue`.
- `pages/index.vue` (the actual home route), `pages/dashboard.vue`, `pages/admin/index.vue`, `pages/products/index.vue`, `pages/stores/[slug].vue`, `pages/cart.vue`, `pages/orders/index.vue`.
- `composables/useCatalogUI.js`, `composables/useProductDetailUI.js`, product/category/cart/wishlist/welcome stores and their services/repositories.
- `components/home/HomePromoCarousel.vue`, `components/Hero.vue`, `components/FeaturedProducts.vue`.
- Admin dashboard RPC and seller dashboard summary services: the former already uses one existing RPC; the latter already parallelizes independent reads. No replacement aggregate API was needed.

## ROOT CAUSE

- Login already awaits Supabase sign-in and profile loading, but then queries the role again. Sidebar and Home fetch the same profile again.
- Auth refs were module-scoped rather than scoped to the Nuxt application/request.
- Home waits for profile before starting public data. Independent section loading flags reveal sections separately. Its products are taken from mutable catalog filters/pagination.
- Dashboard performs profile, unread-count, and seller queries serially and shows default labels before they finish.
- Categories are requested on both catalog SSR/bootstrap and mount, with no in-flight deduplication.
- Product detail requests recommendations that no consumer displays, and waits for them and cart before releasing its loading state.
- Storefront watches its store inside `useAsyncData` and also explicitly calls `refreshProducts` for the same change.
- Cart and wishlist reads can overlap, and pending reads can repopulate cleared account state.
- Global client plugins loaded ApexCharts, SweetAlert2, and VueUse Motion on routes that never use them.
- Home/landing product cards used the full catalog query, including product files, license rows, and full review rows.
- Home eagerly loaded product images and product cards were click handlers rather than crawlable links.
- The displayed SVG brand logo embeds a large raster image. It is intentionally retained to preserve the established brand artwork; a visually identical optimized export should replace the file later.

## FILES CHANGED

- `composables/useAuth.js`, `pages/login.vue`, `app.vue`.
- `layouts/default.vue`, `components/Sidebar.vue`, `components/admin/AdminSidebar.vue`.
- `pages/index.vue`, `pages/dashboard.vue`, `pages/stores/[slug].vue`.
- `composables/useProductDetailUI.js`.
- `stores/categoriesStore.js`, `stores/cartStore.js`, `stores/wishlistStore.js`.
- `tests/fetchState.test.mjs` and this report.
- `components/Hero.vue`, `components/FeaturedProducts.vue`, `components/home/HomePromoCarousel.vue`, and `components/ai/CustomerServiceChat.vue`.
- `repositories/productsRepository.js`, `services/productsService.js`, `stores/welcomeStore.js`, and public-image upload repositories/services.
- `pages/admin/index.vue`, `pages/cart.vue`, `pages/wishlist.vue`, `components/orders/OrderProductReview.vue`, and `nuxt.config.ts`.
- Removed unused global plugins for ApexCharts, Motion, and SweetAlert2; their dependencies now load only where used.

## BEFORE

Login -> sign-in/session -> full profile -> role query -> redirect.
Home mount -> profile -> banner/categories/products with independent section reveals.
Dashboard mount -> profile -> unread messages -> seller -> initialize edit form.

## AFTER

Login -> sign-in/session -> full profile -> redirect using that profile.
Home -> stable section skeletons -> concurrent public reads -> coordinated reveal.
Dashboard -> stable skeleton -> concurrent account reads -> initialize form and reveal.
Navigation owns its initial profile read; sidebar components consume shared state.
Public Home data uses Nuxt `useAsyncData` with lazy client navigation and SSR payload reuse.

## PARALLELIZED REQUESTS

- Home carousel, unfiltered featured products, categories. All requests settle before initial content is released; failures expose retry UI.
- Dashboard profile, unread count, seller application. Seller/profile failures expose a retry instead of misleading default account details.
- Product detail initialization and cart loading no longer depend on recommendation fetching.

## DUPLICATE REQUESTS REMOVED

- Login role query and sidebar-owned profile requests.
- Concurrent profile requests are coalesced per Nuxt state ref; successful reads are reused for 30 seconds. Profile updates explicitly refresh.
- Category requests are coalesced per Pinia instance and successful results reused for 60 seconds, including empty results. `force: true` refreshes explicitly.
- Concurrent cart/wishlist reads share a request per account. These private stores do not receive a time-based cache.
- Unused recommendation catalog request and redundant storefront refresh watcher.
- Dashboard's extra profile refresh after `updateProfile`, which already refreshes.

## AUTH FLOW CHANGES

- Existing Supabase password login and client-side session model are retained.
- Shared profile/user/loading use Nuxt `useState` rather than module-global refs.
- Login uses the profile already fetched during sign-in and awaits navigation.
- Auth changes clear old profile/cart/wishlist state on logout or account changes. Pending profile/private-store reads are guarded against restoring reset account state.
- Middleware authorization and server/RLS checks were not replaced by the display cache.

## LOADING UX CHANGES

- Home sections use one initial loading boundary, with category/product skeletons matching responsive grids.
- Dashboard profile, seller CTA, activity cards, and edit form appear after initial reads settle.
- Default layout reserves sidebar and mobile-navigation space while profile initializes.
- Product detail no longer treats ancillary cart/recommendation reads as prerequisites for the product display.
- Skeleton animations added here respect reduced-motion preferences.
- Home product images below the viewport use native lazy loading and explicit dimensions; the promo/landing hero images receive high fetch priority.
- The initial AI support launcher stays lightweight. The conversation implementation loads when the user opens it.
- Home category data now travels in the page payload. If the public category query legitimately returns no rows, a stable catalog link replaces the empty section.

## SEO CHECK

- `/` is an authenticated/personal Home route and intentionally returns `noindex, nofollow`. A Lighthouse SEO score taken on this route is expected to be lower and must not be fixed by making private content indexable.
- `/welcome`, `/products`, product details, and approved storefronts are the indexable routes.
- Local SSR checks found title, description, canonical URL, `index, follow`, and an H1 on `/welcome`, `/products`, and the tested product detail.
- Website and Product JSON-LD parsed successfully. The XML sitemap parsed successfully with 10 current URLs.
- `/robots.txt`, `/sitemap.xml`, and `/googleb3eb07e69cffa2bf.html` returned HTTP 200 locally.
- Home product cards now render as real links, improving keyboard access and crawler discovery.

## POTENTIAL RISKS

- A coordinated reveal takes as long as its slowest required query. This removes unnecessary serial latency; it does not guarantee every upstream service responds quickly.
- Images still load according to browser/network behavior. Coordinated data rendering does not preload every image.
- Existing Supabase images keep their current object cache metadata. The one-year immutable cache setting applies to newly uploaded timestamped images; re-upload an existing banner once if its current cache metadata is poor.
- Cached profile/category UI can be up to 30/60 seconds old. Authorization remains independently checked by existing middleware/API/RLS.
- Auth remains browser-session based; this task does not introduce cookie-based SSR authentication.
- Live browser timings, Supabase failure simulations, and production SSR responses have not been measured in this run. No performance percentage is claimed.
- Lighthouse run against Nuxt's development server includes Vite, HMR, unminified modules, source transforms, and stored IndexedDB state. Use an incognito production deployment run for a comparable score.

## VALIDATION

- Changed Vue scripts and templates parsed/compiled successfully with the installed Vue compiler (no application build).
- Four behavioral tests cover profile coalescing/logout, category cache/refresh, cart coalescing/reset, and wishlist coalescing/reset.
- Existing self-purchase and product-submission tests passed alongside those tests: 12 total.
- Local SSR response sizes after the query/DOM cleanup were approximately 25 KB for Home and 60 KB for Welcome. These are development HTML sizes, not compressed transfer sizes.
- Run the focused suite with `node --experimental-vm-modules --test tests/fetchState.test.mjs`.

## MANUAL TEST CHECKLIST

1. Use browser Network throttling, sign in as buyer and admin, and confirm the correct destination/menu and coordinated initial content.
2. Hard-refresh Home and Dashboard. Navigation should reserve its space; Dashboard should not briefly offer seller onboarding to an approved seller.
3. Filter/page the catalog, then visit Home: featured products should remain the latest eight unfiltered products.
4. Open catalog from Home: categories should reuse recent data; cart/wishlist indicators must still reflect the signed-in account.
5. Save a profile edit and check the sidebar/dashboard update. Logout during a slow request, then log into a different account and check for old state.
6. Open product detail directly and navigate between products: the main product must not wait for a recommendation request.
7. Edit a storefront and confirm products refresh once through the existing async-data watch.
8. Simulate failed Home and Dashboard reads and use the retry button. Confirm loading ends and no default seller action is shown after seller/profile failure.
9. Check desktop/mobile, light/dark themes, public product SEO HTML, checkout and paid-order access.

## REFERENCES

- https://nuxt.com/docs/4.x/api/composables/use-async-data
- https://nuxt.com/docs/4.x/getting-started/state-management
