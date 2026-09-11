const fs = require('fs');
const path = require('path');
const db = require('./__mocks__/supabaseAdmin');
const { getUserAccess, hasPermission, checkHomePermission, getActiveOccupancy, getHomePersonalContext } = require('../utils/homePermissions');
const { HOME_PERMISSIONS } = require('../utils/homeAccessPolicy');
const { homeDocumentVisibilities } = require('../utils/homeDocumentAccess');

const HOME = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER = 'aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa';
const reference = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260908234527_reference_baseline.sql'), 'utf8');
const baseline = [...reference.matchAll(/INSERT INTO public\."HomeRolePermission" .* VALUES \('([^']+)', '([^']+)', (true|false),/g)]
  .map(match => ({ role_base: match[1], permission: match[2], allowed: match[3] === 'true' }));
const originalFrom = db.from;

function seed(occupancy = {}, home = {}) {
  db.seedTable('Home', [{ id: HOME, owner_id: 'someone-else', ...home }]);
  db.seedTable('HomeOccupancy', [{ id: 'occupancy', home_id: HOME, user_id: USER,
    is_active: true, verification_status: 'verified', role_base: 'member', role: 'member',
    age_band: 'adult', ...occupancy }]);
  db.seedTable('HomeOwner', []);
  db.seedTable('HomeRolePermission', structuredClone(baseline));
  db.seedTable('HomePermissionOverride', []);
}
function override(permission, allowed = true) {
  db.getTable('HomePermissionOverride').push({ home_id: HOME, user_id: USER, permission, allowed });
}
beforeEach(() => { db.resetTables(); seed(); });
afterEach(() => jest.restoreAllMocks());

test('actual baseline reference rows remain the incomplete 24-row policy', async () => {
  expect(baseline).toHaveLength(24);
  expect((await getUserAccess(HOME, USER)).permissions).toEqual([]);
  seed({ role_base: 'lease_resident', role: 'tenant' });
  expect(await hasPermission(HOME, USER, 'tasks.edit')).toBe(true);
  expect(await hasPermission(HOME, USER, 'docs.view')).toBe(false);
});

test.each([null, 'unverified', 'provisional', 'provisional_bootstrap', 'pending_doc',
  'pending_postcard', 'pending_approval', 'suspended', 'suspended_challenged', 'moved_out',
  'inactive', 'revoked', 'unknown'])('status %s cannot inherit shared rights or owner shortcuts', async status => {
  seed({ role_base: 'owner', verification_status: status }, { owner_id: USER });
  override('docs.view');
  expect((await getUserAccess(HOME, USER)).hasAccess).toBe(false);
  expect(await hasPermission(HOME, USER, 'docs.view')).toBe(false);
  expect((await checkHomePermission(HOME, USER, 'finance.manage')).hasAccess).toBe(false);
  expect(await getActiveOccupancy(HOME, USER)).toBeNull();
});

test.each(['start_at', 'access_start_at', 'end_at', 'access_end_at'])('%s is enforced even for a legacy owner', async field => {
  const delta = field.includes('start') ? 100_000 : -100_000;
  seed({ role_base: 'owner', [field]: new Date(Date.now() + delta).toISOString() }, { owner_id: USER });
  expect((await checkHomePermission(HOME, USER, 'finance.manage')).hasAccess).toBe(false);
});

test.each(['start_at', 'access_start_at', 'end_at', 'access_end_at'])('malformed %s fails closed', async field => {
  seed({ role_base: 'owner', [field]: 'invalid-date' });
  expect((await getUserAccess(HOME, USER)).hasAccess).toBe(false);
});

test('exact start is eligible and exact end is expired', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-09-10T00:00:00Z'));
  try {
    seed({ start_at: new Date().toISOString() });
    expect((await getUserAccess(HOME, USER)).hasAccess).toBe(true);
    seed({ access_end_at: new Date().toISOString() });
    expect((await getUserAccess(HOME, USER)).hasAccess).toBe(false);
  } finally { jest.useRealTimers(); }
});

test.each(['child', 'teen'])('%s ceilings beat true flags, every explicit grant and owner', async age => {
  seed({ role_base: 'owner', age_band: age, can_manage_finance: true, can_view_sensitive: true }, { owner_id: USER });
  HOME_PERMISSIONS.forEach(permission => override(permission));
  const access = await getUserAccess(HOME, USER);
  expect(access.isOwner).toBe(false);
  for (const permission of ['sensitive.view', 'finance.view', 'access.manage', 'members.manage',
    'home.edit', 'ownership.manage', 'ownership.transfer', 'security.manage', 'tasks.manage', 'docs.manage']) {
    expect(access.permissions).not.toContain(permission);
    expect((await checkHomePermission(HOME, USER, permission)).hasAccess).toBe(false);
  }
  expect(access.permissions.includes('tasks.edit')).toBe(age === 'teen');
  expect(access.permissions.includes('docs.upload')).toBe(age === 'teen');
  expect(await homeDocumentVisibilities(HOME, USER, access)).toEqual({ allowed: ['public', 'members'] });
});

