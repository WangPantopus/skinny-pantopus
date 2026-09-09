-- ============================================================
-- 195 — Address calendar rules (Wedge Phase 2, D6)
--
-- The recurring, address-specific events that make Today worth opening
-- on a Tuesday: garbage / recycling / yard-waste day, street sweeping,
-- the property-tax dates, council meetings, burn bans, permit hearings,
-- school calendars, ballot deadlines.
--
-- One table, scoped rules. A rule applies to every home inside its
-- scope; the narrowest scope wins when kinds collide (a household's own
-- pickup day beats the city's default). Recurrence is an RFC 5545
-- RRULE string expanded at read time (backend/services/addressCalendarService).
--
--   scope_type · scope_key
--     state   · 'WA'
--     county  · 'WA:Clark'
--     city    · 'WA:Camas'
--     home    · <Home.id>          (resident overrides, e.g. pickup day)
--
-- `confidence` is honest about provenance: 'official' rows cite a
-- government source; 'unverified' rows were seeded by hand and the card
-- says so until a resident or the founder confirms them.
-- ============================================================

CREATE TABLE IF NOT EXISTS "public"."AddressCalendarRule" (
    "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "scope_type"   text NOT NULL,
    "scope_key"    text NOT NULL,
    "kind"         text NOT NULL,
    "title"        text NOT NULL,
    "detail"       text,
    "rrule"        text NOT NULL,              -- e.g. 'FREQ=WEEKLY;BYDAY=TU'
    "dtstart"      date NOT NULL,              -- anchor date (first occurrence)
    "until"        date,                       -- NULL = open-ended
    "all_day"      boolean NOT NULL DEFAULT true,
    "lead_days"    integer NOT NULL DEFAULT 1, -- remind this many days before
    "source"       text,                       -- who says so ("City of Camas")
    "source_url"   text,
    "confidence"   text NOT NULL DEFAULT 'unverified',
    "created_by"   uuid,                       -- resident who set a home-scoped rule
    "created_at"   timestamptz NOT NULL DEFAULT now(),
    "updated_at"   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "AddressCalendarRule_scope_chk" CHECK ("scope_type" IN ('state', 'county', 'city', 'home')),
    CONSTRAINT "AddressCalendarRule_kind_chk" CHECK ("kind" IN (
        'garbage', 'recycling', 'yard_waste', 'bulk_pickup', 'street_sweeping',
        'property_tax', 'utility_bill', 'burn_ban', 'boil_water', 'road_closure',
        'council', 'permit_hearing', 'school', 'election_deadline', 'other'
    )),
    CONSTRAINT "AddressCalendarRule_confidence_chk" CHECK ("confidence" IN ('official', 'unverified')),
    CONSTRAINT "AddressCalendarRule_lead_chk" CHECK ("lead_days" BETWEEN 0 AND 30)
);

CREATE INDEX IF NOT EXISTS "AddressCalendarRule_scope_idx"
    ON "public"."AddressCalendarRule" ("scope_type", "scope_key");

-- One rule per (home, kind): a resident's pickup day replaces, never stacks.
CREATE UNIQUE INDEX IF NOT EXISTS "AddressCalendarRule_home_kind_uniq"
    ON "public"."AddressCalendarRule" ("scope_key", "kind")
    WHERE "scope_type" = 'home';

ALTER TABLE "public"."AddressCalendarRule" ENABLE ROW LEVEL SECURITY;
-- Service-role only: the API composes the calendar and applies home
-- membership itself; nothing here is readable straight from a client.

-- ── Seed: Washington + Clark County + Camas ─────────────────
-- Official: Washington property-tax due dates (RCW 84.56.020).
INSERT INTO "public"."AddressCalendarRule"
    ("scope_type", "scope_key", "kind", "title", "detail", "rrule", "dtstart", "lead_days", "source", "source_url", "confidence")
VALUES
    ('state', 'WA', 'property_tax', 'Property tax — first half due',
     'First-half property taxes are due April 30. Paying late adds interest from May 1.',
     'FREQ=YEARLY;BYMONTH=4;BYMONTHDAY=30', '2026-04-30', 14,
     'Washington State (RCW 84.56.020)', 'https://app.leg.wa.gov/RCW/default.aspx?cite=84.56.020', 'official'),
    ('state', 'WA', 'property_tax', 'Property tax — second half due',
     'Second-half property taxes are due October 31.',
     'FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=31', '2026-10-31', 14,
     'Washington State (RCW 84.56.020)', 'https://app.leg.wa.gov/RCW/default.aspx?cite=84.56.020', 'official'),
    -- Unverified, seeded by hand for the Camas launch: confirm with the city before it is marked official.
    ('city', 'WA:Camas', 'council', 'Camas City Council meeting',
     'Regular council meetings are typically the first and third Monday of the month, 7:00 PM, at City Hall. Agendas post the Friday before.',
     'FREQ=MONTHLY;BYDAY=1MO,3MO', '2026-09-07', 2,
     'City of Camas', 'https://www.cityofcamas.us/', 'unverified'),
    ('city', 'WA:Camas', 'garbage', 'Garbage day',
     'Garbage is collected weekly. Set your pickup day on your place page and this becomes your reminder.',
     'FREQ=WEEKLY;BYDAY=TU', '2026-09-01', 1,
     'City of Camas', 'https://www.cityofcamas.us/', 'unverified'),
    ('city', 'WA:Camas', 'recycling', 'Recycling day',
     'Recycling is collected every other week on your garbage day. Set your pickup day on your place page and this becomes your reminder.',
     'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', '2026-09-01', 1,
     'City of Camas', 'https://www.cityofcamas.us/', 'unverified')
ON CONFLICT DO NOTHING;
