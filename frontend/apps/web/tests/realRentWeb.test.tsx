// ============================================================
// Wave 3 — the Real Rent Benchmark on the web. The invariants:
//
//   * Band D is a hard gate: a locked envelope renders the lock and
//     never reaches for the caller's own report;
//   * `building` is a READING, not an empty state — progress toward
//     the block's own benchmark, with a contribute form attached;
//   * `ready` states the band, the scope, and the sample size plainly,
//     and the viewer's own position as a BAND POSITION only;
//   * contributing is deliberate — the device-local HUD rent draft may
//     prefill the input, but only Save sends it;
//   * a failed save surfaces as a failure and never fakes success.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { PlaceIntelligence, PlaceSection, PlaceRealRentData } from '@pantopus/types';
import MoneyDetail from '@/components/place/detail/MoneyDetail';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  useParams: () => ({}),
  usePathname: () => '/app/place',
}));

const getReportMock = api.realRent.getRentReport as jest.Mock;
const setReportMock = api.realRent.setRentReport as jest.Mock;
const deleteReportMock = api.realRent.deleteRentReport as jest.Mock;
const getWatchMock = api.recordWatch.getRecordWatch as jest.Mock;

/**
 * What a failed request ACTUALLY looks like here: the API client's
 * response interceptor rejects with a plain object carrying the
 * server's message and code — it is not an Error, so any handler that
 * gates on `instanceof Error` drops the message on the floor. Tests
 * must reject with this shape or they pass for the wrong reason.
 */
function rejection(message: string, code?: string, statusCode?: number) {
  return { message, code, statusCode, data: code ? { error: message, code } : undefined };
}

const BUILDING: PlaceRealRentData = {
  state: 'building',
  reports: 4,
  needed: 10,
  scope: null,
  bedrooms: null,
  sample_size: null,
  rent_p25: null,
  rent_median: null,
  rent_p75: null,
  your_rent: null,
  standing: null,
  summary: '4 of 10 verified homes on your block have shared their rent.',
};

const READY: PlaceRealRentData = {
  state: 'ready',
  reports: 11,
  needed: 10,
  scope: 'bedrooms',
  bedrooms: 2,
  sample_size: 11,
  rent_p25: 1950,
  rent_median: 2180,
  rent_p75: 2400,
  your_rent: 2300,
  standing: 'in_band',
  summary: '11 verified 2-bedroom homes on your block pay a median of $2,180/mo.',
};

function section(opts: Partial<PlaceSection>): PlaceSection {
  return {
    id: 'real_rent',
    group: 'money_signals',
    band: 'D',
    access: 'available',
    status: 'ready',
    as_of: null,
    source: 'Pantopus · verified neighbors on your block',
    coverage: 'full',
    unavailable_reason: null,
    data: null,
    ...opts,
  } as PlaceSection;
}

function intel(sections: PlaceSection[], tier: PlaceIntelligence['tier'] = 'T4'): PlaceIntelligence {
  return {
    place: { label: '1421 SE Oak St, Portland', line1: '1421 SE Oak St', city: 'Portland', state: 'OR', postal_code: '97214' },
    tier,
    region_supported: true,
    generated_at: '2026-08-25T00:00:00Z',
    groups: [{ group: 'money_signals', label: 'Money signals', sections }],
  };
}

function renderMoney(sections: PlaceSection[], tier: PlaceIntelligence['tier'] = 'T4') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MoneyDetail intelligence={intel(sections, tier)} homeId="home-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getReportMock.mockReset();
  setReportMock.mockReset();
  deleteReportMock.mockReset();
  getWatchMock.mockReset();
  getWatchMock.mockResolvedValue(null);
  window.localStorage.clear();
});

