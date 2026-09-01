# Addendum brief — medium + low parity findings

**Read `docs/_parity-work/BRIEF.md` first.** Everything in it still applies: repo paths,
endpoint verification against `backend/app.js` + the router file, the shared-file Edit
discipline, the four render states, tokens-only, no builds, no commits, both platforms.

This addendum covers what is *different* about the medium/low pass.

## 1. Your findings are truncated and carry no file:line

The high-severity findings quoted RN and native file:line for you. **These do not.** They are
one-liners cut at ~200 characters, so several end mid-sentence. Example:

> The Home Calendar natively shows only home events. RN's month grid additionally plots task due
> dates, bill due dates and package expected-delivery dates (colour-coded by type), so on native a
> user can

That is the whole record. So your first job on every finding is **reconstruction**:

1. Find the RN implementation. The cluster tag (`homes-a`, `mailbox`, `gigs`, …) and the feature
   name in the sentence are enough to grep
   `pantopus/frontend/apps/mobile/src` for the screen. Read it properly — the truncated half of
   the sentence is always recoverable from the RN source.
2. Find both native counterparts.
3. Only then decide what to build.

If a finding is too vague to reconstruct with confidence, **do not guess at a feature**. Put it in
`deferred` with what you searched and what you found. A wrong feature is worse than a reported gap.

## 2. Several of these are already half-built

The audit repeatedly found endpoints and repository methods that exist with **zero call sites** —
`deleteTask`, `updatePoll`, `deleteAccessSecret`, `propertySuggestions` are all declared on both
platforms today and called by nothing. Before writing a new endpoint, grep for one that already
exists. Wiring the existing helper is the right fix and is much smaller than it looks.

## 3. Scope discipline matters more here

These are small findings. The risk is not under-delivering, it is **scope creep** — an agent
"improving" a screen beyond its finding and creating cross-platform drift. A previous wave silently
deleted two placeholder groups from the iOS Verification Center, which broke a test and was never
asked for.

- Change what the finding describes. Nothing else.
- If you spot a real bug outside your finding, **report it in `deferred`** — do not fix it.
- Never delete an existing surface unless the finding says to.

## 4. Low findings are still real findings

The 13 `[low·…]` entries are small but they are not optional. Same standard: real endpoint, real
states, both platforms, no fixtures.

## 5. Money findings get extra care

The `money` cluster covers withdrawals, balances, lifetime totals and identity gates. Render the
server's amounts; never re-derive money client-side beyond formatting. Watch cents-vs-dollars. A
CTA that is enabled when the server would reject it is a bug, not a nicety.
