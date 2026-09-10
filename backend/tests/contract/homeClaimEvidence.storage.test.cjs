// Opt-in, real local PostgREST + Storage API + evidence service lifecycle.
// This uses an empty disposable database, synthetic JWT roles and tmpfs bytes.
// It never loads .env, talks to a hosted service or substitutes storage/RPC mocks.
const { describe, before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('@supabase/supabase-js');

describe('Private claim evidence through real local storage', {
  skip: process.env.PANTOPUS_CLAIM_STORAGE_CONTRACT !== '1', timeout: 240_000,
}, () => {
  const project = process.env.PANTOPUS_CLAIM_STORAGE_PROJECT;
  assert.match(project || '', /^pantopus-home-(task-media|claim-evidence)-[a-z0-9-]+$/);
  const database = `supabase_db_${project}`; const network = `supabase_network_${project}`;
  const suffix = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const containers = [];
  const bucket = `claim-contract-${suffix}`; const publicBucket = `claim-public-${suffix}`;
  const owner = randomUUID(); const reviewer = randomUUID(); const admin = randomUUID(); const home = randomUUID(); const claim = randomUUID();
  const privateHome = randomUUID(); const privateClaim = randomUUID();
  const withdrawnClaim = randomUUID();
  const uploads = Array.from({ length: 5 }, () => randomUUID());
  const secret = randomBytes(32).toString('hex');
  const file = { originalname: 'claim-proof.txt', mimetype: 'text/plain', buffer: Buffer.from('Exact private claim bytes.\n') };
  const args = id => ({ homeId: home, claimId: claim, actorId: owner, uploadId: id, evidenceType: 'lease' });
  let db; let browser; let anonymous; let media; let storage; let restOrigin; let storageOrigin;
  let verifiedReview;
  let seeded = false; let bucketsCreated = false;
  let loseUploadReply = false; let failDelete = false; let afterDownload = null;
  const oldBucket = process.env.HOME_DOCUMENTS_BUCKET;
  const adminPath = require.resolve('../../config/supabaseAdmin');
  const oldAdmin = require.cache[adminPath];
  const docker = (...command) => {
    try { return execFileSync('docker', command, { encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
    catch { throw new Error('Isolated local storage Docker operation failed; connection details are not logged'); }
  };
  const sql = input => {
    try { return execFileSync('docker', ['exec', '-i', database, 'psql', '-X', '-qAt', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'],
      { input, encoding: 'utf8', timeout: 25_000, stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
    catch { throw new Error('Isolated local storage fixture SQL failed'); }
  };
  function token(role) {
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, sub: owner, exp: Math.floor(Date.now() / 1000) + 900 })}`;
    return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
  }
  function client(role) {
    return createClient(restOrigin, token(role), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: async (input, init) => {
        const request = new URL(input); assert.equal(request.origin, restOrigin);
        const isStorage = request.pathname.startsWith('/storage/v1/');
        const url = new URL(isStorage ? storageOrigin : restOrigin);
        url.pathname = request.pathname.replace(isStorage ? /^\/storage\/v1/ : /^\/rest\/v1/, ''); url.search = request.search;
        assert.equal(url.hostname, '127.0.0.1');
        const method = init?.method || 'GET';
        if (isStorage && method === 'DELETE' && failDelete) { failDelete = false; throw new Error('Synthetic pre-delete transport interruption'); }
        const response = await fetch(url, init);
        if (isStorage && method === 'POST' && url.pathname.startsWith('/object/') && loseUploadReply && response.ok) {
          loseUploadReply = false; await response.arrayBuffer(); throw new Error('Synthetic lost reply after actual immutable PUT');
        }
        if (isStorage && method === 'GET' && url.pathname.startsWith('/object/') && afterDownload && response.ok) {
          const action = afterDownload; afterDownload = null; action();
        }
        return response;
      } },
    });
  }
  async function launch(name, port, image, env, extra = []) {
    docker('run', '--rm', '--pull=never', '-d', '--name', name, '--network', network, '-p', `127.0.0.1::${port}`,
      ...env.flatMap(([key, value]) => ['-e', `${key}=${value}`]), ...extra, image);
    containers.push(name);
    return `http://127.0.0.1:${docker('port', name, `${port}/tcp`).split(':').pop()}`;
  }
  async function ref(id) {
    const result = await db.rpc('get_home_claim_evidence', { p_home_id: home, p_claim_id: claim, p_actor_id: owner, p_upload_id: id, p_platform_admin: false });
    assert.ifError(result.error); assert.equal(result.data.ok, true); return result.data.storage;
  }
  before(async () => {
    assert.equal(sql('SELECT count(*) FROM public."User"'), '0', 'requires an empty disposable app database');
    assert.equal(sql('SELECT count(*) FROM public."HomeClaimEvidenceIntent"'), '0');
    docker('network', 'inspect', network);
    restOrigin = await launch(`pantopus-evidence-rest-${suffix}`, 3000,
      'postgrest/postgrest:v14.10@sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1', [
        ['PGRST_DB_URI', `postgres://authenticator:postgres@${database}:5432/postgres`],
        ['PGRST_DB_ANON_ROLE', 'anon'], ['PGRST_DB_SCHEMAS', 'public'], ['PGRST_JWT_SECRET', secret],
      ]);
    storageOrigin = await launch(`pantopus-evidence-storage-${suffix}`, 5000,
      'public.ecr.aws/supabase/storage-api@sha256:528ec49c3c32561908b07ee91bced7f8456f3b688164e341eaa422441767a0bd', [
        ['DATABASE_URL', `postgres://supabase_storage_admin:postgres@${database}:5432/postgres`],
        ['AUTH_JWT_SECRET', secret], ['STORAGE_BACKEND', 'file'], ['FILE_STORAGE_BACKEND_PATH', '/var/lib/storage'],
        ['FILE_SIZE_LIMIT', '26214400'], ['TENANT_ID', 'evidence-contract'], ['LOG_LEVEL', 'fatal'],
      ], ['--tmpfs', '/var/lib/storage:mode=1777']);
    db = client('service_role'); browser = client('authenticated'); anonymous = client('anon');
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const [rpc, storageResult] = await Promise.all([db.from('HomeClaimEvidenceIntent').select('id').limit(1), db.storage.listBuckets()]);
        if (!rpc.error && !storageResult.error) { ready = true; break; }
      } catch {}
      await delay(500);
    }
    assert.ok(ready, 'isolated local PostgREST and Storage API must become ready');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES('${owner}','evidence-claimant@example.invalid'),('${reviewer}','evidence-reviewer@example.invalid'),('${admin}','evidence-admin@example.invalid');
      INSERT INTO public."User"(id,email,username,role) SELECT id,email,'evidence_'||left(id::text,8),CASE WHEN id='${admin}' THEN 'admin' ELSE 'user' END
        FROM auth.users WHERE id IN ('${owner}','${reviewer}','${admin}');
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
      VALUES('${home}','${reviewer}','${reviewer}','Synthetic evidence home','Test','WA','98607'),
        ('${privateHome}','${owner}','${owner}','Synthetic private evidence','Test','WA','98607');
      INSERT INTO public."HomeOwner"(home_id,subject_id,owner_status,is_primary_owner,verification_tier)
      VALUES('${home}','${reviewer}','verified',true,'strong'),('${privateHome}','${owner}','pending',true,'weak');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
      VALUES('${home}','${reviewer}','owner','owner','adult','verified'),('${home}','${owner}','member','member','adult','pending_doc'),
        ('${privateHome}','${owner}','owner','owner','adult','pending_doc');
      INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at)
      VALUES('${claim}','${home}','${owner}','resident','submitted','doc_upload','evidence_submitted','verified',now()+interval '1 day'),
        ('${privateClaim}','${privateHome}','${owner}','owner','submitted','doc_upload','evidence_submitted','verified',now()+interval '1 day');
      COMMIT;`); seeded = true;
    assert.ifError((await db.storage.createBucket(bucket, { public: false })).error); bucketsCreated = true;
    assert.ifError((await db.storage.createBucket(publicBucket, { public: true })).error);
    process.env.HOME_DOCUMENTS_BUCKET = bucket;
    require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: db };
    storage = require('../../services/homeClaimEvidenceStorage'); media = require('../../services/homeClaimEvidenceService');
  });
  after(async () => {
    try {
      if (bucketsCreated) for (const name of [bucket, publicBucket]) {
        assert.ifError((await db.storage.emptyBucket(name)).error); assert.ifError((await db.storage.deleteBucket(name)).error);
      }
    } finally {
      try {
        if (seeded) {
          sql(`BEGIN;
            DELETE FROM public."HomeClaimEvidenceInspection" WHERE upload_id IN (SELECT id FROM public."HomeClaimEvidenceIntent" WHERE original_home_id IN ('${home}','${privateHome}'));
            ALTER TABLE public."HomeVerificationEvidence" DISABLE TRIGGER protect_home_claim_evidence_record;
            DELETE FROM public."HomeVerificationEvidence" WHERE claim_id IN ('${claim}','${privateClaim}','${withdrawnClaim}');
            ALTER TABLE public."HomeVerificationEvidence" ENABLE TRIGGER protect_home_claim_evidence_record;
            ALTER TABLE public."File" DISABLE TRIGGER protect_home_claim_evidence_file;
            DELETE FROM public."File" WHERE user_id='${owner}';
            ALTER TABLE public."File" ENABLE TRIGGER protect_home_claim_evidence_file;
            ALTER TABLE public."HomeClaimEvidenceIntent" DISABLE TRIGGER protect_home_claim_evidence_intent;
            DELETE FROM public."HomeClaimEvidenceIntent" WHERE original_home_id IN ('${home}','${privateHome}');
            ALTER TABLE public."HomeClaimEvidenceIntent" ENABLE TRIGGER protect_home_claim_evidence_intent;
            DELETE FROM public."Home" WHERE id IN ('${home}','${privateHome}');
            DELETE FROM public."User" WHERE id IN ('${owner}','${reviewer}','${admin}');
            DELETE FROM auth.users WHERE id IN ('${owner}','${reviewer}','${admin}'); COMMIT;`);
          assert.equal(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('${home}','${privateHome}'))+
            (SELECT count(*) FROM public."User" WHERE id IN ('${owner}','${reviewer}','${admin}'))+
            (SELECT count(*) FROM auth.users WHERE id IN ('${owner}','${reviewer}','${admin}'))+
            (SELECT count(*) FROM public."HomeClaimEvidenceIntent" WHERE original_home_id IN ('${home}','${privateHome}'))+
            (SELECT count(*) FROM public."HomeVerificationEvidence" WHERE claim_id IN ('${claim}','${privateClaim}','${withdrawnClaim}'))+
            (SELECT count(*) FROM public."HomeClaimReviewReceipt" WHERE home_id IN ('${home}','${privateHome}'))+
            (SELECT count(*) FROM public."File" WHERE user_id='${owner}')`), '0', 'all exact application fixtures removed');
        }
      } finally {
        if (oldBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET; else process.env.HOME_DOCUMENTS_BUCKET = oldBucket;
        if (oldAdmin === undefined) delete require.cache[adminPath]; else require.cache[adminPath] = oldAdmin;
        for (const name of containers.reverse()) docker('rm', '-f', name);
      }
    }
  });
  it('stores exact pending bytes without granting claim authority or exposing direct paths', async () => {
    const record = await media.upload(args(uploads[0]), file);
    assert.equal(record.id, uploads[0]); assert.equal(record.status, 'pending'); assert.equal(record.eligible_for_review, false);
    assert.deepEqual((await media.download(args(uploads[0]))).bytes, file.buffer);
    assert.equal(sql(`SELECT count(*) FROM public."HomeOwner" WHERE home_id='${home}' AND subject_id='${owner}'`), '0');
    const reference = await ref(uploads[0]);
    for (const client of [anonymous, browser]) {
      assert.ok((await client.storage.from(bucket).download(storage.key(reference))).error);
      const files = await client.from('File').select('id,file_url,file_path').eq('id', uploads[0]);
      assert.ifError(files.error); assert.deepEqual(files.data, []);
      assert.equal((await client.rpc('get_home_claim_evidence', { p_home_id: home, p_claim_id: claim, p_actor_id: owner })).error?.code, '42501');
    }
    assert.notEqual((await fetch(`${storageOrigin}/object/public/${bucket}/${storage.key(reference)}`)).status, 200);
    assert.equal(JSON.stringify(record).includes('claim-evidence/'), false);
  });
  it('recovers a lost actual provider reply with one reservation and quota charge', async () => {
    loseUploadReply = true; assert.equal((await media.upload(args(uploads[1]), file)).status, 'pending'); assert.equal(loseUploadReply, false);
    const quota = sql(`SELECT storage_used||':'||file_count FROM public."FileQuota" WHERE user_id='${owner}'`);
    await media.upload(args(uploads[1]), file); assert.equal(sql(`SELECT storage_used||':'||file_count FROM public."FileQuota" WHERE user_id='${owner}'`), quota);
  });
  it('requires actual reviewer inspection and retries only the exact successful verification receipt', async () => {
    const review = { ...args(uploads[0]), actorId: reviewer };
    const reviewToken = (await media.authorize(review, 'verify')).review_token;
    const download = await media.download({ ...review, reviewToken }); assert.deepEqual(download.bytes, file.buffer);
    assert.match(download.inspection, /^[a-f0-9]{64}$/);
    await assert.rejects(media.verify({ ...review, reviewToken, inspection: 'f'.repeat(64) }), error => error.code === 'CLAIM_EVIDENCE_INSPECTION_REQUIRED');
    const verified = await media.verify({ ...review, reviewToken, inspection: download.inspection }); assert.equal(verified.record.status, 'verified');
    assert.equal((await media.verify({ ...review, reviewToken, inspection: download.inspection })).replayed, true);
    assert.equal(sql(`SELECT state FROM public."HomeOwnershipClaim" WHERE id='${claim}'`), 'submitted');
    assert.equal(sql(`SELECT count(*) FROM public."HomeOwner" WHERE home_id='${home}' AND subject_id='${owner}'`), '0');
    await assert.rejects(media.remove(args(uploads[0])), error => error.code === 'CLAIM_EVIDENCE_RETENTION_REQUIRED');
    verifiedReview = verified;
  });
  it('withholds fetched reviewer bytes after a current permission revoke', async () => {
    const review = { ...args(uploads[0]), actorId: reviewer };
    const reviewToken = (await media.authorize(review, 'verify')).review_token;
    const count = sql(`SELECT count(*) FROM public."HomeClaimEvidenceInspection" WHERE upload_id='${uploads[0]}'`);
    afterDownload = () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES('${home}','${reviewer}','ownership.manage',false)`);
    try { await assert.rejects(media.download({ ...review, reviewToken }), error => error.code === 'CLAIM_EVIDENCE_DENIED'); }
    finally { sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id='${home}' AND user_id='${reviewer}' AND permission='ownership.manage'`); }
    assert.equal(sql(`SELECT count(*) FROM public."HomeClaimEvidenceInspection" WHERE upload_id='${uploads[0]}'`), count);
  });
  it('keeps unverified failed removal hidden until actual cleanup succeeds', async () => {
    const reference = await ref(uploads[1]); failDelete = true; await assert.rejects(media.remove(args(uploads[1])));
    await assert.rejects(media.download(args(uploads[1])), error => error.code === 'CLAIM_EVIDENCE_NOT_FOUND');
    assert.equal((await media.remove(args(uploads[1]))).cleanup_pending, false);
    assert.ok((await db.storage.from(bucket).download(storage.key(reference))).error);
  });
  it('uses retained original identity to recover an actual late PUT', async () => {
    const response = await db.from('HomeClaimEvidenceIntent').select('*').eq('id', uploads[1]).single(); assert.ifError(response.error);
    const i = response.data; const reference = { home_id: home, claim_id: claim, upload_id: uploads[1], sha256: i.sha256 };
    assert.ifError((await db.storage.from(bucket).upload(storage.key(reference), file.buffer, { contentType: file.mimetype, upsert: false })).error);
    assert.ifError((await db.rpc('note_home_claim_evidence_upload_finished', { p_upload_id: uploads[1], p_attempt: i.upload_attempt })).error);
    sql(`UPDATE public."HomeClaimEvidenceIntent" SET updated_at=clock_timestamp()-interval '11 minutes' WHERE id='${uploads[1]}'`);
    assert.deepEqual(await media.recover(), { selected: 1, removed: 1, failed: 0, skipped: 0 });
    assert.ok((await db.storage.from(bucket).download(storage.key(reference))).error);
  });
  it('rejects a public bucket before quota reservation', async () => {
    process.env.HOME_DOCUMENTS_BUCKET = publicBucket;
    try { await assert.rejects(media.upload(args(uploads[2]), file), error => error.code === 'HOME_CLAIM_EVIDENCE_STORAGE_UNAVAILABLE'); }
    finally { process.env.HOME_DOCUMENTS_BUCKET = bucket; }
    assert.equal(sql(`SELECT count(*) FROM public."HomeClaimEvidenceIntent" WHERE id='${uploads[2]}'`), '0');
  });
  it('preserves private creator setup through real pending upload, withdrawal and retirement', async () => {
    const input = { homeId: privateHome, claimId: privateClaim, actorId: owner, uploadId: uploads[3], evidenceType: 'lease' };
    await media.upload(input, file); assert.deepEqual((await media.download(input)).bytes, file.buffer);
    const reference = await db.rpc('get_home_claim_evidence', { p_home_id: privateHome, p_claim_id: privateClaim, p_actor_id: owner, p_upload_id: uploads[3] });
    assert.ifError(reference.error);
    const context = await db.rpc('home_secret_context', { p_home_id: privateHome, p_actor_id: owner }); assert.equal(context.data.private, true);
    const withdrawal = await db.rpc('mutate_home_claim_review', { p_home_id: privateHome, p_claim_id: privateClaim, p_actor_id: owner, p_action: 'withdraw' });
    assert.ifError(withdrawal.error); assert.equal(withdrawal.data.ok, true);
    assert.equal((await media.remove(input)).cleanup_pending, false);
    assert.ok((await db.storage.from(bucket).download(storage.key(reference.data.storage))).error);
    assert.equal((await db.rpc('home_secret_context', { p_home_id: privateHome, p_actor_id: owner })).data.private, true);
    assert.equal((await db.rpc('home_delete_eligibility', { p_home_id: privateHome, p_user_id: owner })).data.code, 'HOME_DELETE_STORAGE_CLEANUP_REQUIRED');
  });
  it('requires a separate current claim decision after verified bytes and preserves resident role', async () => {
    // Removing another pending document changes the claim snapshot, so refresh
    // it for this separate decision instead of reusing the inspection snapshot.
    const current = await media.authorize({ ...args(uploads[0]), actorId: admin, platformAdmin: true }, 'verify');
    const result = await db.rpc('mutate_home_claim_review', { p_home_id: home, p_claim_id: claim, p_actor_id: admin,
      p_action: 'approve', p_review_token: current.review_token, p_platform_admin: true });
    assert.ifError(result.error); assert.equal(result.data.ok, true); assert.equal(result.data.occupancy.role_base, 'lease_resident');
    assert.equal(sql(`SELECT count(*) FROM public."HomeOwner" WHERE home_id='${home}' AND subject_id='${owner}'`), '0');
    assert.equal(verifiedReview.record.status, 'verified');
  });
  it('retires an unverified shared-household document after protected claimant withdrawal', async () => {
    sql(`INSERT INTO public."HomeOwnershipClaim"(id,home_id,claimant_user_id,claim_type,state,method,claim_phase_v2,identity_status,expires_at)
      VALUES('${withdrawnClaim}','${home}','${owner}','resident','submitted','doc_upload','evidence_submitted','verified',now()+interval '1 day')`);
    const input = { ...args(uploads[4]), claimId: withdrawnClaim };
    const before = sql(`SELECT storage_used||':'||file_count FROM public."FileQuota" WHERE user_id='${owner}'`);
    await media.upload(input, file);
    const reference = await db.rpc('get_home_claim_evidence', { p_home_id: home, p_claim_id: withdrawnClaim, p_actor_id: owner, p_upload_id: uploads[4] });
    assert.ifError(reference.error);
    const result = await db.rpc('mutate_home_claim_review', { p_home_id: home, p_claim_id: withdrawnClaim, p_actor_id: owner, p_action: 'withdraw' });
    assert.ifError(result.error); assert.equal(result.data.ok, true);
    assert.equal(sql(`SELECT count(*) FROM public."HomeClaimReviewReceipt" WHERE claim_id='${withdrawnClaim}' AND action='withdraw' AND NOT private_setup`), '1');
    assert.equal((await media.remove(input)).cleanup_pending, false);
    assert.ok((await db.storage.from(bucket).download(storage.key(reference.data.storage))).error);
    assert.equal(sql(`SELECT storage_used||':'||file_count FROM public."FileQuota" WHERE user_id='${owner}'`), before);
    assert.equal(sql(`SELECT count(*) FROM public."HomeOwner" WHERE home_id='${home}' AND subject_id='${owner}'`), '0');
    assert.equal((await db.rpc('home_secret_context', { p_home_id: home, p_actor_id: owner })).data.private, false);
  });
});
