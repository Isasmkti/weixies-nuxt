import { processPendingOrders } from '~/server/utils/xendit-payment-processor';

/**
 * Scheduled task to check payment status for pending orders
 * This runs automatically to catch missed webhooks and expired orders
 */
export default defineTask({
  meta: {
    description: 'Check payment status for pending orders',
    schedule: '*/30 * * * *' // Every 30 minutes
  },
  handler: async () => {
    const config = useRuntimeConfig();
    const secretKey = String(config.xenditSecretKey || process.env.XENDIT_SECRET_KEY || '').trim();

    if (!secretKey) {
      console.error('[Payment Status Check Task] XENDIT_SECRET_KEY is not configured');
      return { result: 'error', error: 'XENDIT_SECRET_KEY is not configured' };
    }

    console.log('[Payment Status Check Task] Starting scheduled payment status check');

    const result = await processPendingOrders(secretKey, {
      maxOrders: 100, // Process up to 100 orders per run
      olderThanMinutes: 15 // Check orders older than 15 minutes
    });

    console.log(`[Payment Status Check Task] Completed: ${result.succeeded}/${result.processed} succeeded`);

    if (result.failed > 0) {
      console.error(`[Payment Status Check Task] Failed orders:`, result.errors);
    }

    return {
      result: 'success',
      data: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        errors: result.errors
      }
    };
  }
});
