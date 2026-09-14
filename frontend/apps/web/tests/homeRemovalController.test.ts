import { webcrypto } from 'node:crypto';
import * as api from '@pantopus/api';
import { RemovalController } from '../src/components/home/member-removals/RemovalController';
import { validRemovalDraft, validateRemovalContext, validRemovalInput, validRemovalOutcome, type RemovalDraft } from '../src/components/home/member-removals/removalModel';
import type { RemovalSnapshot } from '../src/components/home/member-removals/PendingRemovalStore';

jest.mock('@pantopus/api', () => ({ getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:18080'), getAuthToken: jest.fn(() => 'synthetic'),
  AUTH_SESSION_CHANGE_KEY: 'session-marker', apiClient: { get: jest.fn(), post: jest.fn(), request: jest.fn() }, users: { getMyProfile: jest.fn() } }));
const actor = '10000000-0000-4000-8000-000000000001', home = '10000000-0000-4000-8000-000000000002';
const target = '10000000-0000-4000-8000-000000000003', occupancy = '10000000-0000-4000-8000-000000000004';
const session = { actor_id: actor, session_scope: 'a'.repeat(64) }, decision = 'b'.repeat(64);
const input = { home_id: home, target_user_id: target };
const context = { ...input, occupancy_id: occupancy, action: 'remove', decision_token: decision, session,
  home: { id: home, name: 'Fixture household' }, target: { id: target, name: null, username: 'fixture_member', role_base: 'member',
    is_self: false, is_active: true, verification_status: 'verified', start_at: null, end_at: null, access_start_at: null, access_end_at: null } };
