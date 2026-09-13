import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import { useHistory } from '@/components/home/residency/history/useHistory';
import { ResidencyHistoryPanel } from '@/components/home/residency/history/ResidencyHistoryPanel';
import { HISTORY_BASE, type HistoryItem } from '@/components/home/residency/history/historyModel';

jest.mock('@pantopus/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  getAuthToken: jest.fn(), getApiBaseUrl: jest.fn(() => 'https://synthetic.invalid'),
  AUTH_SESSION_CHANGE_KEY: 'history-session-test', onTokenChange: jest.fn(),
}));
const id = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const home = id(900), actor = id(901);
const session = { actor_id: actor, session_scope: 'a'.repeat(64) };
const item = (n = 1): HistoryItem => ({
  decision: { id: id(n), home_id: home, claim_id: id(n + 1000), actor_id: actor, action: 'approve',
    created_at: `2026-09-13T08:00:00.${String(100000 - n).padStart(6, '0')}Z`, legacy_request: false,
    result: { status: 'verified', reviewed_at: '2026-09-13T08:00:00+00:00', occupancy_id: id(n + 2000), role_base: 'member' } },
  current: { claim_status: 'pending', applicant_lookup: 'current_claim_reference',
    applicant: { id: id(n + 3000), username: `current_applicant_${n}`, name: null }, household_access: 'not_checked' },
});
const items = () => Array.from({ length: 20 }, (_, n) => item(n + 1));
const cursor = (last: HistoryItem) => btoa(JSON.stringify({ version: 1, actor_id: actor, home_id: home,
  created_at: last.decision.created_at, id: last.decision.id })).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const page = (rows: HistoryItem[] = [item()], more = false) => ({ status: 200,
  data: { home_id: home, actor_id: actor, items: rows, next_cursor: more ? cursor(rows.at(-1)!) : null, session } });
const sessionResponse = { status: 200, data: { session } };
const get = api.apiClient.get as jest.Mock;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
let sessionChanged: () => void;
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  Object.defineProperty(globalThis, 'structuredClone', { configurable: true, value: (v: unknown) => JSON.parse(JSON.stringify(v)) });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  jest.mocked(api.getAuthToken).mockReturnValue('synthetic-session');
  jest.mocked(api.getApiBaseUrl).mockReturnValue('https://synthetic.invalid');
  jest.mocked(api.onTokenChange).mockImplementation(callback => { sessionChanged = () => callback(null); return () => {}; });
  get.mockImplementation(async path => path === HISTORY_BASE + '/session' ? sessionResponse : page());
});

