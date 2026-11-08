import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const push = jest.fn();
const meter = jest.fn();
const cells = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('@pantopus/api', () => ({
  getNeighborhoodMeter: () => meter(),
  getNeighborhoodCells: () => cells(),
}));
import Nearby from '../src/app/(site)/(app)/app/nearby/page';

function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Nearby />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  cells.mockResolvedValue({ state: 'no_place' });
});

// "Verified homes nearby" (founder decision 2026-11-07): the Nearby tab's
// Neighborhood segment until then, now a page opened from Place with a back
// link there. Connections stays in the menu.
it.each(['loading', 'error', 'no_place', 'forming', 'growing', 'unlocked'])(
  'shows the Verified homes nearby header when meter is %s',
  async (state) => {
    if (state === 'loading') meter.mockReturnValue(new Promise(() => {}));
    else if (state === 'error') meter.mockRejectedValue(new Error('offline'));
    else
      meter.mockResolvedValue({
        state,
        verified_count: state === 'forming' ? null : 12,
        threshold: 24,
        k_anon_min: 10,
        unlocked: state === 'unlocked',
      });
    show();
    await waitFor(() => expect(meter).toHaveBeenCalled());
    if (state === 'error')
      await screen.findByText(/couldn't load verified homes nearby/);
    else if (state === 'no_place')
      await screen.findByText('Add a home to see verified homes nearby');
    else if (state === 'unlocked')
      await screen.findByText(/Local marketplace and tasks are open/);
    else if (state !== 'loading')
      await screen.findByRole('heading', {
        name: 'Local marketplace and tasks',
      });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Verified homes nearby' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Back to Place' }),
    ).toHaveAttribute('href', '/app/place');
    expect(
      screen.queryByRole('navigation', { name: 'Nearby' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Social discovery' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Connections/ }),
    ).not.toBeInTheDocument();
    if (state === 'forming') {
      expect(screen.getByRole('progressbar')).not.toHaveAttribute(
        'aria-valuenow',
      );
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuetext',
        'Fewer than 10 verified households',
      );
      expect(
        screen.queryByRole('button', { name: /^Marketplace/ }),
      ).not.toBeInTheDocument();
    }
    if (state === 'unlocked') {
      fireEvent.click(screen.getByRole('button', { name: /^Marketplace/ }));
      expect(push).toHaveBeenLastCalledWith('/app/marketplace');
    }
  },
);
