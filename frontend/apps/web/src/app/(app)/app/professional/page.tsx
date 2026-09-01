// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';
import type { UserProfile } from '@pantopus/types';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'handyman', label: 'Handyman' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'painting', label: 'Painting' },
  { value: 'moving', label: 'Moving' },
  { value: 'pet_care', label: 'Pet Care' },
  { value: 'tutoring', label: 'Tutoring' },
  { value: 'photography', label: 'Photography' },
  { value: 'catering', label: 'Catering' },
  { value: 'personal_training', label: 'Personal Training' },
  { value: 'auto_repair', label: 'Auto Repair' },
  { value: 'carpentry', label: 'Carpentry' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'appliance_repair', label: 'Appliance Repair' },
  { value: 'interior_design', label: 'Interior Design' },
  { value: 'event_planning', label: 'Event Planning' },
  { value: 'music_lessons', label: 'Music Lessons' },
  { value: 'web_development', label: 'Web Development' },
  { value: 'graphic_design', label: 'Graphic Design' },
  { value: 'writing', label: 'Writing' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'childcare', label: 'Childcare' },
  { value: 'elder_care', label: 'Elder Care' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'errand_running', label: 'Errand Running' },
  { value: 'other', label: 'Other' },
];

export default function ProfessionalPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'view' | 'edit' | 'create'>('view');

  // Form state
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [hourlyRate, setHourlyRate] = useState('');
  const [serviceCity, setServiceCity] = useState('');
  const [serviceState, setServiceState] = useState('');
  const [radiusKm, setRadiusKm] = useState('50');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.professional.getMyProfile();
      if (!res.profile) {
        setProfile(null);
        setMode('create');
      } else {
        setProfile(res.profile);
        populateForm(res.profile);
        setMode('view');
      }
    } catch {
      setProfile(null);
      setMode('create');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const populateForm = (p: Record<string, any>) => {
    setHeadline((p.headline as string) || '');
    setBio((p.bio as string) || '');
    setCategories((p.categories as string[]) || []);
    setIsPublic((p.is_public as boolean) ?? true);
    const pricingMeta = p.pricing_meta as Record<string, any> | undefined;
    setHourlyRate(pricingMeta?.hourly_rate?.toString() || '');
    const serviceArea = p.service_area as Record<string, any> | undefined;
    setServiceCity((serviceArea?.city as string) || '');
    setServiceState((serviceArea?.state as string) || '');
    setRadiusKm(serviceArea?.radius_km?.toString() || '50');
  };

  const buildPayload = () => ({
    headline: headline || undefined,
    bio: bio || undefined,
    categories,
    is_public: isPublic,
    pricing_meta: hourlyRate ? { hourly_rate: parseFloat(hourlyRate), currency: 'USD' } : undefined,
    service_area: serviceCity || serviceState ? {
      city: serviceCity || undefined,
      state: serviceState || undefined,
      radius_km: parseInt(radiusKm) || 50,
    } : undefined,
  });

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await api.professional.createProfile(buildPayload());
      setProfile(res.profile);
      setMode('view');
    } catch (err: unknown) {
      console.error('Failed to create profile:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to enable professional mode');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const res = await api.professional.updateMyProfile(buildPayload());
      setProfile(res.profile);
      setMode('view');
    } catch (err: unknown) {
      console.error('Failed to update profile:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDisable = async () => {
    const yes = await confirmStore.open({ title: 'Disable professional mode?', description: 'Your profile will no longer be visible to the public.', confirmLabel: 'Disable', variant: 'destructive' });
    if (!yes) return;
    setSaving(true);
    try {
      await api.professional.disableProfile();
      setProfile(null);
      setMode('create');
    } catch (err: unknown) {
      console.error('Failed to disable:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      setCategories(categories.filter(c => c !== cat));
    } else if (categories.length < 5) {
      setCategories([...categories, cat]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
      </div>
    );
  }

  // ── Create Mode (onboarding) ──
  if (mode === 'create') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔧</div>
          <h1 className="text-2xl font-bold text-app-text mb-2">Enable Professional Mode</h1>
          <p className="text-app-text-secondary max-w-md mx-auto">
            Become discoverable on the map and in search. Followers can see your public posts and gigs.
            Free to enable, no commitment.
          </p>
        </div>

        <ProfileForm
          headline={headline} setHeadline={setHeadline}
          bio={bio} setBio={setBio}
          categories={categories} toggleCategory={toggleCategory}
          isPublic={isPublic} setIsPublic={setIsPublic}
          hourlyRate={hourlyRate} setHourlyRate={setHourlyRate}
          serviceCity={serviceCity} setServiceCity={setServiceCity}
          serviceState={serviceState} setServiceState={setServiceState}
          radiusKm={radiusKm} setRadiusKm={setRadiusKm}
        />

        <div className="flex gap-3 mt-8">
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 transition"
          >
            {saving ? 'Enabling...' : 'Enable Professional Mode'}
          </button>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-app-border text-app-text-strong rounded-xl font-medium hover:bg-app-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Edit Mode ──
  if (mode === 'edit') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-app-text mb-6">Edit Professional Profile</h1>

        <ProfileForm
          headline={headline} setHeadline={setHeadline}
          bio={bio} setBio={setBio}
          categories={categories} toggleCategory={toggleCategory}
          isPublic={isPublic} setIsPublic={setIsPublic}
          hourlyRate={hourlyRate} setHourlyRate={setHourlyRate}
          serviceCity={serviceCity} setServiceCity={setServiceCity}
          serviceState={serviceState} setServiceState={setServiceState}
          radiusKm={radiusKm} setRadiusKm={setRadiusKm}
        />

        <div className="flex gap-3 mt-8">
          <button
            onClick={handleUpdate}
            disabled={saving}
            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-60 transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => { populateForm(profile); setMode('view'); }}
            className="px-6 py-3 border border-app-border text-app-text-strong rounded-xl font-medium hover:bg-app-hover"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── View Mode ──
  const verificationLabel = profile.verification_status === 'verified'
    ? `Tier ${profile.verification_tier} Verified`
    : profile.verification_status === 'pending'
    ? 'Verification Pending'
    : 'Not Verified';

  const verificationColor = profile.verification_status === 'verified'
    ? 'bg-green-100 text-green-800'
    : profile.verification_status === 'pending'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-app-surface-sunken text-app-text-secondary';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-app-text">Professional Profile</h1>
          <p className="text-app-text-secondary text-sm mt-1">
            {profile.is_public ? 'Visible to the public' : 'Private profile'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('edit')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm"
          >
            Edit
          </button>
          <button
            onClick={handleDisable}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium text-sm"
          >
            Disable
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-app-surface rounded-xl border border-app-border divide-y divide-app-border-subtle">
        {/* Headline & Bio */}
        <div className="p-6">
          {profile.headline && (
            <h2 className="text-xl font-semibold text-app-text mb-2">{profile.headline}</h2>
          )}
          {profile.bio && (
            <p className="text-app-text-strong leading-relaxed">{profile.bio}</p>
          )}
          {!profile.headline && !profile.bio && (
            <p className="text-app-text-muted italic">No headline or bio set yet. Click Edit to add one.</p>
          )}
        </div>

        {/* Categories */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-3">Categories</h3>
          {profile.categories && profile.categories.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.categories.map((cat: string) => (
                <span key={cat} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  {CATEGORY_OPTIONS.find(o => o.value === cat)?.label || cat}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-app-text-muted italic">No categories selected</p>
          )}
        </div>

        {/* Service Area & Pricing */}
        <div className="p-6 grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Service Area</h3>
            {profile.service_area ? (
              <p className="text-app-text-strong">
                {[profile.service_area.city, profile.service_area.state].filter(Boolean).join(', ') || 'Set a service area'}
                {profile.service_area.radius_km && (
                  <span className="text-app-text-muted ml-1">({profile.service_area.radius_km} km radius)</span>
                )}
              </p>
            ) : (
              <p className="text-app-text-muted italic">Not set</p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Pricing</h3>
            {profile.pricing_meta?.hourly_rate ? (
              <p className="text-app-text-strong">${profile.pricing_meta.hourly_rate}/hr</p>
            ) : (
              <p className="text-app-text-muted italic">Not set</p>
            )}
          </div>
        </div>

        {/* Verification */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-app-text-secondary uppercase tracking-wider mb-2">Verification</h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${verificationColor}`}>
                {profile.verification_status === 'verified' && '✓ '}
                {verificationLabel}
              </span>
            </div>
            {profile.verification_status === 'none' && (
              <button
                onClick={async () => {
                  try {
                    await api.professional.startVerification(1);
                    await loadProfile();
                  } catch (err: unknown) {
                    toast.error(err instanceof Error ? err.message : 'Failed to start verification');
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                Start Verification
              </button>
            )}
          </div>
          {profile.verification_status === 'none' && (
            <p className="text-xs text-app-text-muted mt-2">
              Verified professionals get more visibility and are eligible for premium gigs.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Profile Form ============

function ProfileForm({
  headline, setHeadline,
  bio, setBio,
  categories, toggleCategory,
  isPublic, setIsPublic,
  hourlyRate, setHourlyRate,
  serviceCity, setServiceCity,
  serviceState, setServiceState,
  radiusKm, setRadiusKm,
}: {
  headline: string; setHeadline: (v: string) => void;
  bio: string; setBio: (v: string) => void;
  categories: string[]; toggleCategory: (v: string) => void;
  isPublic: boolean; setIsPublic: (v: boolean) => void;
  hourlyRate: string; setHourlyRate: (v: string) => void;
  serviceCity: string; setServiceCity: (v: string) => void;
  serviceState: string; setServiceState: (v: string) => void;
  radiusKm: string; setRadiusKm: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Headline */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">Headline</label>
        <input
          type="text"
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="e.g. Experienced Handyman & Home Repair Specialist"
          maxLength={200}
          className="w-full px-4 py-2.5 border border-app-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Describe your services, experience, and what makes you great..."
          maxLength={2000}
          rows={4}
          className="w-full px-4 py-2.5 border border-app-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
        />
      </div>

      {/* Categories */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-2">
          Categories <span className="text-app-text-muted font-normal">(select up to 5)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_OPTIONS.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => toggleCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                categories.includes(cat.value)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-app-surface text-app-text-strong border-app-border hover:bg-app-hover'
              } ${
                !categories.includes(cat.value) && categories.length >= 5
                  ? 'opacity-40 cursor-not-allowed'
                  : ''
              }`}
              disabled={!categories.includes(cat.value) && categories.length >= 5}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service Area */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-2">Service Area</label>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={serviceCity}
            onChange={(e) => setServiceCity(e.target.value)}
            placeholder="City"
            className="px-4 py-2.5 border border-app-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <input
            type="text"
            value={serviceState}
            onChange={(e) => setServiceState(e.target.value)}
            placeholder="State"
            className="px-4 py-2.5 border border-app-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              placeholder="50"
              min="1"
              max="500"
              className="w-full px-4 py-2.5 border border-app-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <span className="text-sm text-app-text-secondary whitespace-nowrap">km</span>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div>
        <label className="block text-sm font-medium text-app-text-strong mb-1">Hourly Rate (optional)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-muted">$</span>
          <input
            type="number"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full pl-8 pr-16 py-2.5 border border-app-border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">/hr</span>
        </div>
      </div>

      {/* Public toggle */}
      <div className="flex items-center justify-between bg-app-surface-raised rounded-xl p-4">
        <div>
          <p className="font-medium text-app-text">Public Profile</p>
          <p className="text-sm text-app-text-secondary">Visible on map and in search results</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPublic(!isPublic)}
          className={`relative w-12 h-6 rounded-full transition ${isPublic ? 'bg-primary-600' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-app-surface rounded-full shadow transition-transform ${isPublic ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}
