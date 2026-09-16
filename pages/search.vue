<script setup>
import { normalizeMarketplaceSearchQuery } from '../utils/marketplaceSearch'

const route = useRoute()
const query = normalizeMarketplaceSearchQuery(route.query.q)

await navigateTo({
  path: '/products',
  query: {
    ...(query ? { q: query } : {}),
    focus: 'search',
  },
}, { replace: true, redirectCode: 301 })
</script>
