'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Bell, Check, Copy, ExternalLink, Image as ImageIcon, Link as LinkIcon, Megaphone, Plus, RefreshCw, Save, Share2, ShieldCheck, Sparkles, Trash2, UploadCloud, UserCheck, UserMinus, UserX } from 'lucide-react';
import * as api from '@pantopus/api';
import type { PersonaCategoryPolicy } from '@pantopus/api';
import type { AudienceProfile, BroadcastChannel, PersonaFollower, PersonaFollowerCounts, PersonaFollowStatus } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';
import { trackIdentityEvent } from '@/lib/identityAnalytics';
import { identityCopy, normalizeIdentityProductLanguage } from '@/lib/identityLabels';
import { useDialogFocusTrap } from '@/lib/useDialogFocusTrap';

const CATEGORIES = [
  { value: 'creator', label: 'Creator' },
  { value: 'writer', label: 'Writer' },
  { value: 'coach', label: 'Coach' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'community_leader', label: 'Community Leader' },
  { value: 'public_figure', label: 'Public Figure' },
  { value: 'other', label: 'Other Public Role' },
];

const FALLBACK_SENSITIVE_CATEGORY_POLICIES: PersonaCategoryPolicy[] = [
  { category: 'doctor', label: 'Doctor', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'organization_review', 'consent_controls'] },
  { category: 'therapist', label: 'Therapist', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'organization_review', 'consent_controls'] },
  { category: 'lawyer', label: 'Lawyer', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'consent_controls'] },
  { category: 'teacher', label: 'Teacher', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'organization_review', 'consent_controls', 'minor_safeguards'] },
  { category: 'tutor', label: 'Tutor', sensitive: true, enabled: false, defaultAudienceMode: 'approval_required', requirements: ['credential_verification', 'consent_controls', 'minor_safeguards'] },
];

const AUDIENCE_LABELS = [
  { value: 'followers', label: 'Followers' },
  { value: 'subscribers', label: 'Subscribers' },
  { value: 'members', label: 'Members' },
  { value: 'students', label: 'Students' },
  { value: 'clients', label: 'Clients' },
  { value: 'customers', label: 'Customers' },
];

const AUDIENCE_MODES = [
  {
    value: 'open',
    label: 'Open',
    description: 'People can follow immediately.',
  },
  {
    value: 'approval_required',
    label: 'Approval required',
    description: 'New followers wait for your approval.',
  },
];

const FOLLOWER_FILTERS = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'muted', label: 'Muted' },
  { value: 'blocked', label: 'Blocked' },
];

const SETUP_STEPS = [
  { value: 'basics', label: 'Basics' },
  { value: 'audience', label: 'Audience' },
  { value: 'preview', label: 'Preview' },
] as const;

const MANAGEMENT_TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'audience', label: 'Audience settings' },
  { value: 'preview', label: 'Preview' },
  { value: 'followers', label: 'Followers' },
] as const;

type SetupStep = typeof SETUP_STEPS[number]['value'];
type ManagementTab = typeof MANAGEMENT_TABS[number]['value'];

type PublicLinkForm = {
  label: string;
  url: string;
};

type PublicProfileForm = {
  handle: string;
  display_name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  category: string;
  audience_label: string;
  audience_mode: string;
  public_links: PublicLinkForm[];
};

type PendingFollowerAction = {
  follower: PersonaFollower;
  status: Extract<PersonaFollowStatus, 'removed' | 'blocked'>;
  returnFocusTo?: HTMLElement | null;
};

function revokePreviewUrl(url: string) {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

function normalizePublicLinksForForm(links: Array<{ label?: string; url?: string }> | undefined | null): PublicLinkForm[] {
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => ({
      label: String(link.label || ''),
      url: String(link.url || ''),
    }))
    .slice(0, 8);
}

function normalizePublicLinksForSave(links: PublicLinkForm[]) {
  return links
    .map((link) => {
      const label = link.label.trim();
      const rawUrl = link.url.trim();
      if (!label && !rawUrl) return null;
      const url = rawUrl && /^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      return { label, url };
    })
    .filter((link): link is { label: string; url: string } => Boolean(link));
}

function getErrorMessage(err: unknown, fallback: string) {
  const normalize = (message: string) => normalizeIdentityProductLanguage(message);
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message?: unknown }).message === 'string') {
    return normalize((err as { message: string }).message);
  }
  if (err instanceof Error) return normalize(err.message);
  return normalize(fallback);
}

