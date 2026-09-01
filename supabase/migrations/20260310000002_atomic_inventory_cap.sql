-- ============================================================
-- Atomic inventory cap check-and-increment
--
-- Prevents concurrent listing creates from exceeding inventory
-- caps by using SELECT ... FOR UPDATE inside a single transaction.
-- Creates the slot row if none exists yet.
-- Returns true when a slot was successfully claimed, false when
-- the cap has been reached.
-- ============================================================

-- Ensure the table exists (may already exist from initial schema)
CREATE TABLE IF NOT EXISTS "public"."ListingInventorySlot" (
  "id"            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "home_id"       uuid NOT NULL,
  "layer"         text NOT NULL,
  "active_count"  int  NOT NULL DEFAULT 0,
  "max_count"     int  NOT NULL DEFAULT 10,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("home_id", "layer")
);

CREATE OR REPLACE FUNCTION claim_inventory_slot(
  p_home_id   uuid,
  p_layer     text,
  p_max_count int DEFAULT 10
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
  v_max   int;
BEGIN
  -- Try to lock the existing row
  SELECT active_count, max_count
    INTO v_count, v_max
    FROM "ListingInventorySlot"
   WHERE home_id = p_home_id AND layer = p_layer
     FOR UPDATE;

  IF NOT FOUND THEN
    -- No slot row yet — insert one with active_count = 1
    INSERT INTO "ListingInventorySlot" (home_id, layer, active_count, max_count)
    VALUES (p_home_id, p_layer, 1, p_max_count)
    ON CONFLICT (home_id, layer)
    DO UPDATE SET active_count = "ListingInventorySlot".active_count + 1,
                  updated_at   = now()
    WHERE "ListingInventorySlot".active_count < "ListingInventorySlot".max_count
    RETURNING active_count INTO v_count;

    -- If the ON CONFLICT path ran but the WHERE failed, v_count is null → cap hit
    IF v_count IS NULL THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  -- Row exists and is locked — check cap
  IF v_count >= v_max THEN
    RETURN false;
  END IF;

  UPDATE "ListingInventorySlot"
     SET active_count = active_count + 1,
         updated_at   = now()
   WHERE home_id = p_home_id AND layer = p_layer;

  RETURN true;
END;
$$;

-- Companion function: release a slot (for rollback on failed insert)
CREATE OR REPLACE FUNCTION release_inventory_slot(
  p_home_id uuid,
  p_layer   text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "ListingInventorySlot"
     SET active_count = GREATEST(active_count - 1, 0),
         updated_at   = now()
   WHERE home_id = p_home_id AND layer = p_layer;
END;
$$;
