# master branch protection — change log

- **2026-09-27T11:13:55Z (Stream 1, at the user's direction):** removed the required status check `CI OK` (strict / up-to-date) from `master`, with `DELETE /repos/WangPantopus/skinny-pantopus/branches/master/protection/required_status_checks`.
  - The user's words: turn the requirement "off so we just merge them directly, as long as you did app launch end to end test on the feature, function, flows that they work well. We do not care about these unit tests or so many lints here in the CI."
  - Kept: `enforce_admins: true`, no force pushes, no deletions. CI still runs on every PR and push; it's informational only.
- **Before:** `master-protection-before-2026-09-27.json` (the full `GET …/protection` response at 11:13:50Z).
- **To restore** the previous rule, if the user asks:
  ```
  gh api -X PUT repos/WangPantopus/skinny-pantopus/branches/master/protection --input docs/workstreams/coordinator-state-2026-09-23/repo-settings/master-protection-restore-2026-09-27.json
  ```
- **Merging under this policy** (the coordinator only):
  1. Review each PR.
  2. Verify its sealed bundle (`verify-bundle.py`).
  3. Confirm its owner verified it end to end in the real apps.
  4. Build the batch with `build-batch.sh`, then run `verify-batch.py` and `lint-batch.sh`.
  5. Merge with `gh pr merge <batch> --merge --match-head-commit <tip>`.
  - The old `run.sh` runner waits for `CI OK`; don't use it for this.
