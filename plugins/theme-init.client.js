import { useThemeStore } from '~/stores/themeStore'

export default defineNuxtPlugin((nuxtApp) => {
  const themeStore = useThemeStore()
  themeStore.initTheme()
})
