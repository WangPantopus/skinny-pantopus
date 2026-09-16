import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as api from '@pantopus/api';
import PublicProfileClient from '@/app/[username]/PublicProfileClient';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

jest.mock('@pantopus/api', () => ({
  getAuthToken: jest.fn(() => 'session-a'), onTokenChange: jest.fn(() => jest.fn()), AUTH_SESSION_CHANGE_KEY: 'auth-change',
  blocks: { blockUser: jest.fn() },
  users: { getProfileByUsername: jest.fn(), getMyProfile: jest.fn(), getRelationshipStatus: jest.fn(), reportUser: jest.fn() },
  gigs: { getGigs: jest.fn() }, posts: { getUserPosts: jest.fn() },
  reviews: { getUserReviews: jest.fn(), getPendingReviews: jest.fn() },
}));
jest.mock('@pantopus/utils', () => ({ buildUserProfileShareUrl: jest.fn() }));
jest.mock('next/navigation', () => { const router = { push: jest.fn() }; return { useRouter: () => router }; });
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/ui/toast-store', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('@/components/ui/confirm-store', () => ({ confirmStore: { open: jest.fn() } }));
jest.mock('@/components/business/BusinessPublicProfile', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/profile/public/cards', () => ({ ReliabilityPanel: () => null, AboutCard: () => null, SkillsCard: () => null }));
jest.mock('@/components/profile/public/tabs', () => Object.fromEntries(
  ['OverviewTab', 'ServicesTab', 'MissionsTab', 'PortfolioTab', 'ActivityTab', 'ReviewsTab', 'OwnerInsightsTab', 'OwnerSettingsTab'].map(k => [k, () => null]),
));
beforeEach(() => {
  jest.clearAllMocks();
  (api.users.getMyProfile as jest.Mock).mockResolvedValue({ id: 'viewer', username: 'viewer' });
  (api.users.getRelationshipStatus as jest.Mock).mockResolvedValue({ following: false, relationship: 'none' });
  (api.gigs.getGigs as jest.Mock).mockResolvedValue({ gigs: [{ id: 'gig' }] });
  (api.posts.getUserPosts as jest.Mock).mockResolvedValue({ posts: [{ id: 'post' }] });
  (api.reviews.getUserReviews as jest.Mock).mockResolvedValue({ reviews: [] });
  (api.reviews.getPendingReviews as jest.Mock).mockResolvedValue({ pending: [] });
  (api.users.reportUser as jest.Mock).mockResolvedValue({ message: 'Reported' });
});
async function openProfile() {
  render(<PublicProfileClient username="bob" initialProfile={{ id: 'bob', username: 'bob', name: 'Bob' } as never} />);
  await waitFor(() => expect(api.users.getRelationshipStatus).toHaveBeenCalled());
  fireEvent.click(screen.getByText('⋯'));
}
test('existing report menu opens the existing modal and submits the selected reason', async () => {
  await openProfile();
  fireEvent.click(screen.getByRole('button', { name: 'Report profile' }));
  expect(await screen.findByText('Report User')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Harassment or bullying' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
  await waitFor(() => expect(api.users.reportUser).toHaveBeenCalledWith('bob', 'harassment', undefined));
  await waitFor(() => expect(screen.queryByText('Report User')).not.toBeInTheDocument());
});
test('failed report keeps selection and supports retry without claiming success', async () => {
  (api.users.reportUser as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await openProfile();
  fireEvent.click(screen.getByRole('button', { name: 'Report profile' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Safety concern' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.getByText('Report User')).toBeInTheDocument();
  expect(toast.success).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
});
test('account change while block confirmation is open cannot block as the new account', async () => {
  let resolve!: (value: boolean) => void;
  (confirmStore.open as jest.Mock).mockReturnValue(new Promise(r => { resolve = r; }));
  await openProfile();
  fireEvent.click(screen.getByRole('button', { name: 'Block user' }));
  const changed = (api.onTokenChange as jest.Mock).mock.calls[0]?.[0];
  expect(changed).toBeDefined();
  await act(async () => changed('session-a'));
  await act(async () => resolve(true));
  expect(api.blocks.blockUser).not.toHaveBeenCalled();
});

test('a settled empty profile does not repeatedly fetch the signed-in user', async () => {
  let reads = 0;
  (api.users.getMyProfile as jest.Mock).mockImplementation(() => {
    reads++;
    return reads > 2 ? new Promise(() => {}) : Promise.resolve({ id: 'viewer', username: 'viewer' });
  });
  await openProfile();
  await act(async () => {});
  expect(api.users.getMyProfile).toHaveBeenCalledTimes(1);
});

test('profile navigation retires pending confirmation and allows the new target action', async () => {
  let resolve!: (value: boolean) => void;
  (confirmStore.open as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValue(true);
  (api.blocks.blockUser as jest.Mock).mockResolvedValue({ success: true });
  const bob = { id: 'bob', username: 'bob', name: 'Bob' };
  const carol = { id: 'carol', username: 'carol', name: 'Carol' };
  const view = render(<PublicProfileClient username="bob" initialProfile={bob as never} />);
  await waitFor(() => expect(api.users.getRelationshipStatus).toHaveBeenCalled());
  fireEvent.click(screen.getByText('⋯'));
  fireEvent.click(screen.getByRole('button', { name: 'Block user' }));
  view.rerender(<PublicProfileClient username="carol" initialProfile={carol as never} />);
  await act(async () => resolve(true));
  expect(api.blocks.blockUser).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('⋯'));
  fireEvent.click(screen.getByRole('button', { name: 'Block user' }));
  await waitFor(() => expect(api.blocks.blockUser).toHaveBeenCalledWith('carol'));
});

test('profile navigation closes a report for the previous target', async () => {
  const view = render(<PublicProfileClient username="bob" initialProfile={{ id: 'bob', username: 'bob', name: 'Bob' } as never} />);
  await waitFor(() => expect(api.users.getRelationshipStatus).toHaveBeenCalled());
  fireEvent.click(screen.getByText('⋯'));
  fireEvent.click(screen.getByRole('button', { name: 'Report profile' }));
  expect(await screen.findByText('Report User')).toBeInTheDocument();
  view.rerender(<PublicProfileClient username="carol" initialProfile={{ id: 'carol', username: 'carol', name: 'Carol' } as never} />);
  await waitFor(() => expect(screen.queryByText('Report User')).not.toBeInTheDocument());
});
