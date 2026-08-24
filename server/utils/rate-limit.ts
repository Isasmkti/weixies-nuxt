import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc('consume_api_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw error;
  if (!data) {
    throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please try again later.' });
  }
}
