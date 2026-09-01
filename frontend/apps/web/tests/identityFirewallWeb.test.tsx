/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const mockRedirect = jest.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
  notFound: () => mockNotFound(),
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }),
}));

jest.mock('next/server', () => {
  const buildResponse = (headers: Record<string, string> = {}) => ({
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    cookies: {
      set: jest.fn(),
    },
  });

  return {
    NextRequest: class {},
    NextResponse: {
      rewrite: (url: URL) => buildResponse({ 'x-middleware-rewrite': String(url) }),
      redirect: (url: URL) => buildResponse({ location: String(url) }),
      next: () => buildResponse(),
    },
  };
});

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    require('react').createElement('a', { href: String(href), ...props }, children),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: { src?: string; alt?: string }) =>
    require('react').createElement('img', { src: typeof src === 'string' ? src : '', alt: alt || '', ...props }),
}));

jest.mock('@/components/ai-assistant', () => ({
  InlineDraftHelper: () => null,
}));

// P1.8 — AudienceProfileClient now reads the audience_profile feature
// flag via useFeatureFlag (which uses @tanstack/react-query). These
// tests render the component without a QueryClientProvider, so stub
// the hook to keep the legacy (flag-off) render path active. The new
// flag-on render path has its own dedicated test file.
jest.mock('@/hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => false,
  useFeatureFlagState: () => ({
    enabled: false,
    isLoading: false,
    isFetched: true,
    error: null,
  }),
}));

