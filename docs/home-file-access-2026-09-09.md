# Home file access repair — September 9, 2026

The legacy `/api/files/home/:homeId` upload and listing routes called the Home
permission helper but ignored `hasAccess`. They accepted any matching occupancy
row, including a former occupant or a current member denied `docs.view` or
`docs.upload`. The listing also accepted unsupported visibility values.

Both routes now enforce the helper's permission result before private file
queries or uploads. Access lookup failures return a retryable 503. Public
listings accept only explicit `public` visibility (also the default); private
listings require `docs.view`. Public uploads remain owner-only, and permitted
members can still upload private documents. Administrative database queries
follow these application access gates; the anonymous client does not carry the
authenticated request's session.

## Verification

- The original routes failed 10 of 18 new regressions, including a private
  listing returning 200 and an unauthorized upload returning 201.
- All 18 pass after repair: denied/former occupants, permitted member/owner,
  public visitor filtering, invalid or repeated visibility, lookup failure,
  owner-only public upload, and absent Home behavior. Denied requests perform
  no file query/storage write.
- Full backend run: 4,357 passed, 16 existing skips, one unrelated
  `authDevicesRoutes` socket hang-up. All 30 tests in that suite passed on its
  targeted rerun; no application change was made to mask the transient failure.
- Privacy gates passed. This matrix uses the test database/storage adapters;
  it does not certify hosted storage or replace live authorization acceptance.

## Remaining storage work

The staging Supabase project has no buckets, while current native upload routes
expect S3 and have no explicit S3 credentials. Provider setup must use existing
or free capacity and preserve private/public object boundaries. The legacy
private Home route still persists seven-day signed URLs; previously issued URLs
remain capabilities until expiration. This repair gates listing and upload,
not revocation of already-issued download URLs. Complete the download lifetime,
authorized retrieval and live upload/delete matrix before declaring storage
acceptance complete. No hosted file, bucket or production state changed here.
