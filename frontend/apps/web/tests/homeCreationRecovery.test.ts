import { HomeCreationController } from '../src/components/homes/creation/HomeCreationController';
import type { HomeCreationSnapshot } from '../src/components/homes/creation/PendingHomeCreationStore';
import { validHomeCreationOutcome, type HomeCreationInput } from '../src/components/homes/creation/homeCreationModel';
import * as api from '@pantopus/api';

jest.mock('@pantopus/api', () => ({ getApiBaseUrl: () => 'https://api.example.invalid', getAuthToken: () => 'synthetic',
  AUTH_SESSION_CHANGE_KEY: 'synthetic-session-marker', users: { getMyProfile: jest.fn() }, apiClient: { request: jest.fn() } }));
const actor = 'ddc24100-0000-4000-8000-000000000001';
const input: HomeCreationInput = { address_id: 'ddc24100-0000-4000-8000-000000000002', address: 'Private fixture street',
  city: 'Test', state: 'WA', zip_code: '98607', latitude: 45, longitude: -122, role: 'owner', is_owner: true, home_type: 'house' };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
let saved: HomeCreationSnapshot | null;
let writes: number;
let failWrite: number;
let beforeSave: (() => Promise<void>) | undefined;
const store = {
  load: async () => saved ? clone(saved) : null,
  save: async (draft: HomeCreationSnapshot['draft'], expected: HomeCreationSnapshot | null, current: () => boolean) => {
    await beforeSave?.();
    if (!current() || saved?.revision !== expected?.revision || ++writes === failWrite) throw new Error('Protected write unavailable');
    saved = { draft: clone(draft), revision: String(writes) }; return clone(saved);
  },
  clear: async (expected: HomeCreationSnapshot, current: () => boolean) => {
    if (!current() || saved?.revision !== expected.revision) throw new Error('Saved request changed'); saved = null;
  },
};
const reply = (state = 'completed') => ({ status: state === 'rejected' ? 403 : 200, data: {
  state, command: { actor_id: actor, request_id: saved!.draft.request_id, created_at: '2026-09-11T12:00:00Z', updated_at: '2026-09-11T12:00:01Z' },
  ...(state === 'completed' ? { home: { id: 'ddc24100-0000-4000-8000-000000000003' },
    ownership_claim_id: 'ddc24100-0000-4000-8000-000000000004', access_secret_ids: [], role: 'owner',
    requires_verification: true, verification_type: 'ownership', current_access: 'not_checked' } : {}),
  ...(state === 'rejected' ? { code: 'HOME_SECRET_WRITE_DENIED' } : {}),
} });
async function open() { const controller = new HomeCreationController(); await controller.open(() => store); return controller; }
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); saved = null; writes = 0; failWrite = -1; beforeSave = undefined;
  global.structuredClone = clone;
  (api.users.getMyProfile as jest.Mock).mockResolvedValue({ id: actor });
  (api.apiClient.request as jest.Mock).mockImplementation(async () => reply());
});

