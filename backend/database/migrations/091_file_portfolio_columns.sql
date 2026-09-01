-- Migration 091: Add portfolio support columns to File table
-- Adds display_order and file_context columns, and expands the file_type check
-- to include portfolio-related types used by the portfolio upload/query routes.

-- 1. Add missing columns
ALTER TABLE "public"."File"
  ADD COLUMN IF NOT EXISTS "display_order" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "file_context" character varying(100);

-- 2. Drop the old file_type CHECK so we can replace it
ALTER TABLE "public"."File" DROP CONSTRAINT IF EXISTS "File_file_type_check";

-- 3. Re-create with portfolio types included
ALTER TABLE "public"."File" ADD CONSTRAINT "File_file_type_check"
  CHECK (file_type::text = ANY (ARRAY[
    'profile_picture',
    'post_image',
    'post_video',
    'gig_attachment',
    'home_document',
    'home_photo',
    'home_video',
    'chat_file',
    'mailbox_attachment',
    'portfolio_image',
    'portfolio_video',
    'portfolio_document',
    'resume',
    'certification',
    'other'
  ]::text[]));

-- 4. Index for portfolio queries (order by display_order, filter by user + type)
CREATE INDEX IF NOT EXISTS idx_file_portfolio
  ON "public"."File" (user_id, file_type, display_order)
  WHERE is_deleted = false;
