import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { get, post } from '../../../packages/api/src/client';
import { approveLease, type TenantRequest } from '../../../packages/api/src/endpoints/landlord';
import RequestsTab from '@/components/landlord/RequestsTab';
import PropertyDetail from '@/components/landlord/PropertyDetail';
import LeasesTab from '@/components/landlord/LeasesTab';
import UnitsTab from '@/components/landlord/UnitsTab';
import LandlordVerificationFlow from '@/components/home/LandlordVerificationFlow';
import VerificationCenter from '@/components/home/VerificationCenter';
import { confirmStore } from '@/components/ui/confirm-store';
import VerifyLandlordDetailsPage from '@/app/(app)/app/homes/[id]/verify-landlord/details/page';
import { toast } from '@/components/ui/toast-store';
import InvitePage from '@/app/(app)/app/homes/invite/page';

const mockPush = jest.fn();
const mockRouter = { push: mockPush, back: jest.fn() };
let mockQuery = 'tab=requests';
let mockSignedIn = true;
const mockOriginals = new Map<string, { value: unknown; revision: string }>();
let mockStorageFailure: 'load' | 'retain' | 'clear' | null = null;
let mockRetainGate: Promise<void> | null = null;
jest.mock('@/components/home/tasks/TaskRecoveryStorage', () => ({ ProtectedRecoverySlot: class {
  key: string;
  constructor(scope: string[]) { this.key = JSON.stringify(scope); }
  async load() { if (mockStorageFailure === 'load') throw new Error('Recovery read failed'); return mockOriginals.get(this.key) || null; }
  async retain(value: unknown, current: () => boolean) {
    if (mockRetainGate) await mockRetainGate;
    if (!current() || mockStorageFailure === 'retain') throw new Error('Recovery save failed');
    if (mockOriginals.has(this.key)) throw new Error('Another tab changed the saved original');
    const snapshot = { value: JSON.parse(JSON.stringify(value)), revision: crypto.randomUUID() }; mockOriginals.set(this.key, snapshot); return snapshot;
  }
  async clear(expected: { revision: string }, current: () => boolean) {
    if (!current() || mockStorageFailure === 'clear') throw new Error('Recovery clear failed');
    if (mockOriginals.get(this.key)?.revision !== expected.revision) throw new Error('Another tab changed the saved original');
    mockOriginals.delete(this.key);
  }
} }));

function unitLeaseProps(onRefresh = jest.fn(), isCurrent = () => true) {
  return { actorId: 'owner-1', homeId: 'building-1', authorityId: 'authority-1', occupants: [], onRefresh, isCurrent,
    units: [{ id: 'unit-1', name: 'Unit One', lease_status_available: true }] as React.ComponentProps<typeof UnitsTab>['units'],
    leases: [{ id: 'lease-1', home_id: 'unit-1', state: 'active', start_at: '2026-09-01', end_at: null }] as React.ComponentProps<typeof UnitsTab>['leases'] };
}

