'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, ArrowRight, BriefcaseBusiness, Eye, Home, Megaphone, Pencil, Plus, Radio, RefreshCw, Settings, Shield, ToggleLeft, ToggleRight, User, Users } from 'lucide-react';
import * as api from '@pantopus/api';
import type { IdentityCenterPayload, ViewAsPreview } from '@pantopus/types';
import { trackIdentityEvent } from '@/lib/identityAnalytics';
import { identityCopy, viewerLabel as formatViewerLabel } from '@/lib/identityLabels';
import { useDialogFocusTrap } from '@/lib/useDialogFocusTrap';
import { PrivacyPreviewCTA } from './_components/PrivacyPreviewCTA';
import { BlockListsCard } from './_components/BlockListsCard';
import { WhatPantopusKnowsCard } from './_components/WhatPantopusKnowsCard';

type PreviewSurface = 'local' | 'persona';
type ProfileLinkField = 'show_persona_on_local' | 'show_local_on_persona';
type ProfilePrivacyTab = 'overview' | 'public-profile' | 'profile-links' | 'privacy-preview' | 'followers' | 'updates';
type NextStep = {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: typeof Shield;
  action?: 'profile-links' | 'privacy-preview';
};

const PREVIEW_SURFACES: Array<{ value: PreviewSurface; label: string; emptyLabel: string }> = [
  { value: 'local', label: 'Profile', emptyLabel: 'No Profile available to preview.' },
  { value: 'persona', label: identityCopy.beacon, emptyLabel: 'Create a Beacon to preview follower-facing views.' },
];

const VIEWERS_BY_SURFACE: Record<PreviewSurface, string[]> = {
  local: ['public', 'neighbor', 'connection', 'household_member', 'gig_participant'],
  persona: ['public', 'persona_audience_member'],
};

const PROFILE_PRIVACY_TABS: Array<{ key: ProfilePrivacyTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'public-profile', label: identityCopy.beacon },
  { key: 'profile-links', label: identityCopy.profileLinks },
  { key: 'privacy-preview', label: identityCopy.privacyPreview },
  { key: 'followers', label: 'Followers' },
  { key: 'updates', label: identityCopy.updates },
];

function getPreviewTarget(data: IdentityCenterPayload | null, surface: PreviewSurface) {
  if (!data) return null;
  if (surface === 'local') {
    return data.localProfile ? { handle: data.localProfile.handle, label: 'Profile' } : null;
  }
  return data.audienceProfile ? { handle: data.audienceProfile.handle, label: identityCopy.beacon } : null;
}

function getNextStep(data: IdentityCenterPayload): NextStep {
  if (!data.audienceProfile) {
    return {
      title: 'Create your Beacon',
      body: 'Set up the page followers, clients, students, customers, or members can find.',
      href: '/app/persona',
      cta: 'Start setup',
      icon: Radio,
    };
  }
  if (!data.localProfile) {
    return {
      title: 'Review your Profile',
      body: 'Add the nearby profile neighbors see before you decide whether to link profiles.',
      href: '/app/profile/edit',
      cta: 'Edit Profile',
      icon: User,
    };
  }
  if (!data.bridges.show_persona_on_local && !data.bridges.show_local_on_persona) {
    return {
      title: 'Review profile links',
      body: 'Both profiles are separate. Turn on a link only when you want one audience to discover the other profile.',
      href: '#profile-links',
      cta: 'Review links',
      icon: ToggleLeft,
      action: 'profile-links',
    };
  }
  return {
    title: 'Preview who sees what',
    body: 'Use Privacy Preview before sharing another post, update, or profile link.',
    href: '#privacy-preview',
    cta: 'Open preview',
    icon: Eye,
    action: 'privacy-preview',
  };
}

