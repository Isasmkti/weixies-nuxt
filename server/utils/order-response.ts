function publicPayment(payment: any) {
  return {
    id: payment.id,
    provider: payment.provider,
    provider_invoice_id: payment.provider_invoice_id,
    payment_method: payment.payment_method,
    status: payment.status,
    paid_at: payment.paid_at,
    created_at: payment.created_at,
    payment_url: payment?.raw_response?.invoice_url || null,
  };
}

export function sanitizeBuyerOrder<T extends Record<string, any>>(order: T): T {
  return {
    ...order,
    payments: Array.isArray(order.payments) ? order.payments.map(publicPayment) : [],
  };
}