test('the existing unit vacancy action ends its displayed lease through the supported SDK route', async () => {
  const confirmation = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  const props = unitLeaseProps();
  try {
    render(<UnitsTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Vacant' }));
    await waitFor(() => expect(props.onRefresh).toHaveBeenCalledTimes(1));
    expect(confirmation).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/api/v1/landlord/lease/lease-1/end', {});
  } finally { confirmation.mockRestore(); }
});

test.each([false, undefined])('unknown unit lease access (%s) cannot be presented as vacant or offer tenant actions', available => {
  const props = unitLeaseProps();
  props.units[0].lease_status_available = available;
  props.leases = [];
  render(<UnitsTab {...props} />);
  expect(screen.getByText('Unavailable')).toBeVisible();
  expect(screen.queryByText('Vacant')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark Vacant' })).not.toBeInTheDocument();
});

test.each(['cancel', 'retired', 'unmounted'])(
  'a %s unit vacancy confirmation cannot send a lease decision', async mode => {
    let resolve!: (value: boolean) => void, current = true;
    const confirmation = jest.spyOn(confirmStore, 'open').mockImplementation(() => new Promise(done => { resolve = done; }));
    const props = unitLeaseProps(jest.fn(), () => current);
    try {
      const view = render(<UnitsTab {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Mark Vacant' }));
      fireEvent.click(screen.getByRole('button', { name: 'Mark Vacant' }));
      await waitFor(() => expect(confirmation).toHaveBeenCalledTimes(1));
      if (mode === 'retired') current = false;
      if (mode === 'unmounted') view.unmount();
      await act(async () => resolve(mode !== 'cancel'));
      expect(post).not.toHaveBeenCalled();
      expect(props.onRefresh).not.toHaveBeenCalled();
    } finally { confirmation.mockRestore(); }
  },
);

test.each(['success', 'failure'])('a retired unit lease end %s cannot alert or refresh the next view', async outcome => {
  let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
  const result = new Promise((done, fail) => { resolve = done; reject = fail; });
  jest.mocked(post).mockReturnValueOnce(result);
  const confirmation = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {}), props = unitLeaseProps();
  try {
    const view = render(<UnitsTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Vacant' }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    view.unmount();
    await act(async () => { if (outcome === 'success') resolve({ success: true }); else reject({ message: 'Old lease error' }); });
    expect(alert).not.toHaveBeenCalled();
    expect(props.onRefresh).not.toHaveBeenCalled();
  } finally { confirmation.mockRestore(); alert.mockRestore(); }
});

test('a failed unit lease end reports the SDK error and permits retry without claiming vacancy', async () => {
  const confirmation = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
  const props = unitLeaseProps();
  jest.mocked(post).mockRejectedValueOnce({ message: 'Authority changed. Refresh this property.' }).mockResolvedValueOnce({ success: true });
  try {
    render(<UnitsTab {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Mark Vacant' }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Authority changed. Refresh this property.'));
    expect(props.onRefresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mark Vacant' }));
    await waitFor(() => expect(props.onRefresh).toHaveBeenCalledTimes(1));
  } finally { confirmation.mockRestore(); alert.mockRestore(); }
});

jest.mock('../../../packages/api/src/client', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@pantopus/api', () => ({
  landlord: jest.requireActual('../../../packages/api/src/endpoints/landlord'),
  tenant: jest.requireActual('../../../packages/api/src/endpoints/tenant'),
  onTokenChange: () => () => {},
  getApiBaseUrl: () => 'http://localhost',
  getAuthToken: () => mockSignedIn ? 'synthetic-fixture' : null,
  AUTH_SESSION_CHANGE_KEY: 'pantopus_auth_session_change',
}));

jest.mock('next/navigation', () => ({ useRouter: () => mockRouter, useParams: () => ({ id: 'home-1' }), useSearchParams: () => new URLSearchParams(mockQuery) }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('@/components/home/useHomePermissions', () => ({ useHomePermissions: () => ({ access: null, reload: jest.fn() }) }));

beforeEach(() => { mockOriginals.clear(); mockStorageFailure = null; mockRetainGate = null; localStorage.clear(); mockQuery = 'tab=requests'; mockSignedIn = true; jest.clearAllMocks(); jest.mocked(post).mockResolvedValue({}); });

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
  actor_id: 'owner-1', home: { id: homeId, name, home_type: 'house' }, units: [], leases: [], pending_requests: [], occupants: [],
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

const leaseToken = 'a'.repeat(64);
const leasePreview = { home: { id: 'unit-1', name: 'Synthetic Unit', city: 'Synthetic' },
  invitation: { status: 'pending', proposed_start: '2026-09-01T00:00:00Z', proposed_end: null,
    expires_at: '2026-09-28T00:00:00Z' }, account_email: 'tenant@example.invalid' };
function openLeaseInvite() {
  mockQuery = `type=lease&code=${leaseToken}`;
  return render(<InvitePage />);
}

test('the code screen previews the lease before confirmed acceptance through the existing tenant SDK', async () => {
  jest.mocked(post).mockResolvedValueOnce(leasePreview).mockResolvedValueOnce({ lease: { id: 'lease-1', home_id: 'unit-1', state: 'active' }, occupancy: { id: 'occ-1' } });
  const confirm = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  try {
    openLeaseInvite();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/app/homes'));
    expect(post).toHaveBeenNthCalledWith(1, '/api/v1/tenant/preview-invite', { token: leaseToken });
    expect(post).toHaveBeenNthCalledWith(2, '/api/v1/tenant/accept-invite', { token: leaseToken });
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('tenant@example.invalid') }));
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining('September 1, 2026') }));
  } finally { confirm.mockRestore(); }
});

