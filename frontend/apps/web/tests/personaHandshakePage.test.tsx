/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockReplace = jest.fn();
const mockPush    = jest.fn();
const stableRouter = { replace: mockReplace, push: mockPush };
let mockSearchParams = new URLSearchParams('tier_rank=1');
let mockParams: Record<string, string> = { handle: 'mayabuilds' };

jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => mockSearchParams,
  useParams: () => mockParams,
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) =>
    React.createElement('a', { href: String(href), ...props }, children),
}));

jest.mock('@/components/ui/toast-store', () => ({
  toast: {
    success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn(),
  },
}));

const mockFlagEnabled = jest.fn().mockReturnValue(true);
jest.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: (name: string) => mockFlagEnabled(name),
  useFeatureFlagState: (name: string) => ({
    enabled: mockFlagEnabled(name),
    isLoading: false,
    isFetched: true,
    error: null,
  }),
}));

const apiMock = require('@pantopus/api');

const PERSONA = {
  id: 'persona-1',
  handle: 'mayabuilds',
  displayName: 'Maya Builds',
  followerCount: 12,
  audienceLabel: 'followers',
  audienceMode: 'open',
  bio: '',
  publicLinks: [],
  viewer: { isFollowing: false, isOwner: false, followStatus: 'none', notificationLevel: 'all' },
} as any;

beforeEach(() => {
  jest.clearAllMocks();
  mockFlagEnabled.mockReturnValue(true);
  mockSearchParams = new URLSearchParams('tier_rank=1');
  mockParams = { handle: 'mayabuilds' };
  apiMock.personas.getPersona.mockResolvedValue({ persona: PERSONA, channel: null });
  apiMock.personas.getFanHandleSuggestion.mockResolvedValue({ suggestion: 'fan_a8f3deea' });
  apiMock.personas.followPersonaWithHandshake.mockResolvedValue({
    status: 'active',
    membership: { id: 'm1', fan_handle: 'fan_a8f3deea', tier_id: 't1', status: 'active' },
  });
});

afterEach(cleanup);

function loadPage() {
  return require('@/app/(app)/app/persona/[handle]/follow/page').default;
}

describe('FollowHandshakePage', () => {
  test('with the flag off, redirects back to /@handle', async () => {
    mockFlagEnabled.mockReturnValue(false);
    const Page = loadPage();
    await act(async () => { render(<Page />); });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/@mayabuilds'));
  });

  test('pre-fills the suggested fan_handle from the server', async () => {
    const Page = loadPage();
    await act(async () => { render(<Page />); });
    const handleInput = await screen.findByLabelText(/Beacon fan name/);
    expect((handleInput as HTMLInputElement).value).toBe('fan_a8f3deea');
    expect(apiMock.personas.getFanHandleSuggestion).toHaveBeenCalledWith('mayabuilds');
  });

  test('Continue is disabled until the platform-trust acknowledgement is ticked', async () => {
    const Page = loadPage();
    await act(async () => { render(<Page />); });
    await screen.findByLabelText(/Beacon fan name/);
    const button = screen.getByRole('button', { name: /Continue/ });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/I understand the privacy disclosure/));
    expect(button).not.toBeDisabled();
  });

  test('submitting the free Follower handshake calls followPersonaWithHandshake with ack=true', async () => {
    const Page = loadPage();
    await act(async () => { render(<Page />); });
    await screen.findByLabelText(/Beacon fan name/);
    fireEvent.click(screen.getByLabelText(/I understand the privacy disclosure/));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    });

    expect(apiMock.personas.followPersonaWithHandshake).toHaveBeenCalledWith(
      'persona-1',
      expect.objectContaining({
        tier_rank: 1,
        fan_handle: 'fan_a8f3deea',
        acknowledged_platform_trust: true,
      }),
    );
    await waitFor(() => expect(mockPush)
      .toHaveBeenCalledWith('/@mayabuilds?welcome=1'));
  });

  test('paid tier_rank shows the "Continue to subscribe" label and routes to a placeholder when subscribeUrl is null', async () => {
    mockSearchParams = new URLSearchParams('tier_rank=2');
    apiMock.personas.followPersonaWithHandshake.mockResolvedValue({
      requiresPayment: true, subscribeUrl: null,
      handshake: {
        tier_rank: 2, tier_id: 't2', fan_handle: 'fan_a8f3deea',
        fan_display_name: 'fan_a8f3deea', fan_avatar_url: null,
      },
    });
    const Page = loadPage();
    await act(async () => { render(<Page />); });
    await screen.findByLabelText(/Beacon fan name/);
    fireEvent.click(screen.getByLabelText(/I understand the privacy disclosure/));

    expect(screen.getByRole('button', { name: /Continue to subscribe/ })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue to subscribe/ }));
    });
    await waitFor(() => expect(mockPush)
      .toHaveBeenCalledWith('/@mayabuilds?handshake=pending'));
  });

  test('a 409 fan_handle_taken response surfaces an actionable error', async () => {
    apiMock.personas.followPersonaWithHandshake.mockRejectedValue(
      new Error('HTTP 409 fan_handle_taken'),
    );
    const Page = loadPage();
    await act(async () => { render(<Page />); });
    await screen.findByLabelText(/Beacon fan name/);
    fireEvent.click(screen.getByLabelText(/I understand the privacy disclosure/));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/already taken/i);
  });
});
