// Opt-in, real local PostgREST + Storage API + task service lifecycle.
// This uses an empty disposable database, synthetic JWT roles and tmpfs bytes.
// It never loads .env, talks to a hosted service or substitutes storage/RPC mocks.
const { describe, before, after, it } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { randomUUID, randomBytes, createHmac } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { createClient } = require('@supabase/supabase-js');

describe('Private task attachments through real local storage', {
  skip: process.env.PANTOPUS_TASK_STORAGE_CONTRACT !== '1', timeout: 240_000,
}, () => {
  const project = process.env.PANTOPUS_TASK_STORAGE_PROJECT;
  assert.match(project || '', /^pantopus-home-task-media-[a-z0-9-]+$/);
  const database = `supabase_db_${project}`; const network = `supabase_network_${project}`;
  const suffix = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const containers = [];
  const bucket = `task-contract-${suffix}`; const publicBucket = `task-public-${suffix}`;
  const owner = randomUUID(); const home = randomUUID(); const task = randomUUID();
  const privateHome = randomUUID(); const privateTask = randomUUID();
  const uploads = Array.from({ length: 5 }, () => randomUUID());
  const secret = randomBytes(32).toString('hex');
  const file = { originalname: 'task-proof.txt', mimetype: 'text/plain', buffer: Buffer.from('Exact private task bytes.\n') };
  const args = id => ({ homeId: home, taskId: task, actorId: owner, uploadId: id });
  let db; let browser; let anonymous; let media; let storage; let restOrigin; let storageOrigin;
  let deletedHomeReference;
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
    const result = await db.rpc('get_home_task_media', { p_home_id: home, p_task_id: task, p_actor_id: owner, p_upload_id: id });
    assert.ifError(result.error); assert.equal(result.data.ok, true); return result.data.storage;
  }
  before(async () => {
    assert.equal(sql('SELECT count(*) FROM public."User"'), '0', 'requires an empty disposable app database');
    assert.equal(sql('SELECT count(*) FROM public."HomeTaskMediaIntent"'), '0');
    docker('network', 'inspect', network);
    restOrigin = await launch(`pantopus-task-rest-${suffix}`, 3000,
      'postgrest/postgrest:v14.10@sha256:bca3f86f69d8ef7aa1e5ee65e66ce9a20c6c147be637517a7be8399e102901d1', [
        ['PGRST_DB_URI', `postgres://authenticator:postgres@${database}:5432/postgres`],
        ['PGRST_DB_ANON_ROLE', 'anon'], ['PGRST_DB_SCHEMAS', 'public'], ['PGRST_JWT_SECRET', secret],
      ]);
    storageOrigin = await launch(`pantopus-task-storage-${suffix}`, 5000,
      'public.ecr.aws/supabase/storage-api@sha256:528ec49c3c32561908b07ee91bced7f8456f3b688164e341eaa422441767a0bd', [
        ['DATABASE_URL', `postgres://supabase_storage_admin:postgres@${database}:5432/postgres`],
        ['AUTH_JWT_SECRET', secret], ['STORAGE_BACKEND', 'file'], ['FILE_STORAGE_BACKEND_PATH', '/var/lib/storage'],
        ['FILE_SIZE_LIMIT', '26214400'], ['TENANT_ID', 'task-contract'], ['LOG_LEVEL', 'fatal'],
      ], ['--tmpfs', '/var/lib/storage:mode=1777']);
    db = client('service_role'); browser = client('authenticated'); anonymous = client('anon');
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        const [rpc, storageResult] = await Promise.all([db.from('HomeTaskMediaIntent').select('id').limit(1), db.storage.listBuckets()]);
        if (!rpc.error && !storageResult.error) { ready = true; break; }
      } catch {}
      await delay(500);
    }
    assert.ok(ready, 'isolated local PostgREST and Storage API must become ready');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES('${owner}','task-storage@example.invalid');
      INSERT INTO public."User"(id,email,username,name) VALUES('${owner}','task-storage@example.invalid','task_storage','Task storage fixture');
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
      VALUES('${home}','${owner}','${owner}','Synthetic storage home','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
      VALUES('${home}','${owner}','owner','owner','adult','verified');
      INSERT INTO public."HomeTask"(id,home_id,created_by,title,task_type) VALUES('${task}','${home}','${owner}','Exact storage task','chore');
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode)
      VALUES('${privateHome}','${owner}','${owner}','Synthetic private setup','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status)
      VALUES('${privateHome}','${owner}','owner','owner','adult','provisional_bootstrap');
      INSERT INTO public."HomeTask"(id,home_id,created_by,title,task_type) VALUES('${privateTask}','${privateHome}','${owner}','Own first-use task','chore');
      COMMIT;`); seeded = true;
    assert.ifError((await db.storage.createBucket(bucket, { public: false })).error); bucketsCreated = true;
    assert.ifError((await db.storage.createBucket(publicBucket, { public: true })).error);
    process.env.HOME_DOCUMENTS_BUCKET = bucket;
    require.cache[adminPath] = { id: adminPath, filename: adminPath, loaded: true, exports: db };
    storage = require('../../services/homeTaskMediaStorage'); media = require('../../services/homeTaskMediaService');
  });
  after(async () => {
    try {
      if (bucketsCreated) for (const name of [bucket, publicBucket]) {
        assert.ifError((await db.storage.emptyBucket(name)).error);
        assert.ifError((await db.storage.deleteBucket(name)).error);
      }
    } finally {
      try {
        if (seeded) {
          sql(`BEGIN;
            DELETE FROM public."HomeTaskMedia" WHERE home_id IN ('${home}','${privateHome}');
            ALTER TABLE public."File" DISABLE TRIGGER protect_home_task_media_file;
            ALTER TABLE public."HomeTaskMediaIntent" DISABLE TRIGGER protect_home_task_media_intent;
            DELETE FROM public."File" WHERE user_id='${owner}';
            DELETE FROM public."HomeTaskMediaIntent" WHERE original_home_id IN ('${home}','${privateHome}');
            ALTER TABLE public."File" ENABLE TRIGGER protect_home_task_media_file;
            ALTER TABLE public."HomeTaskMediaIntent" ENABLE TRIGGER protect_home_task_media_intent;
            DELETE FROM public."Home" WHERE id IN ('${home}','${privateHome}'); DELETE FROM public."User" WHERE id='${owner}';
            DELETE FROM auth.users WHERE id='${owner}'; COMMIT;`);
          assert.equal(sql(`SELECT (SELECT count(*) FROM public."Home" WHERE id IN ('${home}','${privateHome}'))+
            (SELECT count(*) FROM public."User" WHERE id='${owner}')+(SELECT count(*) FROM auth.users WHERE id='${owner}')+
            (SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE original_home_id IN ('${home}','${privateHome}'))+
            (SELECT count(*) FROM public."File" WHERE user_id='${owner}')`), '0', 'all exact application fixtures removed');
        }
      } finally {
        if (oldBucket === undefined) delete process.env.HOME_DOCUMENTS_BUCKET; else process.env.HOME_DOCUMENTS_BUCKET = oldBucket;
        if (oldAdmin === undefined) delete require.cache[adminPath]; else require.cache[adminPath] = oldAdmin;
        for (const name of containers.reverse()) docker('rm', '-f', name);
      }
    }
  });
  it('uploads and downloads exact bytes while public and direct browser paths remain closed', async () => {
    const record = await media.upload(args(uploads[0]), file); assert.equal(record.id, uploads[0]); assert.equal(record.state, 'ready');
    assert.deepEqual((await media.download(args(uploads[0]))).bytes, file.buffer);
    const reference = await ref(uploads[0]);
    for (const client of [anonymous, browser]) {
      assert.ok((await client.storage.from(bucket).download(storage.key(reference))).error, 'browser role cannot read bytes directly');
      const files = await client.from('File').select('id,file_url,file_path').eq('id', uploads[0]);
      assert.ifError(files.error); assert.deepEqual(files.data, []);
      assert.equal((await client.rpc('get_home_task_media', { p_home_id: home, p_task_id: task, p_actor_id: owner })).error?.code, '42501');
    }
    const response = await fetch(`${storageOrigin}/object/public/${bucket}/${storage.key(reference)}`);
    assert.notEqual(response.status, 200, 'private object is not public');
    assert.equal(JSON.stringify(record).includes('task-media/'), false);
  });
  it('recovers a lost provider reply without a second quota charge or mutable overwrite', async () => {
    loseUploadReply = true;
    assert.equal((await media.upload(args(uploads[1]), file)).state, 'ready'); assert.equal(loseUploadReply, false);
    const quota = sql(`SELECT storage_used||':'||file_count FROM public."FileQuota" WHERE user_id='${owner}'`);
    assert.equal((await media.upload(args(uploads[1]), file)).state, 'ready');
    assert.equal(sql(`SELECT storage_used||':'||file_count FROM public."FileQuota" WHERE user_id='${owner}'`), quota);
  });
  it('withholds actual fetched bytes when current task read permission changes', async () => {
    afterDownload = () => sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES('${home}','${owner}','tasks.view',false)`);
    try { await assert.rejects(media.download(args(uploads[0])), error => error.code === 'HOME_RECORD_DENIED'); }
    finally { sql(`DELETE FROM public."HomePermissionOverride" WHERE home_id='${home}' AND user_id='${owner}' AND permission='tasks.view'`); }
  });
  it('keeps failed removal hidden and retries actual provider cleanup', async () => {
    const reference = await ref(uploads[0]); failDelete = true;
    await assert.rejects(media.remove(args(uploads[0])));
    assert.equal(sql(`SELECT state||':'||cleanup_pending FROM public."HomeTaskMediaIntent" WHERE id='${uploads[0]}'`), 'retired:true');
    await assert.rejects(media.download(args(uploads[0])), error => error.code === 'HOME_TASK_MEDIA_NOT_FOUND');
    assert.equal((await media.remove(args(uploads[0]))).cleanup_pending, false);
    assert.ok((await db.storage.from(bucket).download(storage.key(reference))).error);
  });
  it('retained identity recovers an actual late provider completion', async () => {
    const reference = await ref(uploads[1]); await media.remove(args(uploads[1]));
    assert.ifError((await db.storage.from(bucket).upload(storage.key(reference), file.buffer, { contentType: file.mimetype, upsert: false })).error);
    assert.ifError((await db.rpc('note_home_task_media_upload_finished', { p_upload_id: uploads[1], p_attempt: reference.upload_attempt })).error);
    sql(`UPDATE public."HomeTaskMediaIntent" SET updated_at=clock_timestamp()-interval '11 minutes' WHERE id='${uploads[1]}'`);
    const recovery = await media.recover(); assert.equal(recovery.failed, 0); assert.equal(recovery.removed, 1);
    assert.ok((await db.storage.from(bucket).download(storage.key(reference))).error);
  });
  it('rejects public bucket configuration before creating a reservation', async () => {
    process.env.HOME_DOCUMENTS_BUCKET = publicBucket;
    try { await assert.rejects(media.upload(args(uploads[2]), file), error => error.code === 'HOME_TASK_MEDIA_STORAGE_UNAVAILABLE'); }
    finally { process.env.HOME_DOCUMENTS_BUCKET = bucket; }
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE id='${uploads[2]}'`), '0');
  });
  it('deletes a task only after actual attachment cleanup and retains original recovery identity', async () => {
    await media.upload(args(uploads[3]), file); const reference = await ref(uploads[3]);
    failDelete = true; await assert.rejects(media.deleteTask(args(uploads[3])));
    assert.equal(sql(`SELECT count(*) FROM public."HomeTask" WHERE id='${task}'`), '1');
    assert.equal((await media.deleteTask(args(uploads[3]))).record.id, task);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTask" WHERE id='${task}'`), '0');
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE id='${uploads[3]}' AND task_id IS NULL AND original_task_id='${task}'`), '1');
    assert.ok((await db.storage.from(bucket).download(storage.key(reference))).error);
  });
  it('preserves private creator setup and drains actual task bytes before deleting its Home', async () => {
    const input = { homeId: privateHome, taskId: privateTask, actorId: owner, uploadId: uploads[4] };
    assert.equal((await media.upload(input, file)).state, 'ready');
    assert.deepEqual((await media.download(input)).bytes, file.buffer);
    const context = await db.rpc('home_secret_context', { p_home_id: privateHome, p_actor_id: owner });
    assert.ifError(context.error); assert.equal(context.data.allowed, true); assert.equal(context.data.private, true);
    const result = await db.rpc('get_home_task_media', { p_home_id: privateHome, p_task_id: privateTask, p_actor_id: owner, p_upload_id: uploads[4] });
    assert.ifError(result.error); const reference = result.data.storage; deletedHomeReference = reference;
    const authority = require('../../services/homeAuthorityService');
    failDelete = true; await assert.rejects(authority.deleteHome(privateHome, owner));
    assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id='${privateHome}'`), '1');
    assert.equal((await authority.deleteHome(privateHome, owner)).deleted, true);
    assert.ok((await db.storage.from(bucket).download(storage.key(reference))).error);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE id='${uploads[4]}' AND original_home_id='${privateHome}'
      AND original_task_id='${privateTask}' AND home_id IS NULL AND task_id IS NULL AND private_setup AND state='retired' AND NOT cleanup_pending`), '1');
    assert.equal(sql(`SELECT count(*) FROM public."File" WHERE id='${uploads[4]}' AND home_id IS NULL AND is_deleted`), '1');
  });
  it('discovers and removes actual late bytes after the original Home has been deleted', async () => {
    assert.equal(sql(`SELECT count(*) FROM public."Home" WHERE id='${privateHome}'`), '0');
    assert.ifError((await db.storage.from(bucket).upload(storage.key(deletedHomeReference), file.buffer,
      { contentType: file.mimetype, upsert: false })).error);
    assert.ifError((await db.rpc('note_home_task_media_upload_finished', {
      p_upload_id: uploads[4], p_attempt: deletedHomeReference.upload_attempt,
    })).error);
    sql(`UPDATE public."HomeTaskMediaIntent" SET updated_at=clock_timestamp()-interval '11 minutes' WHERE id='${uploads[4]}'`);
    assert.deepEqual(await media.recover(), { selected: 1, removed: 1, failed: 0, skipped: 0 });
    assert.ok((await db.storage.from(bucket).download(storage.key(deletedHomeReference))).error);
    assert.equal(sql(`SELECT count(*) FROM public."HomeTaskMediaIntent" WHERE id='${uploads[4]}' AND original_home_id='${privateHome}'
      AND home_id IS NULL AND state='retired' AND NOT cleanup_pending`), '1');
  });
});
