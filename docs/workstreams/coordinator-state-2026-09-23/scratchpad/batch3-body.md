## What this is

A combined merge of 20 reviewed PRs, built the same way as batches 1 and 2 (#353, #374). Each PR's head commit merges unchanged, in PR-number order, on top of master `9779bf9d3`. CI runs once on the combination, and the database replay now has the ECR fallback from #385.

## Included (in merge order)

| PR | Head |
|---|---|
| #257 | `fab5fa4fd` |
| #339 | `bdbb42e2b` |
| #346 | `d0527d545` |
| #349 | `014857919` |
| #350 | `ffbfcd368` |
| #365 | `488fc5c60` |
| #371 | `4a7b03672` |
| #372 | `2b076dc5f` |
| #373 | `f5a38aab4` |
| #375 | `b51f2d919` |
| #376 | `d91208ca3` |
| #377 | `2417c6e4d` |
| #378 | `c6593207b` |
| #379 | `90de48489` |
| #380 | `bae7ab6cc` |
| #381 | `5c1ceda88` |
| #382 | `6e22610d9` |
| #383 | `11eca4045` |
| #384 | `b33c3294f` |
| #386 | `9d63e55e7` |

## Left out

- #325 conflicts with master in `HubTabRoot.swift` and `YouTabRoot.swift`, from batch 2's changes to those files. Stream 2 is merging master in.
- #356 conflicts with master in `APIError.swift`, where #308 changed the 403 case in batch 2. Shared UX is merging master in.

## Checks before pushing

- Every included merge is a clean `git merge-tree`.
- Each head passed CI OK at exactly that head, or failed only the database replay because of the ghcr.io outage; this batch run re-checks that job with the fallback.
- The two heads that changed after first review (#346 re-recorded Paparazzi images; #378 filter pill removed) were reviewed again.
- No new duplicate function definitions in the 13 files that several PRs touch.
- The pinned SwiftLint `--strict` and SwiftFormat `--lint` pass on the 7 shared Swift files at the tip.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
