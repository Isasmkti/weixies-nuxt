import { grantDigitalAccessForOrder } from '~/server/utils/order-delivery';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import {
  getXenditInvoice,
  normalizeXenditInvoiceStatus,
  parseOrderIdFromExternalId,
  verifyXenditCallbackToken,
} from '~/server/utils/xendit';
import { logPaymentEvent } from '~/server/utils/payment-logger';

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const config = useRuntimeConfig();
  const supabase = useSupabaseAdmin();

  const secretKey = String(config.xenditSecretKey || '').trim();
  const webhookToken = String(config.xenditWebhookToken || '').trim();
  const receivedToken = String(getRequestHeader(event, 'x-callback-token') || '').trim();

  if (!secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not configured.' });
  }

  if (!webhookToken) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_WEBHOOK_TOKEN is not configured.' });
  }

  if (!verifyXenditCallbackToken(receivedToken, webhookToken)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Xendit callback token.' });
  }

  const invoiceId = String(body?.data?.id || body?.id || '').trim();
  if (!invoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing invoice ID.' });
  }

  await logPaymentEvent({
    order_id: invoiceId,
    event_type: 'webhook_verified',
    metadata: {
      event: body?.event || null,
    },
    created_at: new Date().toISOString(),
  });

  await logPaymentEvent({
    order_id: invoiceId,
    event_type: 'webhook_received',
    metadata: {
      event: body?.event || null,
      status: body?.data?.status || null,
    },
    created_at: new Date().toISOString(),
  });

  const invoice = await getXenditInvoice(invoiceId, secretKey);
  const orderId = parseOrderIdFromExternalId(invoice.external_id);

  if (!orderId) {
    await logPaymentEvent({
      order_id: invoiceId,
      event_type: 'error',
      error_message: 'Invalid invoice external_id',
      metadata: { external_id: invoice.external_id },
      created_at: new Date().toISOString(),
    });
    throw createError({ statusCode: 400, statusMessage: 'Invalid invoice external_id.' });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, profile_id, status, total_amount, order_number')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    await logPaymentEvent({
      order_id: orderId,
      event_type: 'error',
      error_message: 'Order not found',
      metadata: { invoice_id: invoiceId },
      created_at: new Date().toISOString(),
    });
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }

  if (Number(order.total_amount) !== Number(invoice.amount)) {
    await logPaymentEvent({
      order_id: order.id,
      order_number: order.order_number,
      event_type: 'error',
      old_status: order.status,
      error_message: 'Amount mismatch',
      metadata: {
        expected: order.total_amount,
        received: invoice.amount,
        invoice_id: invoice.id,
      },
      created_at: new Date().toISOString(),
    });
    throw createError({ statusCode: 400, statusMessage: 'Invoice amount does not match order total.' });
  }

  const normalizedStatus = normalizeXenditInvoiceStatus(invoice.status);
  if (!normalizedStatus) {
    await logPaymentEvent({
      order_id: order.id,
      order_number: order.order_number,
      event_type: 'error',
      old_status: order.status,
      error_message: 'Unknown invoice status',
      metadata: {
        received_status: invoice.status,
        invoice_id: invoice.id,
      },
      created_at: new Date().toISOString(),
    });
    return { status: 'ignored', reason: 'unknown_status' };
  }

  if (order.status === 'refunded' || (order.status === 'paid' && normalizedStatus !== 'paid')) {
    return { status: 'ignored', reason: 'terminal_order_status', orderStatus: order.status };
  }

  const paymentMethod = String(invoice.payment_method || invoice.payment_channel || '').trim() || null;
  const paidAt = normalizedStatus === 'paid'
    ? (invoice.paid_at || new Date().toISOString())
    : null;

  const paymentPayload = {
    order_id: order.id,
    provider: 'xendit',
    provider_invoice_id: invoice.id,
    payment_method: paymentMethod,
    status: normalizedStatus,
    paid_at: paidAt,
    raw_response: invoice,
    created_at: invoice.created || new Date().toISOString(),
  };

  const persistPayment = async () => {
    const { error } = await supabase.from('payments').upsert(paymentPayload, { onConflict: 'provider_invoice_id' });
    if (error) throw createError({ statusCode: 500, statusMessage: 'Could not write payment row.' });
  };

  if (normalizedStatus === 'paid') {
    await persistPayment();
    await grantDigitalAccessForOrder(order.id, order.profile_id, paidAt || new Date().toISOString());
  } else {
    const orderUpdate: Record<string, string | null> = { status: normalizedStatus };
    if (normalizedStatus === 'expired') {
      orderUpdate.expired_at = invoice.expiry_date || new Date().toISOString();
    }

    const { data: updatedOrder, error: orderUpdateError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', order.id)
      .eq('status', order.status)
      .select('id')
      .maybeSingle();
    if (orderUpdateError) {
      throw createError({ statusCode: 500, statusMessage: 'Could not update order.' });
    }
    if (!updatedOrder) {
      return { status: 'ignored', reason: 'concurrent_order_update' };
    }
    await persistPayment();
  }

  await logPaymentEvent({
    order_id: order.id,
    order_number: order.order_number,
    event_type: 'webhook_processed',
    old_status: order.status,
    new_status: normalizedStatus,
    provider_status: String(invoice.status || '').toUpperCase() || undefined,
    created_at: new Date().toISOString(),
  });

  if (normalizedStatus === 'paid') {
    await logPaymentEvent({
      order_id: order.id,
      order_number: order.order_number,
      event_type: 'invoice_paid',
      new_status: 'paid',
      provider_status: String(invoice.status || '').toUpperCase() || undefined,
      metadata: { invoice_id: invoice.id },
      created_at: new Date().toISOString(),
    });

    await logPaymentEvent({
      order_id: order.id,
      order_number: order.order_number,
      event_type: 'product_delivered',
      new_status: 'paid',
      metadata: { invoice_id: invoice.id },
      created_at: new Date().toISOString(),
    });
  }

  if (normalizedStatus === 'expired') {
    await logPaymentEvent({
      order_id: order.id,
      order_number: order.order_number,
      event_type: 'invoice_expired',
      new_status: 'expired',
      provider_status: String(invoice.status || '').toUpperCase() || undefined,
      metadata: { invoice_id: invoice.id },
      created_at: new Date().toISOString(),
    });
  }

  console.log(`[Xendit Webhook] Order ${orderId} -> ${invoice.status} (${normalizedStatus})`);
  return { status: 'ok', orderStatus: normalizedStatus };
});
