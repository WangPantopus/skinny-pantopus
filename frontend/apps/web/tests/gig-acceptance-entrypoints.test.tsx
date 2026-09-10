import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import OffersPanel from '@/components/gig-detail/OffersPanel';
import GigChatActions from '@/components/chat/GigChatActions';

const mockPush = jest.fn();
const mockBids = jest.fn();
const mockAccept = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@pantopus/api', () => ({ gigs: { getGigBids: (...args: unknown[]) => mockBids(...args), acceptBid: (...args: unknown[]) => mockAccept(...args) } }));
jest.mock('@/components/gig-detail/GigBidCheckout', () => ({ gigBidCheckoutUrl: (gig: string, bid: string) => `/app/gigs/${gig}?action=payment_setup&bid=${bid}#payment-checkout` }));
jest.mock('@/components/payments/StripeProvider', () => () => null);
jest.mock('@/components/payments/GigPaymentSetup', () => () => null);
jest.mock('@/components/user/UserIdentityLink', () => () => null);
jest.mock('@/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn() } }));

beforeEach(() => { jest.clearAllMocks(); });

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
