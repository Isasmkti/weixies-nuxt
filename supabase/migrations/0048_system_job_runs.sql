-- Durable cron execution history and a database-backed concurrency lease.

BEGIN;

CREATE TABLE public.system_job_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  processed_count integer NOT NULL DEFAULT 0,
  succeeded_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT system_job_runs_pkey PRIMARY KEY (id),
  CONSTRAINT system_job_runs_job_name_check CHECK (
    job_name IN ('payment_reconciliation', 'seller_payouts')
  ),
  CONSTRAINT system_job_runs_status_check CHECK (
    status IN ('running', 'succeeded', 'partial', 'failed')
  ),
  CONSTRAINT system_job_runs_counts_check CHECK (
    processed_count >= 0
    AND succeeded_count >= 0
    AND failed_count >= 0
    AND succeeded_count + failed_count <= processed_count
  ),
  CONSTRAINT system_job_runs_error_summary_check CHECK (
    error_summary IS NULL OR char_length(error_summary) <= 2000
  )
);

CREATE UNIQUE INDEX system_job_runs_one_running_job_uidx
  ON public.system_job_runs (job_name)
  WHERE status = 'running';

CREATE INDEX system_job_runs_job_started_idx
  ON public.system_job_runs (job_name, started_at DESC);

ALTER TABLE public.system_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage system job runs"
  ON public.system_job_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.system_job_runs FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON public.system_job_runs TO service_role;

CREATE FUNCTION public.begin_system_job(
  p_job_name text,
  p_lease_seconds integer DEFAULT 1800
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_run_id uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_job_name NOT IN ('payment_reconciliation', 'seller_payouts')
     OR p_lease_seconds < 60
     OR p_lease_seconds > 7200 THEN
    RAISE EXCEPTION 'Invalid system job lease.' USING ERRCODE = '22023';
  END IF;

  -- A crashed function cannot release its lease. Expire it before attempting
  -- the partial-unique insert for the next scheduled invocation.
  UPDATE public.system_job_runs
  SET status = 'failed',
      finished_at = now(),
      error_summary = 'Execution lease expired before the job completed.'
  WHERE job_name = p_job_name
    AND status = 'running'
    AND started_at < now() - make_interval(secs => p_lease_seconds);

  BEGIN
    INSERT INTO public.system_job_runs (job_name)
    VALUES (p_job_name)
    RETURNING id INTO v_run_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN NULL;
  END;

  RETURN v_run_id;
END;
$$;

CREATE FUNCTION public.complete_system_job(
  p_run_id uuid,
  p_status text,
  p_processed_count integer DEFAULT 0,
  p_succeeded_count integer DEFAULT 0,
  p_failed_count integer DEFAULT 0,
  p_error_summary text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_run_id IS NULL
     OR p_status NOT IN ('succeeded', 'partial', 'failed')
     OR p_processed_count < 0
     OR p_succeeded_count < 0
     OR p_failed_count < 0
     OR p_succeeded_count + p_failed_count > p_processed_count THEN
    RAISE EXCEPTION 'Invalid system job result.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.system_job_runs
  SET status = p_status,
      finished_at = now(),
      processed_count = p_processed_count,
      succeeded_count = p_succeeded_count,
      failed_count = p_failed_count,
      error_summary = left(NULLIF(btrim(p_error_summary), ''), 2000),
      metadata = COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = p_run_id
    AND status = 'running';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_system_job(text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_system_job(uuid, text, integer, integer, integer, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_system_job(text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_system_job(uuid, text, integer, integer, integer, text, jsonb)
  TO service_role;

COMMENT ON TABLE public.system_job_runs IS
  'Service-only execution history and concurrency leases for scheduled marketplace jobs.';

NOTIFY pgrst, 'reload schema';

COMMIT;
