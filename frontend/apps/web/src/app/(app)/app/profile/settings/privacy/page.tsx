'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Shield, Eye, Search, UserX } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import ErrorState from '@/components/ui/ErrorState';
import type {
  UserPrivacySettings,
  SearchVisibilityLevel,
  ProfileVisibilityLevel,
} from '@pantopus/types';
import { setPrivacySettings, usePrivacySettings } from '@/lib/me';

type PrivacyForm = Pick<UserPrivacySettings, 'search_visibility' | 'show_gig_history' | 'show_neighborhood' | 'show_home_affiliation'>;

export default function PrivacySettingsPage() {
  const router = useRouter();
  // The session cookie is readable only in the browser: until mount, the page
  // renders what the cache already has (nothing on a fresh load), like the server.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const signedIn = mounted && !!getAuthToken();
  useEffect(() => {
    if (mounted && !getAuthToken()) router.push('/login');
  }, [mounted, router]);

  // Your privacy settings are one shared entry (lib/me.ts), so coming back shows them at once.
  // Never show the form on defaults: saving it would overwrite the real
  // settings with the most public ones.
  const settingsQuery = usePrivacySettings({ enabled: signedIn });
  const saved = settingsQuery.data ?? null;
  const loadError = !saved && settingsQuery.isError
    ? "We couldn't load your privacy settings. Check your connection and try again."
    : null;
  const loading = !saved && (!loadError || settingsQuery.isFetching);
  const loadSettings = () => { void settingsQuery.refetch(); };
  const [saving, setSaving] = useState(false);

  // The form shows your saved settings, with the changes you haven't saved yet over them.
  const [draft, setDraft] = useState<Partial<PrivacyForm>>({});
  const searchVisibility = (draft.search_visibility ?? saved?.search_visibility ?? 'everyone') as SearchVisibilityLevel;
  const showGigHistory = (draft.show_gig_history ?? saved?.show_gig_history ?? 'public') as ProfileVisibilityLevel;
  const showNeighborhood = (draft.show_neighborhood ?? saved?.show_neighborhood ?? 'followers') as ProfileVisibilityLevel;
  const showHomeAffiliation = (draft.show_home_affiliation ?? saved?.show_home_affiliation ?? 'followers') as ProfileVisibilityLevel;
  const edit = (change: Partial<PrivacyForm>) => setDraft((current) => ({ ...current, ...change }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const sent: PrivacyForm = {
        search_visibility: searchVisibility,
        show_gig_history: showGigHistory,
        show_neighborhood: showNeighborhood,
        show_home_affiliation: showHomeAffiliation,
      };
      const res = await api.privacy.updatePrivacySettings(sent);
      setPrivacySettings(res.settings);
      // A change made while this save was on the way stays in the form.
      setDraft((current) => Object.fromEntries(
        Object.entries(current).filter(([field, value]) => sent[field as keyof PrivacyForm] !== value),
      ) as Partial<PrivacyForm>);
      toast.success('Privacy settings saved');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-app min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
              <p className="mt-4 text-app-secondary">Loading privacy settings…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-app min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => router.push('/app/profile/settings')}
            className="flex items-center gap-1.5 text-sm text-app-secondary hover:text-app mb-4 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </button>
          <ErrorState message={loadError} onRetry={loadSettings} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back link */}
        <button
          onClick={() => router.push('/app/profile/settings')}
          className="flex items-center gap-1.5 text-sm text-app-secondary hover:text-app mb-4 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-app">Privacy & Blocks</h1>
            <p className="text-sm text-app-secondary">Control who can find you and what they see</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Search & Discoverability */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-5 h-5 text-app-secondary" />
              <h2 className="text-lg font-semibold text-app">Search & Discoverability</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="privacy-search-visibility" className="block text-sm font-medium text-app-strong mb-2">
                  Who can find you in search?
                </label>
                <select
                  id="privacy-search-visibility"
                  value={searchVisibility}
                  onChange={(e) => edit({ search_visibility: e.target.value as SearchVisibilityLevel })}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="everyone">Everyone</option>
                  <option value="mutuals">Mutual connections only</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
            </div>
          </div>

          {/* Profile Field Visibility */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-app-secondary" />
              <h2 className="text-lg font-semibold text-app">Profile Field Visibility</h2>
            </div>
            <p className="text-sm text-app-secondary mb-4">Choose who can see specific details on your profile.</p>
            <div className="space-y-4">
              <SelectSetting
                label="Gig history"
                description="Who can see your completed gigs"
                value={showGigHistory}
                onChange={(v) => edit({ show_gig_history: v as ProfileVisibilityLevel })}
                options={VISIBILITY_OPTIONS}
              />
              <SelectSetting
                label="Neighborhood"
                description="Who can see your general area"
                value={showNeighborhood}
                onChange={(v) => edit({ show_neighborhood: v as ProfileVisibilityLevel })}
                options={VISIBILITY_OPTIONS}
              />
              <SelectSetting
                label="Home affiliation"
                description="Who can see which home you belong to"
                value={showHomeAffiliation}
                onChange={(v) => edit({ show_home_affiliation: v as ProfileVisibilityLevel })}
                options={VISIBILITY_OPTIONS}
              />
            </div>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50 transition"
          >
            {saving ? 'Saving…' : 'Save Privacy Settings'}
          </button>

          {/* Blocked Users */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserX className="w-5 h-5 text-app-secondary" />
              <h2 className="text-lg font-semibold text-app">Blocked Users</h2>
            </div>
            <p className="text-sm text-app-secondary mb-4">
              People you&apos;ve blocked cannot find or interact with you. You can block someone from their profile page.
            </p>

            {/* Blocks live in three separate contracts; the Blocked users page lists and lifts all of them. */}
            <button
              type="button"
              onClick={() => router.push('/app/profile/settings/blocked')}
              className="w-full flex items-center justify-between rounded-lg border border-app px-4 py-3 text-sm font-medium text-app hover:bg-surface-muted transition"
            >
              See and unblock everyone you&apos;ve blocked
              <ChevronRight className="w-4 h-4 text-app-secondary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────

const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Everyone' },
  { value: 'followers', label: 'Followers only' },
  { value: 'private', label: 'Only me' },
];


// ─── Helper Components ────────────────────────────────────────

function SelectSetting({
  label,
  description,
  value,
  onChange,
  options,
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-app last:border-0">
      <div className="flex-1">
        <p className="font-medium text-app">{label}</p>
        {description && <p className="text-sm text-app-secondary">{description}</p>}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="px-3 py-1.5 border border-app-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