export default function IdentityCenterPage() {
  const [data, setData] = useState<IdentityCenterPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [preview, setPreview] = useState<ViewAsPreview | null>(null);
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>('persona');
  const [viewer, setViewer] = useState('public');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [savingBridge, setSavingBridge] = useState(false);
  const [profileLinkError, setProfileLinkError] = useState('');
  const [pendingProfileLink, setPendingProfileLink] = useState<{ field: ProfileLinkField; nextValue: boolean } | null>(null);
  const profileLinkTriggerRef = useRef<HTMLElement | null>(null);

  const loadIdentityCenter = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    // Per unified-IA §10, "Open Profiles & Privacy → see complete
    // identity status: ≤ 10 seconds" with a backend p95 budget of
    // 500ms. Log slow loads in dev so regressions are caught at the
    // next round of changes; harmless in prod.
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      const nextData = await api.identityCenter.getIdentityCenter();
      setData(nextData);
      if (process.env.NODE_ENV !== 'production' && started > 0) {
        const elapsed = performance.now() - started;
        if (elapsed > 1500) {
          // eslint-disable-next-line no-console
          console.warn(`[Profiles & Privacy] slow load: ${elapsed.toFixed(0)}ms (budget 1500ms)`);
        }
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load Profiles & Privacy.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadIdentityCenter(); }, [loadIdentityCenter]);

  useEffect(() => {
    if (!data) return;
    if (previewSurface === 'persona' && !data.audienceProfile && data.localProfile) {
      setPreviewSurface('local');
      setPreview(null);
      setPreviewError('');
    }
    if (previewSurface === 'local' && !data.localProfile && data.audienceProfile) {
      setPreviewSurface('persona');
      setPreview(null);
      setPreviewError('');
    }
    if (!VIEWERS_BY_SURFACE[previewSurface].includes(viewer)) {
      setViewer('public');
    }
  }, [data, previewSurface, viewer]);

  const loadPreview = async (nextViewer = viewer, nextSurface: PreviewSurface = previewSurface) => {
    const target = getPreviewTarget(data, nextSurface);
    if (!target) {
      setPreview(null);
      setPreviewError(PREVIEW_SURFACES.find((surface) => surface.value === nextSurface)?.emptyLabel || 'Nothing to preview.');
      return;
    }
    setLoadingPreview(true);
    setPreviewError('');
    try {
      const res = await api.identityCenter.getViewAsPreview({
        surface: nextSurface,
        handle: target.handle,
        viewer: nextViewer,
      });
      trackIdentityEvent('identity_privacy_preview_opened', {
        surface: nextSurface,
        viewer: nextViewer,
        hasLocalProfile: Boolean(data?.localProfile),
        hasPublicProfile: Boolean(data?.audienceProfile),
      });
      setPreview(res);
    } catch (err) {
      setPreview(null);
      setPreviewError(err instanceof Error ? err.message : 'Failed to build preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleBridge = async (field: ProfileLinkField, nextValue: boolean) => {
    if (!data?.audienceProfile) return;
    setSavingBridge(true);
    setProfileLinkError('');
    try {
      const next = {
        show_persona_on_local: field === 'show_persona_on_local' ? nextValue : data.bridges.show_persona_on_local,
        show_local_on_persona: field === 'show_local_on_persona' ? nextValue : data.bridges.show_local_on_persona,
      };
      const res = await api.identityCenter.updateBridgeSettings(data.audienceProfile.id, next);
      trackIdentityEvent('identity_profile_link_changed', {
        direction: field === 'show_persona_on_local' ? 'local_to_public_profile' : 'public_profile_to_local',
        enabled: nextValue,
      });
      setData({ ...data, bridges: res.bridge });
      setPendingProfileLink(null);
    } catch (err) {
      setProfileLinkError(err instanceof Error ? err.message : 'Profile link was not updated. Please try again.');
    } finally {
      setSavingBridge(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-app p-6">
        <div className="mx-auto max-w-5xl rounded-lg border border-app bg-surface p-6 text-app-secondary">
          Loading Profiles & Privacy...
        </div>
      </main>
    );
  }

  if (loadError || !data) {
    return (
      <main className="min-h-screen bg-app p-6">
        <div className="mx-auto max-w-5xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <AlertCircle className="mb-3 h-6 w-6" />
          <h1 className="text-lg font-semibold">Profiles & Privacy could not load</h1>
          <p className="mt-2 text-sm">{loadError || 'Please try again.'}</p>
          <button
            type="button"
            onClick={loadIdentityCenter}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </main>
    );
  }

  const selectedPreviewTarget = getPreviewTarget(data, previewSurface);
  const selectedPreviewSurface = PREVIEW_SURFACES.find((surface) => surface.value === previewSurface) || PREVIEW_SURFACES[0];
  const visiblePreviewViewers = VIEWERS_BY_SURFACE[previewSurface];
  const canManageProfileLinks = Boolean(data.localProfile && data.audienceProfile);
  const audienceLabel = data.audienceProfile?.audienceLabel;
  const nextStep = getNextStep(data);
  const focusSection = (id: string) => {
    const target = document.getElementById(id);
    target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    target?.focus?.({ preventScroll: true });
    window.history.replaceState(null, '', `#${id}`);
  };
  const handleNextStepClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (nextStep.action === 'profile-links') {
      event.preventDefault();
      focusSection('profile-links');
    }
    if (nextStep.action === 'privacy-preview') {
      event.preventDefault();
      focusSection('privacy-preview');
      void loadPreview();
    }
  };

  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-app">{identityCopy.profilesPrivacyTitle}</h1>
            <p className="mt-1 text-sm text-app-secondary">{identityCopy.profilesPrivacyPromise}</p>
          </div>
          {/*
            Per unified-IA §8.1, the Privacy preview CTA is the always-
            visible entry point at the top of the page — independent
            of the per-card "What people see" buttons. Stays in the
            header on every viewport so it's one tap from anywhere.
          */}
          <PrivacyPreviewCTA
            onOpen={() => {
              if (data?.localProfile || data?.audienceProfile) {
                void loadPreview();
              }
            }}
          />
        </div>

        <IdentityTabNav
          tabs={PROFILE_PRIVACY_TABS}
          hasPublicProfile={Boolean(data.audienceProfile)}
          hasPreviewTarget={Boolean(data.localProfile || data.audienceProfile)}
        />

        <section id="overview" tabIndex={-1} className="mb-4 scroll-mt-6 rounded-lg border border-app bg-surface p-5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2" aria-labelledby="profiles-overview-heading">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-app-secondary">Recommended next step</p>
              <h2 id="profiles-overview-heading" className="mt-1 text-lg font-semibold text-app">{nextStep.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-app-secondary">{nextStep.body}</p>
            </div>
            <PanelActionLink href={nextStep.href} variant="primary" icon={<nextStep.icon className="h-4 w-4" />} onClick={handleNextStepClick}>
              {nextStep.cta}
            </PanelActionLink>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <OverviewStatus label="Account privacy" value={data.privateAccount?.verified ? 'Verified' : 'Protected'} />
            <OverviewStatus label="Profile" value={data.localProfile ? 'Ready' : 'Not set up'} />
            <OverviewStatus label={identityCopy.beacon} value={data.audienceProfile ? 'Ready' : 'Not set up'} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <IdentityPanel icon={Shield} title="Private Account" subtitle="Only you and Pantopus can see this.">
            <p className="text-sm text-app-secondary">{String(data.privateAccount?.email || 'Private account')}</p>
            <p className="mt-2 text-sm text-app-secondary">{data.privateAccount?.verified ? 'You are verified. Your real name and address stay private.' : 'Pantopus verifies your real identity and address to keep the community safe.'}</p>
            <PanelActions>
              <PanelActionLink href="/app/profile/settings" icon={<Settings className="h-4 w-4" />}>
                Account Settings
              </PanelActionLink>
            </PanelActions>
          </IdentityPanel>

          <IdentityPanel icon={User} title="Profile" subtitle="Used for nearby posts, gigs, marketplace, and neighbors.">
            {data.localProfile ? (
              <>
                <p className="font-medium text-app">{data.localProfile.displayName}</p>
                <p className="mt-1 text-sm text-app-secondary">
                  /{data.localProfile.handle}
                </p>
                <PanelActions>
                  <PanelActionLink href={`/${data.localProfile.handle}`} variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                    View Profile
                  </PanelActionLink>
                  <PanelActionLink href="/app/profile/edit" icon={<Pencil className="h-4 w-4" />}>
                    Edit Profile
                  </PanelActionLink>
                </PanelActions>
              </>
            ) : <p className="text-sm text-app-secondary">No profile yet.</p>}
          </IdentityPanel>

          <IdentityPanel icon={Radio} title={identityCopy.beacon} subtitle="Used for followers, clients, students, customers, members, and public updates." id="public-profile">
            {data.audienceProfile ? (
              <>
                <p className="font-medium text-app">{data.audienceProfile.displayName}</p>
                <p className="mt-1 text-sm text-app-secondary">
                  /@{data.audienceProfile.handle}
                </p>
                <p className="mt-2 text-sm text-app-secondary">{data.audienceProfile.followerCount.toLocaleString()} {data.audienceProfile.audienceLabel}</p>
                <PanelActions>
                  <PanelActionLink href={`/@${data.audienceProfile.handle}`} variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                    View Beacon
                  </PanelActionLink>
                  <PanelActionLink href="/app/persona" icon={<Pencil className="h-4 w-4" />}>
                    Manage Beacon
                  </PanelActionLink>
                  <PanelActionLink href="/app/persona?tab=followers" icon={<Users className="h-4 w-4" />}>
                    Followers
                  </PanelActionLink>
                  <PanelActionLink href="/app/persona/broadcast" icon={<Megaphone className="h-4 w-4" />}>
                    {identityCopy.updates}
                  </PanelActionLink>
                </PanelActions>
              </>
            ) : (
              <PanelActionLink href="/app/persona" variant="primary" icon={<Users className="h-4 w-4" />}>
                Set up Beacon
              </PanelActionLink>
            )}
          </IdentityPanel>

          <IdentityPanel icon={Home} title="Homes" subtitle="Used for household and private home access." id="my-homes">
            {data.homes.length === 0 ? (
              <p className="text-sm text-app-secondary">No homes yet.</p>
            ) : (
              <ul className="divide-y divide-app" data-testid="profiles-homes-list">
                {data.homes.map((home) => {
                  // Per unified-IA §8.1, each home row shows the user's role
                  // alongside the home label so the IA carries the same
                  // signal as the in-app home dashboard sidebar.
                  const role = (home as { role?: string | null }).role || 'member';
                  const locality = (home as { locality?: { city?: string | null; state?: string | null } | null }).locality;
                  const subtitle = [locality?.city, locality?.state].filter(Boolean).join(', ');
                  return (
                    <li key={home.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-app">{home.displayName || 'Home'}</p>
                        {subtitle ? (
                          <p className="truncate text-xs text-app-secondary">{subtitle}</p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium capitalize text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        {role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <PanelActions>
              <PanelActionLink href="/app/homes" variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                Manage Homes
              </PanelActionLink>
              <PanelActionLink href="/app/homes/new" icon={<Plus className="h-4 w-4" />}>
                Add Home
              </PanelActionLink>
            </PanelActions>
          </IdentityPanel>

          <IdentityPanel icon={BriefcaseBusiness} title="Business Profiles" subtitle="Used when acting for a business." id="my-businesses">
            {data.businessProfiles.length === 0 ? (
              <p className="text-sm text-app-secondary">No businesses yet.</p>
            ) : (
              <ul className="divide-y divide-app" data-testid="profiles-businesses-list">
                {data.businessProfiles.map((biz) => {
                  const role = (biz as { role?: string | null }).role || 'member';
                  return (
                    <li key={biz.id} className="flex items-center justify-between gap-3 py-2.5">
                      <p className="truncate text-sm font-medium text-app">{biz.displayName || 'Business'}</p>
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium capitalize text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        {role}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <PanelActions>
              <PanelActionLink href="/app/businesses" variant="primary" icon={<ArrowRight className="h-4 w-4" />}>
                Manage Businesses
              </PanelActionLink>
              <PanelActionLink href="/app/business/new" icon={<Plus className="h-4 w-4" />}>
                Add Business
              </PanelActionLink>
            </PanelActions>
          </IdentityPanel>

          <IdentityPanel icon={ToggleLeft} title={identityCopy.profileLinks} subtitle="Profile links are off by default. Turn them on only if you want people from one profile to discover the other." id="profile-links">
            {canManageProfileLinks ? (
              <div className="space-y-3">
                <BridgeToggle
                  label="Let neighbors find my Beacon"
                  subtitle="If on, your Profile will show a link to your Beacon."
                  checked={data.bridges.show_persona_on_local}
                  disabled={savingBridge}
                  onClick={(trigger) => {
                    profileLinkTriggerRef.current = trigger;
                    setPendingProfileLink({ field: 'show_persona_on_local', nextValue: !data.bridges.show_persona_on_local });
                  }}
                />
                <BridgeToggle
                  label="Let followers find my Profile"
                  subtitle="If on, your Beacon will show a link to your Profile."
                  checked={data.bridges.show_local_on_persona}
                  disabled={savingBridge}
                  onClick={(trigger) => {
                    profileLinkTriggerRef.current = trigger;
                    setPendingProfileLink({ field: 'show_local_on_persona', nextValue: !data.bridges.show_local_on_persona });
                  }}
                />
                {profileLinkError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{profileLinkError}</p>}
              </div>
            ) : <p className="text-sm text-app-secondary">Create both a Profile and a Beacon to manage profile links.</p>}
          </IdentityPanel>

          <IdentityPanel icon={Users} title="Followers" subtitle="Review pending requests, active followers, muted followers, and blocked followers." id="followers">
            {data.audienceProfile ? (
              <PanelActions>
                <PanelActionLink href="/app/persona?tab=followers" variant="primary" icon={<Users className="h-4 w-4" />}>
                  Review Followers
                </PanelActionLink>
              </PanelActions>
            ) : (
              <p className="text-sm text-app-secondary">Create a Beacon before managing followers.</p>
            )}
          </IdentityPanel>

          <IdentityPanel icon={Megaphone} title={identityCopy.updates} subtitle="Publish and review Beacon updates from the same Profiles & Privacy entry point." id="updates">
            {data.audienceProfile ? (
              <PanelActions>
                <PanelActionLink href="/app/persona/broadcast" variant="primary" icon={<Megaphone className="h-4 w-4" />}>
                  Open Updates
                </PanelActionLink>
              </PanelActions>
            ) : (
              <p className="text-sm text-app-secondary">Create a Beacon before publishing updates.</p>
            )}
          </IdentityPanel>
        </div>

        <section id="privacy-preview" tabIndex={-1} className="mt-6 scroll-mt-6 rounded-lg border border-app bg-surface p-5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-app-secondary" />
                <h2 className="font-semibold text-app">{identityCopy.privacyPreview}</h2>
              </div>
              <p className="mt-1 text-sm text-app-secondary">
                Preview exactly what different people can see before you post, share, or link profiles.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(220px,320px)_minmax(220px,1fr)] sm:items-start">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-app-secondary">
                Profile
              </span>
              <select
                value={previewSurface}
                onChange={(event) => {
                  const nextSurface = event.target.value as PreviewSurface;
                  setPreviewSurface(nextSurface);
                  setViewer('public');
                  setPreview(null);
                  setPreviewError('');
                }}
                className="w-full rounded-lg border border-app bg-surface px-3 py-2 text-sm font-medium text-app outline-none focus:ring-2 focus:ring-primary-500"
              >
                {PREVIEW_SURFACES.map((surface) => (
                  <option
                    key={surface.value}
                    value={surface.value}
                    disabled={!getPreviewTarget(data, surface.value)}
                  >
                    {surface.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-secondary">Preview as</p>
              <div className="flex flex-wrap gap-2">
                {visiblePreviewViewers.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={viewer === value}
                    onClick={() => { setViewer(value); void loadPreview(value); }}
                    disabled={!selectedPreviewTarget || loadingPreview}
                    className={`rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
                      viewer === value
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-app bg-surface text-app hover:bg-surface'
                    }`}
                  >
                    {loadingPreview && viewer === value ? 'Loading...' : formatViewerLabel(value, audienceLabel)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!selectedPreviewTarget && (
            <p className="mt-4 rounded-lg border border-app bg-surface-muted px-3 py-2 text-sm text-app-secondary">
              {selectedPreviewSurface.emptyLabel}
            </p>
          )}
          {previewError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{previewError}</div>}
          {preview?.profile && <PreviewProfileCard preview={preview} fallbackViewer={viewer} />}
        </section>

        {/*
          P2.6 / unified-IA §8 — block lists and the "What Pantopus knows"
          disclosure stack at the bottom of the unified surface so every
          §8 section is visible on a single scroll.
        */}
        <div className="mt-6 grid gap-4">
          <BlockListsCard
            counts={data.blockCounts ?? { personal: 0, audience: 0 }}
            hasPersona={Boolean(data.audienceProfile) || (data.personaCount ?? 0) > 0}
          />
          <WhatPantopusKnowsCard />
        </div>
      </div>
      {pendingProfileLink && (
        <ProfileLinkDialog
          field={pendingProfileLink.field}
          enabling={pendingProfileLink.nextValue}
          saving={savingBridge}
          onCancel={() => setPendingProfileLink(null)}
          onConfirm={() => toggleBridge(pendingProfileLink.field, pendingProfileLink.nextValue)}
          returnFocusTo={profileLinkTriggerRef.current}
        />
      )}
    </main>
  );
}

function PreviewProfileCard({ preview, fallbackViewer }: { preview: ViewAsPreview; fallbackViewer: string }) {
  const profile = preview.profile;
  const viewer = preview.viewer || fallbackViewer;
  const isPersona = profile.type === 'persona';
  const handlePrefix = isPersona ? '@' : '/';
  const bridgeLocal = isPersona ? profile.bridges?.localProfile : null;
  const bridgeAudience = !isPersona ? profile.bridges?.audienceProfile : null;
  const avatarText = profile.displayName?.slice(0, 1).toUpperCase() || handlePrefix.slice(0, 1).toUpperCase();
  const visibleSections = preview.visibleSections?.length
    ? preview.visibleSections
    : [
        { key: 'profile', label: 'Profile name and handle' },
        { key: 'summary', label: isPersona ? 'Audience count and public bio' : 'Local trust badge and public locality' },
      ];
  const protectedSections = preview.protectedSections?.length
    ? preview.protectedSections
    : (isPersona
        ? ['Home address', 'nearby posts', 'gigs', 'marketplace listings', 'local reviews', 'household details'].map((label) => ({ key: label, label }))
        : ['Beacon handle', 'follower count', 'updates', 'Beacon links'].map((label) => ({ key: label, label })));
  const posts = preview.sample?.posts || [];
  const broadcasts = preview.sample?.broadcasts || [];
  const counts = preview.counts;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-app bg-surface">
      <div className="border-b border-app bg-surface-muted px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-app-secondary">
          Privacy Preview
        </p>
        <p className="mt-1 text-sm text-app-secondary">
          Viewing as {preview.viewerLabel || formatViewerLabel(viewer)}
        </p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div>
          {isPersona && profile.bannerUrl && (
            <div className="h-32 bg-surface-muted">
              <Image src={profile.bannerUrl} alt="" width={960} height={180} unoptimized className="h-full w-full object-cover" />
            </div>
          )}
          <div className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-primary-600 text-white">
                  {profile.avatarUrl ? (
                    <Image src={profile.avatarUrl} alt="" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-semibold">{avatarText}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-app">{profile.displayName}</h3>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-app-secondary">
                      {isPersona ? identityCopy.beacon : 'Profile'}
                    </span>
                  </div>
                  <p className="text-sm text-app-secondary">{handlePrefix}{profile.handle}</p>
                  {isPersona ? (
                    <p className="mt-2 text-sm text-app-secondary">
                      {profile.followerCount.toLocaleString()} {profile.audienceLabel} · {profile.category}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-app-secondary">
                      {profile.badges?.join(' · ') || 'Profile'}
                    </p>
                  )}
                </div>
              </div>
              {profile.href && (
                <Link href={profile.href} className="inline-flex items-center justify-center rounded-lg border border-app px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted">
                  Open profile
                </Link>
              )}
            </div>
            {profile.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-app">{profile.bio}</p>}
            {(bridgeLocal || bridgeAudience) && (
              <div className="mt-4 rounded-lg border border-app bg-surface-muted p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-app-secondary">Profile link</p>
                <p className="mt-1 text-sm font-medium text-app">{(bridgeLocal || bridgeAudience)?.displayName}</p>
                <p className="text-sm text-app-secondary">
                  {bridgeLocal ? `/${bridgeLocal.handle}` : `@${bridgeAudience?.handle}`}
                </p>
              </div>
            )}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <PreviewSampleList
                  title="Visible Posts"
                  emptyText={counts?.hiddenPosts ? `${counts.hiddenPosts} post${counts.hiddenPosts === 1 ? '' : 's'} hidden for this viewer.` : 'No visible posts in this preview.'}
                items={posts.map((post) => ({
                  id: post.id,
                  meta: String(post.audience || post.visibility || 'visible'),
                  body: post.title || post.content || 'Untitled post',
                }))}
              />
              {isPersona && (
                <PreviewSampleList
                  title="Visible Updates"
                  emptyText={counts?.hiddenBroadcasts ? `${counts.hiddenBroadcasts} update${counts.hiddenBroadcasts === 1 ? '' : 's'} hidden for this viewer.` : 'No visible updates in this preview.'}
                  items={broadcasts.map((message) => ({
                    id: message.id,
                    meta: String(message.visibility || 'visible'),
                    body: message.body || 'Media update',
                  }))}
                />
              )}
            </div>
          </div>
        </div>
        <aside className="border-t border-app bg-surface-muted p-4 lg:border-l lg:border-t-0">
          <div className="rounded-lg border border-app bg-surface p-3">
            <p className="text-sm font-semibold text-app">Visible to this viewer</p>
            <ul className="mt-2 space-y-1 text-sm text-app-secondary">
              {visibleSections.map((item) => <li key={item.key}>{item.label}</li>)}
            </ul>
          </div>
          <div className="mt-3 rounded-lg border border-app bg-surface p-3">
            <p className="text-sm font-semibold text-app">Kept private from this viewer</p>
            <ul className="mt-2 space-y-1 text-sm text-app-secondary">
              {protectedSections.map((item) => <li key={item.key}>{item.label}</li>)}
            </ul>
          </div>
          {counts && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <PreviewCount label="Visible posts" value={counts.visiblePosts} />
              <PreviewCount label="Hidden posts" value={counts.hiddenPosts} />
              {isPersona && <PreviewCount label="Visible updates" value={counts.visibleBroadcasts} />}
              {isPersona && <PreviewCount label="Hidden updates" value={counts.hiddenBroadcasts} />}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function PreviewSampleList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: Array<{ id: string; meta: string; body: string }>;
}) {
  return (
    <div className="rounded-lg border border-app bg-surface-muted p-3">
      <p className="text-sm font-semibold text-app">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-app-secondary">{emptyText}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-app bg-surface p-2">
              <p className="text-xs font-medium uppercase text-app-secondary">{item.meta}</p>
              <p className="mt-1 line-clamp-2 text-sm text-app">{item.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-app bg-surface p-2">
      <p className="text-lg font-semibold text-app">{value}</p>
      <p className="text-xs text-app-secondary">{label}</p>
    </div>
  );
}

function IdentityTabNav({
  tabs,
  hasPublicProfile,
  hasPreviewTarget,
}: {
  tabs: Array<{ key: ProfilePrivacyTab; label: string }>;
  hasPublicProfile: boolean;
  hasPreviewTarget: boolean;
}) {
  return (
    <nav aria-label="Profiles & Privacy sections" className="mb-4 overflow-x-auto rounded-lg border border-app bg-surface p-1">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => {
          const disabled = (tab.key === 'followers' || tab.key === 'updates')
            ? !hasPublicProfile
            : tab.key === 'privacy-preview'
              ? !hasPreviewTarget
              : false;
          const className = disabled
            ? 'inline-flex cursor-not-allowed items-center rounded-lg px-3 py-2 text-sm font-medium text-app-tertiary'
            : 'inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';
          if (disabled) {
            return (
              <span key={tab.key} aria-disabled="true" className={className}>
                {tab.label}
              </span>
            );
          }
          return (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              aria-label={`Profiles & Privacy tab: ${tab.label}`}
              className={className}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function OverviewStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app bg-surface-muted px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-app-secondary">{label}</p>
      <p className="mt-1 text-sm font-semibold text-app">{value}</p>
    </div>
  );
}

function IdentityPanel({ icon: Icon, title, subtitle, children, id }: { icon: typeof Shield; title: string; subtitle: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className="scroll-mt-6 rounded-lg border border-app bg-surface p-5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-lg bg-surface-muted p-2">
          <Icon className="h-5 w-5 text-app-secondary" />
        </div>
        <div>
          <h2 className="font-semibold text-app">{title}</h2>
          <p className="text-sm text-app-secondary">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PanelActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {children}
    </div>
  );
}

function PanelActionLink({
  href,
  icon,
  children,
  variant = 'secondary',
  onClick,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const className = variant === 'primary'
    ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
    : 'inline-flex items-center justify-center gap-2 rounded-lg border border-app bg-surface px-3 py-2 text-sm font-medium text-app hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2';

  return (
    <Link href={href} className={className} onClick={onClick}>
      {icon}
      {children}
    </Link>
  );
}

function BridgeToggle({
  label,
  subtitle,
  checked,
  disabled,
  onClick,
}: {
  label: string;
  subtitle: string;
  checked: boolean;
  disabled: boolean;
  onClick: (trigger: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={(event) => onClick(event.currentTarget)}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-app px-3 py-3 text-left hover:bg-surface-muted disabled:opacity-60"
    >
      <span>
        <span className="block text-sm font-medium text-app">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-app-secondary">{subtitle}</span>
      </span>
      {checked ? <ToggleRight className="h-5 w-5 text-primary-600" /> : <ToggleLeft className="h-5 w-5 text-app-tertiary" />}
    </button>
  );
}

function ProfileLinkDialog({
  field,
  enabling,
  saving,
  onCancel,
  onConfirm,
  returnFocusTo,
}: {
  field: ProfileLinkField;
  enabling: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const source = field === 'show_persona_on_local' ? 'Profile' : identityCopy.beacon;
  const target = field === 'show_persona_on_local' ? identityCopy.beacon : 'Profile';
  const dialogRef = useDialogFocusTrap<HTMLDivElement>(onCancel, returnFocusTo);
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-4" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-link-dialog-title"
        aria-describedby="profile-link-dialog-description"
        className="w-full max-w-md rounded-lg border border-app bg-surface p-5 shadow-2xl"
      >
        <h2 id="profile-link-dialog-title" className="text-lg font-semibold text-app">
          {enabling ? 'Link these profiles?' : 'Remove this profile link?'}
        </h2>
        <p id="profile-link-dialog-description" className="mt-2 text-sm leading-6 text-app-secondary">
          {enabling
            ? `People who can see your ${source} will be able to open your ${target}. You can turn this off later.`
            : 'New visitors will no longer see this link. People who already saved the other profile may still have access to that public link.'}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-app px-4 py-2 text-sm font-medium text-app hover:bg-surface-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : enabling ? 'Link profiles' : 'Remove link'}
          </button>
        </div>
      </div>
    </div>
  );
}
