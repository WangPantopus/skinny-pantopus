// ============================================================
// Wave 1, #3 — the mailbox reality check on the Identity page.
// Invariants: verdict + findings render with their severities, the
// physical leg reads per-caller (nudge when the postcard test hasn't
// run), and "nothing on file" shows as not-checked rather than a pass.
// ============================================================

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { PlaceIntelligence } from '@pantopus/types';
import IdentityDetail from '@/components/place/detail/IdentityDetail';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => '/app/place',
}));

const getCheckMock = api.mailboxCheck.getMailboxCheck as jest.Mock;
const listClaimsMock = api.residencyClaims.listResidencyClaims as jest.Mock;
const listLettersMock = api.residencyLetters.listResidencyLetters as jest.Mock;

function intel(tier: PlaceIntelligence['tier']): PlaceIntelligence {
  return {
    tier,
    place: { label: '1421 SE Oak St', line1: '1421 SE Oak St', city: 'Portland', state: 'OR', postal_code: '97214' },
    groups: [],
  } as unknown as PlaceIntelligence;
}

function renderIdentity(tier: PlaceIntelligence['tier'] = 'T4') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <IdentityDetail intelligence={intel(tier)} homeId="home-1" residentName="Riley Chen" />
    </QueryClientProvider>,
  );
}

describe('MailboxCheckCard', () => {
  beforeEach(() => {
    getCheckMock.mockReset();
    listClaimsMock.mockResolvedValue([]);
    listLettersMock.mockResolvedValue([]);
  });

  it('renders the verdict and findings with the physical leg', async () => {
    getCheckMock.mockResolvedValue({
      verdict: 'needs_attention',
      findings: [
        { severity: 'attention', title: 'A unit number is missing', detail: 'USPS confirms the building but expects a unit.' },
        { severity: 'attention', title: 'USPS lists this address as vacant', detail: 'Ask your carrier to clear it.' },
      ],
      physical: { status: 'proven', title: 'Mail physically reaches this mailbox', detail: 'A postcard was delivered here.' },
      checked_at: '2026-08-01T00:00:00.000Z',
    });
    renderIdentity('T4');

    await waitFor(() => expect(screen.getByText('Mailbox reality check')).toBeInTheDocument());
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
    expect(screen.getByText('A unit number is missing')).toBeInTheDocument();
    expect(screen.getByText('USPS lists this address as vacant')).toBeInTheDocument();
    expect(screen.getByText('Mail physically reaches this mailbox')).toBeInTheDocument();
  });

  it('shows the physical-leg verify nudge below T4, and unknown is not a pass', async () => {
    getCheckMock.mockResolvedValue({
      verdict: 'unknown',
      findings: [{ severity: 'info', title: 'No postal check on file', detail: 'Not run yet.' }],
      physical: { status: 'not_run', title: 'The physical test hasn’t run', detail: 'Verifying mails a real postcard here.' },
      checked_at: null,
    });
    renderIdentity('T3');

    await waitFor(() => expect(screen.getByText('Mailbox reality check')).toBeInTheDocument());
    expect(screen.getByText('Not checked yet')).toBeInTheDocument();
    expect(screen.getByText(/physical test hasn’t run/)).toBeInTheDocument();
  });
});


describe('existing residency letter cards', () => {
  test.each([
    ['expired', 'Expired', false],
    ['revoked', 'Revoked', false],
    ['unrecognized', 'Unavailable', false],
    ['issued', 'Active', true],
  ])('%s letters show %s without changing the card layout', async (status, label, active) => {
    getCheckMock.mockResolvedValue({ verdict: 'unknown', findings: [], physical: { status: 'not_run', title: 'Not run', detail: '' }, checked_at: null });
    listClaimsMock.mockResolvedValue([]);
    listLettersMock.mockResolvedValue([{
      id: 'letter-1', home_id: 'home-1', status, purpose: 'Library card',
      resident_name: 'Riley Chen', address: { line1: '123 Test St', city: 'Portland', state: 'OR', zipcode: '97201' },
      letter_code: 'ABCD-EFGH-JKLM-NPQR', verify_url: 'https://example.test/verify',
      issued_at: '2026-01-01T00:00:00Z', expires_at: active ? '2099-04-01T00:00:00Z' : '2026-04-01T00:00:00Z', revoked_at: null, pdf_sha256: 'synthetic',
    }]);
    renderIdentity();
    fireEvent.click(screen.getByRole('button', { name: /Generate a verified residency letter/ }));
    await screen.findByText('ABCD-EFGH-JKLM-NPQR');
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
    if (active) {
      expect(screen.getByRole('button', { name: 'Mail' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Revoke' })).toBeEnabled();
    } else {
      expect(screen.getByRole('button', { name: 'Mail' })).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument();
    }
  });
});
