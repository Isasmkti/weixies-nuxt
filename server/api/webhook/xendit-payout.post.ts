import { verifyXenditCallbackToken } from '~/server/utils/xendit';
import { applyXenditPayoutObject } from '~/server/utils/xendit-payout';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const PAYOUT_EVENTS = new Set([
  'v3_payout.succeeded',
  'v3_payout.failed',
  'v3_payout.reversed',
  'v3_payout.rejected',
  'v3_payout.pending_compliance',
]);

const EVENT_STATUS = new Map([
  ['v3_payout.succeeded', 'SUCCEEDED'],
  ['v3_payout.failed', 'FAILED'],
  ['v3_payout.reversed', 'REVERSED'],
  ['v3_payout.rejected', 'REJECTED'],
  ['v3_payout.pending_compliance', 'PENDING_COMPLIANCE_REVIEW'],
]);

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const config = useRuntimeConfig();
  const webhookId = String(getRequestHeader(event, 'webhook-id') || '').trim() || null;
  const webhookToken = String(config.xenditPayoutWebhookToken || config.xenditWebhookToken || '').trim();
  const receivedToken = String(getRequestHeader(event, 'x-callback-token') || '').trim();

  if (!webhookToken) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_PAYOUT_WEBHOOK_TOKEN is not configured.' });
  }
  if (!verifyXenditCallbackToken(receivedToken, webhookToken)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Xendit callback token.' });
  }

  const eventName = String(body?.event || '').trim().toLowerCase();
  if (!PAYOUT_EVENTS.has(eventName)) {
    return { status: 'ignored', reason: 'unsupported_payout_event' };
  }

  const configuredBusinessId = String(config.xenditBusinessId || '').trim();
  const receivedBusinessId = String(body?.business_id || body?.data?.business_id || '').trim();
  if (configuredBusinessId && receivedBusinessId !== configuredBusinessId) {
    throw createError({ statusCode: 401, statusMessage: 'Xendit business ID does not match.' });
  }

  const payout = body?.data;
  if (!payout?.payout_id || !payout?.reference_id || !payout?.status) {
    throw createError({ statusCode: 400, statusMessage: 'Incomplete Xendit payout webhook.' });
  }
  if (String(payout.status).toUpperCase() !== EVENT_STATUS.get(eventName)) {
    throw createError({ statusCode: 400, statusMessage: 'Xendit payout event and status do not match.' });
  }

  // The Xendit dashboard sends a canned payload when "Test and Save" is
  // clicked. Its reference does not belong to this application. Acknowledge
  // it without touching the ledger so Xendit does not retry a valid test.
  const supabase = useSupabaseAdmin();
  const { data: localPayout, error: lookupError } = await supabase
    .from('seller_payouts')
    .select('id')
    .eq('provider', 'xendit')
    .eq('provider_reference_id', String(payout.reference_id))
    .maybeSingle();

  if (lookupError) {
    throw createError({
      statusCode: 500,
      statusMessage: `Payout webhook lookup failed: ${lookupError.message}`,
    });
  }
  if (!localPayout) {
    return {
      status: 'ignored',
      reason: 'unknown_payout_reference',
      webhookId,
    };
  }

  try {
    const result = await applyXenditPayoutObject(eventName, payout, body, webhookId);
    return { status: 'ok', webhookId, result };
  } catch (error: any) {
    // A payout could only disappear between lookup and the atomic RPC through
    // an exceptional service-role operation. Treat it like an unknown event.
    if (error?.code === 'P0002') {
      return { status: 'ignored', reason: 'unknown_payout_reference', webhookId };
    }
    throw error;
  }
});
