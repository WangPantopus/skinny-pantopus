'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { Gift, Trash2, MapPin, Navigation, Globe, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { CONDITIONS, CONDITION_LABELS } from '@pantopus/ui-utils';
import type { ListingDetail } from '@pantopus/types';
import LocationPicker, { type SelectedLocation } from '@/components/LocationPicker';
import { CategoryIcon } from '../../iconMap';
import { toast } from '@/components/ui/toast-store';
import { CATEGORIES } from '../../constants';

// ── Location sharing options ────────────────────────────────
type LocationMode = 'meetup' | 'neighborhood' | 'none' | 'exact';

const LOCATION_OPTIONS: { key: LocationMode; label: string; description: string; icon: typeof MapPin; precision: string }[] = [
  { key: 'meetup', label: 'Meetup area', description: 'Show an approximate pickup area', icon: MapPin, precision: 'approx_area' },
  { key: 'neighborhood', label: 'Neighborhood only', description: 'Show your neighborhood name, no pin', icon: Navigation, precision: 'neighborhood_only' },
  { key: 'none', label: 'Remote / Ship only', description: 'No location shown', icon: Globe, precision: 'none' },
  { key: 'exact', label: 'Exact address', description: 'Your exact location will be visible', icon: AlertTriangle, precision: 'exact_place' },
];

