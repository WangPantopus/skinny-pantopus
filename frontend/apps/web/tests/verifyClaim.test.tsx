// ============================================================
// Wave 1 — Residency Pass, public checker. The invariant that matters:
// the page tells a stranger the truth about a claim's LIVE status —
// active reads green, every other state reads as NOT valid, and an
// unknown code never confirms or denies anything else.
// ============================================================

import { render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import VerifyClaim from '@/components/place/verify-claim/VerifyClaim';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/verify-claim',
}));

const verifyMock = api.residencyClaims.verifyResidencyClaim as jest.Mock;

const BASE = {
  valid: true,
  scope: 'city',
  statement: 'Dana Whitfield is a verified resident of Portland, OR.',
  holder_name: 'Dana Whitfield',
  issued_at: '2026-08-20T00:00:00.000Z',
  expires_at: '2026-09-19T00:00:00.000Z',
  revoked_at: null,
};

// The deep-link path auto-checks a well-formed 16-char code.
const CODE = 'ABCD-EFGH-JKMN-PQRS';

describe('VerifyClaim', () => {
  beforeEach(() => verifyMock.mockReset());

  it('renders an active claim as a live green check with the statement only', async () => {
    verifyMock.mockResolvedValue({ ...BASE, status: 'active' });
    render(<VerifyClaim initialCode={CODE} />);

    await waitFor(() => expect(screen.getByText(/checked live just now/i)).toBeInTheDocument());
    expect(screen.getByText('Dana Whitfield is a verified resident of Portland, OR.')).toBeInTheDocument();
    expect(verifyMock).toHaveBeenCalledWith(CODE);
  });

  it('renders no_longer_verified as NOT valid', async () => {
    verifyMock.mockResolvedValue({ ...BASE, status: 'no_longer_verified' });
    render(<VerifyClaim initialCode={CODE} />);

    await waitFor(() => expect(screen.getByText(/no longer a verified resident/i)).toBeInTheDocument());
    expect(screen.getByText(/treat it as not valid/i)).toBeInTheDocument();
  });

  it('renders revoked and expired as genuine-but-dead', async () => {
    verifyMock.mockResolvedValue({ ...BASE, status: 'revoked', revoked_at: '2026-08-22T00:00:00.000Z' });
    const { unmount } = render(<VerifyClaim initialCode={CODE} />);
    await waitFor(() => expect(screen.getByText(/genuine, but revoked/i)).toBeInTheDocument());
    unmount();

    verifyMock.mockResolvedValue({ ...BASE, status: 'expired' });
    render(<VerifyClaim initialCode={CODE} />);
    await waitFor(() => expect(screen.getByText(/genuine, but expired/i)).toBeInTheDocument());
  });

  it('renders an unknown code as no-claim-found without calling anything else', async () => {
    verifyMock.mockResolvedValue({ valid: false });
    render(<VerifyClaim initialCode={CODE} />);

    await waitFor(() => expect(screen.getByText(/no claim found/i)).toBeInTheDocument());
  });

  it('short-circuits malformed codes client-side', async () => {
    render(<VerifyClaim initialCode="TOO-SHORT" />);
    await waitFor(() => expect(screen.getByText(/no claim found/i)).toBeInTheDocument());
    expect(verifyMock).not.toHaveBeenCalled();
  });
});