describe('Real rent — the Band D lock', () => {
  it('renders the lock and never fetches the caller’s own report', () => {
    renderMoney([section({
      access: 'locked',
      status: 'unavailable',
      unavailable_reason: 'Verify your address to see what your block actually pays.',
    })], 'T3');

    expect(screen.getByText('Real rent on your block')).toBeInTheDocument();
    expect(screen.getByText(/Verify your address to see what your block actually pays/)).toBeInTheDocument();
    expect(getReportMock).not.toHaveBeenCalled();
  });
});

describe('Real rent — the building state is the product', () => {
  it('shows the block’s progress and the server’s sentence, not an empty state', async () => {
    getReportMock.mockResolvedValue(null);
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    expect(screen.getByText('4 of 10')).toBeInTheDocument();
    expect(screen.getByText('4 shared')).toBeInTheDocument();
    expect(screen.getByText('10 unlocks the band')).toBeInTheDocument();
    expect(screen.getByText('4 of 10 verified homes on your block have shared their rent.')).toBeInTheDocument();
    // Never an error and never "no data".
    expect(screen.queryByText(/no data/i)).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Share my rent with the block')).toBeInTheDocument());
    expect(screen.getByText(/nothing shows at all until/i)).toBeInTheDocument();
    // The other half of the progress story is the invite, and it has to
    // be reachable — the Founders page is where it lives.
    expect(screen.getByRole('link', { name: /Invite a neighbor from Block founders/i }))
      .toHaveAttribute('href', '/app/place/block');
  });

  it('offers the contribute form with a money input while building', async () => {
    getReportMock.mockResolvedValue(null);
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    await waitFor(() => expect(screen.getByLabelText('Your monthly rent')).toBeInTheDocument());
    expect(screen.getByText('Share my rent with the block')).toBeInTheDocument();
  });
});

