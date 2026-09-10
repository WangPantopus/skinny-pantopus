import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GigBidCheckout, { gigBidCheckoutUrl } from '@/components/gig-detail/GigBidCheckout';
import * as api from '@pantopus/api';

let mockQuery = 'bid=bid-a';
let mockSheet: { onSuccess: () => Promise<void>; onClose: () => Promise<void> };
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mockQuery) }));
jest.mock('@pantopus/api', () => ({ gigs: {
  getGigBids: jest.fn(), acceptBid: jest.fn(), finalizeAccept: jest.fn(), abortAccept: jest.fn(),
} }));
jest.mock('@/components/payments/StripeProvider', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/payments/GigPaymentSetup', () => ({ __esModule: true, default: (props: typeof mockSheet & { amount: number; bidId: string }) => {
  mockSheet = props;
  return <div role="dialog"><span>{props.amount} cents for {props.bidId}</span>
    <button onClick={() => void props.onSuccess()}>SDK success</button>
    <button onClick={() => void props.onClose()}>SDK cancel</button></div>;
} }));
const calls = api.gigs as unknown as Record<string, jest.Mock>;
const bid = { id: 'bid-a', bid_amount: 27, status: 'pending' };
const payment = { bid: { ...bid, status: 'pending_payment' }, amountCents: 2700, currency: 'usd', clientSecret: 'test-secret', isSetupIntent: false };
const accepted = { bid: { ...bid, status: 'accepted' } };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};
const proceed = async () => {
  const button = await screen.findByRole('button', { name: 'Continue' });
  await act(async () => { fireEvent.click(button); });
};
beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockQuery = 'bid=bid-a';
  calls.getGigBids.mockResolvedValue({ bids: [bid] });
  calls.acceptBid.mockResolvedValue(payment);
  calls.finalizeAccept.mockResolvedValue(accepted);
  calls.abortAccept.mockResolvedValue({ bid });
});

test('starts only after confirmation and presents the durable amount', async () => {
  calls.acceptBid.mockResolvedValue({ ...payment, amountCents: 3100 });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await screen.findByText(/selected bid is \$27.00/);
  expect(calls.acceptBid).not.toHaveBeenCalled();
  await proceed();
  expect(await screen.findByText('3100 cents for bid-a')).toBeInTheDocument();
  expect(calls.acceptBid).toHaveBeenCalledWith('gig-a', 'bid-a');
  expect(window.sessionStorage.length).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'SDK success' }));
  await screen.findByRole('heading', { name: 'Bid accepted' });
  expect(calls.finalizeAccept).toHaveBeenCalledWith('gig-a', 'bid-a');
});

