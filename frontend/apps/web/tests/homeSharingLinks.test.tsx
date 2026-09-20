import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder } from 'util';
import * as api from '@pantopus/api';
import CreateGuestPass from '../src/components/home/share/CreateGuestPass';
import ScopedShareModal from '../src/components/home/share/ScopedShareModal';
import ShareCenter from '../src/components/home/share/ShareCenter';
import GuestViewPage from '../src/app/guest/[token]/page';
import SharedResourcePage from '../src/app/shared/[token]/page';
import SharePage from '../src/app/(app)/app/homes/[id]/share/page';

jest.mock('@pantopus/api', () => ({ homeIam: {
  createGuestPass: jest.fn(), createScopedGrant: jest.fn(),
  getGuestPasses: jest.fn(), revokeGuestPass: jest.fn(),
}, homeGuest: { viewGuestPass: jest.fn(), viewSharedResource: jest.fn() }, getAuthToken: () => '__session__' }));
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() };
jest.mock('next/navigation', () => ({
  useParams: () => ({ token: 'ab'.repeat(32), id: 'home' }),
  useRouter: () => mockRouter,
}));
jest.mock('../src/components/ui/toast-store', () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }));
jest.mock('../src/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn(async () => true) } }));
jest.mock('../src/components/home/SlidePanel', () => ({ __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const token = 'ba'.repeat(32);
const clipboard = jest.fn(async () => {});
beforeAll(() => {
  Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: TextEncoder });
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: clipboard } });
});
beforeEach(() => { jest.clearAllMocks(); });

test('guest pass creation carries the returned token into the copyable public route and QR', async () => {
  jest.mocked(api.homeIam.createGuestPass).mockResolvedValue({ token, pass: {
    id: 'pass', home_id: 'home', label: 'WiFi Only', kind: 'wifi_only',
    end_at: '2099-01-01T00:00:00Z', included_sections: ['wifi'], view_count: 0,
  } } as Awaited<ReturnType<typeof api.homeIam.createGuestPass>>);
  render(<CreateGuestPass open onClose={() => {}} homeId="home-id-is-not-the-token"
    preselectedKind="wifi_only" onCreated={() => {}} />);
  expect(screen.queryByRole('img', { name: 'Guest pass QR code' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create Pass' }));
  expect(await screen.findByRole('img', { name: 'Guest pass QR code' })).toBeInTheDocument();
  const url = `${window.location.origin}/guest/${token}`;
  expect(screen.getByText(url)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Copy Link/ }));
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith(url));
  expect(api.homeIam.createGuestPass).toHaveBeenCalledTimes(1);
  expect(api.homeIam.createGuestPass).toHaveBeenCalledWith('home-id-is-not-the-token',
    expect.objectContaining({ kind: 'wifi_only', included_sections: ['wifi'], duration_hours: 2 }));
});

