import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OffersPanel from '@/components/gig-detail/OffersPanel';
import GigChatActions from '@/components/chat/GigChatActions';
import MyGigsPage from '@/app/(app)/app/my-gigs/page';
import MyGigsV2Page from '@/app/(app)/app/my-gigs-v2/page';
import MyBidsPage from '@/app/(app)/app/my-bids/page';
import ActiveTaskPanel from '@/components/gig-detail-v2/ActiveTaskPanel';
import ETATracker from '@/components/gig-detail-v2/ETATracker';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';

const mockPush = jest.fn();
const mockBids = jest.fn();
const mockAccept = jest.fn();
const mockMyGigs = jest.fn();
const mockReject = jest.fn();
const mockComplete = jest.fn();
const mockMyBids = jest.fn();
const mockMark = jest.fn();
const mockStart = jest.fn();
const mockAcceptCounter = jest.fn();
const mockDeclineCounter = jest.fn();
const mockWithdraw = jest.fn();
const mockActiveStatus = jest.fn();
const mockUpdateStatus = jest.fn();
const mockConfirmCompletion = jest.fn();
const mockShareStatus = jest.fn();
const mockClipboard = jest.fn();
const mockRouter = { push: mockPush };
const mockTokenListeners = new Set<() => void>();
let mockToken: string | null = 'cookie-session';
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => mockToken, getApiBaseUrl: () => 'https://api.pantopus.test',
  AUTH_SESSION_CHANGE_KEY: 'pantopus:auth-session-change',
  onTokenChange: (listener: () => void) => { mockTokenListeners.add(listener); return () => mockTokenListeners.delete(listener); },
  professional: { getMyProfile: jest.fn().mockResolvedValue(null) },
  gigs: {
    shareGigStatus: (...args: unknown[]) => mockShareStatus(...args),
    getGigBids: (...args: unknown[]) => mockBids(...args), acceptBid: (...args: unknown[]) => mockAccept(...args),
    getMyGigs: (...args: unknown[]) => mockMyGigs(...args), rejectBid: (...args: unknown[]) => mockReject(...args),
    completeGig: (...args: unknown[]) => mockComplete(...args),
    getActiveStatus: (...args: unknown[]) => mockActiveStatus(...args), updateUrgentStatus: (...args: unknown[]) => mockUpdateStatus(...args),
    confirmGigCompletion: (...args: unknown[]) => mockConfirmCompletion(...args),
    getMyBids: (...args: unknown[]) => mockMyBids(...args), markGigCompleted: (...args: unknown[]) => mockMark(...args),
    startGig: (...args: unknown[]) => mockStart(...args), acceptCounter: (...args: unknown[]) => mockAcceptCounter(...args),
    declineCounter: (...args: unknown[]) => mockDeclineCounter(...args), withdrawBid: (...args: unknown[]) => mockWithdraw(...args),
  },
}));
jest.mock('@/components/gig-detail/GigBidCheckout', () => ({ gigBidCheckoutUrl: (gig: string, bid: string) => `/app/gigs/${gig}?action=payment_setup&bid=${bid}#payment-checkout` }));
jest.mock('@/components/payments/StripeProvider', () => () => null);
jest.mock('@/components/payments/GigPaymentSetup', () => () => null);
jest.mock('@/components/user/UserIdentityLink', () => () => null);
jest.mock('@/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn() } }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { info: jest.fn(), error: jest.fn(), success: jest.fn() } }));

beforeEach(() => {
  mockShareStatus.mockReset(); mockClipboard.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mockClipboard } });
  jest.clearAllMocks(); mockTokenListeners.clear(); mockToken = 'cookie-session';
  mockMyGigs.mockReset(); mockBids.mockReset(); mockReject.mockReset(); mockComplete.mockReset();
  jest.mocked(confirmStore.open).mockReset();
  [mockMyBids, mockMark, mockStart, mockAcceptCounter, mockDeclineCounter, mockWithdraw, mockActiveStatus, mockUpdateStatus, mockConfirmCompletion].forEach(mock => mock.mockReset());
  localStorage.clear(); localStorage.setItem('pantopus:auth-session-change', 'session-a');
});

test.each([['pending', 'Accept'], ['pending_payment', 'Resume payment']])('offer %s navigates exact bid without starting a payment', async (status, label) => {
  mockBids.mockResolvedValue({ bids: [{ id: 'selected-bid', bid_amount: 31, status }] });
  render(<OffersPanel actorId="payer" gigId="gig-a" gigStatus="open" gigPrice={99} isOwner paymentStatus="none" onOpenChat={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: label }));
  expect(mockPush).toHaveBeenCalledWith('/app/gigs/gig-a?action=payment_setup&bid=selected-bid#payment-checkout');
  expect(mockAccept).not.toHaveBeenCalled();
});