test('shows a recorded approval beside a resubmitted current request without access or original-note claims', async () => {
  render(<ResidencyHistoryPanel homeId={home} />);
  await screen.findByRole('heading', { name: 'Approved residency request' });
  expect(screen.getByText('Waiting for household review')).toBeVisible();
  expect(screen.getByText('Current applicant: @current_applicant_1')).toBeVisible();
  expect(screen.getByText('This recorded decision does not confirm current household access.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'View decision' })).toHaveAttribute('href', `/app/homes/${home}/owners/review-claim/history?receipt=${id(1)}`);
  expect(screen.getByRole('link', { name: 'Check current request' })).toHaveAttribute('href', `/app/homes/${home}/owners/review-claim/residency?claimId=${id(1001)}`);
  expect(screen.queryByRole('button', { name: /Approve|Reject|Save|Acknowledge/ })).not.toBeInTheDocument();
  expect(api.apiClient.post).not.toHaveBeenCalled(); expect(api.apiClient.delete).not.toHaveBeenCalled();
});

test('only a verified empty success shows no decisions; a failed reload hides previous history until retry', async () => {
  render(<ResidencyHistoryPanel homeId={home} />);
  await screen.findByRole('heading', { name: 'Approved residency request' });
  get.mockImplementation(async path => {
    if (path === HISTORY_BASE + '/session') return sessionResponse;
    throw { statusCode: 503, message: 'private-server-diagnostic' };
  });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh decisions' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('Current applicant: @current_applicant_1')).not.toBeInTheDocument();
  expect(screen.queryByText('You have no recorded residency decisions for this Home.')).not.toBeInTheDocument();
  expect(screen.queryByText(/private-server-diagnostic/)).not.toBeInTheDocument();
  get.mockImplementation(async path => path === HISTORY_BASE + '/session' ? sessionResponse : page([]));
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading decisions' }));
  await screen.findByText('You have no recorded residency decisions for this Home.');
});

test('exact detail keeps an unavailable current applicant explicit and has no list-only actions', async () => {
  const saved = item(); saved.current.applicant = null;
  get.mockImplementation(async path => path === HISTORY_BASE + '/session' ? sessionResponse
    : { status: 200, data: { home_id: home, actor_id: actor, item: saved, session } });
  render(<ResidencyHistoryPanel homeId={home} receiptId={saved.decision.id} />);
  await screen.findByRole('heading', { name: 'Approved residency request' });
  expect(screen.getByText(/Applicant name unavailable/)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Back to your decisions' })).toHaveAttribute('href', `/app/homes/${home}/owners/review-claim/history`);
  expect(screen.queryByRole('link', { name: 'View decision' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Load older decisions' })).not.toBeInTheDocument();
});

test('two same-render Load older calls issue one GET and append one page', async () => {
  const held = deferred<ReturnType<typeof page>>(); let listReads = 0;
  get.mockImplementation(async path => path === HISTORY_BASE + '/session' ? sessionResponse
    : ++listReads === 1 ? page(items(), true) : await held.promise);
  const { result } = renderHook(() => useHistory(home, null));
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  let first!: Promise<void>, second!: Promise<void>;
  act(() => { first = result.current.loadMore(); second = result.current.loadMore(); });
  expect(listReads).toBe(2); expect(result.current.busy).toBe(true);
  await act(async () => { held.resolve(page([item(21)])); await Promise.all([first, second]); });
  expect(result.current.items).toHaveLength(21); expect(result.current.busy).toBe(false);
  expect(result.current.hasMore).toBe(false);
});

test.each(['focus', 'background', 'session', 'storage', 'page-return'])('held old page cannot replace a newer forbidden read after %s', async change => {
  const held = deferred<ReturnType<typeof page>>(); let listReads = 0;
  get.mockImplementation(async path => {
    if (path === HISTORY_BASE + '/session') return sessionResponse;
    listReads++;
    if (listReads === 1) return page(items(), true);
    if (listReads === 2) return await held.promise;
    throw { statusCode: 403 };
  });
  const { result } = renderHook(() => useHistory(home, null));
  await waitFor(() => expect(result.current.hasMore).toBe(true));
  let request!: Promise<void>;
  act(() => { request = result.current.loadMore(); });
  await waitFor(() => expect(listReads).toBe(2));
  await act(async () => {
    if (change === 'focus') fireEvent.focus(window);
    if (change === 'background') {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      fireEvent(document, new Event('visibilitychange'));
    }
    if (change === 'session') { jest.mocked(api.getAuthToken).mockReturnValue('new-synthetic-session'); sessionChanged(); }
    if (change === 'storage') { localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'new-marker'); fireEvent(window, new StorageEvent('storage', { key: api.AUTH_SESSION_CHANGE_KEY })); }
    if (change === 'page-return') fireEvent(window, new Event('pagehide'));
  });
  expect(result.current.items).toEqual([]);
  if (change === 'background' || change === 'page-return') {
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      fireEvent(window, new Event('pageshow'));
    });
  }
  await waitFor(() => expect(result.current.phase).toBe('error'));
  expect(result.current.error).toMatch(/current household permissions/);
  await act(async () => { held.resolve(page([item(21)])); await request; });
  expect(result.current.phase).toBe('error'); expect(result.current.items).toEqual([]);
  expect(result.current.hasMore).toBe(false); expect(result.current.busy).toBe(false);
});

test('unmounted held detail cannot republish into a new Home reader', async () => {
  const held = deferred<unknown>();
  get.mockImplementation(async path => path === HISTORY_BASE + '/session' ? sessionResponse : await held.promise);
  const old = renderHook(() => useHistory(home, id(1)));
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2)); old.unmount();
  get.mockImplementation(async path => {
    if (path === HISTORY_BASE + '/session') return sessionResponse;
    throw { statusCode: 403 };
  });
  const current = renderHook(() => useHistory(id(999), null));
  await waitFor(() => expect(current.result.current.phase).toBe('error'));
  await act(async () => { held.resolve({ status: 200, data: { home_id: home, actor_id: actor, item: item(), session } }); });
  expect(current.result.current.detail).toBeNull(); expect(current.result.current.items).toEqual([]);
  expect(current.result.current.phase).toBe('error');
});