function precisionToLocationMode(precision: string | undefined): LocationMode {
  switch (precision) {
    case 'exact_place': return 'exact';
    case 'approx_area': return 'meetup';
    case 'neighborhood_only': return 'neighborhood';
    case 'none': return 'none';
    default: return 'meetup';
  }
}

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const listingId = params.id as string;

  // ── Page state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Form fields ─────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [price, setPrice] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [condition, setCondition] = useState('good');

  // ── Media ───────────────────────────────────────────────────
  const [existingMedia, setExistingMedia] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // ── Location ────────────────────────────────────────────────
  const [location, setLocation] = useState<SelectedLocation | null>(null);
  const [locationMode, setLocationMode] = useState<LocationMode>('meetup');

  // ── Load listing & guard owner ──────────────────────────────
  useEffect(() => {
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }

    (async () => {
      try {
        const [listingResult, userResult] = await Promise.all([
          api.listings.getListing(listingId),
          api.users.getMyProfile(),
        ]);

        const listing = ((listingResult as Record<string, any>)?.listing ?? listingResult) as ListingDetail;
        const user = userResult as { id?: string | number };

        // Guard: redirect if not the owner
        if (!listing || !user?.id || String(user.id) !== String(listing.user_id)) {
          router.replace(`/app/marketplace/${listingId}`);
          return;
        }

        // Pre-fill form
        setTitle(listing.title || '');
        setDescription(listing.description || '');
        setCategory(listing.category || 'other');
        setCondition(listing.condition || 'good');
        setIsFree(!!listing.is_free);
        setPrice(listing.price != null && !listing.is_free ? String(listing.price) : '');
        setExistingMedia(listing.media_urls || []);

        // Pre-fill location mode from stored precision
        setLocationMode(precisionToLocationMode(listing.location_precision));

        // Pre-fill location if available
        if (listing.latitude != null && listing.longitude != null) {
          setLocation({
            mode: 'address',
            latitude: listing.latitude,
            longitude: listing.longitude,
            address: listing.location_name || listing.location_address || '',
            city: null,
            state: null,
            zip: null,
            label: listing.location_name || listing.location_address || 'Listing location',
          });
        }
      } catch (err) {
        console.error('Failed to load listing for editing:', err);
        router.replace('/app/marketplace');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId]);

  // ── Save ────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    try {
      const data: Record<string, any> = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        condition,
        isFree,
      };

      if (!isFree && price) {
        data.price = parseFloat(price);
      } else if (isFree) {
        data.price = 0;
      }

      // Existing media that wasn't removed
      data.mediaUrls = existingMedia;

      // Location — respect the user's location mode choice
      const locOption = LOCATION_OPTIONS.find(o => o.key === locationMode);
      data.locationPrecision = locOption?.precision || 'approx_area';

      if ((locationMode === 'meetup' || locationMode === 'exact') && location) {
        data.latitude = location.latitude;
        data.longitude = location.longitude;
        data.locationName = location.label || location.address;
        data.locationAddress = location.address;
      } else {
        // Clear coordinates for neighborhood/none modes
        data.latitude = null;
        data.longitude = null;
      }

      await api.listings.updateListing(listingId, data);

      // Upload new media if any
      if (newFiles.length > 0) {
        await api.upload.uploadListingMedia(listingId, newFiles);
      }

      router.push(`/app/marketplace/${listingId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.listings.deleteListing(listingId);
      router.push('/app/marketplace');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete listing');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── Remove existing media thumbnail ─────────────────────────
  const removeExistingMedia = (idx: number) => {
    setExistingMedia(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Remove new file thumbnail ───────────────────────────────
  const removeNewFile = (idx: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const totalMedia = existingMedia.length + newFiles.length;

  // ── Loading state ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" />
          <p className="mt-4 text-app-text-secondary">Loading listing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-app-text-secondary hover:text-app-text"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className="text-xl font-semibold text-app-text">Edit Listing</h1>
          </div>
        </div>

        {/* ── Form ────────────────────────────────────────────── */}
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <div className="p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What are you listing?"
                className="w-full px-3 py-2.5 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details about your item..."
                rows={4}
                className="w-full px-3 py-2.5 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            {/* Category chips */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Category</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      category === c.key
                        ? 'bg-primary-600 text-white'
                        : 'bg-app-surface-sunken text-app-text-strong hover:bg-app-hover'
                    }`}
                  >
                    <CategoryIcon name={c.emoji} className="w-4 h-4 inline-block" /> {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price + Free toggle */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-app-text-strong">Price</label>
                <button
                  type="button"
                  onClick={() => setIsFree(!isFree)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium transition ${
                    isFree
                      ? 'bg-green-600 text-white'
                      : 'bg-green-50 text-green-700 border border-green-200'
                  }`}
                >
                  <Gift className="w-4 h-4 inline-block" /> Free
                </button>
              </div>
              {!isFree && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">$</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              )}
            </div>

            {/* Condition chips */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Condition</label>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCondition(key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                      condition === key
                        ? 'bg-primary-600 text-white'
                        : 'bg-app-surface-sunken text-app-text-strong hover:bg-app-hover'
                    }`}
                  >
                    {CONDITION_LABELS[key]}
                  </button>
                ))}
              </div>
            </div>

            {/* Location sharing mode */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">Location Sharing</label>
              <div className="space-y-1.5">
                {LOCATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setLocationMode(opt.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition ${
                      locationMode === opt.key
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : 'border-app-border hover:bg-app-hover'
                    }`}
                  >
                    <opt.icon className={`w-4 h-4 flex-shrink-0 ${
                      opt.key === 'exact' ? 'text-amber-500' : 'text-app-text-muted'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-app-text">{opt.label}</p>
                      <p className={`text-xs ${opt.key === 'exact' ? 'text-amber-600' : 'text-app-text-muted'}`}>
                        {opt.description}
                      </p>
                    </div>
                    <div className={`ml-auto w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      locationMode === opt.key
                        ? 'border-primary-600 bg-primary-600'
                        : 'border-gray-300'
                    }`}>
                      {locationMode === opt.key && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Show LocationPicker only for meetup/exact modes */}
              {(locationMode === 'meetup' || locationMode === 'exact') && (
                <div className="mt-3">
                  <LocationPicker value={location} onChange={setLocation} />
                </div>
              )}
            </div>

            {/* Media ──────────────────────────────────────────── */}
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-2">
                Photos / Videos ({totalMedia}/10)
              </label>
              <div className="flex flex-wrap gap-3">
                {/* Existing media thumbnails */}
                {existingMedia.map((url, i) => (
                  <div key={`existing-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden bg-app-surface-sunken border border-app-border">
                    <Image src={url} alt="" width={80} height={80} sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" quality={80} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingMedia(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* New file thumbnails */}
                {newFiles.map((file, i) => (
                  <div key={`new-${i}`} className="relative w-20 h-20 rounded-lg overflow-hidden bg-app-surface-sunken border border-app-border">
                    {/* unoptimized: local blob URL */}
                    <Image src={URL.createObjectURL(file)} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                    <button
                      type="button"
                      onClick={() => removeNewFile(i)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                    >
                      ×
                    </button>
                    {/* New badge */}
                    <span className="absolute bottom-0.5 left-0.5 px-1 py-0.5 bg-primary-600 text-white text-[9px] font-bold rounded">
                      NEW
                    </span>
                  </div>
                ))}

                {/* Add button */}
                {totalMedia < 10 && (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-app-border flex items-center justify-center cursor-pointer hover:border-gray-400 transition">
                    <svg className="w-6 h-6 text-app-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const maxNew = 10 - totalMedia;
                        setNewFiles(prev => [...prev, ...files.slice(0, maxNew)]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer actions ─────────────────────────────────── */}
          <div className="border-t border-app-border px-6 py-4 flex items-center justify-between">
            {/* Delete button */}
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-50 transition"
            >
              Delete Listing
            </button>

            {/* Save / Cancel */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2.5 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!title.trim() || saving}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Delete Confirmation Dialog ──────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-app-surface rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="mb-3 flex justify-center"><Trash2 className="w-10 h-10 text-red-500" /></div>
              <h3 className="text-lg font-semibold text-app-text mb-2">Delete this listing?</h3>
              <p className="text-sm text-app-text-secondary">
                This action cannot be undone. The listing and all its data will be permanently removed.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-app-border flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-app-border text-app-text-strong rounded-lg font-medium text-sm hover:bg-app-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
