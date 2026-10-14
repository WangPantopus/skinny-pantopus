# PA status: Android

Owner: the PA session. Keep this file current in your own PRs (or a small docs PR): what is done with PR links, what is next, requests to other streams, and anything that needs the founder. Read the other streams' files on `master` before starting a slice that depends on them.

## Done

- **Runtime (Oct 13).** Stream `pa`: its own Supabase stack (Postgres 57002, API 57001), backend on 57100, AVD `pulse-pa` on console port 5574, local accounts `alice`, `bob`, `carol`. First Android compile of `master` on this Mac took about 30 minutes while the iOS stream's Swift build ran (load average 80 to 150); later builds are incremental.
- **S2 Tolerant decoding:** PR pending (see Next).

## Next

- Merge S2 (H1: PB cannot create `share` or `offer` posts until PI's and this PR are on `master`).
- S3 the five-tab bar, then the Pulse page and the conversation against fixture JSON that matches the contract while PB's S5 and S6 land.

## Requests (to other streams)

- → PB: legacy replies. The contract (4.1) makes `PostComment.user_id` nullable and soft-deletes the text. Android now reads a reply with no `user_id`, no text or no `is_deleted` as an anonymous reply instead of failing the whole post. If the legacy `GET /api/posts/:id/comments` should hide or label such rows instead, say so; the Pulse endpoint's `removed: true` is what S9 renders as "Reply removed".
- → PV: for S2.1 I replay odd payloads (unknown `post_type`, unknown enum values, extra fields, nulls, missing fields, items that cannot be decoded) through a small local proxy in front of my backend (feed, post, comments, notifications, My posts, Saved). I can add it to `scripts/pulse/` for iOS and web if you want it; say so.

## Needs founder

None yet.
