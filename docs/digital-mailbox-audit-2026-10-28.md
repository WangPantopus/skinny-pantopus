# Digital mailbox audit — October 28, 2026

This audit found and repaired defects in letter reading, private enclosures,
household authorization, sending, claims, delivery notices, search and vacation
holds. Changes are committed in an unmerged review stack. This is local
verification evidence, not approval to enable the mailbox or deploy the stack.

## Review stack

Review in order; each PR after the first targets the preceding audit branch.

| PR | Repair |
| --- | --- |
| [2942](https://github.com/WangPantopus/skinny-pantopus/pull/2942) | Read the complete private letter, preserve enclosures after actions, and render formatted content safely. |
| [2943](https://github.com/WangPantopus/skinny-pantopus/pull/2943) | Apply current Home state to mail access, authorize household read sessions, and require confirmed Auth contacts for claims. |
| [2944](https://github.com/WangPantopus/skinny-pantopus/pull/2944) | Repair connected-home sending, sender eligibility, notice retries, withdrawal conflicts and native first-open timestamps. |
| [2945](https://github.com/WangPantopus/skinny-pantopus/pull/2945) | Keep holds until local 07:00, process complete large bundles, converge concurrent hold syncs, and preserve filing counts. |
| [2946](https://github.com/WangPantopus/skinny-pantopus/pull/2946) | Search full letter content and supply a dry-run repair command for older truncated rows. |
| [2947](https://github.com/WangPantopus/skinny-pantopus/pull/2947) | Use decoded text in the current iOS paper-letter layout. |
| [2948](https://github.com/WangPantopus/skinny-pantopus/pull/2948) | Keep mail and its bundle held through all connected hold windows, including the displayed final return date. |

Three additive migrations must precede the backend changes. Existing migration
history and tables are preserved. The search backfill is dry-run by default;
the founder must separately review and run any hosted apply operation.

## Local verification

All accounts, homes, letters and email recipients were synthetic. The backend,
Supabase database, private object storage and SMTP capture were isolated locally.
Web Chrome, an iOS simulator and an Android emulator used that backend.

| Area | Observed result |
| --- | --- |
| Complete letter | A 1,334-character letter previously stopped at its 280-character preview. Both detail APIs and the web reader now return the final sentence. |
| Formatting and design | Web renders safe paragraphs and entities. iOS and Android show the full formatted letter as readable text, including its final sentence, without literal HTML. Existing paper layouts remain. |
| Enclosures | Recipient can fetch/download the private fixture. Unauthorized accounts cannot. Counter, done and unfile responses retain enclosure descriptors. |
| Storage failure | Missing/corrupt object fails visibly without marking unread mail read; restoring the object permits a successful retry. |
| Household access | Owner/member access works in a normal Home. Five blocked Home states deny access; guests, providers and outsiders are rejected. Undelivered mail is not readable. |
| Reading analytics | Household members can start/close their own read sessions. Direct client execution of the service-only RPC is forbidden. |
| Compose and delivery | Browser-composed household letter reaches the other account's iOS reader. Ordinary delivery remained hidden before its scheduled time; the local fixture clock was advanced for the recipient UI check. |
| Connected recipients | Accepted connections can send; removed connections, blocked people/households and frozen destinations cannot. Compose context omits private address details and the member roster. |
| Claims and notices | Unverified profile contact cannot claim. Confirmed Auth contact claims immediately readable mail. SMTP notice was captured locally with a local claim link and no letter body. Wrong sender cannot withdraw; withdrawn claim returns gone. |
| First-open and saved state | Native mark-viewed stores opened time. Counter placement survives iOS and Android relaunches. Web Counter/Vault state survives reload. |
| Search | Tail phrase is found in the browser after restoring full content. Local backfill repaired three old rows with zero failures; repeat apply changed zero. Newly sent HTML is searchable by its tail. |
| Shred and restore | Shared removed state and authorized restore work. Unauthorized restore is denied and recovery after the retention deadline is rejected. Deleted detail remains accessible for the intentional restore UI. |
| Vacation dates | Return-today hold remains active/editable until local 07:00. Ordinary mail holds; urgent delivery bypasses the hold. Cancellation reconciles waiting mail. |
| Vacation volume | All 1,001 fixture pieces are held, listed, opened and filed. Retry preserves exact folder count; a folder from the wrong mailbox is rejected. Concurrent sync produces one pending wrapper per hold. |
| Overlapping holds | Overlapping/consecutive holds extend both piece and wrapper to the final morning; a genuine gap remains deliverable. Cancelling the last connected hold shortens the release. |
| Launch cut | A separate local backend with flags off rejects external-contact mail. Existing shared read APIs remain available by launch-scope design. No hosted flag was changed. |

Relevant existing backend suites passed (eight suites / 219 tests for the main
access, delivery and vacation work; two suites / 60 tests for search; two suites /
39 tests for the overlap follow-up). Privacy gates, migration policy, web
TypeScript/targeted lint, native lint and local native builds passed. CI for the
first reading PR also exercised iOS build/tests and Android lint, tests,
assembly and instrumentation. Full fresh-schema replay passed for the additive
migrations. Consult each PR for the current head's CI result.

No new unit tests were added. Existing test fixtures were adjusted to represent
current Home state and the shared access/storage behavior.

## Before enabling

- Review and merge the stack only through a separately authorized release step.
- Recheck the combined release against current master; concurrent mailbox work
  continued during this audit, including the separate iOS welcome-letter fix.
- Validate hosted private storage, provider email/SMS and push delivery, signed
  physical-device builds, and relevant deep links. Local SMTP capture is not
  proof of real-world delivery.
- Live AI, certified/e-signature flows, paid/reward flows, physical postal/carrier
  handling and production background-job operation were not exercised here.
- Review the search backfill dry run against the intended environment before
  applying it. No hosted database, credentials, configuration or app-store state
  was changed during this audit.

The replay establishes the results above; it cannot establish that every mailbox
path is bug-free. Sensitive fixtures, tokens, screenshots and operator logs remain
outside this public repository.