test('signed-out or non-owner offers expose no acceptance action', () => {
  render(<OffersPanel gigId="gig-a" gigStatus="open" gigPrice={99} isOwner paymentStatus="none" onOpenChat={jest.fn()} />);
  expect(mockBids).not.toHaveBeenCalled();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('chat requests deliberate offer selection instead of guessing a bidder', () => {
  render(<GigChatActions room={{ gig_id: 'gig-a', gig_poster_id: 'payer', gig_status: 'open' }} currentUserId="payer" />);
  expect(screen.getByRole('link', { name: 'Review offers' })).toHaveAttribute('href', '/app/gigs/gig-a#gig-offers');
  expect(mockAccept).not.toHaveBeenCalled();
  expect(mockBids).not.toHaveBeenCalled();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const ownedGig = { id: 'gig-a', title: 'Private owner A task', description: 'Owner A details', status: 'open', price: 25, created_at: '2026-09-15T00:00:00Z', bid_count: 1 };

function replaceSession() {
  localStorage.setItem('pantopus:auth-session-change', 'session-b');
  for (const listener of mockTokenListeners) listener();
}

function renderMyGigs(Page: typeof MyGigsPage, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return { client, ...render(<QueryClientProvider client={client}><Page /></QueryClientProvider>) };
}

test.each([MyGigsPage, MyGigsV2Page])('%p clears old private tasks on a same-cookie session replacement', async Page => {
  mockMyGigs.mockResolvedValue({ gigs: [ownedGig] });
  renderMyGigs(Page);
  await screen.findByText(ownedGig.title);
  act(replaceSession);
  expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
});

test('the cached task list cannot reuse another session after departure and reentry', async () => {
  mockMyGigs.mockResolvedValueOnce({ gigs: [ownedGig] });
  const first = renderMyGigs(MyGigsPage);
  await screen.findByText(ownedGig.title); first.unmount();
  act(replaceSession);
  mockMyGigs.mockResolvedValueOnce({ gigs: [{ ...ownedGig, id: 'gig-b', title: 'Current owner B task' }] });
  renderMyGigs(MyGigsPage, first.client);
  expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
  await screen.findByText('Current owner B task');
});

test('a departed bids modal cannot reject a bid when its confirmation resolves', async () => {
  mockMyGigs.mockResolvedValue({ gigs: [ownedGig] });
  mockBids.mockResolvedValue({ bids: [{ id: 'bid-a', status: 'pending', bid_amount: 25 }] });
  const pending = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(pending.promise);
  const page = renderMyGigs(MyGigsV2Page);
  fireEvent.click(await screen.findByRole('button', { name: /^View Bids/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  await waitFor(() => expect(confirmStore.open).toHaveBeenCalledTimes(1));
  page.unmount();
  await act(async () => pending.resolve(true));
  expect(mockReject).not.toHaveBeenCalled();
});

test('a newer task filter response cannot be replaced by the previous read', async () => {
  const old = deferred<{ gigs: typeof ownedGig[] }>();
  mockMyGigs.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ gigs: [{ ...ownedGig, id: 'gig-new', title: 'Newer filtered task' }] });
  renderMyGigs(MyGigsV2Page);
  fireEvent.click(screen.getByRole('button', { name: /0 Open/ }));
  await screen.findByText('Newer filtered task');
  await act(async () => old.resolve({ gigs: [ownedGig] }));
  expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
  expect(screen.getByText('Newer filtered task')).toBeInTheDocument();
});

test.each([MyGigsPage, MyGigsV2Page])('%p retires a delivered old read after a cross-tab session signal', async Page => {
  const old = deferred<{ gigs: typeof ownedGig[] }>(); mockMyGigs.mockReturnValue(old.promise);
  renderMyGigs(Page);
  await waitFor(() => expect(mockMyGigs).toHaveBeenCalledTimes(1));
  act(() => {
    localStorage.setItem('pantopus:auth-session-change', 'session-b');
    window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus:auth-session-change' }));
  });
  await act(async () => old.resolve({ gigs: [ownedGig] }));
  expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
  expect(screen.getByText('Your session changed. Reopen My tasks to continue.')).toBeInTheDocument();
});

test.each([MyGigsPage, MyGigsV2Page])('%p preserves signed-out navigation without reading private tasks', async Page => {
  mockToken = null; renderMyGigs(Page);
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  expect(mockMyGigs).not.toHaveBeenCalled();
});

test.each([MyGigsPage, MyGigsV2Page])('%p remains usable after StrictMode effect replay', async Page => {
  mockMyGigs.mockResolvedValue({ gigs: [ownedGig] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<React.StrictMode><QueryClientProvider client={client}><Page /></QueryClientProvider></React.StrictMode>);
  fireEvent.click(await screen.findByRole('button', { name: /^View Bids/ }));
  if (Page === MyGigsPage) expect(mockPush).toHaveBeenCalledWith('/app/gigs/gig-a');
  else await waitFor(() => expect(mockBids).toHaveBeenCalledWith('gig-a'));
});

test('a closed bids modal cannot adopt an old response into a different task', async () => {
  const old = deferred<{ bids: { id: string; status: string; message: string }[] }>();
  mockMyGigs.mockResolvedValue({ gigs: [ownedGig, { ...ownedGig, id: 'gig-b', title: 'Second task' }] });
  mockBids.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ bids: [{ id: 'bid-b', status: 'pending', message: 'Current B bid' }] });
  renderMyGigs(MyGigsV2Page);
  fireEvent.click((await screen.findAllByRole('button', { name: /^View Bids/ }))[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getAllByRole('button', { name: /^View Bids/ })[1]);
  await screen.findByText(/Current B bid/);
  await act(async () => old.resolve({ bids: [{ id: 'bid-a', status: 'pending', message: 'Old A bid' }] }));
  expect(screen.queryByText(/Old A bid/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Accept Bid' }));
  expect(mockPush).toHaveBeenCalledWith('/app/gigs/gig-b?action=payment_setup&bid=bid-b#payment-checkout');
});

test('closing and reopening the same bids modal retires its pending rejection', async () => {
  mockMyGigs.mockResolvedValue({ gigs: [ownedGig] });
  mockBids.mockResolvedValue({ bids: [{ id: 'bid-a', status: 'pending' }] });
  const pending = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(pending.promise);
  renderMyGigs(MyGigsV2Page);
  fireEvent.click(await screen.findByRole('button', { name: /^View Bids/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: /^View Bids/ }));
  await screen.findByRole('button', { name: 'Reject' });
  await act(async () => pending.resolve(true));
  expect(mockReject).not.toHaveBeenCalled();
  jest.mocked(confirmStore.open).mockResolvedValue(true);
  mockReject.mockResolvedValue({ success: true });
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
  await waitFor(() => expect(mockReject).toHaveBeenCalledTimes(1));
  expect(mockReject).toHaveBeenCalledWith('gig-a', 'bid-a');
});

const completedGig = { ...ownedGig, status: 'completed', completion_review: 'a'.repeat(64), owner_confirmed_at: null };

test('a pending owner confirmation cannot submit after a same-cookie session change', async () => {
  mockMyGigs.mockResolvedValue({ gigs: [completedGig] });
  const pending = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(pending.promise);
  renderMyGigs(MyGigsV2Page);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm completion' }));
  act(replaceSession); await act(async () => pending.resolve(true));
  expect(mockComplete).not.toHaveBeenCalled();
});

test('a delivered owner confirmation remains silent after page departure', async () => {
  mockMyGigs.mockResolvedValue({ gigs: [completedGig] });
  const pending = deferred<unknown>(); mockComplete.mockReturnValue(pending.promise); jest.mocked(confirmStore.open).mockResolvedValue(true);
  const page = renderMyGigs(MyGigsV2Page);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm completion' }));
  await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1)); page.unmount();
  await act(async () => pending.resolve({ gig: { ...completedGig, owner_confirmed_at: '2026-09-15T01:00:00Z' } }));
  expect(toast.success).not.toHaveBeenCalled(); expect(mockMyGigs).toHaveBeenCalledTimes(1);
});

test('a current matching owner receipt refreshes the existing list', async () => {
  mockMyGigs.mockResolvedValueOnce({ gigs: [completedGig] }).mockResolvedValueOnce({ gigs: [{ ...completedGig, title: 'Server confirmed task', owner_confirmed_at: '2026-09-15T01:00:00Z' }] });
  mockComplete.mockResolvedValue({ gig: { ...completedGig, owner_confirmed_at: '2026-09-15T01:00:00Z' } });
  jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyGigsV2Page);
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm completion' }));
  await screen.findByText('Server confirmed task');
  expect(mockComplete).toHaveBeenCalledWith('gig-a', { expectedReview: completedGig.completion_review });
  expect(toast.success).toHaveBeenCalledWith('Completion confirmed');
});


const workerBid = { id: 'bid-worker', user_id: 'worker-a', gig_id: 'gig-a', status: 'accepted', bid_amount: 25,
  created_at: '2026-09-15T00:00:00Z', gig: { ...ownedGig, status: 'in_progress' } };

test('My bids clears private rows on a same-cookie session replacement', async () => {
  mockMyBids.mockResolvedValue({ bids: [workerBid] }); renderMyGigs(MyBidsPage);
  await screen.findByText(ownedGig.title); act(replaceSession);
  expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
});

test.each([
  ['Mark Complete', workerBid, mockMark],
  ['Start Work', { ...workerBid, gig: { ...workerBid.gig, status: 'assigned' } }, mockStart],
  ['Accept $30', { ...workerBid, status: 'countered', counter_status: 'pending', counter_amount: 30 }, mockAcceptCounter],
  ['Decline', { ...workerBid, status: 'countered', counter_status: 'pending', counter_amount: 30 }, mockDeclineCounter],
] as const)('My bids pending %s cannot submit after page departure', async (label, bid, command) => {
  mockMyBids.mockResolvedValue({ bids: [bid] });
  const pending = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(pending.promise);
  const page = renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: label }));
  await waitFor(() => expect(confirmStore.open).toHaveBeenCalledTimes(1)); page.unmount();
  await act(async () => pending.resolve(true)); expect(command).not.toHaveBeenCalled();
});

test('My bids cannot accept an empty completion receipt as a saved task', async () => {
  mockMyBids.mockResolvedValue({ bids: [workerBid] }); mockMark.mockResolvedValue({});
  jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));
  await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(mockMyBids).toHaveBeenCalledTimes(1);
});

