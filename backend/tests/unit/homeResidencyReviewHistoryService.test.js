const db = require('../__mocks__/supabaseAdmin');
const service = require('../../services/homeResidencyReviewHistoryService');
const id = n => `ddc27100-0000-4000-8000-${String(n).padStart(12, '0')}`;
const homeId = id(100), actorId = id(1), targetId = id(2);
const stamp = '2026-09-13T10:00:00.123456Z';
const input = { homeId, actorId };
const item = (n = 99) => ({ decision: { id: id(n), home_id: homeId, claim_id: id(200), actor_id: actorId,
  action: 'approve', created_at: stamp, legacy_request: false,
  result: { status: 'verified', reviewed_at: '2026-09-13T10:00:00.123400+00:00', occupancy_id: id(201), role_base: 'member' } },
current: { claim_status: 'pending', applicant_lookup: 'current_claim_reference',
  applicant: { id: targetId, username: 'public_member', name: null }, household_access: 'not_checked' } });
const page = (items = [item()]) => ({ ok: true, home_id: homeId, actor_id: actorId, items, next_cursor: null });
const cursor = value => ({ version: 1, actor_id: actorId, home_id: homeId, created_at: value.decision.created_at, id: value.decision.id });
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
beforeEach(() => db.resetTables());
function mock(value) { const fn = jest.fn(async () => ({ data: value, error: null })); db.setRpcMock(fn); return fn; }
test('only authenticated own actor/Home is sent; saved outcome is distinct from current claim and unchecked access', async () => {
  const fn = mock(page()); const result = await service.list(input);
  expect(fn).toHaveBeenCalledWith('list_home_residency_review_history', { p_home_id: homeId, p_actor_id: actorId, p_after_id: null, p_after_created_at: null });
  expect(result.items[0]).toEqual(item()); expect(result.items[0].decision.result.status).toBe('verified');
  expect(result.items[0].current.claim_status).toBe('pending'); expect(result.items[0].current.household_access).toBe('not_checked');
});
test('current lookup absence and genuinely null legacy approval base do not invent historical identity/role', async () => {
  const value = item(); value.current.applicant = null; value.decision.legacy_request = true; value.decision.result.role_base = null;
  mock(page([value])); expect((await service.list(input)).items[0]).toEqual(value);
});
test('rejection has only its recorded status/date and genuinely null occupancy/role', async () => {
  const value = item(); value.decision.action = 'reject'; Object.assign(value.decision.result, { status: 'rejected', occupancy_id: null, role_base: null });
  mock(page([value])); const result = await service.list(input); expect(result.items[0]).toEqual(value);
  expect(result.items[0].decision).not.toHaveProperty('reason');
});
test('newest-first equal-time UUID tie paging binds exact original anchor and preserves all microseconds', async () => {
  const values = Array.from({ length: 20 }, (_, i) => item(99 - i)); const payload = page(values); payload.next_cursor = cursor(values.at(-1));
  mock(payload); const result = await service.list(input); expect(result.next_cursor).toBe(encoded(payload.next_cursor));
  const fn = mock(page([item(79)])); await service.list({ ...input, after: result.next_cursor });
  expect(fn).toHaveBeenCalledWith('list_home_residency_review_history', { p_home_id: homeId, p_actor_id: actorId, p_after_id: id(80), p_after_created_at: stamp });
});
test.each([null, [], '', false, 'bad=', encoded({ ...cursor(item()), actor_id: id(8) }), encoded({ ...cursor(item()), home_id: id(8) }),
  encoded({ ...cursor(item()), extra: true }), encoded({ ...cursor(item()), created_at: '2026-02-30T00:00:00.000000Z' }),
  Buffer.from(' {"version":1}').toString('base64url'), 'a'.repeat(601)])('malformed or foreign cursor never reaches SQL: %j', async after => {
  const fn = mock(page()); await expect(service.list({ ...input, after })).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_CURSOR_INVALID', statusCode: 400 }); expect(fn).not.toHaveBeenCalled();
});
test.each([r => { r.ok = 'true'; }, r => { r.actor_id = id(8); }, r => { r.home_id = id(8); }, r => { r.items = {}; },
  r => { delete r.next_cursor; }, r => { r.items = [item(98), item(99)]; }, r => { r.items = [item(), item()]; },
  r => { r.items = Array.from({ length: 21 }, (_, i) => item(99 - i)); }, r => { r.next_cursor = cursor(item()); },
])('malformed page, binding, duplicate and ordering cannot become empty/success', async mutate => {
  const value = page(); mutate(value); mock(value); await expect(service.list(input)).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_UNAVAILABLE' });
});
test('a page cannot replay its anchor or reverse its cursor', async () => {
  mock(page()); await expect(service.list({ ...input, after: encoded(cursor(item())) })).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_UNAVAILABLE' });
});
test.each([
  v => { v.decision.action = ['approve']; }, v => { v.decision.result.status = ['verified']; }, v => { v.decision.legacy_request = 'false'; },
  v => { v.decision.created_at = null; }, v => { v.decision.created_at = '2026-02-30T10:00:00.123456Z'; },
  v => { v.decision.result.reviewed_at = null; }, v => { v.decision.result.reviewed_at = '2026-09-13T24:00:00Z'; },
  v => { delete v.decision.result.reviewed_at; }, v => { delete v.decision.result.role_base; }, v => { delete v.decision.result.occupancy_id; },
  v => { v.decision.result.status = 'rejected'; }, v => { v.decision.result.occupancy_id = null; }, v => { v.decision.result.role_base = ['member']; },
  v => { v.decision.home_id = id(8); }, v => { v.decision.actor_id = id(8); }, v => { v.decision.id = null; },
  v => { v.current.applicant.name = 'Private legal name'; }, v => { v.current.applicant.username = ['public']; },
  v => { v.current.applicant_lookup = 'original'; }, v => { v.current.household_access = 'shared'; }, v => { v.current.claim_status = ['pending']; },
  v => { delete v.current.applicant; },
])('required historical/current fields fail closed rather than coercing or defaulting', async mutate => {
  const value = item(); mutate(value); mock(page([value])); await expect(service.list(input)).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_UNAVAILABLE' });
});
test('unexpected upstream sensitive fields are explicitly excluded at every projected level', async () => {
  const value = item(); Object.assign(value, { review_token: 'PRIVATE_SENTINEL' });
  Object.assign(value.decision, { request_hash: 'PRIVATE_SENTINEL', reason: 'PRIVATE_SENTINEL' });
  Object.assign(value.decision.result, { note: 'PRIVATE_SENTINEL' });
  Object.assign(value.current, { review_note: 'PRIVATE_SENTINEL', postcard_code_id: 'PRIVATE_SENTINEL' });
  Object.assign(value.current.applicant, { email: 'PRIVATE_SENTINEL', city: 'PRIVATE_SENTINEL' });
  mock(page([value])); expect(JSON.stringify(await service.list(input))).not.toContain('PRIVATE_SENTINEL');
});
test('single receipt matches its exact route ID and excludes other actor data', async () => {
  mock({ ok: true, home_id: homeId, actor_id: actorId, item: item() }); expect((await service.read({ ...input, receiptId: id(99) })).item).toEqual(item());
  await expect(service.read({ ...input, receiptId: id(98) })).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_UNAVAILABLE' });
});
test.each([['MEMBERS_MANAGE_REQUIRED', 403], ['RESIDENCY_HISTORY_NOT_FOUND', 404], ['HOME_NOT_FOUND', 404], ['RESIDENCY_HISTORY_CURSOR_INVALID', 400]])('authoritative %s remains an error, never an empty list', async (code, status) => {
  mock({ ok: false, code, status, error: 'Private upstream detail' }); await expect(service.list(input)).rejects.toMatchObject({ code, statusCode: status });
});
test.each([null, { ok: false, code: ['MEMBERS_MANAGE_REQUIRED'], status: 403 }, { ok: false, code: 'MEMBERS_MANAGE_REQUIRED', status: 503 },
  { ok: false, code: 'PRIVATE_UPSTREAM_CODE', status: 400 }])('unknown/malformed upstream errors are generic unavailable', async value => {
  mock(value); await expect(service.list(input)).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_UNAVAILABLE', statusCode: 503 });
});
test('transport failure cannot empty history; an authorized empty list is explicit', async () => {
  db.setRpcMock(async () => { throw Error('PRIVATE_SENTINEL'); }); await expect(service.list(input)).rejects.toMatchObject({ code: 'RESIDENCY_HISTORY_UNAVAILABLE' });
  mock(page([])); expect(await service.list(input)).toEqual({ home_id: homeId, actor_id: actorId, items: [], next_cursor: null });
});
