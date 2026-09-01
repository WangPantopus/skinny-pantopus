// ============================================================
// Phase 7 — the signed-out /start funnel. The acquisition front door
// previously had zero coverage. These exercise the funnel's states:
// hero gating, the address autocomplete, the T0 preview (aha card +
// every free layer + the Band-B locked card + the wall), the non-US branch, and the lookup
// error path. Fetching is mocked; this is the client behavior.
// ============================================================

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/start',
}));

const mockAutocomplete = jest.fn();
const mockPreview = jest.fn();
jest.mock('@pantopus/api', () => ({
  geo: { autocompleteWithAbort: (...args: unknown[]) => mockAutocomplete(...args) },
  place: { getPublicPlacePreview: (...args: unknown[]) => mockPreview(...args) },
  // Wedge Phase 1 funnel beacons — fire-and-forget from the funnel.
  recordFunnelEvent: jest.fn(),
  getFunnelAnonId: jest.fn(() => 'anon-test'),
}));

jest.mock('@/lib/publicShare', () => ({
  getStoreDownloadCta: () => ({ href: 'https://example.com/app', label: 'Get the app' }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StartFunnel from '@/components/place/StartFunnel';
import AddressAutocomplete from '@/components/place/AddressAutocomplete';

function renderFunnel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <StartFunnel />
    </QueryClientProvider>,
  );
}

const SUGGESTION = {
  suggestion_id: 's1',
  primary_text: '4080 NE Tacoma Ct',
  secondary_text: 'Camas, WA 98607',
  label: '4080 NE Tacoma Ct, Camas, WA 98607',
  center: { lat: 45.6087, lng: -122.389 },
  kind: 'address',
};

// Wedge Phase 1.5 (D1): the preview carries every free Band-A layer as
// section envelopes plus one aha card; only Band B stays locked.
const section = (id: string, group: string, data: unknown) => ({
  id, group, band: 'A', access: 'available', status: 'ready',
  as_of: '2026-09-01T14:00:00.000Z', source: 'test', coverage: 'full', unavailable_reason: null, data,
});
const READY_PREVIEW = {
  status: 'ready',
  tier: 'preview',
  region: 'US',
  place: { address: '4080 NE Tacoma Ct', city: 'Camas', state: 'WA', zipcode: '98607' },
  free: {
    flood: { status: 'ready', zone: 'X', description: 'Minimal flood risk', source: 'FEMA' },
    density: { status: 'ready', bucket: 'none', label: 'Founding Neighbor slots are open here', source: 'Pantopus' },
    area: { status: 'ready', median_year_built: 2004, median_home_value: 646200, note: '', source: 'Census' },
  },
  aha: {
    section_id: 'wildfire',
    tone: 'alert',
    grade: 'High',
    headline: 'High wildfire hazard around this address',
    detail: 'High wildfire hazard potential for the vegetation around this point.',
    follow_up: 'Claim it to get smoke-day and burn-ban alerts every morning.',
  },
  sections: [
    section('flood', 'risk_readiness', { zone: 'X', zone_label: 'Zone X', risk_level: 'minimal', in_sfha: false, insurance_required: false, plain_meaning: 'Minimal flood risk' }),
    section('wildfire', 'risk_readiness', { hazard_class: 4, hazard_label: 'High', burnable: true, summary: 'High wildfire hazard potential.', disclaimer: '' }),
    section('block_density', 'your_block', { bucket: 'none', label: 'Founding Neighbor slots are open here' }),
  ],
  locked: [
    { id: 'home_details', group: 'your_home', title: 'Home details & value', band: 'B', unlock: 'claim', reason: "Claim this address to see the home's exact record and value." },
  ],
  disclaimer: 'A free, one-time look.',
};

async function selectAddressAndSubmit() {
  mockAutocomplete.mockResolvedValue({ suggestions: [SUGGESTION] });
  const input = screen.getByPlaceholderText(/enter your address/i);
  fireEvent.change(input, { target: { value: '4080 NE Tacoma' } });
  // Debounced lookup → suggestion appears.
  const option = await screen.findByText('4080 NE Tacoma Ct');
  fireEvent.mouseDown(option);
  fireEvent.click(screen.getByRole('button', { name: /see your place/i }));
}

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
});

describe('StartFunnel — hero', () => {
  it('renders the hero with the CTA disabled until an address is selected', () => {
    renderFunnel();
    expect(screen.getByText(/see what's true about your address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /see your place/i })).toBeDisabled();
  });
});

describe('StartFunnel — T0 preview', () => {
  it('shows the aha card, the free layers, the one locked layer, the promise, and the wall', async () => {
    mockPreview.mockResolvedValue(READY_PREVIEW);
    renderFunnel();
    await selectAddressAndSubmit();

    // The aha card leads…
    expect(await screen.findByText(/high wildfire hazard around this address/i)).toBeInTheDocument();
    // …the free layers render through the dashboard's section cards…
    expect(screen.getByText(/minimal risk/i)).toBeInTheDocument();
    // …the density card never shows a zero…
    expect(screen.getByText(/founding neighbor slots are open here/i)).toBeInTheDocument();
    // …only Band B is locked…
    expect(screen.getByText('Home details & value')).toBeInTheDocument();
    // …the privacy promise sits above the wall…
    expect(screen.getByText(/never a house number or unit/i)).toBeInTheDocument();
    // …and the wall is pinned underneath.
    expect(screen.getByText(/this address has one page\. claim it, free\./i)).toBeInTheDocument();

    // The wall routes to register and stashes the pending place. (The
    // wall bar's button is last in the document.)
    const ctas = screen.getAllByRole('button', { name: /^claim it$/i });
    fireEvent.click(ctas[ctas.length - 1]);
    expect(push).toHaveBeenCalledWith(expect.stringContaining('/register'));
    expect(sessionStorage.length).toBeGreaterThan(0);
  });

  it('renders the coming-to-your-region state for non-US addresses', async () => {
    mockPreview.mockResolvedValue({ status: 'unsupported_region', tier: 'preview', region: null, message: 'US only' });
    renderFunnel();
    await selectAddressAndSubmit();
    expect(await screen.findByText(/u\.s\.-only for now/i)).toBeInTheDocument();
  });

  it('offers a retry when the lookup fails', async () => {
    mockPreview.mockRejectedValue(new Error('boom'));
    renderFunnel();
    await selectAddressAndSubmit();
    expect(await screen.findByText(/couldn't look up that address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('AddressAutocomplete', () => {
  it('debounces, lists suggestions, and supports keyboard selection', async () => {
    mockAutocomplete.mockResolvedValue({ suggestions: [SUGGESTION] });
    const onSelect = jest.fn();
    render(<AddressAutocomplete onSelect={onSelect} onClear={jest.fn()} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '4080' } });
    await screen.findByText('4080 NE Tacoma Ct');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 45.6087, longitude: -122.389 }),
      ),
    );
  });

  it('clears the selection when the user edits the text again', async () => {
    mockAutocomplete.mockResolvedValue({ suggestions: [SUGGESTION] });
    const onSelect = jest.fn();
    const onClear = jest.fn();
    render(<AddressAutocomplete onSelect={onSelect} onClear={onClear} />);

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '4080' } });
    const option = await screen.findByText('4080 NE Tacoma Ct');
    fireEvent.mouseDown(option);
    expect(onSelect).toHaveBeenCalled();

    await act(async () => {
      fireEvent.change(input, { target: { value: '4080 NE' } });
    });
    expect(onClear).toHaveBeenCalled();
  });
});