jest.mock('@/components/ui/toast-store', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

const mockFetchPublicLocalProfile = jest.fn();
const mockFetchPublicPersona = jest.fn();
const mockFetchPublicUser = jest.fn();

jest.mock('@/lib/publicShare', () => ({
  buildShareMetadata: jest.fn((opts: { title: string; description: string; path: string }) => ({
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
  })),
  fetchPublicLocalProfile: (...args: unknown[]) => mockFetchPublicLocalProfile(...args),
  fetchPublicPersona: (...args: unknown[]) => mockFetchPublicPersona(...args),
  fetchPublicUser: (...args: unknown[]) => mockFetchPublicUser(...args),
  normalizePublicProfileIdentifier: (value: string) => String(value || '').trim().replace(/^@+/, ''),
  getStoreDownloadCta: () => ({ href: 'https://apps.example.test/pantopus', label: 'Download on App Store' }),
  displayNameForUser: (user: any, fallback = 'Pantopus member') => user?.name || user?.username || fallback,
  summarizeText: (value: unknown, max = 160, fallback = '') => {
    const text = typeof value === 'string' ? value : '';
    return text ? text.slice(0, max) : fallback;
  },
}));

const mockApi = {
  posts: {
    getPostingIdentities: jest.fn(),
    precheckPost: jest.fn(),
  },
  identityCenter: {
    getIdentityCenter: jest.fn(),
    getViewAsPreview: jest.fn(),
    updateBridgeSettings: jest.fn(),
  },
  localProfiles: {
    getLocalProfileActivity: jest.fn(),
    getLocalProfileGigs: jest.fn(),
    getLocalProfileListings: jest.fn(),
  },
  personas: {
    getPersona: jest.fn(),
    getPersonaPosts: jest.fn(),
    followPersona: jest.fn(),
    updatePersonaFollowPreferences: jest.fn(),
    getPersonaFollowers: jest.fn(),
    updatePersonaFollower: jest.fn(),
    getPersonaCategoryPolicies: jest.fn(),
    getMyPersona: jest.fn(),
    createPersona: jest.fn(),
    updatePersona: jest.fn(),
  },
  upload: {
    uploadPersonaMedia: jest.fn(),
    uploadPostMedia: jest.fn(),
  },
  broadcast: {
    getBroadcastMessages: jest.fn(),
    publishBroadcastMessage: jest.fn(),
    markBroadcastMessageRead: jest.fn(),
  },
  users: {
    getMyProfile: jest.fn(),
    getProfileById: jest.fn(),
    getProfileByUsername: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
  },
  auth: {
    logout: jest.fn(),
  },
  geo: {
    resolve: jest.fn(),
  },
  getAuthToken: jest.fn(),
  clearAuthToken: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  del: jest.fn(),
};

jest.mock('@pantopus/api', () => mockApi);

const PostComposer = require('../src/components/feed/PostComposer').default;
const IdentityCenterPage = require('../src/app/(app)/app/identity/page').default;
const SettingsPage = require('../src/app/(app)/app/profile/settings/page').default;
const AudienceProfileSettingsPage = require('../src/app/(app)/app/persona/page').default;
const PersonaBroadcastPage = require('../src/app/(app)/app/persona/broadcast/page').default;
const AudienceProfilePage = require('../src/app/persona/[personaHandle]/page').default;
const LegacyPublicProfilePage = require('../src/app/[username]/page').default;
const { middleware } = require('../src/middleware');
const { toast: mockToast } = require('@/components/ui/toast-store');

function buildLocalProfile(overrides: Record<string, any> = {}) {
  return {
    type: 'local',
    id: 'local-1',
    handle: 'riverhome',
    displayName: 'RiverHome',
    avatarUrl: null,
    bio: 'Local neighbor profile',
    tagline: 'Verified resident',
    href: '/riverhome',
    badges: ['Verified Resident'],
    locality: { city: 'Seattle', state: 'WA', neighborhood: null, precision: 'city' },
    stats: { reviews: 0, gigsCompleted: 0, marketplaceSales: 0 },
    viewer: { relationshipStatus: 'none', isFollowingLocal: false, canMessage: false },
    bridges: { audienceProfile: null },
    ...overrides,
  };
}

function buildAudienceProfile(overrides: Record<string, any> = {}) {
  return {
    type: 'persona',
    id: 'persona-1',
    handle: 'mayabuilds',
    displayName: 'Maya Builds',
    avatarUrl: null,
    bannerUrl: null,
    bio: 'Audience profile for tutorials',
    href: '/@mayabuilds',
    publicLinks: [],
    category: 'creator',
    audienceLabel: 'followers',
    audienceMode: 'open',
    followerCount: 42,
    postCount: 3,
    broadcastEnabled: true,
    viewer: {
      isFollowing: false,
      relationshipType: null,
      notificationLevel: 'all',
      followStatus: 'none',
      isOwner: false,
    },
    bridges: { localProfile: null },
    ...overrides,
  };
}

function buildMiddlewareRequest(input: string) {
  const url = new URL(input);
  return {
    url: input,
    nextUrl: {
      pathname: url.pathname,
      search: url.search,
    },
    cookies: {
      get: jest.fn(),
    },
  } as any;
}

const analyticsEventRemovers: Array<() => void> = [];

function collectIdentityAnalyticsEvents() {
  const events: Array<{ eventName: string; properties?: Record<string, unknown> }> = [];
  const handler = (event: Event) => {
    events.push((event as CustomEvent).detail);
  };
  window.addEventListener('pantopus:identity-analytics', handler);
  analyticsEventRemovers.push(() => window.removeEventListener('pantopus:identity-analytics', handler));
  return events;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
  mockApi.posts.precheckPost.mockResolvedValue({ suggestions: [] });
  mockApi.posts.getPostingIdentities.mockResolvedValue({ identities: [] });
  mockApi.localProfiles.getLocalProfileActivity.mockResolvedValue({ posts: [] });
  mockApi.localProfiles.getLocalProfileGigs.mockResolvedValue({ gigs: [] });
  mockApi.localProfiles.getLocalProfileListings.mockResolvedValue({ listings: [] });
  mockApi.personas.getPersona.mockResolvedValue({ persona: buildAudienceProfile() });
  mockApi.personas.getPersonaPosts.mockResolvedValue({ posts: [] });
  mockApi.personas.getPersonaFollowers.mockResolvedValue({
    followers: [],
    counts: { total: 0, pending: 0, active: 0, muted: 0, blocked: 0, removed: 0 },
  });
  mockApi.personas.getPersonaCategoryPolicies.mockResolvedValue({
    sensitiveCategoriesEnabled: false,
    categories: [
      { category: 'creator', label: 'Creator', sensitive: false, enabled: true, requirements: [] },
      { category: 'writer', label: 'Writer', sensitive: false, enabled: true, requirements: [] },
      { category: 'coach', label: 'Coach', sensitive: false, enabled: true, requirements: [] },
      { category: 'consultant', label: 'Consultant', sensitive: false, enabled: true, requirements: [] },
      { category: 'community_leader', label: 'Community Leader', sensitive: false, enabled: true, requirements: [] },
      { category: 'public_figure', label: 'Public Figure', sensitive: false, enabled: true, requirements: [] },
      { category: 'other', label: 'Other Public Role', sensitive: false, enabled: true, requirements: [] },
      { category: 'doctor', label: 'Doctor', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'organization_review', 'consent_controls'] },
      { category: 'teacher', label: 'Teacher', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'organization_review', 'consent_controls', 'minor_safeguards'] },
      { category: 'tutor', label: 'Tutor', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'consent_controls', 'minor_safeguards'] },
    ],
  });
  mockApi.personas.updatePersonaFollower.mockResolvedValue({
    follower: {
      id: 'follow-1',
      status: 'active',
      relationshipType: 'follower',
      notificationLevel: 'all',
      publicVisibility: 'visible_to_owner',
      follower: buildLocalProfile({ displayName: 'RiverHome' }),
    },
  });
  mockApi.personas.updatePersonaFollowPreferences.mockResolvedValue({
    following: true,
    status: 'active',
    relationshipType: 'follower',
    notificationLevel: 'none',
  });
  mockApi.broadcast.getBroadcastMessages.mockResolvedValue({
    channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    persona: buildAudienceProfile(),
    messages: [],
    analytics: { deliveredCount: 0, readCount: 0 },
  });
  mockApi.broadcast.markBroadcastMessageRead.mockResolvedValue({
    message: { id: 'broadcast-1', read_count: 1 },
  });
  mockApi.personas.getMyPersona.mockResolvedValue({
    persona: buildAudienceProfile(),
    channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
  });
  mockApi.personas.updatePersona.mockResolvedValue({ persona: buildAudienceProfile() });
  mockApi.personas.createPersona.mockResolvedValue({
    persona: buildAudienceProfile(),
    channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
  });
  mockApi.upload.uploadPersonaMedia.mockResolvedValue({
    message: 'avatar uploaded successfully',
    url: 'https://cdn.example.com/persona-avatar.webp',
    key: 'persona-media/persona-1/avatar.webp',
    persona: {
      id: 'persona-1',
      handle: 'mayabuilds',
      avatar_url: 'https://cdn.example.com/persona-avatar.webp',
      banner_url: null,
    },
  });
});

