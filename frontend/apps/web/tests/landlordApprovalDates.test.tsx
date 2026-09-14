import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { get, post } from '../../../packages/api/src/client';
import { approveLease, type TenantRequest } from '../../../packages/api/src/endpoints/landlord';
import RequestsTab from '@/components/landlord/RequestsTab';
import PropertyDetail from '@/components/landlord/PropertyDetail';
import LeasesTab from '@/components/landlord/LeasesTab';
import LandlordVerificationFlow from '@/components/home/LandlordVerificationFlow';
import VerificationCenter from '@/components/home/VerificationCenter';
import { confirmStore } from '@/components/ui/confirm-store';
import VerifyLandlordDetailsPage from '@/app/(app)/app/homes/[id]/verify-landlord/details/page';
import { toast } from '@/components/ui/toast-store';

const mockPush = jest.fn();

jest.mock('../../../packages/api/src/client', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@pantopus/api', () => ({
  landlord: jest.requireActual('../../../packages/api/src/endpoints/landlord'),
  tenant: jest.requireActual('../../../packages/api/src/endpoints/tenant'),
  onTokenChange: () => () => {},
  getAuthToken: () => 'synthetic-fixture',
  AUTH_SESSION_CHANGE_KEY: 'pantopus_auth_session_change',
}));

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }), useParams: () => ({ id: 'home-1' }), useSearchParams: () => new URLSearchParams('tab=requests') }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { error: jest.fn() } }));
jest.mock('@/components/home/useHomePermissions', () => ({ useHomePermissions: () => ({ access: null, reload: jest.fn() }) }));

beforeEach(() => { jest.clearAllMocks(); jest.mocked(post).mockResolvedValue({}); });

