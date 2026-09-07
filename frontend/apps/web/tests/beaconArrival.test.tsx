import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AudienceProfile } from '@pantopus/types';
const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
let token: string | null = null;
let flag = false;
const follow = jest.fn();
const persona = { id: 'p1', handle: 'garden', displayName: 'Garden club', audienceLabel: 'Followers', audienceMode: 'open', followerCount: 2, publicLinks: [], viewer: { isOwner: false, isFollowing: false, followStatus: null, notificationLevel: 'none' } } as unknown as AudienceProfile;
jest.mock('@pantopus/api', () => ({
  getAuthToken: () => token,
  personas: {
    getPersona: () => Promise.resolve({ persona }), getPersonaPosts: () => Promise.resolve({ posts: [] }),
    followPersona: (...args: unknown[]) => follow(...args),
  },
}));
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => flag }));
jest.mock('@/lib/identityAnalytics', () => ({ trackIdentityEvent: jest.fn() }));
jest.mock('@/components/public-share/OpenInAppButton', () => ({ children }: { children: React.ReactNode }) => <button>{children}</button>);
import Beacon from '../src/app/persona/[personaHandle]/AudienceProfileClient';
function show() { return render(<Beacon initialPersona={persona} initialChannel={null} appUrl="/app/persona/garden" linkHref="/persona/garden" fallbackUrl={null} storeCta={null} />); }
beforeEach(() => { token = null; flag = false; jest.clearAllMocks(); });

it('returns signed-out followers to the same Beacon without sending a follow request', async () => {
  show();
  await screen.findByText('Garden club');
  expect(follow).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Follow Garden club' }));
  expect(push).toHaveBeenCalledWith('/login?redirectTo=%2Fpersona%2Fgarden');
  expect(follow).not.toHaveBeenCalled();
});

it('shows failure, permits retry, and follows only on a deliberate click', async () => {
  token = 'session';
  follow.mockRejectedValueOnce(new Error('Try again later')).mockResolvedValueOnce({ status: 'active' });
  show();
  await screen.findByText('Garden club');
  expect(follow).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Follow Garden club' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again later');
  fireEvent.click(screen.getByRole('button', { name: 'Follow Garden club' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Following this Beacon' })).toBeDisabled());
  expect(follow).toHaveBeenCalledTimes(2);
});

it('preserves the explicit handshake route when the audience flag is on', () => {
  flag = true; show();
  expect(screen.getByRole('link', { name: 'Follow Garden club' })).toHaveAttribute('href', '/app/persona/garden/follow?tier_rank=1');
  expect(follow).not.toHaveBeenCalled();
});
