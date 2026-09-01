// ============================================================
// Wave 3 — Block Founders on the web. The invariants: the section is
// hard-gated to verified viewers (no fetch behind the lock), the card
// shows the permanent rank + raw insider count + unlock meters, the
// invite form spends the weekly budget and disappears at zero, and the
// public opt-out page never fires the POST until the person confirms.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { PlaceIntelligence } from '@pantopus/types';
import BlockDetail from '@/components/place/detail/BlockDetail';
import NoMailView from '@/components/place/no-mail/NoMailView';
import { toast } from '@/components/ui/toast-store';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => '/app/place',
}));

jest.mock('@/components/ui/toast-store', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() },
}));

const mockToast = toast as unknown as Record<'success' | 'error' | 'info' | 'warning', jest.Mock>;

const getStatusMock = api.blockFounders.getBlockStatus as jest.Mock;
const sendInviteMock = api.blockFounders.sendBlockInvite as jest.Mock;
const optOutMock = api.blockFounders.redeemInviteOptOut as jest.Mock;

/**
 * What a failed invite ACTUALLY looks like: the API client's response
 * interceptor rejects with a PLAIN OBJECT carrying the server's message
 * and code (see packages/api/src/client.ts) — it is never an `Error`.
 * A test that rejects with `new Error(...)` passes against an
 * `instanceof Error` handler that drops the message in production, so
 * every failure test here must use this shape.
 */
function rejection(message: string, code?: string, statusCode?: number) {
  return { message, code, statusCode, data: code ? { error: message, code } : undefined };
}

function intel(tier: PlaceIntelligence['tier']): PlaceIntelligence {
  return {
    place: { label: '1421 SE Oak St, Portland', line1: '1421 SE Oak St', city: 'Portland', state: 'OR', postal_code: '97214' },
    tier, region_supported: true, generated_at: '2026-08-25T00:00:00Z',
    groups: [],
  } as unknown as PlaceIntelligence;
}

function renderBlock(tier: PlaceIntelligence['tier'] = 'T4') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BlockDetail intelligence={intel(tier)} homeId="home-1" />
    </QueryClientProvider>,
  );
}

const BLOCK = {
  available: true,
  rank: 2,
  established_at: '2026-07-04T00:00:00.000Z',
  verified_count: 6,
  // Wave 3 added `rent_reports` and put the real_rent meter FIRST — it
  // counts RENT REPORTS in the cell, not verified homes, so its reading
  // moves independently of the other two.
  rent_reports: 4,
  meters: [
    { id: 'real_rent', label: 'Real rents on your block', current: 4, needed: 10, unlocked: false },
    { id: 'verified_homes', label: 'Ten verified homes', current: 6, needed: 10, unlocked: false },
    { id: 'block_growing', label: 'Growing-block signal', current: 6, needed: 25, unlocked: false },
  ],
  invites_remaining: 2,
  invites_weekly_cap: 3,
};

