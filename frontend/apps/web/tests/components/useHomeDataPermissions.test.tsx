import { renderHook, waitFor } from '@testing-library/react';
import { useHomeData } from '../../src/hooks/useHomeData';

const mockAccess = jest.fn();
const mockDashboard = jest.fn();
const mockRouter = { push: jest.fn() };
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@pantopus/api', () => ({
  getApiBaseUrl: () => 'http://localhost',
  AUTH_SESSION_CHANGE_KEY: 'pantopus_auth_session_change',
  onTokenChange: () => () => {},
  getAuthToken: () => 'token',
  users: { getMyProfile: async () => ({ id: 'owner' }) },
  homeIam: { getMyHomeAccess: (...args: unknown[]) => mockAccess(...args) },
  homeProfile: {
    getHomeDashboard: (...args: unknown[]) => mockDashboard(...args),
    getHomeAccessSecrets: async () => ({ secrets: [] }),
    getHomeEmergencies: async () => ({ emergencies: [] }),
    getHomePets: async () => ({ pets: [] }),
    getHomePolls: async () => ({ polls: [] }),
  },
}));

beforeEach(() => {
  mockAccess.mockReset();
  mockDashboard.mockReset();
});

test('owner pointers and owner role do not restore denied permission buttons', async () => {
  mockAccess.mockResolvedValue({ hasAccess: true, isOwner: true, role_base: 'owner', permissions: ['home.view'] });
  mockDashboard.mockResolvedValue({ home: { id: 'home', owner_id: 'owner' }, myAccess: {
    isOwner: false, role_base: 'owner', permissions: ['home.view'],
  } });
  const { result } = renderHook(() => useHomeData('home'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.myAccess.isOwner).toBe(false);
  expect(result.current.can('home.view')).toBe(true);
  expect(result.current.can('finance.manage')).toBe(false);
});

test('missing access information never turns an empty permission list into a grant', async () => {
  mockAccess.mockRejectedValue(new Error('Unavailable'));
  mockDashboard.mockResolvedValue({ home: { id: 'home', owner_id: 'owner' } });
  const { result } = renderHook(() => useHomeData('home'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.can('home.edit')).toBe(false);
});
