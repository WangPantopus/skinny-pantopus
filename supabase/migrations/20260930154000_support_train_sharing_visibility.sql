-- Backwards compatible: yes. Data only: no table, column, function or grant changes.
-- The backend published every Support Train with its Activity visible 'nearby', whatever its
-- sharing mode, so a train shared with "My connections" (invited_only) or "Link only"
-- (direct_share_only) appeared in the Nearby list to everyone in range. Those modes promise
-- "Only people you're connected to can find this" and "Hidden — share the link with people
-- you trust". The backend now publishes them 'private'; this makes the trains already
-- published follow the same rule. Idempotent; "Nearby neighbors" (private_link) is untouched.
SET LOCAL lock_timeout='5s';

UPDATE public."Activity" a
SET visibility = 'private', updated_at = now()
FROM public."SupportTrain" st
WHERE st.activity_id = a.id
  AND st.sharing_mode IN ('invited_only', 'direct_share_only')
  AND a.visibility IN ('nearby', 'public');
