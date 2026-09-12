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
