import { toast } from '@/components/ui/toast-store';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import type { GigStopPreview, GigStopProgress, GigStopRequest } from '@pantopus/api';
import ClassicPage from '../src/app/(app)/app/gigs/[id]/page';
import V2Page from '../src/app/(app)/app/gigs-v2/[id]/page';
import GigStopRecoveryEntry from '../src/components/gig-detail/GigStopRecoveryEntry';
import GigStopDialog from '../src/components/gig-detail/GigStopDialog';
import { retainStopRequest, stopRecoveryKey } from '../src/components/gig-detail/gigStopRecovery';

const gigId = '33333333-3333-4333-8333-333333333333';
const owner = '11111111-1111-4111-8111-111111111111';
const worker = '22222222-2222-4222-8222-222222222222';
const requestId = '55555555-5555-4555-8555-555555555555';
const listeners = new Set<() => void>();
let token: string | null = 'opening-session';
let origin = 'https://app.test';
const router = { push: jest.fn(), replace: jest.fn() };
let mockRouteGigId = gigId;
let mockDetailSocket: ReturnType<typeof detailSocket> | null = null;
jest.mock('next/navigation', () => ({ useRouter: () => router, useParams: () => ({ id: mockRouteGigId }), useSearchParams: () => new URLSearchParams() }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('next/image', () => () => null);
jest.mock('@pantopus/ui-utils', () => ({ formatTimeAgo: () => 'today' }));
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => token, getApiBaseUrl: () => origin, AUTH_SESSION_CHANGE_KEY: 'session-change',
  onTokenChange: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
  users: { getMyProfile: jest.fn() },
  gigs: { getGigById: jest.fn(), getGigStopPreview: jest.fn(), getGigStopRequest: jest.fn(),
    submitGigStopRequest: jest.fn(), checkNoShow: jest.fn(), getGigOffersV2: jest.fn() },
  upload: { getGigMedia: jest.fn() }, payments: { getPaymentForGig: jest.fn() },
}));
jest.mock('@/contexts/BadgeContext', () => ({ useBadges: () => ({ socket: mockDetailSocket, connected: true }) }));
jest.mock('@/hooks/useBusinessGigAccess', () => ({ useBusinessGigAccess: () => false }));
jest.mock('@/hooks/usePaymentRedirectCleanup', () => ({ usePaymentRedirectCleanup: () => {} }));
jest.mock('@/lib/signal-buffer', () => ({ pushSignal: jest.fn() }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('@/components/payments/PaymentStatusBadge', () => () => null);
jest.mock('@/components/user/UserIdentityLink', () => () => null);
jest.mock('@/components/gig-detail/GigTimeline', () => () => null);
jest.mock('@/components/gig-detail/MediaLightbox', () => () => null);
jest.mock('@/components/gig-detail/DetailRow', () => () => null);
jest.mock('@/components/gig-detail/QASection', () => () => null);
jest.mock('@/components/gig-detail/ChangeOrdersSection', () => () => null);
jest.mock('@/components/gig-detail/BidPanel', () => () => null);
jest.mock('@/components/gig-detail/OffersPanel', () => () => null);
jest.mock('@/components/gig-detail/GigHeader', () => () => null);
jest.mock('@/components/gig-detail/PaymentSection', () => () => null);
jest.mock('@/components/gig-detail/GigBidCheckout', () => ({ gigBidCheckoutUrl: () => '' }));
jest.mock('@/components/gig-detail-v2/OffersPanelV2', () => () => null);
jest.mock('@/components/gig-detail-v2/InstantAcceptButton', () => () => null);
jest.mock('@/components/gig-detail-v2/ETATracker', () => function MockETATracker() { return <div data-testid="eta-tracker" />; });
jest.mock('@/components/gig-detail-v2/ActiveTaskPanel', () => () => null);
jest.mock('@/components/FileUpload', () => () => null);
jest.mock('@/components/payments/StripeConnectOnboarding', () => () => null);
jest.mock('@/components/payments/TipModal', () => ({
  ...jest.requireActual('@/components/payments/TipModal'), default: () => null,
}));
jest.mock('@/components/payments/AssignedGigAuthorization', () => () => null);

const request: GigStopRequest = { requestId, gigId, actorId: worker, action: 'worker_release', reason: null,
  rollbackMode: null, financialAction: 'none', terms: { gigId, ownerId: owner, workerId: worker,
    paymentId: null, amountCents: 0, currency: 'usd', gigStatus: 'assigned', acceptedAt: null,
    acceptedBidId: null, policy: 'standard', policyFeeCents: 0 } };
const key = stopRecoveryKey('https://app.test', worker, gigId);
const preview: GigStopPreview = { actorId: worker, sessionScope: 'a'.repeat(64), action: 'worker_release', eligible: true,
  financialAction: 'none', terms: request.terms, unavailableReason: null, activeRequestId: null };
const pending: GigStopProgress = { actorId: worker, sessionScope: 'a'.repeat(64), requestId, action: 'worker_release',
  status: 'pending', financialStatus: 'none', canRetry: true, request, receipt: null };
const done: GigStopProgress = { ...pending, status: 'completed', canRetry: false,
  receipt: { requestId, gigId, ownerId: owner, workerId: worker, paymentId: null, amountCents: 0,
    currency: 'usd', action: 'worker_release', gigStatus: 'open', financialStatus: 'none' } };

beforeEach(() => {
  jest.clearAllMocks(); jest.mocked(api.gigs.getGigById).mockReset(); mockDetailSocket = null; mockRouteGigId = gigId; localStorage.clear(); listeners.clear(); token = 'opening-session'; origin = 'https://app.test';
  jest.mocked(api.users.getMyProfile).mockResolvedValue({ id: worker } as never);
  jest.mocked(api.gigs.getGigById).mockResolvedValue({ id: gigId, user_id: owner, accepted_by: null,
    status: 'open', title: 'Current task', price: 0 } as never);
  jest.mocked(api.upload.getGigMedia).mockResolvedValue({ media: [] } as never);
  jest.mocked(api.payments.getPaymentForGig).mockResolvedValue({ payment: null } as never);
  jest.mocked(api.gigs.checkNoShow).mockResolvedValue({} as never);
  jest.mocked(api.gigs.getGigOffersV2).mockResolvedValue({ offers: [] } as never);
  jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue(pending);
  jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue(preview);
  jest.mocked(api.gigs.submitGigStopRequest).mockResolvedValue(done);
});
afterEach(() => jest.restoreAllMocks());

describe('existing cancellation presentation', () => {
  test.each([
    [true, owner, ['Changed my plans', 'Found someone else', 'Bids too expensive', 'Emergency', 'Other']],
    [false, worker, ['Schedule conflict', 'Unable to complete', 'Emergency', 'Safety concern', 'Other']],
  ] as const)('keeps the original reason buttons and fee card (owner=%s)', async (isOwner, actorId, reasons) => {
    jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue({ ...preview, actorId, action: 'cancel' });
    render(<GigStopDialog gigId={gigId} actorId={actorId} action="cancel" isOwner={isOwner} onClose={jest.fn()} />);
    await screen.findByText('What happened?');
    expect(screen.getByText('No cancellation fee')).toBeInTheDocument();
    for (const reason of reasons) {
      const button = screen.getByRole('button', { name: reason });
      expect(button.querySelector('svg')).not.toBeNull();
    }
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: reasons[0] }));
    expect(screen.getByRole('button', { name: reasons[0] })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe.each([['classic', ClassicPage], ['v2', V2Page]] as const)('%s actual page', (_, Page) => {
  test.each(['open', 'cancelled'])('former worker can recover after the raw task becomes %s', async (status) => {
    retainStopRequest(key, request);
    jest.mocked(api.gigs.getGigById).mockResolvedValue({ id: gigId, user_id: owner, accepted_by: null,
      status, title: 'Current task', price: 0 } as never);
    jest.mocked(api.gigs.getGigStopRequest).mockResolvedValue(done);
    render(<Page />);
    const entry = await screen.findByRole('button', { name: 'View saved action status' });
    expect(screen.queryByText("You're the worker")).not.toBeInTheDocument();
    expect(api.gigs.getGigStopRequest).not.toHaveBeenCalled();
    fireEvent.click(entry);
    await screen.findByText('The task is open for bidding.');
    expect(api.gigs.getGigStopRequest).toHaveBeenCalledWith(gigId, requestId);
    expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
    expect(localStorage.getItem(key)).toBeNull();
  });

  test.each([403, 404])('saved status remains reachable when detail returns %s', async (statusCode) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    retainStopRequest(key, request);
    jest.mocked(api.gigs.getGigById).mockRejectedValue({ statusCode });
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
    await screen.findByText('The task action is pending. Check its status before continuing.');
    expect(api.gigs.getGigStopRequest).toHaveBeenCalledWith(gigId, requestId);
    expect(api.gigs.getGigStopPreview).not.toHaveBeenCalled();
    expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
  });

  test('owner Close Gig previews close for an open task before explicit submission', async () => {
    jest.mocked(api.users.getMyProfile).mockResolvedValue({ id: owner } as never);
    jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue({ ...preview, actorId: owner, action: 'close',
      terms: { ...preview.terms, workerId: null, gigStatus: 'open' } });
    render(<Page />);
    fireEvent.click(await screen.findByRole('button', { name: 'Close Gig' }));
    await screen.findByRole('button', { name: 'Close task' });
    expect(api.gigs.getGigStopPreview).toHaveBeenCalledWith(gigId, 'close');
    expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

test('saved status 404 never POSTs until the user retries the unchanged command', async () => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockRejectedValue({ statusCode: 404 });
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
  const retry = await screen.findByRole('button', { name: 'Retry this request' });
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
  fireEvent.click(retry);
  await screen.findByText('The task is open for bidding.');
  expect(api.gigs.submitGigStopRequest).toHaveBeenCalledWith(gigId, { requestId, action: request.action,
    expectedActorId: worker, expectedSessionScope: 'a'.repeat(64), expectedTerms: request.terms,
    reason: null, rollbackMode: null });
});

test('denied saved status retains storage and never exposes a mutation control', async () => {
  retainStopRequest(key, request);
  jest.mocked(api.gigs.getGigStopRequest).mockRejectedValue(new Error('Access denied'));
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
  await screen.findByText('Access denied');
  expect(screen.queryByRole('button', { name: 'Retry this request' })).not.toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
});

test('storage failure is visible without deleting or replacing the saved value', async () => {
  retainStopRequest(key, request);
  const get = Storage.prototype.getItem;
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, name) {
    if (name === key) throw new Error('storage unavailable');
    return get.call(this, name);
  });
  const remove = jest.spyOn(Storage.prototype, 'removeItem');
  render(<GigStopRecoveryEntry gigId={gigId} />);
  await screen.findByText(/Saved task recovery could not be read/);
  expect(screen.queryByRole('button', { name: 'View saved action status' })).not.toBeInTheDocument();
  expect(remove).not.toHaveBeenCalled();
  expect(get.call(localStorage, key)).not.toBeNull();
  expect(api.gigs.getGigStopRequest).not.toHaveBeenCalled();
});

test('malformed saved recovery remains visible as an error and untouched', async () => {
  localStorage.setItem(key, '{broken');
  render(<GigStopRecoveryEntry gigId={gigId} />);
  await screen.findByText(/Saved task recovery could not be read/);
  expect(localStorage.getItem(key)).toBe('{broken');
});

test('failed initial account lookup exposes a useful explicit discovery retry', async () => {
  retainStopRequest(key, request);
  jest.mocked(api.users.getMyProfile).mockRejectedValueOnce(new Error('temporarily unavailable'));
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Check saved recovery' }));
  await screen.findByRole('button', { name: 'View saved action status' });
  expect(api.users.getMyProfile).toHaveBeenCalledTimes(2);
  expect(api.gigs.getGigStopRequest).not.toHaveBeenCalled();
});

test('saved value removed before the status click cannot become a new action', async () => {
  retainStopRequest(key, request);
  render(<GigStopRecoveryEntry gigId={gigId} />);
  const open = await screen.findByRole('button', { name: 'View saved action status' });
  localStorage.removeItem(key);
  fireEvent.click(open);
  await screen.findByText(/The saved task action changed/);
  expect(api.gigs.getGigStopPreview).not.toHaveBeenCalled();
  expect(api.gigs.getGigStopRequest).not.toHaveBeenCalled();
});

test('a late status response cannot overwrite a different saved request', async () => {
  retainStopRequest(key, request);
  let resolve!: (value: GigStopProgress) => void;
  jest.mocked(api.gigs.getGigStopRequest).mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
  await waitFor(() => expect(api.gigs.getGigStopRequest).toHaveBeenCalled());
  const other = { ...request, requestId: owner };
  act(() => retainStopRequest(key, other));
  await act(async () => resolve(pending));
  await screen.findByText(/Another task action is saved/);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(other);
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
});

test.each(['actor', 'origin', 'gig'])('discovery never reads another %s recovery', async (different) => {
  retainStopRequest(key, request);
  if (different === 'actor') jest.mocked(api.users.getMyProfile).mockResolvedValue({ id: owner } as never);
  if (different === 'origin') origin = 'https://other.test';
  render(<GigStopRecoveryEntry gigId={different === 'gig' ? owner : gigId} />);
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'View saved action status' })).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).not.toBeNull();
});

