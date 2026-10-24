-- Backwards compatible: yes. Preserve existing actor/block denial precedence
-- while retaining the same transactional sender and reply admission guard.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- PostgreSQL runs same-kind triggers by name. The established direct-message
-- actor/block gate must decide first, including its specific denial reason.
-- The writer guard still runs BEFORE insertion, after the shared room lock,
-- topic binding and existing plan/direct admission. No guard is bypassed.
ALTER TRIGGER guard_chat_writer_binding ON public."ChatMessage"
  RENAME TO trigger_writer_membership_admission;

COMMIT;
