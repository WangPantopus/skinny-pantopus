#!/usr/bin/env node
// Actual Chrome + web UI + production recurrence service + isolated local SQL.
// HTTP authentication/session replies are synthetic; no hosted/provider access.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, container, database, evidence] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(container || '', /^supabase_db_pantopus-home-[a-z0-9_-]+$/);
assert.match(database || '', /^[a-z0-9_]+_contract$/);
assert(path.isAbsolute(evidence || '') && !evidence.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const id = n => `ddf21100-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1), home = id(100), quote = value => `'${String(value).replaceAll("'", "''")}'`;
function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-qAt', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1'],
    { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}
function rpc(name, args) {
  assert.match(name, /^[a-z_]+$/);
  const params = Object.entries(args).map(([key, value]) => {
    assert.match(key, /^p_[a-z_]+$/);
    return `${key} => ${value === null ? 'NULL' : quote(typeof value === 'object' ? JSON.stringify(value) : value)}`;
  });
  return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
}
const load = Module._load;
Module._load = function(request, parent, isMain) {
  if (parent?.filename.endsWith('/services/homeTaskRecurrenceService.js') && request === '../config/supabaseAdmin') {
    return { rpc: async (name, args) => ({ data: rpc(name, args), error: null }) };
  }
  return load.call(this, request, parent, isMain);
};
const service = require(path.join(root, 'backend/services/homeTaskRecurrenceService.js'));
Module._load = load;
async function waitForRead(gate) {
  let timer;
  try { await Promise.race([gate, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Schedule preflight was not reached')), 30000); })]); }
  finally { clearTimeout(timer); }
}

async function main() {
  let initialized = false, browser, context, page, releaseRead;
  const scope = { home_id: home, actor_id: actor, session_scope: 'a'.repeat(64) };
  const title = 'Local automatic recurrence original';
  let posts = [], loseReply = true, denyRead = false, holdRead = false, held;
  try {
    assert.equal(sql(`SELECT count(*) FROM auth.users WHERE id=${quote(actor)};`), '0');
    // This dedicated contract database must not contain someone else's schedule.
    assert.equal(sql('SELECT count(*) FROM public."HomeTaskRecurrence";'), '0');
    sql(`BEGIN;
      INSERT INTO auth.users(id,email) VALUES(${quote(actor)},'recurrence-browser@example.invalid');
      INSERT INTO public."User"(id,email,username,name) VALUES(${quote(actor)},'recurrence-browser@example.invalid','recurrence_browser','Browser fixture');
      INSERT INTO public."Home"(id,owner_id,created_by_user_id,address,city,state,zipcode) VALUES(${quote(home)},${quote(actor)},${quote(actor)},'Browser fixture','Test','WA','98607');
      INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES(${quote(home)},${quote(actor)},'owner','owner','adult','verified');
      COMMIT;`);
    initialized = true;
    const created = JSON.parse(sql(`SELECT public.mutate_home_record(${quote(home)},${quote(actor)},'task','create',NULL,
      jsonb_build_object('title',${quote(title)},'due_at',clock_timestamp()-interval '3 days'))::text;`));
    assert.equal(created.ok, true);
    const task = created.record.id, args = { homeId: home, actorId: actor, taskId: task };
    const records = taskId => rpc('get_home_records', { p_home_id: home, p_actor_id: actor, p_kind: 'task', p_record_id: taskId });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.addCookies([{ name: 'pantopus_session', value: '1', url: base }, { name: 'pantopus_access', value: 'synthetic-local-session', url: base, httpOnly: true }]);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url()), endpoint = url.pathname, method = route.request().method();
      if (url.origin !== base) return route.abort();
      if (!endpoint.startsWith('/api/')) {
        if (endpoint.startsWith('/socket.io/')) return route.fulfill({ status: 503, body: '' });
        return route.continue();
      }
      let body = {}, status = 200;
      try {
        if (endpoint === '/api/users/profile') body = { user: { id: actor, username: 'synthetic', name: 'Browser fixture', account_type: 'personal', email_verified: true } };
        else if (endpoint === `/api/homes/${home}/tasks/${task}/recurrence`) {
          if (method === 'POST') {
            const request = route.request().postDataJSON(); posts.push(request);
            const { request_id, ...command } = request;
            body = { ...await service.change({ ...args, requestId: request_id, command }), task_session: scope };
            if (loseReply) { loseReply = false; status = 503; body = { error: 'Synthetic lost committed reply' }; }
          } else {
            if (holdRead) { held(); await new Promise(resolve => { releaseRead = resolve; }); }
            if (denyRead) throw Object.assign(new Error('Current task access ended'), { statusCode: 403, code: 'HOME_RECORD_FORBIDDEN' });
            body = { ...await service.read(args), task_session: scope };
          }
        } else if (endpoint === `/api/homes/${home}/tasks`) {
          assert.equal(method, 'GET');
          body = { tasks: records(null).records, task_session: scope, collection_capabilities: { can_create: true } };
        } else if (endpoint === `/api/homes/${home}/tasks/${task}`) {
          assert.equal(method, 'GET');
          if (denyRead) throw Object.assign(new Error('Current task access ended'), { statusCode: 403, code: 'HOME_RECORD_FORBIDDEN' });
          body = { task: records(task).records[0], task_session: scope };
        } else if (endpoint === `/api/upload/home-task-media-session/${home}`) body = { ...scope, task_id: task };
        else if (endpoint === `/api/upload/home-task-media/${home}/${task}`) body = { media: [], can_upload: true };
        else if (endpoint.endsWith('/occupants')) body = { occupants: [] };
        else if (endpoint.includes('conversations')) body = { conversations: [], hasMore: false };
        else if (endpoint.includes('unread') || endpoint.includes('badge')) body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
        else if (endpoint.includes('business')) body = { businesses: [], seats: [] };
        else if (endpoint.includes('homes')) body = { homes: [] };
      } catch (error) { status = error.statusCode || 500; body = { error: error.message, code: error.code }; }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }).catch(() => {});
    });
    page = await context.newPage(); page.setDefaultTimeout(30000);
    const location = `${base}/app/homes/${home}/tasks`;
    const openPanel = async target => { await target.getByRole('button', { name: title, exact: true }).click(); await target.getByRole('region', { name: 'Automatic repeat schedule' }).waitFor(); };
    const closePanel = target => target.getByRole('button', { name: 'Close panel', exact: true }).click();
    async function stored(target = page) {
      return target.evaluate(async () => {
        const db = await new Promise((resolve, reject) => { const r = indexedDB.open('pantopus-private-task-recovery'); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
        const read = (store, key) => new Promise((resolve, reject) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
        const keys = await new Promise(resolve => { const r = db.transaction('drafts').objectStore('drafts').getAllKeys(); r.onsuccess = () => resolve(r.result); });
        const slot = keys.find(key => JSON.parse(key)[0] === 'recurrence');
        if (!slot) { db.close(); return null; }
        const sealed = await read('drafts', slot), key = await read('keys', 'task-recurrence-v1');
        const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.iv, additionalData: new TextEncoder().encode(`pantopus-task-recurrence-v1:${slot}`) }, key, sealed.ciphertext);
        const draft = JSON.parse(new TextDecoder().decode(bytes));
        const result = { slot, draft, extractable: key.extractable, encrypted: !new TextDecoder().decode(sealed.ciphertext).includes(draft.request_id) };
        db.close(); return result;
      });
    }
    await page.goto(location, { waitUntil: 'domcontentloaded', timeout: 120000 }); await openPanel(page);
    const start = page.getByRole('button', { name: 'Start repeating', exact: true }); await start.waitFor();
    const urgent = await page.getByRole('button', { name: 'Urgent', exact: true }).boundingBox();
    assert(urgent && urgent.x >= 0 && urgent.x + urgent.width <= 1280);
    await page.getByPlaceholder('e.g., Fix leaky faucet').fill('Unsaved change'); assert(await start.isDisabled());
    await page.getByPlaceholder('e.g., Fix leaky faucet').fill(title);
    await page.getByLabel('Repeat period', { exact: true }).selectOption('DAILY');
    await page.getByLabel('Repeat time zone', { exact: true }).selectOption('America/Los_Angeles');
    await start.click(); await page.getByRole('button', { name: 'Retry saved change', exact: true }).waitFor();
    assert.equal(posts.length, 1); const original = structuredClone(posts[0]), first = await stored();
    assert(first.encrypted && !first.extractable); assert.equal(first.draft.request_id, original.request_id);
    assert(!Object.keys(first.draft).some(key => /token|session|password/i.test(key)));
    assert.equal((await service.read(args)).revision, 1);
    // A later explicit pause is a real separate command; old replay must preserve it.
    await service.change({ ...args, requestId: id(501), command: { action: 'pause', expected_revision: 1 } });
    await page.reload({ waitUntil: 'domcontentloaded' }); await openPanel(page);
    await page.getByText('Repeats are paused.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).waitFor();
    assert.deepEqual(posts[1], original); assert.equal((await service.read(args)).configuration.state, 'paused');
    assert.equal((await stored()).draft.confirmed.revision, 1);
    await closePanel(page); await openPanel(page);
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Start repeating', exact: true }).waitFor(); assert.equal(await stored(), null);
    // Actual start, real overdue generation, current projection and pause.
    await page.getByRole('button', { name: 'Start repeating', exact: true }).click();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Pause repeats', exact: true }).waitFor();
    assert.equal((await service.read(args)).revision, 3);
    sql(`UPDATE public."HomeTaskRecurrence" SET next_due_at=anchor_at+interval '1 day' WHERE home_id=${quote(home)};`);
    const generated = await service.generateDue(); assert.equal(generated.generated, 1);
    assert.equal((await service.generateDue()).selected, 0);
    await closePanel(page); await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Recurring (1)', exact: true }).click();
    await page.getByText('Automatic repeats are on: every 1 day.', { exact: true }).waitFor(); await openPanel(page);
    await page.getByText('1 task has been created by this schedule.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pause repeats', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(evidence, 'active-schedule.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Pause repeats', exact: true }).scrollIntoViewIfNeeded();
    const pauseBounds = await page.getByRole('button', { name: 'Pause repeats', exact: true }).boundingBox();
    assert(pauseBounds && pauseBounds.x >= 0 && pauseBounds.x + pauseBounds.width <= 390);
    await page.screenshot({ path: path.join(evidence, 'mobile-schedule.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.getByRole('button', { name: 'Pause repeats', exact: true }).click();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).waitFor();
    assert.equal((await service.read(args)).configuration.state, 'paused');
    assert.equal(records(null).records.length, 2);
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Start repeating', exact: true }).waitFor();
    // Two real encrypted-store readers cannot silently replace a pending request.
    loseReply = true; await page.getByRole('button', { name: 'Start repeating', exact: true }).click();
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).waitFor();
    const sibling = await context.newPage(); await sibling.goto(location, { waitUntil: 'domcontentloaded' });
    await sibling.getByRole('button', { name: 'Recurring (1)', exact: true }).click(); await openPanel(sibling);
    await sibling.getByRole('button', { name: 'Retry saved change', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Pause repeats', exact: true }).waitFor();
    const beforeStale = posts.length;
    await sibling.getByRole('button', { name: 'Retry saved change', exact: true }).click();
    await sibling.getByText('Another tab changed the saved schedule request. Reload this panel.', { exact: true }).waitFor();
    assert.equal(posts.length, beforeStale); await sibling.close();
    // Close during the service preflight: protected command remains, zero POST.
    holdRead = true; const gate = new Promise(resolve => { held = resolve; });
    await page.getByRole('button', { name: 'Pause repeats', exact: true }).click(); await waitForRead(gate);
    await closePanel(page); holdRead = false; releaseRead(); releaseRead = undefined;
    await openPanel(page); await page.getByRole('button', { name: 'Retry saved change', exact: true }).waitFor();
    assert.equal(posts.length, beforeStale);
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Done reviewing saved change', exact: true }).click();
    await page.getByRole('button', { name: 'Start repeating', exact: true }).waitFor();
    // Current denial clears the whole task's private fields, retaining original.
    denyRead = true; const beforeDenied = posts.length;
    await page.getByRole('button', { name: 'Start repeating', exact: true }).click();
    await page.getByText('Task access could not be confirmed.', { exact: true }).waitFor();
    await page.getByPlaceholder('e.g., Fix leaky faucet').waitFor({ state: 'hidden' });
    assert.equal(posts.length, beforeDenied); assert(await stored());
    denyRead = false; await closePanel(page); await openPanel(page);
    await page.getByRole('button', { name: 'Retry saved change', exact: true }).waitFor();
    // Account change hides the task and forbids retry; the original stays stored.
    // Use the app's actual session-change marker and event.
    const apiSource = fs.readFileSync(path.join(root, 'frontend/packages/api/src/client.ts'), 'utf8');
    const marker = apiSource.match(/AUTH_SESSION_CHANGE_KEY\s*=\s*['"]([^'"]+)/)?.[1]; assert(marker);
    await page.evaluate(key => { localStorage.setItem(key, 'synthetic-account-replacement'); window.dispatchEvent(new StorageEvent('storage', { key, newValue: 'synthetic-account-replacement' })); }, marker);
    await page.getByPlaceholder('e.g., Fix leaky faucet').waitFor({ state: 'hidden' }); assert.equal(posts.length, beforeDenied);
    const retained = await stored();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async slot => {
      const db = await new Promise(resolve => { const request = indexedDB.open('pantopus-private-task-recovery'); request.onsuccess = () => resolve(request.result); });
      await new Promise(resolve => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put({ version: 1, revision: 'corrupt-synthetic', iv: new ArrayBuffer(12), ciphertext: new ArrayBuffer(32) }, slot);
        tx.oncomplete = resolve;
      }); db.close();
    }, retained.slot);
    await page.getByRole('button', { name: 'Recurring (1)', exact: true }).click(); await openPanel(page);
    await page.getByText('The original schedule change could not be read. It has been kept; no new schedule change was submitted.', { exact: true }).waitFor();
    assert.equal(posts.length, beforeDenied);
    assert.equal(await page.getByRole('button', { name: 'Start repeating', exact: true }).count(), 0);
    const finalState = await service.read(args);
    assert.equal(finalState.configuration.generated_count, 1);
    const result = { passed: true, browserPosts: posts.length, generatedTasks: 1, totalTasks: 2,
      journeys: ['unsaved source guard', 'lost committed reply and encrypted cold recovery', 'old start preserves later real pause',
        'confirmation survives reopen until acknowledgment', 'real worker creates one occurrence without backlog', 'Recurring filter uses actual projection',
        'pause preserves both tasks', 'competing tabs preserve one original', 'close during preflight sends no POST', 'current denial hides private fields', 'account change retires controls', 'corrupt encrypted recovery prevents replacement'],
      limits: 'Local Chrome with synthetic HTTP identity; production recurrence service and real local SQL. No hosted, installed-native or provider acceptance.' };
    fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, 'failed.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    releaseRead?.(); await context?.close(); await browser?.close();
    if (initialized) {
      sql(`BEGIN; DELETE FROM public."Notification" WHERE metadata->>'home_id'=${quote(home)};
        DELETE FROM public."Home" WHERE id=${quote(home)}; DELETE FROM public."User" WHERE id=${quote(actor)}; DELETE FROM auth.users WHERE id=${quote(actor)}; COMMIT;`);
      assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeTaskRecurrence" WHERE home_id=${quote(home)})+
        (SELECT count(*) FROM public."HomeTask" WHERE home_id=${quote(home)})+(SELECT count(*) FROM auth.users WHERE id=${quote(actor)});`), '0');
    }
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
