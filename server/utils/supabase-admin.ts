import { createClient } from '@supabase/supabase-js';

/** Server-only client for trusted work that must bypass Supabase RLS. */
export function useSupabaseAdmin() {
  const config = useRuntimeConfig();
  const serviceRoleKey = String(config.supabaseServiceRoleKey || '').trim();

  if (!serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'SUPABASE_SERVICE_ROLE_KEY is not configured.'
    });
  }

  return createClient(config.public.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
