-- Backwards compatible: yes. Recover references lost by the former read/modify/write upload path.
SET LOCAL lock_timeout = '5s';

-- Keep existing attachments in place and append only still-recorded media that is absent.
-- Historical over-limit uploads are retained; admission prevents adding more until files are removed.
UPDATE public."Gig" AS g
SET attachments = coalesce(g.attachments, '{}'::text[]) || ARRAY(
  SELECT m.file_url
  FROM public."GigMedia" AS m
  WHERE m.gig_id = g.id AND m.file_url IS NOT NULL
    AND NOT (m.file_url = ANY(coalesce(g.attachments, '{}'::text[])))
  GROUP BY m.file_url
  ORDER BY min(m.display_order), m.file_url
), updated_at = clock_timestamp()
WHERE EXISTS (
  SELECT 1 FROM public."GigMedia" AS m
  WHERE m.gig_id = g.id AND m.file_url IS NOT NULL
    AND NOT (m.file_url = ANY(coalesce(g.attachments, '{}'::text[])))
);
