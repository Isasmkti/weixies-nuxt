import { processPendingOrders } from '~/server/utils/xendit-payment-processor';
import { verifyXenditCallbackToken } from '~/server/utils/xendit';
import {
  beginSystemJob,
  completeSystemJob,
  systemJobErrorSummary,
} from '~/server/utils/system-job-run';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');

  const config = useRuntimeConfig();
  const cronSecret = String(config.cronSecret || '').trim();
  const authorization = String(getRequestHeader(event, 'authorization') || '').trim();
  const receivedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';

  if (!cronSecret) {
    throw createError({ statusCode: 500, statusMessage: 'CRON_SECRET is not configured.' });
  }
  if (!verifyXenditCallbackToken(receivedSecret, cronSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid cron authorization.' });
  }

  const secretKey = String(config.xenditSecretKey || '').trim();
  if (!secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not configured.' });
  }

  const runId = await beginSystemJob('payment_reconciliation', 1800);
  if (!runId) {
    return { ok: true, skipped: true, reason: 'already_running' };
  }

  try {
    const result = await processPendingOrders(secretKey, {
      maxOrders: 100,
      olderThanMinutes: 15,
    });

    if (result.failed > 0) {
      console.error('[Payment Reconciliation Cron] Some pending orders require attention:', result.errors);
    }

    await completeSystemJob(runId, {
      status: result.failed > 0 ? 'partial' : 'succeeded',
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      errorSummary: result.errors.join('\n'),
    });

    return {
      ok: result.failed === 0,
      executedAt: new Date().toISOString(),
      ...result,
    };
  } catch (error) {
    await completeSystemJob(runId, {
      status: 'failed',
      processed: 0,
      succeeded: 0,
      failed: 0,
      errorSummary: systemJobErrorSummary(error),
    }).catch(completionError => console.error('[Payment Reconciliation Cron] Could not close job run:', completionError));
    throw error;
  }
});
