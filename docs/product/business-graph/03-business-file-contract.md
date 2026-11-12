# The business file, steps 2 to 6: the contract

November 11, 2026 · Read against master `e3c79b6791`. Nothing here is built.
Step 1 is live ([PR #3938](https://github.com/WangPantopus/skinny-pantopus/pull/3938)).

The reasons and the sources are in [the plan](../business-catalog-claim-plan-2026-11-11.md).
This is what gets built. Steps 2 to 4 are exact. Steps 5 and 6 are outlines,
because each waits on a decision named in its section.

## 1. Calls this contract makes

Each is open until the founder confirms it.

| | Call | Value |
| --- | --- | --- |
| B1 | One table for every public record | `PublicBusinessRecord`, one row per source record, whatever the source. **A new table: it needs the founder's approval** |
| B2 | What a phone-code proof earns | `government_verified`: the state's own record names that phone for that business |
| B3 | What a domain or mailed code earns | `document_verified`, and only together with a record or listing that names the same domain or address. On its own it raises the tier and unlocks nothing |
| B4 | Codes | Six digits, good for 10 minutes, 5 tries, 3 sends a day per business. Saved hashed |
| B5 | The phone on a record | Shown masked, never in full, until the claim is proved |
| B6 | Bad news | A suspension or a lapsed bond is shown only from the official record, only on an exact licence or business-number link, with its date |
| B7 | Two indexes, not one | The catalog's search file and the map index stay separate files and are joined when read |
| B8 | Who may claim | Any signed-in person may start. Nothing is granted until a proof passes |
| B9 | A second claimer | A record linked by a proof stays linked. Someone else must write to support; a reviewer can move it |

## 2. Rules

1. Owner names from a record are never sent to an app, never shown, and never
   used to contact anyone. They are read only by the claim check and the
   reviewer.
2. A record that looks like a home (the address check says so, or the type is
   home-based) shows no street address anywhere.
3. A fact is published only when its record is linked to the business by a
   licence number or business number. A name match alone publishes nothing.
4. Every published fact carries its source and the date the source was read.
5. A source's terms are written in `backend/config/publicRecordSources.js`
   beside its address, and a source with unread terms is not loaded.
6. Nothing is sent to a business that has not claimed.

## 3. Step 2: the contractor file (Washington and Oregon)

### 3.1 Data

```sql
CREATE TABLE public."PublicBusinessRecord" (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source            text NOT NULL,          -- 'wa_lni_contractor', 'or_ccb'
  source_id         text NOT NULL,          -- the licence number
  kind              text NOT NULL CHECK (kind IN ('contractor_licence','registration',
                      'health_credential','childcare_licence','liquor_licence','nonprofit','carrier')),
  name              text NOT NULL,
  name_folded       text NOT NULL,          -- for matching
  address           text, city text, state text, zipcode text,
  address_hash      varchar(64),
  phone_e164        text,
  website_domain    text,
  status            text,                   -- the source's own word, e.g. ACTIVE
  status_at         date,
  valid_from        date, valid_until date,
  identifiers       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { "ubi": "…", "licence": "…" }
  facts             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- bond, insurance, specialties
  private_people    jsonb NOT NULL DEFAULT '[]'::jsonb,   -- owner names; rule 1
  source_updated_at timestamptz,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  gone_at           timestamptz,            -- no longer in the source
  business_user_id  uuid REFERENCES public."User"(id) ON DELETE SET NULL,
  linked_at         timestamptz,
  link_method       text CHECK (link_method IN ('registry_phone_code','domain_code','mail_code','reviewer')),
  UNIQUE (source, source_id)
);
```

- Indexes: `name_folded` (the trigram index type, which the database already
  has); `phone_e164`; `(identifiers->>'ubi')`; `business_user_id`; `address_hash`.
- Row security on; all access through the server.
- `BusinessVerificationEvidence.evidence_type` also allows
  `registry_phone_code`, `domain_code` and `mail_code`. A code's hash, expiry
  and tries live in that row's `metadata`.
- Switch `business_claim`, off.

### 3.2 Loading

A job, `publicRecordsLoad`, once a day:

| Source | Read from | Fills |
| --- | --- | --- |
| Washington L&I, general | `data.wa.gov`, dataset `m8qx-ubtq` | Name, licence, type, specialties, address, phone, business number, status, dates |
| Washington L&I, principals | `4xk5-x9j6` | `private_people` |
| Washington L&I, insurance | `ciwg-agsx` | `facts.insurance` |
| Washington L&I, bond | `bzff-4fmt` | `facts.bond` |
| Oregon CCB | `data.oregon.gov`, dataset `g77e-6bhs` | The same, with bond and insurance in one row |

- Read in pages; write by `(source, source_id)`; a row missing from a full read
  gets `gone_at`, and is not deleted.
- A linked business's row that changes status, or whose bond or insurance
  changes, is noted for step 4's alerts.
- Runs on the worker with the other scheduled jobs. Off by default; the
  founder switches it on in production.

### 3.3 Finding

`GET /api/businesses/records/search?q=&state=&phone=&licence=`

Signed-in, rate-limited as the address check is. Answers up to 8:

```json
{ "id": "…", "kind": "contractor_licence", "name": "Lacamas Gutter Co",
  "city": "Camas", "state": "WA", "licence": "LACAMGC123AB",
  "status": "ACTIVE", "since": 2014, "phone_hint": "(360) •••-••42",
  "claimed": false, "source": "Washington L&I", "checked_on": "2026-11-11" }
```

No owner names, no full phone, no street for a home-like record.

### 3.4 Claiming

| Route | Does |
| --- | --- |
| `POST /api/businesses/:businessId/records/:recordId/claim` | Marks the intent. `409 record_linked` if another business holds it by proof |
| `POST …/claim/phone/start` | Sends the code to the record's phone by text, or by voice call on request |
| `POST …/claim/phone/confirm` `{ code }` | On a match: links the record, sets `government_verified` and the identity tier `bi4_authority`, and prefills empty fields of the page |

All three go through `actingForBusiness` with `profile.edit`.

Refusals, each with a plain sentence: `409 record_linked`, `422 no_phone_on_record`,
`429 too_many_codes`, `410 code_expired`, `403 wrong_code` (with tries left),
`503 could_not_send`.

After a link, the fee rules read the new status where they already do
(`getEffectiveFeeRate`, the founding offer). No fee code changes.

### 3.5 What the public page shows

`GET /api/businesses/public/:username` gains, with the switch on and a link by
licence or business number:

```json
"trust_lines": [
  { "kind": "licence",   "text": "Washington contractor licence LACAMGC123AB · Active since 2014", "state": "good" },
  { "kind": "bond",      "text": "Bond current · $30,000",   "state": "good" },
  { "kind": "insurance", "text": "Insurance current through March 2027", "state": "good" }
],
"trust_source": "Washington L&I", "trust_checked_on": "2026-11-11"
```

`state` is `good`, `warn` (expires within 30 days) or `bad` (B6).

### 3.6 Text messages

`backend/services/smsService.js` only logs today. It gains a real sender behind
`SMS_PROVIDER`, with the logging sender kept for local work. The provider, its
account and its key are the founder's steps.

### 3.7 Done when

- On a local backend with the Washington data loaded, a test business finds its
  record by name, by phone and by licence.
- A code sent to a test phone links the record; the page shows the three lines;
  the status is `government_verified`; the founding offer accepts it.
- A wrong code five times locks the attempt; a second business cannot take a
  linked record.
- No response to any non-reviewer contains an owner's name.
- Web, iPhone and Android each complete the claim against the same backend.

## 4. Step 3: find your business, for every kind

### 4.1 The catalog

Measured and designed in [the data design](07-data-design.md), which replaces
the outline that stood here. In short:

- **Source:** the United States part of Overture Places (18,445,349 places,
  2.15 GB, monthly). Foursquare Open Source Places joins when the founder has
  a token for it.
- **Built monthly** into a business file (one row per business, every fact
  with its source and date) and a search file, both kept in the catalog
  bucket (section 7). Duplicates are folded. Nothing is dropped for a low
  "does it exist" score: one in six listings that a state licence proves real
  scores under 0.5.
- **Read by the server from its own disk.** The search file is one SQLite
  file (7.6 GB) that answers a name near an address, a name anywhere in the
  country, a phone and a website. It replaces the planned file of map areas,
  which cannot search by name and took over a second in the densest city.
- **Ids:** every business has a Pantopus id that survives each rebuild, and
  remembers its source ids (`ovt:<Overture id>`, `fsq:<Foursquare id>`,
  licence numbers).

### 4.2 Finding

`GET /api/businesses/find?q=&lat=&lng=` answers one merged list, at most 8:
public records, catalog listings, and named places from the map index.

Two entries are one business when their names read as the same
(`businessNameMatch.js`, plus the rule for the state's shortened names) **and**
they share a phone or a street address. In the Clark County test those ties
were right 53 times in 53. A shared name alone is not a tie: it was wrong 19
times in 20. A shared phone alone is offered to the owner as "Is this also
you?" and publishes nothing. The test and the exact rule are in
[the data design, section 3](07-data-design.md#3-matching-tested-on-clark-county).

Picking one prefills the create form and saves, on the new business:
the location's `place_ref` when the pick has a map id (piece 2), and the
catalog ids in `BusinessProfile.attributes.catalog_ids`.

### 4.3 More proofs

| Proof | Routes | Earns |
| --- | --- | --- |
| Email at the business's domain | `POST …/claim/domain/start` `{ email }`, `…/confirm` | Identity tier `bi2_domain_social`. With a record or listing naming that domain: `document_verified` (B3). Free mail domains are refused |
| A mailed code | `POST …/claim/mail/start`, `…/confirm` | Location tier `bl3_presence_strong`. With a record or listing at that address: `document_verified` |

The mailed code uses the mail vendor layer the home postcard uses
(`backend/services/addressValidation/mailVendorService.js`), with its own
evidence row. The home verification tables are not touched.

### 4.4 Done when

- Typing a real café's name near its address offers it, on all three apps, and
  picking it fills the form.
- A domain code sent to a test mailbox and a mailed code read from the local
  mail vendor each complete, and each earns exactly the row above.

## 5. Step 4: the file

- `GET /api/businesses/:businessId/file` (staff with `profile.edit`): every
  fact Pantopus holds, each with its source, date and one of `found`,
  `confirmed`, `corrected`, `hidden`.
- `PATCH …/file` `{ key, action, value? }`: confirm, correct or hide a line.
  The owner's answers are kept in `BusinessProfile.attributes.file`, dated. A
  correction never changes what an official record says; it changes what the
  page says and is shown as the owner's.
- More sources join the loader, one at a time, each with its terms read first:
  the IRS list of exempt organizations, the national health provider file, the
  carrier census, childcare and liquor licences.
- A daily job, `businessFileAlerts`, tells a business's owners when a licence,
  bond or insurance ends within 30 days or a status changes. In the app and by
  push. Behind `business_file`.

**Done when:** an owner opens the file on each app, confirms one line, corrects
one and hides one, and each is still so after a relaunch; a bond set to end in
20 days produces one notice, once.

## 6. Steps 5 and 6: outlines

**Step 5, public listings and the rest of the country.** Unclaimed listings
become public pages, and search covers the country. It needs: a second table or
a search service (not chosen); the `business_directory` switch; a lawyer's read
of publishing listings nobody claimed; a "this is mine" and a "remove this"
path on every listing. Decided when the founder opens it.

**Step 6, proof on reviews.** A review shows "Paid customer" when the reviewer
has a paid line in `BusinessCustomer`. `Review` gains `paid_customer`, saved
when the review is written. Today a review must belong to a task (`gig_id` is
required), so a review after an invoice or a plan needs that rule loosened.
That is its own decision.

## 7. Files

One private bucket, named by `BUSINESS_CATALOG_BUCKET`, in the server's own
AWS region. The full layout, with measured sizes, is in
[the data design, section 5](07-data-design.md#5-where-everything-is-stored).

| Prefix | Holds | Size | Changed after writing |
| --- | --- | --- | --- |
| `raw/<source>/<release>/` | Each source exactly as fetched | Overture 2.15 GB a month; the contractor files 128 MB a day | Never |
| `built/<yyyymmdd>/` | The business file and the list of ids | About 3 GB (estimate) | Never; a new build is a new folder |
| `search/<yyyymmdd>/` | The search file the server copies to its disk | 3.35 GB compressed, 7.6 GB opened | Never |
| `search/current.json` | Which build the server reads | A few lines | By the build only |
| `reports/<yyyymmdd>.json` | What each build counted, and its hand check | A few lines | Never |

The server reads `search/` with its own key and keeps the current file on
its own disk (about 16 GB with room to swap). Nothing in the bucket is
public. The 18 million listings never enter the app's database. Creating the
bucket and its key, and making room on the server's disk, are the founder's
steps. About $2 a month at first and $5 after a year, at list prices.

## 8. Open questions

- Whether a contractor's phone on the state record is a phone they answer. The
  by-hand test asks five crews before the phone proof is built.
- The licence terms of the Washington bond dataset, which shows no label.
- ~~How many United States places the catalog holds, and how large the index
  is.~~ Measured: [the data design](07-data-design.md).
- Foursquare Open Source Places needs a free account and token, which is the
  founder's step. Until then the catalog is Overture alone.
- The server's disk size and memory, which the search file depends on.
- The text-message provider and its price.
- Whether the mail vendor is switched on in production.