test.each([null, undefined, 'adult'])('historical age %s retains verified adult rights without refreshing verification', async age => {
  seed({ role_base: 'owner', age_band: age, verified_at: '2010-01-01T00:00:00Z' });
  const before = structuredClone(db.getTable('HomeOccupancy'));
  expect(await hasPermission(HOME, USER, 'finance.manage')).toBe(true);
  expect(db.getTable('HomeOccupancy')).toEqual(before);
});

test('explicit deny beats owner on helpers, permission list and document visibility', async () => {
  seed({ role_base: 'owner' });
  override('sensitive.view', false);
  const access = await getUserAccess(HOME, USER);
  expect(await hasPermission(HOME, USER, 'sensitive.view')).toBe(false);
  expect((await checkHomePermission(HOME, USER, 'can_view_sensitive')).hasAccess).toBe(false);
  expect(access.permissions).not.toContain('sensitive.view');
  expect(await homeDocumentVisibilities(HOME, USER, access)).toEqual({ allowed: ['public', 'members', 'managers'] });
});

test('per-user true still overrides a role default false, within the ceiling', async () => {
  db.getTable('HomeRolePermission').push({ role_base: 'member', permission: 'docs.view', allowed: false });
  override('docs.view');
  expect(await hasPermission(HOME, USER, 'docs.view')).toBe(true);
});

test.each(['Home', 'HomeOccupancy', 'HomeOwner', 'HomePermissionOverride', 'HomeRolePermission'])('unreadable %s yields a retryable error, never a fall-through grant', async table => {
  seed({ role_base: 'owner' });
  override('finance.manage', false);
  jest.spyOn(db, 'from').mockImplementation(name => {
    const query = originalFrom(name);
    if (name === table) query.then = (resolve, reject) => Promise.resolve({ data: null, error: { code: 'unavailable' } }).then(resolve, reject);
    return query;
  });
  await expect(checkHomePermission(HOME, USER, 'finance.manage')).rejects.toMatchObject({ code: 'HOME_ACCESS_UNAVAILABLE', statusCode: 503 });
  await expect(hasPermission(HOME, USER, 'finance.manage')).rejects.toMatchObject({ code: 'HOME_ACCESS_UNAVAILABLE' });
});

test.each([{ role_base: 'unknown' }, { role_base: null, role: 'unknown' }, { role_base: null, role: null }])('unknown role cannot become a member: %j', async value => {
  seed(value);
  override('docs.view');
  expect((await getUserAccess(HOME, USER)).hasAccess).toBe(false);
});

test.each(['tenant', 'renter'])('known legacy %s retains existing lease defaults', async role => {
  seed({ role_base: null, role });
  expect(await hasPermission(HOME, USER, 'tasks.edit')).toBe(true);
});

test.each(['legacy', 'verified'])('valid %s owner retains access without an occupancy', async type => {
  db.seedTable('HomeOccupancy', []);
  if (type === 'legacy') db.getTable('Home')[0].owner_id = USER;
  else db.seedTable('HomeOwner', [{ home_id: HOME, subject_id: USER, subject_type: 'user', owner_status: 'verified' }]);
  expect((await checkHomePermission(HOME, USER, 'finance.manage')).hasAccess).toBe(true);
});

test('another kind of ownership subject cannot impersonate a user', async () => {
  db.seedTable('HomeOccupancy', []);
  db.seedTable('HomeOwner', [{ home_id: HOME, subject_id: USER, subject_type: 'business', owner_status: 'verified' }]);
  expect((await getUserAccess(HOME, USER)).hasAccess).toBe(false);
});

test('/me advertises effective rights rather than stale navigation flags', async () => {
  seed({ role_base: 'lease_resident', can_manage_tasks: false, can_view_sensitive: true, can_manage_home: true });
  const router = require('../routes/homeIam');
  const handler = router.stack.find(layer => layer.route?.path === '/:id/me').route.stack.at(-1).handle;
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
  await handler({ params: { id: HOME }, user: { id: USER } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
    hasAccess: true, can_manage_tasks: true, can_manage_home: false, can_view_sensitive: false,
  }));
});

