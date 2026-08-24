import { processPendingOrders } from '~/server/utils/xendit-payment-processor';
import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';

/**
 * API endpoint to manually trigger payment status checks for pending orders
 * This can be called by:
 * 1. Cron jobs for scheduled checks
 * 2. Admin panel for manual checks
 * 3. Monitoring systems
 * 
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const { supabase, user } = await requireRequestUser(event);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Platform admin access is required.' });
  }

  await enforceRateLimit(`payment-status-check:${user.id}`, 5, 60);

  const secretKey = String(config.xenditSecretKey || process.env.XENDIT_SECRET_KEY || '').trim();

  if (!secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'XENDIT_SECRET_KEY is not configured.'
    });
  }

  // Get optional parameters from request body
  const body = await readBody(event).catch(() => ({}));
  const maxOrders = Math.min(100, Math.max(1, Number.parseInt(String(body?.maxOrders ?? 50), 10) || 50));
  const olderThanMinutes = Math.min(10080, Math.max(5, Number.parseInt(String(body?.olderThanMinutes ?? 30), 10) || 30));

  console.log(`[Payment Status Check] Starting check: maxOrders=${maxOrders}, olderThanMinutes=${olderThanMinutes}`);

  const result = await processPendingOrders(secretKey, {
    maxOrders,
    olderThanMinutes
  });

  return {
    success: true,
    ...result,
    timestamp: new Date().toISOString()
  };
});