test('unavailable initial protected write submits nothing and blocks replacement', async () => {
  const c = await open(); failWrite = 1;
  await expect(c.submit(input)).rejects.toThrow('Protected write');
  expect(api.apiClient.request).not.toHaveBeenCalled(); expect(c.needsReload).toBe(true);
  await expect(c.submit(input)).rejects.toThrow('original Home');
});
test('lost reply recovers the immutable original with a GET after reopening', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockRejectedValueOnce({ statusCode: 503 });
  await expect(c.submit(input)).rejects.toThrow('not confirmed');
  const original = clone(saved!); const next = await open(); await next.recover('status');
  expect(next.pending?.request_json).toBe(original.draft.request_json); expect(next.canAcknowledge).toBe(true);
  expect((api.apiClient.request as jest.Mock).mock.calls.map(([config]) => config.method)).toEqual(['POST', 'GET']);
});
test('wrong actor, secret count and verification result cannot acknowledge a command', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockRejectedValueOnce({});
  await expect(c.submit(input)).rejects.toThrow();
  const proof = reply().data;
  expect(validHomeCreationOutcome({ ...proof, command: { ...proof.command, actor_id: 'other' } }, saved!.draft)).toBe(false);
  expect(validHomeCreationOutcome({ ...proof, access_secret_ids: [actor] }, saved!.draft)).toBe(false);
  expect(validHomeCreationOutcome({ ...proof, requires_verification: false }, saved!.draft)).toBe(false);
  expect(c.canAcknowledge).toBe(false); await expect(c.acknowledge()).rejects.toThrow();
});
test('failed terminal-proof persistence is repaired without a second HTTP mutation', async () => {
  const c = await open(); failWrite = 2;
  await expect(c.submit(input)).rejects.toThrow('Protected write'); expect(c.canAcknowledge).toBe(false);
  failWrite = -1; await c.recover('retry'); expect(c.canAcknowledge).toBe(true);
  expect(api.apiClient.request).toHaveBeenCalledTimes(1);
});
test('unbound missing-command response stays unknown until confirmed cancellation', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockRejectedValueOnce({ statusCode: 404, data: { code: 'HOME_CREATE_COMMAND_NOT_FOUND' } });
  await expect(c.submit(input)).rejects.toThrow('not confirmed'); expect(c.canAcknowledge).toBe(false);
  (api.apiClient.request as jest.Mock).mockImplementation(async () => reply('cancelled'));
  await c.recover('cancel'); expect((await c.acknowledge()).outcome?.state).toBe('cancelled'); expect(saved).toBeNull();
});
test('bound rejected HTTP body remains recoverable and can restore the original fields', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockImplementation(async () => { const r = reply('rejected'); throw { statusCode: r.status, data: r.data }; });
  await c.submit(input); expect(c.canAcknowledge).toBe(true);
  expect(JSON.parse((await c.acknowledge()).request_json).address).toBe(input.address);
});
test('a stale tab cannot resubmit after another tab acknowledges the original', async () => {
  const first = await open(); await first.submit(input); const other = await open(); await other.acknowledge();
  await expect(first.recover('retry')).rejects.toThrow('Another tab'); expect(api.apiClient.request).toHaveBeenCalledTimes(1);
});
test('retirement during protected save cannot start a POST', async () => {
  const c = await open(); let release!: () => void;
  beforeSave = () => new Promise<void>(resolve => { release = resolve; });
  const action = c.submit(input); c.retire(); release();
  await expect(action).rejects.toThrow('Protected write'); expect(api.apiClient.request).not.toHaveBeenCalled(); expect(saved).toBeNull();
});

const residencyHome = 'ddc24100-0000-4000-8000-000000000010';
const residencyInput = { claimed_role: 'household' as const,
  address: { line1: 'Private fixture street', line2: 'Unit 7', city: 'Test', state: 'WA', postal_code: '98607', country: 'US' } };
const residencyReply = (state = 'completed') => ({ status: state === 'rejected' ? 409 : 200, data: {
  state, home_id: residencyHome, command: reply().data.command,
  ...(state === 'completed' ? { claim_id: 'ddc24100-0000-4000-8000-000000000011', occupancy_id: 'ddc24100-0000-4000-8000-000000000012',
    claimed_role: 'household', routing: 'household_review', requires_verification: true, current_access: 'not_checked',
    next_step: 'household_review', postcard_requested: false } : {}),
  ...(state === 'rejected' ? { code: 'RESIDENCY_ADDRESS_CHANGED' } : {}),
} });

