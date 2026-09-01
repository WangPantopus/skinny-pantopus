'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { US_STATES } from '@pantopus/utils';
import ProfilePictureUpload from '@/components/ProfilePictureUpload';
import { useProfileForm } from '@/hooks/useProfileForm';

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
  value,
  onChange,
  onSelectNormalized,
  placeholder = '123 Main St',
}: {
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

export default function EditProfilePage() {
  const router = useRouter();

  const {
    form, setField, setFields,
    loading, saving, user,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    addressVerified, setAddressVerified,
    profilePictureUrl, setProfilePictureUrl,
    saveProfile,
  } = useProfileForm();

  const stateName = useMemo(() => {
    const s = form.state.trim().toUpperCase();
    const match = US_STATES.find((x) => x.code === s);
    return match?.name || '';
  }, [form.state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-app-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-xl font-semibold text-app mb-6">Edit Profile</h1>
        <form onSubmit={saveProfile} className="space-y-6">
          {/* Profile Picture */}
          <ProfilePictureUpload
            currentUrl={profilePictureUrl}
            fallbackInitial={form.firstName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
            onUploaded={(url) => {
              setProfilePictureUrl(url);
            }}
          />

          {/* Basic Information */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Basic Information</h2>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">First Name</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setField('firstName', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Middle Name</label>
                <input
                  type="text"
                  value={form.middleName}
                  onChange={(e) => setField('middleName', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="(optional)"
                />
                <p className="text-xs text-app-secondary mt-1">You can clear this field and save.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Date of Birth</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField('dateOfBirth', e.target.value)}
                className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
              />
              <p className="text-xs text-app-secondary mt-1">Optional. You can leave blank.</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Tagline</label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => setField('tagline', e.target.value)}
                className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                placeholder="Quick one-liner (optional)"
              />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setField('bio', e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-app bg-surface"
                placeholder="Tell people about yourself..."
              />
              <p className="text-sm text-app-secondary mt-1">{form.bio.length}/2000</p>
            </div>
          </div>

          {/* Location */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Location</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Street Address</label>
              <AddressAutocomplete
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

              <div className="mt-2 flex items-center gap-2">
                <span
                  className={
                    addressVerified
                      ? 'text-xs px-2 py-1 rounded-full bg-green-50 text-green-700'
                      : 'text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-700'
                  }
                >
                  {addressVerified ? 'Verified' : 'Not verified'}
                </span>

                <span className="text-xs text-app-secondary">
                  {form.city ? `${form.city}, ` : ''}
                  {form.state ? form.state.toUpperCase() : ''}
                  {form.zipcode ? ` ${form.zipcode}` : ''}
                  {stateName ? ` (${stateName})` : ''}
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">City</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="Portland"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">State</label>
                <select
                  value={form.state}
                  onChange={(e) => setField('state', e.target.value.toUpperCase())}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-app"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s: { code: string; name: string }) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Zip</label>
                <input
                  type="text"
                  value={form.zipcode}
                  onChange={(e) => setField('zipcode', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="97205"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Contact Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setField('phoneNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="+14155552671"
                />
                <p className="text-xs text-app-secondary mt-1">
                  Server requires E.164. Example: +14155552671. We auto-normalize common US formats on save.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Website</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setField('website', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="https://yourwebsite.com"
                />
                <p className="text-xs text-app-secondary mt-1">Leave blank to clear.</p>
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Skills</h2>
            <div className="flex gap-2 mb-4">
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
                className="flex-1 px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                placeholder="Add a skill..."
              />
              <button
                type="button"
                onClick={addSkill}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="text-blue-700 hover:text-blue-900"
                    aria-label={`Remove ${skill}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <p className="text-xs text-app-secondary mt-3">Skills aren&apos;t saved yet (backend doesn&apos;t accept them yet).</p>
          </div>

          {/* Social */}
          <div className="bg-surface rounded-xl border border-app p-6">
            <h2 className="text-lg font-semibold text-app mb-4">Social Media</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">LinkedIn</label>
                <input
                  type="url"
                  value={form.linkedin}
                  onChange={(e) => setField('linkedin', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Twitter</label>
                <input
                  type="url"
                  value={form.twitter}
                  onChange={(e) => setField('twitter', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Instagram</label>
                <input
                  type="url"
                  value={form.instagram}
                  onChange={(e) => setField('instagram', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="https://instagram.com/yourhandle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Facebook</label>
                <input
                  type="url"
                  value={form.facebook}
                  onChange={(e) => setField('facebook', e.target.value)}
                  className="w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface"
                  placeholder="https://facebook.com/yourprofile"
                />
              </div>
            </div>
            <p className="text-xs text-app-secondary mt-3">Leave blank to clear.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 font-semibold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/app/profile')}
              className="px-8 py-3 border border-app-strong text-app-strong rounded-lg hover:bg-surface-raised font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
