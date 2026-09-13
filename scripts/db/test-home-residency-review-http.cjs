const assert = require('node:assert/strict');
const f = require('./home-residency-review-http-fixture.cjs')(process.argv[2]);
const { id, q, home, actor, claims, sql } = f;
let server, setup = false;
const counts = () => JSON.parse(sql(`SELECT jsonb_build_object('receipts',(SELECT count(*) FROM public."HomeResidencyReviewReceipt" WHERE home_id=${q(home)}),
 'audits',(SELECT count(*) FROM public."HomeAuditLog" WHERE home_id=${q(home)}))::text;`));
const member = u => JSON.parse(sql(`SELECT to_jsonb(o)::text FROM public."HomeOccupancy" o WHERE home_id=${q(home)} AND user_id=${q(u)};`));
async function main() {
  try {
    f.setup(); setup = true;
    server = await new Promise(resolve => { const s = f.app.listen(0, '127.0.0.1', () => resolve(s)); });
    const send = async (claim, action, body, headers = {}) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/homes/${home}/claim/${claim}/${action}`, {
        method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
      });
      return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
    };
    const review = await send(claims[0], 'review'); assert.equal(review.status, 200); assert.equal(review.cache, 'private, no-store');
    const scope = { 'x-pantopus-session-scope': review.body.residency_session.session_scope };
    const original = { proposed_role: 'member', request_id: id(502), review_token: review.body.claim.review_token };
    assert.equal((await send(claims[0], 'approve', { request_id: id(502) }, scope)).status, 400);
    assert.equal((await send(claims[0], 'approve', original)).body.code, 'SESSION_SCOPE_CHANGED');
    assert.equal((await send(claims[0], 'approve', original, { ...scope, 'x-fixture-session': 'changed-session' })).body.code, 'SESSION_SCOPE_CHANGED');
    assert.equal(f.calls, 0);
    f.loseNextReply();
    assert.equal((await send(claims[0], 'approve', original, scope)).status, 503);
    assert.deepEqual(counts(), { receipts: 1, audits: 1 });
    const recovered = await send(claims[0], 'approve', original, scope);
    assert.equal(recovered.status, 200); assert.equal(recovered.body.replayed, true);
    assert.equal(f.notifications.length, 0);
    sql(`UPDATE public."HomeOccupancy" SET is_active=false,verification_status='moved_out' WHERE home_id=${q(home)} AND user_id=${q(f.users[1])};`);
    const movedOut = member(f.users[1]);
    const later = await send(claims[0], 'approve', original, scope);
    assert.equal(later.status, 200); assert.deepEqual(later.body.receipt, recovered.body.receipt);
    assert.equal(later.body.occupancy.is_active, false); assert.deepEqual(member(f.users[1]), movedOut);
    assert.deepEqual(counts(), { receipts: 1, audits: 1 });
    assert.equal((await send(claims[0], 'approve', { ...original, proposed_role: 'guest' }, scope)).body.code, 'RESIDENCY_REVIEW_REQUEST_CHANGED');
    console.log('PASS: prepared identity, lost approval reply, original recovery and later move-out without reactivation');

    const legacy = await send(claims[1], 'reject', { reason: ' Original reason ' });
    assert.equal(legacy.status, 200); assert.equal(f.notifications.length, 1);
    sql(`UPDATE public."HomeResidencyClaim" SET status='pending',reviewed_by=NULL,reviewed_at=NULL,review_note=NULL,updated_at=clock_timestamp() WHERE id=${q(claims[1])};`);
    const retried = await send(claims[1], 'reject', { reason: 'Original reason' });
    assert.equal(retried.status, 200); assert.deepEqual(retried.body.receipt, legacy.body.receipt);
    assert.equal(retried.body.claim.status, 'pending'); assert.equal(f.notifications.length, 1);
    const fresh = await send(claims[1], 'review');
    const rejected = await send(claims[1], 'reject', { reason: 'Fresh decision', request_id: id(503), review_token: fresh.body.claim.review_token }, scope);
    assert.equal(rejected.status, 200); assert.equal(rejected.body.replayed, false);
    assert.notEqual(rejected.body.receipt.id, legacy.body.receipt.id);
    assert.deepEqual(counts(), { receipts: 3, audits: 3 });
    console.log('PASS: rejection resubmission keeps historical receipt/current pending separate; a fresh explicit review creates a new decision');

    sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'members.manage',false);`);
    assert.equal((await send(claims[0], 'review')).status, 403);
    assert.equal((await send(claims[0], 'approve', original, scope)).status, 403);
    assert.deepEqual(counts(), { receipts: 3, audits: 3 });
    sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)} AND user_id=${q(actor)} AND permission='members.manage';`);
    assert.equal((await send(claims[0], 'approve', original, scope)).status, 200);
    assert.equal((await send(claims[0], 'review', undefined, { 'x-fixture-actor': f.users[5] })).status, 403);
    assert.equal((await send(id(999), 'review')).status, 404);
    const stale = await send(claims[2], 'review');
    sql(`UPDATE public."HomeOccupancy" SET access_end_at=now()+interval '12 hours' WHERE home_id=${q(home)} AND user_id=${q(f.users[3])};`);
    assert.equal((await send(claims[2], 'approve', { proposed_role: 'member', request_id: id(504), review_token: stale.body.claim.review_token }, scope)).body.code, 'RESIDENCY_REVIEW_CHANGED');
    assert.deepEqual(counts(), { receipts: 3, audits: 3 });
    const current = await send(claims[2], 'review');
    const command = { proposed_role: 'member', request_id: id(504), review_token: current.body.claim.review_token };
    f.failNextNotification();
    assert.equal((await send(claims[2], 'approve', command, scope)).status, 200);
    const notifications = f.notifications.length;
    assert.equal((await send(claims[2], 'approve', command, scope)).body.replayed, true);
    assert.equal(f.notifications.length, notifications);
    assert.deepEqual(counts(), { receipts: 4, audits: 4 });
    console.log('PASS: current authority, session change, foreign claimant, stale membership and notification failure/replay boundaries');

    sql(`CREATE FUNCTION public.residency_http_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.request_id=${q(id(505))}::uuid THEN RAISE EXCEPTION 'Injected receipt failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER residency_http_receipt_failure BEFORE INSERT ON public."HomeResidencyReviewReceipt"
      FOR EACH ROW EXECUTE FUNCTION public.residency_http_receipt_failure();`);
    const before = member(f.users[4]);
    const reviewed = await send(claims[3], 'review');
    assert.equal((await send(claims[3], 'approve', { proposed_role: 'member', request_id: id(505), review_token: reviewed.body.claim.review_token }, scope)).status, 503);
    assert.deepEqual(member(f.users[4]), before);
    assert.equal((await send(claims[3], 'review')).body.claim.status, 'pending');
    assert.deepEqual(counts(), { receipts: 4, audits: 4 });
    assert.equal(f.notifications.length, notifications);
    console.log('PASS: actual receipt insertion failure rolls back membership, claim and audit before HTTP retryable response');
  } finally {
    if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    if (setup) { f.cleanup(); console.log('PASS: exact residency HTTP fixture cleanup'); }
    f.restoreModules();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
