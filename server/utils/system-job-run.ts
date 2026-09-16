import { useSupabaseAdmin } from './supabase-admin';

export type SystemJobName = 'payment_reconciliation' | 'seller_payouts';
export type SystemJobStatus = 'succeeded' | 'partial' | 'failed';

interface SystemJobResult {
  status: SystemJobStatus;
  processed?: number;
  succeeded?: number;
  failed?: number;
  errorSummary?: string | null;
  metadata?: Record<string, unknown>;
}

export async function beginSystemJob(jobName: SystemJobName, leaseSeconds = 1800): Promise<string | null> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc('begin_system_job', {
    p_job_name: jobName,
    p_lease_seconds: leaseSeconds,
  });

  if (error) throw error;
  return data ? String(data) : null;
}

export async function completeSystemJob(runId: string, result: SystemJobResult): Promise<void> {
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc('complete_system_job', {
    p_run_id: runId,
    p_status: result.status,
    p_processed_count: Math.max(0, Math.trunc(result.processed || 0)),
    p_succeeded_count: Math.max(0, Math.trunc(result.succeeded || 0)),
    p_failed_count: Math.max(0, Math.trunc(result.failed || 0)),
    p_error_summary: String(result.errorSummary || '').slice(0, 2000) || null,
    p_metadata: result.metadata || {},
  });

  if (error) throw error;
  if (!data) throw new Error('System job execution was no longer running.');
}

export function systemJobErrorSummary(error: unknown): string {
  const candidate = error as any;
  return String(candidate?.statusMessage || candidate?.message || 'Unexpected system job failure.').slice(0, 2000);
}
