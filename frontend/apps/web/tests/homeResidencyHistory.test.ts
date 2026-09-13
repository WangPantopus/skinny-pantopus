import * as api from '@pantopus/api';
import { HistoryController } from '@/components/home/residency/history/HistoryController';
import { historySession, validateHistoryPage, validateHistoryDetail, olderThan, type HistoryItem } from '@/components/home/residency/history/historyModel';

jest.mock('@pantopus/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  getAuthToken: jest.fn(() => 'synthetic-session'), getApiBaseUrl: jest.fn(() => 'https://synthetic.invalid'),
  AUTH_SESSION_CHANGE_KEY: 'history-session-test',
}));
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const home = id(900), actor = id(901), session = { actor_id: actor, session_scope: 'a'.repeat(64) };
const item = (n = 1): HistoryItem => ({
  decision: { id: id(n), home_id: home, claim_id: id(n + 1000), actor_id: actor, action: 'approve',
    created_at: `2026-09-13T08:00:00.${String(100000 - n).padStart(6, '0')}Z`, legacy_request: false,
    result: { status: 'verified', reviewed_at: '2026-09-13T08:00:00+00:00', occupancy_id: id(n + 2000), role_base: 'member' } },
  current: { claim_status: 'pending', applicant_lookup: 'current_claim_reference',
    applicant: { id: id(n + 3000), username: 'current_applicant', name: null }, household_access: 'not_checked' },
});
const cursor = (last: HistoryItem) => Buffer.from(JSON.stringify({ version: 1, actor_id: actor, home_id: home,
  created_at: last.decision.created_at, id: last.decision.id })).toString('base64url');
const page = (items = [item()], next: string | null = null) => ({ home_id: home, actor_id: actor, items, next_cursor: next, session });
const detail = (value = item()) => ({ home_id: home, actor_id: actor, item: value, session });
const get = api.apiClient.get as jest.Mock;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  (api.getAuthToken as jest.Mock).mockReturnValue('synthetic-session');
  (api.getApiBaseUrl as jest.Mock).mockReturnValue('https://synthetic.invalid');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});
const opened = () => get.mockResolvedValueOnce({ status: 200, data: { session } });

