import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import ResidencyClaimsPanel from '@/components/home/ResidencyClaimsPanel';
import ReviewClaimPage from '@/app/(app)/app/homes/[id]/owners/review-claim/page';
import { useResidencyQueue } from '@/components/home/residency/queue/useResidencyQueue';
import { QUEUE_SESSION_PATH, type QueueClaim } from '@/components/home/residency/queue/queueModel';

jest.mock('@pantopus/api', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  getAuthToken: jest.fn(), getApiBaseUrl: jest.fn(),
  AUTH_SESSION_CHANGE_KEY: 'queue-session-test', onTokenChange: jest.fn(),
  homes: { getHomeClaims: jest.fn() },
  homeOwnership: { getHomeOwnershipClaims: jest.fn(), getOwnershipClaimComparison: jest.fn() },
}));
const mockRouter = { push: jest.fn(), back: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ id: '00000000-0000-4000-8000-000000000900' }),
  useSearchParams: () => new URLSearchParams('tab=residency'),
}));
jest.mock('@/components/user/UserIdentityLink', () => ({ __esModule: true,
  default: ({ displayName }: { displayName: string }) => <span>{displayName}</span>,
}));
const home = '00000000-0000-4000-8000-000000000900';
const actor = '00000000-0000-4000-8000-000000000901';
const applicant = '00000000-0000-4000-8000-000000000902';
const claimId = '00000000-0000-4000-8000-000000000903';
const session = { actor_id: actor, session_scope: 'a'.repeat(64) };
const claim = (): QueueClaim => ({ id: claimId, home_id: home, user_id: applicant, status: 'pending',
  created_at: null, claimed_role: null, claimant: { id: applicant, username: 'public_applicant', name: null } });
const page = (claims: QueueClaim[] = [claim()]) => ({ status: 200,
  data: { home_id: home, actor_id: actor, claims, residency_session: { ...session, home_id: home } } });
const bootstrap = { status: 200, data: { session } };
const get = api.apiClient.get as jest.Mock;
const deferred = <T,>() => { let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const subscribers = new Set<() => void>();
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear(); subscribers.clear();
  Object.defineProperty(globalThis, 'structuredClone', { configurable: true, value: (value: unknown) => JSON.parse(JSON.stringify(value)) });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  jest.mocked(api.getAuthToken).mockReturnValue('synthetic-session');
  jest.mocked(api.getApiBaseUrl).mockReturnValue('https://synthetic.invalid');
  jest.mocked(api.onTokenChange).mockImplementation(callback => {
    const notify = () => callback(null); subscribers.add(notify); return () => { subscribers.delete(notify); };
  });
  get.mockImplementation(async path => path === QUEUE_SESSION_PATH ? bootstrap : page());
  // A slow ownership reader must not block the independent residency queue.
  jest.mocked(api.homeOwnership.getHomeOwnershipClaims).mockReturnValue(new Promise(() => {}));
  jest.mocked(api.homeOwnership.getOwnershipClaimComparison).mockReturnValue(new Promise(() => {}));
});
const mount = (consumer: string) => render(consumer === 'members'
  ? <ResidencyClaimsPanel homeId={home} canManage /> : <ReviewClaimPage />);