test('scoped sharing creates an exact read-only grant and exposes only its returned token route', async () => {
  jest.mocked(api.homeIam.createScopedGrant).mockResolvedValue({ token, grant: { id: 'grant' } } as
    Awaited<ReturnType<typeof api.homeIam.createScopedGrant>>);
  render(<ScopedShareModal open onClose={() => {}} homeId="home-id-is-not-the-token"
    resourceId="exact-task-id" resourceType="HomeTask" resourceLabel="Exact task" />);
  expect(screen.queryByText('Allow editing')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create Link' }));
  const url = `${window.location.origin}/shared/${token}`;
  expect(await screen.findByText(url)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Resource share QR code' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith(url));
  expect(api.homeIam.createScopedGrant).toHaveBeenCalledTimes(1);
  expect(api.homeIam.createScopedGrant).toHaveBeenCalledWith('home-id-is-not-the-token',
    expect.objectContaining({ resource_type: 'HomeTask', resource_id: 'exact-task-id', can_edit: false }));
});

test('a denied grant never produces a link or QR', async () => {
  // The shared API client rejects with a plain object carrying the API envelope,
  // never an Error; mocking an Error here hid that the reason was being dropped.
  jest.mocked(api.homeIam.createScopedGrant).mockRejectedValue({
    message: 'The shared content is no longer available.', code: 'SHARE_RESOURCE_DENIED',
    statusCode: 403, data: { code: 'SHARE_RESOURCE_DENIED' },
  });
  render(<ScopedShareModal open onClose={() => {}} homeId="home"
    resourceId="restricted-task" resourceType="HomeTask" />);
  fireEvent.click(screen.getByRole('button', { name: 'Create Link' }));
  expect(await screen.findByText('The shared content is no longer available.')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(clipboard).not.toHaveBeenCalled();
});


// ============================================================
// Current-status truthfulness. The share API decides each pass's status and
// returns a stable recovery code for every refused read; the browser journey
// must repeat those decisions instead of guessing from message text.
// ============================================================

const basePass = {
  home_id: 'home', role_base: 'guest', custom_title: null, passcode_hash: null,
  max_views: null, view_count: 0, start_at: '2020-01-01T00:00:00Z',
  created_at: '2020-01-01T00:00:00Z', revoked_at: null, included_sections: ['wifi'],
} as const;

function listed(rows: Record<string, unknown>[]) {
  jest.mocked(api.homeIam.getGuestPasses).mockResolvedValue({ passes: rows } as unknown as
    Awaited<ReturnType<typeof api.homeIam.getGuestPasses>>);
}

function shareCenter() {
  return render(<ShareCenter homeId="home" home={{}} secrets={[]} emergencies={[]}
    can={() => true} onSecretsChange={() => {}} />);
}

test('a link the share API refuses is never listed as an Active pass', async () => {
  listed([
    { ...basePass, id: 'legacy', label: 'Legacy pass', kind: 'guest',
      end_at: '2099-01-01T00:00:00Z', status: 'reissue_required' },
    { ...basePass, id: 'later', label: 'Scheduled pass', kind: 'guest',
      start_at: '2099-01-01T00:00:00Z', end_at: '2099-02-01T00:00:00Z', status: 'scheduled' },
    { ...basePass, id: 'live', label: 'Live pass', kind: 'wifi_only',
      end_at: '2099-01-01T00:00:00Z', status: 'active' },
  ]);
  shareCenter();
  expect(await screen.findByText('Live pass')).toBeInTheDocument();
  // Only the redeemable-now link may claim Active.
  expect(screen.getAllByText('Active')).toHaveLength(1);
  expect(screen.getByText('Scheduled')).toBeInTheDocument();
  expect(screen.getByText('Active Passes')).toBeInTheDocument();
  expect(screen.getByText('(2)')).toBeInTheDocument();
  // A scheduled link is still live for its holder, so it stays revocable.
  expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: /Past Passes \(1\)/ }));
  expect(screen.getByText('Needs new link')).toBeInTheDocument();
});

