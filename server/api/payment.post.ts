import { getMidtransAuthorizationHeader, getMidtransSnapApiUrl, resolveMidtransIsProduction } from '~/utils/midtrans';
import { supabase } from '~/utils/supabase';

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${date}-${rand}`;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const config = useRuntimeConfig();

  const serverKey = String(config.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || '').trim();
  const isProduction = resolveMidtransIsProduction(config.public.midtransIsProduction);

  if (!serverKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'MIDTRANS_SERVER_KEY is not configured.'
    });
  }

  // product_id is required for digital product purchase
  const productId = body?.product_id;
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'product_id is required.' });
  }

  // Fetch product from DB — never trust price from frontend
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, name, price, is_active')
    .eq('id', productId)
    .single();

  if (productError || !product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found.' });
  }

  if (!product.is_active) {
    throw createError({ statusCode: 400, statusMessage: 'Product is not available.' });
  }

  const totalAmount = Number(product.price);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid product price.' });
  }

  // Require authenticated user — profile_id from body (set by frontend after auth)
  const profileId = body?.profile_id || body?.userId || null;
  if (!profileId) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }

  const orderNumber = generateOrderNumber();

  // Insert order with status pending
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      profile_id: profileId,
      order_number: orderNumber,
      total_amount: totalAmount,
      status: 'pending',
      payment_method: null,
      midtrans_order_id: orderNumber,
      midtrans_transaction_id: null,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (orderError || !order) {
    console.error('[Payment] Failed to create order:', orderError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create order.' });
  }

  // Insert order_items
  await supabase.from('order_items').insert({
    order_id: order.id,
    product_id: productId,
    price: totalAmount,
  });

  const parameter = {
    transaction_details: {
      order_id: orderNumber,
      gross_amount: totalAmount
    },
    customer_details: {
      first_name: body?.customerName || 'Customer',
      email: body?.customerEmail || 'customer@example.com'
    },
    credit_card: { secure: true },
    item_details: [
      {
        id: productId,
        price: totalAmount,
        quantity: 1,
        name: (product.name || 'Product').substring(0, 50)
      }
    ]
  };

  try {
    const response = await fetch(getMidtransSnapApiUrl(isProduction), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        authorization: getMidtransAuthorizationHeader(serverKey)
      },
      body: JSON.stringify(parameter)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw createError({
        statusCode: 502,
        statusMessage: data?.status_message || `Midtrans request failed (${response.status})`
      });
    }

    if (!data?.token) {
      throw createError({
        statusCode: 502,
        statusMessage: data?.status_message || 'Midtrans did not return a transaction token.'
      });
    }

    // Update order with snap_token
    await supabase
      .from('orders')
      .update({
        midtrans_order_id: orderNumber,
      })
      .eq('id', order.id);

    return {
      token: data.token,
      redirect_url: data.redirect_url,
      order_number: orderNumber,
      order_id: order.id,
      status: 'pending'
    };
  } catch (error: any) {
    // Mark order as failed if Midtrans call fails
    await supabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw createError({
      statusCode: 500,
      statusMessage: error.statusMessage || error.message || 'Midtrans error'
    });
  }
});
