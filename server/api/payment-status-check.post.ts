import { processPendingOrders } from '~/server/utils/xendit-payment-processor';

/**
 * API endpoint to manually trigger payment status checks for pending orders
 * This can be called by:
 * 1. Cron jobs for scheduled checks
 * 2. Admin panel for manual checks
 * 3. Monitoring systems
 * 
 * SECURITY: In production, this should be protected with authentication
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const secretKey = String(config.xenditSecretKey || process.env.XENDIT_SECRET_KEY || '').trim();

  if (!secretKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'XENDIT_SECRET_KEY is not configured.'
    });
  }

  // Get optional parameters from request body
  const body = await readBody(event).catch(() => ({}));
  const maxOrders = body?.maxOrders || 50;
  const olderThanMinutes = body?.olderThanMinutes || 30;

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
