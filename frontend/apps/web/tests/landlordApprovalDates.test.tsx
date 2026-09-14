import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { post } from '../../../packages/api/src/client';
import { approveLease, type TenantRequest } from '../../../packages/api/src/endpoints/landlord';
import RequestsTab from '@/components/landlord/RequestsTab';

jest.mock('../../../packages/api/src/client', () => ({ post: jest.fn() }));
jest.mock('@pantopus/api', () => ({
  landlord: jest.requireActual('../../../packages/api/src/endpoints/landlord'),
}));

beforeEach(() => { jest.clearAllMocks(); jest.mocked(post).mockResolvedValue({}); });

test('existing SDK callers can omit reviewed dates', async () => {
  await approveLease('lease-1', 'authority-1');
  expect(post).toHaveBeenCalledWith('/api/v1/landlord/lease/lease-1/approve', { authority_id: 'authority-1' });
});
function openApproval(endAt: string | null = '2027-09-01', startAt = '2026-09-01') {
  const refresh = jest.fn();
  const request = { id: 'lease-1', home_id: 'home-1', start_at: startAt,
    end_at: endAt, state: 'pending', metadata: {}, primary_resident: { name: 'Synthetic Tenant' } } as TenantRequest;
  const view = render(<RequestsTab homeId="home-1" authorityId="authority-1" requests={[request]} onRefresh={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  const dates = view.container.querySelectorAll('input[type="date"]');
  return { refresh, dates };
}

test('sends the edited lease dates through the existing SDK', async () => {
  const { dates, refresh } = openApproval();
  fireEvent.change(dates[0], { target: { value: '2026-10-01' } });
  fireEvent.change(dates[1], { target: { value: '2027-09-30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith('/api/v1/landlord/lease/lease-1/approve', {
    authority_id: 'authority-1', start_at: '2026-10-01', end_at: '2027-09-30',
  });
});

test('clearing the existing end date sends an explicit null', async () => {
  const { dates, refresh } = openApproval();
  fireEvent.change(dates[1], { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith('/api/v1/landlord/lease/lease-1/approve', {
    authority_id: 'authority-1', start_at: '2026-09-01', end_at: null,
  });
});

test('unchanged dates preserve their stored times, including a valid same-day lease', async () => {
  const { refresh } = openApproval('2026-09-01T17:00:00Z', '2026-09-01T09:00:00Z');
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(post).toHaveBeenCalledWith('/api/v1/landlord/lease/lease-1/approve', {
    authority_id: 'authority-1', start_at: '2026-09-01T09:00:00Z', end_at: '2026-09-01T17:00:00Z',
  });
});

test.each([
  ['', '', 'Enter a start date.'],
  ['2026-10-01', '2026-09-30', 'End date must be after start date.'],
  ['2026-10-01', '2026-10-01', 'End date must be after start date.'],
])('keeps an invalid date range open without submitting (%s, %s)', (start, end, error) => {
  const { dates, refresh } = openApproval();
  fireEvent.change(dates[0], { target: { value: start } });
  fireEvent.change(dates[1], { target: { value: end } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  expect(screen.getByText(error)).toBeVisible();
  expect(post).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(screen.getByText('Confirm Lease Dates')).toBeVisible();
});

test.each([new Error('Could not save lease dates.'), { message: 'Could not save lease dates.', statusCode: 503 }])(
  'a failed save retains the edited dates for retry (%j)', async (failure) => {
  jest.mocked(post).mockRejectedValueOnce(failure);
  const { dates, refresh } = openApproval();
  fireEvent.change(dates[0], { target: { value: '2026-10-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  expect(await screen.findByText('Could not save lease dates.')).toBeVisible();
  expect(dates[0]).toHaveValue('2026-10-01');
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(jest.mocked(post).mock.calls[1]).toEqual(jest.mocked(post).mock.calls[0]);
});

test('canceling the denial prompt does not cancel the tenant lease', async () => {
  openApproval();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  const prompt = jest.spyOn(window, 'prompt').mockReturnValue(null);
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(post).not.toHaveBeenCalled();
  } finally { prompt.mockRestore(); }
});
