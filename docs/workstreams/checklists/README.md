# Streams 1–2 exit checklists (U02–U04)

The data files render both streams' canonical checklist sections, the frozen split
reconciliation, and the review page (https://claude.ai/artifact/WFpmhCwcUyLyakPRLjxJCu).

- `data_s1.py` holds Stream 1's rows (Support Trains) and `data_s2.py` Stream 2's (Posts and
  Pulse, Start and Hub, money screens), each with per-client status chips. **Each stream edits
  only its own file**, so two sessions never write the same file in this shared checkout.
- `data.py` assembles both in the original order and holds the shared parts: the case lists,
  "Outside this plan" and the decisions (each tagged to a stream or both), `PRE_SPLIT` (the
  former Stream 1's totals just before the 2026-09-30 split) and `SPLIT_SNAPSHOT`.
- `data_common.py` holds the `c()` chip helper.
- `gen.py check` re-proves the split (Stream 1 + Stream 2 = `PRE_SPLIT` for every list and
  status in `SPLIT_SNAPSHOT`), fails if a section has no stream, and lists each stream's progress
  since the split. Run it after every edit.

## Updating progress

1. Edit only your own stream's file (`data_s1.py` or `data_s2.py`). Change a chip's status and give its evidence
   reference; split a chip when only part of it closes.
2. `python3 gen.py check`
3. Regenerate your section and paste it over the old one in your status file:
   - Stream 1: `python3 gen.py md 1 "$(date -u +%Y-%m-%dT%H:%MZ)" <review-page-url>` → `01-trains-coordination.md`
   - Stream 2: `python3 gen.py md 2 "$(date -u +%Y-%m-%dT%H:%MZ)" <review-page-url>` → `02-posts-hub-payments.md`
4. The review page is republished by the stream that holds it (Stream 1 at the split):
   `python3 gen.py html "<ts>" > page.html`.

`PRE_SPLIT` and `SPLIT_SNAPSHOT` are frozen: they prove that at the split (2026-09-30T04:14Z)
every item of the former Stream 1 went to exactly one stream, with each status count equal to
Stream 1 + Stream 2. `check` re-proves that snapshot, fails on any section without a stream,
and then lists each stream's progress since the split. Live counts may move freely; splitting
a chip into two (when only part of it closes) adds an item, which is expected.
