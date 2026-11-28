# Move VENDORX to a different Mac

The authoritative packet lives in docs/research/provider-replacement/handoff-2026-11-28 in the Pantopus repository. The ZIP is an offline copy. The files here contain aggregate coverage, official source URLs and read-only audit programs. Restore authentication separately from the founder’s normal secure source. A public clone alone can reproduce the government-source research. The production inventory and Boston registry match also need the existing read-only storage identity.

## Prepare the machine

1. Install Git, GitHub CLI, AWS CLI v2, Python 3.10+, Node and the package manager pinned in the checkout (currently pnpm 9.15.4). For app verification also provision Docker and the project’s local Supabase stack, Chrome, Xcode with an installed iPhone Simulator and XcodeGen, plus Android Studio SDK, emulator and the JDK required by the checked-out Gradle project. Confirm available disk space for government bulk files, native build caches and the local DB. A fresh Xcode installation may require a person to accept Apple’s terms.
2. Authenticate GitHub on the new Mac with the organization account already authorized for this repository. Resolve its numeric ID before cloning. The old repository URL redirects to the current one. Do not copy the old machine’s SSH alias. Run the following from your chosen project parent.

```sh
gh api repositories/1353785096 --jq '[.full_name,.default_branch,.html_url] | @tsv'
gh repo clone WangPantopus/amber-lattice-4729 pantopus
cd pantopus
git fetch origin master dev
git status --short --branch
git log -1 --format='%H %cI %s' origin/master
git log -1 --format='%H %cI %s' origin/dev
gh pr list --state open --limit 200
gh workflow view property-index.yml
gh workflow view address-registry.yml
```

3. Open this clone as a Codex project. Each builder uses a separate new Codex chat and its own worktree from the freshly fetched dev branch. Keep one coordinator and one publisher at a time across computers. A Mac-local queue or lock is visible only on that machine. Check remote running and waiting Actions and active chat ownership before assigning a county. Retired or held PRs never enter the new queue automatically.
4. Restore the **reader** to a private AWS profile for this work or the existing private Pantopus reader env file using the founder’s secret manager. It needs list/get for the property and registry indexes. With the env-file method use file mode 0600. Put local QA env, signing material and synthetic account configuration outside Git. Start from the repo's backend, web, iOS and Android env examples. Restore only the existing local-only/synthetic configuration required for those clients. The production writer remains behind the pre-existing reviewed release path. Nothing in the bundle contains a key, database backup, private raw roll or user address.
5. Start the following shell from the new clone. The packet is read-only input. Write fresh evidence to the private directory. For an unpacked ZIP, point VX_PACKET at the extracted directory instead.

```sh
umask 077
export VX_REPO="$(git rev-parse --show-toplevel)"
export VX_PACKET="$VX_REPO/docs/research/provider-replacement/handoff-2026-11-28"
export VX_PRIVATE="$HOME/Library/Application Support/Pantopus/VENDORX"
mkdir -p "$VX_PRIVATE" "$VX_PRIVATE/audit" "$VX_PRIVATE/lanes"
cd "$VX_PACKET"
shasum -a 256 -c SHA256SUMS
python3 "$VX_PACKET/audit-national.py" --repo "$VX_REPO" --out "$VX_PRIVATE/audit" --verify-objects --reader-env "$HOME/.config/pantopus/property-index.env"
```

If using a named read-only AWS profile, export AWS_PROFILE for that profile and omit the reader-env argument. For the optional full field-report audit, install the free Python botocore package in a local virtualenv, or use the Python interpreter bundled with AWS CLI v2. Run audit-house-fields.py with --nationwide pointing at the snapshot and --out in the private audit directory. For release-level changes, run audit-release-changes.py --since 2026-11-23T06:29:00+00:00 with the same reader profile and a private --out. With --verify-objects the audit also lists dated objects and writes storage-check.json with every absent or empty component of a current property, registry or estimate release. Check its result before deciding to upload a county again. Keep the bundled November 28 snapshot as a baseline and write the new snapshot to the private audit directory. Verify a fresh deployment and the actual runtime registry state independently. Property releases, Add Home registry switches and mail operations use different controls.

