import { supabase } from "../utils/supabase";

// Get current user
export const getUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data.user;
};

// Get user profile (role from database)
export const getUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error) return null;

  return data; // { role: 'admin' | 'user' | 'seller' }
};

// Sign out
export const signOut = async () => {
  await supabase.auth.signOut();
};
