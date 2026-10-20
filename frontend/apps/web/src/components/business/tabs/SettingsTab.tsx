import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { BusinessProfile } from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';

interface SettingsTabProps {
  businessId: string;
  profile: BusinessProfile;
  onUpdate: () => Promise<void>;
  /** Only an owner can close the business (DELETE /api/businesses/:id). */
  canClose?: boolean;
}

export default function SettingsTab({ businessId, profile, onUpdate, canClose = false }: SettingsTabProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Closing is how an owner retires a business, which personal account
  // deletion requires first. It asks for CLOSE, as Delete Home asks for DELETE.
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeConfirmText, setCloseConfirmText] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState('');

  const cancelClose = () => {
    setShowCloseConfirm(false);
    setCloseConfirmText('');
    setCloseError('');
  };

  const closeBusiness = async () => {
    if (closeConfirmText !== 'CLOSE' || closing) return;
    setClosing(true);
    setCloseError('');
    try {
      await api.businesses.deleteBusiness(businessId);
      router.replace('/app/businesses');
    } catch (e: unknown) {
      setCloseError(e instanceof Error && e.message ? e.message : 'Couldn’t close the business. Please try again.');
      setClosing(false);
    }
  };

  const togglePublish = async () => {
    // Unpublishing takes the page offline at once, so it asks first.
    if (profile?.is_published) {
      const ok = await confirmStore.open({
        title: 'Unpublish this page?',
        description: "Your page goes offline right away. Neighbors can't find or view it until you publish it again.",
        confirmLabel: 'Unpublish',
        cancelLabel: 'Cancel',
        variant: 'destructive',
      });
      if (!ok) return;
    }
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
              : 'bg-green-700 text-white hover:bg-green-800'
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

      {canClose && (
        <div className="bg-surface rounded-xl border border-app p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-red-700">Close business</div>
              <div className="text-sm text-app-secondary mt-1">
                Unpublishes the business and removes access for its entire team. Existing records are kept.
              </div>
            </div>
            {!showCloseConfirm && (
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                Close business
              </button>
            )}
          </div>
          {showCloseConfirm && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-xs text-red-700">You can&apos;t undo this in the app.</p>
              <div>
                <label htmlFor="close-business-confirm" className="block text-xs text-red-700 mb-1">Type CLOSE to confirm</label>
                <input
                  id="close-business-confirm"
                  value={closeConfirmText}
                  onChange={(e) => setCloseConfirmText(e.target.value.toUpperCase())}
                  disabled={closing}
                  className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono"
                  placeholder="CLOSE"
                  autoFocus
                />
              </div>
              {closeError && <p role="alert" className="text-sm text-red-700">{closeError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={closeBusiness}
                  disabled={closeConfirmText !== 'CLOSE' || closing}
                  className="px-3 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {closing ? 'Closing…' : 'Close business'}
                </button>
                <button
                  onClick={cancelClose}
                  disabled={closing}
                  className="px-3 py-1.5 border border-app text-app-secondary text-sm rounded-lg hover:bg-surface-raised disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
