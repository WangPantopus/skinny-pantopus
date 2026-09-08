# Supabase migration automation runbook

How to stop applying database migrations by hand and have GitHub Actions apply
them to the hosted Supabase project every time a migration merges to `master`,
with a pull-request check that proves each migration applies cleanly first.

Every fact below was checked on **5 September 2026** against this repository,
the hosted project, the Supabase CLI source, and the Supabase and GitHub
documentation. Where a value comes from a probe run against a local Docker
Postgres it says so. Appendix D lists the documents and source files used.

| Checked against | Version |
|---|---|
| Supabase CLI installed on the Mac (Homebrew) | 2.98.2 (too old, see Phase 0) |
| Supabase CLI current release (npm `supabase`, GitHub release) | 2.116.0, 26 Aug 2026 |
| `supabase/setup-cli` GitHub Action | v3.0.0, 7 Jul 2026 |
| `actions/checkout` | v7.0.1, 20 Jul 2026 |
| GitHub `ubuntu-latest` runner image | Ubuntu 24.04, Docker 28.0.4, Node 22 |
| Local Postgres image the CLI starts | `public.ecr.aws/supabase/postgres:17.6.1.106` |
| Hosted project | one project, `Pantopus-backend`, West US (Oregon), created 22 Jan 2026 |

> **Supersedes** the "how to run" instructions in
> [`docs/seeder-deployment-guide.md`](seeder-deployment-guide.md),
> [`docs/phase-0-deployment-runbook.md`](phase-0-deployment-runbook.md) and
> [`docs/identity-firewall-migration-smoke-runbook-2026-05-05.md`](identity-firewall-migration-smoke-runbook-2026-05-05.md)
> that tell you to `psql -f` a migration file or paste it into the SQL editor.
> After Phase 1 below, applying SQL by hand without recording it breaks the
> automation (section 8.6 explains how to recover if you do).

---

## Contents