const workerReceipt = { id: 'gig-a', status: 'completed', accepted_by: 'worker-a', worker_completed_at: '2026-09-15T12:00:00Z', completion_note: null, completion_photos: [] };

test.each([
  { id: 'other' }, { status: 'in_progress' }, { accepted_by: 'other' }, { worker_completed_at: null },
  { worker_completed_at: 'invalid' }, { completion_note: 'Unexpected proof' }, { completion_photos: ['other'] },
])('My bids rejects a mismatched completion receipt %p', async mismatch => {
  mockMyBids.mockResolvedValue({ bids: [workerBid] }); mockMark.mockResolvedValue({ gig: { ...workerReceipt, ...mismatch } });
  jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled()); expect(mockMyBids).toHaveBeenCalledTimes(1);
});

test('My bids refreshes the existing list after its matching worker receipt', async () => {
  mockMyBids.mockResolvedValueOnce({ bids: [workerBid] }).mockResolvedValueOnce({ bids: [{ ...workerBid, gig: { ...workerBid.gig, status: 'completed', title: 'Saved task' } }] });
  mockMark.mockResolvedValue({ gig: workerReceipt }); jest.mocked(confirmStore.open).mockResolvedValue(true);
  renderMyGigs(MyBidsPage); fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' }));
  await screen.findByText('Saved task'); expect(mockMark).toHaveBeenCalledWith('gig-a');
  expect(screen.queryByRole('button', { name: 'Mark Complete' })).not.toBeInTheDocument();
  expect(toast.error).not.toHaveBeenCalled();
});

