import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TextEncoder } from 'util';
import * as api from '@pantopus/api';
import CreateGuestPass from '../src/components/home/share/CreateGuestPass';
import ScopedShareModal from '../src/components/home/share/ScopedShareModal';

jest.mock('@pantopus/api', () => ({ homeIam: {
  createGuestPass: jest.fn(), createScopedGrant: jest.fn(),
} }));
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
  jest.mocked(api.homeIam.createScopedGrant).mockRejectedValue(new Error('The shared content is no longer available.'));
  render(<ScopedShareModal open onClose={() => {}} homeId="home"
    resourceId="restricted-task" resourceType="HomeTask" />);
  fireEvent.click(screen.getByRole('button', { name: 'Create Link' }));
  expect(await screen.findByText('The shared content is no longer available.')).toBeInTheDocument();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(clipboard).not.toHaveBeenCalled();
});
