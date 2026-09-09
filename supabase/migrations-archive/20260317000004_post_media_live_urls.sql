-- Add media_live_urls column to Post table for Live Photo support.
-- Parallel array to media_urls: media_live_urls[i] holds the companion
-- MOV/MP4 URL for a Live Photo at index i (NULL/empty for regular images).

ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "media_live_urls" text[];