test('My bids reentry cannot reuse the previous account cache', async () => {
  mockMyBids.mockResolvedValueOnce({ bids: [workerBid] }); const page = renderMyGigs(MyBidsPage);
  await screen.findByText(ownedGig.title); page.unmount(); act(replaceSession);
  mockMyBids.mockResolvedValueOnce({ bids: [{ ...workerBid, id: 'bid-b', user_id: 'worker-b', gig: { ...workerBid.gig, title: 'Current worker task' } }] });
  renderMyGigs(MyBidsPage, page.client); expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
  await screen.findByText('Current worker task');
});

test('My bids retires a held read after a cross-tab session change', async () => {
  const held = deferred<unknown>(); mockMyBids.mockReturnValue(held.promise); renderMyGigs(MyBidsPage);
  await waitFor(() => expect(mockMyBids).toHaveBeenCalledTimes(1));
  act(() => { localStorage.setItem('pantopus:auth-session-change', 'session-b'); window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus:auth-session-change' })); });
  await act(async () => held.resolve({ bids: [workerBid] }));
  expect(screen.queryByText(ownedGig.title)).not.toBeInTheDocument();
  expect(screen.getByText('Your session changed. Reopen My bids to continue.')).toBeInTheDocument();
});

test('My bids ignores a completion reply after account replacement', async () => {
  const held = deferred<unknown>(); mockMark.mockReturnValue(held.promise); mockMyBids.mockResolvedValue({ bids: [workerBid] });
  jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Mark Complete' })); await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
  act(replaceSession); await act(async () => held.resolve({}));
  expect(toast.error).not.toHaveBeenCalled(); expect(mockMyBids).toHaveBeenCalledTimes(1);
});

test('My bids preserves a reopened withdrawal modal after the old request finishes', async () => {
  const held = deferred<unknown>(); mockWithdraw.mockReturnValueOnce(held.promise).mockResolvedValue({});
  mockMyBids.mockResolvedValue({ bids: [{ ...workerBid, status: 'pending' }] }); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Withdraw Bid' }));
  fireEvent.click(screen.getAllByRole('button', { name: 'Withdraw Bid' }).at(-1)!);
  await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw Bid' }));
  await act(async () => held.resolve({}));
  expect(screen.getByRole('heading', { name: 'Withdraw Bid' })).toBeInTheDocument();
  expect(mockMyBids).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getAllByRole('button', { name: 'Withdraw Bid' }).at(-1)!);
  await waitFor(() => expect(mockWithdraw).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Withdraw Bid' })).not.toBeInTheDocument());
});

test.each([
  ['Start Work', { ...workerBid, gig: { ...workerBid.gig, status: 'assigned' } }, mockStart],
  ['Accept $30', { ...workerBid, status: 'countered', counter_status: 'pending', counter_amount: 30 }, mockAcceptCounter],
  ['Decline', { ...workerBid, status: 'countered', counter_status: 'pending', counter_amount: 30 }, mockDeclineCounter],
] as const)('My bids current %s preserves its command and refresh', async (label, bid, command) => {
  mockMyBids.mockResolvedValueOnce({ bids: [bid] }).mockResolvedValueOnce({ bids: [{ ...bid, gig: { ...bid.gig, title: 'Current saved bid task' } }] });
  command.mockResolvedValue({}); jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: label })); await screen.findByText('Current saved bid task');
  expect(command.mock.calls).toEqual([command === mockStart ? ['gig-a'] : ['gig-a', 'bid-worker']]);
});

