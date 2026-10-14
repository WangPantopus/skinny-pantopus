-- Backwards compatible: yes. Adds one nullable column; no existing row, read or write changes.
-- Deploy migration before backend.
--
-- Posting in Pulse is adults-only at launch (docs/product/pulse-build/01-build-spec.md §5 and §10,
-- contract §2.10 and §4.1, slice S5): a person confirms "I'm 18 or older" once, before their first
-- Pulse post or reply, and the time they did is kept here.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS adult_attested_at timestamptz;
