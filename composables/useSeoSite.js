import { computed } from 'vue'
import { normalizeSiteOrigin, toAbsoluteSeoUrl } from '../utils/seo'

export function useSeoSite() {
  const route = useRoute()
  const config = useRuntimeConfig()
  const requestUrl = useRequestURL()
  const siteOrigin = computed(() => normalizeSiteOrigin(config.public.siteUrl, requestUrl.origin))
  const canonicalUrl = computed(() => toAbsoluteSeoUrl(route.path || '/', siteOrigin.value))
  const absoluteUrl = value => toAbsoluteSeoUrl(value, siteOrigin.value)

  return { siteOrigin, canonicalUrl, absoluteUrl }
}
