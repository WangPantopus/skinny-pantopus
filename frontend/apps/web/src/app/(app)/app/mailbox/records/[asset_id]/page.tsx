'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { MailItemV2 } from '@/types/mailbox';
import {
  useAssetFullDetail,
  useAddAssetPhoto,
  useLinkMailToAsset,
  useDrawerItems,
} from '@/lib/mailbox-queries';
import { GigCreationModal } from '@/components/mailbox';

// ── Stub: home context ───────────────────────────────────────
function useHomeProfile() {
  return { homeId: 'home_1', address: 'Camas, WA' };
}

// ── Category icons ───────────────────────────────────────────
const categoryIcons: Record<string, string> = {
  appliance: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  structure: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  vehicle: 'M8 17h.01M16 17h.01M7.5 10.5l1-4.5h7l1 4.5M5 14h14a2 2 0 012 2v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2a2 2 0 012-2z',
  other: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
};

const warrantyColors: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', label: 'Active' },
  expiring_soon: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', label: 'Expiring Soon' },
  expired: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', label: 'Expired' },
  none: { bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary dark:text-app-text-muted', label: 'None' },
};

// ── Link Mail Search Drawer ──────────────────────────────────

function LinkMailDrawer({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data } = useDrawerItems('home', { page: 1, limit: 50 });
  const linkMail = useLinkMailToAsset();

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search.trim()) return data.items.slice(0, 20);
    const q = search.toLowerCase();
    return data.items.filter(
      i =>
        (i.sender_display || '').toLowerCase().includes(q) ||
        (i.display_title || i.subject || '').toLowerCase().includes(q),
    ).slice(0, 20);
  }, [data, search]);

  const handleLink = useCallback((item: MailItemV2) => {
    linkMail.mutate(
      { assetId, itemId: item.id },
      { onSuccess: onClose },
    );
  }, [assetId, linkMail, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-sm bg-app-surface h-full flex flex-col border-l border-app-border">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <h3 className="text-sm font-semibold text-app-text flex-1">
            Link Mail Item
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-text-muted hover:text-app-text-secondary"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-app-border-subtle flex-shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mail items..."
            autoFocus
            className="w-full text-sm px-3 py-1.5 border border-app-border rounded-md bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <p className="px-4 py-8 text-sm text-app-text-muted text-center">No items found</p>
          ) : (
            <div className="py-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleLink(item)}
                  disabled={linkMail.isPending}
                  className="w-full text-left px-4 py-3 hover:bg-app-hover dark:hover:bg-gray-800 transition-colors border-b border-gray-50"
                >
                  <p className="text-sm font-medium text-app-text truncate">
                    {item.display_title || item.subject || 'Untitled'}
                  </p>
                  <p className="text-xs text-app-text-secondary mt-0.5">
                    {item.sender_display} · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function AssetDetailPage() {
  const params = useParams<{ asset_id?: string | string[] }>();
  const rawAssetId = params?.asset_id;
  const assetId = Array.isArray(rawAssetId) ? rawAssetId[0] || '' : rawAssetId || '';
  const home = useHomeProfile();
  const router = useRouter();
  const { data: fullDetail, isLoading } = useAssetFullDetail(assetId);
  const addPhoto = useAddAssetPhoto();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkDrawer, setShowLinkDrawer] = useState(false);
  const [showGigModal, setShowGigModal] = useState(false);

  const asset = fullDetail?.asset;
  const linkedMail = fullDetail?.mail || [];
  const linkedGigs = fullDetail?.gigs || [];
  const photos = fullDetail?.photos || [];

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    addPhoto.mutate({ assetId, file });
  }, [assetId, addPhoto]);

  const wStatus = asset ? warrantyColors[asset.warranty_status] || warrantyColors.none : warrantyColors.none;
  const iconPath = asset ? categoryIcons[asset.category] || categoryIcons.other : categoryIcons.other;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-app-text-secondary">Asset not found</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      {/* Back button (mobile) */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle md:hidden">
        <button
          type="button"
          onClick={() => router.push('/app/mailbox/records')}
          className="p-1 text-app-text-secondary hover:text-app-text-strong"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-app-text-strong">Back to Records</span>
      </div>

      <div className="p-6 max-w-2xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start gap-4 mb-6">
          {/* Icon or photo */}
          {photos.length > 0 ? (
            <img
              src={photos[0].url}
              alt={asset.name}
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
              </svg>
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-app-text">
              {asset.name}
            </h1>
            <p className="text-sm text-app-text-secondary mt-0.5">
              {asset.room || asset.category} · Since{' '}
              {new Date(asset.created_at).toLocaleDateString(undefined, {
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <span className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${wStatus.bg} ${wStatus.text}`}>
              Warranty {wStatus.label.toLowerCase()}
            </span>
          </div>
        </div>

        {/* ── Action buttons ─────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={addPhoto.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-app-text-secondary dark:text-app-text-muted border border-app-border rounded-lg hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
          >
            <span>📷</span>
            {addPhoto.isPending ? 'Uploading...' : 'Add photo'}
          </button>
          <button
            type="button"
            onClick={() => setShowGigModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-app-text-secondary dark:text-app-text-muted border border-app-border rounded-lg hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
          >
            <span>🤝</span>
            Post Gig
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>

        {/* ── Photos gallery ─────────────────────────────────── */}
        {photos.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              Photos
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.url}
                  alt={photo.caption || asset.name}
                  className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Warranty section ───────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
            Warranty
          </p>
          <div className={`px-3 py-2.5 rounded-lg border ${
            asset.warranty_status === 'active'
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20'
              : asset.warranty_status === 'expiring_soon'
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
                : 'border-app-border bg-app-surface-raised'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                asset.warranty_status === 'active' ? 'bg-green-500'
                  : asset.warranty_status === 'expiring_soon' ? 'bg-amber-500'
                    : asset.warranty_status === 'expired' ? 'bg-red-500'
                      : 'bg-gray-400'
              }`} />
              <span className="text-sm font-medium text-app-text">
                {wStatus.label}
                {asset.warranty_expires && ` · Expires ${new Date(asset.warranty_expires).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Asset details ──────────────────────────────────── */}
        {(asset.manufacturer || asset.model_number || asset.serial_number) && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              Details
            </p>
            <div className="space-y-1.5 text-sm">
              {asset.manufacturer && (
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">Manufacturer</span>
                  <span className="text-app-text">{asset.manufacturer}</span>
                </div>
              )}
              {asset.model_number && (
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">Model</span>
                  <span className="text-app-text">{asset.model_number}</span>
                </div>
              )}
              {asset.serial_number && (
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">Serial</span>
                  <span className="text-app-text">{asset.serial_number}</span>
                </div>
              )}
              {asset.purchased_at && (
                <div className="flex items-center justify-between">
                  <span className="text-app-text-secondary">Purchased</span>
                  <span className="text-app-text">
                    {new Date(asset.purchased_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Linked mail timeline ───────────────────────────── */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
            Linked Mail Timeline
          </p>
          {linkedMail.length === 0 ? (
            <p className="text-sm text-app-text-muted">No linked mail items yet</p>
          ) : (
            <div className="space-y-1">
              {linkedMail.map((mail) => {
                const icon = mail.mail_object_type === 'package' ? '📦'
                  : mail.category === 'document' || mail.category === 'legal' ? '📋'
                    : '✉️';
                return (
                  <a
                    key={mail.id}
                    href={`/app/mailbox/home/${mail.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
                  >
                    <span className="text-base flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-app-text truncate">
                        {mail.display_title || mail.subject || 'Untitled'}
                      </p>
                      <p className="text-xs text-app-text-muted">
                        {mail.sender_display} · {new Date(mail.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-app-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowLinkDrawer(true)}
            className="mt-2 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Link another mail item
          </button>
        </div>

        {/* ── Linked gigs ────────────────────────────────────── */}
        {linkedGigs.length > 0 && (
          <div className="mb-6">
            <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-2">
              Linked Gigs
            </p>
            <div className="space-y-1">
              {linkedGigs.map((gig) => (
                <div
                  key={gig.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-app-surface-raised"
                >
                  <span className="text-base flex-shrink-0">🤝</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-app-text truncate">
                      {gig.title}
                    </p>
                    <p className="text-xs text-app-text-muted">
                      {new Date(gig.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    gig.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : gig.status === 'active'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted'
                  }`}>
                    {gig.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Link Mail Drawer ─────────────────────────────────── */}
      {showLinkDrawer && (
        <LinkMailDrawer
          assetId={assetId}
          onClose={() => setShowLinkDrawer(false)}
        />
      )}

      {/* ── Gig Creation Modal ───────────────────────────────── */}
      {showGigModal && (
        <GigCreationModal
          source="post_delivery"
          packageTitle={asset.name}
          packageDescription={`${asset.category} — ${asset.manufacturer || ''} ${asset.model_number || ''}`.trim()}
          homeAddress={home.address}
          onGigCreated={() => setShowGigModal(false)}
          onClose={() => setShowGigModal(false)}
          createGig={async () => {
            // In production this would call the actual gig API
            return { gigId: `gig_${Date.now()}` };
          }}
        />
      )}
    </div>
  );
}
