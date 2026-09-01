-- Migration: 20260612000000_create_job_locks.sql
-- Purpose: Distributed lock table for cron job migration (Phase 1).
-- Prevents concurrent execution of the same job across multiple instances.

CREATE TABLE IF NOT EXISTS public.job_locks (
  job_name     TEXT PRIMARY KEY,
  locked_by    TEXT NOT NULL,          -- instance identifier (hostname or random UUID)
  locked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,   -- auto-expire stale locks
  run_count    BIGINT NOT NULL DEFAULT 0,
  last_success TIMESTAMPTZ,
  last_failure TIMESTAMPTZ,
  last_error   TEXT
);

ALTER TABLE public.job_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_locks FROM PUBLIC;
REVOKE ALL ON TABLE public.job_locks FROM anon, authenticated;
GRANT ALL ON TABLE public.job_locks TO service_role;

DROP POLICY IF EXISTS "job_locks_service_role_all" ON public.job_locks;
CREATE POLICY "job_locks_service_role_all"
  ON public.job_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Index for cleanup query
CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON public.job_locks (expires_at);

-- Function: try to acquire lock (returns true if acquired)
CREATE OR REPLACE FUNCTION public.acquire_job_lock(
  p_job_name TEXT,
  p_locked_by TEXT,
  p_ttl_seconds INT DEFAULT 300
) RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_acquired BOOLEAN;
BEGIN
  -- Try to insert (new lock) or update (expired lock)
  INSERT INTO public.job_locks (job_name, locked_by, locked_at, expires_at, run_count)
  VALUES (p_job_name, p_locked_by, now(), now() + (p_ttl_seconds || ' seconds')::INTERVAL, 1)
  ON CONFLICT (job_name) DO UPDATE
    SET locked_by = p_locked_by,
        locked_at = now(),
        expires_at = now() + (p_ttl_seconds || ' seconds')::INTERVAL,
        run_count = public.job_locks.run_count + 1
    WHERE public.job_locks.expires_at < now();  -- Only if expired

  GET DIAGNOSTICS v_acquired = ROW_COUNT;
  RETURN v_acquired > 0;
END;
$$;

-- Function: release lock and record result
CREATE OR REPLACE FUNCTION public.release_job_lock(
  p_job_name TEXT,
  p_locked_by TEXT,
  p_success BOOLEAN,
  p_error TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_locks
  SET expires_at = now(),  -- immediately expire
      last_success = CASE WHEN p_success THEN now() ELSE last_success END,
      last_failure = CASE WHEN NOT p_success THEN now() ELSE last_failure END,
      last_error = CASE WHEN NOT p_success THEN p_error ELSE last_error END
  WHERE job_name = p_job_name AND locked_by = p_locked_by;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_job_lock(TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_job_lock(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_job_lock(TEXT, TEXT, INT) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_job_lock(TEXT, TEXT, BOOLEAN, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_job_lock(TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_job_lock(TEXT, TEXT, BOOLEAN, TEXT) TO service_role;
