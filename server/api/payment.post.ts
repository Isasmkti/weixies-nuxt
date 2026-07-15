import { getMidtransAuthorizationHeader, getMidtransSnapApiUrl, resolveMidtransIsProduction } from '~/utils/midtrans';
import { createClient } from '@supabase/supabase-js';

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${date}-${rand}`;
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
          Authorization: authHeader || ''
        }
      }
    }
  );

  const serverKey = String(config.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || '').trim();
  const isProduction = resolveMidtransIsProduction(config.public.midtransIsProduction);

  if (!serverKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'MIDTRANS_SERVER_KEY is not configured.'
    });
  }

  const { data: { user }, error: userError } = await reqSupabase.auth.getUser();
  if (userError || !user) {
    throw createError({ statusCode: 401, statusMessage: 'User not authenticated.' });
  }

  // product_id is required for digital product purchase
  const productId = body?.product_id;
  if (!productId) {
    throw createError({ statusCode: 400, statusMessage: 'product_id is required.' });
  }

  // Fetch product from DB — never trust price from frontend
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

  // Derive order ownership from the verified access token.
  const profileId = user.id;

  // Resume only a pending order for this exact product. A user may have several
  // pending orders, so profile_id + status alone is not specific enough.
  const { data: pendingOrder, error: pendingOrderError } = await reqSupabase
    .from('orders')
    .select(`
      id,
      order_number,
      snap_token,
      snap_redirect_url,
      order_items!inner ( product_id )
    `)
    .eq('profile_id', profileId)
    .eq('status', 'pending')
    .eq('order_items.product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingOrderError) {
    console.error('[Payment] Failed to look up pending order:', pendingOrderError);
    throw createError({ statusCode: 500, statusMessage: 'Failed to look up pending order.' });
  }

  if (pendingOrder) {
    if (!pendingOrder.snap_token) {
      // A Snap token cannot be recovered from Midtrans after it was created.
      // Do not create a duplicate order for this product automatically.
      throw createError({
        statusCode: 409,
        statusMessage: 'A pending payment exists but has no Snap token. Cancel or expire that order before retrying.'
      });
    }

    return {
      resumed: true,
      token: pendingOrder.snap_token,
      redirect_url: pendingOrder.snap_redirect_url,
      order_id: pendingOrder.id,
      order_number: pendingOrder.order_number,
      status: 'pending'
    };
  }

  const orderNumber = generateOrderNumber();

  // Insert order with status pending
  const { data: order, error: orderError } = await reqSupabase
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
  const { error: orderItemError } = await reqSupabase.from('order_items').insert({
    order_id: order.id,
    product_id: productId,
    price: totalAmount,
  });

  if (orderItemError) {
    console.error('[Payment] Failed to create order item:', orderItemError);
    await reqSupabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw createError({ statusCode: 500, statusMessage: 'Failed to create order item.' });
  }

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

    // Store the token before sending it to the client so this payment can be resumed.
    const { error: snapUpdateError } = await reqSupabase
      .from('orders')
      .update({
        snap_token: data.token,
        snap_redirect_url: data.redirect_url || null,
      })
      .eq('id', order.id);

    if (snapUpdateError) {
      console.error('[Payment] Failed to save Snap session:', snapUpdateError);
      throw createError({ statusCode: 500, statusMessage: 'Failed to save payment session.' });
    }

    return {
      resumed: false,
      token: data.token,
      redirect_url: data.redirect_url,
      order_number: orderNumber,
      order_id: order.id,
      status: 'pending'
    };
  } catch (error: any) {
    // Mark order as failed if Midtrans call fails
    await reqSupabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
    throw createError({
      statusCode: 500,
      statusMessage: error.statusMessage || error.message || 'Midtrans error'
    });
  }
});
