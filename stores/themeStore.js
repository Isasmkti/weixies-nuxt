import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useThemeStore = defineStore('theme', () => {
    const mode = ref('system') // 'light' | 'dark' | 'system'
    const isDark = ref(false)
    let mediaQuery = null
    let mediaListener = null

    const VALID_MODES = ['light', 'dark', 'system']

    const resolveMode = (value) => (VALID_MODES.includes(value) ? value : 'system')

    const getMediaQuery = () => {
        if (!mediaQuery) {
            mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        }
        return mediaQuery
    }

    const apply = (dark) => {
        isDark.value = dark
        document.documentElement.classList.toggle('dark', dark)
        document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }

    const applyCurrentTheme = () => {
        if (mode.value === 'dark') {
            apply(true)
            return
        }

        if (mode.value === 'light') {
            apply(false)
            return
        }

        apply(getMediaQuery().matches)
    }

    const setTheme = (value) => {
        mode.value = resolveMode(value)
        localStorage.setItem('theme', mode.value)
        applyCurrentTheme()
    }

    const watchSystemTheme = () => {
        if (mediaListener) return

        mediaListener = (e) => {
            if (mode.value === 'system') {
                apply(e.matches)
            }
        }

        const mq = getMediaQuery()
        if (mq.addEventListener) {
            mq.addEventListener('change', mediaListener)
        } else {
            mq.addListener(mediaListener)
        }
    }

    const initTheme = () => {
        const saved = localStorage.getItem('theme') || 'system'
        mode.value = resolveMode(saved)
        applyCurrentTheme()
        watchSystemTheme()
    }

    const toggleTheme = () => {
        if (isDark.value) {
            setTheme('light')
        } else {
            setTheme('dark')
        }
    }

    return {
        mode,
        isDark,
        setTheme,
        initTheme,
        watchSystemTheme,
        toggleTheme
    }
})
