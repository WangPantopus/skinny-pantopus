import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import MembersPage from '../src/app/(app)/app/homes/[id]/members/page';
import WaitingRoomPage from '../src/app/(app)/app/homes/[id]/waiting-room/page';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({ useParams: () => ({ id: '10000000-0000-4000-8000-000000000001' }),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }), useSearchParams: () => ({ get: () => null }) }));
jest.mock('../src/hooks/useHomeAccess', () => ({ useHomeAccess: () => ({ loading: false, needsVerification: true,
  access: { verification_status: 'pending_approval' }, reload: jest.fn() }) }));
jest.mock('@pantopus/api', () => ({ getApiBaseUrl: jest.fn(() => 'http://127.0.0.1:18080'), getAuthToken: jest.fn(() => 'synthetic'),
  AUTH_SESSION_CHANGE_KEY: 'session-marker', onTokenChange: jest.fn(() => () => {}),
  homeIam: { getHomeMembers: jest.fn(), getMyHomeAccess: jest.fn(), getAuditLog: jest.fn(), removeMember: jest.fn() },
  getHouseholdAccessRequests: jest.fn(), post: jest.fn() }));
const home = '10000000-0000-4000-8000-000000000001';
const target = '10000000-0000-4000-8000-000000000002';
const row = (role: string, id = target, username = 'fixture_member') => ({ id: '10000000-0000-4000-8000-000000000003',
  home_id: home, user_id: id, role, role_base: role, is_active: true, user: { id, username, name: null } });
beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear();
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  jest.mocked(api.homeIam.getHomeMembers).mockResolvedValue({ occupants: [row('member')] } as never);
  jest.mocked(api.homeIam.getMyHomeAccess).mockResolvedValue({ hasAccess: true, isOwner: true, role_base: 'owner', permissions: ['members.view', 'members.manage'] } as never);
  jest.mocked(api.homeIam.getAuditLog).mockResolvedValue({ entries: [] } as never);
  jest.mocked(api.getHouseholdAccessRequests).mockResolvedValue({ requests: [] } as never);
});
test('all supported household roles remain visible and named Remove opens review without DELETE', async () => {
  jest.mocked(api.homeIam.getHomeMembers).mockResolvedValue({ occupants: [row('lease_resident'),
    row('service_provider', '10000000-0000-4000-8000-000000000004', 'fixture_provider')] } as never);
  render(<MembersPage/>);
  await screen.findByRole('heading', { name: 'Lease members' });
  expect(screen.getByRole('heading', { name: 'Service providers' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Review removal of fixture_member' }));
  expect(mockPush).toHaveBeenCalledWith(`/app/homes/member-removals?home=${home}&target=${target}`);
  expect(api.homeIam.removeMember).not.toHaveBeenCalled();
});
test('an owner label cannot restore denied manage controls, while recovery stays reachable', async () => {
  jest.mocked(api.homeIam.getMyHomeAccess).mockResolvedValue({ hasAccess: true, isOwner: true, role_base: 'owner', permissions: ['members.view'] } as never);
  render(<MembersPage/>); await screen.findByRole('heading', { name: 'Members', level: 1 });
  expect(screen.queryByRole('button', { name: /Review removal of/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Invite' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Recover a member removal' })).toHaveAttribute('href', '/app/homes/member-removals');
});
test('a held old success cannot restore members after a newer failed current read', async () => {
  let resolve!: (value: unknown) => void;
  const old = new Promise<unknown>(r => { resolve = r; });
  jest.mocked(api.homeIam.getHomeMembers).mockImplementationOnce(async () => await old as never)
    .mockRejectedValueOnce(Error('Current roster unavailable'));
  render(<MembersPage/>);
  await waitFor(() => expect(api.homeIam.getHomeMembers).toHaveBeenCalledTimes(1));
  fireEvent.focus(window);
  await screen.findByRole('button', { name: 'Members (unavailable)' });
  expect(screen.queryByText('No members yet')).not.toBeInTheDocument();
  await act(async () => { resolve({ occupants: [row('member')] }); await old; });
  expect(screen.getByRole('button', { name: 'Members (unavailable)' })).toBeVisible();
  expect(screen.queryByText('fixture_member')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Review removal of/ })).not.toBeInTheDocument();
});
test('waiting-room self-leave opens protected review without claiming removal or renewed access', async () => {
  render(<WaitingRoomPage/>);
  await screen.findByRole('heading', { name: 'Waiting for approval' });
  fireEvent.click(screen.getByRole('button', { name: /This isn't my home/ }));
  expect(mockPush).toHaveBeenCalledWith(`/app/homes/member-removals?home=${home}&self=1`);
  expect(api.post).not.toHaveBeenCalled(); expect(api.homeIam.removeMember).not.toHaveBeenCalled();
});
