// ============================================================
// Wave 2b — the rate watch on Money signals. The invariants:
// unverified viewers get the only-the-proven-resident gate, a set
// watch shows both averages with the delta chip, an open refi window
// reads as facts (never "refinance"), and no watch shows the form.
// ============================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { PlaceIntelligence } from '@pantopus/types';
import MoneyDetail from '@/components/place/detail/MoneyDetail';
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

const getWatchMock = api.recordWatch.getRecordWatch as jest.Mock;
const setWatchMock = api.recordWatch.setRecordWatch as jest.Mock;
const deleteWatchMock = api.recordWatch.deleteRecordWatch as jest.Mock;

/**
 * The API client's interceptor rejects with a PLAIN OBJECT carrying the
 * server's message and code — never an `Error`. Rejecting with
 * `new Error(...)` here would let an `instanceof Error` handler pass a
 * test it fails in the app, so the failure tests use the real shape.
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

function renderMoney(tier: PlaceIntelligence['tier'] = 'T4') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MoneyDetail intelligence={intel(tier)} homeId="home-1" />
    </QueryClientProvider>,
  );
}

const SET_WATCH = {
  id: 'w1', home_id: 'home-1', loan_recorded_month: '2023-03', baseline_rate: 6.6,
  created_at: '2026-08-01T00:00:00.000Z',
  evaluation: { baseline_rate: 6.6, current_rate: 5.7, current_as_of: '2026-08-20', delta_pp: -0.9, refi_window: true },
};

describe('RateWatchSection', () => {
  beforeEach(() => {
    getWatchMock.mockReset();
    setWatchMock.mockReset();
    deleteWatchMock.mockReset();
    mockToast.error.mockReset();
    mockToast.success.mockReset();
  });

  it('gates unverified viewers with the proven-resident promise, without fetching', async () => {
    renderMoney('T3');
    expect(screen.getByText(/only the proven resident can watch a home/i)).toBeInTheDocument();
    expect(getWatchMock).not.toHaveBeenCalled();
  });

  it('shows the form when no watch exists', async () => {
    getWatchMock.mockResolvedValue(null);
    renderMoney('T4');
    await waitFor(() => expect(screen.getByText(/Watch rates against your loan/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/month your loan was recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/not refinancing advice/i)).toBeInTheDocument();
  });

  it('shows both averages and the open-window chip as facts, never advice', async () => {
    getWatchMock.mockResolvedValue(SET_WATCH);
    renderMoney('T4');

    await waitFor(() => expect(screen.getByText('0.90pp below your month')).toBeInTheDocument());
    expect(screen.getByText('6.60%')).toBeInTheDocument();
    expect(screen.getByText('5.70%')).toBeInTheDocument();
    expect(screen.getAllByText(/March 2023/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/you should refinance/i)).not.toBeInTheDocument();
  });
});

// The route refuses with sentences the resident has to read — BAD_MONTH
// and MONTH_OUT_OF_RANGE both say what to type instead. The API client
// rejects with a PLAIN OBJECT, so a handler gated on `instanceof Error`
// reads false and swallows every one of them; these tests reject with
// the real shape so they fail against that bug.
describe('RateWatchSection — the server’s refusal reaches the resident', () => {
  beforeEach(() => {
    getWatchMock.mockReset();
    setWatchMock.mockReset();
    deleteWatchMock.mockReset();
    mockToast.error.mockReset();
    mockToast.success.mockReset();
  });

  it.each([
    ['That month isn’t a month we can read — use the month your loan was recorded.', 'BAD_MONTH', 400],
    ['That month is outside the range we hold weekly averages for.', 'MONTH_OUT_OF_RANGE', 400],
  ])('surfaces a save refusal verbatim (%s)', async (message, code, statusCode) => {
    getWatchMock.mockResolvedValue(null);
    setWatchMock.mockRejectedValue(rejection(message, code, statusCode));
    renderMoney('T4');

    const input = await screen.findByLabelText(/month your loan was recorded/i);
    fireEvent.change(input, { target: { value: '2023-03' } });
    fireEvent.click(screen.getByText('Start watching'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith(message));
    expect(mockToast.error).not.toHaveBeenCalledWith('Could not save the watch.');
  });

  it('surfaces a remove refusal verbatim', async () => {
    getWatchMock.mockResolvedValue(SET_WATCH);
    deleteWatchMock.mockRejectedValue(rejection('This watch is no longer on this home.', 'NOT_FOUND', 404));
    renderMoney('T4');

    await waitFor(() => expect(screen.getByText('Remove')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Remove'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('This watch is no longer on this home.'));
    expect(mockToast.error).not.toHaveBeenCalledWith('Could not remove the watch.');
  });

  it('falls back to the generic line only when the failure carries no message', async () => {
    getWatchMock.mockResolvedValue(null);
    setWatchMock.mockRejectedValue({});
    renderMoney('T4');

    const input = await screen.findByLabelText(/month your loan was recorded/i);
    fireEvent.change(input, { target: { value: '2023-03' } });
    fireEvent.click(screen.getByText('Start watching'));

    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Could not save the watch.'));
  });
});
