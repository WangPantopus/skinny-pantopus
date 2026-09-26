'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { US_STATES } from '@pantopus/utils';
import ProfilePictureUpload from '@/components/ProfilePictureUpload';
import { useProfileForm } from '@/hooks/useProfileForm';
import ErrorState from '@/components/ui/ErrorState';

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

// The same field-error treatment as the sign-up form.
const inputErrorClass = ' border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20';
const fieldErrorClass = 'mt-1 text-xs text-red-600 dark:text-red-300';

export default function EditProfilePage() {
  const router = useRouter();

  const {
    form, setField, setFields,
    loading, loadError, saving, fieldErrors, user,
    skills, newSkill, setNewSkill, addSkill, removeSkill,
    addressVerified, setAddressVerified,
    profilePictureUrl, setProfilePictureUrl,
    loadProfile, saveProfile,
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

  if (loadError) {
    return (
      <div className="bg-app">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl font-semibold text-app mb-6">Edit Profile</h1>
          <ErrorState message={loadError} onRetry={loadProfile} />
        </main>
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
                  aria-invalid={fieldErrors.firstName ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.firstName ? inputErrorClass : '')}
                  placeholder="John"
                />
                {fieldErrors.firstName ? <p className={fieldErrorClass}>{fieldErrors.firstName}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Middle Name</label>
                <input
                  type="text"
                  value={form.middleName}
                  onChange={(e) => setField('middleName', e.target.value)}
                  aria-invalid={fieldErrors.middleName ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.middleName ? inputErrorClass : '')}
                  placeholder="(optional)"
                />
                {fieldErrors.middleName ? <p className={fieldErrorClass}>{fieldErrors.middleName}</p> : null}
                <p className="text-xs text-app-secondary mt-1">You can clear this field and save.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Last Name</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setField('lastName', e.target.value)}
                  aria-invalid={fieldErrors.lastName ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.lastName ? inputErrorClass : '')}
                  placeholder="Doe"
                />
                {fieldErrors.lastName ? <p className={fieldErrorClass}>{fieldErrors.lastName}</p> : null}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Date of Birth</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setField('dateOfBirth', e.target.value)}
                aria-invalid={fieldErrors.dateOfBirth ? true : undefined}
                className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.dateOfBirth ? inputErrorClass : '')}
              />
              {fieldErrors.dateOfBirth ? <p className={fieldErrorClass}>{fieldErrors.dateOfBirth}</p> : null}
              <p className="text-xs text-app-secondary mt-1">Optional. You can leave blank.</p>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Tagline</label>
              <input
                type="text"
                value={form.tagline}
                onChange={(e) => setField('tagline', e.target.value)}
                aria-invalid={fieldErrors.tagline ? true : undefined}
                className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.tagline ? inputErrorClass : '')}
                placeholder="Quick one-liner (optional)"
              />
              {fieldErrors.tagline ? <p className={fieldErrorClass}>{fieldErrors.tagline}</p> : null}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-app-strong mb-2">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setField('bio', e.target.value)}
                aria-invalid={fieldErrors.bio ? true : undefined}
                rows={4}
                maxLength={2000}
                className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-app bg-surface" + (fieldErrors.bio ? inputErrorClass : '')}
                placeholder="Tell people about yourself..."
              />
              {fieldErrors.bio ? <p className={fieldErrorClass}>{fieldErrors.bio}</p> : null}
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
              {fieldErrors.address ? <p className={fieldErrorClass}>{fieldErrors.address}</p> : null}

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
                  aria-invalid={fieldErrors.city ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.city ? inputErrorClass : '')}
                  placeholder="Portland"
                />
                {fieldErrors.city ? <p className={fieldErrorClass}>{fieldErrors.city}</p> : null}
              </div>

              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">State</label>
                <select
                  value={form.state}
                  onChange={(e) => setField('state', e.target.value.toUpperCase())}
                  aria-invalid={fieldErrors.state ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-app" + (fieldErrors.state ? inputErrorClass : '')}
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
                <label className="block text-sm font-medium text-app-strong mb-2">Zip</label>
                <input
                  type="text"
                  value={form.zipcode}
                  onChange={(e) => setField('zipcode', e.target.value)}
                  aria-invalid={fieldErrors.zipcode ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.zipcode ? inputErrorClass : '')}
                  placeholder="97205"
                />
                {fieldErrors.zipcode ? <p className={fieldErrorClass}>{fieldErrors.zipcode}</p> : null}
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
                  aria-invalid={fieldErrors.phoneNumber ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.phoneNumber ? inputErrorClass : '')}
                  placeholder="+14155552671"
                />
                {fieldErrors.phoneNumber ? <p className={fieldErrorClass}>{fieldErrors.phoneNumber}</p> : null}
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
                  aria-invalid={fieldErrors.website ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.website ? inputErrorClass : '')}
                  placeholder="https://yourwebsite.com"
                />
                {fieldErrors.website ? <p className={fieldErrorClass}>{fieldErrors.website}</p> : null}
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
                  aria-invalid={fieldErrors.linkedin ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.linkedin ? inputErrorClass : '')}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
                {fieldErrors.linkedin ? <p className={fieldErrorClass}>{fieldErrors.linkedin}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Twitter</label>
                <input
                  type="url"
                  value={form.twitter}
                  onChange={(e) => setField('twitter', e.target.value)}
                  aria-invalid={fieldErrors.twitter ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.twitter ? inputErrorClass : '')}
                  placeholder="https://twitter.com/yourhandle"
                />
                {fieldErrors.twitter ? <p className={fieldErrorClass}>{fieldErrors.twitter}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Instagram</label>
                <input
                  type="url"
                  value={form.instagram}
                  onChange={(e) => setField('instagram', e.target.value)}
                  aria-invalid={fieldErrors.instagram ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.instagram ? inputErrorClass : '')}
                  placeholder="https://instagram.com/yourhandle"
                />
                {fieldErrors.instagram ? <p className={fieldErrorClass}>{fieldErrors.instagram}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-app-strong mb-2">Facebook</label>
                <input
                  type="url"
                  value={form.facebook}
                  onChange={(e) => setField('facebook', e.target.value)}
                  aria-invalid={fieldErrors.facebook ? true : undefined}
                  className={"w-full px-4 py-2 border border-app-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-app bg-surface" + (fieldErrors.facebook ? inputErrorClass : '')}
                  placeholder="https://facebook.com/yourprofile"
                />
                {fieldErrors.facebook ? <p className={fieldErrorClass}>{fieldErrors.facebook}</p> : null}
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
