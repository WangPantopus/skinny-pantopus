// Observed competing transactions through the actual HTTP/SDK boundary.
// Requires the exclusive owned replay DB lease and restores its complete state.
const assert = require('node:assert/strict'), { spawn } = require('node:child_process');
const [container, project, cli, output, lease] = process.argv.slice(2);
let fixture, connection;
class Connection {
  constructor() {
    this.process = spawn('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']);
    this.buffer = ''; this.errors = ''; this.serial = 0; this.pending = null;
    this.process.stdout.on('data', chunk => {
      this.buffer += chunk.toString();
      while (this.buffer.includes('\n')) {
        const end = this.buffer.indexOf('\n'), line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        if (this.pending && line === this.pending.marker) {
          const pending = this.pending; this.pending = null; clearTimeout(pending.timer); pending.resolve(pending.lines);
        } else if (this.pending) this.pending.lines.push(line);
      }
    });
    this.process.stderr.on('data', chunk => { this.errors += chunk.toString(); });
    this.process.on('exit', () => {
      if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('Owned concurrency transaction exited; inspect private error')); this.pending = null; }
    });
  }
  run(query) {
    assert.equal(this.pending, null);
    return new Promise((resolve, reject) => {
      const marker = 'R02_CONCURRENCY_DONE_' + ++this.serial;
      const timer = setTimeout(() => reject(new Error('Owned concurrency transaction timed out')), 15000);
      this.pending = { marker, resolve, reject, timer, lines: [] };
      this.process.stdin.write(query + `\nSELECT '${marker}';\n`);
    });
  }
  async close() {
    if (this.process.exitCode === null) {
      this.process.stdin.end('ROLLBACK;\n\\q\n');
      await new Promise(resolve => {
        const timer = setTimeout(() => { this.process.kill(); resolve(); }, 5000);
        this.process.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
  }
}
(async () => {
  fixture = require('./home-residency-legacy-http-fixture.cjs')({ container, project, cli, output, lease, mode: 'candidate' });
  const { homes, users, q, id, sql } = fixture, actor = users[1], owner = users[0], cases = [];
  const intent = { claimed_role: 'household', address: { line1: 'Owned R02 HTTP Home', line2: 'Unit 2', city: 'Test', state: 'WA', postal_code: '98607', country: 'US' } };
  const admission = (index, body = {}) => `SELECT public.submit_legacy_home_residency(${q(homes[index])},${q(actor)},${q(JSON.stringify(body))})::text;`;
  const protectedAdmission = index => `SELECT public.submit_home_residency(${q(homes[index])},${q(actor)},${q(id(800 + index))},${q(JSON.stringify(intent))})::text;`;
  const post = (index, body = {}, protectedRequest = false) => fixture.request(`/api/homes/${homes[index]}/${protectedRequest ? 'residency-submissions' : 'claim'}`, 1,
    protectedRequest ? { ...intent, request_id: id(800 + index), ...body } : body);
  const state = index => Object.fromEntries(Object.entries(fixture.snapshot()).map(([table, rows]) => [table, rows.filter(row => (table === 'Home' ? row.id : row.home_id) === homes[index])]));
  async function waitForBlocked(name) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const count = fixture.read(`SELECT count(*) FROM pg_stat_activity WHERE datname='postgres' AND wait_event_type='Lock'
        AND query LIKE ${q('%' + name + '%')} AND application_name IS DISTINCT FROM 'r02_legacy_winner';`);
      if (count > 0) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('Expected an observed actual SDK transaction lock wait');
  }
  async function finish(pending, name = 'submit_legacy_home_residency') {
    await waitForBlocked(name); await connection.run('COMMIT;'); return pending;
  }
  try {
    await fixture.start(); connection = new Connection();
    await connection.run("SET application_name='r02_legacy_winner';SET statement_timeout='15s';SET lock_timeout='5s';");

    await connection.run('BEGIN;'); const first = JSON.parse((await connection.run(admission(0)))[0]); assert.equal(first.ok, true);
    let response = await finish(post(0)); assert.equal(response.status, 200);
    let current = state(0); assert.equal(current.HomeResidencyClaim.length, 1); assert.equal(current.HomeOccupancy.length, 1);
    assert.equal(current.HomeAuditLog.length, 1); assert.equal(current.HomeResidencySubmissionCommand.length, 0);
    cases.push('Duplicate legacy requests serialize to one unchanged claim/occupancy/audit without invented command');

    await connection.run('BEGIN;'); await connection.run(admission(1, { claimed_role: 'tenant' }));
    response = await finish(post(1, { claimed_role: 'household' }));
    assert.equal(response.status, 409); assert.equal(response.body.code, 'RESIDENCY_EXISTING_REQUEST');
    current = state(1); assert.equal(current.HomeResidencyClaim[0].claimed_role, 'tenant'); assert.equal(current.HomeAuditLog.length, 1);
    cases.push('Competing different family cannot replace the first committed pending request');

    await connection.run('BEGIN;'); const legacyFirst = JSON.parse((await connection.run(admission(2, { claimed_role: 'member' })))[0]);
    response = await finish(post(2, {}, true), 'submit_home_residency');
    assert.equal(response.status, 201); assert.equal(response.body.state, 'completed'); assert.equal(response.body.claim_id, legacyFirst.claim.id);
    current = state(2); assert.equal(current.HomeOccupancy.length, 1); assert.equal(current.HomeResidencySubmissionCommand.length, 1);
    assert.equal(current.HomeAuditLog.length, 2); assert.equal(current.HomeResidencyClaim[0].claimed_role, 'member');
    cases.push('Legacy then protected request share admission while only the actual protected UUID gains a receipt');

    await connection.run('BEGIN;'); const protectedFirst = JSON.parse((await connection.run(protectedAdmission(3)))[0]);
    response = await finish(post(3)); assert.equal(response.status, 200); assert.equal(response.body.claim.id, protectedFirst.claim_id);
    current = state(3); assert.equal(current.HomeResidencySubmissionCommand.length, 1); assert.equal(current.HomeAuditLog.length, 1);
    cases.push('Protected then legacy request preserve the original receipt and complete pending admission without duplicate audit');

    await connection.run(`BEGIN;UPDATE public."Home" SET home_status='archived' WHERE id=${q(homes[4])};`);
    response = await finish(post(4)); assert.equal(response.status, 403); assert.equal(response.body.code, 'RESIDENCY_HOME_UNAVAILABLE');
    current = state(4); assert.equal(current.HomeResidencyClaim.length, 0); assert.equal(current.HomeOccupancy.length, 0);
    cases.push('Home archival committed during the wait rejects without partial admission');

    await connection.run(`BEGIN;SELECT id FROM public."Home" WHERE id=${q(homes[5])} FOR UPDATE;
      UPDATE public."HomeOwner" SET owner_status='revoked' WHERE home_id=${q(homes[5])};`);
    response = await finish(post(5)); assert.equal(response.status, 201); assert.equal(response.body.routing, 'external_postcard');
    assert.equal(state(5).HomePostcardCode.length, 0);
    cases.push('Reviewer revocation during the wait selects current external routing without postage');

    sql(`INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verification_status)
      VALUES(${q(homes[6])},${q(actor)},'member','restricted_member',true,'pending_approval');`);
    await connection.run(`BEGIN;SELECT id FROM public."Home" WHERE id=${q(homes[6])} FOR UPDATE;
      UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(homes[6])} AND user_id=${q(actor)};`);
    response = await finish(post(6)); assert.equal(response.status, 409); assert.equal(response.body.code, 'MEMBERSHIP_RENEWAL_REQUIRED');
    current = state(6); assert.equal(current.HomeResidencyClaim.length, 0); assert.equal(current.HomeOccupancy[0].is_active, false);
    cases.push('Concurrent removal cannot be reactivated by legacy resubmission');

    await connection.run(`BEGIN;SELECT id FROM public."Home" WHERE id=${q(homes[7])} FOR UPDATE;
      INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(homes[7])},${q(owner)},'members.manage',false);`);
    response = await finish(post(7)); assert.equal(response.status, 201); assert.equal(response.body.routing, 'external_postcard');
    cases.push('Explicit current reviewer deny committed during wait overrides owner-record routing');

    await connection.run(`BEGIN;UPDATE public."Home" SET address2='Unit 9' WHERE id=${q(homes[8])};`);
    response = await finish(post(8, {}, true), 'submit_home_residency');
    assert.equal(response.status, 409); assert.equal(response.body.code, 'RESIDENCY_ADDRESS_CHANGED');
    current = state(8); assert.equal(current.HomeResidencyClaim.length, 0); assert.equal(current.HomeResidencySubmissionCommand[0].state, 'rejected');
    cases.push('Protected selected apartment still fences a concurrent address change after helper extraction');

    sql(`INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,is_active,verification_status,access_end_at)
      VALUES(${q(homes[9])},${q(actor)},'member','restricted_member',true,'pending_approval',clock_timestamp()+interval '1 second');`);
    await connection.run(`BEGIN;SELECT id FROM public."Home" WHERE id=${q(homes[9])} FOR UPDATE;`);
    const expiring = post(9); await waitForBlocked('submit_legacy_home_residency');
    await new Promise(resolve => setTimeout(resolve, 1100)); await connection.run('COMMIT;'); response = await expiring;
    assert.equal(response.status, 409); assert.equal(response.body.code, 'MEMBERSHIP_RENEWAL_REQUIRED');
    assert.equal(state(9).HomeResidencyClaim.length, 0);
    cases.push('Access expiry uses the clock after lock acquisition and cannot be renewed by waiting request');

    fixture.save('result.json', { pass: true, cases, observed_lock_waits: cases.length,
      provider_delivery: false, permanent_adoption: false, production_source: fixture.sourceBefore });
  } finally {
    if (connection) { await connection.close(); fixture.save('connection.stderr.log.json', { stderr: connection.errors }); }
    await fixture.cleanup();
  }
  console.log('PASS: ten observed R02 admission races through actual SDK/HTTP; exact retained database restored');
})().catch(error => {
  if (fixture) fixture.save('failure.json', { message: error.message, stack: error.stack });
  console.error('FAIL: inspect private R02 concurrency evidence'); process.exitCode = 1;
});