test('existing SDK callers can omit reviewed dates', async () => {
  await approveLease('lease-1', 'authority-1');
  expect(post).toHaveBeenCalledWith('/api/v1/landlord/lease/lease-1/approve', { authority_id: 'authority-1' });
});
function openApproval(endAt: string | null = '2027-09-01', startAt = '2026-09-01') {
  const refresh = jest.fn();
  const request = { id: 'lease-1', home_id: 'home-1', start_at: startAt,
    end_at: endAt, state: 'pending', metadata: {}, primary_resident: { name: 'Synthetic Tenant' } } as TenantRequest;
  const view = render(<RequestsTab homeId="home-1" authorityId="authority-1" requests={[request]} onRefresh={refresh} isCurrent={() => true} />);
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


test('existing tenant error view reports the SDK error without claiming no landlord', async () => {
  jest.mocked(get).mockRejectedValue({ message: 'Status temporarily unavailable' });
  render(<LandlordVerificationFlow homeId="home-1" />);
  expect(await screen.findByText('Status temporarily unavailable')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
});

test('existing verification entry does not treat a failed status read as no landlord', async () => {
  jest.mocked(get).mockRejectedValue({ message: 'Status temporarily unavailable' });
  render(<VerificationCenter homeId="home-1" />);
  expect(await screen.findByText('Status temporarily unavailable')).toBeTruthy();
});

test('approved tenant view displays the reviewed calendar date without promising full access', async () => {
  jest.mocked(get).mockResolvedValue({ home_id: 'home-1', landlord: { has_landlord: true }, lease: {
    state: 'active', lease: { id: 'lease-1', start_at: '2099-10-01T00:00:00Z', end_at: null, state: 'active' },
  } });
  render(<LandlordVerificationFlow homeId="home-1" />);
  expect(await screen.findByText('October 1, 2099')).toBeTruthy();
  expect(screen.getByText('Lease Approved')).toBeTruthy();
  expect(screen.queryByText(/You now have full access/)).toBeNull();
});


test('request form recovers its own saved intent after a lost reply', async () => {
  jest.mocked(get).mockResolvedValueOnce({ home_id: 'home-1', request_context: { home_id: 'home-1', actor_id: 'tenant-1', lease_id: null, lease_state: null }, landlord: { has_landlord: true }, lease: { state: 'none', lease: null } })
    .mockResolvedValue({ home_id: 'home-1', request_context: { home_id: 'home-1', actor_id: 'tenant-1', lease_id: 'lease-1', lease_state: 'pending' }, landlord: { has_landlord: true }, lease: { state: 'pending',
      lease: { id: 'lease-1', state: 'pending', start_at: '2026-10-01', created_at: '2026-09-01', metadata: { message: null } } } });
  jest.mocked(post).mockRejectedValueOnce({ message: 'Connection interrupted' });
  render(<LandlordVerificationFlow homeId="home-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Request Approval' }));
  expect(await screen.findByText('Waiting for approval')).toBeTruthy();
  expect(post).toHaveBeenCalledTimes(1);
});

test('request form retains its edits when a lost reply cannot be resolved', async () => {
  jest.mocked(get).mockResolvedValueOnce({ home_id: 'home-1', request_context: { home_id: 'home-1', actor_id: 'tenant-1', lease_id: null, lease_state: null }, landlord: { has_landlord: true }, lease: { state: 'none', lease: null } })
    .mockRejectedValue({ message: 'Status unavailable' });
  jest.mocked(post).mockRejectedValueOnce({ message: 'Connection interrupted' });
  const { container } = render(<LandlordVerificationFlow homeId="home-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add a message or move-in date (optional)' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep my message' } });
  const date = container.querySelector('input[type=date]') as HTMLInputElement;
  fireEvent.change(date, { target: { value: '2099-10-01' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Request Approval' }));
  expect(await screen.findByText('Connection interrupted')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Request Approval' })).toBeTruthy();
  expect(screen.getByRole('textbox')).toHaveValue('Keep my message');
  expect(date.value).toBe('2099-10-01');
  expect(post).toHaveBeenCalledTimes(1);
});


function deferredTenantStatus() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(done => { resolve = done; });
  return { promise, resolve };
}
const pendingTenantStatus = (homeId: string, message: string) => ({ home_id: homeId, landlord: { has_landlord: true },
  lease: { state: 'pending', lease: { id: 'lease-1', state: 'pending', start_at: '2026-10-01', created_at: '2026-09-01', metadata: { message } } } });

test('late status for the previous Home cannot replace the selected Home request', async () => {
  const old = deferredTenantStatus();
  jest.mocked(get).mockReset().mockReturnValueOnce(old.promise).mockResolvedValue(pendingTenantStatus('home-b', 'Current Home request'));
  const view = render(<LandlordVerificationFlow homeId="home-a" />);
  view.rerender(<LandlordVerificationFlow homeId="home-b" />);
  expect(await screen.findByText(/Current Home request/)).toBeTruthy();
  await act(async () => old.resolve(pendingTenantStatus('home-a', 'Previous Home private request')));
  expect(screen.queryByText(/Previous Home private request/)).toBeNull();
  expect(screen.getByText(/Current Home request/)).toBeTruthy();
});

test('account-change marker retires a held status before it can reveal the previous account request', async () => {
  const old = deferredTenantStatus();
  jest.mocked(get).mockReset().mockReturnValueOnce(old.promise).mockResolvedValue(pendingTenantStatus('home-a', 'Current account request'));
  render(<LandlordVerificationFlow homeId="home-a" />);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })));
  await act(async () => old.resolve(pendingTenantStatus('home-a', 'Previous account private request')));
  expect(screen.queryByText(/Previous account private request/)).toBeNull();
  expect(await screen.findByText(/Current account request/)).toBeTruthy();
});


test('a confirmation opened before account change cannot submit the previous account cancellation', async () => {
  let confirm!: (value: boolean) => void;
  const prompt = jest.spyOn(confirmStore, 'open').mockReturnValueOnce(new Promise<boolean>(resolve => { confirm = resolve; }));
  jest.mocked(get).mockReset().mockResolvedValueOnce(pendingTenantStatus('home-a', 'Previous account request'))
    .mockResolvedValue({ home_id: 'home-a', request_context: { home_id: 'home-a', actor_id: 'tenant-1', lease_id: null, lease_state: null }, landlord: { has_landlord: true }, lease: { state: 'none', lease: null } });
  try {
    render(<LandlordVerificationFlow homeId="home-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })));
    expect(await screen.findByRole('button', { name: 'Request Approval' })).toBeTruthy();
    await act(async () => confirm(true));
    expect(post).not.toHaveBeenCalled();
  } finally { prompt.mockRestore(); }
});


test('a response for another Home cannot provide cancellation controls', async () => {
  jest.mocked(get).mockReset().mockResolvedValue(pendingTenantStatus('wrong-home', 'Wrong Home private request'));
  render(<LandlordVerificationFlow homeId="home-a" />);
  expect(await screen.findByText('Could not confirm this home’s lease status. Please retry.')).toBeTruthy();
  expect(screen.queryByText(/Wrong Home private request/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull();
});

const propertyDetail = (homeId: string, name: string) => ({
  home: { id: homeId, name, home_type: 'house' }, units: [], leases: [], pending_requests: [], occupants: [],
  authority: { id: 'authority-1', verification_tier: 'standard' },
});

test('a late landlord read cannot restore details from the previous Home', async () => {
  const old = deferredTenantStatus();
  jest.mocked(get).mockReset().mockReturnValueOnce(old.promise).mockResolvedValue(propertyDetail('home-b', 'Current property'));
  const view = render(<PropertyDetail homeId="home-a" />);
  view.rerender(<PropertyDetail homeId="home-b" />);
  expect(await screen.findByText('Current property')).toBeTruthy();
  await act(async () => old.resolve(propertyDetail('home-a', 'Previous private property')));
  expect(screen.queryByText('Previous private property')).toBeNull();
  expect(screen.getByText('Current property')).toBeTruthy();
});

test('an account change retires held landlord data even when the new account is denied', async () => {
  const old = deferredTenantStatus();
  jest.mocked(get).mockReset().mockReturnValueOnce(old.promise).mockRejectedValue({ message: 'Current account cannot manage this property' });
  render(<PropertyDetail homeId="home-a" />);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })));
  await act(async () => old.resolve(propertyDetail('home-a', 'Previous private property')));
  expect(screen.queryByText('Previous private property')).toBeNull();
  expect(await screen.findByText('Current account cannot manage this property')).toBeTruthy();
});

function propertyWithRequest(homeId: string) {
  return { ...propertyDetail(homeId, 'Original property'), pending_requests: [{ id: 'lease-1', home_id: homeId,
    start_at: '2026-09-01', end_at: null, created_at: '2026-09-01', state: 'pending', metadata: {},
    primary_resident: { name: 'Original tenant' } }] };
}

test('a completed approval for a retired Home cannot refresh over the current property', async () => {
  const saved = deferredTenantStatus();
  jest.mocked(post).mockReturnValueOnce(saved.promise);
  jest.mocked(get).mockReset().mockResolvedValueOnce(propertyWithRequest('home-a')).mockResolvedValue(propertyDetail('home-b', 'Current property'));
  const view = render(<PropertyDetail homeId="home-a" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
  fireEvent.click(screen.getByRole('button', { name: 'Approve Lease' }));
  expect(post).toHaveBeenCalledTimes(1);
  view.rerender(<PropertyDetail homeId="home-b" />);
  expect(await screen.findByText('Current property')).toBeTruthy();
  await act(async () => saved.resolve({ success: true }));
  expect(get).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Current property')).toBeTruthy();
});

test('a denial prompt cannot submit after the account changes while it is open', async () => {
  jest.mocked(get).mockReset().mockResolvedValueOnce(propertyWithRequest('home-a'))
    .mockRejectedValue({ message: 'No verified authority for this property' });
  const prompt = jest.spyOn(window, 'prompt').mockImplementation(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' }));
    return 'Old account decision';
  });
  try {
    render(<PropertyDetail homeId="home-a" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deny' }));
    expect(await screen.findByText('No verified authority for this property')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  } finally { prompt.mockRestore(); }
});

test('a retired lease-end failure cannot alert or refresh the next account', async () => {
  let reject!: (error: unknown) => void, current = true;
  jest.mocked(post).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {}), refresh = jest.fn();
  try {
    render(<LeasesTab homeId="home-a" leases={[{ id: 'lease-1', state: 'active', start_at: '2026-09-01', end_at: null } as TenantRequest]}
      onRefresh={refresh} isCurrent={() => current} />);
    fireEvent.click(screen.getByRole('button', { name: 'End Lease' }));
    current = false;
    await act(async () => reject({ message: 'Previous account private error' }));
    expect(alert).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
  } finally { alert.mockRestore(); }
});


test('a stale request keeps edits and requires another click after observing cancellation', async () => {
  const initial = { home_id: 'home-1', actor_id: 'tenant-1', lease_id: null, lease_state: null };
  const canceled = { ...initial, lease_id: 'canceled-lease', lease_state: 'canceled' };
  const status = (request_context: typeof canceled | typeof initial) => ({ home_id: 'home-1', request_context,
    landlord: { has_landlord: true }, lease: { state: 'none', lease: null } });
  jest.mocked(get).mockReset().mockResolvedValueOnce(status(initial)).mockResolvedValue(status(canceled));
  jest.mocked(post).mockRejectedValue({ message: 'Your lease request status changed.' });
  render(<LandlordVerificationFlow homeId="home-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add a message or move-in date (optional)' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep this request' } });
  fireEvent.click(screen.getByRole('button', { name: 'Request Approval' }));
  expect(await screen.findByText('Your lease request status changed.')).toBeVisible();
  expect(post).toHaveBeenCalledTimes(1);
  expect(jest.mocked(post).mock.calls[0][1]).toEqual(expect.objectContaining({ request_context: initial }));
  expect(screen.getByRole('textbox')).toHaveValue('Keep this request');
  fireEvent.click(screen.getByRole('button', { name: 'Request Approval' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(jest.mocked(post).mock.calls[1][1]).toEqual(expect.objectContaining({ request_context: canceled, message: 'Keep this request' }));
  await screen.findByText('Your lease request status changed.');
});

test('missing submission context cannot silently send an unprotected request', async () => {
  jest.mocked(get).mockReset().mockResolvedValue({ home_id: 'home-1', landlord: { has_landlord: true }, lease: { state: 'none', lease: null } });
  render(<LandlordVerificationFlow homeId="home-1" />);
  expect(await screen.findByText('Could not confirm this home’s lease status. Please retry.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Request Approval' })).toBeNull();
  expect(post).not.toHaveBeenCalled();
});

test('the separate details page reads current status before submitting through its existing SDK', async () => {
  const context = { home_id: 'home-1', actor_id: 'tenant-1', lease_id: 'canceled-lease', lease_state: 'canceled' };
  jest.mocked(get).mockReset().mockResolvedValue({ home_id: 'home-1', request_context: context });
  render(<VerifyLandlordDetailsPage />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep my details' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/app/homes/home-1/verify-landlord/submitted'));
  expect(post).toHaveBeenCalledWith('/api/v1/tenant/request-approval', {
    home_id: 'home-1', start_at: null, message: 'Keep my details', request_context: context,
  });
});

test('the details page keeps edits after a failed status read without submitting', async () => {
  jest.mocked(get).mockReset().mockRejectedValue({ message: 'Status unavailable' });
  render(<VerifyLandlordDetailsPage />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Keep my details' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Status unavailable'));
  expect(screen.getByRole('textbox')).toHaveValue('Keep my details');
  expect(post).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

test('the details page retires a held preflight before an account change can submit it', async () => {
  const old = deferredTenantStatus();
  jest.mocked(get).mockReset().mockReturnValue(old.promise);
  render(<VerifyLandlordDetailsPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'pantopus_auth_session_change' })));
  await act(async () => old.resolve({ home_id: 'home-1', request_context: {
    home_id: 'home-1', actor_id: 'tenant-1', lease_id: null, lease_state: null,
  } }));
  expect(post).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
