import { requireRequestUser } from '~/server/utils/request-auth';
import { resolveXenditBankBeneficiary } from '~/server/utils/xendit-beneficiary';

export default defineEventHandler(async (event) => {
  const { supabase, user } = await requireRequestUser(event);
  const body = await readBody(event).catch(() => ({}));

  let beneficiary;
  try {
    beneficiary = resolveXenditBankBeneficiary({
      bankCode: body?.bankCode,
      accountNumber: body?.accountNumber,
      accountHolderName: body?.accountHolderName,
    });
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: error instanceof Error ? error.message : 'Invalid payout account.',
    });
  }

  const { data, error } = await supabase
    .from('sellers')
    .update({
      bank_name: beneficiary.bankCode,
      bank_account: beneficiary.accountNumber,
      payout_recipient_type: beneficiary.recipientType,
      payout_account_holder_name: beneficiary.accountHolderName,
      payout_given_name: beneficiary.givenName,
      payout_surname: beneficiary.surname,
      payout_business_name: null,
      payout_routing_type: beneficiary.routingType,
      payout_routing_value: beneficiary.routingValue,
      // Legacy payout SQL still checks these columns. Xendit receives only the
      // required country object; these compatibility values are never sent.
      payout_address_line_1: 'Indonesia',
      payout_city: 'Indonesia',
      payout_province: 'Indonesia',
      payout_postal_code: '00000',
    })
    .eq('profile_id', user.id)
    .eq('status', 'approved')
    .select('id, bank_name, bank_account, payout_account_holder_name')
    .single();

  if (error) {
    console.error('[Seller payout account] Update failed:', { code: error.code || 'unknown' });
    throw createError({ statusCode: 400, statusMessage: error.message || 'Payout account could not be saved.' });
  }

  return { payoutAccount: data };
});