test('My bids Start Work sends the assignment terms the list rendered', async () => {
  const bid = { ...workerBid, gig: { ...workerBid.gig, status: 'assigned', accepted_by: 'worker-a', accepted_at: '2026-09-16T12:00:00+00:00', payment_id: null } };
  mockMyBids.mockResolvedValueOnce({ bids: [bid] }).mockResolvedValueOnce({ bids: [{ ...bid, gig: { ...bid.gig, title: 'Current saved bid task' } }] });
  mockStart.mockResolvedValue({}); jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Work' })); await screen.findByText('Current saved bid task');
  expect(mockStart.mock.calls).toEqual([['gig-a', { expectedAcceptedAt: '2026-09-16T12:00:00+00:00', expectedPrice: 25, expectedPaymentId: null }]]);
});

test('My bids Start Work shows the server guidance and reloads when the assignment changed', async () => {
  const bid = { ...workerBid, gig: { ...workerBid.gig, status: 'assigned', accepted_by: 'worker-a', accepted_at: '2026-09-16T12:00:00+00:00', payment_id: null } };
  mockMyBids.mockResolvedValueOnce({ bids: [bid] }).mockResolvedValueOnce({ bids: [{ ...bid, gig: { ...bid.gig, title: 'Reloaded bid task' } }] });
  mockStart.mockRejectedValue({ statusCode: 409, data: { code: 'ASSIGNMENT_CHANGED', error: 'The task changed before work could start. Refresh its details.' } });
  jest.mocked(confirmStore.open).mockResolvedValue(true); renderMyGigs(MyBidsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Work' })); await screen.findByText('Reloaded bid task');
  expect(toast.error).toHaveBeenCalledWith('The task changed before work could start. Refresh its details.');
});

test('My bids preserves signed-out navigation without private reads', async () => {
  mockToken = null; renderMyGigs(MyBidsPage); await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/login'));
  expect(mockMyBids).not.toHaveBeenCalled();
});


function activePanel(isOwner = false, onStatusChange = jest.fn(), overrides: Partial<React.ComponentProps<typeof ActiveTaskPanel>> = {}) {
  mockActiveStatus.mockResolvedValue({ gigId: 'gig-a', fulfillment_status: 'in_progress' });
  const props = { currentUserId: isOwner ? 'owner-a' : 'worker-a',
    isOwner, isWorker: !isOwner, socket: null, onOpenChat: jest.fn(), onCancel: jest.fn(), onStatusChange, ...overrides,
    gig: { ...workerBid.gig, accepted_by: 'worker-a', is_urgent: true, urgent_details: { current_fulfillment_status: 'in_progress' }, ...overrides.gig } };
  return { props, onStatusChange, ...render(<ActiveTaskPanel {...props} />) };
}

test('v2 active panel cannot submit a departed worker confirmation', async () => {
  const held = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(held.promise);
  const panel = activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' })); panel.unmount();
  await act(async () => held.resolve(true)); expect(mockMark).not.toHaveBeenCalled();
});

test('v2 active panel cannot accept an empty worker completion receipt', async () => {
  jest.mocked(confirmStore.open).mockResolvedValue(true); mockMark.mockResolvedValue({});
  const panel = activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));
  await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1));
  expect(panel.onStatusChange).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalled();
});

test('v2 active panel cannot offer owner confirmation before worker completion', async () => {
  activePanel(true); await screen.findAllByText('In progress');
  expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument();
});


test.each([
  { id: 'other' }, { status: 'in_progress' }, { accepted_by: 'other' }, { worker_completed_at: null },
  { worker_completed_at: 'invalid' }, { completion_note: 'Unexpected note' }, { completion_photos: ['other'] },
])('v2 active panel rejects mismatched worker receipt %p', async mismatch => {
  jest.mocked(confirmStore.open).mockResolvedValue(true); mockMark.mockResolvedValue({ gig: { ...workerReceipt, ...mismatch } });
  const panel = activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled()); expect(panel.onStatusChange).not.toHaveBeenCalled();
});

