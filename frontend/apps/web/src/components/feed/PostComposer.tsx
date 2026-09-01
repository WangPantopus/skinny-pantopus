'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Home, Link2, MapPin, Store, Tag, User, type LucideIcon } from 'lucide-react';
import type {
  Audience,
  FeedSurface,
  PersonalPostAs,
  PostingIdentity,
  PostType,
  PostVisibility,
} from '@pantopus/api';
import * as api from '@pantopus/api';
import { Trophy } from 'lucide-react';
import PostLocationPicker from './PostLocationPicker';
import type { SportsComposerMetadata, TopicKey } from '@/constants/feedTopics';
import { SPORTS_COMPOSER_INLINE_INTENTS } from '@/constants/feedTopics';
import { usePostForm, type ProfileVisibilityScope } from './composer/usePostForm';
import IntentSelector, { INTENTS } from './composer/IntentSelector';
import EventFields from './composer/EventFields';
import SafetyAlertFields from './composer/SafetyAlertFields';
import DealFields from './composer/DealFields';
import LostFoundFields from './composer/LostFoundFields';
import ServiceOfferFields from './composer/ServiceOfferFields';
import VisibilityPicker from './composer/VisibilityPicker';
import PostPrecheck from './composer/PostPrecheck';
import MediaUpload from './composer/MediaUpload';
import { InlineDraftHelper } from '@/components/ai-assistant';
import { PURPOSE_TO_POST_TYPE } from '@pantopus/ui-utils';

const POST_TYPE_TO_API_PURPOSE: Record<PostType, string> = {
  ask_local: 'ask',
  service_offer: 'offer',
  alert: 'heads_up',
  recommendation: 'recommend',
  lost_found: 'lost_found',
  local_update: 'local_update',
  neighborhood_win: 'neighborhood_win',
  visitor_guide: 'visitor_guide',
  resources_howto: 'learn',
  progress_wins: 'showcase',
  general: 'story',
  personal_update: 'story',
  event: 'event',
  deal: 'deal',
  announcement: 'heads_up',
};

function apiPurposeForPostType(postType: PostType | null | undefined): string | undefined {
  return postType ? POST_TYPE_TO_API_PURPOSE[postType] : undefined;
}

const LOCAL_PUBLIC_AUDIENCES = new Set<Audience>(['nearby', 'neighborhood', 'saved_place', 'target_area']);

// Personal-zone composer never offers persona. Audience-zone posting goes
// through the separate audience composer (P2.5) and the persona-specific
// routes — see unified-IA §4.1.
const GLOBAL_AUDIENCE_OPTIONS: Record<PersonalPostAs, Array<{ value: Audience; label: string; icon: LucideIcon }>> = {
  personal: [
    { value: 'nearby', label: 'Nearby', icon: MapPin },
    { value: 'connections', label: 'Connections', icon: Link2 },
  ],
  business: [
    { value: 'target_area', label: 'Target Area', icon: MapPin },
  ],
  home: [
    { value: 'neighborhood', label: 'Home Place', icon: MapPin },
    { value: 'household', label: 'Household', icon: Home },
  ],
};

export interface PostComposerSubmitData {
  content: string;
  title?: string;
  postType: PostType;
  visibility: PostVisibility;
  audience?: Audience;
  postAs?: PersonalPostAs;
  identityContextId?: string;
  homeId?: string;
  businessId?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  gpsTimestamp?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  eventDate?: string;
  eventEndDate?: string;
  eventVenue?: string;
  safetyAlertKind?: string;
  behaviorDescription?: string;
  dealExpiresAt?: string;
  businessName?: string;
  lostFoundType?: 'lost' | 'found';
  contactPref?: string;
  serviceCategory?: string;
  tags?: string[];
  crossPostToConnections?: boolean;
  mediaFiles?: File[];
  purpose?: string;
  profileVisibilityScope?: ProfileVisibilityScope;
  showOnProfile?: boolean;
  // Sports topic lane (Phase 1)
  topic?: TopicKey;
  sportsScope?: string;
  postMetadata?: SportsComposerMetadata;
}

interface PostComposerProps {
  onPost: (data: PostComposerSubmitData) => Promise<void>;
  isPosting?: boolean;
  user?: { name?: string; first_name?: string; username?: string; profile_picture_url?: string } | null;
  activeSurface?: FeedSurface;
  // When the composer is opened from the Sports lane, the caller can pre-prime
  // these so the post carries topic/scope/event metadata automatically.
  initialTopic?: TopicKey | null;
  initialSportsScope?: string | null;
  initialSportsMetadata?: SportsComposerMetadata;
  /** When opening from Pulse Sports starters — skip generic intent picker. */
  initialSportsContentSeed?: string | null;
  initialSportsPostType?: PostType | null;
  /** When set, "Turn off" leaves the Sports lane (feed topic) instead of only clearing local composer state. */
  onLeaveSportsTopic?: () => void;
}