function memory() {
  let snapshot: RemovalSnapshot | null = null, count = 0;
  return { load: jest.fn(async () => snapshot), save: jest.fn(async (draft: RemovalDraft, expected: RemovalSnapshot | null, current: () => boolean) => {
    if (!current() || (snapshot?.revision ?? null) !== (expected?.revision ?? null)) throw Error('Changed');
    snapshot = { draft: structuredClone(draft), revision: String(++count) }; return snapshot;
  }), clear: jest.fn(async () => { snapshot = null; }) };
}
const result = (d: RemovalDraft) => ({ state: 'completed', ...input, occupancy_id: occupancy, action: 'remove', decision_token: decision,
  completed_at: '2026-09-13T12:00:00Z', code: null, status: null,
  command: { actor_id: actor, request_id: d.request_id, created_at: '2026-09-13T12:00:00Z', updated_at: '2026-09-13T12:00:00Z' }, session });
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  Object.defineProperty(globalThis, 'structuredClone', { configurable: true, value: (v: unknown) => JSON.parse(JSON.stringify(v)) });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  jest.mocked(api.getApiBaseUrl).mockReturnValue('http://127.0.0.1:18080'); jest.mocked(api.getAuthToken).mockReturnValue('synthetic');
  jest.mocked(api.apiClient.get).mockResolvedValue({ data: { session } } as never);
  jest.mocked(api.users.getMyProfile).mockResolvedValue({ id: actor, name: 'Fixture' } as never);
  jest.mocked(api.apiClient.post).mockResolvedValue({ data: context } as never);
});
async function prepared() { const store = memory(), c = new RemovalController(); await c.open(() => store); await c.prepare(input); return { store, c }; }
test('named review cancellation makes no command or original; failed original persistence blocks dispatch', async () => {
  const { store, c } = await prepared(); c.cancelReview(); expect(c.context).toBeNull(); expect(store.save).not.toHaveBeenCalled();
  expect(api.apiClient.request).not.toHaveBeenCalled(); await c.prepare(input); store.save.mockRejectedValueOnce(Error('Storage unavailable'));
  await expect(c.submit(decision)).rejects.toThrow('Storage unavailable'); expect(api.apiClient.request).not.toHaveBeenCalled(); expect(c.needsReload).toBe(true);
});
test('lost reply survives a new login and retries exact original bytes without re-preparing', async () => {
  const { store, c } = await prepared(); jest.mocked(api.apiClient.request).mockRejectedValueOnce(Error('Lost reply'));
  await expect(c.submit(decision)).rejects.toThrow('result is not confirmed'); const original = c.pending!;
  expect(validRemovalDraft(original, c.origin, actor)).toBe(true); c.retire();
  const nextSession = { ...session, session_scope: 'c'.repeat(64) };
  jest.mocked(api.apiClient.get).mockResolvedValue({ data: { session: nextSession } } as never);
  const cold = new RemovalController(); await cold.open(() => store);
  jest.mocked(api.apiClient.request).mockResolvedValueOnce({ status: 200, data: { ...result(original), session: nextSession } } as never);
  await cold.recover('retry', original.request_id);
  const request = jest.mocked(api.apiClient.request).mock.calls[1][0];
  expect(request.data).toBe(original.request_json); expect(request.headers?.['X-Pantopus-Session-Scope']).toBe(nextSession.session_scope);
  expect(api.apiClient.post).toHaveBeenCalledTimes(1); expect(cold.canAcknowledge).toBe(true);
  await cold.recover('retry', original.request_id); expect(api.apiClient.request).toHaveBeenCalledTimes(2);
});
test('receipt persistence retry never repeats removal; acknowledgement cannot erase another tab’s original', async () => {
  const { store, c } = await prepared();
  jest.mocked(api.apiClient.request).mockImplementation(async () => {
    store.save.mockRejectedValueOnce(Error('Receipt storage failed')); return { status: 200, data: result(c.pending!) } as never;
  });
  await expect(c.submit(decision)).rejects.toThrow('Receipt storage failed'); expect(c.canAcknowledge).toBe(false);
  await c.recover('retry'); expect(api.apiClient.request).toHaveBeenCalledTimes(1); expect(c.canAcknowledge).toBe(true);
  store.clear.mockRejectedValueOnce(Error('Another tab changed the original'));
  await expect(c.acknowledge(c.pending!.request_id)).rejects.toThrow('Another tab'); expect(c.pending).not.toBeNull();
  await c.acknowledge(c.pending!.request_id); expect(await store.load()).toBeNull();
});
test('unseen cancellation sends the original intent and cannot treat unknown404 as cancellation', async () => {
  const { c } = await prepared(); jest.mocked(api.apiClient.request).mockRejectedValueOnce(Error('Lost reply'));
  await expect(c.submit(decision)).rejects.toThrow('result is not confirmed'); const original = c.pending!;
  jest.mocked(api.apiClient.request).mockRejectedValueOnce({ statusCode: 404, data: { state: 'unknown', code: 'MEMBER_REMOVAL_NOT_FOUND', session } });
  await expect(c.recover('status')).rejects.toThrow('result is not confirmed'); expect(c.canAcknowledge).toBe(false);
  jest.mocked(api.apiClient.request).mockResolvedValueOnce({ status: 200, data: { ...result(original), state: 'cancelled', completed_at: null } } as never);
  await c.recover('cancel', original.request_id);
  const request = jest.mocked(api.apiClient.request).mock.calls[2][0];
  expect(request.method).toBe('POST'); expect(request.url).toBe(`/api/homes/member-removals/commands/${original.request_id}/cancel`);
  const body = JSON.parse(request.data as string); expect(body.request_id).toBeUndefined();
  expect(body).toEqual({ ...input, occupancy_id: occupancy, action: 'remove', decision_token: decision });
  expect(c.pending?.outcome?.state).toBe('cancelled');
});
test('a completed removal wins cancellation and authoritative rejection requires its exact status', async () => {
  const { c } = await prepared(); jest.mocked(api.apiClient.request).mockRejectedValueOnce(Error('Lost reply'));
  await expect(c.submit(decision)).rejects.toThrow('result is not confirmed'); const original = c.pending!;
  jest.mocked(api.apiClient.request).mockResolvedValueOnce({ status: 200, data: result(original) } as never);
  await c.recover('cancel'); expect(c.pending?.outcome?.state).toBe('completed');
  const rejection = { ...result(original), state: 'rejected', completed_at: null, code: 'MEMBERS_MANAGE_REQUIRED', status: 403 };
  expect(validRemovalOutcome(rejection, original)).toBe(true);
  expect(validRemovalOutcome({ ...rejection, status: 409 }, original)).toBe(false);
  for (const code of ['MEMBER_REMOVAL_INVALID', 'MEMBER_REMOVAL_CONFLICT', 'MEMBER_REMOVAL_ACCOUNT_UNAVAILABLE', 'MEMBER_REMOVAL_UNAVAILABLE'])
    expect(validRemovalOutcome({ ...rejection, code }, original)).toBe(false);
});
test('a result read cannot accept a mutation replay envelope as historical proof', async () => {
  const { c } = await prepared(); jest.mocked(api.apiClient.request).mockRejectedValueOnce(Error('Lost reply'));
  await expect(c.submit(decision)).rejects.toThrow('result is not confirmed'); const original = c.pending!;
  jest.mocked(api.apiClient.request).mockResolvedValueOnce({ status: 200, data: { ...result(original), replayed: true } } as never);
  await expect(c.recover('status')).rejects.toThrow('result is not confirmed');
  expect(c.pending?.request_json).toBe(original.request_json); expect(c.pending?.outcome).toBeUndefined();
  jest.mocked(api.apiClient.request).mockResolvedValueOnce({ status: 200, data: result(original) } as never);
  await c.recover('status'); expect(c.pending?.outcome?.state).toBe('completed');
});
test.each(['home_id', 'target_user_id', 'occupancy_id', 'decision_token', 'state', 'completed_at', 'command', 'session'])('malformed or foreign %s cannot replace the original', async field => {
  const { c } = await prepared();
  const corrupt: Record<string, unknown> = { home_id: actor, target_user_id: actor, occupancy_id: actor, decision_token: 'c'.repeat(64),
    state: ['completed'], completed_at: '2026-02-31T12:00:00Z', command: { actor_id: target }, session: { ...session, actor_id: target } };
  jest.mocked(api.apiClient.request).mockImplementation(async () => ({ status: 200, data: { ...result(c.pending!), [field]: corrupt[field] } } as never));
  await expect(c.submit(decision)).rejects.toThrow('result is not confirmed'); expect(c.pending?.outcome).toBeUndefined(); expect(c.canAcknowledge).toBe(false);
});
test.each(['token', 'marker', 'origin', 'hidden', 'scope', 'unauthorized'])('%s lifetime change prevents another removal request and keeps its original', async change => {
  const { c, store } = await prepared(); jest.mocked(api.apiClient.request).mockRejectedValueOnce(Error('Lost reply'));
  await expect(c.submit(decision)).rejects.toThrow('result is not confirmed'); const original = c.pending!.request_json;
  if (change === 'token') jest.mocked(api.getAuthToken).mockReturnValue('other-account');
  if (change === 'marker') localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'changed');
  if (change === 'origin') jest.mocked(api.getApiBaseUrl).mockReturnValue('https://other.invalid');
  if (change === 'hidden') Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  if (change === 'scope') jest.mocked(api.apiClient.get).mockResolvedValueOnce({ data: { session: { ...session, session_scope: 'c'.repeat(64) } } } as never);
  if (change === 'unauthorized') jest.mocked(api.apiClient.get).mockRejectedValueOnce({ statusCode: 401 });
  await expect(c.recover('retry')).rejects.toThrow(); expect(api.apiClient.request).toHaveBeenCalledTimes(1);
  expect((await store.load())?.draft.request_json).toBe(original);
});
test('a second screen cannot replace a saved original and stale read failure leaves a completed receipt intact', async () => {
  const { c, store } = await prepared(); const other = new RemovalController(); await other.open(() => store); await other.prepare(input);
  jest.mocked(api.apiClient.request).mockImplementation(async () => ({ status: 200, data: result(c.pending!) } as never));
  await c.submit(decision); await expect(other.submit(decision)).rejects.toThrow('Changed'); expect(api.apiClient.request).toHaveBeenCalledTimes(1);
  jest.mocked(api.apiClient.get).mockImplementation(async url => {
    if (String(url).endsWith('/occupants')) throw Object.assign(Error('Current list unavailable'), { statusCode: 503 });
    return { data: { session } } as never;
  });
  await expect(c.checkCurrentRoster(input)).rejects.toThrow('Current list unavailable'); expect(c.pending?.outcome?.state).toBe('completed');
  expect(c.canAcknowledge).toBe(true); expect(api.apiClient.request).toHaveBeenCalledTimes(1);
});
test('current roster confirmation validates Home/target identity and rechecks the session after reading', async () => {
  const { c } = await prepared();
  jest.mocked(api.apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/occupants')
    ? { occupants: [{ id: occupancy, home_id: home, user_id: target, is_active: true }] } : { session } }) as never);
  await expect(c.checkCurrentRoster(input)).resolves.toBe(true);
  jest.mocked(api.apiClient.get).mockImplementation(async url => ({ data: String(url).endsWith('/occupants') ? { occupants: [] } : { session } }) as never);
  await expect(c.checkCurrentRoster(input)).resolves.toBe(false);
  jest.mocked(api.apiClient.get).mockResolvedValueOnce({ data: { session } } as never)
    .mockResolvedValueOnce({ data: { occupants: [] } } as never)
    .mockResolvedValueOnce({ data: { session: { ...session, actor_id: target } } } as never);
  await expect(c.checkCurrentRoster(input)).rejects.toThrow('session changed'); expect(c.current()).toBe(false);
});
test('review rejects malformed nullable fields, booleans, dates and unrelated identities', () => {
  for (const targetChange of [{ is_self: true }, { is_active: 'true' }, { name: 'Raw account name' }, { username: [] }, { role_base: null },
    { verification_status: false }, { access_end_at: 'tomorrow' }, { access_end_at: '2026-02-31T12:00:00Z' }, { id: actor }])
    expect(() => validateRemovalContext({ ...context, target: { ...context.target, ...targetChange } }, input, session)).toThrow('could not be confirmed');
  expect(validRemovalInput({ ...input, extra: 'ignored' })).toBe(false);
  expect(() => validateRemovalContext(context, input, session)).not.toThrow();
});
test.each(['lease_resident', 'service_provider'])('legitimate canonical %s membership can be reviewed', role => {
  expect(() => validateRemovalContext({ ...context, target: { ...context.target, role_base: role } }, input, session)).not.toThrow();
});