test('v2 active panel preserves current worker completion with a matching receipt', async () => {
  jest.mocked(confirmStore.open).mockResolvedValue(true); mockMark.mockResolvedValue({ gig: workerReceipt });
  const panel = activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));
  await waitFor(() => expect(panel.onStatusChange).toHaveBeenCalledTimes(1));
  expect(mockMark).toHaveBeenCalledWith('gig-a', {}); expect(toast.error).not.toHaveBeenCalled();
});

test('v2 active panel retires a pending confirmation after role rebinding', async () => {
  const held = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(held.promise);
  const panel = activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));
  panel.rerender(<ActiveTaskPanel {...panel.props} currentUserId="replacement" isWorker={false} />);
  await act(async () => held.resolve(true)); expect(mockMark).not.toHaveBeenCalled();
});

test('v2 active panel retires its controls and pending confirmation with the session', async () => {
  const held = deferred<boolean>(); jest.mocked(confirmStore.open).mockReturnValue(held.promise);
  activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));act(replaceSession);
  expect(screen.queryByRole('button', { name: 'Task complete' })).not.toBeInTheDocument();
  await act(async () => held.resolve(true)); expect(mockMark).not.toHaveBeenCalled();
});

test('v2 active panel ignores a completion receipt delivered after departure', async () => {
  const held = deferred<unknown>(); mockMark.mockReturnValue(held.promise); jest.mocked(confirmStore.open).mockResolvedValue(true);
  const panel = activePanel(); fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));
  await waitFor(() => expect(mockMark).toHaveBeenCalledTimes(1)); panel.unmount();
  await act(async () => held.resolve({ gig: workerReceipt })); expect(panel.onStatusChange).not.toHaveBeenCalled(); expect(toast.error).not.toHaveBeenCalled();
});

test('v2 active panel cannot advance fulfillment from an empty status receipt', async () => {
  mockActiveStatus.mockResolvedValueOnce({ fulfillment_status: null }); mockUpdateStatus.mockResolvedValue({});
  activePanel(false, jest.fn(), { gig: { ...workerBid.gig, urgent_details: null } });
  fireEvent.click(await screen.findByRole('button', { name: "I'm on the way" }));
  await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('button', { name: "I've arrived" })).not.toBeInTheDocument(); expect(toast.error).toHaveBeenCalled();
});


function panelSocket() {
  const handlers = new Map<string, (value: Record<string, unknown>) => void>();
  const socket = { on: (event: string, handler: (value: Record<string, unknown>) => void) => handlers.set(event, handler),
    off: (event: string, handler: (value: Record<string, unknown>) => void) => { if (handlers.get(event) === handler) handlers.delete(event); } };
  return { socket: socket as unknown as React.ComponentProps<typeof ActiveTaskPanel>['socket'],
    send: (status: string) => handlers.get('gig_status_update')?.({ gigId: 'gig-a', fulfillmentStatus: status }) };
}
const statusReceipt = (status: string) => ({ gig: { id: 'gig-a', urgent_details: { current_fulfillment_status: status } }, fulfillment_status: status });

test('v2 active panel ignores an older read after its current socket update', async () => {
  const held = deferred<unknown>(); mockActiveStatus.mockReturnValueOnce(held.promise); const socket = panelSocket();
  const panel = activePanel(false, jest.fn(), { socket: socket.socket, gig: { ...workerBid.gig, urgent_details: null } });
  await waitFor(() => expect(mockActiveStatus).toHaveBeenCalledTimes(1)); act(() => socket.send('in_progress'));
  await act(async () => held.resolve({ fulfillment_status: 'on_the_way' }));
  expect(screen.getByRole('button', { name: 'Task complete' })).toBeInTheDocument(); expect(panel.onStatusChange).toHaveBeenCalledTimes(1);
});

test('v2 active panel preserves a newer socket status after the previous status reply', async () => {
  const held = deferred<unknown>(); mockUpdateStatus.mockReturnValue(held.promise); mockActiveStatus.mockResolvedValueOnce({ fulfillment_status: null });
  const socket = panelSocket(); activePanel(false, jest.fn(), { socket: socket.socket, gig: { ...workerBid.gig, urgent_details: null } });
  fireEvent.click(await screen.findByRole('button', { name: "I'm on the way" })); await waitFor(() => expect(mockUpdateStatus).toHaveBeenCalledTimes(1));
  act(() => socket.send('arrived')); await act(async () => held.resolve(statusReceipt('on_the_way')));
  expect(screen.getByRole('button', { name: 'Task complete' })).toBeInTheDocument();
});

test('v2 active panel advances its existing controls after a matching status receipt', async () => {
  mockActiveStatus.mockResolvedValueOnce({ fulfillment_status: null }); mockUpdateStatus.mockResolvedValue(statusReceipt('on_the_way'));
  activePanel(false, jest.fn(), { gig: { ...workerBid.gig, urgent_details: null } });
  fireEvent.click(await screen.findByRole('button', { name: "I'm on the way" }));
  await screen.findByRole('button', { name: "I've arrived" }); expect(mockUpdateStatus).toHaveBeenCalledWith('gig-a', { status: 'on_the_way' }); expect(toast.error).not.toHaveBeenCalled();
});

