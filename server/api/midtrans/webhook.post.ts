import crypto from 'crypto';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

function mapMidtransStatus(transactionStatus?: string, fraudStatus?: string): string {
  switch (transactionStatus) {
    case 'settlement':
      return 'paid';
    case 'capture':
      return fraudStatus === 'challenge' ? 'pending' : 'paid';
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
    case 'partial_refund':
      return 'partially_refunded';
    case 'chargeback':
      return 'chargeback';
    default:
      return 'failed';
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();
  const supabase = useSupabaseAdmin();
  const serverKey = String(config.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || '').trim();

  if (!serverKey) {
    throw createError({ statusCode: 500, statusMessage: 'MIDTRANS_SERVER_KEY is not configured.' });
  }

  const orderId = body?.order_id;
  const statusCode = body?.status_code;
  const grossAmount = body?.gross_amount;
  const signatureKey = body?.signature_key;

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required Midtrans webhook fields.' });
  }

  const expectedSignature = crypto
    .createHash('sha512')
    .update(String(orderId) + String(statusCode) + String(grossAmount) + serverKey)
    .digest('hex');
  const receivedSignature = String(signatureKey).toLowerCase();
  const validSignature = receivedSignature.length === expectedSignature.length
    && crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(receivedSignature));

  if (!validSignature) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid Midtrans webhook signature.' });
  }

  const transactionStatus = body?.transaction_status;
  const fraudStatus = body?.fraud_status;
  const normalizedStatus = mapMidtransStatus(transactionStatus, fraudStatus);
  const transactionId = body?.transaction_id || null;
  const paymentType = body?.payment_type || null;

  const { data: order, error: orderFetchError } = await supabase
    .from('orders')
    .select('id, profile_id, status, total_amount')
    .eq('midtrans_order_id', String(orderId))
    .single();

  if (orderFetchError) {
    console.error('[Webhook] Could not look up order:', orderFetchError);
    throw createError({ statusCode: 500, statusMessage: 'Could not look up order.' });
  }
  if (!order) {
    console.error('[Webhook] Order not found for order_id:', orderId);
    throw createError({ statusCode: 404, statusMessage: 'Order not found.' });
  }
  if (Number(order.total_amount) !== Number(grossAmount)) {
    console.error('[Webhook] Gross amount does not match order:', orderId);
    throw createError({ statusCode: 400, statusMessage: 'Gross amount does not match order.' });
  }

  const updatePayload: Record<string, string | null> = {
    status: normalizedStatus,
    midtrans_transaction_id: transactionId,
    payment_method: paymentType,
  };
  if (normalizedStatus === 'paid') updatePayload.paid_at = new Date().toISOString();
  if (normalizedStatus === 'expired') updatePayload.expired_at = new Date().toISOString();

  const { error: orderUpdateError } = await supabase.from('orders').update(updatePayload).eq('id', order.id);
  if (orderUpdateError) {
    console.error('[Webhook] Could not update order:', orderUpdateError);
    throw createError({ statusCode: 500, statusMessage: 'Could not update order.' });
  }

  const { error: paymentInsertError } = await supabase.from('payments').insert({
    order_id: order.id,
    midtrans_transaction_id: transactionId,
    payment_type: paymentType,
    gross_amount: Number(grossAmount),
    transaction_status: transactionStatus,
    fraud_status: fraudStatus || null,
    raw_response: body,
    created_at: new Date().toISOString(),
  });
  if (paymentInsertError) {
    console.error('[Webhook] Could not write payment audit log:', paymentInsertError);
    throw createError({ statusCode: 500, statusMessage: 'Could not write payment audit log.' });
  }

  if (normalizedStatus === 'paid') {
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('product_id')
      .eq('order_id', order.id);
    if (orderItemsError) {
      console.error('[Webhook] Could not look up order items:', orderItemsError);
      throw createError({ statusCode: 500, statusMessage: 'Could not look up order items.' });
    }

    if (orderItems?.length) {
      const productIds = orderItems.map((item) => item.product_id);
      const { error: ownershipError } = await supabase.from('user_products').upsert(
        orderItems.map((item) => ({
          profile_id: order.profile_id,
          product_id: item.product_id,
          order_id: order.id,
          created_at: new Date().toISOString(),
        })),
        { onConflict: 'profile_id,product_id' },
      );
      if (ownershipError) {
        console.error('[Webhook] Could not grant product access:', ownershipError);
        throw createError({ statusCode: 500, statusMessage: 'Could not grant product access.' });
      }

      const { data: cart, error: cartError } = await supabase
        .from('cart')
        .select('id')
        .eq('profile_id', order.profile_id)
        .maybeSingle();
      if (cartError) {
        console.error('[Webhook] Could not look up cart:', cartError);
        throw createError({ statusCode: 500, statusMessage: 'Could not look up cart.' });
      }

      if (cart) {
        const { error: cartDeleteError } = await supabase
          .from('cart_items')
          .delete()
          .eq('cart_id', cart.id)
          .in('product_id', productIds);
        if (cartDeleteError) {
          console.error('[Webhook] Could not remove purchased cart items:', cartDeleteError);
          throw createError({ statusCode: 500, statusMessage: 'Could not remove purchased cart items.' });
        }
      }
    }
  }

  console.log(`[Midtrans Webhook] Order ${orderId} -> ${transactionStatus} (${normalizedStatus})`);
  return { status: 'ok', orderStatus: normalizedStatus };
});
