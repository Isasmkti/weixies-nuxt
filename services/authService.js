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

// Sign out locally before revoking the refresh token remotely. Supabase's
// public signOut() performs the remote request first, which can leave the UI
// waiting on a slow network even though logging out of this browser only needs
// the local session to be removed.
export const signOut = async () => {
  const auth = supabase.auth;
  let accessToken = null;

  try {
    const { data } = await auth.getSession();
    accessToken = data.session?.access_token ?? null;
  } catch {
    // Local cleanup must still run when the cached session cannot be read.
  }

  // _removeSession is the same local cleanup used internally by auth-js. The
  // fallback keeps this compatible if a future auth-js version stops exposing
  // that method at runtime.
  if (typeof auth._removeSession === "function") {
    await auth._removeSession();

    // Revocation is still attempted, but it must never block navigation. A
    // local scope logs out only this session rather than every user device.
    if (accessToken && typeof auth.admin?.signOut === "function") {
      try {
        void Promise.resolve(auth.admin.signOut(accessToken, "local")).catch(() => {});
      } catch {
        // The browser is already signed out; remote revocation is best-effort.
      }
    }
    return;
  }

  const { error } = await auth.signOut({ scope: "local" });
  if (error) throw error;
};
