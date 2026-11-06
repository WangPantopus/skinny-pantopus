-- A verified neighbor can send a note to any address on their block (founder decision 2026-11-06). When no
-- verified household lives there, the note is kept with no recipient, and it still counts toward the sender's
-- weekly limit, so the limit can't tell them who lives where. The address is kept only as a hash, to spot a
-- repeat of the same send.
ALTER TABLE public."NeighborMessage" ALTER COLUMN recipient_user_id DROP NOT NULL;
ALTER TABLE public."NeighborMessage" ADD COLUMN IF NOT EXISTS recipient_address_hash text;
