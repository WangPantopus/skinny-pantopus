-- WP7 extends the existing FunnelEvent vocabulary; no parallel event table.
-- The baseline and archived 168/196 migrations retain the six original values.
-- A new forward migration is needed because those definitions are applied history.
-- Coordinator reservation: 20261004101000, Stream 1.
-- Backwards compatible: yes. All existing event types, rows, grants and RLS
-- remain valid; this only admits four additional values for pilot measurement.
BEGIN;
SET LOCAL lock_timeout='5s';

ALTER TABLE public."FunnelEvent" DROP CONSTRAINT funnelevent_type_check;
ALTER TABLE public."FunnelEvent" ADD CONSTRAINT funnelevent_type_check CHECK (
  event_type IN (
    't0_preview_viewed', 't0_aha_viewed', 't0_share_clicked',
    't0_wall_viewed', 'register_started', 't1_account_created',
    'session_open', 'reminder_sent', 'reminder_action', 'suggestion_decision'
  )
);

COMMIT;
