import { getXenditPayout } from '~/server/utils/xendit';
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
  const { data: payout, error } = await supabase
    .from('seller_payouts')
    .select('id, provider, provider_payout_id')
    .eq('id', payoutId)
    .single();

  if (error || !payout) {
    throw createError({ statusCode: 404, statusMessage: 'Payout was not found.' });
  }
  if (payout.provider !== 'xendit' || !payout.provider_payout_id) {
    throw createError({ statusCode: 409, statusMessage: 'This payout has not been accepted by Xendit.' });
  }

  const providerPayout = await getXenditPayout(payout.provider_payout_id, secretKey);
  const result = await applyXenditPayoutObject('admin.payout_sync', providerPayout, providerPayout);
  return { status: 'synced', payout: providerPayout, result };
});

