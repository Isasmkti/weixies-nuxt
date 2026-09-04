import { processAutomaticSellerPayouts } from '~/server/utils/seller-payout-processor';
import { verifyXenditCallbackToken } from '~/server/utils/xendit';

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store');

  const config = useRuntimeConfig();
  const cronSecret = String(config.cronSecret || '').trim();
  const authorization = String(getRequestHeader(event, 'authorization') || '').trim();
  const receivedSecret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

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

  const result = await processAutomaticSellerPayouts(secretKey, 25);
  return {
    ok: result.failed === 0,
    executedAt: new Date().toISOString(),
    ...result,
  };
});
