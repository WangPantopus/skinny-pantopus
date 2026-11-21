-- Backwards compatible: yes. One index only: no table, column, function, trigger, policy or grant changes.
--
-- The travelling card (launch key card_travel, docs/product/travelling-card-2026-11-21, Part 1). A card that travels
-- keeps its journey in Mail.mail_extracted.card.travel, written by the server only; no new table. This index finds a
-- journey's cards without a scan (services/cardTravel journeyRows, the public journey page, the morning run). It is
-- partial, so it holds only travelling cards and costs nothing for any other mail.
--
-- The plan wrote CREATE INDEX CONCURRENTLY. The migration runner (supabase db push) sends a file as one pipeline,
-- where CONCURRENTLY can't run (SQLSTATE 25001), so it is built the way this repository's other indexes are: in a
-- transaction with a bounded lock wait. Building it reads Mail once; no other row is written.
BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE INDEX IF NOT EXISTS mail_card_travel_journey_idx
  ON public."Mail" ((mail_extracted->'card'->'travel'->>'journey'))
  WHERE mail_extracted->'card'->'travel' IS NOT NULL;

COMMIT;
