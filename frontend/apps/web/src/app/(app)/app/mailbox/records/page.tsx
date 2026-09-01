'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { HomeAsset } from '@/types/mailbox';
import {
  useHomeAssets,
  useCreateAsset,
  useLinkMailToAsset,
} from '@/lib/mailbox-queries';
import { AssetCard } from '@/components/mailbox';

// ── Stub: home context ───────────────────────────────────────
function useHomeProfile() {
  return { homeId: 'home_1' };
}

// ── Room filter tabs ─────────────────────────────────────────
const ROOM_TABS = ['All', 'Living Room', 'Kitchen', 'Basement', 'Garage', 'Bedroom', 'Office'];

// ── AI Suggestion Banner ─────────────────────────────────────

type AiSuggestion = {
  name: string;
  model?: string;
  serial_masked?: string;
  category: HomeAsset['category'];
  room?: string;
  purchased_at?: string;
  warranty_years?: number;
  source_mail_id: string;
  source_sender: string;
};

function AiSuggestionPanel({
  suggestion,
  homeId,
  onAdded,
  onDismiss,
}: {
  suggestion: AiSuggestion;
  homeId: string;
  onAdded: (assetId: string) => void;
  onDismiss: () => void;
}) {
  const createAsset = useCreateAsset();
  const linkMail = useLinkMailToAsset();
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    setAdding(true);
    createAsset.mutate(
      {
        homeId,
        name: suggestion.name,
        category: suggestion.category,
        room: suggestion.room,
        manufacturer: suggestion.name.split(' ')[0],
        model_number: suggestion.model,
      },
      {
        onSuccess: (asset) => {
          // Also link the source mail
          linkMail.mutate(
            { assetId: asset.id, itemId: suggestion.source_mail_id, linkType: 'receipt' },
            { onSuccess: () => onAdded(asset.id) },
          );
        },
        onSettled: () => setAdding(false),
      },
    );
  }, [createAsset, linkMail, homeId, suggestion, onAdded]);

  const warrantyExpires = suggestion.purchased_at && suggestion.warranty_years
    ? new Date(new Date(suggestion.purchased_at).getFullYear() + suggestion.warranty_years,
        new Date(suggestion.purchased_at).getMonth(),
        new Date(suggestion.purchased_at).getDate()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="h-full overflow-y-auto bg-app-surface p-6">
      <div className="max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🏠</span>
          <h2 className="text-base font-semibold text-app-text">
            New Appliance Detected
          </h2>
        </div>

        <p className="text-xs text-app-text-secondary mb-4">
          From: {suggestion.source_sender}
        </p>

        <div className="border border-app-border rounded-xl p-4 space-y-3 mb-6">
          <p className="text-lg font-semibold text-app-text">
            {suggestion.name}
          </p>

          {(suggestion.model || suggestion.serial_masked) && (
            <p className="text-sm text-app-text-secondary">
              {suggestion.model && `Model ${suggestion.model}`}
              {suggestion.model && suggestion.serial_masked && ' · '}
              {suggestion.serial_masked && `Serial ${suggestion.serial_masked}`}
            </p>
          )}

          <div className="space-y-2 text-sm text-app-text-secondary dark:text-app-text-muted">
            <div className="flex items-center justify-between">
              <span className="text-app-text-secondary">Category</span>
              <span className="font-medium text-app-text">
                {suggestion.category.charAt(0).toUpperCase() + suggestion.category.slice(1)}
              </span>
            </div>

            {suggestion.room && (
              <div className="flex items-center justify-between">
                <span className="text-app-text-secondary">Room</span>
                <span className="font-medium text-app-text">
                  {suggestion.room} <span className="text-xs text-app-text-muted">(suggested)</span>
                </span>
              </div>
            )}

            {suggestion.purchased_at && (
              <div className="flex items-center justify-between">
                <span className="text-app-text-secondary">Purchased</span>
                <span className="font-medium text-app-text">
                  {new Date(suggestion.purchased_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </span>
              </div>
            )}

            {warrantyExpires && (
              <div className="flex items-center justify-between">
                <span className="text-app-text-secondary">Warranty</span>
                <span className="font-medium text-app-text">
                  {suggestion.warranty_years} year{suggestion.warranty_years !== 1 ? 's' : ''} — expires {warrantyExpires}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className={`w-full py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              adding
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {adding ? 'Adding...' : 'Add to Home Records'}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-2.5 text-sm font-medium text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Not an appliance
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Asset Manual Form ────────────────────────────────────

function AddAssetPanel({
  homeId,
  onCreated,
  onCancel,
}: {
  homeId: string;
  onCreated: (assetId: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<HomeAsset['category']>('appliance');
  const [room, setRoom] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const createAsset = useCreateAsset();

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return;
    createAsset.mutate(
      {
        homeId,
        name: name.trim(),
        category,
        room: room.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        model_number: modelNumber.trim() || undefined,
      },
      { onSuccess: (asset) => onCreated(asset.id) },
    );
  }, [name, category, room, manufacturer, modelNumber, homeId, createAsset, onCreated]);

  return (
    <div className="h-full overflow-y-auto bg-app-surface p-6">
      <h2 className="text-base font-semibold text-app-text mb-4">
        Add Asset
      </h2>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. Samsung 55" QLED TV'
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as HomeAsset['category'])}
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="appliance">Appliance</option>
            <option value="structure">Structure</option>
            <option value="system">System</option>
            <option value="vehicle">Vehicle</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Room</label>
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="e.g. Living Room"
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Manufacturer</label>
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="e.g. Samsung"
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="text-xs text-app-text-secondary mb-1 block">Model number</label>
          <input
            type="text"
            value={modelNumber}
            onChange={(e) => setModelNumber(e.target.value)}
            placeholder="e.g. QN55Q80C"
            className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createAsset.isPending || !name.trim()}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              createAsset.isPending || !name.trim()
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {createAsset.isPending ? 'Creating...' : 'Create Asset'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function MailRecordsPage() {
  const home = useHomeProfile();
  const router = useRouter();
  const { data: assets, isLoading } = useHomeAssets(home.homeId);

  const [roomFilter, setRoomFilter] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  // Check for AI suggestion from URL params (from mail item context)
  // In production: useSearchParams() to read suggestion data
  // For now: suggestion can be set programmatically

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    if (roomFilter === 'All') return assets;
    return assets.filter(a => a.room === roomFilter);
  }, [assets, roomFilter]);

  // Collect rooms from actual data
  const rooms = useMemo(() => {
    if (!assets) return ROOM_TABS;
    const assetRooms = new Set(assets.map(a => a.room).filter(Boolean) as string[]);
    return ['All', ...Array.from(assetRooms)];
  }, [assets]);

  const handleAssetClick = useCallback((asset: HomeAsset) => {
    router.push(`/app/mailbox/records/${asset.id}`);
  }, [router]);

  const handleAssetCreated = useCallback((assetId: string) => {
    setShowAddForm(false);
    setAiSuggestion(null);
    router.push(`/app/mailbox/records/${assetId}`);
  }, [router]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Room filter + Asset list ────────────────────── */}
      <div className="flex flex-col h-full flex-shrink-0 border-r border-app-border bg-app-surface w-full md:w-[360px]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <h1 className="text-base font-semibold text-app-text">
            Home Records
          </h1>
          <p className="text-xs text-app-text-secondary mt-0.5">
            {assets?.length || 0} asset{(assets?.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Room tabs */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-app-border-subtle flex-shrink-0 overflow-x-auto">
          {rooms.map((room) => (
            <button
              key={room}
              type="button"
              onClick={() => setRoomFilter(room)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                roomFilter === room
                  ? 'bg-primary-600 text-white'
                  : 'bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-700'
              }`}
            >
              {room}
            </button>
          ))}
        </div>

        {/* Asset list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="w-12 h-12 rounded-lg bg-app-surface-sunken animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-app-surface-sunken rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-app-surface-sunken rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <p className="text-sm text-app-text-secondary">No assets yet</p>
              <p className="text-xs text-app-text-muted mt-1">Add your first home asset</p>
            </div>
          ) : (
            <div className="p-3 space-y-1.5">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => handleAssetClick(asset)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add asset button */}
        <div className="px-3 py-3 border-t border-app-border-subtle flex-shrink-0">
          <button
            type="button"
            onClick={() => { setShowAddForm(true); setAiSuggestion(null); }}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-primary-600 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add asset manually
          </button>
        </div>
      </div>

      {/* ── Right: Detail panel ──────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-hidden hidden md:block">
        {aiSuggestion ? (
          <AiSuggestionPanel
            suggestion={aiSuggestion}
            homeId={home.homeId}
            onAdded={handleAssetCreated}
            onDismiss={() => setAiSuggestion(null)}
          />
        ) : showAddForm ? (
          <AddAssetPanel
            homeId={home.homeId}
            onCreated={handleAssetCreated}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <p className="text-sm text-app-text-secondary">Select an asset to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
