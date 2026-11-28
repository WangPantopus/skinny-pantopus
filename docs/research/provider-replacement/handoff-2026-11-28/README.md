# Pantopus nationwide property, address and mail handoff

**November 28, 2026 · VENDORX · United States and territories**

Production has **164 whole counties plus Boston within its city limits**. Lee County FL and Skagit County WA went live after the November 23 baseline. Connecticut gained recorded history in all nine regions. Storage holds **965 county property releases and 70,304,930 property records**. Of those releases, **800** have property serving off. The address registry separately stores **23,327,006 named unit addresses** nationwide. Its production Add Home live-state list is empty.

**Boston has 48,431 exact apartment-address matches in the original two-/three-family cohort.** A newer City source supplies all three individual interior facts for 92 exact matches in 35 buildings that converted to condos. None is in the current production index. The founder directed that all 92 stay on hold pending source-specific clearance. Check [the Boston release receipt](boston-release.md) for the disposition of these 92 before publishing, plus [the apartment evidence](boston.md) for the remainder.

## On the new Mac

1. Clone repository ID 1353785096 and open docs/research/provider-replacement/handoff-2026-11-28 on master or dev. The ZIP contains the same packet for offline transfer. Put private working data outside the checkout. Run the integrity check and authenticate the new Mac as described in [setup and release procedure](new-mac.md).
2. Open the cloned Pantopus project in Codex. Point the chat at this folder in the clone. Paste the [coordinator prompt](prompts.md). The same file has a common builder prompt and the specific assignment to append for each independent chat.
3. Re-run the read-only inventory and check new remote PRs and release events. Then take [the ranked assignments and county holds](next-work.md). This packet works without the old Mac’s chat folders, worktree names or caches.

## Evidence

| File | Contents |
|---|---|
| [Private storage verification](storage-receipt.md) | Transfer verification, dated county uploads and local research still on hold |
| [Nationwide status](nationwide.md) | Releases after November 23, exact production scope, house field coverage, regional data upgrades, registry runtime, CI and mail status |
| [State and territory table](state-coverage.md) | Each state-level jurisdiction, including Puerto Rico and four other US island areas |
| [Every county and equivalent](nationwide.json) | 3,235 FIPS rows, property scope, dated release, source, stored records, Census reference count where available, and separate registry counts |
| [Six house fields](house-field-coverage.json) | Stored field counts and conservative joint bounds for each of the 965 published releases |
| [What changed](release-changes.json) | Imported releases after the November 23 baseline, per-county changes in stored fields, and registry refresh counts by state |
| [County discovery routes](county-research-routes.json) | November source research and identified layers where available, overlaid with November 28 property scope |
| [Boston source audit](boston.md) | Annual and quarterly assessment crosswalk, actual registry binary, permit screen, other sources, source terms and a draft no-fee agency request |
| [Reproduce Boston](reproduce-boston.md) | Commands for the new Mac; source fetches and counts can be recreated without transferring household records |
| [Current Boston release receipt](boston-release.md) | Exact status of the new candidate, serving baseline, and evidence still needed at handoff |

## First decisions and priorities

The fastest nationwide address opportunity is to join the index’s own stored physical sites to the registry. The measured county-level shortfall in places already stored is about 11.5 million. For new complete property coverage, prioritize the authoritative Greenville SC, Utah County UT and Lucas OH sources. For ordinary Boston apartments, ask whether the City can provide an existing free completed-unit schedule under publishable terms. The packet includes an unsent draft.

The founder’s standing requirements govern every lane. Keep costs at zero, use trustworthy permitted bulk sources, preserve confidentiality and source dates, and enforce the six-fact 90% house threshold with separate exact-unit proof for apartments. Record source, release, rights, user-visible scope, denominator and verified client behavior for every production change. Raw records and credentials stay on private storage.