test('same-tab save makes the existing entry reachable without reloading', async () => {
  render(<GigStopRecoveryEntry gigId={gigId} />);
  await act(async () => {});
  act(() => retainStopRequest(key, request));
  await screen.findByRole('button', { name: 'View saved action status' });
  expect(api.gigs.getGigStopRequest).not.toHaveBeenCalled();
});

test('session marker change before a delayed event blocks opening saved status', async () => {
  retainStopRequest(key, request);
  render(<GigStopRecoveryEntry gigId={gigId} />);
  const open = await screen.findByRole('button', { name: 'View saved action status' });
  localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'replacement');
  fireEvent.click(open);
  await screen.findByText(/Your session changed. Reload/);
  expect(api.gigs.getGigStopRequest).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).not.toBeNull();
});

test('late initial actor lookup cannot attach old UI to a replaced session', async () => {
  retainStopRequest(key, request);
  let resolve!: (value: never) => void;
  jest.mocked(api.users.getMyProfile).mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<GigStopRecoveryEntry gigId={gigId} />);
  localStorage.setItem(api.AUTH_SESSION_CHANGE_KEY, 'replacement');
  await act(async () => resolve({ id: worker } as never));
  await screen.findByText(/Your session changed. Reload/);
  expect(screen.queryByRole('button', { name: 'View saved action status' })).not.toBeInTheDocument();
});

