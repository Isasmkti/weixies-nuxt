import { ref } from 'vue'
import { supabase } from '../utils/supabase'

const user = ref(null)
const profile = ref(null)
const loading = ref(false)

export function useAuth() {

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
    await fetchProfile()

    return data
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
  }

  const fetchProfile = async () => {
    // Get current user without a network round-trip (see authService.getUser
    // for the rationale on getSession() vs getUser()).
     const { data: { session } } = await supabase.auth.getSession()
     const currentUser = session?.user
  if (!currentUser) return

  user.value = currentUser

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

    profile.value = data
  }

  const updateProfile = async (payload) => {
    loading.value = true
    try {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.value.id)

      if (error) throw error
      await fetchProfile()
    } finally {
      loading.value = false
    }
  }

  const uploadProfileImage = async (file) => {
    loading.value = true
    try {
      const fileExt = file.name.split('.').pop()
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
        .upload(fileName, file)

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
    uploadProfileImage
  }
}