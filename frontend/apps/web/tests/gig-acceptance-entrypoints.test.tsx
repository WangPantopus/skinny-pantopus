import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OffersPanel from '@/components/gig-detail/OffersPanel';
import GigChatActions from '@/components/chat/GigChatActions';
import MyGigsPage from '@/app/(app)/app/my-gigs/page';
import MyGigsV2Page from '@/app/(app)/app/my-gigs-v2/page';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';

const mockPush = jest.fn();
const mockBids = jest.fn();
const mockAccept = jest.fn();
const mockMyGigs = jest.fn();
const mockReject = jest.fn();
const mockComplete = jest.fn();
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
    getGigBids: (...args: unknown[]) => mockBids(...args), acceptBid: (...args: unknown[]) => mockAccept(...args),
    getMyGigs: (...args: unknown[]) => mockMyGigs(...args), rejectBid: (...args: unknown[]) => mockReject(...args),
    completeGig: (...args: unknown[]) => mockComplete(...args),
  },
}));
jest.mock('@/components/gig-detail/GigBidCheckout', () => ({ gigBidCheckoutUrl: (gig: string, bid: string) => `/app/gigs/${gig}?action=payment_setup&bid=${bid}#payment-checkout` }));
jest.mock('@/components/payments/StripeProvider', () => () => null);
jest.mock('@/components/payments/GigPaymentSetup', () => () => null);
jest.mock('@/components/user/UserIdentityLink', () => () => null);
jest.mock('@/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn() } }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { info: jest.fn(), error: jest.fn(), success: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks(); mockTokenListeners.clear(); mockToken = 'cookie-session';
  mockMyGigs.mockReset(); mockBids.mockReset(); mockReject.mockReset(); mockComplete.mockReset();
  jest.mocked(confirmStore.open).mockReset();
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