test('residency lost reply reopens the exact Home/address command and cannot start creation', async () => {
  const first = await open(); (api.apiClient.request as jest.Mock).mockRejectedValueOnce({ statusCode: 503 });
  await expect(first.submitResidency(residencyHome.toUpperCase(), residencyInput)).rejects.toThrow('not confirmed');
  const original = clone(saved!);
  const next = await open(); await expect(next.submit(input)).rejects.toThrow('original Home');
  (api.apiClient.request as jest.Mock).mockImplementation(async () => residencyReply());
  await next.recover('status');
  expect(next.pending?.version).toBe(2); expect(next.pending?.request_json).toBe(original.draft.request_json);
  const calls = (api.apiClient.request as jest.Mock).mock.calls.map(([c]) => c);
  expect(calls.map(c => c.method)).toEqual(['POST', 'GET']);
  expect(calls[0].url).toBe(`/api/homes/${residencyHome}/residency-submissions`);
  expect(calls[1].url).toBe(`${calls[0].url}/${original.draft.request_id}`);
  expect(JSON.parse(calls[0].data)).toEqual({ ...residencyInput, request_id: original.draft.request_id });
});
test('residency result binds Home, role, unchecked current access and dispatch semantics', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockRejectedValueOnce({});
  await expect(c.submitResidency(residencyHome, residencyInput)).rejects.toThrow();
  const { validHomeRequestOutcome } = await import('../src/components/homes/creation/homeResidencySubmissionModel');
  const proof = residencyReply().data;
  for (const changes of [{ home_id: actor }, { claimed_role: 'renter' }, { current_access: 'granted' },
    { postcard_requested: true }, { next_step: 'address_verification' }, { occupancy_id: 'invalid' }]) {
    expect(validHomeRequestOutcome({ ...proof, ...changes }, saved!.draft)).toBe(false);
  }
  expect(validHomeRequestOutcome(proof, saved!.draft)).toBe(true); expect(c.canAcknowledge).toBe(false);
});
test('residency proof-write repair sends no second POST or cancellation', async () => {
  const c = await open(); failWrite = 2; (api.apiClient.request as jest.Mock).mockImplementation(async () => residencyReply());
  await expect(c.submitResidency(residencyHome, residencyInput)).rejects.toThrow('Protected write');
  failWrite = -1; await c.recover('cancel'); expect(c.canAcknowledge).toBe(true);
  expect(api.apiClient.request).toHaveBeenCalledTimes(1); expect((await c.acknowledge()).outcome?.state).toBe('completed');
});
test('throttled residency stays recoverable until cancellation is confirmed', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockRejectedValueOnce({ statusCode: 429, data: { code: 'RESIDENCY_SUBMISSION_RATE_LIMITED' } });
  await expect(c.submitResidency(residencyHome, residencyInput)).rejects.toThrow('not confirmed'); expect(c.canAcknowledge).toBe(false);
  (api.apiClient.request as jest.Mock).mockImplementation(async () => residencyReply('cancelled'));
  await c.recover('cancel');
  expect((api.apiClient.request as jest.Mock).mock.lastCall[0].url).toBe(`/api/homes/${residencyHome}/residency-submissions/${saved!.draft.request_id}/cancel`);
  const original = await c.acknowledge(); expect(JSON.parse(original.request_json).address).toEqual(residencyInput.address); expect(saved).toBeNull();
});
test('bound address rejection keeps editable original; acknowledgement permits a new UUID', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockImplementation(async () => { const r = residencyReply('rejected'); throw { statusCode: r.status, data: r.data }; });
  await c.submitResidency(residencyHome, residencyInput); const old = saved!.draft.request_id;
  await expect(c.submitResidency(residencyHome, residencyInput)).rejects.toThrow('original Home');
  expect((await c.acknowledge()).outcome?.code).toBe('RESIDENCY_ADDRESS_CHANGED');
  (api.apiClient.request as jest.Mock).mockImplementation(async () => residencyReply());
  await c.submitResidency(residencyHome, residencyInput); expect(saved!.draft.request_id).not.toBe(old);
});
test('a v1 creation command fences a competing v2 join across controllers', async () => {
  const create = await open(); const join = await open(); await create.submit(input);
  await expect(join.submitResidency(residencyHome, residencyInput)).rejects.toThrow('Protected write');
  expect(api.apiClient.request).toHaveBeenCalledTimes(1); expect(saved!.draft.version).toBe(1);
  const { validHomeRequestDraft } = await import('../src/components/homes/creation/homeResidencySubmissionModel');
  expect(validHomeRequestDraft(saved!.draft, create.origin, actor)).toBe(true);
  expect(validHomeRequestDraft({ ...saved!.draft, version: 2, home_id: residencyHome }, create.origin, actor)).toBe(false);
});
test('residency proof arriving after a session change cannot replace protected state', async () => {
  const c = await open(); (api.apiClient.request as jest.Mock).mockImplementation(async () => {
    localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'new-session'); return residencyReply();
  });
  await expect(c.submitResidency(residencyHome, residencyInput)).rejects.toThrow('no longer current');
  expect(saved!.draft.outcome).toBeUndefined(); expect(c.current()).toBe(false);
});
