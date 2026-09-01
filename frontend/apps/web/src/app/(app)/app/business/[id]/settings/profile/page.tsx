'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { BusinessUser, BusinessProfile } from '@pantopus/types';

export default function BusinessSettingsProfilePage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [business, setBusiness] = useState<BusinessUser | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    business_type: '',
    categories: '',
    public_email: '',
    public_phone: '',
    website: '',
    tagline: '',
    founded_year: '',
    employee_count: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getBusiness(businessId);
      setBusiness(res.business);
      setProfile(res.profile || null);
      setForm({
        name: res.business?.name || '',
        description: res.profile?.description || '',
        business_type: res.profile?.business_type || '',
        categories: (res.profile?.categories || []).join(', '),
        public_email: res.profile?.public_email || '',
        public_phone: res.profile?.public_phone || '',
        website: res.profile?.website || '',
        tagline: res.business?.tagline || '',
        founded_year: res.profile?.founded_year ? String(res.profile.founded_year) : '',
        employee_count: res.profile?.employee_count || '',
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load business profile');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.businesses.updateBusiness(businessId, {
        name: form.name.trim(),
        tagline: form.tagline.trim() || undefined,
        description: form.description.trim() || undefined,
        business_type: form.business_type.trim() || undefined,
        categories: form.categories.split(',').map((s) => s.trim()).filter(Boolean),
        public_email: form.public_email.trim() || undefined,
        public_phone: form.public_phone.trim() || undefined,
        website: form.website.trim() || undefined,
        founded_year: form.founded_year ? Number(form.founded_year) : undefined,
        employee_count: form.employee_count.trim() || undefined,
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    setSaving(true);
    setError('');
    try {
      if (profile?.is_published) {
        await api.businesses.unpublishBusiness(businessId);
      } else {
        await api.businesses.publishBusiness(businessId);
      }
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update publish state');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-app-text-secondary">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Business Profile Settings</h1>
          <p className="text-sm text-app-text-secondary mt-1">@{business?.username || 'business'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePublish}
            disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              profile?.is_published
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {profile?.is_published ? 'Unpublish' : 'Publish'}
          </button>
          <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
        <Field label="Business Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
        <Field label="Tagline" value={form.tagline} onChange={(v) => setForm((f) => ({ ...f, tagline: v }))} />
        <Field label="Business Type" value={form.business_type} onChange={(v) => setForm((f) => ({ ...f, business_type: v }))} />
        <Field label="Categories (comma separated)" value={form.categories} onChange={(v) => setForm((f) => ({ ...f, categories: v }))} />
        <Field label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Public Email" value={form.public_email} onChange={(v) => setForm((f) => ({ ...f, public_email: v }))} />
          <Field label="Public Phone" value={form.public_phone} onChange={(v) => setForm((f) => ({ ...f, public_phone: v }))} />
        </div>
        <Field label="Website" value={form.website} onChange={(v) => setForm((f) => ({ ...f, website: v }))} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Founded Year" value={form.founded_year} onChange={(v) => setForm((f) => ({ ...f, founded_year: v }))} />
          <Field label="Employee Count" value={form.employee_count} onChange={(v) => setForm((f) => ({ ...f, employee_count: v }))} />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-app-text-strong mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
    </label>
  );
}
