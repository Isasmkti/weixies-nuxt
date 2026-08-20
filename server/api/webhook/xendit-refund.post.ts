import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { logPaymentEvent } from '~/server/utils/payment-logger';
import { parseOrderIdFromExternalId, verifyXenditCallbackToken } from '~/server/utils/xendit';

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const config = useRuntimeConfig();
  const supabase = useSupabaseAdmin();
  const webhookToken = String(config.xenditWebhookToken || '').trim();
  const receivedToken = String(getRequestHeader(event, 'x-callback-token') || '').trim();

  if (!webhookToken) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_WEBHOOK_TOKEN is not configured.' });
  }
  if (!verifyXenditCallbackToken(receivedToken, webhookToken)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Xendit callback token.' });
  }

  const eventName = String(body?.event || '').toLowerCase();
  const refund = body?.data || body;
  const refundId = String(refund?.id || '').trim();

  if (!refundId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing refund ID.' });
  }
  if (eventName && eventName !== 'refund.succeeded') {
    return { status: 'ignored', reason: 'refund_not_succeeded' };
  }

  const invoiceId = String(refund?.invoice_id || refund?.invoiceId || '').trim();
  const providerPaymentId = String(refund?.payment_id || refund?.paymentId || '').trim();
  const externalId = String(refund?.external_id || refund?.externalId || '').trim();
  let payment: any = null;

  if (invoiceId) {
    const { data } = await supabase
      .from('payments')
      .select('id, order_id, provider_invoice_id, status')
      .eq('provider', 'xendit')
      .eq('provider_invoice_id', invoiceId)
      .maybeSingle();
    payment = data;
  }

  if (!payment && providerPaymentId) {
    const { data } = await supabase
      .from('payments')
      .select('id, order_id, provider_invoice_id, status')
      .eq('provider', 'xendit')
      .eq('provider_invoice_id', providerPaymentId)
      .maybeSingle();
    payment = data;
  }

  const parsedOrderId = parseOrderIdFromExternalId(externalId);
  if (!payment && parsedOrderId) {
    const { data } = await supabase
      .from('payments')
      .select('id, order_id, provider_invoice_id, status')
      .eq('provider', 'xendit')
      .eq('order_id', parsedOrderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    payment = data;
  }

  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: 'Payment for this refund was not found.' });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, status, total_amount')
    .eq('id', payment.order_id)
    .single();

  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order for this refund was not found.' });
  }

  const amount = Number(refund?.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid refund amount.' });
  }
  if (amount !== Number(order.total_amount)) {
    throw createError({ statusCode: 409, statusMessage: 'Partial refunds are not supported for this order flow.' });
  }

  await logPaymentEvent({
    order_id: order.id,
    order_number: order.order_number,
    event_type: 'refund_received',
    old_status: order.status,
    provider_status: String(refund?.status || 'SUCCEEDED').toUpperCase(),
    metadata: { refund_id: refundId, invoice_id: invoiceId || payment.provider_invoice_id },
    created_at: new Date().toISOString(),
  });

  const { error: refundUpsertError } = await supabase.from('payment_refunds').upsert({
    provider: 'xendit',
    provider_refund_id: refundId,
    provider_payment_id: providerPaymentId || null,
    payment_id: payment.id,
    order_id: order.id,
    amount,
    status: 'succeeded',
    raw_response: body,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider,provider_refund_id' });

  if (refundUpsertError) throw refundUpsertError;

  const { data: refundResult, error: refundError } = await supabase.rpc('apply_order_refund', {
    p_order_id: order.id,
    p_reference_no: refundId,
  });
  if (refundError) throw refundError;

  const { error: paymentUpdateError } = await supabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('id', payment.id);
  if (paymentUpdateError) throw paymentUpdateError;

  await logPaymentEvent({
    order_id: order.id,
    order_number: order.order_number,
    event_type: 'refund_processed',
    old_status: order.status,
    new_status: 'refunded',
    provider_status: String(refund?.status || 'SUCCEEDED').toUpperCase(),
    metadata: { refund_id: refundId, result: refundResult },
    created_at: new Date().toISOString(),
  });

  return { status: 'ok', orderStatus: 'refunded', result: refundResult };
});
