import crypto from 'node:crypto';
import { requireRequestUser } from '~/server/utils/request-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import type { XenditPayout } from '~/server/utils/xendit';

export async function requirePlatformAdmin(event: any) {
  const { supabase, user } = await requireRequestUser(event);
  const { data: isAdmin, error } = await supabase.rpc('is_seller_platform_admin');

  if (error || !isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Platform admin access is required.' });
  }

  return user;
}

export function xenditPayoutEventKey(eventName: string, payout: Partial<XenditPayout>): string {
  return crypto.createHash('sha256').update(JSON.stringify([
    eventName,
    payout.payout_id || null,
    payout.reference_id || null,
    payout.status || null,
    payout.updated || null,
    payout.failure_code || null,
  ])).digest('hex');
}

export async function applyXenditPayoutObject(
  eventName: string,
  payout: Partial<XenditPayout>,
  payload: any,
) {
  const supabase = useSupabaseAdmin();
  const amount = payout.source_amount == null ? null : Number(payout.source_amount);
  if (amount != null && (!Number.isSafeInteger(amount) || amount <= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Xendit payout amount.' });
  }

  const { data, error } = await supabase.rpc('apply_xendit_payout_event', {
    p_event_key: xenditPayoutEventKey(eventName, payout),
    p_event_name: eventName,
    p_provider_payout_id: payout.payout_id || null,
    p_provider_reference_id: payout.reference_id,
    p_provider_status: payout.status,
    p_failure_code: payout.failure_code || null,
    p_processor_reference: payout.processor_reference || null,
    p_amount: amount,
    p_currency: payout.source_currency || null,
    p_provider_updated_at: payout.updated || null,
    p_payload: payload || {},
  });

  if (error) throw error;
  return data;
}

