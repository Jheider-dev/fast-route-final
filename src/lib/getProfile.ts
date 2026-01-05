import { supabase } from './supabase'

export async function getProfile() {
  const { data: auth } = await supabase.auth.getUser()

  if (!auth.user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', auth.user.id)
    .single()

  if (error) {
    console.error('Error getting profile:', error)
    return null
  }

  return data
}
