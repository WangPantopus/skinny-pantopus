import { useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { BusinessProfile } from '@pantopus/api';

interface SettingsTabProps {
  businessId: string;
  profile: BusinessProfile;
  onUpdate: () => Promise<void>;
}

export default function SettingsTab({ businessId, profile, onUpdate }: SettingsTabProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const togglePublish = async () => {
    setSaving(true);
    setError('');
    try {
      if (profile?.is_published) {
        await api.businesses.unpublishBusiness(businessId);
      } else {
        await api.businesses.publishBusiness(businessId);
      }
      await onUpdate();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update publish state';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-surface rounded-xl border border-app p-5">
        <div className="text-sm font-semibold text-app mb-2">Publishing</div>
        <div className="text-sm text-app-secondary mb-3">
          Current status: {profile?.is_published ? 'Published' : 'Draft'}
        </div>
        <button
          onClick={togglePublish}
          disabled={saving}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
            profile?.is_published
              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              : 'bg-green-600 text-white hover:bg-green-700'
          } disabled:opacity-50`}
        >
          {profile?.is_published ? 'Unpublish' : 'Publish'}
        </button>
        {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
      </div>

      <div className="bg-surface rounded-xl border border-app p-5">
        <div className="text-sm font-semibold text-app mb-3">Settings Pages</div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/app/business/${businessId}/settings/profile`} className="px-3 py-1.5 rounded border border-app-strong text-sm text-app-strong hover:bg-surface-raised">
            Profile Settings
          </Link>
          <Link href={`/app/business/${businessId}/settings/legal`} className="px-3 py-1.5 rounded border border-app-strong text-sm text-app-strong hover:bg-surface-raised">
            Legal Settings
          </Link>
          <Link href={`/app/business/${businessId}/insights`} className="px-3 py-1.5 rounded border border-app-strong text-sm text-app-strong hover:bg-surface-raised">
            Full Insights
          </Link>
        </div>
      </div>
    </div>
  );
}