## Build and verify

- From the checkout read AGENTS.md, NEXT_STEPS.md and docs/mobile-pilot-build-brief-2026-10-03.md, then the current release workflow inputs and the code used for this source. Reuse scripts/property-index/sources, build.cjs, publish.cjs, switch-county.cjs, registry code and backend/services/propertyRecords. Inspect overlaps on dev, master, open PRs and the county research routes. Research by county FIPS and source release.
- Install workspace dependencies using the repo lockfile. Bring up the project’s supported local DB/backend. Run the web client against it, bootstrap iOS with the repo Makefile, and run the Android app through its Gradle wrapper against the same backend. Confirm the loopback host for each device, code revision, bundle IDs, backend base URL and synthetic account login. Never point a test login or write at a real household.
- Use owned synthetic fixtures for app screens. Check the correct subject, wrong unit, ambiguous same street, wrong city/ZIP, protected records, expired source, saved copy, reload and cold relaunch as relevant. Capture aggregate pass/fail only. The source file alone cannot verify what a person sees.
- In each private lane status record FIPS, source URL, terms, effective and update dates, county/municipal/unit scope, classifier and denominator, per-field and same-record counts, held data, active branch and exact reviewed head, status of three clients, readback and switch receipts. Record why a hold can reopen. Another chat should be able to resume it from those facts.
- Worktree caches, simulators, local databases and checkout names from the former Mac are disposable. An old chat ID is unnecessary for reproduction.

## Land and release

The founder’s exception applies to VENDORX PRs only. Use a dev-based staging PR. For production cut the same reviewed change on current master in a separate worktree. Compare the resulting patch and production diff for unrelated staging commits, review that exact head and wait for applicable CI and real-app proof. Land the scoped production PR. Integrate master back into dev using the established non-destructive merge and verify ancestry. Other lanes keep their normal staging rules.

- Preserve the remote concurrency slot for the existing Property Index or Address Registry workflow. A new queued run can replace an earlier waiting run. Use the team’s serialized index runner when restored. If recreating it, use one coordinator to submit a named workflow, action, source and branch after checking both running and waiting jobs, bind the resulting run ID to that dispatch, and follow it through completion. Never dispatch a default or empty build. Use the current verified workflow inputs rather than copying flags from an older handoff.
- For an eligible place, stage the exact source and gate. With the independent reader, compare the actual stored release to the locally built one by record and subject ID, validate counts and source labels, and check public workflow logs contain no private/address output. A per-field percentage does not prove six fields occur on the same house. For source refreshes verify other subjects, previous release, districts and confidential exclusions, including saved answers.
- After READY, the coordinator runs storage and normal lookup checks with synthetic controls and gives the scoped “OK to switch” acknowledgement. Use production shadow then live when a county is newly enabled. For an already-live municipal scope, isolate the eligible unit subset in code/release; keep all other Suffolk municipalities and siblings outside that scope. Do not add Suffolk as a whole county. Re-read production switch and manifest, confirm only intended scope changed, exercise fresh and saved views and relaunch on all three clients. Retain the previous release/reference. Publish the aggregate LIVE receipt only when those checks pass.
- Keep reader credentials read-only. For any restore or rollback use the existing source-scoped release path, preserve other releases, and verify the restored data and user-visible behavior. Preserve Denton’s standing 51-account exclusions across rebuilds, rollback and saved-copy reads.

Historical reports in the repo have useful source and field definitions. The portable per-county file and fresh storage take precedence over their old coverage labels. The current repo path for the public evidence is docs/research/provider-replacement/evidence. Consult cost-and-rights.md in its parent for source-specific constraints.
