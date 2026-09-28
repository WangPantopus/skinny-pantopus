-- Deploy before the updated backend. Legacy callers and saved updates retain
-- their existing push behavior. Store the command's choice so retries cannot
-- silently change delivery settings or create another notification.
SET LOCAL lock_timeout='5s';
ALTER TABLE public."SupportTrainUpdate"
  ADD COLUMN push_to_phones boolean NOT NULL DEFAULT true;