test('keeps immutable approval separate from a resubmitted current claim and null legacy role', () => {
  const value = item(); value.decision.legacy_request = true; value.decision.result.role_base = null;
  expect(() => validateHistoryDetail(detail(value), home, value.decision.id, session)).not.toThrow();
  expect(value.current.claim_status).toBe('pending'); expect(value.current.household_access).toBe('not_checked');
});
test('retains legitimate rejection nulls and unavailable current identity', () => {
  const value = item(); value.decision.action = 'reject'; value.decision.result = { status: 'rejected', reviewed_at: '2026-09-13T08:00:00Z', occupancy_id: null, role_base: null };
  value.current.applicant = null;
  expect(() => validateHistoryPage(page([value]), home, session)).not.toThrow();
});
test.each(['owner', 'admin', 'manager', 'member', 'restricted_member', 'guest', 'lease_resident', 'service_provider'])('accepts historical canonical role %s without granting access', role => {
  const value = item(); value.decision.result.role_base = role; expect(() => validateHistoryPage(page([value]), home, session)).not.toThrow();
});
test.each([
  ['foreign actor', (v: ReturnType<typeof page>) => { v.actor_id = id(999); }],
  ['foreign Home', (v: ReturnType<typeof page>) => { v.home_id = id(999); }],
  ['foreign session', (v: ReturnType<typeof page>) => { v.session = { ...session, session_scope: 'b'.repeat(64) }; }],
  ['foreign item actor', (v: ReturnType<typeof page>) => { v.items[0].decision.actor_id = id(999); }],
  ['foreign item Home', (v: ReturnType<typeof page>) => { v.items[0].decision.home_id = id(999); }],
  ['contradictory result', (v: ReturnType<typeof page>) => { v.items[0].decision.result.status = 'rejected'; }],
  ['missing occupancy', (v: ReturnType<typeof page>) => { v.items[0].decision.result.occupancy_id = null; }],
  ['unknown role', (v: ReturnType<typeof page>) => { v.items[0].decision.result.role_base = 'tenant'; }],
  ['invalid calendar date', (v: ReturnType<typeof page>) => { v.items[0].decision.result.reviewed_at = '2026-02-31T08:00:00Z'; }],
  ['year zero', (v: ReturnType<typeof page>) => { v.items[0].decision.result.reviewed_at = '0000-01-01T08:00:00Z'; }],
  ['noncanonical order date', (v: ReturnType<typeof page>) => { v.items[0].decision.created_at = '2026-09-13T08:00:00Z'; }],
  ['secret-bearing item', (v: ReturnType<typeof page>) => { Object.assign(v.items[0].decision, { review_token: 'redacted-synthetic-extra' }); }],
  ['raw applicant name', (v: ReturnType<typeof page>) => { Object.assign(v.items[0].current.applicant!, { name: 'Private account name' }); }],
  ['oversized username', (v: ReturnType<typeof page>) => { Object.assign(v.items[0].current.applicant!, { username: 'x'.repeat(101) }); }],
  ['invented current access', (v: ReturnType<typeof page>) => { Object.assign(v.items[0].current, { household_access: 'shared' }); }],
  ['missing required null', (v: ReturnType<typeof page>) => { delete (v.items[0].current.applicant as Partial<NonNullable<HistoryItem['current']['applicant']>>).name; }],
] as const)('rejects %s rather than presenting empty history', (_name, mutate) => {
  const value = page(); mutate(value); expect(() => validateHistoryPage(value, home, session)).toThrow();
});
test('rejects wrong exact detail and extra session identity fields', () => {
  expect(() => validateHistoryDetail(detail(), home, id(123), session)).toThrow();
  expect(() => historySession({ ...session, email: 'private@example.invalid' })).toThrow();
});
test('preserves microsecond and same-time ID ordering, bound cursor and no duplicate rows', () => {
  const items = Array.from({ length: 20 }, (_, n) => item(n + 1));
  expect(Date.parse(items[0].decision.created_at)).toBe(Date.parse(items[1].decision.created_at));
  expect(olderThan(items[1], items[0])).toBe(true);
  expect(() => validateHistoryPage(page(items, cursor(items[19])), home, session)).not.toThrow();
  expect(() => validateHistoryPage(page(items, cursor(items[18])), home, session)).toThrow();
  expect(() => validateHistoryPage(page([items[0], items[0]]), home, session)).toThrow();
  expect(() => validateHistoryPage(page([items[1], items[0]]), home, session)).toThrow();
  const a = item(2), b = item(1); a.decision.created_at = b.decision.created_at;
  expect(olderThan(b, a)).toBe(true);
});
test('checks session then reads only own bound pages without touching commands', async () => {
  const items = Array.from({ length: 20 }, (_, n) => item(n + 1)), next = cursor(items[19]);
  opened(); get.mockResolvedValueOnce({ status: 200, data: page(items, next) }).mockResolvedValueOnce({ status: 200, data: page([item(21)]) });
  const c = new HistoryController(home); await c.open(); await c.loadMore();
  expect(c.items).toHaveLength(21); expect(c.nextCursor).toBeNull();
  expect(get.mock.calls[2][1].params).toEqual({ after: next });
  expect(get.mock.calls[2][1].headers['X-Pantopus-Session-Scope']).toBe(session.session_scope);
  expect(api.apiClient.post).not.toHaveBeenCalled(); expect(api.apiClient.delete).not.toHaveBeenCalled();
});
test('reads exact detail through a separate GET', async () => {
  opened(); get.mockResolvedValueOnce({ status: 200, data: detail() });
  const c = new HistoryController(home, item().decision.id); await c.open();
  expect(c.detail).toEqual(item()); expect(c.items).toEqual([]); expect(c.nextCursor).toBeNull();
  expect(get.mock.calls[1][0].endsWith('/' + home + '/' + item().decision.id)).toBe(true);
});
test.each([403, 503])('clears prior pages after current read %s; failure never becomes empty success', async statusCode => {
  const items = Array.from({ length: 20 }, (_, n) => item(n + 1));
  opened(); get.mockResolvedValueOnce({ status: 200, data: page(items, cursor(items[19])) }).mockRejectedValueOnce({ statusCode });
  const c = new HistoryController(home); await c.open(); await expect(c.loadMore()).rejects.toBeDefined();
  expect(c.ready).toBe(false); expect(c.items).toEqual([]); expect(c.nextCursor).toBeNull();
});
test.each(['account', 'origin', 'background', 'retire'])('retires held history after %s changes', async change => {
  const held = deferred<{ status: number; data: ReturnType<typeof page> }>();
  opened(); get.mockReturnValueOnce(held.promise);
  const c = new HistoryController(home), task = c.open(); await Promise.resolve(); await Promise.resolve();
  if (change === 'account') (api.getAuthToken as jest.Mock).mockReturnValue('another-session');
  if (change === 'origin') (api.getApiBaseUrl as jest.Mock).mockReturnValue('https://another.invalid');
  if (change === 'background') Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  if (change === 'retire') c.retire();
  held.resolve({ status: 200, data: page() }); await expect(task).rejects.toBeDefined();
  expect(c.items).toEqual([]); expect(c.ready).toBe(false);
});
test('rejects overlapping older pages and non-200 success-shaped replies', async () => {
  const items = Array.from({ length: 20 }, (_, n) => item(n + 1));
  opened(); get.mockResolvedValueOnce({ status: 200, data: page(items, cursor(items[19])) }).mockResolvedValueOnce({ status: 200, data: page([items[19]]) });
  const c = new HistoryController(home); await c.open(); await expect(c.loadMore()).rejects.toThrow(); expect(c.items).toEqual([]);
  opened(); get.mockResolvedValueOnce({ status: 202, data: page() }); await expect(new HistoryController(home).open()).rejects.toThrow();
});
test.each(['reordered', 'whitespace', 'duplicate-key', 'padding', 'oversized'])('rejects a %s cursor before showing an unusable next page', async kind => {
  const items = Array.from({ length: 20 }, (_, n) => item(n + 1));
  const canonical = cursor(items[19]), decoded = Buffer.from(canonical, 'base64url').toString();
  let malformed = canonical;
  if (kind === 'reordered') {
    const { version, ...rest } = JSON.parse(decoded); malformed = Buffer.from(JSON.stringify({ ...rest, version })).toString('base64url');
  }
  if (kind === 'whitespace') malformed = Buffer.from(decoded + ' ').toString('base64url');
  if (kind === 'duplicate-key') malformed = Buffer.from(decoded.replace('{', '{"version":1,')).toString('base64url');
  if (kind === 'padding') malformed += '=';
  if (kind === 'oversized') malformed = 'a'.repeat(601);
  opened(); get.mockResolvedValueOnce({ status: 200, data: page(items, malformed) });
  const c = new HistoryController(home); await expect(c.open()).rejects.toThrow();
  expect(c.ready).toBe(false); expect(c.items).toEqual([]); expect(c.nextCursor).toBeNull();
});
