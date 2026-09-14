// R02 real HTTP -> SDK -> SQL acceptance, with exact isolated fixture restoration.
// No caller UUID or reviewed address is manufactured for a legacy /claim POST.
const assert = require('node:assert/strict');
const [container, project, cli, output, lease] = process.argv.slice(2);
let fixture;
(async () => {
  fixture = require('./home-residency-legacy-http-fixture.cjs')({ container, project, cli, output, lease, mode: 'candidate' });
  const { homes, users, q, id, sql } = fixture, home = homes[0], cases = [];
  const post = (actor, body = {}, homeId = home) => fixture.request(`/api/homes/${homeId}/claim`, actor, body);
  const rows = (table, actor, homeId = home) => fixture.snapshot()[table].filter(row => row.home_id === homeId && row.user_id === users[actor]);
  const recorded = label => cases.push(label);
  const saved = (response, status = 201) => {
    assert.equal(response.status, status); assert.equal(response.body.claim.status, 'pending');
    assert.equal(response.body.postcard_requested, false); assert.equal(response.body.current_access, 'not_checked');
    assert.equal(response.body.verification_needed, true); assert.equal(response.body.request_id, undefined);
    assert.equal(response.body.command, undefined); assert.equal(response.body.replayed, undefined);
    const actual = rows('HomeResidencyClaim', users.indexOf(response.body.claim.user_id), response.body.claim.home_id)[0];
    for (const key of Object.keys(response.body.claim)) assert.deepEqual(response.body.claim[key], actual[key], `Response did not reflect committed claim ${key}`);
    return response.body.claim;
  };
  async function refused(actor, body, code, status = 409, homeId = home) {
    const before = fixture.snapshot(), response = await post(actor, body, homeId);
    assert.equal(response.status, status); assert.equal(response.body.code, code);
    assert.deepEqual(fixture.snapshot(), before, 'Refused legacy input changed admission');
  }
  try {
    await fixture.start();
    const first = saved(await post(1, { claimed_address: 'Unreviewed legacy assertion' }));
    assert.equal(first.claimed_role, 'member'); assert.equal(first.claimed_address, 'Unreviewed legacy assertion');
    assert.equal(first.cold_start_mode, null); assert.equal(rows('HomeOccupancy', 1)[0].role_base, 'restricted_member');
    assert.equal(rows('HomeOccupancy', 1)[0].verification_status, 'pending_approval');
    assert.equal(fixture.snapshot().HomeResidencySubmissionCommand.length, 0);
    assert.equal(fixture.notices.length, 1); assert.deepEqual(fixture.notices[0].values.map(value => value.userId), [users[0]]);
    assert(fixture.notices[0].values.every(value => !value.body.includes('Unreviewed') && !value.body.includes('Owned R02')));
    recorded('Committed default member claim and restricted pending admission; unreviewed assertion retained; generic current owner-only notice attempted');

    const duplicateBefore = fixture.snapshot(), noticesBefore = fixture.notices.length;
    saved(await post(1), 200); assert.deepEqual(fixture.snapshot(), duplicateBefore); assert.equal(fixture.notices.length, noticesBefore);
    await refused(1, { claimed_role: 'tenant' }, 'RESIDENCY_EXISTING_REQUEST');
    await refused(1, { claimed_address: 'Changed pending assertion' }, 'RESIDENCY_EXISTING_REQUEST');
    recorded('Unchanged pending retry creates no row, audit or notice; changed family/address refuses without mutation');

    sql(`INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,claimed_address,status,created_at)
      VALUES(${q(home)},${q(users[2])},'tenant','Historical stranded assertion','pending',NULL);`);
    const stranded = saved(await post(2), 200);
    assert.equal(stranded.claimed_role, 'tenant'); assert.equal(stranded.created_at, null);
    assert.equal(stranded.claimed_address, 'Historical stranded assertion'); assert.equal(rows('HomeOccupancy', 2)[0].role, 'tenant');
    recorded('Stranded pending legacy tenant gains one restricted pending occupancy without changing raw role/address/nullable history');

    sql(`BEGIN;INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,claimed_address,status,reviewed_by,reviewed_at)
      VALUES(${q(home)},${q(users[3])},'tenant','Rejected assertion','rejected',${q(users[0])},now());
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,is_active,verification_status,start_at,access_end_at,can_manage_tasks)
      VALUES(${q(home)},${q(users[3])},'guest','guest','teen',true,'pending_approval',now()-interval '1 day',now()+interval '1 day',true);
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(users[3])},'home.view',false);
      INSERT INTO public."HomePostcardCode"(home_id,user_id,code_hash,status,dispatch_status,vendor_job_id)
      VALUES(${q(home)},${q(users[3])},repeat('a',64),'pending','accepted','owned-r02-historical-dispatch');COMMIT;`);
    const oldOccupancy = rows('HomeOccupancy', 3), oldCard = rows('HomePostcardCode', 3)[0];
    const resubmitted = saved(await post(3), 200);
    assert.equal(resubmitted.claimed_role, 'tenant'); assert.equal(resubmitted.claimed_address, 'Rejected assertion');
    assert.deepEqual(rows('HomeOccupancy', 3), oldOccupancy);
    assert.equal(rows('HomePermissionOverride', 3)[0].allowed, false);
    const retiredCard = rows('HomePostcardCode', 3)[0]; assert.equal(retiredCard.status, 'cancelled');
    for (const key of Object.keys(oldCard).filter(key => !['status', 'updated_at'].includes(key))) assert.deepEqual(retiredCard[key], oldCard[key]);
    recorded('Rejected tenant omission preserves entire existing occupancy/denies/dates and dispatch evidence; old postcard capability retires');

    sql(`CREATE FUNCTION public.r02_http_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.home_id=${q(home)} AND NEW.actor_user_id=${q(users[4])} AND NEW.action='residency_legacy_submission_saved' THEN
        RAISE EXCEPTION 'Controlled late atomic admission failure' USING ERRCODE='P0042'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER r02_http_audit_failure BEFORE INSERT ON public."HomeAuditLog" FOR EACH ROW EXECUTE FUNCTION public.r02_http_audit_failure();`);
    await refused(4, {}, 'RESIDENCY_LEGACY_UNAVAILABLE', 503);
    sql('DROP TRIGGER r02_http_audit_failure ON public."HomeAuditLog";');
    saved(await post(4)); recorded('Actual late audit exception rolls back complete claim and occupancy; same details succeed after controlled failure ends');

    fixture.loseNextReply(); const lost = await post(5, { claimed_role: 'tenant' });
    assert.equal(lost.status, 503); assert.equal(rows('HomeResidencyClaim', 5).length, 1);
    const afterLost = fixture.snapshot(), noticesAfterLost = fixture.notices.length;
    saved(await post(5, { claimed_role: 'tenant' }), 200);
    assert.deepEqual(fixture.snapshot(), afterLost); assert.equal(fixture.notices.length, noticesAfterLost);
    recorded('Lost committed SDK reply returns uncertainty; retry reads one unchanged admission without duplicate audit or false notification proof');

    fixture.failNextNotice(); saved(await post(6));
    fixture.failNextRpc('get_legacy_home_residency_reviewers'); saved(await post(7));
    recorded('Notice write/read failures preserve successful committed admission and truthful no-postage response');
    const beforeRevocationNotice = fixture.notices.length;
    fixture.beforeNextRpc('get_legacy_home_residency_reviewers', () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed)
      VALUES(${q(homes[1])},${q(users[0])},'members.manage',false);`));
    saved(await post(7, {}, homes[1])); assert.equal(fixture.notices.length, beforeRevocationNotice);
    recorded('Reviewer authority revoked after commit is rechecked before any generic notification attempt');

    const aliases = ['renter', 'tenant', 'lease_resident', 'household', 'member', 'family', 'roommate'];
    for (const [index, alias] of aliases.entries()) {
      const claim = saved(await post(index + 8, { claimed_role: alias })); assert.equal(claim.claimed_role, alias);
      assert.equal(rows('HomeOccupancy', index + 8)[0].role_base, 'restricted_member');
    }
    recorded('All seven residential aliases preserve raw legacy role and share canonical pending admission');
    for (const role of ['owner', 'admin', 'manager', 'property_manager']) await refused(23, { claimed_role: role }, 'OWNERSHIP_FLOW_REQUIRED');
    for (const role of ['guest', 'caregiver', 'restricted_member', 'service_provider', 'unknown']) await refused(23, { claimed_role: role }, 'RESIDENCY_SUBMISSION_INVALID', 400);
    for (const body of [{ claimed_role: [] }, { claimed_address: false }, { request_id: id(801) }, { claimed_address: 'x'.repeat(1001) }]) {
      await refused(23, body, 'RESIDENCY_SUBMISSION_INVALID', 400);
    }
    recorded('Elevated roles use ownership flow; unsupported/malformed inputs cannot write or invent legacy proof');

    sql(`BEGIN;INSERT INTO public."HomeResidencyClaim"(home_id,user_id,claimed_role,status) VALUES(${q(home)},${q(users[15])},'member','verified');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,end_at,verification_status)
      VALUES(${q(home)},${q(users[16])},'guest','guest',false,now()-interval '1 day','unverified');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,start_at,verification_status)
      VALUES(${q(home)},${q(users[17])},'member','member',true,now()+interval '1 day','pending_approval');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verified_at,verification_status)
      VALUES(${q(home)},${q(users[18])},'member','member',true,now()-interval '1 day','unverified');COMMIT;`);
    await refused(15, {}, 'RESIDENCY_ALREADY_VERIFIED');
    for (const actor of [16, 17, 18]) await refused(actor, {}, 'MEMBERSHIP_RENEWAL_REQUIRED');
    await refused(0, {}, 'OWNERSHIP_FLOW_REQUIRED');
    recorded('Verified claims, inactive/ended/future/prior-verified occupancies and owner records remain unchanged without renewal or retemplating');

    sql(`BEGIN;DELETE FROM public."HomeOwner" WHERE home_id IN(${q(homes[3])},${q(homes[4])},${q(homes[5])});
      UPDATE public."Home" SET created_by_user_id=${q(users[19])} WHERE id=${q(homes[3])};
      UPDATE public."Home" SET created_by_user_id=${q(users[20])} WHERE id=${q(homes[4])};
      UPDATE public."User" SET date_of_birth=current_date-interval '10 years' WHERE id=${q(users[20])};COMMIT;`);
    const bootstrap = saved(await post(19, { claimed_role: 'renter' }, homes[3]));
    assert.equal(bootstrap.cold_start_mode, 'self_bootstrap');
    assert.equal(rows('HomeOccupancy', 19, homes[3])[0].role_base, 'lease_resident');
    assert.equal(rows('HomeOccupancy', 19, homes[3])[0].verification_status, 'provisional_bootstrap');
    const child = saved(await post(20, { claimed_role: 'household' }, homes[4]));
    assert.equal(child.cold_start_mode, 'self_bootstrap');
    assert.equal(rows('HomeOccupancy', 20, homes[4])[0].age_band, 'child');
    assert.equal(rows('HomeOccupancy', 20, homes[4])[0].can_manage_tasks, false);
    const external = saved(await post(21, {}, homes[5])); assert.equal(external.cold_start_mode, 'external_postcard');
    sql(`UPDATE auth.users SET last_sign_in_at=now()-interval '60 days' WHERE id=${q(users[0])};`);
    const stale = saved(await post(22, {}, homes[6])); assert.equal(stale.cold_start_mode, 'stale_authority_postcard');
    sql(`UPDATE auth.users SET last_sign_in_at=now() WHERE id=${q(users[0])};`);
    assert.equal(fixture.snapshot().HomePostcardCode.length, 1);
    recorded('Bootstrap response reflects committed routing; age ceiling preserved; external/stale routing requests no postage');

    sql(`UPDATE public."Home" SET home_status='archived' WHERE id=${q(homes[7])};UPDATE public."Home" SET security_state='frozen' WHERE id=${q(homes[8])};`);
    await refused(23, {}, 'RESIDENCY_HOME_UNAVAILABLE', 403, homes[7]);
    await refused(23, {}, 'RESIDENCY_HOME_UNAVAILABLE', 403, homes[8]);
    recorded('Current archived/frozen Home refuses without partial admission');

    const protectedHome = homes[9], requestId = id(800), cancelId = id(802);
    const intent = { request_id: requestId, claimed_role: 'household', address: {
      line1: 'Owned R02 HTTP Home', line2: 'Unit 2', city: 'Test', state: 'WA', postal_code: '98607', country: 'US' } };
    const submitPath = `/api/homes/${protectedHome}/residency-submissions`;
    const protectedResult = await fixture.request(submitPath, 23, intent); assert.equal(protectedResult.status, 201);
    assert.equal(protectedResult.body.state, 'completed');
    const original = await fixture.request(submitPath + '/' + requestId, 23, null, 'GET'); assert.equal(original.status, 200);
    const receiptBefore = fixture.snapshot().HomeResidencySubmissionCommand;
    saved(await post(23, {}, protectedHome), 200);
    sql(`UPDATE public."Home" SET address2='Unit 3' WHERE id=${q(protectedHome)};`);
    assert.deepEqual((await fixture.request(submitPath, 23, intent)).body, original.body);
    assert.deepEqual((await fixture.request(submitPath + '/' + requestId + '/cancel', 23)).body, original.body);
    assert.deepEqual(fixture.snapshot().HomeResidencySubmissionCommand, receiptBefore);
    const rejected = await fixture.request(submitPath, 23, { ...intent, request_id: id(803) });
    assert.equal(rejected.status, 409); assert.equal(rejected.body.state, 'rejected'); assert.equal(rejected.body.code, 'RESIDENCY_ADDRESS_CHANGED');
    assert.equal((await fixture.request(submitPath + '/' + cancelId + '/cancel', 23)).body.state, 'cancelled');
    assert.equal((await fixture.request(submitPath, 23, { ...intent, request_id: cancelId })).body.state, 'cancelled');
    recorded('Protected exact original/projection survives legacy read/address change; fresh stale address rejects and cancel tombstone fences delayed POST');

    const householdClaim = rows('HomeResidencyClaim', 11)[0];
    const approved = await fixture.request(`/api/homes/${home}/claim/${householdClaim.id}/approve`, 0);
    assert.equal(approved.status, 200); assert.equal(approved.body.claim.status, 'verified');
    assert.equal(approved.body.occupancy.role_base, 'member'); assert.equal(approved.body.receipt.legacy_request, true);
    recorded('Role-omitted legacy reviewer accepts canonical household alias as member under current review policy');

    assert.equal(fixture.snapshot().HomeResidencySubmissionCommand.length, 3);
    assert.equal(fixture.snapshot().HomePostcardRequestCommand.length, 0);
    assert.equal(fixture.snapshot().HomePostcardVerificationCommand.length, 0);
    fixture.save('result.json', { pass: true, cases, case_count: cases.length,
      http_calls: fixture.events.filter(value => value.event === 'http').length,
      actual_sdk_calls: fixture.events.filter(value => value.event === 'actual_sdk_rpc').length,
      legacy_fabricated_commands: 0, controlled_notice_attempts: fixture.notices.length,
      provider_delivery: false, ui_acceptance: false, permanent_adoption: false, production_source: fixture.sourceBefore });
  } finally { await fixture.cleanup(); }
  console.log('PASS: actual R02 HTTP/SDK/SQL compatibility acceptance and complete retained database restoration');
})().catch(error => {
  if (fixture) fixture.save('failure.json', { message: error.message, stack: error.stack });
  console.error('FAIL: inspect private R02 HTTP acceptance evidence'); process.exitCode = 1;
});
