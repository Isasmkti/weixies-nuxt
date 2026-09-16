interface PaymentBindingClient {
  from: (table: string) => any;
}

/**
 * A provider invoice is immutable once it has been attached to an order.
 * Checking before every upsert prevents a delayed webhook or reconciliation
 * run from moving a payment row to another local order.
 */
export async function assertXenditInvoiceBinding(
  supabase: PaymentBindingClient,
  invoiceId: string,
  orderId: string,
): Promise<void> {
  const normalizedInvoiceId = String(invoiceId || '').trim();
  const normalizedOrderId = String(orderId || '').trim();

  if (!normalizedInvoiceId || !normalizedOrderId) {
    throw createError({ statusCode: 400, statusMessage: 'A payment invoice and order are required.' });
  }

  const { data: existingPayment, error } = await supabase
    .from('payments')
    .select('order_id')
    .eq('provider', 'xendit')
    .eq('provider_invoice_id', normalizedInvoiceId)
    .maybeSingle();

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Could not verify the payment invoice binding.' });
  }

  if (existingPayment && String(existingPayment.order_id) !== normalizedOrderId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'The Xendit invoice is already attached to another order.',
    });
  }
}
