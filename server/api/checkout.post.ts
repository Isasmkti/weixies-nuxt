import { createClient } from '@supabase/supabase-js';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { logPaymentEvent } from '~/server/utils/payment-logger';
import { createXenditInvoice, getXenditInvoice } from '~/server/utils/xendit';

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${date}-${rand}`;
}

async function persistInvoice(
  reqSupabase: any,
  orderId: string,
  invoice: Record<string, any>,
) {
  const paymentMethod = String(invoice.payment_method || invoice.payment_channel || '').trim() || null;

  const { error: orderUpdateError } = await reqSupabase
    .from('orders')
    .update({
      status: 'pending',
    } as any)
    .eq('id', orderId);

  if (orderUpdateError) {
    throw orderUpdateError;
  }

  const { error: paymentError } = await reqSupabase.from('payments').upsert({
    order_id: orderId,
    provider: 'xendit',
    provider_invoice_id: invoice.id,
    payment_method: paymentMethod,
    status: 'pending',
    raw_response: invoice,
    created_at: invoice.created || new Date().toISOString(),
  }, { onConflict: 'provider_invoice_id' });

  if (paymentError) {
    throw paymentError;
  }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();
  const authHeader = getRequestHeader(event, 'authorization');

  const reqSupabase: any = createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
    {
      global: {
        headers: {
          Authorization: authHeader || '',
        },
      },
    },
  );

  const adminSupabase = useSupabaseAdmin();

  const secretKey = String(config.xenditSecretKey || '').trim();
  if (!secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not configured.' });
  }

  const { data: { user }, error: userError } = await reqSupabase.auth.getUser();
  if (userError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }

  const productId = body?.product_id;
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'product_id is required.' });
  }

  const customerEmail = String(user.email || body?.customerEmail || 'customer@example.com');
  const customerName = String(body?.customerName || user.user_metadata?.full_name || customerEmail.split('@')[0] || 'Customer');

  const { data: product, error: productError } = await reqSupabase
    .from('products')
    .select('id, name, price, seller_id')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found.' });
  }

  const totalAmount = Number(product.price);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid product price.' });
  }

  // Snapshot seller attribution at checkout. Future commission-rate changes
  // must not alter the amount owed for an already-created order item.
  let sellerId: string | null = product.seller_id || null;
  let commissionAmount = 0;
  let sellerEarning = 0;

  if (sellerId) {
    const { data: seller, error: sellerError } = await adminSupabase
      .from('sellers')
      .select('id, profile_id, status, commission_rate')
      .eq('id', sellerId)
      .single();

    const commissionRate = Number(seller?.commission_rate);
    if (sellerError || !seller) {
      console.error('[Checkout] Failed to resolve the product seller:', sellerError);
      throw createError({ statusCode: 400, statusMessage: 'This product is not available from an active seller.' });
    }
    if (seller.status !== 'approved') {
      throw createError({ statusCode: 409, statusMessage: 'This seller is not currently accepting orders.' });
    }
    if (seller.profile_id === user.id) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot purchase your own product.' });
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
      console.error('[Checkout] Failed to resolve seller commission rate:', sellerError);
      throw createError({ statusCode: 500, statusMessage: 'Seller commission configuration is invalid.' });
    }

    commissionAmount = Math.round(totalAmount * commissionRate);
    sellerEarning = totalAmount - commissionAmount;
  }

  const { data: pendingOrders, error: pendingOrderError } = await reqSupabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      order_items (
        product_id
      )
    `)
    .eq('profile_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (pendingOrderError) {
    console.error('[Checkout] Failed to look up pending orders:', {
      message: pendingOrderError.message,
      details: pendingOrderError.details,
      hint: pendingOrderError.hint,
      code: pendingOrderError.code,
    });
    throw createError({ statusCode: 500, statusMessage: 'Failed to look up pending order.' });
  }

  const pendingOrder = (pendingOrders || []).find((order: any) =>
    (order.order_items || []).some((item: any) => item.product_id === productId),
  );

  if (pendingOrder) {
    const { data: paymentRows, error: paymentLookupError } = await adminSupabase
      .from('payments')
      .select('id, provider, provider_invoice_id, status, raw_response')
      .eq('order_id', pendingOrder.id)
      .eq('provider', 'xendit')
      .order('created_at', { ascending: false });

    if (paymentLookupError) {
      console.warn('[Checkout] Failed to look up payment rows for a pending order:', {
        message: paymentLookupError.message,
        details: paymentLookupError.details,
        hint: paymentLookupError.hint,
        code: paymentLookupError.code,
      });
    }

    const existingPayment = (paymentRows || []).find((payment: any) => payment.provider_invoice_id);
    if (existingPayment && String(existingPayment.status || 'pending').toLowerCase() === 'pending') {
      const invoice = existingPayment.raw_response?.invoice_url
        ? existingPayment.raw_response
        : await getXenditInvoice(existingPayment.provider_invoice_id, secretKey).catch((error) => {
          console.error('[Checkout] Failed to fetch existing invoice:', error);
          return null;
        });

      if (invoice?.invoice_url) {
        await persistInvoice(adminSupabase, pendingOrder.id, invoice);
        return {
          resumed: true,
          order_id: pendingOrder.id,
          order_number: pendingOrder.order_number,
          payment_url: invoice.invoice_url,
          status: 'pending',
        };
      }
    }
  }

  const orderNumber = generateOrderNumber();
  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .insert({
      profile_id: user.id,
      order_number: orderNumber,
      total_amount: totalAmount,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('[Checkout] Failed to create order:', orderError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create order.' });
  }

  const { error: orderItemError } = await adminSupabase.from('order_items').insert({
    order_id: order.id,
    product_id: productId,
    price: totalAmount,
    seller_id: sellerId,
    commission_amount: commissionAmount,
    seller_earning: sellerEarning,
  });

  if (orderItemError) {
    console.error('[Checkout] Failed to create order item:', orderItemError);
    await adminSupabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create order item.' });
  }

  const requestUrl = getRequestURL(event);
  const invoice = await createXenditInvoice({
    externalId: `ORDER-${order.id}`,
    amount: totalAmount,
    description: `${product.name} - ${customerEmail}`,
    customerEmail,
    customerName,
    successRedirectUrl: `${requestUrl.origin}/orders/${order.id}`,
    failureRedirectUrl: `${requestUrl.origin}/orders/${order.id}`,
  }, secretKey).catch(async (error) => {
    console.error('[Checkout] Failed to create Xendit invoice:', error);
    await adminSupabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw createError({
      statusCode: 502,
      statusMessage: error?.message || 'Invoice creation failed.',
    });
  });

  await persistInvoice(adminSupabase, order.id, invoice);
  await logPaymentEvent({
    order_id: order.id,
    order_number: order.order_number,
    event_type: 'invoice_created',
    new_status: 'pending',
    provider_status: String(invoice.status || '').toUpperCase() || undefined,
    metadata: {
      invoice_id: invoice.id,
      payment_url: invoice.invoice_url,
    },
    created_at: new Date().toISOString(),
  });

  console.log(`[Checkout] Invoice created for order ${order.id}: ${invoice.id}`);

  return {
    resumed: false,
    order_id: order.id,
    order_number: order.order_number,
    payment_url: invoice.invoice_url,
    status: 'pending',
  };
});