test('an unavailable pass list is reported, never shown as "no active guest passes"', async () => {
  jest.mocked(api.homeIam.getGuestPasses).mockRejectedValue({
    message: 'Could not complete the share request. Please retry.',
    code: 'SHARE_UNAVAILABLE', statusCode: 503, data: { code: 'SHARE_UNAVAILABLE' },
  });
  shareCenter();
  expect(await screen.findByText('Could not complete the share request. Please retry.')).toBeInTheDocument();
  expect(screen.queryByText('No active guest passes')).not.toBeInTheDocument();
  listed([{ ...basePass, id: 'live', label: 'Live pass', kind: 'wifi_only',
    end_at: '2099-01-01T00:00:00Z', status: 'active' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('Live pass')).toBeInTheDocument();
});

test('a transport failure keeps its own copy instead of a raw client string', async () => {
  jest.mocked(api.homeIam.getGuestPasses).mockRejectedValue({
    message: 'Request failed with status code 500', code: 'ERR_BAD_RESPONSE', statusCode: 500, data: '<html/>',
  });
  shareCenter();
  expect(await screen.findByText('Guest passes could not be loaded. Retry to check the current links.')).toBeInTheDocument();
  expect(screen.queryByText('Request failed with status code 500')).not.toBeInTheDocument();
});

test('creation reports the API reason from its plain-object rejection', async () => {
  // The shared client rejects with an object, never an Error.
  jest.mocked(api.homeIam.createGuestPass).mockRejectedValue({
    message: 'Check the share details and try again. Share links allow viewing only.',
    code: 'SHARE_INVALID', statusCode: 400, data: { code: 'SHARE_INVALID' },
  });
  render(<CreateGuestPass open onClose={() => {}} homeId="home" preselectedKind="wifi_only" onCreated={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Create' }));
  expect(await screen.findByText('Check the share details and try again. Share links allow viewing only.')).toBeInTheDocument();
});

// ---- Public guest view ----

async function guestView(failure: Record<string, unknown>) {
  jest.mocked(api.homeGuest.viewGuestPass).mockRejectedValue(failure);
  await act(async () => { render(<GuestViewPage />); });
}

test('an exhausted view limit is a retired link, not a retryable error', async () => {
  await guestView({ message: 'This share link has reached its view limit.',
    code: 'SHARE_VIEW_LIMIT', statusCode: 410, data: { code: 'SHARE_VIEW_LIMIT' } });
  expect(screen.getByText('View Limit Reached')).toBeInTheDocument();
  expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
});

test('a link whose window has not opened says so and may be retried later', async () => {
  await guestView({ message: 'This share link is not active yet.',
    code: 'SHARE_NOT_STARTED', statusCode: 403, data: { code: 'SHARE_NOT_STARTED' } });
  expect(screen.getByText('Not Active Yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
});

test('a link needing reissue is never reported as an admin revocation', async () => {
  await guestView({ message: 'This older share link is inactive. Ask the sender for a new link.',
    code: 'SHARE_REISSUE_REQUIRED', statusCode: 410, data: { code: 'SHARE_REISSUE_REQUIRED' } });
  expect(screen.getByText('Link Needs Replacing')).toBeInTheDocument();
  expect(screen.queryByText(/revoked by the home admin/)).not.toBeInTheDocument();
});

test('an actual revocation keeps its existing revoked screen', async () => {
  await guestView({ message: 'This share link has been revoked.',
    code: 'SHARE_REVOKED', statusCode: 410, data: { code: 'SHARE_REVOKED' } });
  expect(screen.getByText('Access Revoked')).toBeInTheDocument();
  expect(screen.getByText(/revoked by the home admin/)).toBeInTheDocument();
});

test('emergency entries use the icon for their actual HomeEmergency type', async () => {
  // HomeEmergency.type can only hold the HomeEmergencyType values; the page had
  // matched 'shutoff'/'contact', which this column never contains, so every
  // entry fell back to the generic icon.
  jest.mocked(api.homeGuest.viewGuestPass).mockResolvedValue({
    pass: { label: 'Vendor', kind: 'vendor', custom_title: null, expires_at: '2099-01-01T00:00:00Z',
      home_name: 'My Place', welcome_message: null },
    sections: { emergency: [
      { type: 'shutoff_water', label: 'Water shutoff', location: 'Garage wall' },
      { type: 'emergency_contacts', label: 'Emergency contacts', location: 'Kitchen binder' },
    ] },
  } as Awaited<ReturnType<typeof api.homeGuest.viewGuestPass>>);
  await act(async () => { render(<GuestViewPage />); });
  const shutoff = screen.getByText('Water shutoff').closest('div.flex');
  const contacts = screen.getByText('Emergency contacts').closest('div.flex');
  expect(shutoff?.textContent).toContain('🔧');
  expect(contacts?.textContent).toContain('📞');
  expect(screen.queryByText('⚠️')).not.toBeInTheDocument();
});

test('a passcode challenge still opens the passcode form', async () => {
  await guestView({ message: 'Enter the correct passcode to view this share link.',
    code: 'SHARE_PASSCODE_REQUIRED', statusCode: 403, requiresPasscode: true,
    data: { code: 'SHARE_PASSCODE_REQUIRED', requiresPasscode: true } });
  expect(screen.getByText('Passcode Required')).toBeInTheDocument();
  const input = screen.getByPlaceholderText('Enter passcode') as HTMLInputElement;
  // The API accepts passcodes up to 128 characters; the guest must be able to enter them.
  expect(input.maxLength).toBe(128);
});


// ============================================================
// Public scoped /shared/:token view. The same recovery codes as the guest
// page: a retired link must never invite a retry, a link that only needs
// reissuing is not an owner revocation, and the passcode accepts the API's
// full 128 characters.
// ============================================================

async function sharedView(failure: Record<string, unknown>) {
  jest.mocked(api.homeGuest.viewSharedResource).mockRejectedValue(failure);
  await act(async () => { render(<SharedResourcePage />); });
}

test('a scoped link at its view limit is retired, not a retryable error', async () => {
  await sharedView({ message: 'This share link has reached its view limit.',
    code: 'SHARE_VIEW_LIMIT', statusCode: 410, data: { code: 'SHARE_VIEW_LIMIT' } });
  expect(screen.getByText('View Limit Reached')).toBeInTheDocument();
  expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
});

test('a scoped link whose window has not opened says so and may be retried later', async () => {
  await sharedView({ message: 'This share link is not active yet.',
    code: 'SHARE_NOT_STARTED', statusCode: 403, data: { code: 'SHARE_NOT_STARTED' } });
  expect(screen.getByText('Not Active Yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
});

test('a scoped link needing reissue is never reported as an owner revocation', async () => {
  await sharedView({ message: 'This older share link is inactive. Ask the sender for a new link.',
    code: 'SHARE_REISSUE_REQUIRED', statusCode: 410, data: { code: 'SHARE_REISSUE_REQUIRED' } });
  expect(screen.getByText('Link Needs Replacing')).toBeInTheDocument();
  expect(screen.queryByText(/revoked by the owner/)).not.toBeInTheDocument();
});

test('a scoped revocation keeps its existing revoked screen and an unknown link is not retried', async () => {
  await sharedView({ message: 'This share link has been revoked.',
    code: 'SHARE_REVOKED', statusCode: 410, data: { code: 'SHARE_REVOKED' } });
  expect(screen.getByText('Access Revoked')).toBeInTheDocument();
  expect(screen.getByText(/revoked by the owner/)).toBeInTheDocument();
  cleanupRender();
  await sharedView({ message: 'Share link not found.',
    code: 'SHARE_NOT_FOUND', statusCode: 404, data: { code: 'SHARE_NOT_FOUND' } });
  expect(screen.getByText('Link Not Found')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
});

test('the scoped passcode challenge accepts the API limit and reports a wrong code without leaving the form', async () => {
  await sharedView({ message: 'Enter the correct passcode to view this share link.',
    code: 'SHARE_PASSCODE_REQUIRED', statusCode: 403, data: { code: 'SHARE_PASSCODE_REQUIRED', requiresPasscode: true } });
  const input = screen.getByPlaceholderText('Enter passcode');
  expect(input).toHaveAttribute('maxlength', '128');
  fireEvent.change(input, { target: { value: 'p'.repeat(128) } });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  expect(await screen.findByText('Incorrect passcode. Please try again.')).toBeInTheDocument();
  expect(api.homeGuest.viewSharedResource).toHaveBeenLastCalledWith('ab'.repeat(32), 'p'.repeat(128));
  jest.mocked(api.homeGuest.viewSharedResource).mockResolvedValue({
    grant: { resource_type: 'HomeTask', can_view: true, can_edit: false, expires_at: '2099-01-01T00:00:00Z' },
    resource: { id: 'task', title: 'Exact task', status: 'open' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Unlock' }));
  // The success view names the resource in its heading and its body.
  expect(await screen.findAllByText('Exact task')).not.toHaveLength(0);
});

function cleanupRender() { document.body.innerHTML = ''; }

// ============================================================
// The Settings "Guest Passes" entry (/app/homes/[id]/share). The API returns a
// raw token; only the public /guest route opens it, so that is what "Share
// link copied" must put on the clipboard, and the list must repeat the API's
// status decisions instead of calling a scheduled or dead link Active.
// ============================================================

test('the Settings entry copies the public guest route, never the bare token', async () => {
  listed([]);
  jest.mocked(api.homeIam.createGuestPass).mockResolvedValue({ token, pass: {
    id: 'pass', home_id: 'home', label: 'Ana (guest)', kind: 'guest', end_at: '2099-01-01T00:00:00Z',
    included_sections: ['wifi'], view_count: 0, status: 'active',
  } } as Awaited<ReturnType<typeof api.homeIam.createGuestPass>>);
  render(<SharePage />);
  fireEvent.click(await screen.findByRole('button', { name: /New Pass/ }));
  fireEvent.click(screen.getByRole('button', { name: /Guest 48 hours/ }));
  fireEvent.change(screen.getByPlaceholderText('Guest name'), { target: { value: 'Ana' } });
  fireEvent.click(screen.getByRole('button', { name: /Create & Share/ }));
  await waitFor(() => expect(clipboard).toHaveBeenCalledWith(`${window.location.origin}/guest/${token}`));
  expect(clipboard).not.toHaveBeenCalledWith(token);
  expect(api.homeIam.createGuestPass).toHaveBeenCalledWith('home', { label: 'Ana (guest)', kind: 'guest' });
});

test('the Settings entry lists scheduled links as current and revocable, and dead links as past', async () => {
  listed([
    { ...basePass, id: 'legacy', label: 'Legacy pass', kind: 'guest', end_at: '2099-01-01T00:00:00Z', status: 'reissue_required' },
    { ...basePass, id: 'later', label: 'Scheduled pass', kind: 'guest', start_at: '2099-01-01T00:00:00Z',
      end_at: '2099-02-01T00:00:00Z', status: 'scheduled' },
    { ...basePass, id: 'gone', label: 'Revoked pass', kind: 'guest', end_at: '2099-01-01T00:00:00Z',
      revoked_at: '2021-01-01T00:00:00Z', status: 'revoked' },
    { ...basePass, id: 'live', label: 'Live pass', kind: 'wifi_only', end_at: '2099-01-01T00:00:00Z', status: 'active' },
  ]);
  render(<SharePage />);
  expect(await screen.findByText('Active Passes (2)')).toBeInTheDocument();
  expect(screen.getByText('Past Passes (2)')).toBeInTheDocument();
  expect(screen.getByText(/^Starts /)).toBeInTheDocument();
  expect(screen.getAllByTitle('Revoke')).toHaveLength(2);
  expect(screen.getByText('Needs new link')).toBeInTheDocument();
  expect(screen.getByText('Revoked')).toBeInTheDocument();
  expect(api.homeIam.getGuestPasses).toHaveBeenCalledWith('home', { include_revoked: true });
});