test('pending personal context is exact to its caller and does not admit shared Home access', async () => {
  seed({ verification_status: 'pending_postcard' });
  expect(await getHomePersonalContext(HOME, USER)).toEqual({ occupancy: expect.objectContaining({ user_id: USER }) });
  expect(await getHomePersonalContext(HOME, 'different-person')).toBeNull();
  expect((await checkHomePermission(HOME, USER)).hasAccess).toBe(false);
  db.getTable('HomeOccupancy')[0].access_end_at = '2000-01-01T00:00:00Z';
  expect(await getHomePersonalContext(HOME, USER)).toBeNull();
});

test('pending mailbox nudge never queries or returns stored household postal validation', async () => {
  seed({ verification_status: 'pending_postcard' });
  const from = jest.spyOn(db, 'from');
  const router = require('../routes/mailboxCheck');
  const handler = router.stack.find(layer => layer.route?.path === '/:id/mailbox-check').route.stack.at(-1).handle;
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
  await handler({ params: { id: HOME }, user: { id: USER } }, response);
  expect(response.json).toHaveBeenCalledWith({ check: {
    verdict: 'unknown', findings: [], checked_at: null,
    physical: expect.objectContaining({ status: 'not_run' }),
  } });
  expect(from.mock.calls.map(([table]) => table)).not.toContain('HomeAddress');
});

test('/me reports a minor owner as limited and keeps explicit denial errors retryable', async () => {
  seed({ role_base: 'owner', age_band: 'child', can_manage_home: true });
  const router = require('../routes/homeIam');
  const handler = router.stack.find(layer => layer.route?.path === '/:id/me').route.stack.at(-1).handle;
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
  await handler({ params: { id: HOME }, user: { id: USER } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
    isOwner: false, is_owner: false, can_manage_home: false, can_manage_tasks: false, can_view_sensitive: false,
  }));
  jest.spyOn(db, 'from').mockImplementation(name => {
    const query = originalFrom(name);
    if (name === 'HomePermissionOverride') query.then = (resolve, reject) => Promise.resolve({ data: null, error: {} }).then(resolve, reject);
    return query;
  });
  await handler({ params: { id: HOME }, user: { id: USER } }, response);
  expect(response.status).toHaveBeenCalledWith(503);
});

async function homeRoute(path, method = 'get', params = {}, body = {}) {
  const router = require('../routes/home');
  const handler = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route.stack.at(-1).handle;
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn(), set: jest.fn() };
  await handler({ params: { id: HOME, ...params }, user: { id: USER },
    headers: { authorization: 'Bearer synthetic-effective-access-session' }, query: {}, body }, response);
  return response;
}

test('finance.view permits reading bills but never legacy finance mutation or its /me flag', async () => {
  override('finance.view');
  db.seedTable('HomeBill', [{ id: 'bill', home_id: HOME, amount: 42 }]);
  db.seedTable('HomeBillSplit', [{ bill_id: 'bill', user_id: USER, amount: 42 }]);
  expect((await checkHomePermission(HOME, USER, 'can_manage_finance')).hasAccess).toBe(false);
  expect((await homeRoute('/:id/bills')).json).toHaveBeenCalledWith({ bills: [expect.objectContaining({ amount: 42 })] });
  expect((await homeRoute('/:id/bills/:billId/splits', 'get', { billId: 'bill' })).json)
    .toHaveBeenCalledWith({ splits: [expect.objectContaining({ amount: 42 })] });
  for (const [path, method] of [['/:id/bills', 'post'], ['/:id/bills/:billId', 'put']]) {
    expect((await homeRoute(path, method, { billId: 'bill' }, { bill_type: 'power', amount: 1 })).status).toHaveBeenCalledWith(403);
  }
  expect(db.getTable('HomeBill')[0].amount).toBe(42);
  const router = require('../routes/homeIam');
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn(), set: jest.fn() };
  await router.stack.find(layer => layer.route?.path === '/:id/me').route.stack.at(-1).handle(
    { params: { id: HOME }, user: { id: USER } }, response);
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ can_manage_finance: false, permissions: ['finance.view'] }));
});

