// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { UserRound } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import type { User, UserProfile, Listing } from '@pantopus/types';
import { buildUserProfilePath, chosenUsername, usernameHandle } from '@pantopus/utils';
import ResidencyHomeBlock from '@/components/profile/public/ResidencyHomeBlock';
import ErrorState from '@/components/ui/ErrorState';
import { launchFeatures } from '@/lib/featureFlags';
import { useMe } from '@/lib/me';

// Your own activity counts (Instant Screens contract §4, "You").
const STATS_FRESH_MS = 2 * 60 * 1000;

/** Earnings in dollars from the payment summary (cents). */
function earningsDollars(res: Record<string, unknown>): number {
  const earnings = res?.earnings as Record<string, unknown> | undefined;
  const cents = Number(earnings?.total_earned ?? earnings?.totalEarned ?? 0) || 0;
  return Math.round((cents / 100) * 100) / 100;
}

/** A stat still loading shows "…"; one whose read failed shows "—". */
function statValue(value: number | null | undefined): number | string {
  if (value === undefined) return '…';
  return value === null ? '—' : value;
}

// Launch cuts #4/#3: the stats row has one column per card still shown.
const STATS_LG_COLS = ({ 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' } as Record<number, string>)[
  3 + Number(launchFeatures.openGigs) + Number(launchFeatures.marketplace)
];

export default function MyProfilePage() {
  const router = useRouter();
  // The session cookie is readable only in the browser: until mount, the page
  // renders what the cache already has (nothing on a fresh load), like the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && !!getAuthToken();
  useEffect(() => {
    if (mounted && !getAuthToken()) router.push('/login');
  }, [mounted, router]);

  // Your profile is the shared entry (lib/me.ts); the numbers and activity load
  // alongside it instead of one after another, and show at once on the next visit.
  const meQuery = useMe({ enabled: signedIn });
  const user = (meQuery.data ?? null) as (User & Record<string, any>) | null;
  const gigsQuery = useQuery({
    queryKey: ['profile', 'stats', 'gigs'],
    queryFn: () => api.gigs.getMyGigs({ limit: 100 }),
    enabled: signedIn,
    staleTime: STATS_FRESH_MS,
  });
  // Launch cut #4 (Open Gigs): bids are hidden, so they are not loaded.
  const bidsQuery = useQuery({
    queryKey: ['profile', 'stats', 'bids'],
    queryFn: () => api.gigs.getMyBids({ limit: 100 }),
    enabled: signedIn && launchFeatures.openGigs,
    staleTime: STATS_FRESH_MS,
  });
  // Money is never shown from a kept copy (contract §5, sensitive): asked on
  // every visit and dropped as soon as the page closes.
  const earningsQuery = useQuery({
    queryKey: ['profile', 'stats', 'earnings'],
    queryFn: () => api.payments.getEarnings() as Promise<Record<string, unknown>>,
    enabled: signedIn,
    staleTime: 0,
    gcTime: 0,
  });
  // Launch cut #3 (Marketplace): listings are hidden, so they are not loaded.
  const listingsQuery = useQuery({
    queryKey: ['profile', 'stats', 'listings'],
    queryFn: () => api.listings.getMyListings({ limit: 5 }) as Promise<Record<string, unknown>>,
    enabled: signedIn && launchFeatures.marketplace,
    staleTime: STATS_FRESH_MS,
  });
  const activityQuery = useQuery({
    queryKey: ['users', 'me', 'activity'],
    queryFn: () => api.get('/api/users/me/activity?limit=10') as Promise<Record<string, unknown>>,
    enabled: signedIn,
    staleTime: STATS_FRESH_MS,
  });

  const loading = !user && (!mounted || (signedIn && meQuery.isPending));
  /** Why the profile could not load (null when it did, or while loading). */
  const loadError = !user && meQuery.isError
    ? (meQuery.error instanceof Error && meQuery.error.message ? meQuery.error.message : "We couldn't load your profile.")
    : null;
  const loadUserData = () => { void meQuery.refetch(); };

  // A number whose read failed is null (unknown), shown as "—" rather than 0;
  // one still loading is undefined, shown as "…".
  const myListings = ((listingsQuery.data?.listings || []) as Listing[]);
  const stats: Record<string, number | null | undefined> | null = user ? {
    gigsPosted: gigsQuery.data
      ? (gigsQuery.data.total ?? gigsQuery.data.gigs?.length ?? user.gigs_posted ?? 0)
      : (user.gigs_posted ?? 0),
    activeBids: !launchFeatures.openGigs ? 0
      : bidsQuery.isError ? null
      : bidsQuery.data ? (bidsQuery.data.bids || []).filter((b: { status?: string }) => b.status === 'pending').length
      : undefined,
    gigsCompleted: user.gigs_completed ?? 0,
    earnings: earningsQuery.isError ? null
      : earningsQuery.data ? earningsDollars(earningsQuery.data)
      : undefined,
    listings: !launchFeatures.marketplace ? 0
      : listingsQuery.isError ? null
      : listingsQuery.data ? ((listingsQuery.data.pagination as Record<string, unknown> | undefined)?.total as number ?? myListings.length)
      : undefined,
  } : null;
  const activities = ((activityQuery.data?.activities || []) as { id?: string; icon?: string; text?: string; time_ago?: string }[]);
  const retryStats = () => {
    if (bidsQuery.isError) void bidsQuery.refetch();
    if (earningsQuery.isError) void earningsQuery.refetch();
    if (listingsQuery.isError) void listingsQuery.refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-app-muted">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-app text-app">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorState message={loadError} onRetry={loadUserData} />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-app mb-2">Unable to load profile</h2>
          <p className="text-app-muted mb-4">Please try logging in again.</p>
          <button
            onClick={() => router.push('/login')}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // A username the server made up (user_…, or the pre-October-7 kind built from the email) is never shown.
  const chosenHandle = user.usernameIsGenerated ? null : chosenUsername(user.username);
  const fullName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.name || chosenHandle;

  // What Edit Profile can fill in. The photo counts as this page shows it: /api/users/profile's `avatar_url` is
  // always null (User has no such column); the picture comes as `profilePicture`.
  const completionItems = [
    { completed: !!(user.avatar_url || user.profilePicture), text: 'Add profile picture' },
    { completed: !!user.bio?.trim(), text: 'Write a bio' },
    { completed: !!(user.skills && user.skills.length > 0), text: 'Add skills' },
  ];
  const completionPercent = Math.round(
    (completionItems.filter((item) => item.completed).length / completionItems.length) * 100,
  );

  return (
    <div className="bg-app text-app">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-surface rounded-xl border border-app p-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                {user.avatar_url || user.profilePicture ? (
                  <Image
                    src={user.avatar_url || user.profilePicture}
                    alt={fullName || 'Your profile photo'}
                    width={128}
                    height={128}
                    sizes="128px"
                    quality={75}
                    className="w-32 h-32 rounded-full object-cover border-4 border-app-border mb-4"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-5xl font-bold border-4 border-app-border mb-4">
                    {fullName ? fullName[0].toUpperCase() : <UserRound aria-hidden className="w-16 h-16" />}
                  </div>
                )}

                {fullName ? (
                  <h2 className="text-2xl font-bold text-app text-center">{fullName}</h2>
                ) : (
                  // No name yet (the one-time prompt was skipped): an invitation to add one, not a stand-in label.
                  <button
                    type="button"
                    onClick={() => router.push('/app/profile/edit')}
                    className="text-xl font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400"
                  >
                    Add your name
                  </button>
                )}
                {chosenHandle ? <p className="text-app-muted">{usernameHandle(chosenHandle)}</p> : null}
                
                <div className="mt-2 w-full text-left">
                  <ResidencyHomeBlock residency={(user as UserProfile).residency} dense />
                </div>

                {user.bio && (
                  <p className="text-sm text-app text-center mt-4">{user.bio}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/app/profile/edit')}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-medium"
                >
                  Edit Profile
                </button>
                <button
                  onClick={() => {
                    if (user.username) {
                      router.push(buildUserProfilePath(user.username));
                    } else {
                      toast.warning('Username not set. Please update your profile first.');
                      router.push('/app/profile/edit');
                    }
                  }}
                  className="w-full border border-app text-app-muted py-3 rounded-lg hover-bg-app font-medium"
                >
                  View Public Profile
                </button>
                <button
                  onClick={() => router.push('/app/profile/settings')}
                  className="w-full border border-app text-app-muted py-3 rounded-lg hover-bg-app font-medium"
                >
                  Settings
                </button>
                <button
                  onClick={() => router.push('/app/homes')}
                  className="w-full border border-app text-app-muted py-3 rounded-lg hover-bg-app font-medium"
                >
                  My Homes
                </button>
              </div>

              {/* Quick Stats */}
              <div className="mt-6 pt-6 border-t border-app">
                <h3 className="text-sm font-semibold text-app mb-3">Quick Stats</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-app-muted">Member since</span>
                    <span className="text-sm font-medium text-app">
                      {new Date(user.created_at || user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-app-muted">Account Type</span>
                    <span className="text-sm font-medium text-app capitalize">
                      {user.account_type || 'Individual'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Cards */}
            {/* Launch cuts #4/#3: Active Bids and Listings are hidden; the row keeps one line. */}
            <div className={`grid sm:grid-cols-2 ${STATS_LG_COLS} gap-4`}>
              <StatsCard
                icon="📝"
                label="Gigs Posted"
                value={stats?.gigsPosted || 0}
                color="blue"
                onClick={() => router.push('/app/my-gigs')}
              />
              {launchFeatures.openGigs && <StatsCard
                icon="💼"
                label="Active Bids"
                value={statValue(stats?.activeBids)}
                color="purple"
                onClick={() => router.push('/app/my-bids')}
              />}
              <StatsCard
                icon="✅"
                label="Completed"
                value={stats?.gigsCompleted || 0}
                color="green"
                onClick={() => router.push('/app/my-gigs')}
              />
              {launchFeatures.marketplace && <StatsCard
                icon="🏷️"
                label="Listings"
                value={statValue(stats?.listings)}
                color="blue"
                onClick={() => router.push('/app/my-listings')}
              />}
              <StatsCard
                icon="💰"
                label="Earnings"
                value={stats?.earnings == null ? statValue(stats?.earnings) : `$${Number(stats.earnings).toFixed(2)}`}
                color="yellow"
                onClick={() => router.push('/app/wallet')}
              />
            </div>
            {stats && ((launchFeatures.openGigs && stats.activeBids === null) || stats.earnings === null || (launchFeatures.marketplace && stats.listings === null)) && (
              <p role="alert" className="text-sm text-app-muted">
                Some of these numbers couldn&apos;t load.{' '}
                <button type="button" onClick={retryStats} className="font-medium text-primary-600 hover:underline">
                  Try again
                </button>
              </p>
            )}

            {/* Quick Actions */}
            <div className="bg-surface rounded-xl border border-app p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Quick Actions</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Launch cuts #4 (Post a Task, My Bids) and #3 (My Listings) are hidden. */}
                {launchFeatures.openGigs && <QuickActionCard
                  icon="➕"
                  title="Post a Task"
                  description="Create a new gig"
                  onClick={() => router.push('/app/gigs-v2/new')}
                />}
                <QuickActionCard
                  icon="💼"
                  title="My Tasks"
                  description="Manage your tasks"
                  onClick={() => router.push('/app/my-gigs')}
                />
                {launchFeatures.marketplace && <QuickActionCard
                  icon="🏷️"
                  title="My Listings"
                  description="Manage your items"
                  onClick={() => router.push('/app/my-listings')}
                />}
                {launchFeatures.openGigs && <QuickActionCard
                  icon="📊"
                  title="My Bids"
                  description="Track your offers"
                  onClick={() => router.push('/app/my-bids')}
                />}
                <QuickActionCard
                  icon="💬"
                  title="Messages"
                  description="Check your inbox"
                  onClick={() => router.push('/app/chat')}
                />
              </div>
            </div>

            {/* My Listings */}
            {/* Launch cut #3 (Marketplace): the My Listings section is hidden. */}
            {launchFeatures.marketplace && <div className="bg-surface rounded-xl border border-app p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-app">My Listings</h3>
                <button
                  onClick={() => router.push('/app/my-listings')}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  View all
                </button>
              </div>
              {myListings.length > 0 ? (
                <div className="space-y-3">
                  {myListings.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => router.push(`/app/marketplace/${item.id}`)}
                      className="flex items-center gap-3 w-full text-left hover-bg-app rounded-lg p-2 -m-2 transition"
                    >
                      <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-app-surface-sunken">
                        {item.media_urls?.[0] ? (
                          <Image src={item.media_urls[0]} alt={item.title} width={48} height={48} sizes="48px" quality={75} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-lg">📷</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app truncate">{item.title}</p>
                        <p className="text-xs text-app-muted">
                          {item.is_free ? 'Free' : item.price != null ? `$${Number(item.price).toFixed(0)}` : '—'}
                          {' · '}
                          <span className={
                            item.status === 'active' ? 'text-green-600' :
                            item.status === 'sold' ? 'text-app-text-muted' :
                            'text-amber-600'
                          }>
                            {(item.status || 'draft').replace(/_/g, ' ')}
                          </span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-app-muted mb-3">No listings yet. Start selling items to your neighbors!</p>
                  <button
                    onClick={() => router.push('/app/marketplace?create=true')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
                  >
                    + Create Listing
                  </button>
                </div>
              )}
            </div>}

            {/* Recent Activity */}
            <div className="bg-surface rounded-xl border border-app p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.map((a, i: number) => (
                    <ActivityItem
                      key={a.id || i}
                      icon={a.icon || '📋'}
                      text={a.text}
                      time={a.time_ago}
                    />
                  ))
                ) : (
                  <p className="text-sm text-app-muted">
                    {/* Launch cut #4 (Open Gigs): no posting or bidding to suggest. */}
                    {launchFeatures.openGigs ? 'No recent activity yet. Post a task or place a bid to get started!' : 'No recent activity yet.'}
                  </p>
                )}
              </div>
            </div>

            {/* Profile Completion (hidden once everything is filled in) */}
            {completionPercent < 100 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/40 dark:to-purple-950/40 rounded-xl border border-blue-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 rounded-full bg-app-surface border-4 border-blue-300 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">{completionPercent}%</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-app-text mb-2">Complete Your Profile</h3>
                    <p className="text-sm text-app-text-secondary mb-4">
                      A complete profile helps neighbors recognize and trust you.
                    </p>
                    <ul className="space-y-2 text-sm">
                      {completionItems.map((item) => (
                        <CompletionItem key={item.text} completed={item.completed} text={item.text} />
                      ))}
                    </ul>
                    <button
                      onClick={() => router.push('/app/profile/edit')}
                      className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                    >
                      Complete Profile
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatsCard({ icon, label, value, color, onClick }: { icon: string; label: string; value: string | number; color: string; onClick?: () => void }) {
  const colors = {
    blue: 'from-blue-400 to-blue-600',
    purple: 'from-purple-400 to-purple-600',
    green: 'from-green-400 to-green-600',
    yellow: 'from-yellow-400 to-yellow-600',
  };

  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={`bg-surface rounded-xl border border-app p-6 text-left ${onClick ? 'hover:border-primary-600 hover:shadow-md transition cursor-pointer' : ''}`}
    >
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[color as keyof typeof colors]} flex items-center justify-center text-2xl mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-app">{value}</p>
      <p className="text-sm text-app-muted">{label}</p>
    </Tag>
  );
}

function QuickActionCard({ icon, title, description, onClick }: { icon: string; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-4 border border-app rounded-lg hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition text-left"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <h4 className="font-semibold text-app mb-1">{title}</h4>
      <p className="text-sm text-app-muted">{description}</p>
    </button>
  );
}

function ActivityItem({ icon, text, time }: { icon: string; text: string; time: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-app">{text}</p>
        <p className="text-sm text-app-muted">{time}</p>
      </div>
    </div>
  );
}

function CompletionItem({ completed, text }: { completed: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      {completed ? (
        <svg aria-hidden="true" className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
        </svg>
      )}
      <span className={completed ? 'text-app-muted line-through' : 'text-app'}>
        {completed && <span className="sr-only">Done: </span>}
        {text}
      </span>
    </li>
  );
}
