import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PlaceAddressCalendarData } from '@pantopus/types';
import AddressCalendarCard from '../src/components/place/detail/AddressCalendarCard';

const setPickupDay = jest.fn();
const clearPickupDay = jest.fn();
jest.mock('@pantopus/api', () => ({
  setPickupDay: (...args: unknown[]) => setPickupDay(...args),
  clearPickupDay: (...args: unknown[]) => clearPickupDay(...args),
}));
jest.mock('@/components/ui/toast-store', () => ({ toast: { success: jest.fn() } }));
jest.mock('@/components/archetypes/place', () => ({ IconTile: () => null }));

const initial: PlaceAddressCalendarData = { today: '2026-09-03', upcoming: [], next: null, needs_pickup_day: true, window_days: 14, rule_count: 0 };
const saved: PlaceAddressCalendarData = {
  ...initial, needs_pickup_day: false,
  pickup_schedule: { weekday: 'TH', recycling_frequency: 'biweekly', recycling_next_date: '2026-09-11' },
  upcoming: [{ rule_id: 'home-garbage', kind: 'garbage', title: 'Garbage day', detail: null, date: '2026-09-03', days_until: 0, all_day: true, lead_days: 1, scope: 'home', source: 'Set by your household', source_url: null, confidence: 'official' }],
};
function show(data = initial, homeId: string | null = 'home-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AddressCalendarCard homeId={homeId} data={data} /></QueryClientProvider>);
}
beforeEach(() => {
  jest.clearAllMocks();
  setPickupDay.mockResolvedValue({ calendar: saved });
  clearPickupDay.mockResolvedValue({ calendar: initial });
});

it('requires explicit save and does not invent recycling when unknown', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Thu' }));
  expect(setPickupDay).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
  await screen.findByText('Garbage day');
  expect(setPickupDay).toHaveBeenCalledWith('home-1', { weekday: 'TH', recycling_frequency: 'not_set' });
});

it('requires the actual next recycling date and supports a different weekday', async () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Thu' }));
  fireEvent.change(screen.getByLabelText('Recycling'), { target: { value: 'biweekly' } });
  expect(screen.getByRole('button', { name: 'Save schedule' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Next recycling pickup'), { target: { value: '2026-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
  await screen.findByText('Garbage day');
  expect(setPickupDay).toHaveBeenCalledWith('home-1', { weekday: 'TH', recycling_frequency: 'biweekly', recycling_next_date: '2026-09-11' });
});

it('retains the saved calendar and selections after a failed save, then retries', async () => {
  setPickupDay.mockRejectedValueOnce(new Error('Could not save your pickup schedule'));
  show(saved);
  fireEvent.click(screen.getByRole('button', { name: 'Pickup schedule' }));
  expect(screen.getByLabelText('Next recycling pickup')).toHaveValue('2026-09-11');
  fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Garbage day')).toBeInTheDocument();
  expect(screen.getByLabelText('Next recycling pickup')).toHaveValue('2026-09-11');
  expect(screen.getByRole('button', { name: 'Mon ✓' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(setPickupDay).toHaveBeenCalledTimes(2);
});

it('clears the household schedule only after server confirmation', async () => {
  clearPickupDay.mockRejectedValueOnce(new Error('Could not reset'));
  show(saved);
  fireEvent.click(screen.getByRole('button', { name: 'Pickup schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear household schedule' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Garbage day')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear household schedule' }));
  await waitFor(() => expect(screen.queryByText('Garbage day')).not.toBeInTheDocument());
  expect(clearPickupDay).toHaveBeenCalledWith('home-1');
});

it('limits weekly selection to seven home-calendar dates and resets a stale biweekly choice', () => {
  show(saved);
  fireEvent.click(screen.getByRole('button', { name: 'Pickup schedule' }));
  fireEvent.change(screen.getByLabelText('Recycling'), { target: { value: 'weekly' } });
  const select = screen.getByLabelText('Next recycling pickup') as HTMLSelectElement;
  expect(select).toHaveValue('');
  expect(Array.from(select.options).map((o) => o.value)).toEqual(['', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08', '2026-09-09']);
});

it('does not offer household editing on a public preview', () => {
  show(initial, null);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