test('session replacement while status is pending hides controls and ignores a late receipt', async () => {
  retainStopRequest(key, request);
  let resolve!: (value: GigStopProgress) => void;
  jest.mocked(api.gigs.getGigStopRequest).mockReturnValue(new Promise((done) => { resolve = done; }));
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
  await waitFor(() => expect(api.gigs.getGigStopRequest).toHaveBeenCalled());
  act(() => listeners.forEach((listener) => listener()));
  await act(async () => resolve(done));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).not.toBeNull();
});

test('recovery-only dialog never becomes a new action if saved storage disappears before opening', async () => {
  render(<GigStopDialog gigId={gigId} actorId={worker} action="worker_release" isOwner={false}
    recoveryRequest={request} onClose={() => {}} />);
  await screen.findByText(/The saved task action changed/);
  expect(api.gigs.getGigStopPreview).not.toHaveBeenCalled();
  expect(api.gigs.submitGigStopRequest).not.toHaveBeenCalled();
});

function competingRequest() {
  const replacement = { ...request, requestId: owner };
  const result = { ...pending, requestId: owner, request: replacement };
  jest.mocked(api.gigs.getGigStopRequest).mockRejectedValueOnce({ statusCode: 404 }).mockResolvedValue(result);
  jest.mocked(api.gigs.getGigStopPreview).mockResolvedValue({ ...preview, activeRequestId: owner });
  jest.mocked(api.gigs.submitGigStopRequest).mockRejectedValue({ statusCode: 409,
    data: { code: 'STOP_ACTIVE', activeRequestId: owner } });
  return replacement;
}

