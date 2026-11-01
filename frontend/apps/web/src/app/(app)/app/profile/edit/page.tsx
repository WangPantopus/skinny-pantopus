'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Home, Lock, MapPin, Plus, ShieldCheck, Users, X } from 'lucide-react';
import * as api from '@pantopus/api';
import { US_STATES, chosenUsername } from '@pantopus/utils';
import ProfilePictureUpload from '@/components/ProfilePictureUpload';
import { useProfileForm } from '@/hooks/useProfileForm';
import ErrorState from '@/components/ui/ErrorState';
import { confirmStore } from '@/components/ui/confirm-store';
import UsernameField, { type UsernameStatus } from '@/components/profile/UsernameField';
import NeighborPhotoField from '@/components/profile/edit/NeighborPhotoField';
import ProfileAvatar from '@/components/profile/public/atoms/ProfileAvatar';
import { joinedText } from '@/components/profile/public/ProfileHeader';
import { useOwnLocalProfile, usePrivacySettings } from '@/lib/me';

type GeoSuggestion = api.geo.GeoSuggestion;
type NormalizedAddress = api.geo.NormalizedAddress;

function useDebounced<T>(value: T, delayMs: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

function AddressAutocomplete({
  id,
  value,
  onChange,
  onSelectNormalized,
  placeholder = '123 Main St',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  onSelectNormalized: (n: NormalizedAddress) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [error, setError] = useState('');

  const debounced = useDebounced(value, 250);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setError('');
    const q = (debounced || '').trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }

    const run = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setLoading(true);
      try {
        const data = await api.geo.autocomplete(q);
        setSuggestions(data.suggestions || []);
        setOpen(true);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') setError(e.message || 'Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [debounced]);

  const selectSuggestion = async (s: GeoSuggestion) => {
    setOpen(false);
    setSuggestions([]);

    try {
      const data = await api.geo.resolve(s.suggestion_id);
      const n = data.normalized;

      onChange(n.address);
      onSelectNormalized(n);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to resolve address');
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => value.trim().length >= 3 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
        placeholder={placeholder}
        autoComplete="off"
      />

      {loading && <div className="absolute right-3 top-2.5 text-app-muted text-sm">…</div>}

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full bg-surface border border-app rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.suggestion_id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              className="w-full text-left px-4 py-2 hover:bg-surface-raised text-sm text-app"
            >
              <strong>{s.primary_text}</strong> {s.secondary_text}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-app-secondary">Start typing, then pick a suggestion to verify.</p>
    </div>
  );
}


// The same field-error treatment as the sign-up form.
const inputErrorClass = ' border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20';
const fieldErrorClass = 'mt-1 text-xs text-red-600 dark:text-red-300';
const inputClass =
  'w-full min-h-[3rem] px-3.5 py-2.5 rounded-xl border border-app-strong bg-surface text-base text-app focus:outline-none focus:ring-2 focus:ring-primary-500';
const labelClass = 'block mb-1.5 text-[0.8125rem] leading-[1.125rem] font-semibold text-app-strong';
const helpClass = 'mt-1.5 text-[0.8125rem] leading-[1.125rem] text-app-muted';

// The labels Settings → Privacy uses for "Neighborhood" (who sees your city).
const CITY_AUDIENCE: Record<string, string> = {
  public: 'Everyone',
  followers: 'Connections and household',
  private: 'Only me',
};

function PartHeader({ icon, iconClass, id, title, detail }: { icon: ReactNode; iconClass: string; id: string; title: string; detail: string }) {
  return (
    <div className="mt-7 mb-3 flex items-start gap-2.5">
      <span aria-hidden="true" className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${iconClass}`}>{icon}</span>
      <div>
        <h2 id={id} className="text-xl leading-[1.5625rem] font-bold text-app">{title}</h2>
        <p className="text-[0.875rem] leading-5 text-app-muted">{detail}</p>
      </div>
    </div>
  );
}

/** A "Show on my profile" switch with a 44 px target. */
function ShowSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="mt-1.5 -mr-1 min-h-[2.75rem] w-full flex items-center justify-between gap-3 text-left text-[0.875rem] text-app-strong"
    >
      <span aria-hidden="true">Show on my profile</span>
      <span aria-hidden="true" className={`w-[3.1875rem] h-[1.9375rem] shrink-0 rounded-full p-0.5 flex items-center transition ${checked ? 'bg-primary-600 justify-end' : 'bg-app-surface-sunken justify-start border border-app'}`}>
        <span className="w-[1.6875rem] h-[1.6875rem] rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function LinkRow({ icon, title, detail, value, href, onOpen }: {
  icon: ReactNode; title: string; detail?: string; value?: string; href: string;
  /** A plain click goes through the page, which asks first when something changed; ⌘/Ctrl-click still opens a tab. */
  onOpen: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onOpen(href);
      }}
      className="w-full min-h-[3.5rem] py-3 flex items-center gap-3 text-left hover-bg-app -mx-4 px-4"
      style={{ width: 'calc(100% + 2rem)' }}
    >
      <span aria-hidden="true" className="shrink-0 text-app-strong">{icon}</span>
      <span className="min-w-0 flex-1 flex flex-col gap-0.5">
        <span className="text-[0.9375rem] leading-5 font-semibold text-app">{title}</span>
        {detail ? <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{detail}</span> : null}
      </span>
      {value ? <span className="shrink-0 text-[0.875rem] text-app-muted">{value}</span> : null}
      <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-app-muted" />
    </Link>
  );
}

/**
 * Edit profile, in two parts: "Neighbors see this" (the photo and name neighbors see, username, tagline, about you,
 * what you help with, links) and "Only you see this" (your account name and photo, email, phone, birthday, address,
 * and the settings for your home and city), with a live preview of how neighbors see you at the top. One Save saves
 * it all, the name neighbors see included; the photo neighbors see saves as soon as you pick it.
 */
export default function EditProfilePage() {
  const router = useRouter();

  const {
    form, setField, setFields,
    loading, loadError, saving, fieldErrors, user,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    addressVerified, setAddressVerified,
    profilePictureUrl, setProfilePictureUrl,
    showContact, setShowContact, hasChanges,
    loadProfile, saveProfile,
  } = useProfileForm();

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('unchanged');
  const localProfile = useOwnLocalProfile({ enabled: Boolean(user) });
  const privacy = usePrivacySettings({ enabled: Boolean(user) });
  const view = localProfile.data;
  // The name neighbors see, as typed; null shows the saved one.
  const [neighborName, setNeighborName] = useState<string | null>(null);
  const [neighborNameError, setNeighborNameError] = useState('');
  const savedNeighborName = view?.profile?.displayName ?? '';
  const typedNeighborName = neighborName ?? savedNeighborName;
  const trimmedNeighborName = typedNeighborName.replace(/\s+/g, ' ').trim();
  const neighborNameChanged = Boolean(view) && trimmedNeighborName !== savedNeighborName;
  const dirty = hasChanges || neighborNameChanged;
  const serverNameError = (fieldErrors as Record<string, string | undefined>).neighborName;

  const stateName = useMemo(() => {
    const s = form.state.trim().toUpperCase();
    const match = US_STATES.find((x) => x.code === s);
    return match?.name || '';
  }, [form.state]);

  // Leaving with unsaved changes asks first (the browser's own dialog).
  useEffect(() => {
    if (!dirty || saving) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, saving]);

  // Your profile's tips link to a part of this page (#photo, #tagline, #helps-with; Privacy links to #neighbors).
  const scrolled = useRef(false);
  const neighborsReady = Boolean(view) || localProfile.isError;
  useEffect(() => {
    // Wait for the name and photo neighbors see too: their fields are disabled until then.
    if (loading || scrolled.current || !neighborsReady) return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    // After this render (a timer, not an animation frame: those don't run in a background tab). Marked done only
    // when it ran, so a re-run of this effect (development's double effects) schedules it again.
    const timer = window.setTimeout(() => {
      scrolled.current = true;
      const target = document.getElementById(id);
      target?.scrollIntoView({ block: 'start' });
      // A field to type in first (never a hidden file picker, or a chip's Remove button).
      const field = target?.querySelector<HTMLElement>('textarea, input:not([type="hidden"]):not([type="file"])')
        ?? target?.querySelector<HTMLElement>('button');
      field?.focus({ preventScroll: true });
    }, 50);
    return () => window.clearTimeout(timer);
  }, [loading, neighborsReady]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" aria-hidden="true"></div>
          <p className="mt-4 text-app-secondary">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-app">
        <main className="max-w-2xl mx-auto px-5 py-6">
          <h1 className="text-xl font-semibold text-app mb-6">Edit profile</h1>
          <ErrorState message={loadError} onRetry={loadProfile} />
        </main>
      </div>
    );
  }

  // Leaving through Close or a row asks first when something changed (the browser itself asks on a reload).
  const leave = async (href: string) => {
    if (dirty) {
      const yes = await confirmStore.open({
        title: 'Discard your changes?',
        description: 'What you changed here won’t be saved.',
        confirmLabel: 'Discard',
        variant: 'destructive',
      });
      if (!yes) return;
    }
    router.push(href);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (neighborNameChanged && !trimmedNeighborName) {
      setNeighborNameError('Enter the name neighbors should see.');
      document.getElementById('profile-neighbor-name')?.focus();
      return;
    }
    void saveProfile(undefined, { neighborName: neighborNameChanged ? trimmedNeighborName : undefined });
  };

  // How neighbors see you, as you type: the name and photo neighbors see, your username, what's true about you
  // (a verified home; the city only when your setting shows it to neighbors), the tagline and the start of the bio.
  const me = (user ?? {}) as Partial<Record<string, string | boolean | null | Record<string, unknown>>>;
  const accountId = String(me.id || '');
  const typedUsername = form.username.trim().replace(/^@+/, '');
  const previewHandle = typedUsername || (me.usernameIsGenerated ? null : chosenUsername(typeof me.username === 'string' ? me.username : null));
  const residency = me.residency as { hasHome?: boolean; verified?: boolean; city?: string | null } | undefined;
  const verifiedNeighbor = Boolean(residency?.hasHome && residency?.verified);
  const cityAudience = (privacy.data?.show_neighborhood as string | undefined) || 'followers';
  const previewCity = cityAudience === 'public' ? residency?.city || form.city.trim() || null : null;
  const joined = joinedText(String(me.createdAt || me.created_at || ''));
  const previewFacts = [previewCity, joined].filter(Boolean).join(' · ');
  const previewName = trimmedNeighborName || savedNeighborName || 'Your name';
  const accountName = view?.account?.displayName || '';

  return (
    <div className="bg-app">
      <main className="max-w-2xl mx-auto px-5 pt-2 pb-8">
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center h-12 -mx-2">
          <button
            type="button"
            onClick={() => void leave('/app/profile')}
            aria-label="Close"
            className="w-11 h-11 rounded-full flex items-center justify-center text-app hover-bg-app"
          >
            <X aria-hidden="true" className="w-6 h-6" strokeWidth={2.25} />
          </button>
          <h1 className="text-center text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Edit profile</h1>
          <span />
        </div>

        {/* Live preview */}
        <section aria-labelledby="edit-preview-label" className="mt-2">
          <p id="edit-preview-label" className="mb-2 text-[0.8125rem] leading-[1.125rem] font-semibold text-app-muted">
            How neighbors see you · updates as you type
          </p>
          <div className="rounded-2xl border border-app bg-surface p-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar name={previewName} seed={accountId} photoUrl={view?.profile?.avatarUrl ?? null} size={56} />
              <div className="min-w-0">
                <p className="text-xl leading-[1.5625rem] font-bold text-app [overflow-wrap:anywhere]">{previewName}</p>
                {previewHandle ? <p className="text-[0.875rem] leading-[1.1875rem] text-app-muted">@{previewHandle}</p> : null}
              </div>
            </div>
            {(verifiedNeighbor || previewFacts) && (
              <p className="mt-2.5 flex items-start gap-1.5 text-[0.875rem] leading-[1.1875rem] text-app-muted">
                {verifiedNeighbor ? <ShieldCheck aria-hidden="true" className="mt-px w-4 h-4 shrink-0 text-app-home" /> : null}
                <span>
                  {verifiedNeighbor && <span className="font-semibold text-app-home">Verified neighbor</span>}
                  {verifiedNeighbor && previewFacts ? ' · ' : ''}
                  {previewFacts}
                </span>
              </p>
            )}
            {form.tagline.trim() ? (
              <p className="mt-2 text-[0.9375rem] leading-5 font-semibold text-app [overflow-wrap:anywhere]">{form.tagline.trim()}</p>
            ) : null}
            {form.bio.trim() ? (
              <p className="mt-1 text-[0.875rem] leading-5 text-app-strong line-clamp-2 [overflow-wrap:anywhere]">{form.bio.trim()}</p>
            ) : null}
          </div>
        </section>

        <form onSubmit={submit} noValidate>
          {/* Neighbors see this */}
          <section id="neighbors" aria-labelledby="edit-neighbors" className="scroll-mt-20">
            <PartHeader
              id="edit-neighbors"
              icon={<Users className="w-[1.0625rem] h-[1.0625rem]" />}
              iconClass="bg-app-home-bg text-app-home"
              title="Neighbors see this"
              detail="Shown on your profile and next to your posts, comments and messages."
            />
            <div className="rounded-2xl border border-app bg-surface px-4 divide-y divide-app">
              {view ? (
                <NeighborPhotoField view={view} accountId={accountId} name={previewName} />
              ) : (
                <div className="py-4 flex items-center justify-between gap-3">
                  <p className="text-[0.875rem] text-app-muted">
                    {localProfile.isError ? 'Couldn’t load the photo and name neighbors see.' : 'Loading the photo neighbors see…'}
                  </p>
                  {localProfile.isError ? (
                    <button type="button" onClick={() => void localProfile.refetch()} className="min-h-[2.75rem] px-3.5 rounded-full border border-app-strong text-[0.875rem] font-semibold text-app hover-bg-app">
                      Try again
                    </button>
                  ) : null}
                </div>
              )}

              <div className="py-4">
                <label htmlFor="profile-neighbor-name" className={labelClass}>Name neighbors see</label>
                <input
                  id="profile-neighbor-name"
                  type="text"
                  value={typedNeighborName}
                  maxLength={255}
                  disabled={!view}
                  onChange={(e) => { setNeighborName(e.target.value); setNeighborNameError(''); }}
                  aria-invalid={neighborNameError || serverNameError ? true : undefined}
                  aria-describedby="profile-neighbor-name-help"
                  className={inputClass + (neighborNameError || serverNameError ? inputErrorClass : '')}
                />
                {neighborNameError || serverNameError ? <p className={fieldErrorClass} role="alert">{neighborNameError || serverNameError}</p> : null}
                <p id="profile-neighbor-name-help" className={helpClass}>A first name or nickname is fine. Your account name stays private.</p>
                {view && accountName && trimmedNeighborName !== accountName ? (
                  <button
                    type="button"
                    onClick={() => { setNeighborName(accountName); setNeighborNameError(''); }}
                    className="mt-1 min-h-[2.75rem] text-[0.875rem] font-semibold text-app-link hover:underline"
                  >
                    Use my account name ({accountName})
                  </button>
                ) : null}
              </div>

              <div className="py-4">
                <label htmlFor="profile-username" className={labelClass}>Username</label>
                <UsernameField
                  id="profile-username"
                  value={form.username}
                  onChange={(value) => setField('username', value)}
                  currentUsername={user?.username || ''}
                  currentIsMadeUp={!!user?.usernameIsGenerated}
                  serverError={fieldErrors.username}
                  onStatusChange={setUsernameStatus}
                />
              </div>

              <div id="tagline" className="py-4 scroll-mt-24">
                <label htmlFor="profile-tagline" className={labelClass}>Tagline</label>
                <textarea
                  id="profile-tagline"
                  rows={2}
                  maxLength={255}
                  value={form.tagline}
                  onChange={(e) => setField('tagline', e.target.value)}
                  aria-invalid={fieldErrors.tagline ? true : undefined}
                  aria-describedby="profile-tagline-help"
                  className={inputClass + ' resize-none' + (fieldErrors.tagline ? inputErrorClass : '')}
                  placeholder="Gardening, small repairs and Saturday walks."
                />
                {fieldErrors.tagline ? <p className={fieldErrorClass}>{fieldErrors.tagline}</p> : null}
                <p id="profile-tagline-help" className={helpClass}>One line about you. It shows in bold under your name.</p>
              </div>

              <div className="py-4">
                <label htmlFor="profile-bio" className={labelClass}>About you</label>
                <textarea
                  id="profile-bio"
                  rows={4}
                  maxLength={2000}
                  value={form.bio}
                  onChange={(e) => setField('bio', e.target.value)}
                  aria-invalid={fieldErrors.bio ? true : undefined}
                  aria-describedby="profile-bio-count"
                  className={inputClass + ' resize-y' + (fieldErrors.bio ? inputErrorClass : '')}
                  placeholder="What you like about the neighborhood, what you're into, how you can help."
                />
                {fieldErrors.bio ? <p className={fieldErrorClass}>{fieldErrors.bio}</p> : null}
                <p id="profile-bio-count" className={helpClass + ' text-right'}>{form.bio.length} / 2000</p>
              </div>
            </div>

            {/* What you help with */}
            <section id="helps-with" aria-labelledby="edit-helps-with" className="mt-4 rounded-2xl border border-app bg-surface p-4 scroll-mt-24">
              <h3 id="edit-helps-with" className="text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Helps with</h3>
              <p className="mt-0.5 text-[0.8125rem] leading-[1.125rem] text-app-muted">Neighbors who need a hand can find you for these.</p>
              {skills.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <li key={skill}>
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        aria-label={`Remove ${skill}`}
                        className="min-h-[2.75rem] pl-3.5 pr-2.5 rounded-full border border-app bg-surface-muted text-[0.9375rem] text-app-strong inline-flex items-center gap-1.5 hover-bg-app"
                      >
                        {skill}
                        <X aria-hidden="true" className="w-4 h-4 text-app-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  className={inputClass + ' flex-1 min-w-0'}
                  aria-label="Add something you help with"
                  placeholder="Gardening, bike repair…"
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="min-h-[3rem] px-4 rounded-xl border border-app-strong bg-surface text-base font-semibold text-app inline-flex items-center gap-1.5 hover-bg-app"
                >
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  Add
                </button>
              </div>
            </section>

            {/* Links */}
            <section aria-labelledby="edit-links" className="mt-4 rounded-2xl border border-app bg-surface p-4">
              <h3 id="edit-links" className="text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Links</h3>
              <p className="mt-0.5 text-[0.8125rem] leading-[1.125rem] text-app-muted">Shown in About on your profile. Leave one blank to remove it.</p>
              <div className="mt-3 space-y-4">
                {([
                  ['website', 'Website', 'https://yourwebsite.com'],
                  ['linkedin', 'LinkedIn', 'https://linkedin.com/in/yourprofile'],
                  ['instagram', 'Instagram', 'https://instagram.com/yourhandle'],
                  ['facebook', 'Facebook', 'https://facebook.com/yourprofile'],
                  ['twitter', 'X (Twitter)', 'https://x.com/yourhandle'],
                ] as const).map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label htmlFor={`profile-${field}`} className={labelClass}>{label}</label>
                    <input
                      id={`profile-${field}`}
                      type="url"
                      value={form[field]}
                      onChange={(e) => setField(field, e.target.value)}
                      aria-invalid={fieldErrors[field] ? true : undefined}
                      className={inputClass + (fieldErrors[field] ? inputErrorClass : '')}
                      placeholder={placeholder}
                    />
                    {fieldErrors[field] ? <p className={fieldErrorClass}>{fieldErrors[field]}</p> : null}
                  </div>
                ))}
              </div>
            </section>
          </section>

          {/* Only you see this */}
          <section aria-labelledby="edit-only-you">
            <PartHeader
              id="edit-only-you"
              icon={<Lock className="w-[1.0625rem] h-[1.0625rem]" />}
              iconClass="bg-app-surface-sunken text-app-secondary"
              title="Only you see this"
              detail="Never shown on your profile."
            />
            <div className="rounded-2xl border border-app bg-surface px-4 divide-y divide-app">
              <fieldset className="py-4">
                {/* Floated, a legend sits in the flow like a heading instead of on the card's border. */}
                <legend className="float-left w-full mb-2 text-[0.9375rem] leading-5 font-semibold text-app">Account name</legend>
                <div className="clear-both grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="profile-first-name" className={labelClass}>First name</label>
                    <input
                      id="profile-first-name"
                      type="text"
                      value={form.firstName}
                      onChange={(e) => setField('firstName', e.target.value)}
                      aria-invalid={fieldErrors.firstName ? true : undefined}
                      className={inputClass + (fieldErrors.firstName ? inputErrorClass : '')}
                      autoComplete="given-name"
                    />
                    {fieldErrors.firstName ? <p className={fieldErrorClass}>{fieldErrors.firstName}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="profile-middle-name" className={labelClass}>Middle name (optional)</label>
                    <input
                      id="profile-middle-name"
                      type="text"
                      value={form.middleName}
                      onChange={(e) => setField('middleName', e.target.value)}
                      aria-invalid={fieldErrors.middleName ? true : undefined}
                      className={inputClass + (fieldErrors.middleName ? inputErrorClass : '')}
                      autoComplete="additional-name"
                    />
                    {fieldErrors.middleName ? <p className={fieldErrorClass}>{fieldErrors.middleName}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="profile-last-name" className={labelClass}>Last name</label>
                    <input
                      id="profile-last-name"
                      type="text"
                      value={form.lastName}
                      onChange={(e) => setField('lastName', e.target.value)}
                      aria-invalid={fieldErrors.lastName ? true : undefined}
                      className={inputClass + (fieldErrors.lastName ? inputErrorClass : '')}
                      autoComplete="family-name"
                    />
                    {fieldErrors.lastName ? <p className={fieldErrorClass}>{fieldErrors.lastName}</p> : null}
                  </div>
                </div>
                <p className={helpClass}>Used for your account and home verification.</p>
              </fieldset>

              <ProfilePictureUpload
                currentUrl={profilePictureUrl}
                fallbackInitial={form.firstName?.[0]?.toUpperCase() || chosenUsername(user?.username)?.[0]?.toUpperCase() || 'U'}
                onUploaded={(url) => {
                  setProfilePictureUrl(url);
                  // The photo neighbors see may follow it.
                  void localProfile.refetch();
                }}
              />

              <div className="py-4">
                <p className={labelClass}>Email</p>
                <p className="min-h-[3rem] px-3.5 py-2.5 rounded-xl border border-app bg-surface-muted text-base text-app [overflow-wrap:anywhere]">
                  {typeof me.email === 'string' && me.email ? me.email : 'No email on your account'}
                </p>
                <ShowSwitch
                  label="Show email on my profile"
                  checked={showContact.showEmail}
                  onChange={(value) => setShowContact((prev) => ({ ...prev, showEmail: value }))}
                />
              </div>

              <div className="py-4">
                <label htmlFor="profile-phone-number" className={labelClass}>Phone</label>
                <input
                  id="profile-phone-number"
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setField('phoneNumber', e.target.value)}
                  aria-invalid={fieldErrors.phoneNumber ? true : undefined}
                  aria-describedby="profile-phone-help"
                  className={inputClass + (fieldErrors.phoneNumber ? inputErrorClass : '')}
                  placeholder="+14155552671"
                  autoComplete="tel"
                />
                {fieldErrors.phoneNumber ? <p className={fieldErrorClass}>{fieldErrors.phoneNumber}</p> : null}
                <p id="profile-phone-help" className={helpClass}>Common US formats become +1 numbers when you save.</p>
                <ShowSwitch
                  label="Show phone on my profile"
                  checked={showContact.showPhone}
                  onChange={(value) => setShowContact((prev) => ({ ...prev, showPhone: value }))}
                />
              </div>

              <div className="py-4">
                <label htmlFor="profile-date-of-birth" className={labelClass}>Date of birth (optional)</label>
                <input
                  id="profile-date-of-birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => setField('dateOfBirth', e.target.value)}
                  aria-invalid={fieldErrors.dateOfBirth ? true : undefined}
                  className={inputClass + (fieldErrors.dateOfBirth ? inputErrorClass : '')}
                />
                {fieldErrors.dateOfBirth ? <p className={fieldErrorClass}>{fieldErrors.dateOfBirth}</p> : null}
              </div>

              <fieldset className="py-4">
                <legend className="float-left w-full mb-2 text-[0.9375rem] leading-5 font-semibold text-app">Address on your account</legend>
                <label htmlFor="profile-street-address" className={labelClass + ' clear-both'}>Street address</label>
                <AddressAutocomplete
                  id="profile-street-address"
                  value={form.address}
                  onChange={(v) => {
                    setField('address', v);
                    setAddressVerified(false);
                  }}
                  onSelectNormalized={(n) => {
                    setFields({
                      address: n.address || '',
                      city: n.city || '',
                      state: (n.state || '').toUpperCase(),
                      zipcode: n.zipcode || '',
                    });
                    setAddressVerified(true);
                  }}
                  placeholder="123 Main St"
                />
                {fieldErrors.address ? <p className={fieldErrorClass}>{fieldErrors.address}</p> : null}
                <p className="mt-2 text-xs text-app-secondary">
                  <span className={addressVerified ? 'text-green-700' : 'text-yellow-700'}>{addressVerified ? 'Verified' : 'Not verified'}</span>
                  {form.city || form.state ? ` · ${[form.city, form.state.toUpperCase()].filter(Boolean).join(', ')}${form.zipcode ? ` ${form.zipcode}` : ''}${stateName ? ` (${stateName})` : ''}` : ''}
                </p>
                <div className="mt-3 grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="profile-city" className={labelClass}>City</label>
                    <input
                      id="profile-city"
                      type="text"
                      value={form.city}
                      onChange={(e) => setField('city', e.target.value)}
                      aria-invalid={fieldErrors.city ? true : undefined}
                      className={inputClass + (fieldErrors.city ? inputErrorClass : '')}
                      autoComplete="address-level2"
                    />
                    {fieldErrors.city ? <p className={fieldErrorClass}>{fieldErrors.city}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="profile-state" className={labelClass}>State</label>
                    <select
                      id="profile-state"
                      value={form.state}
                      onChange={(e) => setField('state', e.target.value.toUpperCase())}
                      aria-invalid={fieldErrors.state ? true : undefined}
                      className={inputClass + (fieldErrors.state ? inputErrorClass : '')}
                    >
                      <option value="">Select state</option>
                      {US_STATES.map((s: { code: string; name: string }) => (
                        <option key={s.code} value={s.code}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                    {fieldErrors.state ? <p className={fieldErrorClass}>{fieldErrors.state}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="profile-zip" className={labelClass}>Zip</label>
                    <input
                      id="profile-zip"
                      type="text"
                      value={form.zipcode}
                      onChange={(e) => setField('zipcode', e.target.value)}
                      aria-invalid={fieldErrors.zipcode ? true : undefined}
                      className={inputClass + (fieldErrors.zipcode ? inputErrorClass : '')}
                      autoComplete="postal-code"
                    />
                    {fieldErrors.zipcode ? <p className={fieldErrorClass}>{fieldErrors.zipcode}</p> : null}
                  </div>
                </div>
                <p className={helpClass}>The street address is never shown. Your city shows only to the people &ldquo;Who sees your city&rdquo; allows.</p>
              </fieldset>

              <div className="py-1">
                <LinkRow
                  icon={<Home className="w-5 h-5" />}
                  title="Home address"
                  detail="Never shown. Neighbors see &ldquo;Verified neighbor&rdquo;."
                  href="/app/homes"
                  onOpen={(href) => void leave(href)}
                />
                <LinkRow
                  icon={<MapPin className="w-5 h-5" />}
                  title="Who sees your city"
                  value={privacy.data ? CITY_AUDIENCE[cityAudience] || 'Connections and household' : undefined}
                  href="/app/profile/settings/privacy#neighborhood"
                  onOpen={(href) => void leave(href)}
                />
              </div>
            </div>
          </section>

          {/* Unsaved changes: the save bar stays in reach while you scroll (above the phone tab bar). */}
          {dirty ? (
            <div
              className="sticky z-20 mt-6 -mx-5 px-5 py-2.5 bg-surface border-t border-app flex items-center justify-between gap-3"
              style={{ bottom: 'var(--fab-lift, 0px)' }}
            >
              <span className="flex items-center gap-1.5 text-[0.8125rem] leading-[1.125rem] text-app-muted" role="status">
                <span aria-hidden="true" className="w-2 h-2 rounded-full bg-amber-600" />
                Unsaved changes
              </span>
              <button
                type="submit"
                // A username that can't be used (or is still being checked) holds the save.
                disabled={saving || usernameStatus === 'unavailable' || usernameStatus === 'checking'}
                className="min-h-[2.875rem] px-6 rounded-xl bg-primary-600 text-white text-[1.0625rem] font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <p className="mt-6 text-center text-[0.8125rem] text-app-muted">Change anything above and Save appears here.</p>
          )}
        </form>
      </main>
    </div>
  );
}
