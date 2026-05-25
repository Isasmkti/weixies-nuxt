import { ref } from 'vue'

const STORAGE_KEY = 'weixies_recent_searches'
const MAX_RECENT = 8

const recentSearches = ref(loadFromStorage())

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function useRecentSearches() {
  const addSearch = (query) => {
    const trimmed = query?.trim()
    if (!trimmed) return

    // Remove if already exists, then prepend
    const filtered = recentSearches.value.filter(
      (s) => s.toLowerCase() !== trimmed.toLowerCase()
    )
    filtered.unshift(trimmed)

    // Cap at max
    recentSearches.value = filtered.slice(0, MAX_RECENT)
    saveToStorage(recentSearches.value)
  }

  const removeSearch = (query) => {
    recentSearches.value = recentSearches.value.filter((s) => s !== query)
    saveToStorage(recentSearches.value)
  }

  const clearAll = () => {
    recentSearches.value = []
    saveToStorage([])
  }

  return {
    recentSearches,
    addSearch,
    removeSearch,
    clearAll
  }
}
