// ============================================================
// Phase 7 — the signed-out /start funnel. The acquisition front door
// previously had zero coverage. These exercise the funnel's states:
// hero gating, the address autocomplete, the T0 preview (free subset
// live + locked teasers + wall), the non-US branch, and the lookup
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

const READY_PREVIEW = {
  status: 'ready',
  tier: 'preview',
  region: 'US',
  place: { address: '4080 NE Tacoma Ct', city: 'Camas', state: 'WA', zipcode: '98607' },
  free: {
    flood: { status: 'ready', zone: 'X', description: 'Minimal flood risk', source: 'FEMA' },
    density: { status: 'ready', bucket: 'forming', label: 'Your block is starting to form', source: 'Pantopus' },
    area: { status: 'ready', median_year_built: 2004, median_home_value: 646200, note: '', source: 'Census' },
  },
  locked: [
    { id: 'daily', group: 'today', title: 'Daily conditions', band: 'A', unlock: 'account', reason: 'Create an account for daily weather.' },
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
  it('shows the free subset, locked teasers, and the wall after lookup', async () => {
    mockPreview.mockResolvedValue(READY_PREVIEW);
    renderFunnel();
    await selectAddressAndSubmit();

    // Free subset is live…
    expect(await screen.findByText(/zone x/i)).toBeInTheDocument();
    expect(screen.getByText(/your block is starting to form/i)).toBeInTheDocument();
    // …locked sections tease with the account CTA…
    expect(screen.getByText('Daily conditions')).toBeInTheDocument();
    // …and the wall is pinned underneath.
    expect(screen.getByText(/create a free account to save this place/i)).toBeInTheDocument();

    // The wall routes to register and stashes the pending place. (Both the
    // locked-card CTA and the wall button say "Create account" — the wall
    // bar's is last in the document.)
    const ctas = screen.getAllByRole('button', { name: /create account/i });
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