test.each(['cancel', 'account', 'unmount'])('a %s lease confirmation cannot accept the invite', async mode => {
  let resolve!: (value: boolean) => void;
  jest.mocked(post).mockResolvedValueOnce(leasePreview);
  const confirm = jest.spyOn(confirmStore, 'open').mockImplementation(() => new Promise(done => { resolve = done; }));
  try {
    const view = openLeaseInvite();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    if (mode === 'account') fireEvent(window, new StorageEvent('storage', { key: 'pantopus_auth_session_change' }));
    if (mode === 'unmount') view.unmount();
    await act(async () => resolve(mode !== 'cancel'));
    expect(post).toHaveBeenCalledTimes(1); expect(mockPush).not.toHaveBeenCalled();
  } finally { confirm.mockRestore(); }
});

test('failed lease acceptance retains the code and retries the same invitation', async () => {
  jest.mocked(post).mockResolvedValueOnce(leasePreview).mockRejectedValueOnce({ message: 'Reply lost. Retry this invitation.' })
    .mockResolvedValueOnce({ ...leasePreview, invitation: { ...leasePreview.invitation, status: 'accepted' } })
    .mockResolvedValueOnce({ lease: { id: 'lease-1', home_id: 'unit-1', state: 'active' }, occupancy: { id: 'occ-1' } });
  const confirm = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  try {
    openLeaseInvite(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Reply lost. Retry this invitation.'));
    expect(screen.getByPlaceholderText('Enter code')).toHaveValue(leaseToken);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/app/homes'));
    expect(post).toHaveBeenNthCalledWith(4, '/api/v1/tenant/accept-invite', { token: leaseToken });
  } finally { confirm.mockRestore(); }
});

test('ordinary Home codes use the protected existing invitation page without legacy acceptance', async () => {
  render(<InvitePage />); fireEvent.change(screen.getByPlaceholderText('Enter code'), { target: { value: 'home-token' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/invite/home-token'));
  expect(post).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
});

test('login preserves the lease invitation destination without accepting it', async () => {
  mockSignedIn = false; openLeaseInvite();
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith(`/login?redirectTo=${encodeURIComponent(`/app/homes/invite?type=lease&code=${leaseToken}`)}`));
  expect(post).not.toHaveBeenCalled();
});

test.each(['preview', 'accept'])('a delayed %s result cannot confirm or navigate after leaving the invite screen', async phase => {
  let resolve!: (value: unknown) => void;
  const delayed = new Promise(done => { resolve = done; });
  if (phase === 'preview') jest.mocked(post).mockReturnValueOnce(delayed);
  else jest.mocked(post).mockResolvedValueOnce(leasePreview).mockReturnValueOnce(delayed);
  const confirm = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  try {
    const view = openLeaseInvite(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.keyDown(screen.getByPlaceholderText('Enter code'), { key: 'Enter' });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(phase === 'preview' ? 1 : 2));
    view.unmount();
    await act(async () => resolve(phase === 'preview' ? leasePreview : { lease: { id: 'lease-1', home_id: 'unit-1', state: 'active' }, occupancy: { id: 'occ-1' } }));
    expect(mockPush).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(phase === 'preview' ? 0 : 1);
  } finally { confirm.mockRestore(); }
});

test.each(['wrong-account', 'malformed'])('a %s preview cannot offer lease acceptance', async mode => {
  if (mode === 'wrong-account') jest.mocked(post).mockRejectedValueOnce({ message: 'Invitation not available for this account.' });
  else jest.mocked(post).mockResolvedValueOnce({ home: { id: 'unit-1' } });
  const confirm = jest.spyOn(confirmStore, 'open').mockResolvedValue(true);
  try {
    openLeaseInvite(); fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(confirm).not.toHaveBeenCalled(); expect(post).toHaveBeenCalledTimes(1); expect(mockPush).not.toHaveBeenCalled();
  } finally { confirm.mockRestore(); }
});

async function openUnitInvite(onRefresh = jest.fn(), isCurrent = () => true) {
  const props = unitLeaseProps(onRefresh, isCurrent); props.leases = [];
  const view = render(<UnitsTab {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Email address')).not.toBeDisabled());
  fireEvent.change(screen.getByPlaceholderText('tenant@example.com'), { target: { value: 'tenant@example.invalid' } });
  const dates = view.container.querySelectorAll('input[type="date"]');
  fireEvent.change(dates[0], { target: { value: '2026-09-01' } });
  return { ...view, dates, onRefresh };
}

test('the existing landlord modal retains the created invitation link for manual sharing', async () => {
  jest.mocked(post).mockImplementationOnce(async (_path, input) => ({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: (input as { invite_token: string }).invite_token }));
  const view = await openUnitInvite();
  fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Invitation link')).toHaveValue(`${window.location.origin}/invite/lease/${(jest.mocked(post).mock.calls[0][1] as { invite_token: string }).invite_token}`));
  expect(screen.getByText(/Email delivery has not been confirmed/)).toBeVisible();
  expect(view.onRefresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(view.onRefresh).toHaveBeenCalledTimes(1));
});

test('an SDK invitation error retains the existing form for retry', async () => {
  jest.mocked(post).mockRejectedValueOnce({ message: 'Current verified authority required' });
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByText('Current verified authority required')).toBeVisible());
  expect(screen.getByPlaceholderText('tenant@example.com')).toHaveValue('tenant@example.invalid');
});

test.each(['closed', 'account'])('a %s landlord invitation cannot refresh or reveal a late sharing link', async mode => {
  let resolve!: (value: unknown) => void, current = true;
  jest.mocked(post).mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const view = await openUnitInvite(jest.fn(), () => current);
  fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  if (mode === 'closed') fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  else current = false;
  await act(async () => resolve({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: leaseToken }));
  expect(view.onRefresh).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument();
});

test.each(['', '2026-08-31'])('an invalid invite date %s cannot submit', async invalid => {
  const { dates } = await openUnitInvite();
  fireEvent.change(dates[invalid ? 1 : 0], { target: { value: invalid } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByText(invalid ? 'End date must be after start date.' : 'Enter a start date.')).toBeVisible();
});

test('a clipboard failure keeps the complete invitation link available for manual copy and retry', async () => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writeText = jest.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  jest.mocked(post).mockImplementationOnce(async (_path, input) => ({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: (input as { invite_token: string }).invite_token }));
  try {
    await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy Link' })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(screen.getByText('Copy failed. Select and copy the invitation link above.')).toBeVisible());
    expect(screen.getByLabelText('Invitation link')).toHaveValue(`${window.location.origin}/invite/lease/${(jest.mocked(post).mock.calls[0][1] as { invite_token: string }).invite_token}`);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeVisible());
    expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/invite/lease/${(jest.mocked(post).mock.calls[0][1] as { invite_token: string }).invite_token}`);
    expect(post).toHaveBeenCalledTimes(1);
  } finally {
    if (previous) Object.defineProperty(navigator, 'clipboard', previous);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

test.each(['missing-token', 'wrong-home', 'wrong-token'])('an incomplete invitation response (%s) cannot claim a saved sharing link', async kind => {
  jest.mocked(post).mockResolvedValueOnce({ invite: { id: 'invite-1', home_id: kind === 'wrong-home' ? 'other-home' : 'unit-1' }, ...(kind !== 'missing-token' ? { token: leaseToken } : {}) });
  const view = await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByText('Could not recover the invitation link. Reopen the property to check its status.')).toBeVisible());
  expect(screen.queryByLabelText('Invitation link')).not.toBeInTheDocument(); expect(view.onRefresh).not.toHaveBeenCalled();
});

test('uncertain creation retries the same retained proof and details without replacing the form', async () => {
  jest.mocked(post).mockRejectedValueOnce({ statusCode: 503, message: 'Reply lost.' })
    .mockImplementationOnce(async (_path, input) => ({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: (input as { invite_token: string }).invite_token }));
  const view = await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry Original Invite' })).toBeVisible());
  const original = jest.mocked(post).mock.calls[0][1];
  expect(original).toEqual(expect.objectContaining({ invite_token: expect.stringMatching(/^[a-f0-9]{64}$/), home_id: 'unit-1', start_at: '2026-09-01' }));
  expect(screen.getByLabelText('Email address')).toBeDisabled();
  expect(view.dates[0]).toBeDisabled(); expect(view.dates[1]).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Retry Original Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Invitation link')).toBeVisible());
  expect(jest.mocked(post).mock.calls[1][1]).toEqual(original);
});

test('a definite validation rejection permits corrected details with a fresh invitation proof', async () => {
  jest.mocked(post).mockRejectedValueOnce({ statusCode: 400, message: 'Email is invalid.' })
    .mockImplementationOnce(async (_path, input) => ({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: (input as { invite_token: string }).invite_token }));
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByText('Email is invalid.')).toBeVisible());
  expect(screen.getByLabelText('Email address')).not.toBeDisabled();
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'corrected@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Invitation link')).toBeVisible());
  const original = jest.mocked(post).mock.calls[0][1] as { invite_token: string };
  const corrected = jest.mocked(post).mock.calls[1][1] as { invite_token: string; invitee_email: string };
  expect(corrected.invitee_email).toBe('corrected@example.com'); expect(corrected.invite_token).not.toBe(original.invite_token);
});

test('a later authority rejection does not discard an already uncertain creation proof', async () => {
  jest.mocked(post).mockRejectedValueOnce({ statusCode: 503, message: 'Reply lost.' })
    .mockRejectedValueOnce({ statusCode: 403, message: 'Current verified authority required' });
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry Original Invite' })).toBeVisible());
  fireEvent.click(screen.getByRole('button', { name: 'Retry Original Invite' }));
  await waitFor(() => expect(screen.getByText('Current verified authority required')).toBeVisible());
  expect(screen.getByLabelText('Email address')).toBeDisabled();
  expect(jest.mocked(post).mock.calls[1][1]).toEqual(jest.mocked(post).mock.calls[0][1]);
});


test('closing and reopening recovers the same original without sending until explicit retry', async () => {
  jest.mocked(post).mockRejectedValueOnce({ statusCode: 503, message: 'Reply lost.' })
    .mockImplementationOnce(async (_path, input) => ({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: (input as { invite_token: string }).invite_token }));
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry Original Invite' })).toBeVisible());
  const original = jest.mocked(post).mock.calls[0][1];
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry Original Invite' })).toBeEnabled());
  expect(screen.getByLabelText('Email address')).toHaveValue('tenant@example.invalid');
  expect(post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry Original Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Invitation link')).toBeVisible());
  expect(jest.mocked(post).mock.calls[1][1]).toEqual(original);
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(mockOriginals.size).toBe(0));
});

test.each(['account', 'unit'])('a different %s cannot read the retained invitation', async boundary => {
  jest.mocked(post).mockRejectedValueOnce({ statusCode: 503, message: 'Reply lost.' });
  const first = await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(mockOriginals.size).toBe(1)); first.unmount();
  const props = unitLeaseProps(); props.leases = [];
  if (boundary === 'account') props.actorId = 'owner-2'; else props.units[0].id = 'unit-2';
  render(<UnitsTab {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Email address')).not.toBeDisabled());
  expect(screen.getByLabelText('Email address')).toHaveValue(''); expect(mockOriginals.size).toBe(1); expect(post).toHaveBeenCalledTimes(1);
});

test.each(['load', 'retain'] as const)('a protected %s failure prevents an unretained POST', async operation => {
  if (operation === 'load') {
    mockStorageFailure = operation; const props = unitLeaseProps(); props.leases = [];
    render(<UnitsTab {...props} />); fireEvent.click(screen.getByRole('button', { name: 'Invite' }));
  } else {
    await openUnitInvite(); mockStorageFailure = operation; fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  }
  await waitFor(() => expect(screen.getByText(operation === 'load' ? 'Recovery read failed' : 'Recovery save failed')).toBeVisible());
  expect(screen.getByRole('button', { name: 'Send Invite' })).toBeDisabled(); expect(post).not.toHaveBeenCalled();
});

test('closing during protected retain cannot send after storage completes', async () => {
  let release!: () => void; mockRetainGate = new Promise(done => { release = done; });
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await act(async () => release()); expect(post).not.toHaveBeenCalled(); expect(mockOriginals.size).toBe(0);
});

test('Done cannot erase a newer original retained by another tab', async () => {
  jest.mocked(post).mockImplementationOnce(async (_path, input) => ({ invite: { id: 'invite-1', home_id: 'unit-1' }, token: (input as { invite_token: string }).invite_token }));
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByLabelText('Invitation link')).toBeVisible());
  const [key, saved] = [...mockOriginals][0]; mockOriginals.set(key, { ...saved, revision: 'newer-original' });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.getByText('Another tab changed the saved original')).toBeVisible());
  expect(mockOriginals.get(key)?.revision).toBe('newer-original'); expect(screen.getByLabelText('Invitation link')).toBeVisible();
});

test('a matching invitation reported closed permits a fresh invitation instead of trapping an expired original', async () => {
  jest.mocked(post).mockRejectedValueOnce({ statusCode: 503, message: 'Reply lost.' }).mockRejectedValueOnce({ statusCode: 410, message: 'This invitation is closed or expired' });
  await openUnitInvite(); fireEvent.click(screen.getByRole('button', { name: 'Send Invite' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Retry Original Invite' })).toBeVisible());
  fireEvent.click(screen.getByRole('button', { name: 'Retry Original Invite' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send Invite' })).toBeEnabled());
  expect(mockOriginals.size).toBe(0); expect(screen.getByLabelText('Email address')).not.toBeDisabled();
});

const unitHomeId = 'ddf10001-0000-4000-8000-000000000500';
function unitBatchResult(input: { request_id: string; expected_actor_id: string; units?: { label: string }[]; prefix?: string; start?: number; end?: number }, state = 'completed') {
  const labels = input.units?.map(unit => unit.label) || Array.from({ length: input.end! - input.start! + 1 }, (_, index) => `${input.prefix}${input.start! + index}`.trim());
  return { state, request_id: input.request_id, actor_id: input.expected_actor_id, home_id: unitHomeId, requires_verification: true,
    total: labels.length, results: labels.map((label, index) => ({ label, request_id: index === 0 ? input.request_id : `ddf10001-0000-4000-8000-${String(index).padStart(12, '0')}`,
      home_id: `ddf10001-0000-4000-8000-${String(index + 100).padStart(12, '0')}`, state: state === 'pending' && index === labels.length - 1 ? 'pending' : 'completed' })) };
}
async function openUnitImport(props = { ...unitLeaseProps(), homeId: unitHomeId }) {
  const view = render(<UnitsTab {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Import units' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Apt 103\nApt 104' } });
  return { view, props };
}

test('unit import persists before POST, survives remount and recovers the same original after a lost reply', async () => {
  jest.mocked(post).mockImplementationOnce(async () => { expect(mockOriginals.size).toBe(1); throw new Error('Lost unit response'); })
    .mockImplementationOnce(async (_path, input) => unitBatchResult(input as Parameters<typeof unitBatchResult>[0]));
  const { view, props } = await openUnitImport();
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await screen.findByText('Lost unit response');
  const first = jest.mocked(post).mock.calls[0];
  expect(first[0]).toBe(`/api/homes/${unitHomeId}/units/import`);
  expect(screen.getByRole('textbox')).toBeDisabled(); expect(props.onRefresh).not.toHaveBeenCalled();
  view.unmount(); render(<UnitsTab {...props} />);
  await screen.findByRole('button', { name: 'Retry Original Batch' });
  expect(post).toHaveBeenCalledTimes(1); expect(screen.getByRole('textbox')).toHaveValue('Apt 103\nApt 104');
  fireEvent.click(screen.getByRole('button', { name: 'Retry Original Batch' }));
  await screen.findByRole('button', { name: 'Done' });
  expect(jest.mocked(post).mock.calls[1]).toEqual(first); expect(mockOriginals.size).toBe(1);
  expect(screen.getByText(/Each unit still needs verification/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(props.onRefresh).toHaveBeenCalledTimes(1)); expect(mockOriginals.size).toBe(0);
});

test('a partial unit batch retains the original and cannot be mistaken for completed import', async () => {
  jest.mocked(post).mockImplementationOnce(async (_path, input) => unitBatchResult(input as Parameters<typeof unitBatchResult>[0], 'pending'))
    .mockImplementationOnce(async (_path, input) => unitBatchResult(input as Parameters<typeof unitBatchResult>[0]));
  const { props } = await openUnitImport(); fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await screen.findByRole('button', { name: 'Retry Original Batch' });
  expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument(); expect(props.onRefresh).not.toHaveBeenCalled();
  expect(screen.getByText(/Saved unit setups: 1/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry Original Batch' })); await screen.findByRole('button', { name: 'Done' });
  expect(jest.mocked(post).mock.calls[1]).toEqual(jest.mocked(post).mock.calls[0]);
});

test.each(['actor', 'home', 'batch', 'incomplete', 'unverified', 'duplicate receipt'])('a unit reply with %s mismatch cannot clear recovery or report completion', async mismatch => {
  jest.mocked(post).mockImplementationOnce(async (_path, input) => {
    const result = unitBatchResult(input as Parameters<typeof unitBatchResult>[0]);
    if (mismatch === 'actor') result.actor_id = 'other'; else if (mismatch === 'home') result.home_id = 'other';
    else if (mismatch === 'batch') result.request_id = crypto.randomUUID(); else if (mismatch === 'incomplete') result.results.pop();
    else if (mismatch === 'unverified') result.requires_verification = false;
    else result.results[1].request_id = result.results[0].request_id;
    return result;
  });
  const { props } = await openUnitImport(); fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await screen.findByText('The unit results could not be confirmed. Retry the original batch.');
  expect(mockOriginals.size).toBe(1); expect(props.onRefresh).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
});

test.each(['Apt 1,apt 1', ' ', Array.from({ length: 51 }, (_, i) => `Apt ${i}`).join(','), 'A'.repeat(51)])('invalid import labels cannot be retained or posted (%s)', async labels => {
  await openUnitImport(); fireEvent.change(screen.getByRole('textbox'), { target: { value: labels } });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  await screen.findByText(/Enter 1–50 distinct unit labels/); expect(post).not.toHaveBeenCalled(); expect(mockOriginals.size).toBe(0);
});

test.each(['1.5', ''])('generation rejects noninteger or absent range values (%s) without a request', async start => {
  render(<UnitsTab {...unitLeaseProps()} homeId={unitHomeId} />); fireEvent.click(screen.getByRole('button', { name: 'Generate range' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Apt ' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: start } });
  fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
  await screen.findByText(/Enter 1–50 distinct unit labels/); expect(post).not.toHaveBeenCalled();
});

test('generation uses the supported SDK route and preserves its exact prefix and integer range', async () => {
  jest.mocked(post).mockImplementationOnce(async (_path, input) => unitBatchResult(input as Parameters<typeof unitBatchResult>[0]));
  render(<UnitsTab {...unitLeaseProps()} homeId={unitHomeId} />); fireEvent.click(screen.getByRole('button', { name: 'Generate range' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Apt ' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '105' } });
  fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '106' } });
  fireEvent.click(screen.getByRole('button', { name: 'Generate' })); await screen.findByRole('button', { name: 'Done' });
  expect(post).toHaveBeenCalledWith(`/api/homes/${unitHomeId}/units/generate`, expect.objectContaining({ prefix: 'Apt ', start: 105, end: 106, expected_actor_id: 'owner-1' }));
});

test.each(['retired', 'account', 'unmounted'])('a %s page while protected unit storage is pending cannot send', async departure => {
  let release!: () => void, current = true;
  mockRetainGate = new Promise(done => { release = done; });
  const { view, props } = await openUnitImport({ ...unitLeaseProps(jest.fn(), () => current), homeId: unitHomeId });
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
  if (departure === 'retired') current = false; else if (departure === 'account') localStorage.setItem('pantopus_auth_session_change', 'changed'); else view.unmount();
  await act(async () => release()); expect(post).not.toHaveBeenCalled(); expect(props.onRefresh).not.toHaveBeenCalled(); expect(mockOriginals.size).toBe(0);
});

test('a storage failure keeps unit creation disabled until recovery is reopened', async () => {
  const { props } = await openUnitImport(); mockStorageFailure = 'retain';
  fireEvent.click(screen.getByRole('button', { name: 'Import' })); await screen.findByText('Recovery save failed');
  expect(post).not.toHaveBeenCalled(); expect(props.onRefresh).not.toHaveBeenCalled(); expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
});

test('a stale unit acknowledgement cannot erase another tab’s original', async () => {
  jest.mocked(post).mockImplementationOnce(async (_path, input) => unitBatchResult(input as Parameters<typeof unitBatchResult>[0]));
  const { props } = await openUnitImport(); fireEvent.click(screen.getByRole('button', { name: 'Import' })); await screen.findByRole('button', { name: 'Done' });
  const [key, snapshot] = [...mockOriginals][0]; const replacement = { ...snapshot, revision: 'newer-revision' }; mockOriginals.set(key, replacement);
  fireEvent.click(screen.getByRole('button', { name: 'Done' })); await screen.findByText('Another tab changed the saved original');
  expect(mockOriginals.get(key)).toBe(replacement); expect(props.onRefresh).not.toHaveBeenCalled();
});
