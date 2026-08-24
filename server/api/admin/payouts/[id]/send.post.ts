import {
  createXenditPayout,
  getXenditPayout,
  XenditApiError,
} from '~/server/utils/xendit';
import {
  applyXenditPayoutObject,
  requirePlatformAdmin,
} from '~/server/utils/xendit-payout';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);

  const payoutId = String(getRouterParam(event, 'id') || '').trim();
  if (!UUID_PATTERN.test(payoutId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid payout ID is required.' });
  }

  const config = useRuntimeConfig();
  const secretKey = String(config.xenditSecretKey || '').trim();
  if (!secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not configured.' });
  }

  const supabase = useSupabaseAdmin();
  const { data: claimRows, error: claimError } = await supabase.rpc('claim_seller_payout_for_xendit', {
    p_payout_id: payoutId,
  });
  const payout: any = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (claimError || !payout) {
    throw createError({ statusCode: 409, statusMessage: claimError?.message || 'Payout could not be claimed.' });
  }

  try {
    if (payout.provider_payout_id) {
      const providerPayout = await getXenditPayout(payout.provider_payout_id, secretKey);
      const result = await applyXenditPayoutObject('admin.payout_sync', providerPayout, providerPayout);
      return { status: 'synced', payout: providerPayout, result };
    }

    const providerPayout = await createXenditPayout({
      referenceId: payout.provider_reference_id,
      idempotencyKey: payout.provider_reference_id,
      amount: Number(payout.amount),
      sellerId: payout.seller_id,
      recipientType: payout.recipient_type_snapshot,
      accountHolderName: payout.account_holder_name_snapshot,
      accountNumber: payout.bank_account_snapshot,
      routingType: payout.routing_type_snapshot,
      routingValue: payout.routing_value_snapshot,
      givenName: payout.recipient_given_name_snapshot,
      surname: payout.recipient_surname_snapshot,
      businessName: payout.recipient_business_name_snapshot,
      addressLine1: payout.address_line_1_snapshot,
      city: payout.city_snapshot,
      province: payout.province_snapshot,
      postalCode: payout.postal_code_snapshot,
    }, secretKey);

    const result = await applyXenditPayoutObject('admin.payout_submitted', providerPayout, providerPayout);
    return { status: 'submitted', payout: providerPayout, result };
  } catch (error) {
    const xenditError = error instanceof XenditApiError ? error : null;
    const providerStatus = xenditError?.isDefinitiveClientError ? 'FAILED' : 'SUBMISSION_UNKNOWN';

    await applyXenditPayoutObject('admin.payout_submission_error', {
      reference_id: payout.provider_reference_id,
      status: providerStatus,
      source_currency: 'IDR',
      source_amount: Number(payout.amount),
      failure_code: xenditError?.errorCode || 'REQUEST_ERROR',
    }, xenditError?.payload || { message: error instanceof Error ? error.message : String(error) });

    throw createError({
      statusCode: xenditError?.isDefinitiveClientError ? 422 : 502,
      statusMessage: xenditError?.message || 'Xendit payout submission is uncertain. Retry safely with the same batch.',
    });
  }
});
