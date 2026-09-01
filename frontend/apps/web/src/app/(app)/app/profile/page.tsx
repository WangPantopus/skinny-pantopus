// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import type { User, UserProfile, Listing, GigListItem } from '@pantopus/types';
import { buildUserProfilePath } from '@pantopus/utils';
import ResidencyHomeBlock from '@/components/profile/public/ResidencyHomeBlock';

export default function MyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<{ id?: string; icon?: string; text?: string; time_ago?: string }[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [, setListingsCount] = useState(0);

  const loadUserData = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        router.push('/login');
        return;
      }

      const userData = await api.users.getMyProfile();
      console.log('✅ User data loaded:', userData);
      console.log('📋 User fields:', {
        username: userData.username,
        firstName: userData.firstName,
        lastName: userData.lastName,
        name: userData.name,
        email: userData.email,
      });
      setUser(userData);

      // Load user stats
      try {
        console.log('📊 Loading stats...');

        // Gigs posted = gigs I created. Completed = gigs I completed as worker (canonical: User.gigs_completed from profile).
        let gigsCount = (userData as Record<string, unknown>).gigs_posted ?? 0;
        const completedCount = (userData as Record<string, unknown>).gigs_completed ?? 0;
        try {
          const myGigs = await api.gigs.getMyGigs({ limit: 100 });
          gigsCount = myGigs.total ?? (myGigs.gigs?.length ?? gigsCount);
        } catch (gigErr) {
          console.warn('⚠️ Could not load my gigs:', gigErr);
        }
        
        // Try to load my bids
        let activeBidsCount = 0;
        try {
          const myBids = await api.gigs.getMyBids({ limit: 100 });
          console.log('✅ My bids loaded:', myBids);
          const bidsArray = myBids.bids || [];
          activeBidsCount = bidsArray.filter((b: { status?: string }) => b.status === 'pending').length;
        } catch (bidErr) {
          console.warn('⚠️ Could not load my bids:', bidErr);
          activeBidsCount = 0;
        }

        // Load earnings from payment summary
        let earningsDollars = 0;
        try {
          const earningsRes = await api.payments.getEarnings() as Record<string, unknown>;
          const earningsObj = earningsRes?.earnings as Record<string, unknown> | undefined;
          const earningsCents = Number(
            earningsObj?.total_earned ??
            earningsObj?.totalEarned ??
            0
          ) || 0;
          earningsDollars = Math.round((earningsCents / 100) * 100) / 100;
        } catch (earnErr) {
          console.warn('⚠️ Could not load earnings:', earnErr);
          earningsDollars = 0;
        }

        // Load my listings
        let activeListingsCount = 0;
        try {
          const listingsRes = await api.listings.getMyListings({ limit: 5 }) as Record<string, unknown>;
          const listingsArr = (listingsRes?.listings || []) as Listing[];
          const pagination = listingsRes?.pagination as Record<string, unknown> | undefined;
          activeListingsCount = (pagination?.total as number) ?? listingsArr.length;
          setMyListings(listingsArr);
          setListingsCount(activeListingsCount);
        } catch (listErr) {
          console.warn('⚠️ Could not load listings:', listErr);
        }

        setStats({
          gigsPosted: gigsCount,
          activeBids: activeBidsCount,
          gigsCompleted: completedCount,
          earnings: earningsDollars,
          listings: activeListingsCount,
        });
      } catch (err) {
        console.error('❌ Failed to load stats:', err);
        // Set default stats
        setStats({
          gigsPosted: userData.gigs_posted || 0,
          activeBids: 0,
          gigsCompleted: userData.gigs_completed || 0,
          earnings: 0,
          listings: 0,
        });
      }
      // Load recent activity
      try {
        const activityData = await api.get('/api/users/me/activity?limit=10');
        setActivities(((activityData as Record<string, unknown>).activities || []) as { id?: string; icon?: string; text?: string; time_ago?: string }[]);
      } catch {
        // Activity feed is non-critical
      }
    } catch (err) {
      console.error('Failed to load user:', err);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

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

  const fullName = user.firstName && user.lastName 
    ? `${user.firstName} ${user.lastName}` 
    : user.name || user.username || 'User';
  
  const initial = fullName?.[0]?.toUpperCase() || 'U';

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
                    alt={fullName}
                    width={128}
                    height={128}
                    sizes="128px"
                    quality={75}
                    className="w-32 h-32 rounded-full object-cover border-4 border-app-border mb-4"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-white text-5xl font-bold border-4 border-app-border mb-4">
                    {initial}
                  </div>
                )}
                
                <h2 className="text-2xl font-bold text-app text-center">{fullName}</h2>
                <p className="text-app-muted">@{user.username}</p>
                
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatsCard
                icon="📝"
                label="Gigs Posted"
                value={stats?.gigsPosted || 0}
                color="blue"
                onClick={() => router.push('/app/my-gigs')}
              />
              <StatsCard
                icon="💼"
                label="Active Bids"
                value={stats?.activeBids || 0}
                color="purple"
                onClick={() => router.push('/app/my-bids')}
              />
              <StatsCard
                icon="✅"
                label="Completed"
                value={stats?.gigsCompleted || 0}
                color="green"
                onClick={() => router.push('/app/my-gigs')}
              />
              <StatsCard
                icon="🏷️"
                label="Listings"
                value={stats?.listings || 0}
                color="blue"
                onClick={() => router.push('/app/my-listings')}
              />
              <StatsCard
                icon="💰"
                label="Earnings"
                value={`$${Number(stats?.earnings || 0).toFixed(2)}`}
                color="yellow"
                onClick={() => router.push('/app/my-bids')}
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-surface rounded-xl border border-app p-6">
              <h3 className="text-lg font-semibold text-app mb-4">Quick Actions</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <QuickActionCard
                  icon="➕"
                  title="Post a Task"
                  description="Create a new gig"
                  onClick={() => router.push('/app/gigs-v2/new')}
                />
                <QuickActionCard
                  icon="💼"
                  title="My Tasks"
                  description="Manage your tasks"
                  onClick={() => router.push('/app/my-gigs')}
                />
                <QuickActionCard
                  icon="🏷️"
                  title="My Listings"
                  description="Manage your items"
                  onClick={() => router.push('/app/my-listings')}
                />
                <QuickActionCard
                  icon="📊"
                  title="My Bids"
                  description="Track your offers"
                  onClick={() => router.push('/app/my-bids')}
                />
                <QuickActionCard
                  icon="💬"
                  title="Messages"
                  description="Check your inbox"
                  onClick={() => router.push('/app/chat')}
                />
              </div>
            </div>

            {/* My Listings */}
            <div className="bg-surface rounded-xl border border-app p-6">
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
            </div>

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
                  <p className="text-sm text-app-muted">No recent activity yet. Post a task or place a bid to get started!</p>
                )}
              </div>
            </div>

            {/* Profile Completion */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-app-surface border-4 border-blue-300 flex items-center justify-center">
                    <span className="text-2xl font-bold text-blue-600">65%</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-app-text mb-2">Complete Your Profile</h3>
                  <p className="text-sm text-app-text-secondary mb-4">
                    A complete profile helps you get more gigs and build trust with clients.
                  </p>
                  <ul className="space-y-2 text-sm">
                    <CompletionItem completed={!!user.avatar_url} text="Add profile picture" />
                    <CompletionItem completed={!!user.bio} text="Write a bio" />
                    <CompletionItem completed={!!(user.skills && user.skills.length > 0)} text="Add skills" />
                    <CompletionItem completed={false} text="Add portfolio items" />
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
    <div className="flex items-center gap-2">
      {completed ? (
        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
        </svg>
      )}
      <span className={completed ? 'text-app-muted line-through' : 'text-app'}>{text}</span>
    </div>
  );
}
