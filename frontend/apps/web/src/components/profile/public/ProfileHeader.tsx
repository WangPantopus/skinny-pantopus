'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Badge from './atoms/Badge';
import TrustChip from './atoms/TrustChip';
import ResidencyHomeBlock, { type ResidencyPayload } from './ResidencyHomeBlock';

type ViewerContext = 'public' | 'neighborhood' | 'follower' | 'owner';

interface ProfileHeaderProps {
  profile: Record<string, unknown>;
  fullName: string;
  residency?: ResidencyPayload | null;
  showOwnerOnly: boolean;
  ownerPreviewContext: ViewerContext;
  onOwnerPreviewChange: (ctx: ViewerContext) => void;
  // Trust data
  trustBadges: Array<{ icon: string; text: string; color: string }>;
  displayRating: number;
  displayReviewCount: number;
  responseTimeLabel: string;
  reliabilityLabel: string;
  reliabilityScore: number | null;
  // Actions
  followState: boolean;
  actionLoading: boolean;
  shareCopied: boolean;
  onFollow: () => void;
  onMessage: () => void;
  onRequestHire: () => void;
  onShare: () => void;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numberField(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export default function ProfileHeader({
  profile,
  fullName,
  residency,
  showOwnerOnly,
  ownerPreviewContext,
  onOwnerPreviewChange,
  trustBadges,
  displayRating,
  displayReviewCount,
  responseTimeLabel,
  reliabilityLabel,
  reliabilityScore,
  followState,
  actionLoading,
  shareCopied,
  onFollow,
  onMessage,
  onRequestHire,
  onShare,
}: ProfileHeaderProps) {
  const router = useRouter();
  const username = stringField(profile.username);
  const tagline = stringField(profile.tagline) || 'Helping neighbors with local services.';
  const avatarUrl = stringField(profile.profile_picture_url) || stringField(profile.avatar_url) || stringField(profile.profilePicture);
  const createdAt = stringField(profile.created_at) || stringField(profile.createdAt);
  const joinedLabel = createdAt
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Unknown';
  const gigsCompleted = numberField(profile.gigs_completed);

  return (
    <>
      <div className="h-40 md:h-48 bg-gradient-to-r from-[#0f2340] via-[#1a3557] to-[#2a5f7a]" />

      <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12 -mt-16">
        <section className="bg-surface rounded-2xl border border-app p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-end gap-5">
            {/* Avatar */}
            <div className="relative w-24 h-24 md:w-28 md:h-28 shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full rounded-full object-cover border-4 border-white shadow"
                  width={112}
                  height={112}
                  sizes="112px"
                  quality={75}
                />
              ) : (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 flex items-center justify-center text-white text-4xl font-semibold border-4 border-white shadow">
                  {fullName[0]?.toUpperCase()}
                </div>
              )}
              {Boolean(residency?.hasHome && residency?.verified) && (
                <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white text-xs" title="Verified resident">
                  ✓
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-app leading-tight">{fullName}</h1>
              <p className="text-app-secondary">@{username}</p>
              <p className="text-sm text-app-secondary mt-1">{tagline}</p>
              <ResidencyHomeBlock residency={residency ?? undefined} />

              <div className="flex flex-wrap gap-2 mt-3">
                {trustBadges.slice(0, 3).map((badge) => (
                  <Badge key={badge.text} icon={badge.icon} text={badge.text} color={badge.color} />
                ))}
                <Badge icon="📅" text={`Joined ${joinedLabel}`} color="gray" />
              </div>
            </div>

            {/* Action buttons (desktop) */}
            <div className="hidden md:flex gap-2 flex-wrap justify-end">
              {showOwnerOnly ? (
                <>
                  <button
                    onClick={() => router.push('/app/profile/edit')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => router.push('/app/profile')}
                    className="px-4 py-2 bg-surface text-app-strong border border-app-strong rounded-lg hover:bg-surface-raised font-medium"
                  >
                    View Analytics
                  </button>
                  <select
                    value={ownerPreviewContext}
                    onChange={(e) => onOwnerPreviewChange(e.target.value as ViewerContext)}
                    className="px-3 py-2 border border-app-strong rounded-lg text-sm text-app-strong"
                  >
                    <option value="owner">Preview: Owner</option>
                    <option value="public">Preview: Public</option>
                    <option value="neighborhood">Preview: Neighborhood</option>
                    <option value="follower">Preview: Followers</option>
                  </select>
                </>
              ) : (
                <>
                  <button onClick={onMessage} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Message</button>
                  <button onClick={onRequestHire} className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium">Request / Hire</button>
                  <button
                    onClick={onFollow}
                    disabled={actionLoading}
                    className={`px-4 py-2 border rounded-lg font-medium transition disabled:opacity-60 ${
                      followState
                        ? 'bg-primary-50 text-primary-700 border-primary-300 hover:bg-primary-100'
                        : 'bg-surface text-app-strong border-app-strong hover:bg-surface-raised'
                    }`}
                  >
                    {followState ? 'Following' : 'Follow'}
                  </button>
                  <button onClick={onShare} className="px-4 py-2 bg-surface text-app-strong border border-app-strong rounded-lg hover:bg-surface-raised font-medium">
                    {shareCopied ? 'Copied' : 'Share'}
                  </button>
                  <details className="relative">
                    <summary className="list-none px-3 py-2 bg-surface text-app-strong border border-app-strong rounded-lg hover:bg-surface-raised cursor-pointer">⋯</summary>
                    <div className="absolute right-0 mt-2 w-40 bg-surface border border-app rounded-lg shadow-sm p-1 z-20">
                      <button className="w-full text-left px-3 py-2 text-sm text-app-secondary hover:bg-surface-raised rounded">Report profile</button>
                      <button className="w-full text-left px-3 py-2 text-sm text-app-secondary hover:bg-surface-raised rounded">Block user</button>
                    </div>
                  </details>
                </>
              )}
            </div>
          </div>

          {/* Trust chips */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
            <TrustChip
              title="Rating"
              value={displayReviewCount > 0 ? `${displayRating.toFixed(1)} ★` : 'New'}
              detail={displayReviewCount > 0 ? `${displayReviewCount} reviews` : 'Be their first review'}
            />
            <TrustChip title="Completed" value={gigsCompleted} detail="as worker" />
            <TrustChip title="Response" value={responseTimeLabel} detail="typical response time" />
            <TrustChip
              title="Reliability"
              value={reliabilityLabel}
              detail={reliabilityScore != null ? 'Based on the last 90 days' : 'Based on available history'}
            />
          </div>
        </section>
      </div>
    </>
  );
}
