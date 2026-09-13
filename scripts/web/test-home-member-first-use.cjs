#!/usr/bin/env node
// Actual Chrome UI -> production Home routes/services -> local SDK/SQL.
// Authentication, delivery and app-shell responses are controlled; Home grants are not.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { chromium, expect } = require(path.join(root, 'frontend/apps/web/node_modules/@playwright/test'));
const [base, fixture, capabilitiesFile, evidence, mode = 'baseline', recoverySource] = process.argv.slice(2);
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(fixture || '', /^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(['baseline', 'first-use', 'first-use-continuation', 'task-recovery-continuation'].includes(mode));
if (mode === 'task-recovery-continuation') assert(path.isAbsolute(recoverySource || '') && !recoverySource.startsWith(root + '/'));
else assert.equal(recoverySource, undefined);
for (const p of [capabilitiesFile, evidence]) assert(path.isAbsolute(p || '') && !p.startsWith(root + '/'));
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
const bundle = JSON.parse(fs.readFileSync(capabilitiesFile, 'utf8'));
assert(Array.isArray(bundle.actors) && bundle.actors.length > 3);
const recipient = bundle.actors.find(a => a.index === 3);
const sender = bundle.actors.find(a => a.index === 0);
assert(recipient && sender);
assert.equal(bundle.policy_mode, mode === 'baseline' ? 'baseline' : 'member-tasks');
const events = [], errors = [], responses = [];
let context, page, actor = null, invitationURL;
const closingContexts = new WeakSet();
const saveJSON = (name, value) => fs.writeFileSync(path.join(evidence, name), JSON.stringify(value, null, 2), { mode: 0o600 });
const safePath = value => value.replace(/\/(token|guest)\/[^/?]+/g, '/$1/[redacted]');
async function control(action, body) {
  const response = await fetch(fixture + '/fixture/' + action, {
    method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
}
const state = () => control('state');
const click = name => page.getByRole('button', { name, exact: true }).click();
const heading = name => expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 30000 });
const poll = read => expect.poll(read, { timeout: 30000 });
async function save(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence, name + '-viewport.png'), fullPage: false });
  await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true });
  saveJSON(name + '.json', await state());
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
}
async function signIn(person, redirect) {
  await heading('Welcome back');
  await page.getByLabel('Email address', { exact: true }).fill(person.email);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-loopback-only');
  await click('Sign in');
  await poll(() => new URL(page.url()).pathname).toBe(redirect);
  assert.equal(actor?.id, person.id);
}
async function installTransport() {
  const transportContext = context;
  await transportContext.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), pathname = url.pathname;
    if (url.origin !== base) return route.abort();
    if (!pathname.startsWith('/api/')) return pathname.startsWith('/socket.io/')
      ? route.fulfill({ status: 503, body: '' }) : route.continue();
    try {
      let status = 200, body = {};
      const taskMediaRead = request.method() === 'GET' && (pathname === `/api/upload/home-task-media-session/${bundle.home}`
        || pathname.startsWith(`/api/upload/home-task-media/${bundle.home}/`));
      if (pathname.startsWith('/api/homes') || pathname.startsWith('/api/users/') || pathname === '/api/hub' || taskMediaRead) {
        if (pathname === '/api/users/login') {
          const submitted = JSON.parse(request.postData() || '{}');
          events.push({ event: 'controlled_login_input', fields: Object.keys(submitted).sort(),
            actor: bundle.actors.find(a => a.email === submitted.email)?.index ?? null,
            password_matches_fixture: submitted.password === 'synthetic-loopback-only' });
        }
        const headers = { 'Content-Type': 'application/json' };
        if (actor) headers.Authorization = 'Bearer ' + actor.auth_token;
        for (const key of ['x-pantopus-session-scope', 'x-home-task-session', 'idempotency-key']) {
          if (request.headers()[key]) headers[key] = request.headers()[key];
        }
        const response = await fetch(fixture + pathname + url.search, {
          method: request.method(), headers, body: request.postData() || undefined,
          signal: AbortSignal.timeout(45000),
        });
        status = response.status; body = await response.json();
        if (pathname === '/api/users/login' && status === 200) {
          actor = bundle.actors.find(a => a.id === body.user?.id);
          assert(actor, 'Sign-in must resolve an owned fixture actor');
          // These are the controlled auth provider's same-origin login cookies,
          // issued only after the normal UI login request succeeds.
          await transportContext.addCookies([
            { name: 'pantopus_session', value: '1', url: base },
            { name: 'pantopus_access', value: 'synthetic-loopback-session', url: base, httpOnly: true },
          ]);
        } else if (pathname === '/api/users/logout' && status === 200) {
          actor = null;
          await transportContext.addCookies([
            { name: 'pantopus_session', value: '', url: base, expires: 1 },
            { name: 'pantopus_access', value: '', url: base, expires: 1, httpOnly: true },
          ]);
        }
        // Full controlled Home responses stay private; no capabilities are printed.
        if (pathname.startsWith('/api/homes') || taskMediaRead) responses.push({ actor: actor?.index, path: safePath(pathname), status, body });
      } else if (pathname.includes('unread') || pathname.includes('badge')) {
        body = { count: 0, unreadCount: 0, total: 0, byContext: {} };
      } else if (pathname.includes('business')) body = { businesses: [], seats: [] };
      else if (pathname.includes('conversations')) body = { conversations: [], hasMore: false };
      events.push({ actor: actor?.index ?? null, path: safePath(pathname), method: request.method(), status });
      await route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'private, no-store' }, body: JSON.stringify(body) });
    } catch (error) {
      if (!closingContexts.has(transportContext)) errors.push({ name: error.name, path: safePath(pathname) });
      await route.abort().catch(() => {});
    }
  });
}
async function closeBrowser() {
  if (context) { closingContexts.add(context); await context.close(); }
}
async function openBrowser() {
  context = await chromium.launchPersistentContext(path.join(recoverySource || evidence, 'browser-profile'), {
    channel: 'chrome', headless: true, viewport: { width: 390, height: 844 },
  });
  await installTransport();
  page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push({ name: error.name }));
}
async function firstUse(initial, retainedLost = null) {
  const tasksPath = `/api/homes/${bundle.home}/tasks`;
  const tasksURL = base + `/app/homes/${bundle.home}/tasks`;
  const title = 'Member household first task';
  const description = 'Private household instructions for the original task';
  const updatedDescription = 'Updated household instructions';
  const currentTask = async () => (await state()).tasks.find(t => t.created_by === recipient.id);
  const assertLastTaskRead = status => assert.equal(events.filter(e => e.path === tasksPath && e.method === 'GET').at(-1)?.status, status);
  const scenario = mode => control('member-scenario', { index: recipient.index, mode });
  const reloadTasks = async () => {
    await page.goto(tasksURL, { waitUntil: 'domcontentloaded' });
    await heading('Tasks');
  };
  const assertUnavailable = async () => {
    await expect(page.getByRole('button', { name: 'Reload tasks', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toBeDisabled();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/No (active|completed|recurring) tasks/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Active|Done|Recurring) \(/ })).toHaveCount(0);
  };
  let lost = retainedLost;
  if (!lost) {
  // Start through the shipped matching Home dashboard's visible actions menu.
  await click('Quick actions');
  await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toBeEnabled();
  await click('Add Task'); await heading('New Task');
  const form = page.getByRole('dialog', { name: 'New Task', exact: true });
  await form.getByLabel('Title *', { exact: true }).fill(title);
  await form.getByLabel('Description', { exact: true }).fill(description);
  await expect(form.getByRole('group', { name: 'Type', exact: true }).getByRole('button', { name: 'Chore', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(form.getByRole('group', { name: 'Priority', exact: true }).getByRole('button', { name: 'Medium', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(form.getByLabel('Assign to', { exact: true })).toHaveValue('');
  await control('fault', { action: 'task_create', kind: 'after' });
  await form.getByRole('button', { name: 'Create Task', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Retry original request', exact: true })).toBeVisible();
  await expect(form.getByLabel('Title *', { exact: true })).toBeDisabled();
  lost = await state();
  assert.equal(lost.tasks.length, 1); assert.equal(lost.task_receipts.length, 1);
  assert.equal(lost.tasks[0].title, title); assert.equal(lost.tasks[0].description, description);
  assert.equal(lost.tasks[0].created_by, recipient.id); assert.equal(lost.tasks[0].visibility, 'members');
  assert.equal(lost.tasks[0].assigned_to, null);
  await save('member-task-lost-reply-retained-original');
  }

  // Close Chrome completely, preserving its protected local command. Re-enter
  // through normal sign-in, since this controlled provider uses session cookies.
  await closeBrowser(); await openBrowser();
  await page.goto(base + '/login?redirectTo=' + encodeURIComponent(new URL(tasksURL).pathname), { waitUntil: 'domcontentloaded' });
  await signIn(recipient, new URL(tasksURL).pathname);
  await heading('Tasks');
  await click('Add Task'); await heading('New Task');
  const recovered = page.getByRole('dialog', { name: 'New Task', exact: true });
  await expect(recovered.getByLabel('Title *', { exact: true })).toHaveValue(title);
  await expect(recovered.getByLabel('Description', { exact: true })).toHaveValue(description);
  await expect(recovered.getByLabel('Title *', { exact: true })).toBeDisabled();
  await recovered.getByRole('button', { name: 'Retry original request', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const retried = await state();
  assert.deepEqual(retried.tasks, lost.tasks); assert.deepEqual(retried.task_receipts, lost.task_receipts);
  const creates = retried.events.filter(e => e.event === 'request' && e.path === tasksPath && e.method === 'POST');
  assert.equal(creates.length, 2);
  assert.match(creates[0].request_id, /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  assert.match(creates[0].request_hash, /^[a-f0-9]{64}$/);
  assert.equal(creates[0].request_id, creates[1].request_id);
  assert.equal(creates[0].request_hash, creates[1].request_hash);
  await save('member-task-cold-retry-one-saved-task');

  await click(title); await heading('Edit Task');
  const edit = page.getByRole('dialog', { name: 'Edit Task', exact: true });
  await edit.getByLabel('Description', { exact: true }).fill(updatedDescription);
  await edit.getByRole('button', { name: 'Save Task', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await poll(async () => (await currentTask()).description).toBe(updatedDescription);
  await click(`Complete ${title}`);
  await poll(async () => (await currentTask()).status).toBe('done');
  assert((await currentTask()).completed_at);
  await click('Done (1)'); await save('member-task-completed');
  await click(`Reopen ${title}`);
  await poll(async () => (await currentTask()).status).toBe('open');
  assert.equal((await currentTask()).completed_at, null);
  await click('Active (1)');

  await scenario('deny_tasks_edit'); await reloadTasks();
  await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Complete ${title}`, exact: true })).toBeDisabled();
  await click(title); await heading('Edit Task');
  await expect(edit.getByLabel('Title *', { exact: true })).toBeDisabled();
  await expect(edit.getByRole('button', { name: 'Save Task', exact: true })).toBeDisabled();
  await save('member-task-explicit-edit-denial');
  await edit.getByRole('button', { name: 'Cancel', exact: true }).click();
  await scenario('restore');

  await scenario('deny_tasks_view'); await reloadTasks(); await assertUnavailable();
  assertLastTaskRead(403);
  await save('member-task-explicit-view-denial'); await scenario('restore');
  await control('fault', { action: 'task_list', kind: 'before', persistent: true });
  await reloadTasks(); await assertUnavailable(); assertLastTaskRead(503); await save('member-task-read-failure-without-false-empty');
  await control('fault', { action: 'task_list', kind: 'clear' }); await click('Reload tasks');
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();

  await scenario('deny_home_view'); await reloadTasks();
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toBeEnabled();
  await save('separate-task-permission-survives-home-view-denial'); await scenario('restore');

  await scenario('remove'); await reloadTasks(); await assertUnavailable();
  assertLastTaskRead(403);
  await save('member-task-membership-removal');
  await page.goto(base + '/app/homes', { waitUntil: 'domcontentloaded' }); await heading('My Homes');
  await expect(page.getByText('No homes yet', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toHaveCount(0);
  await scenario('restore'); await reloadTasks();
  await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
  await save('member-task-current-access-restored');
  // Consume the confirmed original through its explicit UI action, then close
  // the blank form without issuing a replacement command.
  await click('Add Task'); await heading('New Task');
  await expect(page.getByRole('button', { name: 'Open saved task', exact: true })).toBeVisible();
  await click('Start another task');
  await expect(page.getByRole('dialog').getByLabel('Title *', { exact: true })).toHaveValue('');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  const final = await state();
  assert.equal(final.sender_commands.length, 1); assert.equal(final.commands.length, 1);
  assert.equal(final.tasks.length, 1); assert.deepEqual(final.task_receipts, lost.task_receipts);
  assert.equal(final.tasks[0].visibility, 'members'); assert.equal(final.tasks[0].description, updatedDescription);
  assert.equal(final.claim_count, 0); assert.equal(final.ownership_claim_count, 0);
  assert.deepEqual(final.ownership, initial.ownership);
  assert.deepEqual(errors, []);
  saveJSON('result.json', { pass: true, first_use: true, sender_commands: 1, recipient_commands: 1,
    policy_mode: 'member-tasks', task_create_requests: 2, saved_tasks: 1, task_receipts: 1,
    normal_ui_sign_in: true, current_member_identity: true,
    admission_previously_acknowledged: mode !== 'first-use',
    lost_reply_retained_from_prior_run: !!retainedLost,
    same_run_admission_and_account_switch: mode === 'first-use',
    lost_reply_cold_retry_same_uuid_and_payload: true, edit_complete_reopen: true,
    confirmed_original_explicitly_consumed_without_new_command: true,
    explicit_edit_and_view_denials: true, read_failure_not_empty: true,
    independent_home_view_and_task_permissions: true, membership_removal_and_restoration: true,
    no_residency_or_ownership_claim: true, task_visibility: 'members',
    limits: ['Controlled authentication/delivery; existing accounts only.', 'Household-private task, not a promise of personal privacy.',
      'New-account/provider onboarding and full H07/H08 exits remain separate.'] });
  console.log('PASS: actual ordinary-member admission and household Task recovery, lifecycle, denial and restored access.');
}
async function main() {
  try {
    const initial = await state();
    if (mode === 'task-recovery-continuation') {
      const lost = JSON.parse(fs.readFileSync(path.join(recoverySource, 'member-task-lost-reply-retained-original.json'), 'utf8'));
      assert.equal(initial.sender_commands.length, 1); assert.equal(initial.commands.length, 1);
      assert.equal(lost.tasks.length, 1); assert.equal(lost.task_receipts.length, 1);
      assert.deepEqual(initial.tasks, lost.tasks); assert.deepEqual(initial.task_receipts, lost.task_receipts);
      await firstUse(initial, lost); return;
    }
    if (mode === 'first-use-continuation') {
      assert.equal(initial.sender_commands.length, 1);
      assert.equal(initial.commands.length, 1);
      assert.equal(initial.commands[0].action, 'accept');
      assert.equal(initial.commands[0].state, 'completed');
      assert.equal(initial.tasks.length, 0); assert.equal(initial.task_receipts.length, 0);
      await openBrowser();
      const destination = `/app/homes/${bundle.home}/dashboard`;
      await page.goto(base + '/login?redirectTo=' + encodeURIComponent(destination), { waitUntil: 'domcontentloaded' });
      await signIn(recipient, destination);
      await poll(() => responses.some(r => r.actor === recipient.index && r.path === `/api/homes/${bundle.home}/dashboard` && r.status === 200)).toBe(true);
      await firstUse(initial); return;
    }
    assert.equal(initial.sender_commands.length, 0, 'Use a fresh member-onboarding fixture');
    assert.equal(initial.commands.length, 0);
    assert.equal(initial.policy_mode, bundle.policy_mode);
    await openBrowser();
    const senderDestination = `/app/homes/${bundle.home}/invitations`;
    await page.goto(base + '/login?redirectTo=' + encodeURIComponent(senderDestination), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await signIn(sender, senderDestination);
    await heading('New invitation');
    await expect(page.getByRole('combobox', { name: /^Role in household/ })).toHaveValue('tenant');
    await page.getByLabel('Email address', { exact: true }).fill(recipient.email);
    await click('Review invitation'); await heading('Review new invitation');
    await expect(page.getByRole('alertdialog').getByText('Tenant / Roommate', { exact: true })).toBeVisible();
    await click('Confirm invitation'); await heading('Invitation saved');
    const created = (await state()).sender_commands;
    assert.equal(created.length, 1); assert.equal(created[0].state, 'completed'); assert.equal(created[0].action, 'create');
    await click('Check link for sharing');
    const sharedLink = page.locator('a[href*="/invite/"]');
    await expect(sharedLink).toHaveCount(1);
    invitationURL = await sharedLink.getAttribute('href');
    assert.equal(new URL(invitationURL).origin, base);
    await click('Done'); await heading('New invitation');
    await save('sender-default-member-invitation-acknowledged');

    // Transfer the actual saved link, then use the app's normal account switch.
    await page.goto(invitationURL, { waitUntil: 'domcontentloaded' });
    await click('Use another account');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out and continue', exact: true }).click();
    await poll(() => new URL(page.url()).pathname).toBe('/login');
    assert.equal(new URL(page.url()).searchParams.get('redirectTo'), new URL(invitationURL).pathname);
    await signIn(recipient, new URL(invitationURL).pathname);
    await heading("You're invited");
    await click('Accept invitation');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm acceptance', exact: true }).click();
    await heading('Acceptance saved');
    await click('Check current Home access');
    await expect(page.getByRole('button', { name: 'Open Home', exact: true })).toBeVisible();
    await click('Done');
    await poll(() => new URL(page.url()).pathname).toBe('/app/homes');
    await heading('My Homes');
    await expect(page.getByText('Member', { exact: true })).toBeVisible();
    await expect(page.getByText('Residency verified', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Owner', { exact: true })).toHaveCount(0);
    const homes = responses.filter(r => r.actor === recipient.index && Array.isArray(r.body.homes)).at(-1)?.body.homes;
    assert(Array.isArray(homes));
    const home = homes.find(h => h.id === bundle.home);
    assert(home && home.access_kind === 'shared' && home.role_base === 'member' && home.has_home_access === true);
    assert.equal(home.can_delete_home, false);
    await save('accepted-member-current-my-homes-identity');
    await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
    await poll(() => new URL(page.url()).pathname).toBe(`/app/homes/${bundle.home}/dashboard`);
    await poll(() => responses.some(r => r.actor === recipient.index && r.path === `/api/homes/${bundle.home}/dashboard` && r.status === 200)).toBe(true);
    if (mode === 'first-use') { await firstUse(initial); return; }
    await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toHaveCount(0);
    await save('ordinary-member-home-without-task-entry');

    // A known Tasks route remains protected even when the dashboard hides entry.
    await page.goto(base + `/app/homes/${bundle.home}/tasks`, { waitUntil: 'domcontentloaded' });
    await heading('Tasks');
    await expect(page.getByRole('button', { name: 'Add Task', exact: true })).toBeDisabled();
    await expect(page.getByRole('alert').filter({ has: page.getByRole('button', { name: 'Reload tasks', exact: true }) })).toBeVisible();
    assert(responses.some(r => r.actor === recipient.index && r.path === `/api/homes/${bundle.home}/tasks` && r.status === 403));
    const deniedAlsoClaimsEmpty = await page.getByText('No active tasks', { exact: true }).isVisible();
    await save('ordinary-member-task-denial');
    const final = await state();
    assert.equal(final.sender_commands.length, 1); assert.equal(final.commands.length, 1);
    assert.equal(final.commands[0].state, 'completed'); assert.equal(final.commands[0].action, 'accept');
    assert(!events.some(e => e.method === 'POST' && e.path === `/api/homes/${bundle.home}/tasks`));
    assert.deepEqual(errors, []);
    saveJSON('result.json', { baseline_reproduced: true, task_access_granted: false,
      shipped_web_default: { relationship: 'member', preset: 'tenant' }, sender_commands: 1, recipient_commands: 1,
      normal_ui_sign_in_and_account_switch: true, current_home_identity: true, membership_not_residency: true,
      tasks_denied_http_403: true, denied_tasks_also_claim_empty: deniedAlsoClaimsEmpty, task_creates: 0,
      limits: ['Controlled authentication/delivery; existing accounts only.', 'Baseline reproduction, not completed ordinary-member first use.'] });
    console.log('PASS baseline reproduction: shipped ordinary-member admission reaches Home; task access is denied.');
  } finally {
    if (page) {
      await page.screenshot({ path: path.join(evidence, 'final-viewport.png'), fullPage: false }).catch(() => {});
      fs.writeFileSync(path.join(evidence, 'final-dom.txt'), await page.locator('body').innerText().catch(() => ''), { mode: 0o600 });
    }
    saveJSON('events.json', { events, errors }); saveJSON('home-responses.json', responses);
    await closeBrowser();
  }
}
main().catch(error => {
  fs.writeFileSync(path.join(evidence, 'failure.txt'), String(error.stack), { mode: 0o600 });
  console.error('Ordinary-member browser reproduction failed; private diagnostics retained.'); process.exitCode = 1;
});
