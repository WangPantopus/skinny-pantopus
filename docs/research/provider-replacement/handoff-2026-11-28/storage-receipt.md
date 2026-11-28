# What reached Pantopus private storage

Verified November 28, 2026 at 12:57 UTC, after the Oakland upload. A separate read-only identity enumerated every state manifest, then checked that the data file, block manifest, field report and subject-ID file for every referenced release existed and contained bytes. The command in [new-Mac setup](new-mac.md) repeats this check and lists any missing component by county and release.

| Private index | County releases referenced | Records in current releases | Nonempty files verified |
|---|---:|---:|---:|
| County property | 965 | 70,304,930 | 3,860 |
| Physical-address registry | 2,606 | 133,801,002 | 10,424 |
| National estimates | 2,174 | 56,316,148 | 8,696 |

All 22,980 expected files were present. The three indexes overlap and count different subjects. The 164 whole counties and Boston municipal scope are the live property coverage. The 800 other stored property releases are off. The address-registry live-state list was empty at the runtime audit. [National inventory](nationwide.md)

## Oakland County, Michigan

The November 23 importer correction was on both branches. Oakland's stored release still classified 480 residential common elements as houses. We ran the existing master publisher for `mi-oakland` alone with its normal retention checks. The new release is `20261128-11281245`, with 539,451 records, up 25 from `20261116-11160311`. Both versions remain in private storage. [Importer correction](https://github.com/WangPantopus/amber-lattice-4729/pull/4674) · [Completed publication](https://github.com/WangPantopus/amber-lattice-4729/actions/runs/46146199868)

Independent readback decompressed every block of both releases and reconciled every record ID against its release’s ID file. All 480 previously misclassified subjects now resolve in the file to parcels. All 486 common elements in the new county file have parcel scope and zero dwelling fields. Among other subjects, 538,676 whole records matched exactly. The refresh added 89 subject keys and retired 64 across the county. One retained house lost a previously held building-outline measurement. Its county lot remains present. Every other Michigan county entry and both environments’ county switches matched before and after.

Oakland is off in production and staging. The county's definition of its bathroom count is still open. The upload created no new household-facing coverage.

## Local files still held

The former Mac's indexed build folders were reconciled by county, source, vintage, published release and the six house-field counts. The search included 117 project directories and 1,688 release directories, including repeated builds and test fixtures. Every county property connector on master appeared in private storage. The federal estimate and area-data inputs have separate uses. The newer or unrepresented local releases had the following dispositions.

| Area | Records or scope | Reason and resume point |
|---|---|---|
| Erie County, NY, 36029 | Published 347,837. The scoped local rebuild has 347,848, adding three houses, one parcel and seven other records. | The ordinary hosted source publishes five New York counties. Two independent nonhouse test sites in Erie resolved to a different parcel even in the prior release. Review the exact 11 additions and shared sites before replacing a live index. The county-specific source and real-client verification are recorded in [the Erie importer PR](https://github.com/WangPantopus/amber-lattice-4729/pull/4662). |
| Blanco, Gillespie, Kimble, Llano, Mason and Real, TX | 66,250 records across six local county files. | The publisher refused all six because too many records failed lookup at their own address. Reproduce with the Texas StratMap source and its rural road names. Avoid a bulk acceptance of these failures. |
| Crook, OR and Logan, OH | 12,105 and 24,435 local records, respectively. | The draft importers are parked on lot evidence. Crook's county acreage covered 47% of houses. Logan's land dimensions still require documented units or another authoritative lot source. Clinton has a separate later live release. [Crook](https://github.com/WangPantopus/amber-lattice-4729/pull/4657) · [Logan](https://github.com/WangPantopus/amber-lattice-4729/pull/4658) |
| Becker, Clearwater, Grant and Olmsted, MN | Four newer county extracts. | The extracts lost building values, use codes and values, usable lot acreage, or thousands of existing subjects, respectively. The earlier releases remain in storage. |
| Summit, CO and Caldwell, TX | County and statewide vintages. | Their newer-looking statewide editions are already in dated storage. The current manifest points to each county's own connector. |
| Boston, MA | 92 exact condo conversions among the 48,431 matched apartment addresses. | The founder held these pending permission for this quarterly source. The future-dated audit fixtures have no release use. [Boston evidence](boston-release.md) |
| Denton, TX | An earlier local file has 51 extra confidential records. | Use the corrected stored release and preserve all exclusions across refresh and rollback. |

The approved private publisher writes the county release and advances its state manifest. For a county already live, that changes household lookups. The local storage reader can list and read. An unpublished research copy needs its own approved private transfer destination. A GitHub clone carries the build code, source references and aggregate evidence.

## Reproduce Erie on the new Mac

From a current checkout with `VX_PRIVATE` set to the private directory in [setup](new-mac.md), the existing builder supports an isolated Erie run. Read the county producer and the official May 2026 archive publication date. Use a new output directory for each run.

```sh
umask 077
erie_run=$(mktemp -d "$VX_PRIVATE/erie.XXXXXXXX")
PROPERTY_INDEX_ONLY=36029 node --max-old-space-size=12288 scripts/property-index/build.cjs \
  --source ny-county-files --out "$erie_run/out" --work "$erie_run/work"
```

A newer publisher edition may produce different counts. Reconcile against the currently served release and the official Erie and Buffalo bath supplements. Preserve each source date, the county-map lot label, confirmed unit identities and the saved household privacy checks. Keep the production decision with the coordinator.
