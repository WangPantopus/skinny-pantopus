-- Backwards compatible: yes. Restore an archived Gig contract omitted from the
-- canonical baseline. Preserve hosted columns/data where it already exists.
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
  IF NOT EXISTS(SELECT FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='task_format') THEN
    CREATE TYPE public.task_format AS ENUM ('in_person','drop_off','remote','hybrid');
  END IF;
END $$;
ALTER TABLE public."Gig" ADD COLUMN IF NOT EXISTS task_format public.task_format
  NOT NULL DEFAULT 'in_person'::public.task_format;
CREATE INDEX IF NOT EXISTS idx_gig_task_format ON public."Gig"(task_format);