function titleCase(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRequirement(requirement: string) {
  const labels: Record<string, string> = {
    credential_verification: 'credential verification',
    organization_review: 'organization review',
    consent_controls: 'consent controls',
    minor_safeguards: 'minor safeguards',
    unsupported_category: 'unsupported category',
  };
  return labels[requirement] || requirement.replace(/_/g, ' ');
}

export default function AudienceProfileSettingsPage() {
  const searchParams = useSearchParams();
  const [persona, setPersona] = useState<AudienceProfile | null>(null);
  const [channel, setChannel] = useState<BroadcastChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<'idle' | 'profile' | 'avatar' | 'banner'>('idle');
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [followerStatusFilter, setFollowerStatusFilter] = useState('active');
  const [setupStep, setSetupStep] = useState<SetupStep>('basics');
  const [managementTab, setManagementTab] = useState<ManagementTab>('profile');
  const [showSensitiveCategoryInfo, setShowSensitiveCategoryInfo] = useState(false);
  const [followers, setFollowers] = useState<PersonaFollower[]>([]);
  const [followerCounts, setFollowerCounts] = useState<PersonaFollowerCounts | null>(null);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followersError, setFollowersError] = useState('');
  const [updatingFollowerId, setUpdatingFollowerId] = useState('');
  const [pendingFollowerAction, setPendingFollowerAction] = useState<PendingFollowerAction | null>(null);
  const [categoryPolicies, setCategoryPolicies] = useState<PersonaCategoryPolicy[]>([]);
  const [categoryPolicyLoadError, setCategoryPolicyLoadError] = useState('');
  const [mediaFiles, setMediaFiles] = useState<{ avatar: File | null; banner: File | null }>({
    avatar: null,
    banner: null,
  });
  const [mediaPreviews, setMediaPreviews] = useState<{ avatar: string; banner: string }>({
    avatar: '',
    banner: '',
  });
  const mediaPreviewUrlsRef = useRef<{ avatar: string; banner: string }>({
    avatar: '',
    banner: '',
  });
  const [form, setForm] = useState<PublicProfileForm>({
    handle: '',
    display_name: '',
    bio: '',
    avatar_url: '',
    banner_url: '',
    category: 'creator',
    audience_label: 'followers',
    audience_mode: 'open',
    public_links: [] as PublicLinkForm[],
  });

  const loadPersona = useCallback(() => {
    let mounted = true;
    setLoading(true);
    setLoadError('');
    api.personas.getMyPersona()
      .then((res) => {
        if (!mounted) return;
        setPersona(res.persona);
        setChannel(res.channel);
        if (res.persona) {
          setForm({
            handle: res.persona.handle,
            display_name: res.persona.displayName,
            bio: res.persona.bio || '',
            avatar_url: res.persona.avatarUrl || '',
            banner_url: res.persona.bannerUrl || '',
            category: res.persona.category,
            audience_label: res.persona.audienceLabel,
            audience_mode: res.persona.audienceMode,
            public_links: normalizePublicLinksForForm(res.persona.publicLinks),
          });
          setMediaFiles({ avatar: null, banner: null });
          setMediaPreviews({ avatar: '', banner: '' });
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load Beacon.');
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => loadPersona(), [loadPersona]);

  useEffect(() => {
    let mounted = true;
    api.personas.getPersonaCategoryPolicies()
      .then((res) => {
        if (!mounted) return;
        setCategoryPolicies(res.categories || []);
        setCategoryPolicyLoadError('');
      })
      .catch((err) => {
        if (!mounted) return;
        setCategoryPolicyLoadError(getErrorMessage(err, 'Could not load category policy.'));
      });
    return () => { mounted = false; };
  }, []);

  const loadFollowers = useCallback(async () => {
    if (!persona?.id) {
      setFollowers([]);
      setFollowerCounts(null);
      return;
    }
    setFollowersLoading(true);
    setFollowersError('');
    try {
      const res = await api.personas.getPersonaFollowers(persona.id, {
        status: followerStatusFilter === 'all' ? undefined : followerStatusFilter,
        limit: 50,
      });
      setFollowers(res.followers || []);
      setFollowerCounts(res.counts || null);
    } catch (err) {
      setFollowersError(getErrorMessage(err, 'Could not load followers.'));
    } finally {
      setFollowersLoading(false);
    }
  }, [persona?.id, followerStatusFilter]);

  useEffect(() => {
    if (managementTab === 'followers') void loadFollowers();
  }, [loadFollowers, managementTab]);

  useEffect(() => {
    const requestedTab = searchParams.get('tab') as ManagementTab | null;
    if (!persona || !requestedTab) return;
    if (MANAGEMENT_TABS.some((tab) => tab.value === requestedTab)) {
      setManagementTab(requestedTab);
    }
  }, [persona, searchParams]);

  const clearMediaPreview = (kind: 'avatar' | 'banner') => {
    revokePreviewUrl(mediaPreviewUrlsRef.current[kind]);
    mediaPreviewUrlsRef.current[kind] = '';
  };

  useEffect(() => {
    const previewUrls = mediaPreviewUrlsRef.current;
    return () => {
      Object.values(previewUrls).forEach(revokePreviewUrl);
    };
  }, []);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
    if (statusMessage) setStatusMessage('');
  };

  const setMediaFile = (kind: 'avatar' | 'banner', file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(`${kind === 'avatar' ? 'Avatar' : 'Banner'} must be an image file.`);
      return;
    }
    setMediaFiles((prev) => ({ ...prev, [kind]: file }));
    setMediaPreviews((prev) => {
      clearMediaPreview(kind);
      const previewUrl =
        typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : '';
      mediaPreviewUrlsRef.current[kind] = previewUrl;
      return { ...prev, [kind]: previewUrl };
    });
    if (error) setError('');
    if (statusMessage) setStatusMessage('');
  };

  const syncPersonaForm = (nextPersona: AudienceProfile) => {
    setForm({
      handle: nextPersona.handle,
      display_name: nextPersona.displayName,
      bio: nextPersona.bio || '',
      avatar_url: nextPersona.avatarUrl || '',
      banner_url: nextPersona.bannerUrl || '',
      category: nextPersona.category,
      audience_label: nextPersona.audienceLabel,
      audience_mode: nextPersona.audienceMode,
      public_links: normalizePublicLinksForForm(nextPersona.publicLinks),
    });
  };

  const setPublicLinkField = (index: number, field: keyof PublicLinkForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      public_links: prev.public_links.map((link, linkIndex) => (
        linkIndex === index ? { ...link, [field]: value } : link
      )),
    }));
    if (error) setError('');
    if (statusMessage) setStatusMessage('');
  };

  const addPublicLink = () => {
    setForm((prev) => {
      if (prev.public_links.length >= 8) return prev;
      return {
        ...prev,
        public_links: [...prev.public_links, { label: '', url: '' }],
      };
    });
    if (error) setError('');
    if (statusMessage) setStatusMessage('');
  };

  const removePublicLink = (index: number) => {
    setForm((prev) => ({
      ...prev,
      public_links: prev.public_links.filter((_, linkIndex) => linkIndex !== index),
    }));
    if (error) setError('');
    if (statusMessage) setStatusMessage('');
  };

  const hasIncompletePublicLink = () => form.public_links.some((link) => {
    const hasLabel = Boolean(link.label.trim());
    const hasUrl = Boolean(link.url.trim());
    return hasLabel !== hasUrl;
  });

  const continueSetup = () => {
    if (setupStep === 'basics') {
      if (!form.handle.trim() || !form.display_name.trim()) {
        const message = 'Handle and display name are required.';
        setError(message);
        toast.error(message);
        return;
      }
      if (hasIncompletePublicLink()) {
        const message = 'Each public link needs both a label and a URL.';
        setError(message);
        toast.error(message);
        return;
      }
      setError('');
      setSetupStep('audience');
      return;
    }
    if (setupStep === 'audience') {
      setError('');
      setSetupStep('preview');
    }
  };

  const save = async () => {
    if (saving) return;
    const handle = form.handle.trim().replace(/^@+/, '');
    const displayName = form.display_name.trim();
    if (!handle || !displayName) {
      const message = 'Handle and display name are required.';
      setError(message);
      setStatusMessage('');
      toast.error(message);
      return;
    }
    const publicLinks = normalizePublicLinksForSave(form.public_links);
    if (hasIncompletePublicLink()) {
      const message = 'Each public link needs both a label and a URL.';
      setError(message);
      setStatusMessage('');
      toast.error(message);
      return;
    }

    setSaving(true);
    setSavePhase('profile');
    setError('');
    setStatusMessage('');
    try {
      const payload = {
        handle,
        display_name: displayName,
        bio: form.bio.trim() || null,
        category: form.category,
        audience_label: form.audience_label,
        audience_mode: form.audience_mode,
        public_links: publicLinks,
      };
      let nextPersona: AudienceProfile;
      if (persona) {
        const res = await api.personas.updatePersona(persona.id, payload);
        nextPersona = res.persona;
      } else {
        const res = await api.personas.createPersona(payload);
        nextPersona = res.persona;
        setChannel(res.channel);
      }
      setPersona(nextPersona);
      syncPersonaForm(nextPersona);

      const uploaded: { avatarUrl?: string; bannerUrl?: string } = {};
      let avatarUploaded = false;
      let bannerUploaded = false;
      try {
        if (mediaFiles.avatar) {
          setSavePhase('avatar');
          const res = await api.upload.uploadPersonaMedia(nextPersona.id, mediaFiles.avatar, 'avatar');
          uploaded.avatarUrl = res.url;
          avatarUploaded = true;
        }
        if (mediaFiles.banner) {
          setSavePhase('banner');
          const res = await api.upload.uploadPersonaMedia(nextPersona.id, mediaFiles.banner, 'banner');
          uploaded.bannerUrl = res.url;
          bannerUploaded = true;
        }
      } catch (uploadErr) {
        nextPersona = { ...nextPersona, ...uploaded };
        setPersona(nextPersona);
        syncPersonaForm(nextPersona);
        setMediaFiles((prev) => ({
          avatar: avatarUploaded ? null : prev.avatar,
          banner: bannerUploaded ? null : prev.banner,
        }));
        if (avatarUploaded) clearMediaPreview('avatar');
        if (bannerUploaded) clearMediaPreview('banner');
        setMediaPreviews((prev) => ({
          avatar: avatarUploaded ? '' : prev.avatar,
          banner: bannerUploaded ? '' : prev.banner,
        }));
        const message = `Beacon details saved, but media upload failed. ${getErrorMessage(uploadErr, 'Please try the image upload again.')}`;
        setError(message);
        setStatusMessage('Profile details saved. Media still needs attention.');
        toast.error(message);
        return;
      }

      nextPersona = { ...nextPersona, ...uploaded };
      setPersona(nextPersona);
      syncPersonaForm(nextPersona);
      setMediaFiles({ avatar: null, banner: null });
      clearMediaPreview('avatar');
      clearMediaPreview('banner');
      setMediaPreviews({ avatar: '', banner: '' });
      const message = persona ? 'Beacon saved.' : 'Beacon created.';
      trackIdentityEvent('identity_public_profile_saved', {
        action: persona ? 'updated' : 'created',
        hasAvatar: Boolean(nextPersona.avatarUrl),
        hasBanner: Boolean(nextPersona.bannerUrl),
        publicLinkCount: publicLinks.length,
        audienceMode: nextPersona.audienceMode,
      });
      setStatusMessage(message);
      toast.success(message);
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to save Beacon.');
      setError(message);
      setStatusMessage('');
      toast.error(message);
    } finally {
      setSaving(false);
      setSavePhase('idle');
    }
  };

  const saveButtonLabel = (() => {
    if (!saving) return persona ? 'Save Beacon' : 'Publish Beacon';
    if (savePhase === 'avatar') return 'Uploading avatar...';
    if (savePhase === 'banner') return 'Uploading banner...';
    return 'Saving profile...';
  })();

  const publicUrl = persona
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://pantopus.com'}/@${persona.handle}`
    : '';

  const effectiveCategoryPolicies = categoryPolicies.length
    ? categoryPolicies
    : CATEGORIES.map((category) => ({
        category: category.value,
        label: category.label,
        sensitive: false,
        enabled: true,
        requirements: [],
      } satisfies PersonaCategoryPolicy));
  const categoryOptions = effectiveCategoryPolicies
    .filter((policy) => policy.enabled)
    .map((policy) => ({
      value: policy.category,
      label: policy.label ? titleCase(policy.label) : titleCase(policy.category),
      disabled: false,
    }));
  if (form.category && !categoryOptions.some((option) => option.value === form.category)) {
    const policy = effectiveCategoryPolicies.find((item) => item.category === form.category);
    categoryOptions.push({
      value: form.category,
      label: policy?.label ? `${titleCase(policy.label)} (currently gated)` : `${titleCase(form.category)} (currently gated)`,
      disabled: true,
    });
  }
  const sensitiveCategoryPolicies = categoryPolicies.length
    ? categoryPolicies.filter((policy) => policy.sensitive)
    : FALLBACK_SENSITIVE_CATEGORY_POLICIES;

  const copyPublicLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Beacon link copied');
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const sharePublicLink = async () => {
    if (!publicUrl) return;
    if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
      try {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: persona?.displayName || 'Beacon',
          url: publicUrl,
        });
        return;
      } catch {
        // user cancelled or share unsupported — fall through to copy
      }
    }
    void copyPublicLink();
  };

  const applyFollowerStatusUpdate = async (follower: PersonaFollower, status: Exclude<PersonaFollowStatus, 'none'>) => {
    if (!persona?.id || updatingFollowerId) return;
    setUpdatingFollowerId(follower.id);
    setFollowersError('');
    try {
      await api.personas.updatePersonaFollower(persona.id, follower.id, { status });
      await loadFollowers();
      const actionLabel = status === 'active' ? 'approved' : status;
      toast.success(`Follower ${actionLabel}.`);
      return true;
    } catch (err) {
      const message = getErrorMessage(err, 'Could not update follower.');
      setFollowersError(message);
      toast.error(message);
      return false;
    } finally {
      setUpdatingFollowerId('');
    }
  };

  const updateFollowerStatus = (follower: PersonaFollower, status: Exclude<PersonaFollowStatus, 'none'>, returnFocusTo?: HTMLElement | null) => {
    if (status === 'removed' || status === 'blocked') {
      setPendingFollowerAction({ follower, status, returnFocusTo });
      return;
    }
    void applyFollowerStatusUpdate(follower, status);
  };

  const selectedAudienceLabel = AUDIENCE_LABELS.find((label) => label.value === form.audience_label)?.label || 'Followers';
  const selectedCategoryLabel = categoryOptions.find((category) => category.value === form.category)?.label || titleCase(form.category || 'creator');
  const profilePreview = (
    <PublicProfilePreview
      form={form}
      audienceLabel={selectedAudienceLabel}
      categoryLabel={selectedCategoryLabel}
      avatarPreviewUrl={mediaPreviews.avatar || form.avatar_url}
      bannerPreviewUrl={mediaPreviews.banner || form.banner_url}
    />
  );
  const basicsFields = (
    <div className="space-y-6">
      <MediaEditor
        avatarPreviewUrl={mediaPreviews.avatar || form.avatar_url}
        bannerPreviewUrl={mediaPreviews.banner || form.banner_url}
        avatarFile={mediaFiles.avatar}
        bannerFile={mediaFiles.banner}
        onAvatarSelect={(file) => setMediaFile('avatar', file)}
        onBannerSelect={(file) => setMediaFile('banner', file)}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Handle">
          <div className="flex overflow-hidden rounded-xl border border-app-strong bg-surface focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
            <span className="flex items-center px-3 text-sm font-semibold text-app-secondary">@</span>
            <input
              value={form.handle}
              onChange={(e) => setField('handle', e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 text-app outline-none"
              placeholder="maya-builds"
            />
          </div>
          <FieldHint>Lowercase letters, numbers, and dashes. Becomes pantopus.com/@your-handle.</FieldHint>
        </Field>
        <Field label="Display Name">
          <input
            value={form.display_name}
            onChange={(e) => setField('display_name', e.target.value)}
            className="w-full rounded-xl border border-app-strong bg-surface px-3 py-2.5 text-app outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            placeholder="Maya Builds"
          />
        </Field>
      </div>

      <Field label="Bio">
        <textarea
          value={form.bio}
          onChange={(e) => setField('bio', e.target.value)}
          rows={5}
          maxLength={2000}
          className="w-full resize-none rounded-xl border border-app-strong bg-surface px-3 py-2.5 text-app outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          placeholder="What should this audience know about this public role?"
        />
        <p className="mt-1.5 text-right text-xs text-app-secondary">{form.bio.length}/2000</p>
      </Field>

      <PublicLinksEditor
        links={form.public_links}
        onAdd={addPublicLink}
        onRemove={removePublicLink}
        onChange={setPublicLinkField}
      />
    </div>
  );
  const audienceFields = (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Audience Label">
          <select
            value={form.audience_label}
            onChange={(e) => setField('audience_label', e.target.value)}
            className="w-full rounded-xl border border-app-strong bg-surface px-3 py-2.5 text-app outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          >
            {AUDIENCE_LABELS.map((label) => (
              <option key={label.value} value={label.value}>{label.label}</option>
            ))}
          </select>
          <FieldHint>What you call the people who follow this Beacon.</FieldHint>
        </Field>
        <Field label="Category">
          <select
            value={form.category}
            onChange={(e) => setField('category', e.target.value)}
            className="w-full rounded-xl border border-app-strong bg-surface px-3 py-2.5 text-app outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          >
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value} disabled={category.disabled}>{category.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 block text-xs font-semibold uppercase tracking-wide text-app-strong">Follow Mode</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {AUDIENCE_MODES.map((mode) => {
            const active = form.audience_mode === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                onClick={() => setField('audience_mode', mode.value)}
                className={`group relative rounded-xl border-2 px-4 py-4 text-left transition ${
                  active
                    ? 'border-primary-500 bg-primary-50 shadow-sm'
                    : 'border-app bg-surface hover:border-app-strong hover:bg-surface-muted'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    active ? 'border-primary-600 bg-primary-600' : 'border-app-strong bg-surface'
                  }`}>
                    {active ? <Check className="h-3 w-3 text-white" /> : null}
                  </div>
                  <div>
                    <span className={`block text-sm font-semibold ${active ? 'text-primary-900' : 'text-app'}`}>
                      {mode.value === 'open' ? 'Anyone can follow' : 'I approve new followers'}
                    </span>
                    <span className={`mt-1 block text-xs ${active ? 'text-primary-700' : 'text-app-secondary'}`}>
                      {mode.description}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </fieldset>

      <SensitiveCategoryInfo
        policies={sensitiveCategoryPolicies}
        loadError={categoryPolicyLoadError}
        open={showSensitiveCategoryInfo}
        onToggle={() => setShowSensitiveCategoryInfo((open) => !open)}
      />
    </div>
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-app">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-app bg-surface p-10 text-center text-app-secondary">
            <RefreshCw className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-3 text-sm">Loading Beacon...</p>
          </div>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-app">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <AlertCircle className="mb-3 h-6 w-6" />
            <h1 className="text-lg font-semibold">Beacon could not load</h1>
            <p className="mt-2 text-sm">{loadError}</p>
            <button
              type="button"
              onClick={loadPersona}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-app">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page heading — kept simple; identity hero carries the visual weight */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight text-app">{identityCopy.beacon}</h1>
          {persona ? (
            <Link
              href={`/@${persona.handle}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View Beacon
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>

        {persona ? (
          <>
            <IdentityHero
              persona={persona}
              onShare={sharePublicLink}
              onCopy={copyPublicLink}
              copied={copied}
            />

            {channel ? (
              <Link
                href="/app/persona/broadcast"
                className="group mt-5 flex items-center gap-4 rounded-2xl border border-primary-200 bg-primary-50/60 p-4 transition hover:border-primary-300 hover:bg-primary-50"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white shadow-sm">
                  <Megaphone className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-app">{identityCopy.updates}</span>
                  <span className="mt-0.5 block text-xs text-app-secondary">
                    Post one-way news to your {String(persona.audienceLabel || 'followers').toLowerCase()}.
                  </span>
                </span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-primary-600 shadow-sm transition group-hover:bg-primary-600 group-hover:text-white">
                  <ExternalLink className="h-4 w-4" />
                </span>
              </Link>
            ) : null}

            <ManagementTabs currentTab={managementTab} onChange={setManagementTab} />

            {managementTab === 'followers' ? (
              <FollowerManagementSection
                audienceLabel={persona.audienceLabel}
                followers={followers}
                counts={followerCounts}
                loading={followersLoading}
                error={followersError}
                statusFilter={followerStatusFilter}
                updatingFollowerId={updatingFollowerId}
                onStatusFilterChange={setFollowerStatusFilter}
                onRefresh={loadFollowers}
                onUpdateStatus={updateFollowerStatus}
              />
            ) : (
              <section className="mt-5 rounded-2xl border border-app bg-surface p-6 sm:p-7">
                {managementTab === 'profile' && basicsFields}
                {managementTab === 'audience' && audienceFields}
                {managementTab === 'preview' && profilePreview}
                <EditorFeedback statusMessage={statusMessage} error={error} />
                <div className="mt-7 flex items-center justify-end gap-3 border-t border-app pt-5">
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !form.handle.trim() || !form.display_name.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-muted disabled:shadow-none"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {saveButtonLabel}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <>
            <SetupHero />
            <SetupStepper currentStep={setupStep} />
            <section className="mt-5 rounded-2xl border border-app bg-surface p-6 sm:p-7">
              {setupStep === 'basics' && basicsFields}
              {setupStep === 'audience' && audienceFields}
              {setupStep === 'preview' && (
                <>
                  {profilePreview}
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Your Beacon will not link to your Profile unless you turn that on later.</p>
                  </div>
                </>
              )}
              <EditorFeedback statusMessage={statusMessage} error={error} />
              <div className="mt-7 flex items-center justify-between gap-3 border-t border-app pt-5">
                <button
                  type="button"
                  onClick={() => setSetupStep(setupStep === 'preview' ? 'audience' : 'basics')}
                  disabled={setupStep === 'basics' || saving}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-app-secondary hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                {setupStep === 'preview' ? (
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving || !form.handle.trim() || !form.display_name.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-app-muted disabled:shadow-none"
                  >
                    {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {saveButtonLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={continueSetup}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                  >
                    Next
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </section>
          </>
        )}
      </div>
      {pendingFollowerAction && (
        <FollowerActionDialog
          follower={pendingFollowerAction.follower}
          status={pendingFollowerAction.status}
          saving={updatingFollowerId === pendingFollowerAction.follower.id}
          onCancel={() => setPendingFollowerAction(null)}
          returnFocusTo={pendingFollowerAction.returnFocusTo || null}
          onConfirm={async () => {
            const saved = await applyFollowerStatusUpdate(pendingFollowerAction.follower, pendingFollowerAction.status);
            if (saved) setPendingFollowerAction(null);
          }}
        />
      )}
    </main>
  );
}

function IdentityHero({
  persona,
  onShare,
  onCopy,
  copied,
}: {
  persona: AudienceProfile;
  onShare: () => void | Promise<void>;
  onCopy: () => void | Promise<void>;
  copied: boolean;
}) {
  const followerCount = Number(persona.followerCount || 0);
  const postCount = Number((persona as { postCount?: number }).postCount || 0);
  const audienceLabel = String(persona.audienceLabel || 'followers').toLowerCase();
  const audienceLabelSingular = audienceLabel.replace(/s$/, '');
  return (
    <section className="relative overflow-hidden rounded-2xl border border-app bg-surface shadow-sm">
      <div className="relative h-44 sm:h-52 bg-gradient-to-br from-primary-100 via-sky-100 to-primary-50">
        {persona.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={persona.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary-200/60 blur-2xl" />
            <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-sky-300/50 blur-2xl" />
          </>
        )}
      </div>
      <div className="relative px-6 pb-6 sm:px-8 sm:pb-7">
        <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between sm:-mt-14">
          <div className="flex items-end gap-4 min-w-0">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface bg-surface shadow-md sm:h-28 sm:w-28">
              {persona.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={persona.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl font-semibold text-primary-600">
                  {persona.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <h2 className="truncate text-2xl font-bold tracking-tight text-app sm:text-3xl">{persona.displayName}</h2>
              <p className="mt-1 truncate text-sm text-app-secondary">@{persona.handle} · {String(persona.audienceLabel || 'followers')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:pb-1">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-app px-4 text-sm font-semibold text-app transition hover:bg-surface-muted"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>
        <p className="mt-5 text-sm italic text-app-secondary">Your signal to the world</p>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-app pt-4 text-sm">
          <span className="font-semibold text-app">{followerCount.toLocaleString()}</span>
          <span className="text-app-secondary">{followerCount === 1 ? audienceLabelSingular : audienceLabel}</span>
          <span className="px-1 text-app-muted">·</span>
          <span className="font-semibold text-app">{postCount.toLocaleString()}</span>
          <span className="text-app-secondary">{postCount === 1 ? 'post' : 'posts'}</span>
        </div>
      </div>
    </section>
  );
}

function SetupHero() {
  return (
    <section className="mb-5 rounded-2xl border border-app bg-surface p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50">
          <Sparkles className="h-6 w-6 text-primary-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-app">Your signal to the world</h2>
          <p className="mt-1.5 text-sm leading-6 text-app-secondary">
            A separate page for followers, students, clients, customers, members — anyone you address one-to-many.
          </p>
        </div>
      </div>
    </section>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-app-strong">{label}</span>
      {children}
    </label>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-app-secondary">{children}</p>;
}

function MediaEditor({
  avatarPreviewUrl,
  bannerPreviewUrl,
  avatarFile,
  bannerFile,
  onAvatarSelect,
  onBannerSelect,
}: {
  avatarPreviewUrl: string;
  bannerPreviewUrl: string;
  avatarFile: File | null;
  bannerFile: File | null;
  onAvatarSelect: (file: File | null) => void;
  onBannerSelect: (file: File | null) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-app">
      <label
        htmlFor="persona-banner-upload"
        className="group relative block h-44 cursor-pointer bg-gradient-to-br from-primary-100 via-sky-100 to-primary-50"
      >
        {bannerPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerPreviewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-primary-700">
            <ImageIcon className="h-5 w-5" />
            Choose a banner
          </div>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          <UploadCloud className="h-3.5 w-3.5" />
          Banner
        </span>
        <input
          id="persona-banner-upload"
          aria-label="Upload banner image"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => onBannerSelect(event.target.files?.[0] || null)}
        />
      </label>
      <div className="relative px-6 pb-5">
        <label
          htmlFor="persona-avatar-upload"
          className="group absolute -top-12 left-6 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-4 border-surface bg-surface shadow-md"
        >
          {avatarPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7 text-app-muted" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
            Change
          </span>
          <input
            id="persona-avatar-upload"
            aria-label="Upload avatar image"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onAvatarSelect(event.target.files?.[0] || null)}
          />
        </label>
        <div className="ml-32 flex flex-col gap-1 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-app-secondary">
            Banner: 1500×500 recommended. Avatar: square.
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-app-secondary">
            {avatarFile ? <span className="truncate">Ready to upload: {avatarFile.name}</span> : null}
            {bannerFile ? <span className="truncate">Ready to upload: {bannerFile.name}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupStepper({ currentStep }: { currentStep: SetupStep }) {
  const currentIndex = SETUP_STEPS.findIndex((step) => step.value === currentStep);
  return (
    <div className="mb-5 rounded-2xl border border-app bg-surface px-6 py-5 sm:px-7">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-app">Create your Beacon</h2>
        <span className="text-xs font-medium text-app-secondary">Step {currentIndex + 1} of {SETUP_STEPS.length}</span>
      </div>
      <ol className="mt-4 flex items-center gap-3">
        {SETUP_STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isComplete = index < currentIndex;
          return (
            <li key={step.value} className="flex flex-1 items-center gap-3">
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isComplete
                  ? 'bg-primary-600 text-white'
                  : isActive
                    ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
                    : 'bg-surface-muted text-app-secondary'
              }`}>
                {isComplete ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span className={`text-sm font-medium ${
                isActive ? 'text-app' : isComplete ? 'text-app' : 'text-app-secondary'
              }`}>{step.label}</span>
              {index < SETUP_STEPS.length - 1 ? (
                <span className={`hidden h-0.5 flex-1 rounded-full sm:block ${
                  isComplete ? 'bg-primary-500' : 'bg-app-muted/40'
                }`} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ManagementTabs({
  currentTab,
  onChange,
}: {
  currentTab: ManagementTab;
  onChange: (tab: ManagementTab) => void;
}) {
  return (
    <div
      className="mt-7 flex gap-1 overflow-x-auto border-b border-app -mx-1 px-1"
      role="tablist"
      aria-label="Beacon management"
    >
      {MANAGEMENT_TABS.map((tab) => {
        const active = currentTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`relative whitespace-nowrap px-4 pb-3 pt-2 text-sm font-semibold transition ${
              active
                ? 'text-primary-700'
                : 'text-app-secondary hover:text-app'
            }`}
          >
            {tab.label}
            <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition ${
              active ? 'bg-primary-600' : 'bg-transparent'
            }`} />
          </button>
        );
      })}
    </div>
  );
}

function SensitiveCategoryInfo({
  policies,
  loadError,
  open,
  onToggle,
}: {
  policies: PersonaCategoryPolicy[];
  loadError: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
      >
        {open ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        Need a healthcare, legal, classroom, or minor-facing profile?
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-app bg-surface-muted p-4">
          <h2 className="text-sm font-semibold text-app">Extra verification categories</h2>
          <p className="mt-1 text-sm text-app-secondary">
            These categories require extra verification before they can be used.
          </p>
          {loadError && (
            <p className="mt-2 text-xs text-amber-700">{loadError} Showing the default gated policy.</p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {policies.map((policy) => (
              <div
                key={policy.category}
                className={`rounded-lg border border-app bg-surface px-3 py-2.5 text-sm ${
                  policy.enabled ? 'text-app' : 'text-app-secondary'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{titleCase(policy.label || policy.category)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    policy.enabled ? 'bg-green-50 text-green-700' : 'bg-surface-muted text-app-secondary'
                  }`}>
                    {policy.enabled ? 'Available' : 'Gated'}
                  </span>
                </div>
                {policy.requirements.length > 0 && (
                  <p className="mt-1 text-xs text-app-secondary">
                    Requires {policy.requirements.map(formatRequirement).join(', ')}.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PublicProfilePreview({
  form,
  audienceLabel,
  categoryLabel,
  avatarPreviewUrl,
  bannerPreviewUrl,
}: {
  form: PublicProfileForm;
  audienceLabel: string;
  categoryLabel: string;
  avatarPreviewUrl: string;
  bannerPreviewUrl: string;
}) {
  const previewLinks = normalizePublicLinksForSave(form.public_links);
  const handle = form.handle.trim().replace(/^@+/, '') || 'your-handle';
  const displayName = form.display_name.trim() || 'Your Beacon';
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-app-secondary">Visitor preview</p>
      <div className="overflow-hidden rounded-2xl border border-app bg-surface shadow-sm">
        <div className="h-36 bg-gradient-to-br from-primary-100 via-sky-100 to-primary-50">
          {bannerPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerPreviewUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3 min-w-0">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-surface bg-surface shadow-sm">
                {avatarPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-7 w-7 text-app-muted" />
                )}
              </div>
              <div className="min-w-0 pb-1">
                <h2 className="truncate text-lg font-semibold text-app">{displayName}</h2>
                <p className="truncate text-sm text-app-secondary">@{handle} · {categoryLabel}</p>
              </div>
            </div>
            <button type="button" disabled className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white opacity-90">
              Follow
            </button>
          </div>
          <p className="mt-4 text-sm leading-6 text-app">
            {form.bio.trim() || 'Your bio will appear here.'}
          </p>
          {previewLinks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {previewLinks.map((link) => (
                <span key={`${link.label}-${link.url}`} className="inline-flex items-center gap-1.5 rounded-full border border-app px-3 py-1 text-xs font-medium text-app-secondary">
                  <LinkIcon className="h-3 w-3" />
                  {link.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-app bg-surface-muted px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
          <div>
            <h3 className="text-sm font-semibold text-app">Visible to followers</h3>
            <p className="mt-0.5 text-xs text-app-secondary">
              {audienceLabel} can see your public details and follower-only updates.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-app bg-surface-muted px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-app-secondary" />
          <div>
            <h3 className="text-sm font-semibold text-app">Profile links are off</h3>
            <p className="mt-0.5 text-xs text-app-secondary">
              This preview does not expose your Profile unless you enable a profile link.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorFeedback({ statusMessage, error }: { statusMessage: string; error: string }) {
  return (
    <div aria-live="polite">
      {statusMessage && (
        <div className="mt-5 inline-flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-green-800">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {error && (
        <div className="mt-5 inline-flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function PublicLinksEditor({
  links,
  onAdd,
  onRemove,
  onChange,
}: {
  links: PublicLinkForm[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onChange: (index: number, field: keyof PublicLinkForm, value: string) => void;
}) {
  return (
    <section>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-app-strong">Public Links</h2>
          <p className="mt-1 text-xs text-app-secondary">
            Add websites or social profiles that are safe to show on this Beacon.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={links.length >= 8}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Link
        </button>
      </div>

      {links.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-app bg-surface-muted px-3.5 py-3 text-sm text-app-secondary">
          <LinkIcon className="h-4 w-4" />
          No public links yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {links.map((link, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-app bg-surface-muted p-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.4fr)_auto] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-app-secondary">Label</span>
                <input
                  value={link.label}
                  onChange={(event) => onChange(index, 'label', event.target.value)}
                  placeholder="Website"
                  className="w-full rounded-lg border border-app-strong bg-surface px-3 py-2 text-sm text-app outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-app-secondary">URL</span>
                <input
                  value={link.url}
                  onChange={(event) => onChange(index, 'url', event.target.value)}
                  placeholder="https://example.com"
                  inputMode="url"
                  className="w-full rounded-lg border border-app-strong bg-surface px-3 py-2 text-sm text-app outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                />
              </label>
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove public link ${index + 1}`}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-app bg-surface px-3 text-app-secondary transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FollowerManagementSection({
  audienceLabel,
  followers,
  counts,
  loading,
  error,
  statusFilter,
  updatingFollowerId,
  onStatusFilterChange,
  onRefresh,
  onUpdateStatus,
}: {
  audienceLabel: string;
  followers: PersonaFollower[];
  counts: PersonaFollowerCounts | null;
  loading: boolean;
  error: string;
  statusFilter: string;
  updatingFollowerId: string;
  onStatusFilterChange: (status: string) => void;
  onRefresh: () => void;
  onUpdateStatus: (follower: PersonaFollower, status: Exclude<PersonaFollowStatus, 'none'>, returnFocusTo?: HTMLElement | null) => void;
}) {
  const audienceNoun = String(audienceLabel || 'followers').toLowerCase();
  const totalFollowers = Number(counts?.total || 0);
  const pendingFollowers = Number(counts?.pending || 0);
  const emptyText = (() => {
    if (totalFollowers === 0) {
      return `No ${audienceNoun} yet. Share your Beacon to start building your following.`;
    }
    if (statusFilter === 'pending') return 'No pending requests.';
    return `No ${statusFilter} ${audienceNoun}.`;
  })();
  return (
    <section className="mt-5 rounded-2xl border border-app bg-surface p-6 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-app">Followers</h2>
          <p className="mt-1 text-sm text-app-secondary">
            Review requests, remove access, or block people from this Beacon.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-app px-3 py-1.5 text-xs font-semibold text-app transition hover:bg-surface-muted"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {pendingFollowers > 0 && statusFilter !== 'pending' && (
        <button
          type="button"
          onClick={() => onStatusFilterChange('pending')}
          className="mt-4 flex w-full items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-left transition hover:bg-primary-100"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary-600">
            <Bell className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-app">{pendingFollowers} pending request{pendingFollowers === 1 ? '' : 's'}</span>
            <span className="mt-0.5 block text-xs text-primary-700">Tap to review.</span>
          </span>
          <ExternalLink className="h-4 w-4 text-primary-600" />
        </button>
      )}

      {counts && (
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Follower status">
          {FOLLOWER_FILTERS.map((filter) => {
            const active = statusFilter === filter.value;
            const count = Number(counts[filter.value as keyof PersonaFollowerCounts] || 0);
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onStatusFilterChange(filter.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-app bg-surface text-app-secondary hover:bg-surface-muted'
                }`}
              >
                {filter.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  active ? 'bg-primary-600 text-white' : 'bg-surface-muted text-app-secondary'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="mt-4 inline-flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {loading && followers.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-app bg-surface-muted px-4 py-4 text-sm text-app-secondary">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading followers...
          </div>
        ) : followers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-app px-4 py-6 text-center text-sm text-app-secondary">
            {emptyText}
          </div>
        ) : followers.map((follower) => (
          <FollowerRow
            key={follower.id}
            follower={follower}
            busy={updatingFollowerId === follower.id}
            onUpdateStatus={onUpdateStatus}
          />
        ))}
      </div>
    </section>
  );
}

function FollowerActionDialog({
  follower,
  status,
  saving,
  onCancel,
  onConfirm,
  returnFocusTo,
}: {
  follower: PersonaFollower;
  status: Extract<PersonaFollowStatus, 'removed' | 'blocked'>;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  returnFocusTo?: HTMLElement | null;
}) {
  const displayName = follower.follower?.displayName || 'this follower';
  const isBlock = status === 'blocked';
  const dialogRef = useDialogFocusTrap<HTMLDivElement>(onCancel, returnFocusTo);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="follower-action-title"
        aria-describedby="follower-action-description"
        className="w-full max-w-md rounded-2xl border border-app bg-surface p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isBlock ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}>
            {isBlock ? <UserX className="h-5 w-5" /> : <UserMinus className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h2 id="follower-action-title" className="text-lg font-semibold text-app">
              {isBlock ? 'Block follower?' : 'Remove follower?'}
            </h2>
            <p id="follower-action-description" className="mt-2 text-sm leading-6 text-app-secondary">
              {isBlock
                ? `Block ${displayName} from this Beacon? They will lose access to follower-only updates.`
                : `Remove ${displayName} from this Beacon? They can request access again later if approvals are enabled.`}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-app px-4 py-2.5 text-sm font-semibold text-app hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : isBlock ? 'Block' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FollowerRow({
  follower,
  busy,
  onUpdateStatus,
}: {
  follower: PersonaFollower;
  busy: boolean;
  onUpdateStatus: (follower: PersonaFollower, status: Exclude<PersonaFollowStatus, 'none'>, returnFocusTo?: HTMLElement | null) => void;
}) {
  const displayName = follower.follower?.displayName || 'Follower';
  const handle = follower.follower?.handle ? `@${follower.follower.handle}` : null;
  const status = String(follower.status || 'active');
  const initials = displayName.slice(0, 1).toUpperCase();
  return (
    <article className="flex items-center gap-3 rounded-xl border border-app bg-surface px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold text-app">{displayName}</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            status === 'active' ? 'bg-green-50 text-green-700'
              : status === 'pending' ? 'bg-amber-50 text-amber-700'
              : status === 'muted' ? 'bg-amber-50 text-amber-700'
              : 'bg-red-50 text-red-700'
          }`}>{status}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-app-secondary">
          {handle || 'No public local handle'} · {String(follower.relationshipType || 'follower')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {status === 'pending' && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => onUpdateStatus(follower, 'active', event.currentTarget)}
            className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Approve
          </button>
        )}
        {status === 'active' && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => onUpdateStatus(follower, 'muted', event.currentTarget)}
            className="inline-flex items-center gap-1 rounded-full border border-app bg-surface px-3 py-1.5 text-xs font-semibold text-app hover:bg-surface-muted disabled:opacity-50"
          >
            <UserMinus className="h-3.5 w-3.5" />
            Mute
          </button>
        )}
        {status === 'muted' && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => onUpdateStatus(follower, 'active', event.currentTarget)}
            className="inline-flex items-center gap-1 rounded-full border border-app bg-surface px-3 py-1.5 text-xs font-semibold text-app hover:bg-surface-muted disabled:opacity-50"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Restore
          </button>
        )}
        {status !== 'removed' && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => onUpdateStatus(follower, 'removed', event.currentTarget)}
            className="inline-flex items-center gap-1 rounded-full border border-app bg-surface px-3 py-1.5 text-xs font-semibold text-app-secondary hover:bg-surface-muted disabled:opacity-50"
          >
            Remove
          </button>
        )}
        {status !== 'blocked' && (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => onUpdateStatus(follower, 'blocked', event.currentTarget)}
            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            <UserX className="h-3.5 w-3.5" />
            Block
          </button>
        )}
      </div>
    </article>
  );
}
