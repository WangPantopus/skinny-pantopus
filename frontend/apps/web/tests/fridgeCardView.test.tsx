// ============================================================
// Wave 1, #2 — the public fridge-card page. The invariants:
// an active card leads with the address (what the caller says to 911),
// a revoked card shows NO content, and an unknown code confirms
// nothing. The page must never imply 911 dispatch receives the data.
// ============================================================

import { render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import FridgeCardView from '@/components/place/fridge-card/FridgeCardView';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/fridge-card/x',
}));

const getMock = api.fridgeCards.getPublicFridgeCard as jest.Mock;

const ACTIVE = {
  valid: true,
  status: 'active',
  label: 'Sitter card',
  issued_at: '2026-08-20T00:00:00.000Z',
  content: {
    address: { line1: '1421 SE Oak St Unit B', city_state_zip: 'Portland, OR 97214' },
    sections: [
      { key: 'household', items: [{ label: 'Mia (6)', note: 'Peanut allergy — EpiPen in the pantry' }] },
      { key: 'utilities', items: [{ label: 'Gas shutoff', note: 'Left side of the house' }] },
    ],
  },
};

describe('FridgeCardView', () => {
  beforeEach(() => getMock.mockReset());

  it('leads with the address and renders the sections', async () => {
    getMock.mockResolvedValue(ACTIVE);
    render(<FridgeCardView code="ABCD-EFGH-JKMN-PQRS" />);

    await waitFor(() => expect(screen.getByText('1421 SE Oak St Unit B')).toBeInTheDocument());
    expect(screen.getByText(/call 911 and say this address/i)).toBeInTheDocument();
    expect(screen.getByText('Portland, OR 97214')).toBeInTheDocument();
    expect(screen.getByText('Mia (6)')).toBeInTheDocument();
    expect(screen.getByText(/EpiPen in the pantry/)).toBeInTheDocument();
    expect(screen.getByText(/gas shutoff/i)).toBeInTheDocument();
    // The honesty line: read by people, never delivered to dispatch.
    expect(screen.getByText(/not delivered to 911 dispatch/i)).toBeInTheDocument();
  });

  it('shows a revoked card as no-longer-active with zero content', async () => {
    getMock.mockResolvedValue({ valid: true, status: 'revoked', revoked_at: '2026-08-22T00:00:00.000Z' });
    render(<FridgeCardView code="ABCD-EFGH-JKMN-PQRS" />);

    await waitFor(() => expect(screen.getByText(/no longer active/i)).toBeInTheDocument());
    expect(screen.queryByText(/Oak St/)).not.toBeInTheDocument();
    expect(screen.queryByText(/EpiPen/)).not.toBeInTheDocument();
  });

  it('shows unknown codes as not-found', async () => {
    getMock.mockResolvedValue({ valid: false });
    render(<FridgeCardView code="AAAA-BBBB-CCCC-DDDD" />);
    await waitFor(() => expect(screen.getByText(/no card found/i)).toBeInTheDocument());
  });
});
