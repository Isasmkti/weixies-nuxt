import { createClient, type User } from '@supabase/supabase-js';

export async function optionalRequestUser(event: any): Promise<{ supabase: any; user: User } | null> {
  const config = useRuntimeConfig();
  const authorization = String(getRequestHeader(event, 'authorization') || '').trim();

  if (!authorization) return null;
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid authorization header.' });
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

export async function requireRequestUser(event: any): Promise<{ supabase: any; user: User }> {
  const requestUser = await optionalRequestUser(event);
  if (!requestUser) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }
  return requestUser;
}