test.each(['members', 'review page'])('%s uses the private queue and keeps missing legacy values explicit', async consumer => {
  mount(consumer);
  await screen.findByRole('article', { name: 'Residency request from @public_applicant' });
  expect(screen.getByText('Date unavailable')).toBeVisible();
  expect(screen.getByText('Requesting: Requested relationship unspecified')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Your past residency decisions' })).toHaveAttribute('href', `/app/homes/${home}/owners/review-claim/history`);
  expect(screen.getByRole('link', { name: 'Review approval' })).toHaveAttribute('href',
    `/app/homes/${home}/owners/review-claim/residency?claimId=${claimId}&action=approve${consumer === 'members' ? '&from=members' : ''}`);
  expect(api.homes.getHomeClaims).not.toHaveBeenCalled();
  expect(get).toHaveBeenCalledWith(`/api/homes/${home}/claims`, expect.objectContaining({
    headers: expect.objectContaining({ 'X-Pantopus-Session-Scope': session.session_scope, 'Cache-Control': 'no-cache, no-store' }),
  }));
  expect(api.apiClient.post).not.toHaveBeenCalled();
});

test.each(['members', 'review page'])('%s retires a failed or malformed reload before allowing an empty success', async consumer => {
  mount(consumer); await screen.findByText('@public_applicant');
  const unsafe = page(); Object.assign(unsafe.data.claims[0], { claimed_address: 'private-address-canary' });
  get.mockImplementation(async path => path === QUEUE_SESSION_PATH ? bootstrap : unsafe);
  fireEvent.click(screen.getByRole('button', { name: 'Reload residency claims' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('@public_applicant')).not.toBeInTheDocument();
  expect(screen.queryByText(/private-address-canary/)).not.toBeInTheDocument();
  expect(screen.queryByText('No pending residency claims')).not.toBeInTheDocument();
  get.mockImplementation(async path => path === QUEUE_SESSION_PATH ? bootstrap : page([]));
  fireEvent.click(screen.getByRole('button', { name: 'Reload residency claims' }));
  await screen.findByText('No pending residency claims');
});

test.each(['account', 'session marker', 'origin', 'background'])('render and an earlier action closure reject a changed %s before subscription cleanup', async change => {
  const { result, rerender } = renderHook(() => useResidencyQueue(home));
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  const earlier = result.current.canReview;
  expect(earlier(claimId)).toBe(true);
  if (change === 'account') jest.mocked(api.getAuthToken).mockReturnValue('another-synthetic-session');
  if (change === 'session marker') localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'new-marker');
  if (change === 'origin') jest.mocked(api.getApiBaseUrl).mockReturnValue('https://another.invalid');
  if (change === 'background') Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  expect(earlier(claimId)).toBe(false);
  rerender();
  expect(result.current.claims).toEqual([]);
  expect(result.current.phase).toBe('loading');
});

test.each(['members', 'review page'])('%s prevents an already rendered review link from using an old session', async consumer => {
  mount(consumer); const link = await screen.findByRole('link', { name: 'Review approval' });
  jest.mocked(api.getAuthToken).mockReturnValue('another-synthetic-session');
  expect(fireEvent.click(link)).toBe(false);
  expect(screen.queryByText('@public_applicant')).not.toBeInTheDocument();
  expect(mockRouter.push).not.toHaveBeenCalled();
  expect(api.apiClient.post).not.toHaveBeenCalled();
});

test('a held old queue cannot replace a newer permission denial after a normal session notification', async () => {
  const held = deferred<ReturnType<typeof page>>(); let reads = 0;
  get.mockImplementation(async path => {
    if (path === QUEUE_SESSION_PATH) return bootstrap;
    reads++;
    if (reads === 1) return page();
    if (reads === 2) return held.promise;
    throw { statusCode: 403 };
  });
  const { result } = renderHook(() => useResidencyQueue(home));
  await waitFor(() => expect(result.current.phase).toBe('ready'));
  act(() => result.current.refresh()); await waitFor(() => expect(reads).toBe(2));
  await act(async () => { jest.mocked(api.getAuthToken).mockReturnValue('new-synthetic-session'); subscribers.forEach(notify => notify()); });
  await waitFor(() => expect(result.current.phase).toBe('error'));
  expect(result.current.error).toMatch(/current household permissions/);
  await act(async () => { held.resolve(page()); });
  expect(result.current.phase).toBe('error'); expect(result.current.claims).toEqual([]);
  expect(result.current.canReview(claimId)).toBe(false);
});

test('switching away from the residency tab retires the queue and returning requires a new read', async () => {
  mount('review page'); await screen.findByText('@public_applicant');
  fireEvent.click(screen.getByRole('button', { name: /^ownership/i }));
  expect(screen.queryByText('@public_applicant')).not.toBeInTheDocument();
  get.mockImplementation(async path => { if (path === QUEUE_SESSION_PATH) return bootstrap; throw { statusCode: 503 }; });
  fireEvent.click(screen.getByRole('button', { name: /^residency/i }));
  await screen.findByRole('alert');
  expect(screen.queryByText('@public_applicant')).not.toBeInTheDocument();
  expect(screen.queryByText('No pending residency claims')).not.toBeInTheDocument();
});


test.each(['members', 'review page'])('%s rejects duplicate applicants instead of showing two review actions', async consumer => {
  get.mockImplementation(async path => path === QUEUE_SESSION_PATH ? bootstrap : page([
    claim(), { ...claim(), id: home },
  ]));
  mount(consumer);
  await screen.findByRole('alert');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Review approval' })).not.toBeInTheDocument();
  expect(screen.queryByText('No pending residency claims')).not.toBeInTheDocument();
});