describe('BlockDetail — Founders section', () => {
  beforeEach(() => {
    getStatusMock.mockReset();
    sendInviteMock.mockReset();
    mockToast.error.mockReset();
    mockToast.success.mockReset();
  });

  it('gates unverified viewers with the permanent-rank promise, without fetching', () => {
    renderBlock('T3');
    expect(screen.getByText(/permanent founding rank/i)).toBeInTheDocument();
    expect(getStatusMock).not.toHaveBeenCalled();
  });

  it('shows the rank, raw insider count, meters, and invite budget for a verified founder', async () => {
    getStatusMock.mockResolvedValue(BLOCK);
    renderBlock('T4');

    await waitFor(() => expect(screen.getByText('Founder #2 of this block')).toBeInTheDocument());
    expect(screen.getByText(/since July 2026/)).toBeInTheDocument();
    expect(screen.getByText('Verified homes on your block')).toBeInTheDocument();
    // The meter names the milestone it actually measures — it must not
    // claim to gate bill_benchmark, whose real gate is opted-in bill
    // data, not the verified-home count.
    expect(screen.getByText('Ten verified homes')).toBeInTheDocument();
    expect(screen.getByText('6 of 10')).toBeInTheDocument();
    expect(screen.getByText('6 of 25')).toBeInTheDocument();
    // Wave 3: the rent-report count is its own reading and its own meter,
    // and it must not be conflated with the verified-home count.
    expect(screen.getByText('Rents shared on your block')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Real rents on your block')).toBeInTheDocument();
    expect(screen.getByText('4 of 10')).toBeInTheDocument();
    expect(screen.getByText(/2 left this week/)).toBeInTheDocument();
    // The card is template-only and anonymized — the form says so.
    expect(screen.getByText(/never your name or address/i)).toBeInTheDocument();
  });

  it('sends an invite with the entered address and reports the remaining budget', async () => {
    getStatusMock.mockResolvedValue(BLOCK);
    sendInviteMock.mockResolvedValue({ sent: true, invites_remaining: 1 });
    renderBlock('T4');
    await waitFor(() => expect(screen.getByLabelText('Street address')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '1423 SE Oak St' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Portland' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'or' } });
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '97214' } });
    fireEvent.click(screen.getByText('Mail the invitation'));

    await waitFor(() => expect(sendInviteMock).toHaveBeenCalledWith('home-1', {
      line1: '1423 SE Oak St', city: 'Portland', state: 'OR', zip: '97214',
    }));
  });

  it('retires the form once the weekly budget is spent, quoting the server’s cap', async () => {
    getStatusMock.mockResolvedValue({ ...BLOCK, invites_remaining: 0 });
    renderBlock('T4');

    await waitFor(() => expect(screen.getByText(/used this week/i)).toBeInTheDocument());
    expect(screen.getByText(/used this week’s 3 invitations/i)).toBeInTheDocument();
    expect(screen.queryByText('Mail the invitation')).not.toBeInTheDocument();
  });

  // The cap is `invites_weekly_cap` off the wire, not a word baked into
  // the copy: if the route's budget moves, the sentence has to move with
  // it. Both mobile clients read the server value.
  it('reads the weekly cap from the server rather than hardcoding three', async () => {
    getStatusMock.mockResolvedValue({ ...BLOCK, invites_remaining: 0, invites_weekly_cap: 5 });
    renderBlock('T4');

    await waitFor(() => expect(screen.getByText(/used this week’s 5 invitations/i)).toBeInTheDocument());
    expect(screen.queryByText(/three invitations/i)).not.toBeInTheDocument();
  });

  // Every refusal on this route is coded and each one needs a different
  // move from the founder. The client rejects with a PLAIN OBJECT, so an
  // `instanceof Error` gate reads false and collapses all of them into
  // one generic line — which is why these reject with the real shape.
  it.each([
    ['You’ve used this week’s invitations. Your budget resets a week after your first send.', 'WEEKLY_CAP', 429],
    ['That address has asked never to receive a Pantopus card.', 'OPTED_OUT', 400],
    ['We couldn’t read that address. Check the street line and ZIP.', 'BAD_ADDRESS', 400],
    ['A card already went to that address in the last 90 days.', 'RECENTLY_INVITED', 400],
    ['The mail carrier didn’t accept the card. Try again shortly.', 'SEND_FAILED', 502],
  ])('surfaces the server’s own refusal (%s)', async (message, code, statusCode) => {
    getStatusMock.mockResolvedValue(BLOCK);
    sendInviteMock.mockRejectedValue(rejection(message, code, statusCode));
    renderBlock('T4');
    await waitFor(() => expect(screen.getByLabelText('Street address')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '1423 SE Oak St' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Portland' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'or' } });
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '97214' } });
    fireEvent.click(screen.getByText('Mail the invitation'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(message));
    // Never the catch-all — that is the bug this test exists to catch.
    expect(mockToast.error).not.toHaveBeenCalledWith('Could not send the invitation.');
  });

  it('falls back to the generic line only when the failure carries no message', async () => {
    getStatusMock.mockResolvedValue(BLOCK);
    sendInviteMock.mockRejectedValue({});
    renderBlock('T4');
    await waitFor(() => expect(screen.getByLabelText('Street address')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Street address'), { target: { value: '1423 SE Oak St' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Portland' } });
    fireEvent.change(screen.getByLabelText('State'), { target: { value: 'or' } });
    fireEvent.change(screen.getByLabelText('ZIP code'), { target: { value: '97214' } });
    fireEvent.click(screen.getByText('Mail the invitation'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Could not send the invitation.'));
  });

  it('degrades honestly when the home has no map coordinates', async () => {
    getStatusMock.mockResolvedValue({ available: false, reason: 'NO_COORDINATES' });
    renderBlock('T4');

    await waitFor(() => expect(screen.getByText(/couldn't place this home on a block/i)).toBeInTheDocument());
    expect(screen.queryByText(/Founder #/)).not.toBeInTheDocument();
  });
});

describe('NoMailView — the recipient kill switch', () => {
  beforeEach(() => optOutMock.mockReset());

  it('never fires the opt-out until the person confirms', () => {
    render(<NoMailView code="ABCDEFGH12345678" />);
    expect(screen.getByText('Never mail me again')).toBeInTheDocument();
    expect(optOutMock).not.toHaveBeenCalled();
  });

  it('confirms a successful opt-out as permanent', async () => {
    optOutMock.mockResolvedValue({ done: true });
    render(<NoMailView code="ABCDEFGH12345678" />);
    fireEvent.click(screen.getByText('Never mail me again'));

    await waitFor(() => expect(screen.getByText(/off the list/i)).toBeInTheDocument());
    expect(optOutMock).toHaveBeenCalledWith('ABCDEFGH12345678');
    expect(screen.getByText(/never receive another/i)).toBeInTheDocument();
  });

  it('keeps the button and shows calm guidance on a bad code', async () => {
    optOutMock.mockResolvedValue({ done: false });
    render(<NoMailView code="WRONG" />);
    fireEvent.click(screen.getByText('Never mail me again'));

    await waitFor(() => expect(screen.getByText(/didn't work/i)).toBeInTheDocument());
    expect(screen.getByText('Never mail me again')).toBeInTheDocument();
  });
});
