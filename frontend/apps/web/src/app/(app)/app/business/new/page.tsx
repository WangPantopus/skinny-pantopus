'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import BusinessAddressFlow from '@/components/business/BusinessAddressFlow';

const STEPS = ['Type', 'Basic Info', 'Location', 'Hours', 'Media', 'Review'] as const;
const BIZ_TYPES = ['restaurant', 'service', 'retail', 'professional', 'creative', 'wellness', 'other'] as const;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type HoursEntry = { day_of_week: number; open_time: string; close_time: string; is_closed: boolean };

const DEFAULT_HOURS: HoursEntry[] = DAY_NAMES.map((_, i) => ({
  day_of_week: i,
  open_time: i >= 1 && i <= 5 ? '09:00' : '',
  close_time: i >= 1 && i <= 5 ? '17:00' : '',
  is_closed: i === 0 || i === 6,
}));

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [createdBusinessId, setCreatedBusinessId] = useState<string | null>(null);
  const [createdLocationId, setCreatedLocationId] = useState<string | null>(null);

  const [businessType, setBusinessType] = useState<string>('service');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  const [locationSkipped, setLocationSkipped] = useState(false);

  const [skipHours, setSkipHours] = useState(false);
  const [hours, setHours] = useState<HoursEntry[]>(DEFAULT_HOURS);

  const [skipMedia, setSkipMedia] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  const progressPct = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);
  const canBack = step > 0;
  const currentStep = STEPS[step];

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => (canBack ? setStep((s) => s - 1) : router.push('/app/businesses'));

  const updateHour = (index: number, patch: Partial<HoursEntry>) => {
    setHours((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  };

  const ensureAuthed = () => {
    if (!getAuthToken()) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const handleBasicInfoStep = async () => {
    if (!ensureAuthed()) return;
    if (!name.trim() || !username.trim() || !email.trim()) {
      setError('Business name, username, and email are required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await api.businesses.createBusiness({
        name: name.trim(),
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        email: email.trim(),
        business_type: businessType,
        description: description.trim() || undefined,
        categories: categories
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        public_phone: phone.trim() || undefined,
        website: website.trim() || undefined,
      });
      const businessId = result.business?.id || null;
      if (!businessId) throw new Error('Business ID missing after creation');
      setCreatedBusinessId(businessId);
      next();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create business');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationComplete = (locationId: string) => {
    setCreatedLocationId(locationId);
    next();
  };

  const handleLocationSkip = () => {
    setLocationSkipped(true);
    next();
  };

  const handleHoursStep = async () => {
    if (skipHours || !createdLocationId) {
      next();
      return;
    }
    if (!createdBusinessId) {
      setError('Business was not created yet.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businesses.setLocationHours(createdBusinessId, createdLocationId, {
        hours: hours.map((h) => ({
          day_of_week: h.day_of_week,
          open_time: h.is_closed ? undefined : h.open_time || undefined,
          close_time: h.is_closed ? undefined : h.close_time || undefined,
          is_closed: h.is_closed,
        })),
      });
      next();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save hours');
    } finally {
      setSaving(false);
    }
  };

  const handleMediaStep = async () => {
    if (!createdBusinessId) {
      setError('Business was not created yet.');
      return;
    }
    if (skipMedia || (!logoFile && !bannerFile)) {
      next();
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (logoFile) {
        await api.upload.uploadBusinessMedia(createdBusinessId, logoFile, 'logo');
      }
      if (bannerFile) {
        await api.upload.uploadBusinessMedia(createdBusinessId, bannerFile, 'banner');
      }
      next();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to upload media');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishStep = async () => {
    if (!createdBusinessId) {
      setError('Business was not created yet.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businesses.publishBusiness(createdBusinessId);
      router.push(`/app/businesses/${createdBusinessId}/dashboard`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to publish business profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => {
    if (!createdBusinessId) return;
    router.push(`/app/businesses/${createdBusinessId}/dashboard`);
  };

  const onNext = () => {
    if (currentStep === 'Type') return next();
    if (currentStep === 'Basic Info') return void handleBasicInfoStep();
    // Location step is driven by BusinessAddressFlow callbacks, not the Next button
    if (currentStep === 'Location') return;
    if (currentStep === 'Hours') return void handleHoursStep();
    if (currentStep === 'Media') return void handleMediaStep();
    if (currentStep === 'Review') return void handlePublishStep();
  };

  return (
    <div className="min-h-screen bg-app-surface-raised" data-testid="business-onboarding">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-5">
          <button data-testid="business-onboarding-back" onClick={back} className="text-sm text-app-text-secondary hover:text-app-text-strong">← Back</button>
          <div className="text-xs text-app-text-secondary" data-testid="business-onboarding-step">Step {step + 1} of {STEPS.length}</div>
        </div>

        <div className="h-2 bg-app-surface-sunken rounded-full overflow-hidden mb-6">
          <div className="h-2 bg-violet-600 transition-all" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="bg-app-surface rounded-xl border border-app-border p-5 sm:p-6">
          <h1 className="text-xl font-semibold text-app-text" data-testid="business-onboarding-heading">{currentStep}</h1>
          <p className="text-sm text-app-text-secondary mt-1 mb-5">Business onboarding wizard</p>

          {currentStep === 'Type' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-app-text-strong">Business type</label>
              <div className="flex flex-wrap gap-2">
                {BIZ_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setBusinessType(t)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      businessType === t
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-app-surface text-app-text-strong border-app-border hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Field label="Business Name *" value={name} onChange={setName} placeholder="My Business" />
            </div>
          )}

          {currentStep === 'Basic Info' && (
            <div className="space-y-4">
              <Field label="Username *" value={username} onChange={(v) => setUsername(v.toLowerCase())} placeholder="mybusiness" />
              <Field label="Email *" value={email} onChange={setEmail} type="email" placeholder="business@email.com" />
              <Field label="Description" value={description} onChange={setDescription} placeholder="What does your business do?" />
              <Field label="Categories (comma separated)" value={categories} onChange={setCategories} placeholder="Plumber, Emergency Repair" />
              <Field label="Public Phone" value={phone} onChange={setPhone} placeholder="(555) 123-4567" />
              <Field label="Website" value={website} onChange={setWebsite} placeholder="https://example.com" />
            </div>
          )}

          {currentStep === 'Location' && createdBusinessId && (
            <BusinessAddressFlow
              businessId={createdBusinessId}
              onComplete={handleLocationComplete}
              onSkip={handleLocationSkip}
            />
          )}

          {currentStep === 'Location' && !createdBusinessId && (
            <div className="text-sm text-red-600">Business must be created first. Go back and complete Basic Info.</div>
          )}

          {currentStep === 'Hours' && (
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-app-text-strong">
                <input type="checkbox" checked={skipHours} onChange={(e) => setSkipHours(e.target.checked)} />
                Skip for now
              </label>
              {!skipHours && (
                <div className="space-y-2">
                  {hours.map((h, idx) => (
                    <div key={h.day_of_week} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 text-sm text-app-text-strong">{DAY_NAMES[h.day_of_week]}</div>
                      <label className="col-span-3 text-sm inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={h.is_closed}
                          onChange={(e) => updateHour(idx, { is_closed: e.target.checked })}
                        />
                        Closed
                      </label>
                      <input
                        className="col-span-3 rounded border border-app-border px-2 py-1 text-sm"
                        type="time"
                        value={h.open_time}
                        disabled={h.is_closed}
                        onChange={(e) => updateHour(idx, { open_time: e.target.value })}
                      />
                      <input
                        className="col-span-3 rounded border border-app-border px-2 py-1 text-sm"
                        type="time"
                        value={h.close_time}
                        disabled={h.is_closed}
                        onChange={(e) => updateHour(idx, { close_time: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'Media' && (
            <div className="space-y-4">
              <label className="inline-flex items-center gap-2 text-sm text-app-text-strong">
                <input type="checkbox" checked={skipMedia} onChange={(e) => setSkipMedia(e.target.checked)} />
                Skip for now
              </label>
              {!skipMedia && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-app-text-strong mb-1">Logo (square)</label>
                    <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-app-text-strong mb-1">Banner (16:9)</label>
                    <input type="file" accept="image/*" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
                  </div>
                </>
              )}
            </div>
          )}

          {currentStep === 'Review' && (
            <div className="space-y-3 text-sm">
              <ReviewRow label="Business Type" value={businessType} />
              <ReviewRow label="Business Name" value={name} />
              <ReviewRow label="Username" value={`@${username}`} />
              <ReviewRow label="Email" value={email} />
              <ReviewRow label="Description" value={description || 'Not set'} />
              <ReviewRow
                label="Location"
                value={locationSkipped ? 'Skipped' : createdLocationId ? 'Configured' : 'Not set'}
              />
              <ReviewRow label="Hours" value={skipHours ? 'Skipped' : 'Configured'} />
              <ReviewRow label="Media" value={skipMedia ? 'Skipped' : [logoFile ? 'Logo' : '', bannerFile ? 'Banner' : ''].filter(Boolean).join(' + ') || 'Not set'} />
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Location step has its own flow controls — hide the shared Next button */}
          {currentStep !== 'Location' && (
            <div className="mt-6 flex items-center gap-2">
              {currentStep === 'Review' && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 rounded-lg border border-app-border text-sm font-medium text-app-text-strong hover:bg-app-hover"
                >
                  Save Draft
                </button>
              )}
              <button
                type="button"
                onClick={onNext}
                disabled={saving}
                data-testid={currentStep === 'Review' ? 'business-onboarding-publish' : 'business-onboarding-next'}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : currentStep === 'Review' ? 'Publish' : 'Next'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-app-text-strong mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-4 text-app-text-secondary">{label}</div>
      <div className="col-span-8 text-app-text">{value}</div>
    </div>
  );
}