test('failed STOP_ACTIVE replacement write preserves the original saved request', async () => {
  retainStopRequest(key, request);
  const replacement = competingRequest();
  const set = Storage.prototype.setItem;
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, name, value) {
    if (name === key && JSON.parse(value).requestId === replacement.requestId) throw new Error('Quota exceeded');
    set.call(this, name, value);
  });
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry this request' }));
  await screen.findByText(/The result is not confirmed/);
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(request);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('button', { name: 'View saved action status' })).toBeInTheDocument();
});

test('verified STOP_ACTIVE adoption remains checkable in a recovery-only dialog', async () => {
  retainStopRequest(key, request);
  const replacement = competingRequest();
  render(<GigStopRecoveryEntry gigId={gigId} />);
  fireEvent.click(await screen.findByRole('button', { name: 'View saved action status' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Retry this request' }));
  await screen.findByText('The task action is pending. Check its status before continuing.');
  expect(JSON.parse(localStorage.getItem(key)!)).toEqual(replacement);
  fireEvent.click(screen.getByRole('button', { name: 'Check status' }));
  await waitFor(() => expect(api.gigs.getGigStopRequest).toHaveBeenCalledTimes(3));
  expect(jest.mocked(api.gigs.getGigStopRequest).mock.calls[2]).toEqual([gigId, replacement.requestId]);
  expect(screen.queryByText(/The saved task action changed/)).not.toBeInTheDocument();
});

test('a late profile from a previous gig cannot repopulate a reused entry', async () => {
  retainStopRequest(key, request);
  let resolve!: (value: never) => void;
  jest.mocked(api.users.getMyProfile).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const view = render(<GigStopRecoveryEntry gigId={gigId} />);
  view.rerender(<GigStopRecoveryEntry gigId={owner} />);
  await act(async () => {});
  await act(async () => resolve({ id: worker } as never));
  expect(screen.queryByRole('button', { name: 'View saved action status' })).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).not.toBeNull();
});


function heldDetail<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function replaceDetailSession() {
  localStorage.setItem('session-change', 'replacement');
  for (const listener of listeners) listener();
}

test('v2 detail retires private task data after same-cookie account replacement', async () => {
  render(<V2Page />); await screen.findByText('Current task'); act(replaceDetailSession);
  expect(screen.queryByText('Current task')).not.toBeInTheDocument();
});

test('v2 detail ignores a held response after account replacement', async () => {
  const held = heldDetail<never>(); jest.mocked(api.gigs.getGigById).mockReturnValue(held.promise);
  render(<V2Page />); await waitFor(() => expect(api.gigs.getGigById).toHaveBeenCalledTimes(1));
  act(replaceDetailSession);
  await act(async () => held.resolve({ id: gigId, user_id: owner, title: 'Retired private task', status: 'open', price: 0 } as never));
  expect(screen.queryByText('Retired private task')).not.toBeInTheDocument();
});

test('v2 detail ignores a delivered read error after page departure', async () => {
  const held = heldDetail<never>(); jest.mocked(api.gigs.getGigById).mockReturnValue(held.promise);
  const page = render(<V2Page />); await waitFor(() => expect(api.gigs.getGigById).toHaveBeenCalledTimes(1));page.unmount();
  await act(async () => held.resolve(Promise.reject(new Error('Retired read')) as never));
  expect(toast.error).not.toHaveBeenCalled();
});


function detailSocket() {
  const handlers = new Map<string, Set<() => void>>();
  return {
    on: (event: string, handler: () => void) => { const set = handlers.get(event) ?? new Set(); set.add(handler); handlers.set(event, set); },
    off: (event: string, handler?: () => void) => { if (handler) handlers.get(event)?.delete(handler); else handlers.delete(event); },
    emit: (event: string) => { for (const handler of handlers.get(event) ?? []) handler(); },
    handlers,
  };
}

test('v2 detail preserves a newer refresh when the older request finishes', async () => {
  mockDetailSocket = detailSocket(); render(<V2Page />); await screen.findByText('Current task');
  const held = heldDetail<never>(); jest.mocked(api.gigs.getGigById).mockReturnValueOnce(held.promise)
    .mockResolvedValueOnce({ id: gigId, user_id: owner, title: 'Newer accepted detail', status: 'open', price: 0 } as never);
  act(() => { mockDetailSocket!.emit('gig:status-change'); mockDetailSocket!.emit('gig:status-change'); });
  await screen.findByText('Newer accepted detail');
  await act(async () => held.resolve({ id: gigId, user_id: owner, title: 'Obsolete detail', status: 'open', price: 0 } as never));
  expect(screen.queryByText('Obsolete detail')).not.toBeInTheDocument();
  expect(screen.getByText('Newer accepted detail')).toBeInTheDocument();
});

test('v2 detail departure preserves another consumer of the same socket topic', async () => {
  mockDetailSocket = detailSocket(); const listener = jest.fn(); mockDetailSocket.on('gig:bid-update', listener);
  const page = render(<V2Page />); await screen.findByText('Current task'); page.unmount();
  mockDetailSocket.emit('gig:bid-update'); expect(listener).toHaveBeenCalledTimes(1);
});


test('v2 detail rebinding cannot adopt a response from the previous task', async () => {
  const held = heldDetail<never>(); jest.mocked(api.gigs.getGigById).mockReturnValueOnce(held.promise);
  const page = render(<V2Page />); await waitFor(() => expect(api.gigs.getGigById).toHaveBeenCalledWith(gigId));
  mockRouteGigId = '77777777-7777-4777-8777-777777777777';
  jest.mocked(api.gigs.getGigById).mockResolvedValue({ id: mockRouteGigId, user_id: owner, title: 'Current different task', status: 'open', price: 0 } as never);
  page.rerender(<V2Page />); await screen.findByText('Current different task');
  await act(async () => held.resolve({ id: gigId, user_id: owner, title: 'Previous task private detail', status: 'open', price: 0 } as never));
  expect(screen.queryByText('Previous task private detail')).not.toBeInTheDocument(); expect(screen.getByText('Current different task')).toBeInTheDocument();
});


test('v2 detail offers status sharing only to the task owner or assigned worker', async () => {
  jest.mocked(api.gigs.getGigById).mockResolvedValue({ id: gigId, user_id: owner, accepted_by: 'other-worker',
    status: 'in_progress', title: 'Current task', price: 0 } as never);
  render(<V2Page />); await screen.findByText('Current task'); expect(screen.queryByTestId('eta-tracker')).not.toBeInTheDocument();
});


test.each([owner, worker])('v2 detail preserves status sharing for current participant %s', async actor => {
  jest.mocked(api.users.getMyProfile).mockResolvedValue({ id: actor } as never);
  jest.mocked(api.gigs.getGigById).mockResolvedValue({ id: gigId, user_id: owner, accepted_by: worker,
    status: 'in_progress', title: 'Current task', price: 0 } as never);
  render(<V2Page />); await screen.findByText('Current task'); expect(screen.getByTestId('eta-tracker')).toBeInTheDocument();
});
