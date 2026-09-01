'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Check, ChevronRight, Diamond, FileText, Globe, LayoutDashboard, Link as LinkIcon, Lock, MapPin, Megaphone, ShieldCheck, SlidersHorizontal, Sparkles, UserPlus, Users } from 'lucide-react';
import * as api from '@pantopus/api';
import type { AudienceProfile, BroadcastChannel, BroadcastMessage, PersonaNotificationLevel, Post } from '@pantopus/types';
import type { PublicTier } from '@pantopus/api';
import BroadcastMessageContent from '@/components/audience/BroadcastMessageContent';
import PostMediaGrid from '@/components/feed/PostMediaGrid';
import OpenInAppButton from '@/components/public-share/OpenInAppButton';
import { trackIdentityEvent } from '@/lib/identityAnalytics';
import { identityCopy } from '@/lib/identityLabels';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { webFeatureFlags } from '@/lib/featureFlags';

type StoreCta = {
  href: string;
  label: string;
};

function displayUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || url;
  }
}

function formatRelative(input: string | Date) {
  const date = typeof input === 'string' ? new Date(input) : input;
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AudienceProfileClient({
  initialPersona,
  initialChannel,
  appUrl,
  linkHref,
  fallbackUrl,
  storeCta,
}: {
  initialPersona: AudienceProfile;
  initialChannel: BroadcastChannel | null;
  appUrl: string;
  linkHref: string;
  fallbackUrl: string | null;
  storeCta: StoreCta | null;
}) {
  const [persona, setPersona] = useState(initialPersona);
  const [posts, setPosts] = useState<Post[]>([]);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [notificationSaving, setNotificationSaving] = useState(false);
  // P1.8 — public tier ladder (audience-profile §11.4). Fetched only
  // when the audience_profile flag is on for the viewer; rank cards
  // route to the privacy-handshake page.
  const audienceFlagEnabled = useFeatureFlag('audience_profile');
  const paidMembershipsEnabled = audienceFlagEnabled && webFeatureFlags.personaPaidMemberships;
  const [publicTiers, setPublicTiers] = useState<PublicTier[]>([]);
  const markedMessageIdsRef = useRef<Set<string>>(new Set());

  const markMessagesRead = (nextMessages: BroadcastMessage[], nextPersona: AudienceProfile) => {
    if (nextPersona.viewer?.isOwner) return;
    nextMessages.forEach((message) => {
      if (!message.id || markedMessageIdsRef.current.has(message.id)) return;
      // Locked-preview rows have no body to mark read, and the
      // server's mark-read endpoint will refuse them with 403.
      if (message.locked) return;
      markedMessageIdsRef.current.add(message.id);
      void api.broadcast.markBroadcastMessageRead(message.id).catch(() => {
        markedMessageIdsRef.current.delete(message.id);
      });
    });
  };

  useEffect(() => {
    let mounted = true;
    api.personas.getPersona(persona.handle)
      .then((res) => {
        if (!mounted) return;
        setPersona(res.persona);
        if (messages.length > 0) markMessagesRead(messages, res.persona);
      })
      .catch(() => {});
    api.personas.getPersonaPosts(persona.handle)
      .then((res) => { if (mounted) setPosts(res.posts || []); })
      .catch(() => {});
    if (initialChannel?.id) {
      api.broadcast.getBroadcastMessages(initialChannel.id)
        .then((res) => {
          if (!mounted) return;
          const nextMessages = res.messages || [];
          setMessages(nextMessages);
          markMessagesRead(nextMessages, persona);
        })
        .catch(() => {});
    }
    return () => { mounted = false; };
    // markMessagesRead intentionally closes over the current profile snapshot; the effect refreshes profile first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona.handle, initialChannel?.id]);

  // P1.8 — fetch the public tier ladder when the flag is on. Public,
  // unauthenticated GET; safe to call on every page render. The
  // backend already strips stripe_price_id from the public response.
  useEffect(() => {
    let cancelled = false;
    if (!paidMembershipsEnabled) {
      setPublicTiers([]);
      return;
    }
    api.personaTiers.listPublicTiers(persona.handle)
      .then((res) => { if (!cancelled) setPublicTiers(res.tiers || []); })
      .catch(() => { /* ladder is non-blocking */ });
    return () => { cancelled = true; };
  }, [persona.handle, paidMembershipsEnabled]);

  const follow = async () => {
    try {
      const res = await api.personas.followPersona(persona.id);
      trackIdentityEvent('identity_public_profile_follow_changed', {
        action: 'follow',
        status: res.status,
        audienceMode: persona.audienceMode,
      });
      setPersona((prev) => ({
        ...prev,
        followerCount: res.status === 'active' ? prev.followerCount + 1 : prev.followerCount,
        viewer: {
          ...prev.viewer,
          isFollowing: res.status === 'active',
          followStatus: res.status,
          notificationLevel: res.status === 'active' ? 'all' : prev.viewer.notificationLevel,
        },
      }));
    } catch {
      // Public profile remains readable even if follow fails.
    }
  };

  const updateNotificationPreference = async (notificationLevel: PersonaNotificationLevel) => {
    if (notificationSaving) return;
    setNotificationSaving(true);
    try {
      const res = await api.personas.updatePersonaFollowPreferences(persona.id, {
        notification_level: notificationLevel,
      });
      setPersona((prev) => ({
        ...prev,
        viewer: {
          ...prev.viewer,
          isFollowing: res.following,
          followStatus: res.status,
          relationshipType: res.relationshipType ?? prev.viewer.relationshipType,
          notificationLevel: res.notificationLevel,
        },
      }));
    } catch {
      // Keep the Beacon readable; the user can retry the preference change.
    } finally {
      setNotificationSaving(false);
    }
  };

  const toggleNotificationPreference = () => {
    void updateNotificationPreference(persona.viewer?.notificationLevel === 'none' ? 'all' : 'none');
  };

  const isFollowing = Boolean(persona.viewer?.isFollowing);
  const isPending = persona.viewer?.followStatus === 'pending';
  const notificationsEnabled = isFollowing && persona.viewer?.notificationLevel !== 'none';
  const followerCount = Number(persona.followerCount || 0);
  const audienceLabelLower = String(persona.audienceLabel || 'followers').toLowerCase();
  const audienceLabelSingular = audienceLabelLower.replace(/s$/, '');
  const postCount = Number((persona as { postCount?: number }).postCount || posts.length || 0);
  const hiddenPostCount = Math.max(0, postCount - posts.length);
  const emptyPostsBody = hiddenPostCount > 0
    ? `${hiddenPostCount.toLocaleString()} ${hiddenPostCount === 1 ? 'post is' : 'posts are'} limited to followers or members. Follow this Beacon to see more.`
    : 'Public posts shared as this Beacon will appear here.';

  return (
    <main className="min-h-screen bg-app">
      <PublicProfileNav
        persona={persona}
        appUrl={appUrl}
        linkHref={linkHref}
        fallbackUrl={fallbackUrl}
        storeCta={storeCta}
      />

      <section className="border-b border-app bg-surface">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 lg:px-8">
          <div className="relative min-h-[180px] overflow-hidden rounded-lg border border-app bg-gradient-to-br from-primary-100 via-sky-100 to-primary-50 sm:aspect-[4/1] sm:max-h-80">
            {persona.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={persona.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
            ) : (
              <>
                <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-primary-200/60 blur-2xl" />
                <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-sky-300/50 blur-2xl" />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />
          </div>
          <div className="flex flex-col gap-5 px-1 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface text-2xl font-semibold text-primary-600 shadow-sm sm:h-24 sm:w-24">
                {persona.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={persona.avatarUrl} alt="" className="h-full w-full object-cover object-center" />
                ) : (
                  persona.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold tracking-tight text-app sm:text-4xl">{persona.displayName}</h1>
                  {persona.credential?.status === 'verified' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {persona.credential.label || 'Verified'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-app-secondary">@{persona.handle}</p>
              </div>
            </div>

            {/* Action area */}
            {!persona.viewer.isOwner ? (
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {audienceFlagEnabled && !isFollowing && !isPending ? (
                  // P1.8 — flag-on viewers go through the privacy
                  // handshake screen (audience-profile §11.4) before any
                  // membership row is created. The legacy direct-follow
                  // button stays as the fallback for users without the
                  // flag, since the existing /api/personas/:id/follow
                  // route still accepts an empty body.
                  <Link
                    href={`/app/persona/${persona.handle}/follow?tier_rank=1`}
                    aria-label={`Follow ${persona.displayName}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                  >
                    <UserPlus className="h-4 w-4" />
                    Follow {persona.audienceLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={follow}
                    disabled={isFollowing || isPending}
                    aria-label={isFollowing ? 'Following this Beacon' : isPending ? 'Follow request pending' : `Follow ${persona.displayName}`}
                    className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed ${
                      isFollowing
                        ? 'border border-primary-500 bg-surface text-primary-700 shadow-none disabled:opacity-100'
                        : isPending
                          ? 'bg-app-muted text-white'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {isFollowing ? <Check className="h-4 w-4" /> : isPending ? <Bell className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    {isFollowing ? 'Following' : isPending ? 'Requested' : `Follow ${persona.audienceLabel}`}
                  </button>
                )}
                {persona.viewer.isFollowing && (
                  <button
                    type="button"
                    onClick={toggleNotificationPreference}
                    disabled={notificationSaving}
                    aria-label={
                      notificationsEnabled
                        ? 'Turn Beacon update notifications off'
                        : 'Turn Beacon update notifications on'
                    }
                    aria-pressed={notificationsEnabled}
                    title={
                      notificationsEnabled
                        ? 'Beacon update notifications are on'
                        : 'Beacon update notifications are off'
                    }
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border text-sm shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      notificationsEnabled
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-app bg-surface text-app-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {notificationsEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {/* Bio + stats + links + bridge: flow below the hero block. */}
          <div className="grid gap-6 pb-8 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              {persona.bio ? <p className="max-w-2xl text-base leading-7 text-app">{persona.bio}</p> : null}
              <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                <span className="font-semibold text-app">{followerCount.toLocaleString()}</span>
                <span className="text-app-secondary">{followerCount === 1 ? audienceLabelSingular : audienceLabelLower}</span>
                <span className="px-1 text-app-muted">·</span>
                <span className="font-semibold text-app">{postCount.toLocaleString()}</span>
                <span className="text-app-secondary">{postCount === 1 ? 'post' : 'posts'}</span>
                <span className="px-1 text-app-muted">·</span>
                <span className="font-semibold text-app">{messages.length.toLocaleString()}</span>
                <span className="text-app-secondary">{messages.length === 1 ? 'update' : 'updates'}</span>
              </div>
              {(persona.bridges?.localProfile || persona.publicLinks.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {persona.bridges?.localProfile && (
                    <Link
                      href={`/${persona.bridges.localProfile.handle}`}
                      aria-label={`Open Profile for ${persona.bridges.localProfile.displayName}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      Profile: {persona.bridges.localProfile.displayName}
                    </Link>
                  )}
                  {persona.publicLinks.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      aria-label={`Open ${link.label} ${displayUrl(link.url)}`}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-app bg-surface px-3 py-1.5 text-xs font-semibold text-app transition hover:bg-surface-muted"
                    >
                      <LinkIcon className="h-3.5 w-3.5 text-app-secondary" />
                      <span>{link.label}</span>
                      <span className="max-w-32 truncate text-app-secondary">{displayUrl(link.url)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Subscribe ladder — visitor only */}
      {paidMembershipsEnabled && publicTiers.length > 0 && !persona.viewer.isOwner ? (
        <section
          aria-labelledby="tier-ladder-heading"
          className="border-b border-app bg-surface"
          data-zone="audience-tier-ladder"
        >
          <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Diamond className="h-4 w-4 text-primary-600" />
              <h2 id="tier-ladder-heading" className="text-xs font-semibold uppercase tracking-wide text-primary-700">
                Tiers
              </h2>
            </div>
            <p className="mt-1 text-sm text-app-secondary">
              Capabilities are cumulative — each tier includes everything below it.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publicTiers.map((tier) => {
                const free = tier.priceCents === 0;
                const label = free
                  ? 'Follow'
                  : `Subscribe — $${(tier.priceCents / 100).toFixed(0)}/mo`;
                return (
                  <li
                    key={tier.id}
                    className="group flex flex-col gap-4 rounded-2xl border border-app bg-surface p-5 transition hover:border-primary-300 hover:shadow-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-xs font-bold text-primary-700">
                          {tier.rank}
                        </span>
                        <h3 className="text-base font-semibold text-app">{tier.name}</h3>
                      </div>
                      <p className="mt-3 text-2xl font-bold text-app">
                        {free ? 'Free' : (
                          <>
                            ${(tier.priceCents / 100).toFixed(0)}
                            <span className="text-sm font-medium text-app-secondary">/mo</span>
                          </>
                        )}
                      </p>
                      {tier.description ? (
                        <p className="mt-2 text-sm leading-6 text-app-secondary">{tier.description}</p>
                      ) : null}
                    </div>
                    <Link
                      href={`/app/persona/${persona.handle}/follow?tier_rank=${tier.rank}`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                    >
                      {label}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Activity */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-app-secondary">Posts</h2>
            {posts.length > 0 ? (
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold text-app-secondary">{posts.length}</span>
            ) : null}
          </div>
          <div className="space-y-3">
            {posts.length === 0 ? (
              <EmptySurface
                icon={FileText}
                title="No posts yet"
                body={emptyPostsBody}
              />
            ) : posts.map((post) => (
              <article key={post.id} className="rounded-2xl border border-app bg-surface p-5">
                <div className="mb-2 flex items-center gap-2 text-xs text-app-secondary">
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold uppercase tracking-wide">
                    {(post.post_type || 'post').replace(/_/g, ' ')}
                  </span>
                  <span>·</span>
                  <span>{formatRelative(post.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-app">{post.content}</p>
                <PostMediaGrid
                  urls={post.media_urls || []}
                  thumbnailUrls={post.media_thumbnails || []}
                  mediaTypes={post.media_types || []}
                  compact
                />
              </article>
            ))}
          </div>
        </div>
        <aside>
          <div className="rounded-2xl border border-app bg-surface p-5 lg:sticky lg:top-20">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <Megaphone className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-app">{identityCopy.updates}</h2>
                <p className="text-[11px] text-app-secondary">One-way news from this Beacon</p>
              </div>
            </div>
            <div className="space-y-3">
              {messages.length === 0 ? (
                <EmptySurface
                  icon={Megaphone}
                  compact
                  title="No updates yet"
                  body="One-way updates from this Beacon will appear here."
                />
              ) : messages.slice(0, 8).map((message) => {
                const isPublic = String(message.visibility) === 'public';
                if (message.locked) {
                  const tierLabel = message.target_tier_rank === 3
                    ? 'Insiders only'
                    : message.target_tier_rank === 2
                      ? 'Members only'
                      : 'Subscribers only';
                  return (
                    <article key={message.id} className="rounded-xl border border-primary-200 bg-primary-50/60 p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                        <Lock className="h-3 w-3" />
                        {tierLabel}
                      </div>
                      <p className="mt-1.5 text-sm italic text-app-secondary">
                        {message.teaser ? `${message.teaser}` : 'This update is available to a member tier.'}
                      </p>
                      {paidMembershipsEnabled ? (
                        <Link
                          href={`/app/persona/${persona.handle}/follow?tier_rank=${message.target_tier_rank ?? 2}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline"
                        >
                          Subscribe to unlock
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      ) : null}
                    </article>
                  );
                }
                return (
                  <article key={message.id} className="rounded-xl border border-app bg-surface-muted/40 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-[11px] text-app-secondary">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                        isPublic ? 'bg-amber-50 text-amber-800' : 'bg-primary-50 text-primary-700'
                      }`}>
                        {isPublic ? <Globe className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
                        {isPublic ? 'Public' : 'Followers'}
                      </span>
                      <span>{formatRelative(message.created_at)}</span>
                    </div>
                    <BroadcastMessageContent message={message} />
                  </article>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function EmptySurface({
  title,
  body,
  compact = false,
  icon: Icon,
}: {
  title: string;
  body: string;
  compact?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 rounded-2xl border border-dashed border-app bg-surface text-center ${compact ? 'p-5' : 'p-8'}`}>
      {Icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-app-muted">
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className="mt-1 text-sm font-semibold text-app">{title}</p>
      <p className="text-xs text-app-secondary">{body}</p>
    </div>
  );
}

function PublicProfileNav({
  persona,
  appUrl,
  linkHref,
  fallbackUrl,
  storeCta,
}: {
  persona: AudienceProfile;
  appUrl: string;
  linkHref: string;
  fallbackUrl: string | null;
  storeCta: StoreCta | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-app bg-surface/95 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-app">
          <LayoutDashboard className="h-4 w-4 text-primary-600" />
          Pantopus
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <OpenInAppButton
            appUrl={appUrl}
            linkHref={linkHref}
            fallbackUrl={fallbackUrl}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <LayoutDashboard className="h-4 w-4" />
            Open App
          </OpenInAppButton>
          {persona.viewer?.isOwner && (
            <details className="relative">
              <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-app px-3.5 py-2 text-sm font-semibold text-app transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 [&::-webkit-details-marker]:hidden">
                <SlidersHorizontal className="h-4 w-4" />
                Owner tools
              </summary>
              <div className="mt-2 grid gap-1 rounded-xl border border-app bg-surface p-2 shadow-lg sm:absolute sm:right-0 sm:w-60">
                <Link
                  href="/app/identity"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted"
                >
                  <ShieldCheck className="h-4 w-4 text-app-secondary" />
                  {identityCopy.profilesPrivacyTitle}
                </Link>
                <Link
                  href="/app/persona"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted"
                >
                  <Sparkles className="h-4 w-4 text-app-secondary" />
                  Edit Profile
                </Link>
                <Link
                  href="/app/persona/broadcast"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted"
                >
                  <Megaphone className="h-4 w-4 text-app-secondary" />
                  {identityCopy.updates}
                </Link>
              </div>
            </details>
          )}
        </div>
      </nav>
      {storeCta ? (
        <div className="border-t border-app bg-primary-50 px-4 py-2 sm:hidden">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-primary-900">Get Pantopus for this Beacon</p>
              <p className="truncate text-[11px] text-primary-700">Follow updates and open links faster in the app.</p>
            </div>
            <a
              href={storeCta.href}
              className="shrink-0 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {storeCta.label.replace(/^Download on |^Get it on /, '')}
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
