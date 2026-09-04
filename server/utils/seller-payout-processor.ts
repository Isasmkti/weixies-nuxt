import {
  createXenditPayout,
  getXenditPayout,
  XenditApiError,
} from './xendit';
import { applyXenditPayoutObject } from './xendit-payout';
import { useSupabaseAdmin } from './supabase-admin';

export async function submitOrSyncSellerPayout(payoutId: string, secretKey: string) {
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
      const result = await applyXenditPayoutObject('automatic.payout_sync', providerPayout, providerPayout);
      return { status: 'synced', payout: providerPayout, result };
    }

    const providerPayout = await createXenditPayout({
      referenceId: payout.provider_reference_id,
      idempotencyKey: payout.provider_reference_id,
      amount: Number(payout.amount),
      sellerId: payout.seller_id,
      bankCode: payout.bank_name_snapshot,
      accountHolderName: payout.account_holder_name_snapshot,
      accountNumber: payout.bank_account_snapshot,
      addressLine1: payout.address_line_1_snapshot,
      city: payout.city_snapshot,
      province: payout.province_snapshot,
      postalCode: payout.postal_code_snapshot,
    }, secretKey);

    const result = await applyXenditPayoutObject('automatic.payout_submitted', providerPayout, providerPayout);
    return { status: 'submitted', payout: providerPayout, result };
  } catch (error) {
    const xenditError = error instanceof XenditApiError ? error : null;
    const providerStatus = xenditError?.isDefinitiveClientError ? 'FAILED' : 'SUBMISSION_UNKNOWN';

    await applyXenditPayoutObject('automatic.payout_submission_error', {
      reference_id: payout.provider_reference_id,
      status: providerStatus,
      source_currency: 'IDR',
      source_amount: Number(payout.amount),
      failure_code: xenditError?.errorCode || 'REQUEST_ERROR',
    }, xenditError?.payload || { message: error instanceof Error ? error.message : String(error) });

    throw createError({
      statusCode: xenditError?.isDefinitiveClientError ? 422 : 502,
      statusMessage: xenditError?.message || 'Xendit payout submission is uncertain. It will be retried safely.',
    });
  }
}

export async function processAutomaticSellerPayouts(secretKey: string, maxPayouts = 25) {
  const supabase = useSupabaseAdmin();
  const limit = Math.min(100, Math.max(1, Math.trunc(maxPayouts) || 25));
  const results: Array<Record<string, any>> = [];
  const attemptedIds = new Set<string>();
  const attemptedSellerIds = new Set<string>();

  // Recover batches left pending or processing by a timeout before creating
  // new batches. The payout reference doubles as Xendit's idempotency key.
  const { data: recoverable, error: recoverableError } = await supabase
    .from('seller_payouts')
    .select('id, seller_id')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(limit);
  if (recoverableError) throw recoverableError;

  for (const payout of recoverable || []) {
    attemptedIds.add(String(payout.id));
    attemptedSellerIds.add(String(payout.seller_id));
    try {
      const result = await submitOrSyncSellerPayout(String(payout.id), secretKey);
      results.push({ payoutId: payout.id, ok: true, action: result.status });
    } catch (error: any) {
      results.push({
        payoutId: payout.id,
        ok: false,
        error: error?.statusMessage || error?.message || String(error),
      });
    }
  }

  const remaining = limit - attemptedIds.size;
  if (remaining > 0) {
    const cutoff = new Date().toISOString();
    const { data: candidates, error: candidateError } = await supabase.rpc('get_seller_payout_candidates', {
      p_period_start: '1970-01-01T00:00:00.000Z',
      p_period_end: cutoff,
    });
    if (candidateError) throw candidateError;

    for (const candidate of (candidates || [])
      .filter((item: any) => item.payout_ready && !attemptedSellerIds.has(String(item.seller_id)))
      .slice(0, remaining)) {
      try {
        const { data: batchRows, error: batchError } = await supabase.rpc('create_seller_payout_batch', {
          p_seller_id: candidate.seller_id,
          p_period_start: '1970-01-01T00:00:00.000Z',
          p_period_end: cutoff,
        });
        const batch: any = Array.isArray(batchRows) ? batchRows[0] : batchRows;
        if (batchError || !batch) throw batchError || new Error('Payout batch was not created.');

        const result = await submitOrSyncSellerPayout(String(batch.id), secretKey);
        results.push({ payoutId: batch.id, sellerId: candidate.seller_id, ok: true, action: result.status });
      } catch (error: any) {
        results.push({
          sellerId: candidate.seller_id,
          ok: false,
          error: error?.statusMessage || error?.message || String(error),
        });
      }
    }
  }

  return {
    attempted: results.length,
    succeeded: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length,
    results,
  };
}
