import crypto from 'crypto';
import { supabase } from '~/utils/supabase';

function mapMidtransStatus(transactionStatus?: string): string {
  switch (transactionStatus) {
    case 'settlement':
    case 'capture':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'expire':
      return 'expired';
    case 'cancel':
      return 'cancelled';
    case 'deny':
      return 'failed';
    case 'refund':
      return 'refunded';
    default:
      return 'failed';
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();

  const serverKey = String(config.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || '').trim();

  if (!serverKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'MIDTRANS_SERVER_KEY is not configured.'
    });
  }

  // Validate required webhook fields
  const orderId = body?.order_id;
  const statusCode = body?.status_code;
  const grossAmount = body?.gross_amount;
  const signatureKey = body?.signature_key;

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required Midtrans webhook fields.' });
  }

  // Verify SHA512 signature
  const hash = crypto
    .createHash('sha512')
    .update(String(orderId) + String(statusCode) + String(grossAmount) + serverKey)
    .digest('hex');

  if (hash !== signatureKey) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Midtrans webhook signature.' });
  }

  const transactionStatus = body?.transaction_status;
  const fraudStatus = body?.fraud_status;
  const normalizedStatus = mapMidtransStatus(transactionStatus);
  const transactionId = body?.transaction_id || null;
  const paymentType = body?.payment_type || null;

  // Fetch current order using midtrans_order_id = orderId (order_number)
  const { data: order, error: orderFetchError } = await supabase
    .from('orders')
    .select('id, profile_id, status')
    .eq('midtrans_order_id', String(orderId))
    .single();

  if (orderFetchError || !order) {
    console.error('[Webhook] Order not found for order_id:', orderId);
    // Return 200 anyway so Midtrans doesn't retry infinitely
    return { status: 'ok', message: 'Order not found, ignored.' };
  }

  // Update order status
  const updatePayload: Record<string, any> = {
    status: normalizedStatus,
    midtrans_transaction_id: transactionId,
    payment_method: paymentType,
  };

  if (normalizedStatus === 'paid') {
    updatePayload.paid_at = new Date().toISOString();
  } else if (normalizedStatus === 'expired') {
    updatePayload.expired_at = new Date().toISOString();
  }

  await supabase
    .from('orders')
    .update(updatePayload)
    .eq('id', order.id);

  // Insert into payments table (audit log)
  await supabase.from('payments').insert({
    order_id: order.id,
    midtrans_transaction_id: transactionId,
    payment_type: paymentType,
    gross_amount: Number(grossAmount),
    transaction_status: transactionStatus,
    fraud_status: fraudStatus || null,
    raw_response: body,
    created_at: new Date().toISOString(),
  });

  // If paid → grant access to purchased products
  if (normalizedStatus === 'paid') {
    // Fetch all order_items for this order
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id')
      .eq('order_id', order.id);

    if (orderItems && orderItems.length > 0) {
      const userProductInserts = orderItems.map((item) => ({
        profile_id: order.profile_id,
        product_id: item.product_id,
        order_id: order.id,
        created_at: new Date().toISOString(),
      }));

      // upsert to avoid duplicates on duplicate webhook calls
      await supabase
        .from('user_products')
        .upsert(userProductInserts, { onConflict: 'profile_id,product_id' });
    }
  }

  console.log(`[Midtrans Webhook] Order ${orderId} → ${transactionStatus} (${normalizedStatus})`);

  return { status: 'ok', orderStatus: normalizedStatus };
});
