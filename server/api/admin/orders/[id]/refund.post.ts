import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import {
  createXenditRefund,
  getXenditInvoice,
  getXenditPayment,
  XenditApiError,
} from '~/server/utils/xendit';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default defineEventHandler(async (event) => {
  const { user } = await requirePlatformAdmin(event);
  const orderId = String(getRouterParam(event, 'id') || '').trim();
  if (!UUID_PATTERN.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'A valid order ID is required.' });
  }

  const body = await readBody(event).catch(() => ({}));
  const reason = String(body?.reason || '').trim();
  if (reason.length < 5 || reason.length > 1000) {
    throw createError({ statusCode: 400, statusMessage: 'Describe the product quality issue in 5-1000 characters.' });
  }

  const config = useRuntimeConfig();
  const secretKey = String(config.xenditSecretKey || '').trim();
  if (!secretKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_SECRET_KEY is not configured.' });
  }

  const supabase = useSupabaseAdmin();
  const updateRefundRequest = async (
    requestId: string,
    values: Record<string, any>,
    expectedStatus?: string,
  ) => {
    let query = supabase
      .from('order_refund_requests')
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq('id', requestId);
    if (expectedStatus) query = query.eq('status', expectedStatus);
    const { error } = await query;
    if (error) {
      throw createError({ statusCode: 500, statusMessage: 'Refund review state could not be saved.' });
    }
  };

  const { data: holdRows, error: holdError } = await supabase.rpc('place_order_refund_hold', {
    p_order_id: orderId,
    p_requested_by: user.id,
    p_reason: reason,
  });
  const refundRequest: any = Array.isArray(holdRows) ? holdRows[0] : holdRows;
  if (holdError || !refundRequest) {
    throw createError({ statusCode: 409, statusMessage: holdError?.message || 'Refund review could not be created.' });
  }
  if (['submitted', 'succeeded'].includes(refundRequest.status)) {
    throw createError({ statusCode: 409, statusMessage: 'This order already has a submitted refund.' });
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, payments(id, provider, provider_invoice_id, status, raw_response)')
    .eq('id', orderId)
    .single();
  if (orderError || !order) {
    throw createError({ statusCode: 404, statusMessage: 'Order was not found.' });
  }

  const payment: any = (order.payments || []).find((item: any) => (
    item.provider === 'xendit' && item.status === 'paid' && item.provider_invoice_id
  ));
  if (!payment) {
    throw createError({ statusCode: 409, statusMessage: 'A paid Xendit transaction was not found for this order.' });
  }

  let paymentRequestId = String(payment.raw_response?.payment_request_id || '').trim();
  let paymentId = String(payment.raw_response?.payment_id || '').trim();

  if (!paymentRequestId) {
    const invoice = await getXenditInvoice(payment.provider_invoice_id, secretKey).catch(() => null);
    paymentRequestId = String(invoice?.payment_request_id || '').trim();
    paymentId = String(invoice?.payment_id || paymentId).trim();
  }
  if (!paymentRequestId && /^py-/i.test(paymentId)) {
    const providerPayment = await getXenditPayment(paymentId, secretKey).catch(() => null);
    paymentRequestId = String(providerPayment?.payment_request_id || '').trim();
  }

  if (!/^pr-/i.test(paymentRequestId)) {
    await updateRefundRequest(refundRequest.id, {
      status: 'manual_action_required',
      provider_response: {
        reason: 'legacy_invoice_without_payment_request_id',
        invoice_id: payment.provider_invoice_id,
      },
    });

    setResponseStatus(event, 202);
    return {
      status: 'manual_action_required',
      refundRequestId: refundRequest.id,
      invoiceId: payment.provider_invoice_id,
      message: 'Seller funds are on hold. Complete the full refund from the Xendit Dashboard; the refund webhook will reconcile this order automatically.',
    };
  }

  // Persist the one-way transition before the external request. If the
  // network times out after Xendit accepts it, the hold cannot be released
  // while the provider result is still unknown.
  await updateRefundRequest(refundRequest.id, {
    status: 'submitted',
    provider_failure_code: null,
    submitted_at: new Date().toISOString(),
  });

  try {
    const providerRefund = await createXenditRefund({
      paymentRequestId,
      referenceId: refundRequest.provider_reference_id,
      amount: Number(order.total_amount),
      orderId,
    }, secretKey);

    const providerStatus = String(providerRefund.status || '').toUpperCase();
    await updateRefundRequest(refundRequest.id, {
      status: providerStatus === 'FAILED' ? 'failed' : 'submitted',
      provider_refund_id: providerRefund.id || null,
      provider_failure_code: providerRefund.failure_code || null,
      provider_response: providerRefund,
    }, 'submitted');

    return {
      status: providerStatus === 'FAILED' ? 'failed' : 'submitted',
      refundRequestId: refundRequest.id,
      providerRefundId: providerRefund.id,
    };
  } catch (error: any) {
    const definitiveFailure = error instanceof XenditApiError && error.isDefinitiveClientError;
    await updateRefundRequest(refundRequest.id, {
      status: definitiveFailure ? 'failed' : 'submitted',
      provider_failure_code: definitiveFailure
        ? (error.errorCode || 'REFUND_REJECTED')
        : 'SUBMISSION_STATUS_UNKNOWN',
      provider_response: error?.payload || { message: error?.message || String(error) },
      resolved_at: definitiveFailure ? new Date().toISOString() : null,
    }, 'submitted');

    setResponseStatus(event, 202);
    return {
      status: definitiveFailure ? 'failed' : 'submission_unknown',
      refundRequestId: refundRequest.id,
      invoiceId: payment.provider_invoice_id,
      message: definitiveFailure
        ? 'Xendit rejected the refund request. Seller funds remain on hold while an administrator reviews the error.'
        : 'The Xendit response is uncertain. Seller funds remain locked; verify the transaction in Xendit and wait for the webhook.',
    };
  }
});