1. [Where you are today](#1-where-you-are-today)
2. [How the CLI decides what to run](#2-how-the-cli-decides-what-to-run)
3. [The plan in one page](#3-the-plan-in-one-page)
4. [Phase 0: prepare the machine and the project](#4-phase-0-prepare-the-machine-and-the-project)
5. [Phase 1: baseline production and adopt the ledger](#5-phase-1-baseline-production-and-adopt-the-ledger)
6. [Phase 2: repository hygiene](#6-phase-2-repository-hygiene)
7. [Phase 3: GitHub Actions](#7-phase-3-github-actions)
8. [Day-2 operations](#8-day-2-operations)
9. [Alternatives you could pick instead](#9-alternatives-you-could-pick-instead)
10. [Troubleshooting](#10-troubleshooting)
11. [Appendix A: file inventory](#appendix-a-file-inventory)
12. [Appendix B: command reference](#appendix-b-command-reference)
13. [Appendix C: acceptance checklist](#appendix-c-acceptance-checklist)
14. [Appendix D: sources](#appendix-d-sources)

---

## 1. Where you are today

These are the facts the plan is built on. Each was verified in the working
tree on 5 September 2026.

### 1.1 There is no CI at all

The repository has no `.github/` directory. Older documents in `docs/`
(`06-cron-job-migration-guide.md`, `BACKEND_CICD_EXECUTION_PLAN.md`, the
interview notes) describe `ci.yml`, `deploy-backend.yml` and a
`rollback-backend.yml`. Those lived in the previous React Native repository and
were never carried over. Every step in this runbook therefore starts from zero.

GitHub facts that matter: the repository `WangPantopus/skinny-pantopus` is
**public**, default branch `master`, no branch protection, Actions enabled with
all actions allowed. Public repositories get GitHub Actions minutes for free and
get deployment environments with protection rules on the Free plan.

### 1.2 One hosted project, and it is production

`supabase projects list` shows exactly one project in the `Pantopus` org:
`Pantopus-backend`, West US (Oregon). `backend/.env.dev` points at it,
`backend/.env` points at a local `supabase start` stack. There is no staging
project. The runbook is written for that shape: one target, so the pipeline
deploys to production directly and the safety comes from the pull-request check.
Section 9.3 covers adding a staging project later.

The local checkout is **not linked** (there is no `supabase/.temp/project-ref`).
The CLI is logged in (the Supabase access token is in the macOS keychain).

### 1.3 Two migration directories that are not mirrors

| | `supabase/migrations/` | `backend/database/migrations/` |
|---|---|---|
| Naming | `YYYYMMDDHHMMSS_name.sql` (CLI format) | `NNN_name.sql` (030 to 199) |
| Files | 179 SQL files, plus a `dev_patches/` subdirectory with 3 files | 178 SQL files |
| Applied by | nothing automated; `supabase db push` is mentioned in two docs as "option A" | `psql -f` by hand |

Matching them by logical name (the part after the prefix):

| Relationship | Count |
|---|---|
| Present in both directories | 92 |
| Only in `backend/database/migrations` (numbered) | 86 |
| Only in `supabase/migrations` (timestamped) | 87 |
| Present in both but with different SQL | 17 |

So neither directory is a complete history of production and neither can
regenerate the other. This is the single most important fact in the runbook:
**the baseline must come from the live database, not from either directory.**

### 1.4 The timestamped stream cannot rebuild a database from scratch

The first timestamped migration, `20260222000000_profile_visibility.sql`,
runs `ALTER TABLE "public"."User"`. Nothing in either directory creates
`"User"`: the numbered series starts at 030, and the 001 to 029 files that built
the base schema are gone. `backend/database/schema.sql` is a `pg_dump` snapshot
whose own header says it is frozen, not applied by anything, and missing the
Phase 0 tables.

Consequence: `supabase db reset` (local) and `supabase db start` (CI) fail on
the very first file, and so would a Supabase preview branch. Probe G
(section 2.5) ran today's stream against a fresh Postgres 17 container:

```
Applying migration 20260222000000_profile_visibility.sql...
Stopping containers...
ERROR: relation "public.User" does not exist (SQLSTATE 42P01)
At statement: 0
```

One file attempted, zero applied, and `supabase db start` removed the
container on the way out. Section 5 fixes this with a baseline.

### 1.5 Eight version prefixes are duplicated

The CLI keys its ledger on the 14-digit prefix and that column is the primary
key. These prefixes each belong to two or three files:

```
20260310000001  add_geocode_provenance, browse_listings_by_distance, chat_rls_enforce_active
20260310000002  atomic_inventory_cap, message_reaction_rls_indexes
20260317000005  home_address_validation_contract_fix, mail_escrow
20260318000001  home_seasonal_checklist_bill_benchmark, user_referral
20260404000001  home_household_claim_phase1, seeder_curator_account_tables
20260405000001  clear_home_dispute_flags, home_household_access_request, seeder_queue_media_columns
20260405000002  dynamic_regions, payment_home_id_on_delete_set_null
20260508000001  collapse_persona_follow_into_membership, support_train_effective_slot_availability
```

Probe A (section 2.5) shows what the CLI does with these: it applies the first
file, then the second file's ledger insert fails with a primary-key violation
and the second file's DDL is rolled back. The baseline in Phase 1 retires all of
these files, so they never need renaming.

### 1.6 Smaller facts you will trip over

- `supabase/config.toml` has `[db.seed] enabled = true, sql_paths = ["./seed.sql"]`
  but `supabase/seed.sql` does not exist. The CLI only warns
  (`WARN: no files matched pattern: supabase/seed.sql`, observed). Section 6.3
  decides what to do with it.
- `supabase/config.toml` has `[db] major_version = 17`. The hosted project's
  version must match; Phase 0 checks it.
- `supabase/migrations/dev_patches/` holds three one-off patches for developer
  databases. Probe B (section 2.5) shows the CLI ignores subdirectories
  **silently**, with no warning, so nothing in there has ever run through the
  CLI. They are not migrations; Phase 1 archives them with everything else.
- Two Jest tests read migration files by path:
  `backend/tests/unit/addressCalendarSeeds.test.js` reads
  `backend/database/migrations/195_*` and `197_*` (unaffected by this plan), and
  `backend/tests/unit/identityFirewallRegression.test.js` lines 393 and 407 read
  `supabase/migrations/20260505000001_identity_firewall_personas.sql`, which
  Phase 1 moves. Phase 2 updates those two lines.
- The migrations use `CREATE EXTENSION IF NOT EXISTS` for `btree_gist`,
  `pg_trgm` and `postgis`. All three ship in the Supabase Postgres image.
- One archived migration uses `CREATE INDEX CONCURRENTLY`
  (`20260310000006_chat_message_pagination_index.sql`) and two use
  `ALTER TYPE ... ADD VALUE`. Section 8.2 explains how to write those in future.
- `supabase/.gitignore` already ignores `.temp` and `.branches`, which is where
  `supabase link` writes the project ref and pooler URL. Keep it that way.

---

## 2. How the CLI decides what to run

You will debug this pipeline at some point, so it is worth knowing the exact
rules. Everything here is from the CLI source
([`supabase/cli`](https://github.com/supabase/cli), main branch on 4 Sep 2026,
files `apps/cli-go/pkg/migration/*.go`) unless marked "observed", which means a
probe against a local Docker Postgres produced it.

### 2.1 The ledger

The remote database keeps the record of what has been applied in
`supabase_migrations.schema_migrations`:

```
version    text   NOT NULL PRIMARY KEY   -- the digits before the first underscore
name       text                          -- the rest of the filename without .sql
statements text[]                        -- every statement the file contained
```

The CLI creates the schema and table the first time it needs them
(`CREATE SCHEMA IF NOT EXISTS supabase_migrations` and so on, with a 4 second
`lock_timeout`). The Dashboard's **Database > Migrations** page reads this
table.

### 2.2 Which files count

A file counts as a migration when its basename matches the regular expression
`^([0-9]+)_(.*)\.sql$` and it sits directly in `supabase/migrations/`. The
digits become `version`, the rest becomes `name`. The CLI does not require
exactly 14 digits, but mixing lengths breaks ordering, so this runbook and the
guard script insist on 14.

A top-level file that does not match is reported and skipped, on both
`migration list` and `db reset` (observed):

```
Skipping migration notes.sql... (file name must match pattern "<timestamp>_name.sql")
```

A file inside a subdirectory produces nothing at all: no line, no warning, no
row in `migration list`. It simply never runs (Probe B).

### 2.3 What is pending

`supabase db push` reads the local versions (sorted) and the remote versions
(sorted) and walks both lists:

- Local versions not on the remote and newer than every remote version are
  **pending** and get applied in order.
- A remote version with no local file aborts with
  `Remote migration versions not found in local migrations directory.`
  Fix: restore the file, or `supabase migration repair --status reverted <version>`.
- A local file whose version is **older** than the newest remote version aborts
  with `Found local migration files to be inserted before the last migration on remote database.`
  followed by `Rerun the command with --include-all flag to apply these migrations:`
  and the file path, exit code 1, nothing applied (Probe F). Fix: rename the
  file to a newer timestamp, or push with `--include-all`.

`--dry-run` prints `DRY RUN: migrations will *not* be pushed to the database.`
followed by `Would push these migrations:` and the list. When nothing is
pending it prints `Remote database is up to date.` (observed with `--db-url`;
the noun may differ for `--linked`) and exits 0. A dry run
performs the same pending calculation as a real push, so it exits 1 on the
out-of-order case above (observed), which is why the deploy workflow runs it as
a separate step before the push. A dry run only lists files; it does not
execute or validate their SQL (that is what the pull-request check in Phase 3
is for).

### 2.4 How one file is applied

For each pending file, in order:

1. `RESET ALL` on the connection, so settings from the previous file do not leak.
2. The file is split into statements and sent as **one pipelined batch**, with
   the `INSERT INTO supabase_migrations.schema_migrations` appended as the last
   statement of the same batch. Postgres treats a pipelined batch as one
   implicit transaction: if any statement fails, every statement before it in
   that file is rolled back and no ledger row is written. Probe D (section 2.5)
   confirms this on the installed CLI.
3. Some statements refuse to run inside a transaction:
   `CREATE INDEX CONCURRENTLY`, `DROP INDEX CONCURRENTLY`,
   `REINDEX ... CONCURRENTLY`, `VACUUM`, `ALTER SYSTEM`, `CLUSTER`. Postgres
   accepts such a statement in a pipeline only when it is the **first**
   statement of the batch. On the installed 2.98.2 that is exactly what you
   get (Probe E): a file whose only statement is `CREATE INDEX CONCURRENTLY`
   succeeds; the same statement in second position fails with
   `CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)`
   and nothing is applied. CLI 2.116.0 detects these statements and executes
   each one on its own, outside the batch, wherever it sits in the file
   (PR 6009, August 2026). What neither version can do is roll it back: the
   index commits immediately, so if a later statement in the same file fails
   you keep the index and get no ledger row (Probe E4). Consequence for you:
   such a statement goes in its own migration file, alone, with
   `IF NOT EXISTS`.

The CLI sets no `statement_timeout` of its own. It connects as `postgres`, and
Supabase's platform default caps that role at 2 minutes per statement. Long
backfills need `SET LOCAL statement_timeout` at the top of the file
(section 8.2).

### 2.5 Probe results (local Docker, CLI 2.98.2, Postgres 17.6)

Each probe ran in a throwaway project under the session scratch directory,
never against the hosted project.

**Probe A, duplicate versions.** Two files `20250101000001_a.sql` and
`20250101000001_b.sql`. `supabase migration list --local` lists the version
twice. `supabase db reset` applied `a`, then failed on `b` with:

```
Applying migration 20250101000001_a.sql...
Applying migration 20250101000001_b.sql...
ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505)
Key (version)=(20250101000001) already exists.
At statement: 1
INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES($1, $2, $3)
```

Afterwards table `a` existed, table `b` did not, and the ledger held one row
(`20250101000001 | a`). The same happened with `supabase migration up` and with
`supabase db push --db-url`. So a duplicate is not "harmless, both run": the
second file is silently lost until someone reads the error.

**Probe B, files in a subdirectory or without a numeric prefix.** Four
entries: `20250101000002_c.sql`, `dev_patches/099_patch.sql`, `notes.sql`,
`20250101000002_c.sql.bak`. `migration list --local` and `db reset` both
printed `Skipping migration 20250101000002_c.sql.bak... (file name must match pattern "<timestamp>_name.sql")`
and the same for `notes.sql`, printed nothing about the subdirectory, applied
only `c`, and exited 0. Only table `c` existed afterwards.

**Probe C, missing seed file.** With `[db.seed]` pointing at a file that does
not exist, `supabase db reset` prints
`WARN: no files matched pattern: supabase/seed.sql` and continues (exit 0).
With a one-line `seed.sql` present it prints `Seeding data from supabase/seed.sql...`
and the row appears. `db push` with nothing pending prints
`Remote database is up to date.` and does not seed, even with `--include-seed`.

**Probe D, a failing statement in the middle of a file.** File
`20250101000003_fail.sql` with `CREATE TABLE d(id int);`,
`INSERT INTO d VALUES (1);`, `INSERT INTO d VALUES ('not-an-int');`.
`db push` exited 1 with:

```
Applying migration 20250101000003_fail.sql...
ERROR: invalid input syntax for type integer: "not-an-int" (SQLSTATE 22P02)
At statement: 2
INSERT INTO d VALUES ('not-an-int')
                      ^
```

Table `d` did not exist afterwards and the ledger had no row for the version:
the whole file rolled back. (`At statement:` counts from 0.) `migration up`
produced the identical error. After the file was fixed, the next push applied
it and recorded it.

**Probe E, `CREATE INDEX CONCURRENTLY` on the installed 2.98.2.** As the only
statement in a file: success, index built, ledger row written. As the second
statement after a plain `CREATE INDEX`:
`ERROR: CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)`,
nothing applied. As the first statement followed by a failing `INSERT`: the
insert error was reported, no ledger row was written, and the index
**remained**. Section 2.4 draws the rule.

**Probe F, an out-of-order file and `--include-all`.** With versions
`...0002`, `...0003`, `...0004` applied and a new `20250101000000_late.sql`:

```
$ supabase db push --db-url ... --dry-run          # exit 1
DRY RUN: migrations will *not* be pushed to the database.
Found local migration files to be inserted before the last migration on remote database.

Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20250101000000_late.sql
```

A plain push gave the same error and applied nothing. With
`--include-all --yes` the prompt was auto-answered `y`, the file was applied,
and the ledger then listed `20250101000000` first. A dry run with nothing
pending printed `Remote database is up to date.` and exited 0.

**Probe G, this repository's timestamped stream from scratch.** A copy of
`supabase/config.toml` and all 179 files plus `dev_patches/` in a throwaway
project. `migration list --local` showed 179 rows, the eight duplicate
versions as repeated identical rows, no warning, and nothing for
`dev_patches/`. `supabase db start` and `supabase db reset` both failed on the
first file with `relation "public.User" does not exist` (the output is in
section 1.4); `db start` then removed its own container. Ledger count after the
failed reset: 0.

**Probe H, versions.** CLI 2.98.2; container image
`public.ecr.aws/supabase/postgres:17.6.1.106` reporting PostgreSQL 17.6; the
Mac's psql client is 18.3 and worked against it.

### 2.6 How the CLI reaches the hosted database

`supabase link --project-ref <ref>` calls the Management API with your access
token, saves the project ref and the project's **pooler** connection string
under `supabase/.temp/`, and validates settings. `supabase db push` then:

1. tries the direct host `db.<ref>.supabase.co:5432` with a 5 second TCP dial.
   That host is IPv6-only unless you buy the IPv4 add-on;
2. if the dial fails, uses the saved pooler connection (Supavisor,
   **session mode, port 5432**, IPv4), with the password from
   `SUPABASE_DB_PASSWORD`.

GitHub-hosted runners have no IPv6, so in CI step 2 is the path that runs, after
a 5 second pause. No add-on is needed. If `SUPABASE_DB_PASSWORD` is unset, CLI
builds from mid-2026 try to mint a temporary login role through the Management
API instead (the "Temporary token-based database access" feature preview,
Postgres 17 projects only). This runbook stores the password; the temporary-role
path is an option, not the default.

Things that break this path:

- **Network Restrictions** turned on in the Dashboard (Settings > Database).
  They apply to the pooler too, and GitHub runner IPs are not enumerable in a
  useful way. Leave restrictions off, or move the deploy job to a self-hosted
  runner with a fixed IP.
- Resetting the database password in the Dashboard. Supabase services update
  automatically, external clients do not: the GitHub secret, and any
  `DATABASE_URL` in your backend `.env` files or on the EC2 host, must be
  updated by hand.

### 2.7 Prompts in CI

When `db push` has something to apply it asks
`Do you want to push these migrations to the remote database? [Y/n]`. Without a
terminal the CLI reads one line from stdin with a 100 ms timeout and falls back
to the default (yes); Probe D shows the prompt printed and the push proceeding
with no `--yes` and no terminal. Pass `--yes` anyway, or set
`SUPABASE_YES=true`, so the behaviour is explicit in the log rather than a
timeout.

---

## 3. The plan in one page

| Phase | What changes | Manual work afterwards |
|---|---|---|
| 0. Prepare | Upgrade the CLI to 2.116.0, link the repo, read the remote ledger, check the Postgres version, take a backup | none |
| 1. Baseline | Move the 179 timestamped files and `dev_patches/` to an archive folder, dump the production schema into one new migration, mark it applied, prove the new stream rebuilds a database from scratch | none |
| 2. Hygiene | Add the guard script, decide the seed file, fix the two test paths, freeze the numbered directory as history, document the new rules | none |
| 3. Actions | Two workflows: a pull-request check (guard + from-scratch apply) and a deploy on merge to `master` (link, dry run, push) bound to a `production` environment | one click per deploy if you keep the approval gate; zero if you do not |
| Day 2 | Write new migrations with `supabase migration new`, open a PR, merge | none |

Design decisions, so you do not have to re-derive them later:

- **D1. `supabase/migrations/` is the only runnable stream.** The numbered
  directory becomes read-only history. Nothing else the CLI could consume
  exists, and the two directories already disagree on 190 of 265 logical
  migrations.
- **D2. The baseline is a dump of production**, because neither directory can
  reproduce the live schema (section 1.3 and 1.4). Old files are archived, not
  deleted, so `git log` and the docs that cite them keep working.
- **D3. Deploy from GitHub Actions, not from Supabase Branching.** Branching's
  GitHub integration would also deploy on merge, but it requires the migration
  stream to build from scratch (true only after Phase 1), bills preview
  branches per hour, and adds a second control plane. Section 9 keeps it as an
  option.
- **D4. Secrets live in a GitHub *environment* named `production`**, not at
  repository level. Only the deploy job binds to that environment, so the
  pull-request job (which also runs for forks of a public repo) can never read
  the database password.
- **D5. Never commit production data.** The repository is public. The seed
  file, if any, holds hand-picked reference rows only.
- **D6. Pin the CLI to the same version locally and in CI** (2.116.0 today) and
  bump both together.

---

## 4. Phase 0: prepare the machine and the project

Everything in this phase is read-only against production except the backup.

### 4.1 Upgrade the CLI

2.98.2 predates three changes this runbook relies on or benefits from: the
pipeline-incompatible statement handling (PR 6009, Aug 2026), the
non-interactive confirm fixes that came with the native `db pull` port
(PR 5725, Jul 2026) and the automatic pooler retry for `db dump` and `db pull`
on IPv4-only networks (PR 5493, Jun 2026).

```bash
brew upgrade supabase && supabase --version
```

Expected: `2.116.0` or newer. Write the number down; Phase 3 pins CI to it.

### 4.2 Make sure Docker Desktop is running

`supabase db start`, `supabase db reset` and (on some versions) `supabase db dump`
use containers. Open Docker Desktop and wait for `docker info` to succeed.

Note from the verification run: the probes launched Docker Desktop themselves,
which auto-started the `supabase_*_pantopus` containers from an earlier
`supabase start`; the probe stopped them to free the ports. They are stopped
now. `supabase start` from the repo root brings them back.

### 4.3 Link the repository to the hosted project

```bash
cd /Users/yingpengwang/skinny-pantopus
supabase projects list          # copy the REFERENCE ID of Pantopus-backend
supabase link --project-ref <ref>
```

`link` asks for the database password. If you do not know it, reset it first
(Dashboard > Project Settings > Database > **Reset database password**) and
then update every place that embeds it: `backend/.env.dev` (`DATABASE_URL`),
the EC2 host's `.env`, and anything in `pantopus-seeder` that connects directly.
You can also export `SUPABASE_DB_PASSWORD='...'` before running `link` to skip
the prompt.

`link` may print `WARNING: Local config differs from linked project.` That is
informational; nothing in this runbook pushes `config.toml`.

### 4.4 Check the Postgres major version

Dashboard > Project Settings > General shows the Postgres version, or run in the
SQL editor:

```sql
show server_version;
```

It must start with `17`, because `supabase/config.toml` says `major_version = 17`
and the CI check starts a Postgres 17 container. If production is 15, change the
config to 15 until you upgrade the project; a mismatched major version makes the
from-scratch check meaningless.

### 4.5 Read the remote ledger

```bash
supabase migration list --linked
```

The table has `Local | Remote | Time (UTC)` columns. Note what the **Remote**
column contains:

- **Empty** (or the command says the `supabase_migrations.schema_migrations`
  relation does not exist): production has never been touched by `db push`.
  Phase 1 starts from a clean ledger.
- **Some versions**: someone ran `db push` at some point. Copy the list; Phase 1
  step 5.2 reverts those entries so the new stream starts clean.

Also run this in the SQL editor to see the same data with names:

```sql
select version, name from supabase_migrations.schema_migrations order by version;
```

### 4.6 Take a backup you control

The project is on the Free plan unless you upgraded it: Free projects get **no
automatic backups**; Pro ($25/month) keeps 7 daily backups; Point-in-Time
Recovery is an add-on at about $100/month per 7 days of retention. Before
changing anything about how production is managed, take a logical dump to your
Mac (not into the repo, and never into a GitHub artifact of a public repo):

```bash
mkdir -p ~/pantopus-backups
supabase db dump --linked -f ~/pantopus-backups/schema-$(date +%F).sql
supabase db dump --linked --data-only --use-copy -f ~/pantopus-backups/data-$(date +%F).sql
```

The schema dump is what Phase 1 turns into the baseline. The data dump contains
personal data; keep it encrypted or delete it once the baseline is verified.

---

## 5. Phase 1: baseline production and adopt the ledger

Do this on a branch, in one sitting, with nobody else applying SQL. Nothing in
this phase changes the production schema; it only changes files in the repo and
rows in the ledger table.

### 5.1 Archive the current timestamped files

```bash
git checkout -b db/adopt-supabase-cli
git mv supabase/migrations supabase/migrations-archive
mkdir supabase/migrations
```

`supabase/migrations-archive/` keeps all 179 files and `dev_patches/` exactly as
they were. The CLI only reads `supabase/migrations/`, so the archive is inert.
The numbered directory `backend/database/migrations/` is untouched.

### 5.2 Clear any old ledger rows

Skip this step if the Remote column in section 4.5 was empty.

Otherwise every remote version must go, because after the archive there is no
local file for it and `db push` would refuse to run (section 2.3). `repair`
accepts several versions in one call and `--status reverted` only deletes rows:

```bash
supabase migration repair --linked --status reverted 20260222000000 20260226000000 ...
```

Re-run `supabase migration list --linked` until the Remote column is empty.

### 5.3 Dump the production schema as the baseline migration

Pick a version later than anything that ever existed (the newest archived file
is `20260902000002`):

```bash
supabase db dump --linked -f supabase/migrations/20260905000000_baseline_production_schema.sql
```

`db dump` without flags is schema-only and skips the `auth`, `storage` and
extension-owned schemas and custom roles. That is what you want: those schemas
are managed by Supabase and exist in every project and in the local container.

Now read the file once, top to bottom. Things to check:

1. **No psql meta-commands.** Lines starting with a backslash (`\restrict`,
   `\unrestrict`, `\connect`) are psql syntax; the CLI does not use psql and
   would fail on them. Delete them. The guard script in Phase 2 catches this
   for you in future.
2. **Extensions.** Expect `CREATE EXTENSION IF NOT EXISTS "btree_gist"`,
   `"pg_trgm"` and `"postgis"` near the top, usually `WITH SCHEMA "extensions"`.
   If they are missing, add them at the top of the file.
3. **Objects that live in the excluded schemas.** Foreign keys to
   `"auth"."users"` are fine (the local image ships that table). A trigger *on*
   `auth.users`, a storage bucket policy, or a `cron.schedule(...)` call would
   not be in the dump. Search the archive for them:

   ```bash
   grep -l -E 'ON "?auth"?\."?users|storage\.(buckets|objects)|cron\.schedule' supabase/migrations-archive/*.sql
   ```

   Anything that matches goes into a second file,
   `20260905000001_baseline_auth_storage.sql`, written by hand from those
   migrations.
4. **Data.** The dump has none. Rows that older migrations inserted (feature
   flags, seeder sources, calendar rules, sports events) are in production
   already, so the deploy path does not need them. The from-scratch check and
   local development do; section 6.3 handles that with a seed file.

### 5.4 Prove the baseline rebuilds a database

```bash
supabase stop --no-backup      # if a local stack is running
supabase db start              # fresh Postgres 17, applies supabase/migrations/*
```

Expected output ends without an error and includes
`Applying migration 20260905000000_baseline_production_schema.sql...`. Then
compare object counts with production:

```sql
-- run locally (psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
-- and in the production SQL editor; the numbers should match
select count(*) filter (where table_schema='public' and table_type='BASE TABLE') as tables,
       (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
       (select count(*) from pg_policies where schemaname='public') as policies
from information_schema.tables;
```

If the local apply fails, fix the baseline file (usually a missing extension or
an object from an excluded schema, see 5.3) and run `supabase db reset`. Repeat
until it is clean. Do not touch production to make the file work.

Then run the backend test suite once against the local stack to be sure the
schema the app expects is really there:

```bash
cd backend && pnpm test
```

### 5.5 Record the baseline as applied on production

```bash
supabase migration repair --linked --status applied 20260905000000
# and 20260905000001 if you created the auth/storage file
```

`repair --status applied` reads the local file, then upserts its version, name
and statements into the ledger. It does not execute the SQL. Expected output:
`Repaired migration history: [20260905000000] => applied`.

### 5.6 Verify production sees nothing to do

```bash
supabase migration list --linked      # one row, present in both columns
supabase db push --linked --dry-run   # "... is up to date."
```

Both must be clean before you continue. The Dashboard's Database > Migrations
page shows the same single row.

### 5.7 Commit

```bash
git add supabase/migrations supabase/migrations-archive
git commit -m "DB: baseline production schema; archive pre-CLI migrations"
```

Do not merge yet. Phase 2 goes into the same branch.

---

## 6. Phase 2: repository hygiene

### 6.1 The guard script

Create `scripts/db/check-migrations.sh` (mode 755). It never touches a
database; it fails a pull request when someone re-creates one of the problems
in section 1.

```bash
#!/usr/bin/env bash
# scripts/db/check-migrations.sh
#
# Static guard for supabase/migrations. Runs in CI on every pull request and
# locally before you push. It never touches a database.
#
# Fails (exit 1) when:
#   1. two files share the same 14-digit version prefix (the CLI keys its
#      ledger on that prefix, so the second file can never be recorded);
#   2. anything is in supabase/migrations that is not a <14 digits>_<name>.sql
#      file at the top level (subdirectories and stray files are ignored by
#      the CLI, which means they silently never run);
#   3. a migration newer than the baseline contains a psql meta-command
#      (a line starting with a backslash); the CLI does not use psql.
#
# Warns (exit 0) when a migration newer than the baseline
#   - uses CREATE/DROP INDEX CONCURRENTLY, VACUUM, REINDEX CONCURRENTLY,
#     CLUSTER or ALTER SYSTEM together with other statements (put it alone in
#     its own file, see the runbook section 8.2);
#   - sets no lock_timeout.
#
# Usage: scripts/db/check-migrations.sh [--baseline <14-digit version>]
#        BASELINE_VERSION env var is honoured too. Files with a version
#        <= baseline are skipped by check 3 and the warnings.

set -euo pipefail

MIGRATIONS_DIR="${MIGRATIONS_DIR:-supabase/migrations}"
BASELINE_VERSION="${BASELINE_VERSION:-0}"
if [[ "${1:-}" == "--baseline" ]]; then BASELINE_VERSION="$2"; fi

fail=0
say_fail() { echo "FAIL: $*"; fail=1; }
say_warn() { echo "WARN: $*"; }

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "FAIL: $MIGRATIONS_DIR does not exist"; exit 1
fi

list_migrations() {  # basenames of top-level <digits>_*.sql files, sorted
  find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type f -name '[0-9]*_*.sql' -exec basename {} \; | sort
}

# --- 1. duplicate version prefixes -------------------------------------------
dups=$(list_migrations | cut -c1-14 | sort | uniq -d || true)
for v in $dups; do
  say_fail "duplicate version $v: $(list_migrations | grep "^${v}_" | tr '\n' ' ')"
done

# --- 2. only top-level <14 digits>_<name>.sql files ---------------------------
while IFS= read -r entry; do
  name=$(basename "$entry")
  if [[ -d "$entry" ]]; then
    say_fail "subdirectory $name inside $MIGRATIONS_DIR (the CLI ignores it; move it out)"
  elif [[ ! "$name" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    say_fail "$name does not match <14 digits>_<snake_case>.sql (the CLI ignores it)"
  fi
done < <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' ! -name 'README.md')

# --- 3. per-file checks on post-baseline files --------------------------------
for f in "$MIGRATIONS_DIR"/[0-9]*.sql; do
  [[ -e "$f" ]] || continue
  v=$(basename "$f" | cut -c1-14)
  [[ "$v" > "$BASELINE_VERSION" ]] || continue
  if grep -qE '^\s*\\' "$f"; then
    say_fail "$(basename "$f") contains a psql meta-command (line starting with \\); supabase db push does not use psql"
  fi
  special=$(grep -ciE '^\s*(CREATE\s+(UNIQUE\s+)?INDEX\s+CONCURRENTLY|DROP\s+INDEX\s+CONCURRENTLY|REINDEX\b.*CONCURRENTLY|VACUUM\b|CLUSTER\b|ALTER\s+SYSTEM\b)' "$f" || true)
  total=$(grep -cE ';\s*$' "$f" || true)
  if [[ "$special" -gt 0 && "$total" -gt "$special" ]]; then
    say_warn "$(basename "$f") mixes a non-transactional statement (CONCURRENTLY/VACUUM/...) with other statements; put it alone in its own migration"
  fi
  if ! grep -qiE 'lock_timeout' "$f"; then
    say_warn "$(basename "$f") sets no lock_timeout (add: set local lock_timeout = '5s'; at the top)"
  fi
done

if [[ $fail -ne 0 ]]; then
  echo; echo "check-migrations: FAILED"; exit 1
fi
echo "check-migrations: OK ($(list_migrations | grep -cE '^[0-9]{14}_') migration files, baseline $BASELINE_VERSION)"
```

Run it against the tree as it was before Phase 1 and it reports the eight
duplicates and the `dev_patches` directory (this output is from the real
tree, 4 September 2026):

```
FAIL: duplicate version 20260310000001: 20260310000001_add_geocode_provenance.sql 20260310000001_browse_listings_by_distance.sql 20260310000001_chat_rls_enforce_active.sql
...
FAIL: duplicate version 20260508000001: 20260508000001_collapse_persona_follow_into_membership.sql 20260508000001_support_train_effective_slot_availability.sql
FAIL: subdirectory dev_patches inside supabase/migrations (the CLI ignores it; move it out)

check-migrations: FAILED
```

After Phase 1 it prints `check-migrations: OK (1 migration files, baseline 20260905000000)`.

Add a root `package.json` script so the command is memorable:

```json
"db:check": "scripts/db/check-migrations.sh --baseline 20260905000000"
```

### 6.2 Fix the two test paths

`backend/tests/unit/identityFirewallRegression.test.js` reads the timestamped
identity-firewall file at lines 393 and 407. Change

```js
path.resolve(__dirname, '../../../supabase/migrations/20260505000001_identity_firewall_personas.sql')
```

to

```js
path.resolve(__dirname, '../../../supabase/migrations-archive/20260505000001_identity_firewall_personas.sql')
```

and run `cd backend && pnpm test -- tests/unit/identityFirewallRegression.test.js`.
`addressCalendarSeeds.test.js` reads numbered files and needs no change.

### 6.3 Decide the seed file

`supabase db start` in CI and on your Mac applies `supabase/migrations/*` and
then the files in `[db.seed].sql_paths`. Today that is a missing `seed.sql`,
which only warns. Pick one:

- **Nothing.** Leave it missing. Local databases start empty; the backend still
  boots. Cheapest, and correct for the deploy path (production already has its
  data).
- **Curated reference data (recommended once you use local dev seriously).**
  Create `supabase/seed.sql` by hand with the rows the app needs to function:
  `FeatureFlag` defaults, `seeder_config` and `seeder_sources`,
  `AddressCalendarRule` state rules. Take them from the archived migrations that
  inserted them (`grep -l 'INSERT INTO' supabase/migrations-archive/*.sql`),
  never from a production data dump: the repository is public. Make every
  statement idempotent (`ON CONFLICT DO NOTHING`).

Whatever you choose, `db push` never runs the seed unless you pass
`--include-seed`, and even then only when it also has migrations to apply
(Probe C). The deploy workflow never passes it.

### 6.4 Freeze the numbered directory

Add `backend/database/migrations/README.md`:

```markdown
# Archived: numbered migrations (030 to 199)

Read-only history. Nothing applies these files any more. Production is managed
by the Supabase CLI from `supabase/migrations/`; see
`docs/supabase-migration-automation-runbook.md`. Two unit tests still read
195_* and 197_* as data fixtures; do not delete those.
```

New migrations do **not** get a numbered twin. If you like the numbered
reference in a header comment, keep writing `-- Migration 200: ...` inside the
timestamped file; the number is documentation, not a filename.

Also add `supabase/migrations-archive/README.md` with the same message and a
pointer to the baseline version.

### 6.5 Migration template

Every new migration starts from this. `supabase migration new` creates an empty
file; paste this in.

```sql
-- <what and why, one paragraph>
-- Backwards compatible with the currently deployed backend: yes/no (if no,
-- say which backend commit must be deployed first).

set local lock_timeout = '5s';          -- give up instead of queueing behind a long query
-- set local statement_timeout = '30min'; -- only for backfills; the platform default for the postgres role is 2 minutes

-- DDL here. Prefer IF NOT EXISTS / IF EXISTS so a re-run after a partial
-- failure is harmless.
```

`set local` works because the CLI runs the file inside one implicit
transaction (section 2.4) and connects through Supavisor in session mode, which
honours session settings.

### 6.6 Commit and open the pull request

```bash
git add scripts/db backend/tests/unit/identityFirewallRegression.test.js backend/database/migrations/README.md supabase/migrations-archive/README.md package.json
git commit -m "DB: migration guard script, archive READMEs, test paths"
git push -u origin db/adopt-supabase-cli
gh pr create --fill
```

Merge it after Phase 3 is also on the branch, so the first CI run exercises the
final layout.

---

## 7. Phase 3: GitHub Actions

Two workflows. The first runs on every pull request and never has secrets. The
second runs on merge to `master`, holds the secrets, and applies migrations.

### 7.1 Create the GitHub environment and secrets

Dashboard first:

1. **Access token.** Supabase Dashboard > Account > **Access Tokens**
   (`https://supabase.com/dashboard/account/tokens`) > Generate new token.
   Name it `github-actions-migrations`, set an expiry you will remember to
   renew, copy the `sbp_...` value. A personal access token carries the same
   privileges as your account across every org and project, so treat it like
   your password.
2. **Project ref.** The 20-character id in the project URL
   (`https://supabase.com/dashboard/project/<ref>`), also shown by
   `supabase projects list`.
3. **Database password.** The one you used in section 4.3.

Then GitHub, repository **Settings > Environments > New environment**, name
`production`, and inside it:

- **Environment secrets**: add `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`,
  `SUPABASE_PROJECT_ID` with the three values above.
- **Deployment branches and tags**: *Selected branches and tags* > add rule
  `master`. This is what stops a workflow on any other branch from ever
  reaching production, even if someone edits the YAML.
- **Required reviewers** (optional): add yourself. Every deploy then waits for
  one click under the run's *Review deployments* button. Keep it on for the
  first few migrations, then remove it if you want merges to deploy with no
  human step. GitHub Free supports these rules for public repositories.

Do not create repository-level secrets with the same names; the environment
ones are the only copy.

Also under **Settings > Actions > General**, set *Workflow permissions* to
*Read repository contents and packages permissions*. The workflows below also
set `permissions: contents: read` themselves.

### 7.2 Pull-request check: `.github/workflows/db-migrations-check.yml`

```yaml
# .github/workflows/db-migrations-check.yml
name: DB migrations check

on:
  pull_request:
    paths:
      - "supabase/migrations/**"
      - "supabase/config.toml"
      - "supabase/seed.sql"
      - "scripts/db/**"
      - ".github/workflows/db-migrations-check.yml"
  push:
    branches: [master]
    paths:
      - "supabase/migrations/**"
      - "supabase/config.toml"
      - "supabase/seed.sql"
      - "scripts/db/**"
      - ".github/workflows/db-migrations-check.yml"

permissions:
  contents: read

env:
  SUPABASE_CLI_VERSION: "2.116.0"   # keep equal to `supabase --version` on your Mac
  BASELINE_VERSION: "20260905000000"

jobs:
  guard:
    name: Static guard
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: Check migration filenames and contents
        run: scripts/db/check-migrations.sh --baseline "$BASELINE_VERSION"

  apply-from-scratch:
    name: Apply all migrations to a fresh Postgres
    runs-on: ubuntu-latest
    needs: guard
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7

      - uses: supabase/setup-cli@v3
        with:
          version: ${{ env.SUPABASE_CLI_VERSION }}

      # `supabase db start` boots only the Postgres container, applies every
      # file in supabase/migrations in order, then runs the seed files from
      # config.toml. Docker is preinstalled on ubuntu-latest.
      - name: Start Postgres and apply migrations
        env:
          # config.toml references these with env(...); the CLI only warns when
          # they are unset, but empty values keep the log clean.
          SUPABASE_AUTH_EXTERNAL_APPLE_CLIENT_ID: ""
          SUPABASE_AUTH_EXTERNAL_APPLE_SECRET: ""
          SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN: ""
          OPENAI_API_KEY: ""
          S3_HOST: ""
          S3_REGION: ""
          S3_ACCESS_KEY: ""
          S3_SECRET_KEY: ""
        run: supabase db start

      - name: Show what was applied
        run: supabase migration list --local

      # Optional gates. `db lint` runs plpgsql_check over every function;
      # start with --fail-on error and tighten later if it stays quiet.
      - name: Lint functions
        run: supabase db lint --local --fail-on error

      - name: Stop containers
        if: always()
        run: supabase stop --no-backup
```

What it proves: every file in `supabase/migrations/` applies, in order, on a
Postgres 17 that starts empty, exactly as `db push` will apply the new ones on
production. It has no secrets, so it also runs safely for pull requests from
forks (which do not receive secrets anyway).

The lint step is the one part that can be red for reasons unrelated to the
pull request: if functions already in the baseline trip `plpgsql_check`, the
job fails on day one. In that case run `supabase db lint --local` on your Mac,
fix what is cheap, and either drop the step or change it to `--fail-on none`
until the rest is fixed.

The `push: branches: [master]` trigger makes the same check run on the merge
commit, which gives the deploy workflow something to wait for.

### 7.3 Deploy: `.github/workflows/db-migrations-deploy.yml`

```yaml
# .github/workflows/db-migrations-deploy.yml
name: DB migrations deploy

on:
  push:
    branches: [master]
    paths:
      - "supabase/migrations/**"
      - ".github/workflows/db-migrations-deploy.yml"
  workflow_dispatch:
    inputs:
      include_all:
        description: "Also apply local files whose version is older than the newest one already on production (out-of-order merge). Read runbook 8.4 first."
        type: boolean
        default: false
      dry_run:
        description: "Only list what would be pushed"
        type: boolean
        default: false

permissions:
  contents: read

# Never run two pushes against production at the same time, and never cancel
# one that has started.
concurrency:
  group: db-migrations-production
  cancel-in-progress: false

env:
  SUPABASE_CLI_VERSION: "2.116.0"   # keep equal to db-migrations-check.yml and your Mac

jobs:
  deploy:
    name: Push migrations to production
    runs-on: ubuntu-latest
    environment: production          # binds the job to the environment: its secrets, branch rule and reviewers
    timeout-minutes: 30
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
      SUPABASE_DB_PASSWORD: ${{ secrets.SUPABASE_DB_PASSWORD }}
      SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v7

      - uses: supabase/setup-cli@v3
        with:
          version: ${{ env.SUPABASE_CLI_VERSION }}

      - name: Link to the hosted project
        run: supabase link --project-ref "$SUPABASE_PROJECT_ID"

      - name: Migration history before
        run: supabase migration list --linked

      - name: Dry run
        run: supabase db push --linked --dry-run ${{ inputs.include_all && '--include-all' || '' }}

      - name: Push
        if: ${{ !inputs.dry_run }}
        run: supabase db push --linked --yes ${{ inputs.include_all && '--include-all' || '' }}

      - name: Migration history after
        if: always()
        run: |
          {
            echo "## Migration history on production"
            echo
            supabase migration list --linked 2>&1 | sed 's/^/    /'
          } >> "$GITHUB_STEP_SUMMARY"
```

Notes on the choices:

- **`environment: production`** is what makes the secrets available. A job
  without that line cannot read them, and a run from a branch other than
  `master` is refused by the environment's branch rule before it starts.
- **`concurrency`** with `cancel-in-progress: false` queues a second merge
  behind a running deploy instead of cancelling it. By default GitHub keeps
  only one *pending* run per group and replaces it with a newer one; since the
  newer commit contains the older commit's migrations that is the right
  behaviour. (GitHub added a `queue: max` option in 2026 if you ever want every
  run kept.)
- **`paths`** limits the deploy to changes under `supabase/migrations/`. Path
  filters do not apply to `workflow_dispatch`, which is intended: the manual
  trigger is your "run it now" button.
- **`--yes`** is explicit confirmation; without it the CLI still defaults to
  yes when there is no terminal (section 2.7).
- **`--dry-run` first** prints the file list into the log before anything is
  applied, and exits non-zero on an out-of-order file, so the job stops before
  the push step (Probe F). It does not validate SQL; the check workflow did
  that.
- The **step summary** puts the after-state on the run's front page, so you
  can verify a deploy from your phone.

### 7.4 First run

1. With Phase 1 and 2 on the branch and the two workflow files added, push and
   open the pull request. `DB migrations check` must go green: `guard` passes,
   `apply-from-scratch` applies the baseline on a fresh container.
2. Merge. `DB migrations deploy` runs, asks for approval if you enabled
   reviewers, then prints `... is up to date.` because the baseline is already
   recorded. That is the expected first result: no SQL runs against production.
3. Create a trivial migration to exercise the whole path end to end, for
   example a comment on a table:

   ```bash
   supabase migration new noop_pipeline_smoke
   # file: supabase/migrations/<utc timestamp>_noop_pipeline_smoke.sql
   # contents:
   set local lock_timeout = '5s';
   comment on table "public"."FeatureFlag" is 'Rollout flags. Managed by migrations since 2026-09.';
   ```

   Run `supabase db reset` locally, open a PR, watch the check, merge, watch the
   deploy print `Applying migration ..._noop_pipeline_smoke.sql...`, and confirm
   the new row on the Dashboard's Database > Migrations page.

From now on, the only manual action per migration is writing it.

---

## 8. Day-2 operations

### 8.1 Writing and shipping a migration

```bash
git checkout -b feat/widget
supabase migration new add_widget_table        # supabase/migrations/20260910153000_add_widget_table.sql
$EDITOR supabase/migrations/20260910153000_add_widget_table.sql   # use the template in 6.5
supabase db reset                              # rebuild local from baseline + all files; catches ordering and syntax
pnpm db:check                                  # the guard script
cd backend && pnpm test                        # app still agrees with the schema
git add supabase/migrations && git commit -m "DB: widget table"
git push -u origin feat/widget && gh pr create --fill
```

Merge when `DB migrations check` is green. The deploy runs on the merge commit.

Order of operations when the backend also changes: **merge and deploy the
migration first, then deploy the backend** (the backend is still deployed by
hand from Docker on EC2). That only works if the migration is backwards
compatible with the running backend, which is why the template asks. Additive
changes (new table, new nullable column, new index, new function, wider check
constraint) are safe. Drops, renames, `NOT NULL` on an existing column and
narrowed constraints need the expand-then-contract pattern: ship the additive
half, deploy the backend that stops using the old shape, then ship the
destructive half in a later migration.

### 8.2 Statements that need special handling

| Statement | What to do |
|---|---|
| `CREATE INDEX CONCURRENTLY` (and `DROP INDEX CONCURRENTLY`, `REINDEX CONCURRENTLY`, `VACUUM`, `CLUSTER`, `ALTER SYSTEM`) | One statement per migration file, nothing else in the file, `IF NOT EXISTS` / `IF EXISTS` on it. On CLI 2.116.0 it runs outside the batch wherever it sits; on older CLIs only as the first statement. It commits on its own either way, so a file that mixes it with other statements can end half-applied (Probe E). |
| `ALTER TYPE ... ADD VALUE` | Allowed inside the transaction since Postgres 12, but the new value cannot be *used* in the same transaction. Add the value in one migration and the rows or defaults that use it in the next. The archived `sports_topic` migration is the pattern. |
| Backfills over big tables | Batch them, set `set local statement_timeout = '30min'` (platform default for `postgres` is 2 minutes), and prefer `NOT VALID` + `VALIDATE CONSTRAINT` for new constraints (see `dev_patches/092_patch_fix_constraint_lock.sql` in the archive for a worked example). |
| Anything on `auth.*` or `storage.*` | Works on production; the local container has those schemas too. It is not captured by `db dump`, so if you ever re-baseline, keep a hand-written companion file. |
| Grants and RLS policies | Just SQL; they are part of the migration and the dump. Keep `DROP POLICY IF EXISTS` before `CREATE POLICY`, as the recent migrations already do. |

### 8.3 When the deploy fails

The job is red and the log ends with `Applying migration X...` followed by a
Postgres error. Because a file is one transaction (section 2.4):

- Files before `X` were applied and recorded.
- `X` was rolled back and **not** recorded. Production is consistent.
- Files after `X` were not attempted.

Fix forward: edit `X` (it is not in the ledger, so editing it is legal),
verify with `supabase db reset` locally, open a PR, merge. The deploy applies
the corrected `X` and everything after it. Do not rename `X` to a newer
timestamp unless you also want the old version to disappear from the history.

The one exception is a file that mixes a non-transactional statement (8.2)
with other statements: the index may exist while the ledger has no row
(Probe E4). `IF NOT EXISTS` makes the re-run harmless, which is why the
template and the guard insist on it.

### 8.4 Out-of-order migrations

You merge `20260910_a` today. A branch created last week carries
`20260903_b`. When it merges, `db push` refuses:
`Found local migration files to be inserted before the last migration on remote database.`

Preferred fix: rename `b` to a fresh timestamp before merging
(`supabase migration new` gives you one; move the SQL over). The check workflow
still passes because it applies everything from scratch in filename order.

Emergency fix: re-run the deploy from **Actions > DB migrations deploy > Run
workflow** with `include_all` ticked. `--include-all` applies the older file
after the newer one, which is only correct if `b` does not depend on ordering
relative to `a`. Read both files first.

### 8.5 Rolling back

There is no automatic "down" migration and this runbook does not add one.

- **Schema you want gone:** write a new migration that drops or reverts it.
  Forward-only keeps the ledger and the code history truthful.
- **Data you changed:** same, a corrective migration, unless the data is gone,
  in which case you need a backup (section 4.6; on Free there is none unless
  you took one).
- **The ledger says applied but the change is not there** (someone reverted
  by hand in the SQL editor): `supabase migration repair --linked --status reverted <version>`
  removes the row; delete or fix the file; the next push behaves.
- **Backend rollback** is independent: redeploy the previous image. If the
  migration was additive, the old backend keeps working on the new schema,
  which is the whole point of section 8.1.

### 8.6 Someone changed production in the Dashboard

The Table Editor and SQL editor bypass the ledger. The next `db push` still
works (it only looks at versions), but local and production have drifted and a
future migration may fail on production only.

Detect it:

```bash
supabase db diff --linked -f capture_dashboard_changes   # writes supabase/migrations/<ts>_capture_dashboard_changes.sql
```

`db diff --linked` applies your migration files to a shadow container and diffs
that against production, so it works only after Phase 1. Review the generated
file, keep what should be permanent, delete what should not, then either commit
it (and `supabase migration repair --linked --status applied <ts>` since
production already has it) or write a corrective migration.

### 8.7 Rotating secrets

| Secret | Rotate when | How |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | It expires, or you suspect exposure | Dashboard > Account > Access Tokens: revoke, generate, paste into the GitHub environment. The deploy fails with a 401 from `link` when it has expired. |
| `SUPABASE_DB_PASSWORD` | You reset it in the Dashboard | Update the GitHub environment secret and every `DATABASE_URL` you own (backend `.env.*`, EC2, seeder). Supabase's own services pick it up automatically. |
| `SUPABASE_PROJECT_ID` | Never (it is not secret, just convenient to keep with the others) | |

### 8.8 Upgrading the CLI

Bump the pinned version in both workflow files and run `brew upgrade supabase`
in the same week. Read the release notes for anything under "db push" or
"migration". Do not use `version: latest` in CI: a release that changes push
semantics would then reach production before it reached your Mac.

### 8.9 Adding a second developer

Nothing changes for them except that they need Docker and the CLI, run
`supabase db reset` before opening a PR, and never run `db push` from a laptop.
Only the workflow pushes. If you want to enforce that, the environment's branch
rule already prevents pushes from anywhere but a `master` workflow run, and the
database password is known only to the environment and to you.

---

## 9. Alternatives you could pick instead

### 9.1 Supabase Branching with the GitHub integration

Supabase can do the deploy itself: Dashboard > Project Settings > Integrations
> GitHub > **Authorize**, choose the repository, set the working directory to
`.`, enable **Deploy to production** for the `master` branch. On every push to
`master` the platform applies new files from `supabase/migrations/` (and edge
functions and storage buckets declared in `config.toml`; it ignores `seed.sql`).
The docs say deploying from GitHub works on any plan; **preview branches**
(a fresh database per pull request, built by running your migrations from
scratch) bill at $0.01344 per hour on the Pro plan and above. Branching without
Git became the default for all projects on 4 May 2026.

When to prefer it: you want Supabase to own the credentials and you are on Pro
anyway. When to prefer this runbook: you want the deploy log, the concurrency
lock, the approval gate and the from-scratch check in one place you already
watch, and you want to stay on Free. Both need Phase 1 first; a preview branch
built from today's files fails on the first migration exactly like
`supabase db start` does.

### 9.2 Management API

`POST /v1/projects/{ref}/database/migrations` with `{ "query": "...", "name": "..." }`
applies SQL and records it in the same ledger, over HTTPS, with only an access
token (no database password, no IPv6 question). It is one file per call, so a
CI job would have to reimplement the pending-file calculation the CLI already
does. Older versions of the reference page said the endpoint was limited to
selected customers; the current page shows no such note, so try it before
relying on it. Useful as a break-glass tool from a laptop without Docker; not
worth building the pipeline on.

### 9.3 A staging project

The Free plan allows two active projects. Create `Pantopus-staging`, add a
second GitHub environment `staging` with its own three secrets, and either add
a `dev` branch that deploys to staging (`push: branches: [dev]` +
`environment: staging`) or add a `workflow_dispatch` input that picks the
environment. Free projects pause after a week without database activity; a
weekly scheduled run of the deploy workflow's dry run keeps it awake.

### 9.4 Keep applying by hand, but record it

If you ever must run SQL by hand (incident at 2 a.m.), put it in a migration
file first, run the file with `psql -f`, then
`supabase migration repair --linked --status applied <version>` so the ledger
matches. Commit the file. This is the only manual path that does not break the
next automated deploy.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Cannot find project ref. Have you run supabase link?` | Not linked in this checkout, or `supabase/.temp/` was deleted | `supabase link --project-ref <ref>` |
| `Remote migration versions not found in local migrations directory.` | The ledger has a version with no file: someone pushed from another checkout, or a file was renamed or deleted | Restore the file from git, or `supabase migration repair --linked --status reverted <version>` after checking the change really is gone from production |
| `Found local migration files to be inserted before the last migration on remote database.` | Out-of-order timestamp | Section 8.4 |
| `duplicate key value violates unique constraint "schema_migrations_pkey"` | Two files share a version | Rename one; the guard script prevents this on PRs |
| `relation "public"."User" does not exist` during `supabase db start` | Running the pre-baseline stream from scratch | Finish Phase 1; the baseline must be the first file |
| `WARN: no files matched pattern: supabase/seed.sql` | No seed file | Harmless; section 6.3 |
| `IPv6 is not supported on your current network` | Direct host unreachable and no pooler URL saved | Re-run `supabase link` (it saves the pooler URL); on CI make sure `link` runs before `push` |
| `link` returns 401 / "Invalid access token" | Token expired or revoked | Section 8.7 |
| `password authentication failed for user "postgres..."` | `SUPABASE_DB_PASSWORD` stale after a reset | Section 8.7 |
| Deploy job never starts, shows "Waiting for review" | Required reviewers on the environment | Click *Review deployments* on the run |
| Deploy job skipped entirely on merge | Path filter did not match (the PR changed no file under `supabase/migrations/`) | Expected; use *Run workflow* if you really want a push |
| `Skipping migration X... (file name must match pattern "<timestamp>_name.sql")` | A file in `supabase/migrations/` whose name is not `<digits>_<name>.sql` | Rename it or move it out; the guard script fails the PR for this |
| `CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)` | The statement is not the first in its file, on a CLI older than 2.116.0 | Give it its own file (8.2); upgrade the CLI (8.8) |
| `canceling statement due to statement timeout` | 2 minute platform default for the `postgres` role | `set local statement_timeout = '...'` at the top of that migration |
| Migration works locally, fails on production with a lock wait | Production has traffic; local does not | `set local lock_timeout = '5s'` so it fails fast, retry at a quiet time, or split the change |
| `WARNING: Local config differs from linked project` on `link` | `config.toml` and the hosted settings differ | Informational; nothing here pushes config |

---

## Appendix A: file inventory

Files this runbook adds or changes, in the order you create them.

| Path | Purpose | Section |
|---|---|---|
| `supabase/migrations-archive/` | The 179 pre-CLI files plus `dev_patches/`, moved | 5.1 |
| `supabase/migrations/20260905000000_baseline_production_schema.sql` | Production schema dump, the first and only migration on day one | 5.3 |
| `supabase/migrations/20260905000001_baseline_auth_storage.sql` | Only if the archive contains objects on `auth`/`storage`/`cron` | 5.3 |
| `scripts/db/check-migrations.sh` | Static guard | 6.1 |
| `package.json` (`db:check` script) | Convenience | 6.1 |
| `backend/tests/unit/identityFirewallRegression.test.js` (2 lines) | Point at the archive | 6.2 |
| `supabase/seed.sql` | Optional curated reference data | 6.3 |
| `backend/database/migrations/README.md`, `supabase/migrations-archive/README.md` | "Archived" notices | 6.4 |
| `.github/workflows/db-migrations-check.yml` | PR check | 7.2 |
| `.github/workflows/db-migrations-deploy.yml` | Deploy on merge | 7.3 |

All probe transcripts are summarised in section 2.5. The raw command logs
live in the Claude Code session that produced this document, not in the
repository; re-run any probe by creating a throwaway project with
`supabase init` in an empty directory, `supabase db start`, and the files
described in 2.5.

## Appendix B: command reference

| Task | Command |
|---|---|
| New migration file with a correct timestamp | `supabase migration new <snake_case_name>` |
| Rebuild local database from all migrations (plus seed) | `supabase db reset` |
| Start only local Postgres and apply migrations | `supabase db start` |
| Apply pending migrations to local without a rebuild | `supabase migration up` |
| Compare local files with production ledger | `supabase migration list --linked` |
| Preview what a deploy would apply | `supabase db push --linked --dry-run` |
| Apply to production (the workflow does this; avoid from a laptop) | `supabase db push --linked --yes` |
| Mark a version applied / not applied without running SQL | `supabase migration repair --linked --status applied\|reverted <version...>` |
| Capture Dashboard edits as a migration | `supabase db diff --linked -f <name>` |
| Schema-only backup | `supabase db dump --linked -f <file>` |
| Data backup | `supabase db dump --linked --data-only --use-copy -f <file>` |
| Lint functions | `supabase db lint --local --fail-on error` |
| Run the guard | `pnpm db:check` |
| Trigger a deploy by hand | `gh workflow run "DB migrations deploy"` (add `-f dry_run=true` or `-f include_all=true`) |

Environment variables the CLI reads: `SUPABASE_ACCESS_TOKEN` (skips login),
`SUPABASE_DB_PASSWORD` (skips the password prompt), `SUPABASE_YES` (answers
prompts). It also loads `.env`, `.env.local` and `.env.<SUPABASE_ENV>` from
`supabase/` and the repo root, so a stray `SUPABASE_DB_PASSWORD` in a local
`.env` is honoured.

## Appendix C: acceptance checklist

Phase 0

- [ ] `supabase --version` prints 2.116.0 or newer on the Mac
- [ ] `supabase link` succeeds; `supabase/.temp/project-ref` exists and is not tracked by git
- [ ] Production Postgres major version equals `major_version` in `supabase/config.toml`
- [ ] Remote ledger state recorded (empty, or the list of versions)
- [ ] Schema and data dumps saved outside the repo

Phase 1

- [ ] `supabase/migrations/` contains only the baseline file(s)
- [ ] `supabase db start` on a clean stack applies the baseline without error; object counts match production
- [ ] `cd backend && pnpm test` passes against the local stack
- [ ] `supabase migration list --linked` shows the baseline in both columns and nothing else
- [ ] `supabase db push --linked --dry-run` reports up to date

Phase 2

- [ ] `pnpm db:check` prints OK
- [ ] `identityFirewallRegression.test.js` passes with the archive path
- [ ] Seed decision made; if a seed exists it is PII-free and idempotent
- [ ] Both README notices committed

Phase 3

- [ ] `production` environment exists with three secrets, branch rule `master`, reviewers decided
- [ ] `DB migrations check` green on the pull request
- [ ] `DB migrations deploy` ran on merge and reported up to date
- [ ] Smoke migration merged; the deploy log shows `Applying migration ..._noop_pipeline_smoke.sql...`; Dashboard shows the row
- [ ] Old "how to run" docs (seeder guide, phase-0 runbook) point here

Day 2

- [ ] Every new migration is created with `supabase migration new` and starts from the template
- [ ] Nobody runs `db push` or `psql -f` against production outside the workflow (9.4 if you must)

## Appendix D: sources

Supabase documentation (read 4 and 5 September 2026):

- Managing environments (the official GitHub Actions deploy workflows): https://supabase.com/docs/guides/deployment/managing-environments
- Database migrations guide: https://supabase.com/docs/guides/deployment/database-migrations
- CLI reference: `db push` https://supabase.com/docs/reference/cli/supabase-db-push, `db pull` https://supabase.com/docs/reference/cli/supabase-db-pull, `db dump` https://supabase.com/docs/reference/cli/supabase-db-dump, `db lint` https://supabase.com/docs/reference/cli/supabase-db-lint, `migration list` https://supabase.com/docs/reference/cli/supabase-migration-list, `migration repair` https://supabase.com/docs/reference/cli/supabase-migration-repair, `migration squash` https://supabase.com/docs/reference/cli/supabase-migration-squash, `link` https://supabase.com/docs/reference/cli/supabase-link
- Seeding: https://supabase.com/docs/guides/local-development/seeding-your-database
- Backups and PITR: https://supabase.com/docs/guides/platform/backups
- Network restrictions: https://supabase.com/docs/guides/platform/network-restrictions
- Timeouts (role defaults, session-mode requirement): https://supabase.com/docs/guides/database/postgres/timeouts
- IPv4/IPv6 and the pooler: https://supabase.com/docs/guides/troubleshooting/supabase--your-network-ipv4-and-ipv6-compatibility-cHe3BP
- Management API introduction (personal access tokens): https://supabase.com/docs/reference/api/introduction, apply-a-migration endpoint: https://supabase.com/docs/reference/api/v1-apply-a-migration
- Temporary token-based database access (feature preview, 25 May 2026): https://supabase.com/changelog/46346-feature-preview-temporary-token-based-database-access
- Branching: https://supabase.com/docs/guides/deployment/branching, GitHub integration: https://supabase.com/docs/guides/deployment/branching/github-integration, branching usage pricing: https://supabase.com/docs/guides/platform/manage-your-usage/branching, "Branching without Git is now the default" (4 May 2026): https://supabase.com/blog/branching-without-git-is-now-the-default
- Pricing: https://supabase.com/pricing, project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Changing the database password: https://supabase.com/docs/guides/database/managing-passwords

Supabase CLI source (github.com/supabase/cli, main branch, commit `d6a376c`, 4 September 2026):

- `apps/cli-go/pkg/migration/file.go` (filename pattern, pipelined batch, pipeline-incompatible statements)
- `apps/cli-go/pkg/migration/apply.go` (pending calculation and the two error strings)
- `apps/cli-go/pkg/migration/history.go` (ledger DDL and lock timeout)
- `apps/cli-go/internal/migration/repair/repair.go` (multi-version repair, upsert semantics)
- `apps/cli-go/internal/utils/flags/db_url.go` and `apps/cli-go/internal/utils/connect.go` (direct-then-pooler connection, temporary login role)
- `apps/cli/src/legacy/shared/legacy-db-push-core.ts` and `apps/cli/src/shared/legacy/legacy-prompt-yes-no.ts` (dry-run text, prompts, non-TTY behaviour)
- Pull requests 6009, 5725, 5493 for the dates in section 4.1

GitHub Actions:

- `supabase/setup-cli` README (v3, npm-based install, `version` input): https://github.com/supabase/setup-cli
- Environments and protection rules: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- Plans (deployment protection rules on public repos): https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- Events, fork secrets, `workflow_dispatch`, path filters: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Concurrency: https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/control-the-concurrency-of-workflows-and-jobs
- Runner images (Ubuntu 24.04 software list): https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md
- Actions billing (free for public repositories): https://docs.github.com/en/billing/managing-billing-for-your-products/about-billing-for-github-actions
