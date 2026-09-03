import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { requireRequestUser } from '~/server/utils/request-auth';
import { enforceRateLimit } from '~/server/utils/rate-limit';
import { logPaymentEvent } from '~/server/utils/payment-logger';
import { createXenditInvoice, getXenditInvoice } from '~/server/utils/xendit';

async function persistInvoice(supabase: any, orderId: string, invoice: Record<string, any>) {
  const paymentMethod = String(invoice.payment_method || invoice.payment_channel || '').trim() || null;
  const { error } = await supabase.from('payments').upsert({
    order_id: orderId,
    provider: 'xendit',
    provider_invoice_id: invoice.id,
    payment_method: paymentMethod,
    status: 'pending',
    raw_response: invoice,
    created_at: invoice.created || new Date().toISOString(),
  }, { onConflict: 'provider_invoice_id' });
  if (error) throw error;
}

function checkoutOrigin(config: any, event: any): string {
  const configuredUrl = String(config.public.siteUrl || '').trim();
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      throw createError({ statusCode: 500, statusMessage: 'NUXT_PUBLIC_SITE_URL is invalid.' });
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_PUBLIC_SITE_URL is not configured.' });
  }
  return getRequestURL(event).origin;
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const config = useRuntimeConfig();
  const { user } = await requireRequestUser(event);
  const supabase = useSupabaseAdmin();
  const secretKey = String(config.xenditSecretKey || '').trim();

  if (!secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not configured.' });
  }

  const productId = Number(body?.product_id);
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'A valid product_id is required.' });
  }
  const productLicenseId = String(body?.product_license_id || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(productLicenseId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid product_license_id is required.' });
  }

  await enforceRateLimit(`checkout:${user.id}`, 10, 60);

  const { data: checkoutRows, error: checkoutError } = await supabase.rpc('create_checkout_order', {
    p_profile_id: user.id,
    p_product_id: productId,
    p_product_license_id: productLicenseId,
  });
  const checkout = Array.isArray(checkoutRows) ? checkoutRows[0] : checkoutRows;

  if (checkoutError || !checkout) {
    console.error('[Checkout] Could not create or resume order:', checkoutError);
    throw createError({
      statusCode: checkoutError?.code === 'P0002' ? 404 : 409,
      statusMessage: checkoutError?.message || 'Checkout could not be started.',
    });
  }

  const { data: paymentRows, error: paymentLookupError } = await supabase
    .from('payments')
    .select('provider_invoice_id, status, raw_response')
    .eq('order_id', checkout.order_id)
    .eq('provider', 'xendit')
    .order('created_at', { ascending: false });
  if (paymentLookupError) throw paymentLookupError;

  const existingPayment = (paymentRows || []).find((payment: any) => payment.provider_invoice_id);
  if (existingPayment) {
    if (String(existingPayment.status || '').toLowerCase() !== 'pending') {
      throw createError({ statusCode: 409, statusMessage: 'The existing payment is no longer pending.' });
    }
    const existingInvoice = existingPayment.raw_response?.invoice_url
      ? existingPayment.raw_response
      : await getXenditInvoice(existingPayment.provider_invoice_id, secretKey).catch(() => null);
    if (!existingInvoice?.invoice_url) {
      throw createError({ statusCode: 409, statusMessage: 'The existing payment link is unavailable.' });
    }
    return {
      resumed: true,
      order_id: checkout.order_id,
      order_number: checkout.order_number,
      payment_url: existingInvoice.invoice_url,
      status: 'pending',
    };
  }

  if (!checkout.should_create_invoice || !checkout.invoice_creation_token) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A payment link is already being prepared. Please retry shortly.',
    });
  }

  const customerEmail = String(user.email || '').trim().slice(0, 254);
  const customerName = String(
    body?.customerName || user.user_metadata?.full_name || customerEmail.split('@')[0] || 'Customer',
  ).trim().slice(0, 100);
  const origin = checkoutOrigin(config, event);

  const invoice = await createXenditInvoice({
    externalId: `ORDER-${checkout.order_id}`,
    amount: Number(checkout.total_amount),
    description: `${String(checkout.product_name).slice(0, 90)} (${String(checkout.license_name).slice(0, 30)}) - ${customerEmail}`,
    customerEmail,
    customerName,
    successRedirectUrl: `${origin}/orders/${checkout.order_id}`,
    failureRedirectUrl: `${origin}/orders/${checkout.order_id}`,
  }, secretKey).catch(async (error) => {
    console.error('[Checkout] Failed to create Xendit invoice:', error);
    await supabase
      .from('orders')
      .update({ status: 'failed', invoice_creation_token: null, invoice_creation_started_at: null })
      .eq('id', checkout.order_id)
      .eq('status', 'pending')
      .eq('invoice_creation_token', checkout.invoice_creation_token);
    throw createError({ statusCode: 502, statusMessage: 'Payment provider could not create an invoice.' });
  });

  await persistInvoice(supabase, checkout.order_id, invoice);
  await supabase
    .from('orders')
    .update({ invoice_creation_token: null, invoice_creation_started_at: null })
    .eq('id', checkout.order_id)
    .eq('invoice_creation_token', checkout.invoice_creation_token);
  await logPaymentEvent({
    order_id: checkout.order_id,
    order_number: checkout.order_number,
    event_type: 'invoice_created',
    new_status: 'pending',
    provider_status: String(invoice.status || '').toUpperCase() || undefined,
    metadata: { invoice_id: invoice.id },
    created_at: new Date().toISOString(),
  });

  return {
    resumed: Boolean(checkout.resumed),
    order_id: checkout.order_id,
    order_number: checkout.order_number,
    payment_url: invoice.invoice_url,
    status: 'pending',
  };
});