test('an owner denied finance/docs view cannot use management rights or the dashboard to read them', async () => {
  seed({ role_base: 'owner' });
  override('finance.view', false);
  override('docs.view', false);
  db.setRpcMock(async name => name === 'home_record_context'
    ? { data: { allowed: true, private: false, user_id: USER, role: 'owner', permissions: (await getUserAccess(HOME, USER)).permissions }, error: null }
    : name === 'get_home_records'
    ? { data: { ok: true, records: [], attendees: [] }, error: null }
    : name === 'home_delete_eligibility'
      ? { data: { allowed: false, deleted: false, code: 'HOME_DELETE_ACCESS_DENIED' }, error: null }
      : { data: null, error: { message: 'Unexpected RPC' } });
  expect(await hasPermission(HOME, USER, 'finance.manage')).toBe(true);
  const from = jest.spyOn(db, 'from');
  for (const path of ['/:id/bills', '/:id/bills/:billId/splits', '/:id/bill-trends']) {
    expect((await homeRoute(path, 'get', { billId: 'bill' })).status).toHaveBeenCalledWith(403);
  }
  const dashboard = await homeRoute('/:id/dashboard');
  expect(dashboard.json).toHaveBeenCalledWith(expect.objectContaining({
    today: expect.objectContaining({ next_bill: null }),
    counts: expect.objectContaining({ bills_due: 0, documents: 0 }),
  }));
  expect(from.mock.calls.map(([table]) => table)).not.toContain('HomeBill');
  expect(from.mock.calls.map(([table]) => table)).not.toContain('HomeDocument');
});

test.each(['adult_owner_denied', 'child_owner', 'member_flags'])('%s cannot bypass the secret transaction with stale flags or ownership', async scenario => {
  seed({ role_base: scenario === 'member_flags' ? 'member' : 'owner',
    age_band: scenario === 'child_owner' ? 'child' : 'adult',
    can_manage_access: true, can_view_sensitive: true });
  override('access.manage', false);
  override('sensitive.view', false);
  const rpc = jest.fn(async () => ({ data: { ok: false, code: 'HOME_SECRET_ACCESS_DENIED', status: 403 }, error: null }));
  db.setRpcMock(rpc);
  const from = jest.spyOn(db, 'from');
  const response = await homeRoute('/:id/access');
  expect(response.status).toHaveBeenCalledWith(403);
  expect(rpc).toHaveBeenCalledWith('get_home_access_secrets', { p_home_id: HOME, p_actor_id: USER });
  expect(from).not.toHaveBeenCalled();
});

test.each([
  { age_band: 'child' }, { age_band: 'teen' }, { is_active: false },
  { access_end_at: '2000-01-01T00:00:00Z' }, { verification_status: 'suspended' }, {},
])('verified ownership cannot restore household request review after effective denial: %j', async restrictions => {
  seed({ role_base: 'owner', ...restrictions }, { owner_id: USER });
  db.seedTable('HomeOwner', [{ home_id: HOME, subject_id: USER, subject_type: 'user', owner_status: 'verified' }]);
  override('members.manage', false);
  // The SQL contract verifies the same owner/age/status policy in the real
  // transaction. Keep route coverage across this new actor-bound RPC boundary.
  const rpc=jest.fn(async()=>({data:{ok:false,code:'MEMBERS_MANAGE_REQUIRED',status:403}}));
  db.setRpcMock(rpc);
  const from = jest.spyOn(db, 'from');
  for (const [path, method] of [
    ['/:id/household-access-requests', 'get'],
    ['/:id/household-access-requests/:requestId/approve', 'post'],
    ['/:id/household-access-requests/:requestId/reject', 'post'],
  ]) expect((await homeRoute(path, method, { requestId: 'request' })).status).toHaveBeenCalledWith(403);
  expect(from.mock.calls.map(([table]) => table)).not.toContain('HomeHouseholdAccessRequest');
  expect(rpc.mock.calls.every(([,args])=>args.p_home_id===HOME && args.p_actor_id===USER)).toBe(true);
});

test('Home detail does not reconstruct owner authority for a minor from HomeOwner', async () => {
  seed({ role_base: 'owner', age_band: 'teen' }, { owner_id: USER });
  db.seedTable('HomeOwner', [{ home_id: HOME, subject_id: USER, subject_type: 'user', owner_status: 'verified' }]);
  const response = await homeRoute('/:id');
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ home: expect.objectContaining({ isOwner: false }) }));
});

test.each(['/:id/bills', '/:id/access', '/:id/dashboard', '/:id/household-access-requests'])('auth failure in %s aborts as retryable 5xx', async path => {
  seed({ role_base: 'owner' });
  if (['/:id/access','/:id/household-access-requests'].includes(path)) db.setRpcMock(async () => ({ data: null, error: { code: '55P03' } }));
  jest.spyOn(db, 'from').mockImplementation(name => {
    const query = originalFrom(name);
    if (name === 'HomePermissionOverride') query.then = (resolve, reject) => Promise.resolve({ data: null, error: {} }).then(resolve, reject);
    return query;
  });
  expect((await homeRoute(path)).status).toHaveBeenCalledWith(['/:id/dashboard', '/:id/access','/:id/household-access-requests'].includes(path) ? 503 : 500);
});
