import { createClient } from '@supabase/supabase-js';
import { logPaymentEvent } from '~/server/utils/payment-logger';
import { createXenditInvoice, getXenditInvoice } from '~/server/utils/xendit';

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${date}-${rand}`;
}

async function persistInvoice(
  reqSupabase: ReturnType<typeof createClient>,
  orderId: string,
  invoice: Record<string, any>,
) {
  const paymentMethod = String(invoice.payment_method || invoice.payment_channel || '').trim() || null;

  const { error: orderUpdateError } = await reqSupabase
    .from('orders')
    .update({
      payment_url: invoice.invoice_url || null,
      payment_method: paymentMethod,
      status: 'pending',
    })
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

  const reqSupabase = createClient(
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
    .select('id, name, price')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found.' });
  }

  const totalAmount = Number(product.price);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid product price.' });
  }

  const { data: pendingOrder, error: pendingOrderError } = await reqSupabase
    .from('orders')
    .select(`
      id,
      order_number,
      total_amount,
      status,
      payment_url,
      order_items!inner ( product_id ),
      payments (
        id,
        provider,
        provider_invoice_id,
        status,
        raw_response
      )
    `)
    .eq('profile_id', user.id)
    .eq('status', 'pending')
    .eq('order_items.product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingOrderError) {
    console.error('[Checkout] Failed to look up pending order:', pendingOrderError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to look up pending order.' });
  }

  if (pendingOrder) {
    if (pendingOrder.payment_url) {
      return {
        resumed: true,
        order_id: pendingOrder.id,
        order_number: pendingOrder.order_number,
        payment_url: pendingOrder.payment_url,
        status: pendingOrder.status,
      };
    }

    const existingPayment = pendingOrder.payments?.find((payment: any) => payment.provider === 'xendit' && payment.provider_invoice_id);
    if (existingPayment && String(existingPayment.status || 'pending').toLowerCase() === 'pending') {
      const invoice = existingPayment.raw_response?.invoice_url
        ? existingPayment.raw_response
        : await getXenditInvoice(existingPayment.provider_invoice_id, secretKey).catch((error) => {
          console.error('[Checkout] Failed to fetch existing invoice:', error);
          return null;
        });

      if (invoice?.invoice_url) {
        await persistInvoice(reqSupabase, pendingOrder.id, invoice);
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
  const { data: order, error: orderError } = await reqSupabase
    .from('orders')
    .insert({
      profile_id: user.id,
      order_number: orderNumber,
      total_amount: totalAmount,
      status: 'pending',
      payment_method: null,
      payment_url: null,
      created_at: new Date().toISOString(),
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('[Checkout] Failed to create order:', orderError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create order.' });
  }

  const { error: orderItemError } = await reqSupabase.from('order_items').insert({
    order_id: order.id,
    product_id: productId,
    price: totalAmount,
  });

  if (orderItemError) {
    console.error('[Checkout] Failed to create order item:', orderItemError);
    await reqSupabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
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
    await reqSupabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw createError({
      statusCode: 502,
      statusMessage: error?.message || 'Invoice creation failed.',
    });
  });

  await persistInvoice(reqSupabase, order.id, invoice);
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
