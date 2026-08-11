import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

export interface PaymentLogEntry {
  order_id: string;
  order_number?: string;
  event_type:
    | 'status_check'
    | 'status_update'
    | 'error'
    | 'webhook_received'
    | 'webhook_verified'
    | 'webhook_processed'
    | 'invoice_created'
    | 'invoice_paid'
    | 'invoice_expired'
    | 'product_delivered';
  old_status?: string;
  new_status?: string;
  provider_status?: string;
  error_message?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

/**
 * Log payment-related events to a dedicated table for monitoring and debugging
 * This provides better visibility into payment processing issues
 */
export async function logPaymentEvent(entry: PaymentLogEntry): Promise<void> {
  const supabase = useSupabaseAdmin();

  try {
    // Try to insert into payment_logs table if it exists
    const { error } = await supabase.from('payment_logs').insert({
      order_id: entry.order_id,
      order_number: entry.order_number,
      event_type: entry.event_type,
      old_status: entry.old_status,
      new_status: entry.new_status,
      provider_status: entry.provider_status,
      error_message: entry.error_message,
      metadata: entry.metadata,
      created_at: entry.created_at || new Date().toISOString(),
    });

    if (error) {
      // If table doesn't exist, just log to console
      console.log('[Payment Logger]', JSON.stringify(entry));
    }
  } catch (error) {
    // If logging fails, don't break the main flow
    console.log('[Payment Logger]', JSON.stringify(entry));
  }
}

/**
 * Get recent payment logs for an order
 */
export async function getPaymentLogsForOrder(orderId: string, limit = 10): Promise<PaymentLogEntry[]> {
  const supabase = useSupabaseAdmin();

  try {
    const { data, error } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Payment Logger] Failed to fetch logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Payment Logger] Error fetching logs:', error);
    return [];
  }
}

/**
 * Get recent payment logs by event type
 */
export async function getPaymentLogsByType(
  eventType: string,
  limit = 50,
  hours = 24
): Promise<PaymentLogEntry[]> {
  const supabase = useSupabaseAdmin();

  try {
    const threshold = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('event_type', eventType)
      .gte('created_at', threshold)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[Payment Logger] Failed to fetch logs by type:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[Payment Logger] Error fetching logs by type:', error);
    return [];
  }
}