function visibilityForAudience(audience: Audience): PostVisibility {
  if (audience === 'public') return 'public';
  if (audience === 'connections') return 'connections';
  if (audience === 'household') return 'private';
  return 'neighborhood';
}

function defaultAudienceForIdentity(identity: PostingIdentity): Audience {
  if (identity.type === 'home') {
    return ['owner', 'admin'].includes((identity.role || '').toLowerCase()) ? 'neighborhood' : 'household';
  }
  if (identity.type === 'business') return 'target_area';
  return 'nearby';
}

function requiresExplicitLocation(postAs: PersonalPostAs, audience: Audience): boolean {
  return (
    (postAs === 'personal' && audience === 'nearby') ||
    (postAs === 'business' && audience === 'target_area')
  );
}

function showLocationControl(postAs: PersonalPostAs, audience: Audience): boolean {
  if (postAs === 'home') return false;
  if (audience === 'connections' || audience === 'public') return false;
  return true;
}

/**
 * Personal-zone composer never accepts a persona identity (unified-IA
 * §4.1). The /api/posts/identities backend already filters persona out
 * (P2.4) but we apply a second filter here so a stale cached response or
 * a future persona-typed row from another source can never appear in the
 * picker.
 */
function isPersonalZoneIdentity(identity: PostingIdentity): boolean {
  return identity.type !== 'persona';
}

