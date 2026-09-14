// Actual role-omitted review baseline. Default: retained functions without DDL.
// --accepted-review-source temporarily installs only already accepted prerequisites.
// Neither mode installs the candidate admission or contacts delivery providers.
// Run only after the shared replay database writer lease is explicitly granted.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const [container, project, cli, output, lease, accepted] = process.argv.slice(2);
assert(accepted === undefined || accepted === '--accepted-review-source');
let fixture;
(async () => {
  const mode = accepted ? 'accepted-review-baseline' : 'review-baseline';
  fixture = require('./home-residency-legacy-http-fixture.cjs')({ container, project, cli, output, lease, mode });
  const { homes: [home], users, q, id } = fixture;
  try {
    await fixture.start();
    const reviewSources = fixture.functions().filter(value => ['review_home_residency', 'decide_home_residency_review',
      'home_residency_review_authority', 'lock_home_residency_review_scope'].includes(value.name));
    const review = reviewSources.find(value => value.name === 'review_home_residency'); assert(review);
    const acceptedPath = 'supabase/migrations/20260912010000_home_postcard_verification_recovery.sql';
    const migration = fs.readFileSync(path.join(fixture.root, acceptedPath), 'utf8');
    const acceptedBody = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.review_home_residency('))
      .split('AS $$')[1]?.split('$$;')[0];
    const actualBody = review.definition.match(/AS \$function\$([\s\S]*)\$function\$/)?.[1];
    assert(acceptedBody && actualBody, 'Could not bind actual review function body to accepted source');
    const sameBody = acceptedBody.trim() === actualBody.trim();
    if (accepted) assert(sameBody, 'Temporary review body differs from exact accepted source');
    fixture.save('review-source.json', { mode, accepted_source: acceptedPath,
      accepted_source_sha256: crypto.createHash('sha256').update(migration).digest('hex'),
      actual_body_matches_accepted: sameBody, functions: reviewSources });
    fixture.sql(`BEGIN;INSERT INTO public."HomeResidencyClaim"(id,home_id,user_id,claimed_role,status)
      VALUES(${q(id(500))},${q(home)},${q(users[1])},'household','pending');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verification_status)
      VALUES(${q(home)},${q(users[1])},'member','restricted_member',true,'pending_approval');COMMIT;`);
    const before = fixture.snapshot();
    const omitted = await fixture.request(`/api/homes/${home}/claim/${id(500)}/approve`, 0, {});
    assert.equal(omitted.status, 403); assert.equal(omitted.body.code, 'RESIDENCY_ROLE_FORBIDDEN');
    assert.deepEqual(fixture.snapshot(), before, 'Refused omitted-role approval changed admission');
    const explicit = await fixture.request(`/api/homes/${home}/claim/${id(500)}/approve`, 0, { proposed_role: 'member' });
    assert.equal(explicit.status, 200); assert.equal(explicit.body.claim.status, 'verified');
    assert.equal(explicit.body.receipt.legacy_request, true);
    const after = fixture.snapshot();
    assert.equal(after.HomeResidencyReviewReceipt.length, 1); assert.equal(after.HomeOccupancy[0].role_base, 'member');
    fixture.save('result.json', { pass: true, cases: 2, omitted_role_refused: true,
      complete_admission_unchanged_on_refusal: true, explicit_member_approved: true,
      source_scope: accepted ? 'Exact already accepted review body, temporary prerequisites; candidate admission not installed'
        : 'Retained review function; current unchanged review route/service; compare actual_body_matches_accepted before extending conclusion',
      actual_review_body_matches_accepted: sameBody,
      provider_delivery: false, baseline_only: true, production_source: fixture.sourceBefore });
  } finally { await fixture.cleanup(); }
  console.log('PASS: actual omitted household review baseline; explicit member succeeds; exact retained database restored');
})().catch(error => {
  if (fixture) fixture.save('failure.json', { message: error.message, stack: error.stack });
  console.error('FAIL: inspect the private R02 review baseline evidence'); process.exitCode = 1;
});