describe('Real rent — the ready band', () => {
  it('leads with the median and states the band, the scope, and the sample size', async () => {
    getReportMock.mockResolvedValue({ monthly_rent: 2300, bedrooms: 2, reported_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z' });
    renderMoney([section({ status: 'ready', data: READY })]);

    // The hero is the MEDIAN with its unit — the same figure the
    // server's own sentence leads with, and the same one both mobile
    // clients put at the top of the card.
    expect(screen.getByText('$2,180 / mo')).toBeInTheDocument();
    // The p25–p75 range is the band, directly beneath the hero.
    expect(screen.getByText(/Median on your block · middle half \$1,950 – \$2,400/)).toBeInTheDocument();
    expect(screen.getByText('11 verified 2-bedroom homes on your block')).toBeInTheDocument();
    expect(screen.getByText('11 verified 2-bedroom homes on your block pay a median of $2,180/mo.')).toBeInTheDocument();

    // All three quartiles stay labelled and readable.
    expect(screen.getByText('Lower quarter')).toBeInTheDocument();
    expect(screen.getByText('Median')).toBeInTheDocument();
    expect(screen.getByText('Upper quarter')).toBeInTheDocument();
    expect(screen.getByText('$1,950')).toBeInTheDocument();
    expect(screen.getByText('$2,180')).toBeInTheDocument();
    expect(screen.getByText('$2,400')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('In the band')).toBeInTheDocument());
    expect(screen.getByText('Your rent, shared with the block')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Remove')).toBeInTheDocument();
    // A band position, never a headcount of who pays more or less.
    expect(screen.queryByText(/neighbors pay more/i)).not.toBeInTheDocument();
  });

  // The viewer here is a RENTER holding their own rent up against their
  // block — so paying under the middle half is the good news and paying
  // over it is the actionable signal. This is the opposite reading of
  // the HUD rent_band card above, where being inside the county band is
  // the reassurance; conflating the two is exactly the bug. Both mobile
  // clients score it this way and all three must agree.
  it.each([
    ['below_band', 'Below the band', 'bg-app-success-light'],
    ['in_band', 'In the band', 'bg-app-surface-sunken'],
    ['above_band', 'Above the band', 'bg-app-warning-light'],
  ] as const)('scores %s from the renter’s side: %s', async (standing, label, tone) => {
    getReportMock.mockResolvedValue({ monthly_rent: 2300, bedrooms: 2, reported_at: 'x', updated_at: 'x' });
    renderMoney([section({ status: 'ready', data: { ...READY, standing } })]);

    const chip = await screen.findByText(label);
    expect(chip.className).toContain(tone);
  });

  it('says so when the band had to widen past the viewer’s bedroom count', async () => {
    getReportMock.mockResolvedValue(null);
    renderMoney([section({
      status: 'ready',
      data: { ...READY, scope: 'all_sizes', bedrooms: null, your_rent: null, standing: null },
    })]);

    expect(screen.getByText('11 verified homes of all sizes on your block')).toBeInTheDocument();
    expect(screen.getByText(/covers homes of every size on the block/i)).toBeInTheDocument();
  });
});

describe('Real rent — contributing is deliberate', () => {
  it('sends the entered amount through setRentReport', async () => {
    getReportMock.mockResolvedValue(null);
    setReportMock.mockResolvedValue({ monthly_rent: 2450, bedrooms: 2, reported_at: 'x', updated_at: 'x' });
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    await waitFor(() => expect(screen.getByLabelText('Your monthly rent')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Your monthly rent'), { target: { value: '2450' } });
    fireEvent.click(screen.getByText('Share my rent with the block'));

    await waitFor(() => expect(setReportMock).toHaveBeenCalledWith('home-1', 2450, undefined));
  });

  it('prefills from the device-local rent draft but never uploads it on its own', async () => {
    window.localStorage.setItem('place:rent:home-1', JSON.stringify('2,450'));
    getReportMock.mockResolvedValue(null);
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    const input = await screen.findByLabelText('Your monthly rent') as HTMLInputElement;
    await waitFor(() => expect(input.value).toBe('2,450'));
    expect(screen.getByText(/never left this device/i)).toBeInTheDocument();
    // Prefilled is not shared: nothing goes to the server without the press.
    expect(setReportMock).not.toHaveBeenCalled();
  });

  it('carries the existing bedroom count through an edit so a size is never dropped', async () => {
    getReportMock.mockResolvedValue({ monthly_rent: 2300, bedrooms: 2, reported_at: 'x', updated_at: 'x' });
    setReportMock.mockResolvedValue({ monthly_rent: 2500, bedrooms: 2, reported_at: 'x', updated_at: 'x' });
    renderMoney([section({ status: 'ready', data: READY })]);

    await waitFor(() => expect(screen.getByText('Edit')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Edit'));

    const input = await screen.findByLabelText('Your monthly rent');
    fireEvent.change(input, { target: { value: '2500' } });
    fireEvent.click(screen.getByText('Update my rent'));

    await waitFor(() => expect(setReportMock).toHaveBeenCalledWith('home-1', 2500, 2));
  });

  it('withdraws the contribution through deleteRentReport', async () => {
    getReportMock.mockResolvedValue({ monthly_rent: 2300, bedrooms: 2, reported_at: 'x', updated_at: 'x' });
    deleteReportMock.mockResolvedValue(undefined);
    renderMoney([section({ status: 'ready', data: READY })]);

    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => expect(deleteReportMock).toHaveBeenCalledWith('home-1'));
  });
});

describe('Real rent — failures stay failures', () => {
  it('surfaces a save failure instead of showing the amount as shared', async () => {
    getReportMock.mockResolvedValue(null);
    // The API client's interceptor rejects with a PLAIN OBJECT, never an
    // Error — rejecting with `new Error` here would let an
    // `instanceof Error` message read pass a test it fails in the app.
    setReportMock.mockRejectedValue(rejection('That monthly rent looks off — enter the amount you pay each month.', 'BAD_AMOUNT', 400));
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    await waitFor(() => expect(screen.getByLabelText('Your monthly rent')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Your monthly rent'), { target: { value: '9' } });
    fireEvent.click(screen.getByText('Share my rent with the block'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/nothing was shared/i);
    expect(alert).toHaveTextContent(/That monthly rent looks off/);
    // The form is still the form — no "shared with the block" summary.
    expect(screen.getByText('Share my rent with the block')).toBeInTheDocument();
    expect(screen.queryByText('Your rent, shared with the block')).not.toBeInTheDocument();
  });

  it('keeps the typed amount and the server’s reason when the save is refused', async () => {
    getReportMock.mockResolvedValue(null);
    setReportMock.mockRejectedValue(rejection(
      'Verify your address to add your rent — a benchmark is only real if the people in it live there.',
      'VERIFICATION_REQUIRED',
      403,
    ));
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    const input = await screen.findByLabelText('Your monthly rent') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2450' } });
    fireEvent.click(screen.getByText('Share my rent with the block'));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Verify your address to add your rent/);
    // The typed value survives the failure — nothing to retype.
    expect(input.value).toBe('2,450');
  });

  it('never impersonates "hasn’t reported" when the own-report read fails', async () => {
    getReportMock.mockRejectedValue(rejection('offline'));
    renderMoney([section({ status: 'partial', data: BUILDING })]);

    await waitFor(() => expect(screen.getByText(/Couldn't load whether you've shared your rent/i)).toBeInTheDocument());
    expect(screen.queryByText('Share my rent with the block')).not.toBeInTheDocument();
  });

  it('keeps the block band on screen when only the own-report read fails', async () => {
    getReportMock.mockRejectedValue(rejection('offline'));
    renderMoney([section({ status: 'ready', data: { ...READY, your_rent: null, standing: null } })]);

    await waitFor(() => expect(screen.getByText(/Couldn't load whether you've shared your rent/i)).toBeInTheDocument());
    // A secondary read failing must not discard the benchmark itself.
    expect(screen.getByText('$2,180 / mo')).toBeInTheDocument();
    expect(screen.getByText(/middle half \$1,950 – \$2,400/)).toBeInTheDocument();
    expect(screen.getByText('11 verified 2-bedroom homes on your block pay a median of $2,180/mo.')).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('degrades to the unavailable card when the home has no coordinates', () => {
    renderMoney([section({
      status: 'unavailable',
      unavailable_reason: 'We could not place this home on a block yet.',
    })]);

    expect(screen.getByText(/could not place this home on a block yet/i)).toBeInTheDocument();
    expect(screen.queryByText('Share my rent with the block')).not.toBeInTheDocument();
    expect(getReportMock).not.toHaveBeenCalled();
  });

  it('renders the error envelope as a retryable failure, never as an empty block', () => {
    renderMoney([section({ status: 'error' })]);

    expect(screen.getByText("Couldn't load this")).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
    // An error is not "your block has no rents" and not a contribute prompt.
    expect(screen.queryByText('Share my rent with the block')).not.toBeInTheDocument();
    expect(getReportMock).not.toHaveBeenCalled();
  });
});

// Regression: indexing the standing map directly threw on an
// unrecognized value and took down the WHOLE Money Signals page. A new
// server vocabulary word must degrade to "no chip", never a blank page.
describe('an unknown standing value degrades instead of crashing', () => {
  it('renders the band with no standing chip', async () => {
    getReportMock.mockResolvedValue({ monthly_rent: 2300, bedrooms: 2, reported_at: 'x', updated_at: 'x' });
    renderMoney([section({ data: { ...READY, standing: 'sideways_band' } as never })]);

    // The page still renders: the band survives, the chip is simply absent.
    await waitFor(() => expect(screen.getAllByText(/\$2,180/).length).toBeGreaterThan(0));
    expect(screen.queryByText('Below the band')).not.toBeInTheDocument();
    expect(screen.queryByText('Above the band')).not.toBeInTheDocument();
    expect(screen.queryByText('In the band')).not.toBeInTheDocument();
  });
});