export default function PostComposer({
  onPost, isPosting, user, activeSurface,
  initialTopic = null, initialSportsScope = null, initialSportsMetadata,
  initialSportsContentSeed = null, initialSportsPostType = null,
  onLeaveSportsTopic,
}: PostComposerProps) {
  const { state: f, setField, selectIntent, reset, addMedia, removeMedia, dismissPrecheck } = usePostForm();
  const [identities, setIdentities] = useState<PostingIdentity[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState<PostingIdentity | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<Audience>('nearby');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPurposePicker, setShowPurposePicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  // Sports topic state — pre-primed from props so the parent can open the
  // composer into a Sports-lane context. Users can toggle the topic off.
  const [composeTopic, setComposeTopic] = useState<TopicKey | null>(initialTopic);
  const [composeSportsScope, setComposeSportsScope] = useState<string | null>(initialSportsScope);
  const [composeSportsMetadata, setComposeSportsMetadata] = useState<SportsComposerMetadata>(
    initialSportsMetadata ?? {},
  );
  // Keep topic in sync if the parent changes lanes while the composer is mounted.
  useEffect(() => { setComposeTopic(initialTopic); }, [initialTopic]);

  useEffect(() => {
    setComposeSportsScope(initialSportsScope);
  }, [initialSportsScope]);

  const sportsMetaSeed = useMemo(() => JSON.stringify(initialSportsMetadata ?? {}), [initialSportsMetadata]);
  useEffect(() => {
    if (initialTopic !== 'sports') {
      setComposeSportsMetadata({});
      return;
    }
    try {
      setComposeSportsMetadata(JSON.parse(sportsMetaSeed) as SportsComposerMetadata);
    } catch {
      setComposeSportsMetadata({});
    }
  }, [initialTopic, sportsMetaSeed]);

  // Prime modal compose from Sports Pulse starter chips (matches mobile flow).
  useEffect(() => {
    if (!initialSportsPostType && !initialSportsContentSeed) return;
    if (initialSportsPostType) {
      selectIntent(initialSportsPostType);
      setShowPurposePicker(false);
    }
    if (initialSportsContentSeed) {
      setField('content', initialSportsContentSeed);
    }
  }, [initialSportsPostType, initialSportsContentSeed, selectIntent, setField]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const precheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNetworkSurface = activeSurface === 'connections';
  const isGlobalComposer = activeSurface == null;
  const networkVisibility = activeSurface === 'connections'
    ? 'connections'
    : null;

  const activeIntent = INTENTS.find((i) => i.key === f.selectedIntent);
  // selectedIdentity is filtered to personal-zone identities only (see
  // useEffect below), so the type narrows to PersonalPostAs.
  const activePostAs: PersonalPostAs = (selectedIdentity?.type as PersonalPostAs | undefined) || 'personal';
  const globalAudienceOptions = GLOBAL_AUDIENCE_OPTIONS[activePostAs];
  const selectedAudienceLabel = globalAudienceOptions.find((option) => option.value === selectedAudience)?.label || selectedAudience;

  // Backend-allowed post types per identity — filter UI to prevent invalid submissions
  const PLACE_POST_TYPES = ['ask_local', 'recommendation', 'event', 'lost_found', 'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide'];
  const HOME_PLACE_TYPES = ['ask_local', 'recommendation', 'event', 'lost_found', 'alert', 'deal', 'local_update', 'neighborhood_win', 'visitor_guide'];
  const BUSINESS_PLACE_TYPES = ['event', 'deal', 'local_update'];
  const allowedPostTypes = activePostAs === 'home'
    ? HOME_PLACE_TYPES
    : activePostAs === 'business'
    ? BUSINESS_PLACE_TYPES
    : PLACE_POST_TYPES;
  const needsLocation = requiresExplicitLocation(activePostAs, selectedAudience);
  const canUseGlobalAudience = isGlobalComposer && !!selectedIdentity;
  const showGlobalLocation = canUseGlobalAudience && showLocationControl(activePostAs, selectedAudience);
  const homeNeighborhoodLocked = activePostAs === 'home' && selectedAudience === 'neighborhood'
    && !['owner', 'admin'].includes((selectedIdentity?.role || '').toLowerCase());

  const contentPlaceholder = activeSurface === 'connections'
    ? 'Share something with your connections…'
    : canUseGlobalAudience && selectedAudience === 'connections'
    ? 'Share something with your connections…'
    : canUseGlobalAudience && activePostAs === 'home' && selectedAudience === 'neighborhood'
    ? 'Share something with your home neighborhood…'
    : activeIntent?.placeholder || 'Share something with your neighborhood…';

  const resetComposer = useCallback(() => {
    reset();
    setSubmitError(null);
    setShowPurposePicker(false);
    setShowTargetPicker(false);
    if (!isGlobalComposer || identities.length === 0) return;
    const fallbackIdentity = identities.find((identity) => identity.type === 'personal') || identities[0] || null;
    setSelectedIdentity(fallbackIdentity);
    if (fallbackIdentity) {
      setSelectedAudience(defaultAudienceForIdentity(fallbackIdentity));
    }
  }, [identities, isGlobalComposer, reset]);

  useEffect(() => {
    if (!isGlobalComposer) return;
    let cancelled = false;
    api.posts.getPostingIdentities()
      .then((res) => {
        if (cancelled) return;
        // Hard rule per unified-IA §4.1: persona identities are NEVER
        // available in the personal-zone composer. Filter on the client
        // even though /api/posts/identities also filters server-side
        // (defense-in-depth — a stale cache or alternate code path
        // returning persona rows must not surface the picker).
        const nextIdentities = (res.identities || []).filter(isPersonalZoneIdentity);
        setIdentities(nextIdentities);
        const fallbackIdentity = nextIdentities.find((identity) => identity.type === 'personal') || nextIdentities[0] || null;
        setSelectedIdentity(fallbackIdentity);
        if (fallbackIdentity) {
          setSelectedAudience(defaultAudienceForIdentity(fallbackIdentity));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIdentities([]);
          setSelectedIdentity(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isGlobalComposer]);

  // Defense-in-depth: if a persona-typed identity ever ends up selected
  // (e.g., from a stale localStorage entry, a state migration, or a future
  // bug), force-reset to a personal-zone identity. This protects the hard
  // rule from unified-IA §4.1 against silent regressions.
  useEffect(() => {
    if (selectedIdentity && (selectedIdentity.type as string) === 'persona') {
      const fallback = identities.find((i) => i.type === 'personal') || identities[0] || null;
      setSelectedIdentity(fallback);
      if (fallback) setSelectedAudience(defaultAudienceForIdentity(fallback));
    }
  }, [selectedIdentity, identities]);

  useEffect(() => {
    if (!canUseGlobalAudience || !selectedIdentity) return;
    if (globalAudienceOptions.some((option) => option.value === selectedAudience)) return;
    setSelectedAudience(defaultAudienceForIdentity(selectedIdentity));
  }, [canUseGlobalAudience, globalAudienceOptions, selectedAudience, selectedIdentity]);

  useEffect(() => {
    if (!isNetworkSurface) return;

    if (f.selectedIntent && f.selectedIntent !== 'general') {
      setField('selectedIntent', 'general');
    }
    if (networkVisibility && f.visibility !== networkVisibility) {
      setField('visibility', networkVisibility);
    }
    if (f.crossPostConnections) setField('crossPostConnections', false);
    if (f.showVisibility) setField('showVisibility', false);
  }, [
    isNetworkSurface,
    networkVisibility,
    f.selectedIntent,
    f.visibility,
    f.crossPostConnections,
    f.showVisibility,
    setField,
  ]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ai_post_draft');
      if (!raw) return;
      sessionStorage.removeItem('ai_post_draft');
      const draft = JSON.parse(raw);
      if (draft.content) setField('content', draft.content);
      if (draft.title) setField('title', draft.title);
      if (draft.postType) selectIntent(draft.postType);
      setField('expanded', true);
    } catch {
      // ignore parse errors
    }
  }, [setField, selectIntent]);

  useEffect(() => {
    if (f.selectedIntent && textareaRef.current) textareaRef.current.focus();
  }, [f.selectedIntent]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (composerRef.current && !composerRef.current.contains(target)) {
        if (!f.content.trim()) {
          setField('expanded', false);
          setField('selectedIntent', null);
        }
        setField('showVisibility', false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [f.content, setField]);

  /** Legacy UI used `public`; align with mobile + API (connections only). */
  useEffect(() => {
    if (f.visibility === 'public') {
      setField('visibility', 'connections');
    }
  }, [f.visibility, setField]);

  useEffect(() => {
    if (!f.content || f.content.length < 30 || !f.selectedIntent) return;
    if (precheckTimerRef.current) clearTimeout(precheckTimerRef.current);
    precheckTimerRef.current = setTimeout(async () => {
      try {
        const selectedIntent = f.selectedIntent;
        if (!selectedIntent) return;
        const result = await api.posts.precheckPost({
          content: f.content,
          purpose: apiPurposeForPostType(selectedIntent),
          surface: activeSurface || 'place',
        });
        if (result.suggestions?.length > 0) {
          setField('precheckSuggestions', result.suggestions);
        }
      } catch {
        // fail open
      }
    }, 1500);
    return () => {
      if (precheckTimerRef.current) clearTimeout(precheckTimerRef.current);
    };
  }, [f.content, f.selectedIntent, activeSurface, setField]);

  useEffect(() => {
    if (!canUseGlobalAudience || activePostAs !== 'home') return;
    setField('location', null);
  }, [activePostAs, canUseGlobalAudience, selectedAudience, setField]);

  // When identity changes, reset intent if it's not allowed for the new identity
  useEffect(() => {
    if (!canUseGlobalAudience || !f.selectedIntent) return;
    if (!allowedPostTypes.includes(f.selectedIntent)) {
      setShowPurposePicker(true);
    }
  }, [canUseGlobalAudience, activePostAs, f.selectedIntent, allowedPostTypes]);

  const userInitial =
    user?.first_name?.[0]?.toUpperCase() ||
    user?.name?.[0]?.toUpperCase() ||
    user?.username?.[0]?.toUpperCase() ||
    '?';

  const handlePost = async () => {
    if (!f.content.trim() || !f.selectedIntent) return;

    setSubmitError(null);

    if (isGlobalComposer && !selectedIdentity) {
      setSubmitError('Loading posting identities…');
      return;
    }

    let targetVisibility: PostVisibility = networkVisibility || f.visibility;
    let targetAudience: Audience = targetVisibility === 'connections'
      ? 'connections'
      : 'nearby';
    let targetPostType: PostType = isNetworkSurface ? 'general' : f.selectedIntent;
    let targetPostAs: PersonalPostAs = 'personal';
    let identityContextId: string | undefined;
    let homeId: string | undefined;
    let businessId: string | undefined;

    if (canUseGlobalAudience && selectedIdentity && isPersonalZoneIdentity(selectedIdentity)) {
      targetPostAs = selectedIdentity.type as PersonalPostAs;
      targetAudience = selectedAudience;
      targetVisibility = visibilityForAudience(selectedAudience);
      targetPostType = f.selectedIntent;
      if (selectedIdentity.type === 'home') homeId = selectedIdentity.id;
      if (selectedIdentity.type === 'business') businessId = selectedIdentity.id;
    }

    if (canUseGlobalAudience && !allowedPostTypes.includes(targetPostType)) {
      setShowPurposePicker(true);
      setSubmitError('Choose a post type that fits this identity.');
      return;
    }

    if (LOCAL_PUBLIC_AUDIENCES.has(targetAudience) && targetPostType === 'general') {
      setShowPurposePicker(true);
      return;
    }

    if (homeNeighborhoodLocked) {
      setSubmitError('Only Home Owners and Admins can post to a home Place feed.');
      return;
    }

    if (requiresExplicitLocation(targetPostAs, targetAudience) && !f.location) {
      setSubmitError('Choose a location before posting there.');
      return;
    }

    const shouldIncludeLocation = Boolean(f.location && showLocationControl(targetPostAs, targetAudience));
    const parsedTags = f.tags.split(',').map((t) => t.trim()).filter(Boolean);
    await onPost({
      content: f.content.trim(),
      title: f.title.trim() || undefined,
      postType: targetPostType,
      visibility: targetVisibility,
      audience: targetAudience,
      postAs: targetPostAs,
      identityContextId,
      homeId,
      businessId,
      ...(shouldIncludeLocation && f.location
        ? {
            latitude: f.location.latitude,
            longitude: f.location.longitude,
            locationName: f.location.locationName,
            locationAddress: f.location.locationAddress,
            gpsTimestamp: f.location.gpsTimestamp,
            gpsLatitude: f.location.gpsLatitude,
            gpsLongitude: f.location.gpsLongitude,
          }
        : {}),
      eventDate: f.selectedIntent === 'event' && f.eventDate ? f.eventDate : undefined,
      eventEndDate: f.selectedIntent === 'event' && f.eventEndDate ? f.eventEndDate : undefined,
      eventVenue: f.selectedIntent === 'event' && f.eventVenue ? f.eventVenue : undefined,
      safetyAlertKind: f.selectedIntent === 'alert' ? f.safetyKind : undefined,
      behaviorDescription: f.selectedIntent === 'alert' && f.behaviorDesc ? f.behaviorDesc : undefined,
      dealExpiresAt: f.selectedIntent === 'deal' && f.dealExpires ? f.dealExpires : undefined,
      businessName: f.selectedIntent === 'deal' && f.dealBusinessName ? f.dealBusinessName : undefined,
      lostFoundType: f.selectedIntent === 'lost_found' ? f.lostFoundType : undefined,
      contactPref: f.selectedIntent === 'lost_found' && f.contactPref ? f.contactPref : undefined,
      serviceCategory:
        f.selectedIntent === 'service_offer' || ['ask_local', 'recommendation'].includes(f.selectedIntent)
          ? f.serviceCategory || undefined
          : undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
      crossPostToConnections: !isNetworkSurface && !canUseGlobalAudience ? (f.crossPostConnections || undefined) : undefined,
      mediaFiles: f.mediaFiles.length > 0 ? f.mediaFiles : undefined,
      purpose: apiPurposeForPostType(targetPostType),
      profileVisibilityScope: f.profileVisibilityScope,
      showOnProfile: true,
      ...(composeTopic === 'sports'
        ? {
            topic: 'sports' as const,
            sportsScope: composeSportsScope || undefined,
            postMetadata: Object.keys(composeSportsMetadata).length > 0
              ? composeSportsMetadata
              : undefined,
          }
        : {}),
    });
    resetComposer();
  };

  const globalIdentityChip = useMemo(() => {
    if (!selectedIdentity) return null;
    if (selectedIdentity.type === 'home') return <Home className="h-4 w-4" />;
    if (selectedIdentity.type === 'business') return <Store className="h-4 w-4" />;
    return <User className="h-4 w-4" />;
  }, [selectedIdentity]);

  const sportsTopicActive = composeTopic === 'sports';

  return (
    <div ref={composerRef} className="relative">
      {sportsTopicActive && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 dark:border-primary-700/40 dark:bg-primary-500/10 dark:text-primary-200">
          <Trophy className="h-3.5 w-3.5" />
          <span>Posting to Sports</span>
          {composeSportsScope && (
            <span className="text-primary-600/80 dark:text-primary-300/80">· scope: {composeSportsScope}</span>
          )}
          <button
            type="button"
            onClick={() => {
              if (onLeaveSportsTopic) {
                onLeaveSportsTopic();
              } else {
                setComposeTopic(null);
              }
              setComposeSportsScope(null);
              setComposeSportsMetadata({});
            }}
            className="ml-auto text-[11px] underline opacity-70 hover:opacity-100"
          >
            Turn off
          </button>
        </div>
      )}

      {!f.expanded && (
        <IntentSelector onSelect={selectIntent} user={user} activeSurface={activeSurface} />
      )}

      {f.expanded && activeIntent && (
        <div
          className="overflow-hidden rounded-2xl border border-app bg-surface shadow-lg transition-all duration-300"
          style={{ borderColor: `${activeIntent.color}30` }}
        >
          <div className="flex items-center justify-between px-4 py-2.5" style={{ background: activeIntent.bgLight }}>
            <div className="flex items-center gap-2">
              <span>{activeIntent.icon}</span>
              <span className="text-sm font-semibold" style={{ color: activeIntent.color }}>
                {activeIntent.label === 'Share' ? 'General Post' : activeIntent.label}
              </span>
            </div>
            {!isNetworkSurface && (
              <div className="flex items-center gap-1">
                {INTENTS.filter((intent) => intent.key !== f.selectedIntent && allowedPostTypes.includes(intent.key)).slice(0, 3).map((intent) => (
                  <button
                    key={intent.key}
                    onClick={() => { setField('selectedIntent', intent.key); setShowPurposePicker(false); }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs transition hover:scale-110"
                    style={{ background: `${intent.color}15` }}
                    title={intent.label}
                  >
                    {intent.icon}
                  </button>
                ))}
              </div>
            )}
          </div>

          {canUseGlobalAudience && selectedIdentity && (
            <div className="space-y-3 border-b border-app px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-muted px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-app-secondary">
                    Posting as: <span className="font-medium text-app">{selectedIdentity.name}</span>
                  </span>
                  <span className="text-app-secondary">
                    Visible to: <span className="font-medium text-app">{selectedAudienceLabel}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTargetPicker((open) => !open)}
                  className="ml-auto rounded-lg border border-app bg-surface px-2.5 py-1 text-xs font-medium text-app hover:bg-surface-muted"
                >
                  Change
                </button>
              </div>

              {showTargetPicker && (
                <div className="space-y-3 rounded-lg border border-app bg-surface-muted p-3">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-secondary">Post as</p>
                    <div className="flex flex-wrap gap-2">
                      {identities.map((identity) => {
                        const isActive = identity.id === selectedIdentity.id && identity.type === selectedIdentity.type;
                        const icon = identity.type === 'home'
                          ? <Home className="h-3.5 w-3.5" />
                          : identity.type === 'business'
                          ? <Store className="h-3.5 w-3.5" />
                          : <User className="h-3.5 w-3.5" />;
                        return (
                          <button
                            key={`${identity.type}-${identity.id}`}
                            type="button"
                            data-testid={`posting-identity-${identity.type}`}
                            onClick={() => {
                              setSelectedIdentity(identity);
                              setSelectedAudience(defaultAudienceForIdentity(identity));
                              setSubmitError(null);
                            }}
                            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                              isActive
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-app bg-surface text-app-muted hover-bg-app'
                            }`}
                          >
                            <span>{icon}</span>
                            <span className="font-medium">{identity.name}</span>
                            {identity.role && (
                              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                                {identity.role}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-app-secondary">Visible to</p>
                    <div className="flex flex-wrap gap-2">
                      {globalAudienceOptions.map((option) => {
                        const isActive = option.value === selectedAudience;
                        const Icon = option.icon;
                        const disabled = activePostAs === 'home'
                          && option.value === 'neighborhood'
                          && !['owner', 'admin'].includes((selectedIdentity.role || '').toLowerCase());
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setSelectedAudience(option.value);
                              setSubmitError(null);
                            }}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${
                              isActive
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-app bg-surface text-app-muted hover-bg-app'
                            } disabled:cursor-not-allowed disabled:opacity-45`}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="font-medium">{option.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activePostAs === 'home' && (
                    <div className="flex items-center gap-2 text-xs text-app-muted">
                      <span className="rounded-full bg-surface px-2 py-1">{globalIdentityChip}</span>
                      <span>
                        {selectedAudience === 'neighborhood'
                          ? `Posting to ${selectedIdentity.name}'s Place feed without needing current GPS.`
                          : `Posting privately as ${selectedIdentity.name}.`}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="p-4">
            <div className="flex gap-3">
              {user?.profile_picture_url ? (
                <Image
                  src={user.profile_picture_url}
                  alt=""
                  className="mt-0.5 h-8 w-8 flex-shrink-0 rounded-full object-cover"
                  width={32}
                  height={32}
                  sizes="32px"
                  quality={75}
                />
              ) : (
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
                  {userInitial}
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={f.content}
                onChange={(e) => {
                  setField('content', e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                placeholder={contentPlaceholder}
                rows={3}
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-app outline-none placeholder:text-app-muted"
                maxLength={5000}
                spellCheck
                autoCorrect="on"
                autoCapitalize="sentences"
              />
            </div>
          </div>

          <div className="px-4 pb-1">
            <InlineDraftHelper
              mode="post"
              compact
              seed={f.content}
              context={{ postType: f.selectedIntent || undefined, existingContent: f.content || undefined }}
              onDraft={(fields) => {
                if (fields.content) setField('content', fields.content);
                if (fields.title) setField('title', fields.title);
              }}
            />
          </div>

          <PostPrecheck suggestions={f.precheckSuggestions} onDismiss={dismissPrecheck} />

          {f.selectedIntent && (
            <div className="flex items-center gap-2 px-4 pb-2 text-sm">
              <span className="text-xs font-medium text-app-muted">Post visibility:</span>
              {(['local_context', 'connections'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => {
                    setField('profileVisibilityScope', scope);
                    if (scope !== 'local_context') setShowPurposePicker(false);
                  }}
                  className={`rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                    f.profileVisibilityScope === scope
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-app bg-surface text-app-muted hover-bg-app'
                  }`}
                >
                  {scope === 'local_context' ? 'Local' : scope.charAt(0).toUpperCase() + scope.slice(1)}
                </button>
              ))}
            </div>
          )}

          {showPurposePicker && (
            <div className="px-4 pb-3">
              <p className="mb-2 text-xs font-semibold text-app">
                {sportsTopicActive && !isNetworkSurface ? 'What kind of sports post?' : 'What is this post for?'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {sportsTopicActive && !isNetworkSurface
                  ? SPORTS_COMPOSER_INLINE_INTENTS.map((item) => (
                      <button
                        key={item.starter_key}
                        type="button"
                        onClick={() => {
                          setField('selectedIntent', 'ask_local');
                          setComposeSportsScope(item.scope);
                          setComposeSportsMetadata({
                            ...item.meta,
                            starter_key: item.starter_key,
                          });
                          setShowPurposePicker(false);
                          setSubmitError(null);
                        }}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all hover:scale-[1.02] active:scale-95"
                        style={{ background: item.bg, color: item.color, borderColor: `${item.color}30` }}
                      >
                        <span className="text-base">{item.icon}</span>
                        {item.label}
                      </button>
                    ))
                  : ([
                      { purpose: 'ask', label: 'Ask', icon: '❓', bg: '#EFF6FF', color: '#0284C7' },
                      { purpose: 'offer', label: 'Offer', icon: '🤚', bg: '#FAF5FF', color: '#7C3AED' },
                      { purpose: 'heads_up', label: 'Heads Up', icon: '🚨', bg: '#FEF2F2', color: '#DC2626' },
                      { purpose: 'recommend', label: 'Recommend', icon: '⭐', bg: '#FFFBEB', color: '#F59E0B' },
                      { purpose: 'story', label: 'Story', icon: '💬', bg: '#F9FAFB', color: '#4B5563' },
                      { purpose: 'event', label: 'Event', icon: '📅', bg: '#F5F3FF', color: '#8B5CF6' },
                      { purpose: 'deal', label: 'Deal', icon: '🏷️', bg: '#F0FDF4', color: '#16A34A' },
                    ] as const)
                      .filter((item) => {
                        const mappedType = PURPOSE_TO_POST_TYPE[item.purpose] || 'general';
                        return allowedPostTypes.includes(mappedType);
                      })
                      .map((item) => (
                        <button
                          key={item.purpose}
                          type="button"
                          onClick={() => {
                            const postType = PURPOSE_TO_POST_TYPE[item.purpose] || 'general';
                            setField('selectedIntent', postType as PostType);
                            setShowPurposePicker(false);
                            setSubmitError(null);
                          }}
                          className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all hover:scale-[1.02] active:scale-95"
                          style={{ background: item.bg, color: item.color, borderColor: `${item.color}30` }}
                        >
                          <span className="text-base">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
              </div>
            </div>
          )}

          {['event', 'alert', 'deal', 'service_offer', 'announcement', 'lost_found'].includes(f.selectedIntent || '') && (
            <input
              className="w-full border-b border-app bg-transparent px-4 py-2 text-sm font-semibold text-app outline-none placeholder:text-app-muted"
              placeholder="Title (optional)"
              value={f.title}
              onChange={(e) => setField('title', e.target.value)}
              spellCheck
              autoCorrect="on"
              autoCapitalize="sentences"
            />
          )}

          {f.selectedIntent === 'event' && (
            <EventFields
              eventVenue={f.eventVenue}
              onEventVenueChange={(v) => setField('eventVenue', v)}
              eventDate={f.eventDate}
              onEventDateChange={(v) => setField('eventDate', v)}
              eventEndDate={f.eventEndDate}
              onEventEndDateChange={(v) => setField('eventEndDate', v)}
            />
          )}
          {f.selectedIntent === 'alert' && (
            <SafetyAlertFields
              safetyKind={f.safetyKind}
              onSafetyKindChange={(v) => setField('safetyKind', v)}
              behaviorDesc={f.behaviorDesc}
              onBehaviorDescChange={(v) => setField('behaviorDesc', v)}
            />
          )}
          {f.selectedIntent === 'deal' && (
            <DealFields
              dealBusinessName={f.dealBusinessName}
              onDealBusinessNameChange={(v) => setField('dealBusinessName', v)}
              dealExpires={f.dealExpires}
              onDealExpiresChange={(v) => setField('dealExpires', v)}
            />
          )}
          {f.selectedIntent === 'lost_found' && (
            <LostFoundFields
              lostFoundType={f.lostFoundType}
              onLostFoundTypeChange={(v) => setField('lostFoundType', v)}
              contactPref={f.contactPref}
              onContactPrefChange={(v) => setField('contactPref', v)}
            />
          )}
          {['service_offer', 'ask_local', 'recommendation'].includes(f.selectedIntent || '') && (
            <ServiceOfferFields
              serviceCategory={f.serviceCategory}
              onServiceCategoryChange={(v) => setField('serviceCategory', v)}
            />
          )}

          <div className="flex items-center gap-2 border-t border-app px-4 py-2">
            <span className="text-app-muted">
              <Tag className="h-4 w-4" />
            </span>
            <input
              className="flex-1 bg-transparent text-sm text-app outline-none placeholder:text-app-muted"
              placeholder="Tags (comma separated)"
              value={f.tags}
              onChange={(e) => setField('tags', e.target.value)}
            />
          </div>

          {!isNetworkSurface && !canUseGlobalAudience && f.visibility === 'neighborhood' && (
            <div className="flex gap-3 border-t border-app px-4 py-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-app-muted">
                <input
                  type="checkbox"
                  checked={f.crossPostConnections}
                  onChange={(e) => setField('crossPostConnections', e.target.checked)}
                  className="rounded text-primary-600"
                />
                Also share to Connections
              </label>
            </div>
          )}

          <MediaUpload mediaFiles={f.mediaFiles} onAddMedia={addMedia} onRemoveMedia={removeMedia} />

          <div className="space-y-2 border-t border-app bg-surface-muted/60 px-4 py-3">
            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {submitError}
              </div>
            )}

            {showGlobalLocation && f.location && (
              <div className="flex items-center">
                <PostLocationPicker value={f.location} onChange={(loc) => setField('location', loc)} accentColor={activeIntent.color} />
              </div>
            )}

            {!canUseGlobalAudience && !isNetworkSurface && f.location && (
              <div className="flex items-center">
                <PostLocationPicker value={f.location} onChange={(loc) => setField('location', loc)} accentColor={activeIntent.color} />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!canUseGlobalAudience && !isNetworkSurface && (
                  <VisibilityPicker
                    visibility={f.visibility}
                    showVisibility={f.showVisibility}
                    onVisibilityChange={(v) => {
                      setField('visibility', v);
                      setField('showVisibility', false);
                    }}
                    onToggle={() => setField('showVisibility', !f.showVisibility)}
                  />
                )}

                {showGlobalLocation && !f.location && (
                  <PostLocationPicker value={null} onChange={(loc) => setField('location', loc)} accentColor={activeIntent.color} />
                )}

                {!canUseGlobalAudience && !isNetworkSurface && !f.location && (
                  <PostLocationPicker value={null} onChange={(loc) => setField('location', loc)} accentColor={activeIntent.color} />
                )}

                {!showGlobalLocation && canUseGlobalAudience && needsLocation && (
                  <span className="text-xs text-amber-700">Pick a location to post there.</span>
                )}

                <span className="text-[10px] tabular-nums text-app-muted">{f.content.length}/5000</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetComposer}
                  className="px-3 py-1.5 text-xs font-medium text-app-muted transition hover:text-app"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!f.content.trim() || isPosting}
                  className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: activeIntent.color }}
                >
                  {isPosting ? 'Posting…' : activeIntent.cta}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
