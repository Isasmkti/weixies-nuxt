import { supabase } from "../utils/supabase";

// Get current user.
// Uses getSession() (reads the local/cached session, no network round-trip)
// instead of getUser() (which re-validates the JWT against the Supabase Auth
// server every call). This is safe for client-side routing/UI gating because
// every sensitive server operation independently re-verifies the JWT/ownership
// (RLS or service-role checks in the API routes), so a tampered local session
// simply fails there instead of here.
export const getUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
};

// Get user profile (role from database)
export const getUserProfile = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
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