import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
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
import Nearby from '../src/app/(app)/app/nearby/page';

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

// Nearby is Pulse | Neighborhood (founder decision 2026-10-20): this page is
// the Neighborhood segment, and Connections moved to the menu.
it.each(['loading', 'error', 'no_place', 'forming', 'growing', 'unlocked'])(
  'shows the Nearby switch on the Neighborhood segment when meter is %s',
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
      await screen.findByText(/couldn't load your neighborhood meter/);
    else if (state === 'no_place')
      await screen.findByText('Add a home for neighborhood context');
    else if (state === 'unlocked')
      await screen.findByText(/Local marketplace and tasks are open/);
    else if (state !== 'loading')
      await screen.findByRole('heading', {
        name: 'Local marketplace and tasks',
      });
    const segments = within(
      screen.getByRole('navigation', { name: 'Nearby' }),
    );
    expect(segments.getByRole('link', { name: 'Pulse' })).toHaveAttribute(
      'href',
      '/app/feed',
    );
    expect(
      segments.getByRole('link', { name: 'Neighborhood' }),
    ).toHaveAttribute('aria-current', 'page');
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
