import { useState } from 'react';
import * as api from '@pantopus/api';
import type { BusinessUser, BusinessProfile } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import Field from '../shared/Field';
import InfoRow from '../shared/InfoRow';

interface ProfileTabProps {
  business: BusinessUser;
  profile: BusinessProfile;
  businessId: string;
  onUpdate: () => void;
}

export default function ProfileTab({ business, profile, businessId, onUpdate }: ProfileTabProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: business?.name || '',
    description: profile?.description || '',
    business_type: profile?.business_type || 'general',
    public_email: profile?.public_email || '',
    public_phone: profile?.public_phone || '',
    website: profile?.website || '',
    tagline: business?.tagline || '',
  });
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.businesses.updateBusiness(businessId, form);
      setEditing(false);
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    setPublishing(true);
    try {
      await api.businesses.updateBusiness(businessId, { is_published: !profile?.is_published });
      onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-app">Business Profile</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePublish}
            disabled={publishing}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              profile?.is_published
                ? 'border border-amber-300 text-amber-700 hover:bg-amber-50'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {publishing ? '…' : profile?.is_published ? 'Unpublish' : 'Publish'}
          </button>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 rounded-lg border border-app-strong text-sm font-medium text-app-strong hover:bg-surface-raised transition"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-app bg-surface p-5 space-y-4">
        {editing ? (
          <>
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Tagline" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
            <div>
              <label className="block text-sm font-medium text-app-strong mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none"
              />
            </div>
            <Field label="Email" value={form.public_email} onChange={(v) => setForm({ ...form, public_email: v })} type="email" />
            <Field label="Phone" value={form.public_phone} onChange={(v) => setForm({ ...form, public_phone: v })} type="tel" />
            <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} type="url" />
            <div className="flex gap-2 pt-2">
              <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg border border-app-strong text-sm font-medium text-app-strong hover:bg-surface-raised">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <InfoRow label="Name" value={business?.name} />
            <InfoRow label="Tagline" value={business?.tagline} />
            <InfoRow label="Description" value={profile?.description} />
            <InfoRow label="Type" value={profile?.business_type} />
            <InfoRow label="Categories" value={(profile?.categories || []).join(', ')} />
            <InfoRow label="Email" value={profile?.public_email} />
            <InfoRow label="Phone" value={profile?.public_phone} />
            <InfoRow label="Website" value={profile?.website} />
          </>
        )}
      </div>
    </div>
  );
}