test('verified hold finalizes without presenting payment again', async () => {
  calls.acceptBid.mockResolvedValue({ ...payment, authorizationReady: true, clientSecret: null });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await proceed();
  await screen.findByRole('heading', { name: 'Bid accepted' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('lost finalization response retains same-bid confirmation without another authorization', async () => {
  calls.finalizeAccept.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(accepted);
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await proceed();
  fireEvent.click(await screen.findByRole('button', { name: 'SDK success' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Confirm authorization' }));
  await screen.findByRole('heading', { name: 'Bid accepted' });
  expect(calls.acceptBid).toHaveBeenCalledTimes(1);
  expect(calls.finalizeAccept).toHaveBeenCalledTimes(2);
});

test('cold navigation resumes one server pending bid and retires old secret storage', async () => {
  mockQuery = '';
  window.sessionStorage.setItem('gig_payment_setup_gig-a', JSON.stringify({ clientSecret: 'old-secret' }));
  calls.getGigBids.mockResolvedValue({ bids: [{ ...bid, status: 'pending_payment' }] });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Resume payment' }));
  await screen.findByRole('dialog');
  expect(calls.acceptBid).toHaveBeenCalledWith('gig-a', 'bid-a');
  expect(window.sessionStorage.length).toBe(0);
});

test('unknown cancellation keeps recovery visible until exact receipt', async () => {
  calls.abortAccept.mockRejectedValueOnce(new Error('lost response')).mockResolvedValueOnce({ bid });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await proceed();
  fireEvent.click(await screen.findByRole('button', { name: 'SDK cancel' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cancellation could not be confirmed');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel payment setup' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel payment setup' })).not.toBeInTheDocument());
  expect(calls.abortAccept).toHaveBeenNthCalledWith(2, 'gig-a', 'bid-a');
});

test.each([
  ['foreign requested bid', 'bid=foreign', [bid]],
  ['multiple pending operations', '', [{ ...bid, status: 'pending_payment' }, { ...bid, id: 'bid-b', status: 'pending_payment' }]],
  ['withdrawn bid', 'bid=bid-a', [{ ...bid, status: 'withdrawn' }]],
])('%s cannot create or guess acceptance', async (_, query, bids) => {
  mockQuery = query as string;
  calls.getGigBids.mockResolvedValue({ bids });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
  expect(calls.acceptBid).not.toHaveBeenCalled();
});

test.each([
  { amountCents: undefined }, { amountCents: 27.5 }, { currency: 'eur' }, { isSetupIntent: true }, { bid: { ...bid, id: 'foreign' } },
])('unproven payment terms never reach SDK: %j', async (override) => {
  calls.acceptBid.mockResolvedValue({ ...payment, ...override });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await proceed();
  await screen.findByRole('alert');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls.finalizeAccept).not.toHaveBeenCalled();
});

test('account change discards late authorization response', async () => {
  const pending = deferred<typeof payment>();
  calls.acceptBid.mockReturnValue(pending.promise);
  const ui = render(<GigBidCheckout gigId="gig-a" actorId="payer-a" />);
  await proceed();
  calls.getGigBids.mockResolvedValue({ bids: [] });
  ui.rerender(<GigBidCheckout gigId="gig-a" actorId="payer-b" />);
  await act(async () => pending.resolve(payment));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls.finalizeAccept).not.toHaveBeenCalled();
});

test('bid navigation retires the old sheet and its delayed success callback', async () => {
  const ui = render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await proceed();
  await screen.findByRole('dialog');
  const oldSuccess = mockSheet.onSuccess;
  mockQuery = 'bid=bid-b';
  calls.getGigBids.mockResolvedValue({ bids: [{ ...bid, id: 'bid-b' }] });
  ui.rerender(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await screen.findByRole('button', { name: 'Continue' });
  await act(oldSuccess);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls.finalizeAccept).not.toHaveBeenCalled();
});

test('duplicate clicks cannot start parallel operations', async () => {
  const pending = deferred<typeof payment>();
  calls.acceptBid.mockReturnValue(pending.promise);
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  const button = await screen.findByRole('button', { name: 'Continue' });
  fireEvent.click(button); fireEvent.click(button);
  expect(calls.acceptBid).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(payment));
});

test('free acceptance requires exact accepted receipt without SDK', async () => {
  calls.getGigBids.mockResolvedValue({ bids: [{ ...bid, bid_amount: 0 }] });
  calls.acceptBid.mockResolvedValue(accepted);
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await proceed();
  await screen.findByRole('heading', { name: 'Bid accepted' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls.finalizeAccept).not.toHaveBeenCalled();
});

test('checkout URL retains only encoded gig and selected bid identity', () => {
  expect(gigBidCheckoutUrl('gig/one', 'bid?two')).toBe('/app/gigs/gig%2Fone?action=payment_setup&bid=bid%3Ftwo#payment-checkout');
});

test('redirect return removes provider secrets from history while retaining exact-bid recovery', async () => {
  const state = { retained: 'navigation-state' };
  window.history.replaceState(state, '', '/app/gigs/gig-a?bid=bid-a&payment=authorized&payment_intent=pi_test&payment_intent_client_secret=test-secret&setup_intent=seti_test&setup_intent_client_secret=other-secret&redirect_status=succeeded#payment-checkout');
  calls.getGigBids.mockResolvedValue({ bids: [{ ...bid, status: 'pending_payment' }] });
  render(<GigBidCheckout gigId="gig-a" actorId="payer" />);
  await screen.findByRole('button', { name: 'Resume payment' });
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/app/gigs/gig-a?bid=bid-a&payment=authorized#payment-checkout');
  expect(window.history.state).toEqual(state);
  expect(calls.acceptBid).not.toHaveBeenCalled();
});
