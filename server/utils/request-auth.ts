import { createClient, type User } from '@supabase/supabase-js';

export async function requireRequestUser(event: any): Promise<{ supabase: any; user: User }> {
  const config = useRuntimeConfig();
  const authorization = String(getRequestHeader(event, 'authorization') || '').trim();

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }

  return { supabase, user };
}