test.each([false, true])('v2 active panel applies only a matching owner confirmation (saved=%s)', async saved => {
  jest.mocked(confirmStore.open).mockResolvedValue(true); mockConfirmCompletion.mockResolvedValue(saved ? { gig: { ...workerReceipt, owner_confirmed_at: '2026-09-15T13:00:00Z' } } : {});
  const panel = activePanel(true, jest.fn(), { gig: { ...workerBid.gig, status: 'completed', completion_review: 'a'.repeat(64) } });
  fireEvent.click(await screen.findByRole('button', { name: 'Mark complete' })); await waitFor(() => expect(mockConfirmCompletion).toHaveBeenCalledTimes(1));
  expect(mockConfirmCompletion).toHaveBeenCalledWith('gig-a', { expectedReview: 'a'.repeat(64) });
  expect(panel.onStatusChange).toHaveBeenCalledTimes(saved ? 1 : 0); expect(toast.error).toHaveBeenCalledTimes(saved ? 0 : 1);
});


test('v2 active panel does not send ordinary tasks to the urgent-only status endpoint', async () => {
  mockActiveStatus.mockRejectedValueOnce({ statusCode: 400, message: 'This endpoint is only for urgent tasks' });
  activePanel(false, jest.fn(), { gig: { ...workerBid.gig, status: 'assigned', is_urgent: false, starts_asap: false, urgent_details: null } });
  await screen.findByText('Safety');
  expect(mockActiveStatus).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: "I'm on the way" })).not.toBeInTheDocument();
});


test('v2 active panel preserves ordinary worker completion without urgent status requests', async () => {
  jest.mocked(confirmStore.open).mockResolvedValue(true); mockMark.mockResolvedValue({ gig: workerReceipt });
  const panel = activePanel(false, jest.fn(), { gig: { ...workerBid.gig, is_urgent: false, starts_asap: false, urgent_details: null } });
  fireEvent.click(await screen.findByRole('button', { name: 'Task complete' }));
  await waitFor(() => expect(panel.onStatusChange).toHaveBeenCalledTimes(1)); expect(mockActiveStatus).not.toHaveBeenCalled();
});


const etaGig = { id: 'gig-a', status: 'assigned', user_id: 'owner-a', accepted_by: 'worker-a', helper_eta_minutes: 12, helper_location_updated_at: '2026-09-15T13:00:00Z' };
const shareReceipt = { share_url: 'https://pantopus.test/status/abcdef1234567890abcdef1234567890', expires_at: '2099-01-01T00:00:00Z' };
function etaSocket() {
  const handlers = new Set<(value: Record<string, unknown>) => void>();
  return { socket: { on: (_: string, handler: (value: Record<string, unknown>) => void) => handlers.add(handler),
    off: (_: string, handler: (value: Record<string, unknown>) => void) => handlers.delete(handler) } as unknown as React.ComponentProps<typeof ETATracker>['socket'],
    handlers, send: (value: Record<string, unknown>) => handlers.forEach(handler => handler(value)) };
}

test('ETA tracker ignores updates for another task', () => {
  const socket = etaSocket(); render(<ETATracker gig={etaGig} socket={socket.socket} />);
  act(() => socket.send({ gigId: 'other-gig', eta_minutes: 99, timestamp: Date.now() }));
  expect(screen.getByText(/ETA: ~12 min/)).toBeInTheDocument();
});

test('ETA tracker retires private data and a held share reply with its session', async () => {
  const held = deferred<typeof shareReceipt>(); mockShareStatus.mockReturnValue(held.promise);
  render(<ETATracker gig={etaGig} socket={null} />); fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  act(replaceSession); await act(async () => held.resolve(shareReceipt));
  expect(mockClipboard).not.toHaveBeenCalled(); expect(screen.queryByText(/ETA: ~12 min/)).not.toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
});

test('ETA tracker cannot copy a share reply delivered after departure', async () => {
  const held = deferred<typeof shareReceipt>(); mockShareStatus.mockReturnValue(held.promise);
  const view = render(<ETATracker gig={etaGig} socket={null} />); fireEvent.click(screen.getByRole('button', { name: 'Share Status' })); view.unmount();
  await act(async () => held.resolve(shareReceipt)); expect(mockClipboard).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
});

