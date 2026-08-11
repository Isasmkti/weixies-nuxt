import { useSupabaseAdmin } from '~/server/utils/supabase-admin';
import { logPaymentEvent } from '~/server/utils/payment-logger';
import { grantDigitalAccessForOrder } from '~/server/utils/order-delivery';
import {
  getXenditInvoice,
  normalizeXenditInvoiceStatus,
} from '~/server/utils/xendit';

export async function processPendingOrder(
  orderId: string,
  secretKey: string,
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  const supabase = useSupabaseAdmin();

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, provider_invoice_id, status, total_amount, profile_id, order_number')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error(`[Xendit Status Processor] Order ${orderId} not found:`, orderError);
      await logPaymentEvent({
        order_id: orderId,
        event_type: 'error',
        error_message: 'Order not found',
        created_at: new Date().toISOString(),
      });
      return { success: false, error: 'Order not found' };
    }

    if (!order.provider_invoice_id) {
      await logPaymentEvent({
        order_id: orderId,
        order_number: order.order_number,
        event_type: 'error',
        old_status: order.status,
        error_message: 'Missing Xendit invoice ID',
        created_at: new Date().toISOString(),
      });
      return { success: false, error: 'Missing Xendit invoice ID' };
    }

    await logPaymentEvent({
      order_id: orderId,
      order_number: order.order_number,
      event_type: 'status_check',
      old_status: order.status,
      metadata: { provider: 'xendit' },
      created_at: new Date().toISOString(),
    });

    const invoice = await getXenditInvoice(order.provider_invoice_id, secretKey);

    if (String(invoice.external_id || '').trim() !== `ORDER-${order.id}`) {
      await logPaymentEvent({
        order_id: orderId,
        order_number: order.order_number,
        event_type: 'error',
        old_status: order.status,
        error_message: 'Invoice external_id mismatch',
        metadata: {
          expected: `ORDER-${order.id}`,
          received: invoice.external_id,
        },
        created_at: new Date().toISOString(),
      });
      return { success: false, error: 'Invoice external_id mismatch' };
    }

    if (Number(order.total_amount) !== Number(invoice.amount)) {
      await logPaymentEvent({
        order_id: orderId,
        order_number: order.order_number,
        event_type: 'error',
        old_status: order.status,
        error_message: 'Amount mismatch',
        metadata: {
          expected: order.total_amount,
          received: invoice.amount,
        },
        created_at: new Date().toISOString(),
      });
      return { success: false, error: 'Amount mismatch' };
    }

    const normalizedStatus = normalizeXenditInvoiceStatus(invoice.status);
    if (!normalizedStatus) {
      await logPaymentEvent({
        order_id: orderId,
        order_number: order.order_number,
        event_type: 'error',
        old_status: order.status,
        error_message: 'Unknown invoice status',
        metadata: { received_status: invoice.status },
        created_at: new Date().toISOString(),
      });
      return { success: false, error: 'Unknown invoice status' };
    }

    const paymentMethod = String(invoice.payment_method || invoice.payment_channel || '').trim() || null;
    const paidAt = normalizedStatus === 'paid'
      ? (invoice.paid_at || new Date().toISOString())
      : null;

    const { error: paymentError } = await supabase.from('payments').upsert({
      order_id: order.id,
      provider: 'xendit',
      provider_invoice_id: invoice.id,
      payment_method: paymentMethod,
      status: normalizedStatus,
      paid_at: paidAt,
      raw_response: invoice,
      created_at: invoice.created || new Date().toISOString(),
    }, { onConflict: 'provider_invoice_id' });

    if (paymentError) {
      throw paymentError;
    }

    const orderUpdate: Record<string, string | null> = {
      status: normalizedStatus,
      payment_method: paymentMethod,
      payment_url: invoice.invoice_url || null,
    };

    if (normalizedStatus === 'paid') {
      orderUpdate.paid_at = paidAt;
    }

    if (normalizedStatus === 'expired') {
      orderUpdate.expired_at = invoice.expiry_date || new Date().toISOString();
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', order.id);

    if (orderUpdateError) {
      throw orderUpdateError;
    }

    await logPaymentEvent({
      order_id: order.id,
      order_number: order.order_number,
      event_type: 'status_update',
      old_status: order.status,
      new_status: normalizedStatus,
      provider_status: String(invoice.status || '').toUpperCase() || undefined,
      created_at: new Date().toISOString(),
    });

    if (normalizedStatus === 'paid') {
      await logPaymentEvent({
        order_id: order.id,
        order_number: order.order_number,
        event_type: 'invoice_paid',
        old_status: order.status,
        new_status: normalizedStatus,
        provider_status: String(invoice.status || '').toUpperCase() || undefined,
        metadata: { invoice_id: invoice.id },
        created_at: new Date().toISOString(),
      });

      try {
        await grantDigitalAccessForOrder(order.id, order.profile_id);
        await logPaymentEvent({
          order_id: order.id,
          order_number: order.order_number,
          event_type: 'product_delivered',
          old_status: order.status,
          new_status: normalizedStatus,
          metadata: { invoice_id: invoice.id },
          created_at: new Date().toISOString(),
        });
      } catch (deliveryError) {
        await logPaymentEvent({
          order_id: order.id,
          order_number: order.order_number,
          event_type: 'error',
          old_status: order.status,
          new_status: normalizedStatus,
          error_message: 'Could not grant product access',
          metadata: { error: String(deliveryError) },
          created_at: new Date().toISOString(),
        });
        throw deliveryError;
      }
    }

    if (normalizedStatus === 'expired') {
      await logPaymentEvent({
        order_id: order.id,
        order_number: order.order_number,
        event_type: 'invoice_expired',
        old_status: order.status,
        new_status: normalizedStatus,
        provider_status: String(invoice.status || '').toUpperCase() || undefined,
        metadata: { invoice_id: invoice.id },
        created_at: new Date().toISOString(),
      });
    }

    return { success: true, newStatus: normalizedStatus };
  } catch (error) {
    console.error(`[Xendit Status Processor] Error processing order ${orderId}:`, error);
    return { success: false, error: String(error) };
  }
}

export async function processPendingOrders(
  secretKey: string,
  options: {
    maxOrders?: number;
    olderThanMinutes?: number;
  } = {},
): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
  const { maxOrders = 50, olderThanMinutes = 30 } = options;
  const supabase = useSupabaseAdmin();
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();

  try {
    const { data: orders, error: fetchError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'pending')
      .gte('created_at', '1970-01-01T00:00:00.000Z')
      .lt('created_at', threshold)
      .order('created_at', { ascending: true })
      .limit(maxOrders);

    if (fetchError) {
      console.error('[Xendit Status Processor] Failed to fetch pending orders:', fetchError);
      return { processed: 0, succeeded: 0, failed: 0, errors: [fetchError.message] };
    }

    if (!orders || orders.length === 0) {
      console.log('[Xendit Status Processor] No pending orders to process');
      return { processed: 0, succeeded: 0, failed: 0, errors: [] };
    }

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const order of orders) {
      const result = await processPendingOrder(order.id, secretKey);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`Order ${order.id}: ${result.error}`);
        }
      }
    }

    return { processed: orders.length, succeeded, failed, errors };
  } catch (error) {
    console.error('[Xendit Status Processor] Error in processPendingOrders:', error);
    return { processed: 0, succeeded: 0, failed: 0, errors: [String(error)] };
  }
}