afterEach(() => {
  analyticsEventRemovers.splice(0).forEach((remove) => remove());
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('Profiles & Privacy web pages', () => {
  test('AppShell exposes Profiles & Privacy in persistent and mobile navigation', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../src/components/AppShell.tsx'), 'utf8');

    expect(source).toContain('identityCopy.profilesPrivacyTitle');
    expect(source).toContain("router.push('/app/identity')");
    expect(source).toContain("pathname.startsWith('/app/identity')");
    expect(source).toContain("pathname.startsWith('/app/persona')");
    expect(source).toContain('showIdentityNavigation');
  });

  test('Settings does not replace the restored Profile settings page with identity-center navigation', async () => {
    mockApi.getAuthToken.mockReturnValue('token');
    mockApi.users.getMyProfile.mockResolvedValue({
      email: 'maya@example.com',
      username: 'maya',
      email_notifications: true,
      push_notifications: true,
      profile_visibility: 'public',
      show_email: false,
      show_phone: false,
    });

    render(<SettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Profiles & Privacy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Profiles & Privacy$/i })).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /Identity Center/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Audience Profile/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Broadcast/i })).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalledWith('/app/identity');
    expect(mockPush).not.toHaveBeenCalledWith('/app/persona');
    expect(mockPush).not.toHaveBeenCalledWith('/app/persona/broadcast');
  });

  test('Profiles & Privacy renders every identity card and uses backend Privacy Preview results', async () => {
    const analyticsEvents = collectIdentityAnalyticsEvents();
    const localProfile = buildLocalProfile();
    const audienceProfile = buildAudienceProfile();
    const backendPreviewProfile = buildAudienceProfile({
      displayName: 'Backend Preview Persona',
      bridges: { localProfile: buildLocalProfile({ displayName: 'Approved Local Bridge' }) },
    });

    mockApi.identityCenter.getIdentityCenter.mockResolvedValue({
      privateAccount: { email: 'maya@example.com', verified: true },
      localProfile,
      audienceProfile,
      bridges: { show_persona_on_local: false, show_local_on_persona: false },
      homes: [{ type: 'home', id: 'home-1', displayName: 'Home Identity' }],
      businessProfiles: [{ type: 'business', id: 'business-1', displayName: 'Business Seat' }],
    });
    mockApi.identityCenter.getViewAsPreview.mockResolvedValue({
      surface: 'persona',
      viewer: 'persona_audience_member',
      viewerLabel: 'Audience member',
      profile: backendPreviewProfile,
      visibleSections: [
        { key: 'profile', label: 'Audience Profile name, handle, avatar, bio, and public links' },
        { key: 'posts', label: 'Public and follower-only Audience posts' },
      ],
      protectedSections: [
        { key: 'home', label: 'Home address, household membership, mailbox activity, and exact local location' },
        { key: 'direct_chat', label: 'Followers cannot open direct chat to the private account from broadcast' },
      ],
      counts: { visiblePosts: 1, hiddenPosts: 2, visibleBroadcasts: 1, hiddenBroadcasts: 1 },
      sample: {
        posts: [{ id: 'post-1', content: 'Follower-only update', audience: 'followers' }],
        broadcasts: [{ id: 'broadcast-1', body: 'Follower broadcast', visibility: 'followers' }],
      },
    });

    render(<IdentityCenterPage />);

    expect(await screen.findByRole('heading', { name: 'Profiles & Privacy' })).toBeInTheDocument();
    expect(screen.getByText('Private Account')).toBeInTheDocument();
    expect(screen.getAllByText('Profile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Beacon').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Homes')).toBeInTheDocument();
    expect(screen.getByText('Business Profiles')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Profiles & Privacy sections/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Profiles & Privacy tab: Overview/i })).toHaveAttribute('href', '#overview');
    expect(screen.getByRole('link', { name: /Profiles & Privacy tab: Beacon/i })).toHaveAttribute('href', '#public-profile');
    expect(screen.getByRole('link', { name: /Profiles & Privacy tab: Profile links/i })).toHaveAttribute('href', '#profile-links');
    expect(screen.getAllByText('Profile links').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /Account Settings/i })).toHaveAttribute('href', '/app/profile/settings');
    expect(screen.getByRole('link', { name: /View Profile/i })).toHaveAttribute('href', '/riverhome');
    expect(screen.getByRole('link', { name: /Edit Profile/i })).toHaveAttribute('href', '/app/profile/edit');
    expect(screen.getByRole('link', { name: /View Beacon/i })).toHaveAttribute('href', '/@mayabuilds');
    expect(screen.getByRole('link', { name: /Manage Beacon/i })).toHaveAttribute('href', '/app/persona');
    expect(screen.getByRole('link', { name: /^Followers$/i })).toHaveAttribute('href', '/app/persona?tab=followers');
    expect(screen.getByRole('link', { name: /^Updates$/i })).toHaveAttribute('href', '/app/persona/broadcast');
    expect(screen.getByRole('link', { name: /Manage Homes/i })).toHaveAttribute('href', '/app/homes');
    expect(screen.getByRole('link', { name: /Add Home/i })).toHaveAttribute('href', '/app/homes/new');
    expect(screen.getByRole('link', { name: /Manage Businesses/i })).toHaveAttribute('href', '/app/businesses');
    expect(screen.getByRole('link', { name: /Add Business/i })).toHaveAttribute('href', '/app/business/new');
    expect(screen.getAllByText('Profile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Public' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Follower' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Advanced Privacy Preview/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Follower' }));

    await waitFor(() => {
      expect(mockApi.identityCenter.getViewAsPreview).toHaveBeenCalledWith({
        surface: 'persona',
        handle: 'mayabuilds',
        viewer: 'persona_audience_member',
      });
    });
    expect(await screen.findByText(/Backend Preview Persona/)).toBeInTheDocument();
    expect(screen.getByText(/Approved Local Bridge/)).toBeInTheDocument();
    expect(screen.getAllByText('Privacy Preview').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Visible to this viewer')).toBeInTheDocument();
    expect(screen.getByText('Kept private from this viewer')).toBeInTheDocument();
    expect(screen.getByText('Visible Posts')).toBeInTheDocument();
    expect(screen.getByText('Follower-only update')).toBeInTheDocument();
    expect(screen.getByText('Follower broadcast')).toBeInTheDocument();
    expect(screen.getByText('Hidden posts')).toBeInTheDocument();
    expect(screen.queryByText(/"displayName"/)).not.toBeInTheDocument();
    expect(analyticsEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'identity_privacy_preview_opened',
        properties: expect.objectContaining({
          surface: 'persona',
          viewer: 'persona_audience_member',
          hasLocalProfile: true,
          hasPublicProfile: true,
        }),
      }),
    ]));
  });

  test('Recommended next step focuses profile links before they are enabled', async () => {
    mockApi.identityCenter.getIdentityCenter.mockResolvedValue({
      privateAccount: { email: 'maya@example.com', verified: true },
      localProfile: buildLocalProfile(),
      audienceProfile: buildAudienceProfile(),
      bridges: { show_persona_on_local: false, show_local_on_persona: false },
      homes: [],
      businessProfiles: [],
    });

    render(<IdentityCenterPage />);

    expect(await screen.findByRole('heading', { name: 'Profiles & Privacy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Review links/i }));

    expect(window.location.hash).toBe('#profile-links');
    expect(document.activeElement).toBe(document.getElementById('profile-links'));
    expect(mockApi.identityCenter.getViewAsPreview).not.toHaveBeenCalled();
  });

  test('Recommended next step opens privacy preview after profile links are enabled', async () => {
    const analyticsEvents = collectIdentityAnalyticsEvents();
    mockApi.identityCenter.getIdentityCenter.mockResolvedValue({
      privateAccount: { email: 'maya@example.com', verified: true },
      localProfile: buildLocalProfile(),
      audienceProfile: buildAudienceProfile(),
      bridges: { show_persona_on_local: true, show_local_on_persona: false },
      homes: [],
      businessProfiles: [],
    });
    mockApi.identityCenter.getViewAsPreview.mockResolvedValue({
      surface: 'persona',
      viewer: 'public',
      viewerLabel: 'Public',
      profile: buildAudienceProfile({
        bridges: {
          localProfile: { displayName: 'RiverHome Local', handle: 'riverhome' },
        },
      }),
      visibleSections: [
        { key: 'profile', label: 'Beacon name, handle, avatar, bio, and public links' },
        { key: 'profile_link', label: 'Linked Profile' },
      ],
      protectedSections: [
        { key: 'home', label: 'Home address and household membership' },
      ],
      counts: { visiblePosts: 0, hiddenPosts: 0, visibleBroadcasts: 0, hiddenBroadcasts: 0 },
      sample: { posts: [], broadcasts: [] },
    });

    render(<IdentityCenterPage />);

    expect(await screen.findByRole('heading', { name: 'Profiles & Privacy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Open preview/i }));

    expect(window.location.hash).toBe('#privacy-preview');
    expect(document.activeElement).toBe(document.getElementById('privacy-preview'));
    await waitFor(() => {
      expect(mockApi.identityCenter.getViewAsPreview).toHaveBeenCalledWith({
        surface: 'persona',
        handle: 'mayabuilds',
        viewer: 'public',
      });
    });
    expect(await screen.findByText(/Viewing as Public/)).toBeInTheDocument();
    expect(screen.getByText('RiverHome Local')).toBeInTheDocument();
    expect(analyticsEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'identity_privacy_preview_opened',
        properties: expect.objectContaining({
          surface: 'persona',
          viewer: 'public',
          hasLocalProfile: true,
          hasPublicProfile: true,
        }),
      }),
    ]));
  });

  test('Profile links require confirmation and return focus after Escape', async () => {
    const analyticsEvents = collectIdentityAnalyticsEvents();
    mockApi.identityCenter.getIdentityCenter.mockResolvedValue({
      privateAccount: { email: 'maya@example.com', verified: true },
      localProfile: buildLocalProfile(),
      audienceProfile: buildAudienceProfile(),
      bridges: { show_persona_on_local: false, show_local_on_persona: false },
      homes: [],
      businessProfiles: [],
    });
    mockApi.identityCenter.updateBridgeSettings.mockResolvedValue({
      bridge: { show_persona_on_local: true, show_local_on_persona: false },
    });

    render(<IdentityCenterPage />);

    expect(await screen.findByRole('heading', { name: 'Profiles & Privacy' })).toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: /Let neighbors find my Beacon/i });
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Link these profiles?' })).toBeInTheDocument();
    expect(mockApi.identityCenter.updateBridgeSettings).not.toHaveBeenCalled();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Link these profiles?' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Link profiles' }));

    await waitFor(() => expect(mockApi.identityCenter.updateBridgeSettings).toHaveBeenCalledWith('persona-1', {
      show_persona_on_local: true,
      show_local_on_persona: false,
    }));
    expect(analyticsEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'identity_profile_link_changed',
        properties: expect.objectContaining({
          direction: 'local_to_public_profile',
          enabled: true,
        }),
      }),
    ]));
  });

  test('Beacon and Updates expose copyable public links', async () => {
    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: buildAudienceProfile({ handle: 'mayabuilds', displayName: 'Maya Builds' }),
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    });

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /View Beacon/i })[0]).toHaveAttribute('href', '/@mayabuilds');
    fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/@mayabuilds'));
    });

    cleanup();
    jest.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: buildAudienceProfile({ handle: 'mayabuilds', displayName: 'Maya Builds' }),
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    });
    mockApi.broadcast.getBroadcastMessages.mockResolvedValue({
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
      persona: buildAudienceProfile({ handle: 'mayabuilds' }),
      messages: [{ id: 'broadcast-1', channel_id: 'channel-1', persona_id: 'persona-1', body: 'Metrics are live', visibility: 'followers', status: 'published', media: [], delivered_count: 3, read_count: 2, created_at: '2026-05-05T13:00:00Z' }],
      analytics: { deliveredCount: 3, readCount: 2 },
    });

    const analyticsEvents = collectIdentityAnalyticsEvents();
    mockApi.broadcast.publishBroadcastMessage.mockResolvedValue({
      message: {
        id: 'broadcast-2',
        channel_id: 'channel-1',
        persona_id: 'persona-1',
        body: 'Fresh product update',
        visibility: 'followers',
        status: 'published',
        media: [],
        delivered_count: 1,
        read_count: 0,
        created_at: '2026-05-05T14:00:00Z',
      },
    });

    render(<PersonaBroadcastPage />);

    expect(await screen.findByRole('heading', { name: 'Updates' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/3 delivered/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Beacon/i })).toHaveAttribute('href', '/@mayabuilds');
    fireEvent.click(screen.getByRole('button', { name: /Copy Link/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('/@mayabuilds'));
    });
    fireEvent.change(screen.getByPlaceholderText('Write an update for your followers...'), {
      target: { value: 'Fresh product update' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Post update/i }));

    await waitFor(() => {
      expect(mockApi.broadcast.publishBroadcastMessage).toHaveBeenCalledWith('channel-1', {
        body: 'Fresh product update',
        visibility: 'followers',
      });
    });
    expect(analyticsEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'identity_update_published',
        properties: expect.objectContaining({
          visibility: 'followers',
          bodyLength: 'Fresh product update'.length,
          hasPublicProfile: true,
        }),
      }),
    ]));
  });

  test('Beacon setup uses media upload controls instead of URL fields', async () => {
    const analyticsEvents = collectIdentityAnalyticsEvents();
    const existingPersona = buildAudienceProfile({ id: 'persona-1', handle: 'mayabuilds' });
    const avatarFile = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });

    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: existingPersona,
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    });
    mockApi.personas.updatePersona.mockResolvedValue({ persona: existingPersona });

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
    expect(screen.queryByText('Avatar URL')).not.toBeInTheDocument();
    expect(screen.queryByText('Banner URL')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Upload avatar image'), {
      target: { files: [avatarFile] },
    });
    expect(await screen.findByText(/Ready to upload: avatar.png/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Beacon/i }));

    await waitFor(() => {
      expect(mockApi.upload.uploadPersonaMedia).toHaveBeenCalledWith('persona-1', avatarFile, 'avatar');
    });
    expect(await screen.findByText('Beacon saved.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /View Beacon/i }).some((link) => (
      link.getAttribute('href') === '/@mayabuilds'
    ))).toBe(true);
    expect(mockToast.success).toHaveBeenCalledWith('Beacon saved.');
    expect(analyticsEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'identity_public_profile_saved',
        properties: expect.objectContaining({
          action: 'updated',
          hasAvatar: true,
          publicLinkCount: 0,
          audienceMode: 'open',
        }),
      }),
    ]));
    expect(mockApi.personas.updatePersona).toHaveBeenCalledWith(
      'persona-1',
      expect.not.objectContaining({ avatar_url: expect.anything(), banner_url: expect.anything() }),
    );
  });

  test('Beacon setup saves public links', async () => {
    const existingPersona = buildAudienceProfile({ id: 'persona-1', handle: 'mayabuilds' });

    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: existingPersona,
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    });
    mockApi.personas.updatePersona.mockResolvedValue({
      persona: buildAudienceProfile({
        id: 'persona-1',
        handle: 'mayabuilds',
        publicLinks: [{ label: 'Website', url: 'https://example.com' }],
      }),
    });

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add Link/i }));
    fireEvent.change(screen.getByPlaceholderText('Website'), {
      target: { value: 'Website' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
      target: { value: 'example.com' },
    });
    fireEvent.click(screen.getByRole('tab', { name: /Audience settings/i }));
    fireEvent.click(screen.getByRole('button', { name: /I approve new followers/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Beacon/i }));

    await waitFor(() => {
      expect(mockApi.personas.updatePersona).toHaveBeenCalledWith(
        'persona-1',
        expect.objectContaining({
          audience_mode: 'approval_required',
          public_links: [{ label: 'Website', url: 'https://example.com' }],
        }),
      );
    });
  });

  test('new users publish a Beacon through the three-step setup flow', async () => {
    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: null,
      channel: null,
    });
    mockApi.personas.createPersona.mockResolvedValue({
      persona: buildAudienceProfile({
        id: 'persona-new',
        handle: 'new-maker',
        displayName: 'New Maker',
      }),
      channel: { id: 'channel-new', persona_id: 'persona-new', title: 'New Maker', status: 'active' },
    });

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByText('Create your Beacon')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('maya-builds'), {
      target: { value: 'new-maker' },
    });
    fireEvent.change(screen.getByPlaceholderText('Maya Builds'), {
      target: { value: 'New Maker' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    expect(await screen.findByText('Follow Mode')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    expect(await screen.findByText('Profile links are off')).toBeInTheDocument();
    expect(screen.getByText(/will not link to your Profile/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish Beacon/i }));

    await waitFor(() => {
      expect(mockApi.personas.createPersona).toHaveBeenCalledWith(expect.objectContaining({
        handle: 'new-maker',
        display_name: 'New Maker',
        audience_label: 'followers',
        audience_mode: 'open',
      }));
    });
    expect(mockToast.success).toHaveBeenCalledWith('Beacon created.');
  });

  test('Beacon settings lets owners review and approve followers', async () => {
    const pendingFollower = {
      id: 'follow-pending',
      status: 'pending',
      relationshipType: 'follower',
      notificationLevel: 'all',
      publicVisibility: 'visible_to_owner',
      follower: buildLocalProfile({ displayName: 'Requesting Neighbor', handle: 'neighbor' }),
    };
    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: buildAudienceProfile({ id: 'persona-1', handle: 'mayabuilds' }),
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    });
    mockApi.personas.getPersonaFollowers.mockImplementation((_id: string, params: { status?: string } = {}) => Promise.resolve({
      followers: params.status === 'pending' ? [pendingFollower] : [],
      counts: { total: 1, pending: 1, active: 0, muted: 0, blocked: 0, removed: 0 },
    }));

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Followers/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Pending/i }));
    expect(await screen.findByText('Requesting Neighbor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Approve/i }));

    await waitFor(() => {
      expect(mockApi.personas.updatePersonaFollower).toHaveBeenCalledWith('persona-1', 'follow-pending', { status: 'active' });
    });
  });

  test('Beacon follower removal requires confirmation', async () => {
    const activeFollower = {
      id: 'follow-active',
      status: 'active',
      relationshipType: 'follower',
      notificationLevel: 'all',
      publicVisibility: 'visible_to_owner',
      follower: buildLocalProfile({ displayName: 'Active Neighbor', handle: 'active-neighbor' }),
    };
    mockApi.personas.getMyPersona.mockResolvedValue({
      persona: buildAudienceProfile({ id: 'persona-1', handle: 'mayabuilds' }),
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
    });
    mockApi.personas.getPersonaFollowers.mockImplementation((_id: string, params: { status?: string } = {}) => Promise.resolve({
      followers: params.status === 'active' ? [activeFollower] : [],
      counts: { total: 1, pending: 0, active: 1, muted: 0, blocked: 0, removed: 0 },
    }));

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Followers/i }));
    expect(await screen.findByText('Active Neighbor')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Remove$/i }));
    const firstDialog = screen.getByRole('dialog', { name: /Remove follower/i });
    expect(mockApi.personas.updatePersonaFollower).not.toHaveBeenCalled();
    fireEvent.click(within(firstDialog).getByRole('button', { name: /Cancel/i }));
    expect(screen.queryByRole('dialog', { name: /Remove follower/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Remove$/i }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /Remove follower/i })).getByRole('button', { name: /^Remove$/i }));

    await waitFor(() => {
      expect(mockApi.personas.updatePersonaFollower).toHaveBeenCalledWith('persona-1', 'follow-active', { status: 'removed' });
    });
  });

  test('public Beacon lets followers adjust update notification preferences', async () => {
    const audienceProfile = buildAudienceProfile({
      displayName: 'Maya Builds Audience',
      viewer: {
        isFollowing: true,
        relationshipType: 'follower',
        notificationLevel: 'all',
        followStatus: 'active',
        isOwner: false,
      },
    });
    mockFetchPublicPersona.mockResolvedValue({
      data: {
        persona: audienceProfile,
        channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
      },
      status: 200,
    });
    mockApi.personas.getPersona.mockResolvedValue({ persona: audienceProfile });
    mockApi.broadcast.getBroadcastMessages.mockResolvedValue({
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
      persona: audienceProfile,
      messages: [{ id: 'broadcast-1', body: 'Follower note', visibility: 'followers', status: 'published', media: [], created_at: '2026-05-05T13:00:00Z' }],
    });

    const audienceUi = await AudienceProfilePage({ params: Promise.resolve({ personaHandle: 'mayabuilds' }) });
    render(audienceUi);

    expect(await screen.findByText('Maya Builds Audience')).toBeInTheDocument();
    expect(screen.queryByText('Owner tools')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Profiles & Privacy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Edit Profile/i })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockApi.broadcast.markBroadcastMessageRead).toHaveBeenCalledWith('broadcast-1');
    });
    fireEvent.click(screen.getByRole('button', { name: /Turn Beacon update notifications off/i }));

    await waitFor(() => {
      expect(mockApi.personas.updatePersonaFollowPreferences).toHaveBeenCalledWith('persona-1', {
        notification_level: 'none',
      });
    });
  });

  test('public Beacon keeps visitor actions clean and tracks follow requests', async () => {
    const analyticsEvents = collectIdentityAnalyticsEvents();
    const audienceProfile = buildAudienceProfile({
      displayName: 'Maya Builds Audience',
      viewer: {
        isFollowing: false,
        relationshipType: null,
        notificationLevel: 'all',
        followStatus: 'none',
        isOwner: false,
      },
    });
    mockFetchPublicPersona.mockResolvedValue({
      data: {
        persona: audienceProfile,
        channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
      },
      status: 200,
    });
    mockApi.personas.getPersona.mockResolvedValue({ persona: audienceProfile });
    mockApi.personas.followPersona.mockResolvedValue({
      following: true,
      status: 'pending',
      relationshipType: 'follower',
      notificationLevel: 'all',
    });

    const audienceUi = await AudienceProfilePage({ params: Promise.resolve({ personaHandle: 'mayabuilds' }) });
    render(audienceUi);

    expect(await screen.findByText('Maya Builds Audience')).toBeInTheDocument();
    expect(screen.queryByText('Owner tools')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Profiles & Privacy/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Edit Profile/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Follow Maya Builds Audience/i }));

    await waitFor(() => {
      expect(mockApi.personas.followPersona).toHaveBeenCalledWith('persona-1');
    });
    expect(await screen.findByRole('button', { name: /Follow request pending/i })).toBeDisabled();
    expect(analyticsEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventName: 'identity_public_profile_follow_changed',
        properties: expect.objectContaining({
          action: 'follow',
          status: 'pending',
          audienceMode: 'open',
        }),
      }),
    ]));
  });

  test('Beacon save shows backend errors with product language on the page', async () => {
    mockApi.personas.updatePersona.mockRejectedValue({
      message: 'That Audience Profile handle is already taken.',
    });

    render(<AudienceProfileSettingsPage />);

    expect(await screen.findByRole('heading', { name: 'Beacon' })).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('mayabuilds'), {
      target: { value: 'taken-handle' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Beacon/i }));

    expect(await screen.findByText('That Beacon handle is already taken.')).toBeInTheDocument();
    expect(mockToast.error).toHaveBeenCalledWith('That Beacon handle is already taken.');
  });

  test('personal-zone composer never offers persona as a posting-as option (P2.4 / unified-IA §4.1)', async () => {
    // Updated for P2.4: the personal-zone composer no longer accepts the
    // persona signature. Even when /api/posts/identities returns a
    // persona row (stale cache, alternate code path), the composer
    // filters it out — the audience-zone composer (P2.5) handles
    // persona posting on its own routes. The previous version of this
    // test exercised the legacy cross-zone path; the post-P2.4
    // assertion is the inverse: the persona option must never appear.
    const onPost = jest.fn().mockResolvedValue(undefined);
    mockApi.posts.getPostingIdentities.mockResolvedValue({
      identities: [
        { type: 'personal', id: 'local-1', name: 'RiverHome', role: 'verified resident' },
        { type: 'persona', id: 'persona-1', name: 'Maya Builds', role: 'creator' },
        { type: 'home', id: 'home-1', name: 'Maya Home', role: 'member' },
      ],
    });

    render(<PostComposer onPost={onPost} user={{ username: 'maya' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lost & Found' }));
    fireEvent.click(await screen.findByRole('button', { name: /Change/i }));

    // Personal + Home identities render in the picker; persona never does.
    await waitFor(() => {
      expect(screen.getByTestId('posting-identity-personal')).toBeInTheDocument();
    });
    expect(screen.getByTestId('posting-identity-home')).toBeInTheDocument();
    expect(screen.queryByTestId('posting-identity-persona')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Maya Builds/i })).not.toBeInTheDocument();
    // The audience picker for the default personal identity shows local
    // options — Public is intentionally absent (it was a persona-only
    // audience in the pre-P2.4 composer).
    expect(screen.queryByRole('button', { name: 'Public' })).not.toBeInTheDocument();
  });

  test('profile and Beacon pages fetch and render separate public pages', async () => {
    const audienceProfile = buildAudienceProfile({
      displayName: 'Maya Builds Audience',
      publicLinks: [{ label: 'Website', url: 'https://example.test/audience' }],
    });

    mockFetchPublicUser.mockResolvedValue({
      status: 200,
      data: {
        id: 'user-1',
        username: 'riverhome',
        name: 'RiverHome Profile',
        bio: 'Original public profile',
      },
    });

    const profileUi = await LegacyPublicProfilePage({ params: Promise.resolve({ username: 'riverhome' }) });
    expect(profileUi.props.username).toBe('riverhome');
    expect(profileUi.props.initialProfile).toMatchObject({ username: 'riverhome', name: 'RiverHome Profile' });
    expect(mockFetchPublicUser).toHaveBeenCalledWith('riverhome');
    expect(mockFetchPublicPersona).not.toHaveBeenCalled();
    expect(mockFetchPublicLocalProfile).not.toHaveBeenCalled();

    cleanup();
    jest.clearAllMocks();
    mockFetchPublicPersona.mockResolvedValue({
      data: {
        persona: audienceProfile,
        channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
      },
      status: 200,
    });
    mockApi.personas.getPersona.mockResolvedValue({
      persona: buildAudienceProfile({
        displayName: 'Maya Builds Audience',
        publicLinks: [{ label: 'Website', url: 'https://example.test/audience' }],
        viewer: {
          isFollowing: false,
          relationshipType: null,
          notificationLevel: 'all',
          followStatus: 'none',
          isOwner: true,
        },
      }),
    });
    mockApi.personas.getPersonaPosts.mockResolvedValue({
      posts: [{ id: 'post-persona', content: 'New tutorial for my audience', created_at: '2026-05-05T13:00:00Z', like_count: 0, comment_count: 0 }],
    });
    mockApi.broadcast.getBroadcastMessages.mockResolvedValue({
      channel: { id: 'channel-1', persona_id: 'persona-1', title: 'Maya Builds', status: 'active' },
      persona: audienceProfile,
      messages: [{ id: 'broadcast-1', body: 'Broadcast-only note', visibility: 'public', status: 'published', media: [], created_at: '2026-05-05T13:00:00Z' }],
    });

    const audienceUi = await AudienceProfilePage({ params: Promise.resolve({ personaHandle: 'mayabuilds' }) });
    render(audienceUi);

    expect(await screen.findByText('Maya Builds Audience')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open App/i })).toHaveAttribute('href', 'https://www.pantopus.com/@mayabuilds');
    expect(screen.queryByRole('link', { name: /Identity Center/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Profiles & Privacy/i })).toHaveAttribute('href', '/app/identity');
    expect(await screen.findByRole('link', { name: /Edit Profile/i })).toHaveAttribute('href', '/app/persona');
    expect(await screen.findByText('New tutorial for my audience')).toBeInTheDocument();
    expect(screen.getByText('Broadcast-only note')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Website example\.test/i })).toHaveAttribute('href', 'https://example.test/audience');
    expect(mockFetchPublicPersona).toHaveBeenCalledWith('mayabuilds');
    expect(mockFetchPublicLocalProfile).not.toHaveBeenCalled();
  });

  test('web public profile route falls back to client instead of hard 404', async () => {
    mockFetchPublicUser.mockResolvedValue({ status: 404, data: null });

    const profileUi = await LegacyPublicProfilePage({ params: Promise.resolve({ username: '@riverhome' }) });

    expect(profileUi.props.username).toBe('riverhome');
    expect(profileUi.props.initialProfile).toBeNull();
    expect(mockFetchPublicUser).toHaveBeenCalledWith('riverhome');
    expect(mockNotFound).not.toHaveBeenCalled();

    const profilePageSource = fs.readFileSync(
      path.resolve(__dirname, '../src/app/(app)/app/profile/page.tsx'),
      'utf8',
    );
    expect(profilePageSource).toContain('buildUserProfilePath(user.username)');
  });

  test('public routes keep username profile and Beacon pages separate', async () => {
    const personaResponse = middleware(buildMiddlewareRequest('https://web.test/@mayabuilds?tab=posts'));
    expect(personaResponse.headers.get('x-middleware-rewrite')).toBe('https://web.test/persona/mayabuilds?tab=posts');

    const encodedPersonaResponse = middleware(buildMiddlewareRequest('https://web.test/%40mayabuilds?tab=posts'));
    expect(encodedPersonaResponse.headers.get('x-middleware-rewrite')).toBe('https://web.test/persona/mayabuilds?tab=posts');

    const legacyUsernameResponse = middleware(buildMiddlewareRequest('https://web.test/riverhome?ref=legacy'));
    expect(legacyUsernameResponse.headers.get('location')).toBeNull();
    expect(legacyUsernameResponse.headers.get('x-middleware-rewrite')).toBeNull();

    const legacyUPrefixResponse = middleware(buildMiddlewareRequest('https://web.test/u/riverhome'));
    expect(legacyUPrefixResponse.headers.get('location')).toBeNull();
    expect(legacyUPrefixResponse.headers.get('x-middleware-rewrite')).toBeNull();

    mockFetchPublicUser.mockResolvedValue({
      status: 200,
      data: {
        id: 'user-1',
        username: 'riverhome',
        name: 'RiverHome Original',
        bio: 'Original public profile',
      },
    });
    const legacyUi = await LegacyPublicProfilePage({ params: Promise.resolve({ username: 'riverhome' }) });
    expect(legacyUi.props.username).toBe('riverhome');
    expect(legacyUi.props.initialProfile).toMatchObject({ username: 'riverhome' });
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