test('ETA tracker resets location and a pending share when its task changes', async () => {
  const held = deferred<typeof shareReceipt>(); mockShareStatus.mockReturnValue(held.promise);
  const view = render(<ETATracker gig={etaGig} socket={null} />); fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  view.rerender(<ETATracker gig={{ ...etaGig, id: 'gig-b', helper_eta_minutes: null, helper_location_updated_at: null }} socket={null} />);
  await act(async () => held.resolve(shareReceipt)); expect(mockClipboard).not.toHaveBeenCalled();
  expect(screen.getByText('Helper accepted — waiting for location update')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Share Status' })).toBeEnabled();
});

test('ETA tracker adopts a refreshed location for the same task', () => {
  const view = render(<ETATracker gig={etaGig} socket={null} />);
  view.rerender(<ETATracker gig={{ ...etaGig, helper_eta_minutes: 5, helper_location_updated_at: '2026-09-15T13:02:00Z' }} socket={null} />);
  expect(screen.getByText(/ETA: ~5 min/)).toBeInTheDocument();
});

test('ETA tracker clears its estimate when the helper reports an unknown ETA', () => {
  const socket = etaSocket(); render(<ETATracker gig={etaGig} socket={socket.socket} />);
  act(() => socket.send({ gigId: 'gig-a', eta_minutes: null, timestamp: Date.now() }));
  expect(screen.getByText('Helper accepted — waiting for location update')).toBeInTheDocument();
});


test('ETA tracker rejects a missing share receipt without copying or reporting success', async () => {
  mockShareStatus.mockResolvedValue({}); render(<ETATracker gig={etaGig} socket={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  await waitFor(() => expect(mockShareStatus).toHaveBeenCalledTimes(1));
  expect(mockClipboard).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled(); expect(toast.error).toHaveBeenCalled();
});


test('ETA tracker copies a current share once and allows retry after a failure', async () => {
  mockShareStatus.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue(shareReceipt);
  render(<ETATracker gig={etaGig} socket={null} />); fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Link copied!'));
  expect(mockShareStatus.mock.calls).toEqual([['gig-a'], ['gig-a']]); expect(mockClipboard.mock.calls).toEqual([[shareReceipt.share_url]]);
});

test('ETA tracker does not report a completed clipboard write to a retired session', async () => {
  const held = deferred<void>(); mockClipboard.mockReturnValue(held.promise); mockShareStatus.mockResolvedValue(shareReceipt);
  render(<ETATracker gig={etaGig} socket={null} />); fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  await waitFor(() => expect(mockClipboard).toHaveBeenCalledTimes(1)); act(replaceSession);
  await act(async () => held.resolve()); expect(toast.success).not.toHaveBeenCalled(); expect(toast.error).not.toHaveBeenCalled();
});

test('ETA tracker retires after a cross-tab signal and leaves other socket consumers subscribed', () => {
  const socket = etaSocket(), neighbor = jest.fn(); socket.handlers.add(neighbor);
  render(<ETATracker gig={etaGig} socket={socket.socket} />);
  act(() => { localStorage.setItem('pantopus:auth-session-change', 'session-b'); window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus:auth-session-change' })); });
  expect(screen.queryByRole('button', { name: 'Share Status' })).not.toBeInTheDocument(); expect([...socket.handlers]).toEqual([neighbor]);
  act(() => socket.send({ gigId: 'gig-a', eta_minutes: 1, timestamp: Date.now() })); expect(neighbor).toHaveBeenCalledTimes(1);
});

test('ETA tracker preserves a newer socket estimate across older events and loaded data', () => {
  const socket = etaSocket(), view = render(<ETATracker gig={etaGig} socket={socket.socket} />), now = Date.now();
  act(() => socket.send({ gigId: 'gig-a', eta_minutes: 3, timestamp: now }));
  act(() => socket.send({ gigId: 'gig-a', eta_minutes: 9, timestamp: now - 1000 }));
  view.rerender(<ETATracker gig={{ ...etaGig, helper_eta_minutes: 10, helper_location_updated_at: new Date(now - 2000).toISOString() }} socket={socket.socket} />);
  expect(screen.getByText(/ETA: ~3 min/)).toBeInTheDocument();
});

test.each([{ accepted_by: 'replacement-worker' }, { status: 'completed' }])('ETA tracker retires a share after its work relationship changes: %p', async change => {
  const held = deferred<typeof shareReceipt>(); mockShareStatus.mockReturnValue(held.promise);
  const view = render(<ETATracker gig={etaGig} socket={null} />); fireEvent.click(screen.getByRole('button', { name: 'Share Status' }));
  view.rerender(<ETATracker gig={{ ...etaGig, ...change }} socket={null} />);
  await act(async () => held.resolve(shareReceipt)); expect(mockClipboard).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
});

test('ETA tracker suppresses duplicate pending shares and stays quiet on a departed error', async () => {
  const held = deferred<typeof shareReceipt>(); mockShareStatus.mockReturnValue(held.promise.then(() => { throw new Error('Unavailable'); }));
  const view = render(<ETATracker gig={etaGig} socket={null} />), button = screen.getByRole('button', { name: 'Share Status' });
  fireEvent.click(button); fireEvent.click(button); expect(mockShareStatus).toHaveBeenCalledTimes(1); view.unmount();
  await act(async () => held.resolve(shareReceipt)); expect(toast.error).not.toHaveBeenCalled();
});
