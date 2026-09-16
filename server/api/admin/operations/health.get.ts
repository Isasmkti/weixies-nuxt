import { requirePlatformAdmin } from '~/server/utils/admin-auth';
import { useSupabaseAdmin } from '~/server/utils/supabase-admin';

const countValue = (result: any) => Number(result?.count) || 0;

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event);
  setResponseHeader(event, 'Cache-Control', 'no-store');

  const supabase = useSupabaseAdmin();
  const now = Date.now();
  const pendingThreshold = new Date(now - (30 * 60 * 1000)).toISOString();
  const payoutThreshold = new Date(now - (6 * 60 * 60 * 1000)).toISOString();
  const recentErrorThreshold = new Date(now - (24 * 60 * 60 * 1000)).toISOString();

  const results = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lt('created_at', pendingThreshold),
    supabase
      .from('payment_logs')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'error')
      .gte('created_at', recentErrorThreshold),
    supabase
      .from('order_refund_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'manual_action_required']),
    supabase
      .from('seller_payouts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'reversed']),
    supabase
      .from('seller_payouts')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing'])
      .lt('created_at', payoutThreshold),
    supabase
      .from('system_job_runs')
      .select('job_name, status, started_at, finished_at, processed_count, succeeded_count, failed_count, error_summary')
      .order('started_at', { ascending: false })
      .limit(20),
  ]);

  const failedQueries = results
    .map((result, index) => ({ index, error: result.error }))
    .filter(result => result.error);

  if (failedQueries.length) {
    console.error('[Admin operations health] Query failure:', failedQueries.map(({ index, error }) => ({
      index,
      code: error?.code || 'unknown',
    })));
    throw createError({ statusCode: 500, statusMessage: 'Operational health could not be loaded.' });
  }

  const [
    stalePendingOrders,
    recentPaymentErrors,
    refundAttention,
    payoutExceptions,
    stalledPayouts,
  ] = results.slice(0, 5).map(countValue);
  const jobRows = results[5].data || [];
  const latestJobs = ['payment_reconciliation', 'seller_payouts'].map((jobName) => {
    const latest = jobRows.find((row: any) => row.job_name === jobName) || null;
    const ageHours = latest?.started_at
      ? (now - new Date(latest.started_at).getTime()) / (60 * 60 * 1000)
      : Number.POSITIVE_INFINITY;
    const needsAttention = !latest
      || ['failed', 'partial'].includes(latest.status)
      || ageHours > 36;

    return {
      jobName,
      status: latest?.status || 'never_run',
      startedAt: latest?.started_at || null,
      finishedAt: latest?.finished_at || null,
      processed: Number(latest?.processed_count) || 0,
      succeeded: Number(latest?.succeeded_count) || 0,
      failed: Number(latest?.failed_count) || 0,
      errorSummary: latest?.error_summary || null,
      needsAttention,
    };
  });
  const automationAttention = latestJobs.filter(job => job.needsAttention).length;
  const attentionCount = stalePendingOrders
    + recentPaymentErrors
    + refundAttention
    + payoutExceptions
    + stalledPayouts
    + automationAttention;

  return {
    status: attentionCount > 0 ? 'attention' : 'healthy',
    attentionCount,
    checkedAt: new Date().toISOString(),
    thresholds: {
      pendingOrderMinutes: 30,
      paymentErrorHours: 24,
      stalledPayoutHours: 6,
    },
    counts: {
      stalePendingOrders,
      recentPaymentErrors,
      refundAttention,
      payoutExceptions,
      stalledPayouts,
      automationAttention,
    },
    jobs: latestJobs,
  };
});
