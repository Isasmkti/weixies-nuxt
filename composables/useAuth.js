import { supabase } from '../utils/supabase'

const profileRequests = new WeakMap()
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024
const PROFILE_IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function useAuth() {
  const user = useState('auth-user', () => null)
  const profile = useState('auth-profile', () => null)
  const loading = useState('auth-loading', () => false)
  const profileFetchedAt = useState('auth-profile-fetched-at', () => 0)
  const resetProfile = () => {
    user.value = null
    profile.value = null
    profileFetchedAt.value = 0
    profileRequests.delete(profile)
  }

  const signUp = async (email, password, fullName) => {
    loading.value = true

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })

    loading.value = false
    if (error) throw error

    return data
  }

  const signIn = async (email, password) => {
    loading.value = true

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    loading.value = false
    if (error) throw error

    user.value = data.user
    await fetchProfile({ force: true })

    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    user.value = null
    profile.value = null
    profileFetchedAt.value = 0
  }

  const fetchProfile = async ({ force = false } = {}) => {
    // Get current user without a network round-trip (see authService.getUser
    // for the rationale on getSession() vs getUser()).
     const { data: { session } } = await supabase.auth.getSession()
     const currentUser = session?.user
  if (!currentUser) {
    user.value = null
    profile.value = null
    profileFetchedAt.value = 0
    return null
  }

  user.value = currentUser
  if (profile.value?.id !== currentUser.id) profile.value = null
  if (!force && profile.value && Date.now() - profileFetchedAt.value < 30_000) return profile.value
  const pending = profileRequests.get(profile)
  if (pending?.userId === currentUser.id) return pending.promise

  const request = (async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single()

    if (error) throw error

    // Fix: If DB profile name defaults to email, use metadata name instead
    if (data && currentUser && currentUser.user_metadata?.full_name) {
      if (!data.full_name || data.full_name === currentUser.email) {
        data.full_name = currentUser.user_metadata.full_name
      }
    }

    if (user.value?.id === currentUser.id && profileRequests.get(profile)?.promise === request) {
      profile.value = data
      profileFetchedAt.value = Date.now()
    }
    return data
  })()
  profileRequests.set(profile, { userId: currentUser.id, promise: request })
  try {
    return await request
  } finally {
    if (profileRequests.get(profile)?.promise === request) profileRequests.delete(profile)
  }
  }

  const updateProfile = async (payload) => {
    loading.value = true
    try {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.value.id)

      if (error) throw error
      await fetchProfile({ force: true })
    } finally {
      loading.value = false
    }
  }

  const uploadProfileImage = async (file) => {
    loading.value = true
    try {
      if (!user.value?.id) throw new Error('You must be signed in to upload a profile image.')
      if (!file || !PROFILE_IMAGE_EXTENSIONS[file.type]) {
        throw new Error('Profile image must be a JPG, PNG, WEBP, or GIF file.')
      }
      if (file.size <= 0 || file.size > MAX_PROFILE_IMAGE_SIZE) {
        throw new Error('Profile image must be 5 MB or smaller.')
      }

      const fileExt = PROFILE_IMAGE_EXTENSIONS[file.type]
      const fileName = `${user.value.id}-${Date.now()}.${fileExt}`

      const oldImageUrl = profile.value?.profile_img
      const oldFileName = oldImageUrl?.split('/profile_img/')[1]

      if (oldFileName) {
        await supabase.storage
          .from('profile_img')
          .remove([oldFileName])
      }

      const { error } = await supabase.storage
        .from('profile_img')
        .upload(fileName, file, { contentType: file.type, cacheControl: '31536000', upsert: false })

      if (error) throw error

      const { data } = supabase.storage
        .from('profile_img')
        .getPublicUrl(fileName)

      return data.publicUrl
    } finally {
      loading.value = false
    }
  }

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    fetchProfile,
    updateProfile,
    uploadProfileImage,
    resetProfile
  }
}
