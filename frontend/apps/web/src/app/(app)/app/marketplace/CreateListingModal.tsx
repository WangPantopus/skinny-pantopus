'use client';

import { useState, useEffect } from 'react';
import * as api from '@pantopus/api';
import { Wallet, Gift, Search, Home, Car, Wrench, MapPin, Globe, Navigation, AlertTriangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Image from 'next/image';
import { CATEGORIES, CONDITIONS, CONDITION_LABELS, LISTING_TYPE_TEMPLATES, type ListingTypeKey } from './constants';
import type { ListingCategory, ListingCondition, ListingLocationPrecision, ListingLayer, ListingType } from '@pantopus/types';
import { CategoryIcon } from './iconMap';
import { toast } from '@/components/ui/toast-store';
import { InlineDraftHelper } from '@/components/ai-assistant';
import { useListingDraft } from '@/hooks/useListingDraft';
import { getErrorMessage } from '@pantopus/utils';
import type { SnapSellListingBootstrap } from './snapSellTypes';

export type { SnapSellListingBootstrap };

interface CreateListingModalProps {
  onClose: () => void;
  onCreated: () => void;
  userLocation: { latitude: number; longitude: number } | null;
  userHomeId?: string | null;
  snapSellBootstrap?: SnapSellListingBootstrap | null;
  onSnapSellBootstrapConsumed?: () => void;
}

// ── Location sharing options ────────────────────────────────
type LocationMode = 'meetup' | 'neighborhood' | 'none' | 'exact';

const LOCATION_MODE_DEFAULTS: Record<string, LocationMode> = {
  sell_item: 'meetup',
  free_item: 'meetup',
  wanted_request: 'neighborhood',
  rent_sublet: 'meetup',
  vehicle_sale: 'meetup',
  vehicle_rent: 'meetup',
  service_gig: 'none',
};

const LOCATION_OPTIONS: { key: LocationMode; label: string; description: string; icon: LucideIcon; precision: string }[] = [
  { key: 'meetup', label: 'Meetup area', description: 'Show an approximate pickup area', icon: MapPin, precision: 'approx_area' },
  { key: 'neighborhood', label: 'Neighborhood only', description: 'Show your neighborhood name, no pin', icon: Navigation, precision: 'neighborhood_only' },
  { key: 'none', label: 'Remote / Ship only', description: 'No location shown', icon: Globe, precision: 'none' },
  { key: 'exact', label: 'Exact address', description: 'Your exact location will be visible', icon: AlertTriangle, precision: 'exact_place' },
];

const MEETUP_OPTIONS: { key: string; label: string }[] = [
  { key: 'porch_pickup', label: 'Porch Pickup' },
  { key: 'public_meetup', label: 'Public Meetup' },
  { key: 'flexible', label: 'Flexible' },
];

const TYPE_CARDS: { key: ListingTypeKey; label: string; icon: LucideIcon; description: string }[] = [
  { key: 'sell_item', label: 'Sell Item', icon: Wallet, description: 'List something for sale' },
  { key: 'free_item', label: 'Give Away', icon: Gift, description: 'Give something away for free' },
  { key: 'wanted_request', label: 'Wanted', icon: Search, description: 'Request something you need' },
  { key: 'rent_sublet', label: 'Rent / Sublet', icon: Home, description: 'Rent or sublet a space' },
  { key: 'vehicle_sale', label: 'Sell Vehicle', icon: Car, description: 'Sell a car, truck, or bike' },
  { key: 'vehicle_rent', label: 'Rent Vehicle', icon: Car, description: 'Rent out a car, truck, or bike' },
  { key: 'service_gig', label: 'Offer Service', icon: Wrench, description: 'Offer a skill or service' },
];

export default function CreateListingModal({
  onClose,
  onCreated,
  userLocation,
  userHomeId,
  snapSellBootstrap,
  onSnapSellBootstrapConsumed,
}: CreateListingModalProps) {
  // Step state
  const [step, setStep] = useState<'type' | 'form'>('type');
  const [selectedType, setSelectedType] = useState<ListingTypeKey | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('other');
  const [price, setPrice] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [condition, setCondition] = useState('good');
  const [files, setFiles] = useState<File[]>([]);
  const [isAddressAttached, setIsAddressAttached] = useState(false);
  const [locationMode, setLocationMode] = useState<LocationMode>('meetup');
  const [creating, setCreating] = useState(false);

  // New fields for mobile parity
  const [meetupPreference, setMeetupPreference] = useState('flexible');
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [openToTrades, setOpenToTrades] = useState(false);
  const [isNegotiable, setIsNegotiable] = useState(false);
  const [priceSuggestion, setPriceSuggestion] = useState<{ low: number; high: number } | null>(null);

  // Draft auto-save
  const { saveDraft, clearDraft, draft: existingDraft, hasDraft } = useListingDraft();

  const template = selectedType ? LISTING_TYPE_TEMPLATES[selectedType] : null;

  // Auto-save draft on field changes
  useEffect(() => {
    if (!title && !description) return;
    saveDraft({
      title, description, price, category, condition,
      meetupPreference, deliveryAvailable, openToTrades,
      isNegotiable, isAddressAttached,
    });
  }, [title, description, price, category, condition, meetupPreference, deliveryAvailable, openToTrades, isNegotiable, isAddressAttached, saveDraft]);

  // Restore draft on mount
  useEffect(() => {
    if (!hasDraft || !existingDraft) return;
    if (existingDraft.title) setTitle(existingDraft.title);
    if (existingDraft.description) setDescription(existingDraft.description);
    if (existingDraft.price) setPrice(existingDraft.price);
    if (existingDraft.category) setCategory(existingDraft.category);
    if (existingDraft.condition) setCondition(existingDraft.condition);
    if (existingDraft.meetupPreference) setMeetupPreference(existingDraft.meetupPreference);
    if (existingDraft.deliveryAvailable != null) setDeliveryAvailable(existingDraft.deliveryAvailable);
    if (existingDraft.openToTrades != null) setOpenToTrades(existingDraft.openToTrades);
    if (existingDraft.isNegotiable != null) setIsNegotiable(existingDraft.isNegotiable);
    if (existingDraft.title || existingDraft.description) setStep('form');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Prefill from AI draft (via sessionStorage bridge) ────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ai_listing_draft');
      if (!raw) return;
      sessionStorage.removeItem('ai_listing_draft');
      const draft = JSON.parse(raw);
      if (draft.title) setTitle(draft.title);
      if (draft.description) setDescription(draft.description);
      if (draft.price != null) setPrice(String(draft.price));
      if (draft.category) setCategory(draft.category);
      if (draft.condition) setCondition(draft.condition);
      // Skip to form step if we have content
      if (draft.title || draft.description) setStep('form');
    } catch { /* ignore parse errors */ }
  }, []);

  // Fetch price suggestion when category changes
  useEffect(() => {
    if (!category || category === 'other' || category === 'all') { setPriceSuggestion(null); return; }
    api.listings.getPriceSuggestion({
      category,
      lat: userLocation?.latitude,
      lng: userLocation?.longitude,
    }).then(({ suggestion }) => {
      if (suggestion) setPriceSuggestion({ low: suggestion.low, high: suggestion.high });
    }).catch(() => {});
  }, [category, userLocation?.latitude, userLocation?.longitude]);

  // Apply Snap & Sell (FAB) bootstrap once when parent passes it
  useEffect(() => {
    if (!snapSellBootstrap) return;
    const b = snapSellBootstrap;
    setFiles(b.files);
    if (b.title) setTitle(b.title);
    if (b.description) setDescription(b.description);
    if (b.category) setCategory(b.category);
    if (b.condition) setCondition(b.condition);
    if (b.price != null) setPrice(b.price);
    if (b.budgetMax != null) setBudgetMax(b.budgetMax);
    if (b.meetupPreference) setMeetupPreference(b.meetupPreference);
    if (b.deliveryAvailable != null) setDeliveryAvailable(b.deliveryAvailable);
    if (b.priceSuggestion !== undefined) setPriceSuggestion(b.priceSuggestion);
    if (b.listingType && b.listingType in LISTING_TYPE_TEMPLATES) {
      setSelectedType(b.listingType);
      if (b.listingType === 'vehicle_sale' || b.listingType === 'vehicle_rent') {
        setCategory('vehicles');
      }
      setLocationMode(LOCATION_MODE_DEFAULTS[b.listingType] || 'meetup');
    } else {
      setSelectedType(null);
    }
    setStep(b.needsTypeStep ? 'type' : 'form');
    onSnapSellBootstrapConsumed?.();
  }, [snapSellBootstrap, onSnapSellBootstrapConsumed]);

  const handleSelectType = (key: ListingTypeKey) => {
    setSelectedType(key);
    // Auto-set category for vehicles
    if (key === 'vehicle_sale' || key === 'vehicle_rent') {
      setCategory('vehicles');
    }
    // Set default location mode per listing type
    setLocationMode(LOCATION_MODE_DEFAULTS[key] || 'meetup');
    setStep('form');
  };

  const handleCreate = async () => {
    if (!title.trim() || !selectedType) return;
    setCreating(true);
    try {
      const locOption = LOCATION_OPTIONS.find(o => o.key === locationMode);
      const locPrecision = (locOption?.precision || 'approx_area') as ListingLocationPrecision;

      // Build location fields based on mode
      let latitude: number | undefined;
      let longitude: number | undefined;
      if ((locationMode === 'exact' || locationMode === 'meetup') && userLocation) {
        latitude = userLocation.latitude;
        longitude = userLocation.longitude;
      }

      const data: Parameters<typeof api.listings.createListing>[0] = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category as ListingCategory,
        condition: template?.requiresCondition ? (condition as ListingCondition) : undefined,
        listingType: selectedType as ListingType,
        layer: template?.layer as ListingLayer,
        isFree: selectedType === 'free_item',
        isWanted: selectedType === 'wanted_request',
        isAddressAttached,
        homeId: isAddressAttached ? (userHomeId ?? undefined) : undefined,
        locationPrecision: locPrecision,
        latitude,
        longitude,
        price: template?.requiresPrice && price ? parseFloat(price) : undefined,
        budgetMax: selectedType === 'wanted_request' && budgetMax ? parseFloat(budgetMax) : undefined,
        meetupPreference,
        deliveryAvailable,
        openToTrades,
        isNegotiable,
      } as any;

      const result = await api.listings.createListing(data);
      const newListing = result?.listing;

      let photosUploadFailed = false;
      if (newListing?.id && files.length > 0) {
        try {
          await api.upload.uploadListingMedia(newListing.id, files);
        } catch {
          photosUploadFailed = true;
        }
      }

      clearDraft();
      if (photosUploadFailed) {
        toast.warning('Listing created, but some photos failed to upload. You can add photos by editing the listing.');
      } else {
        toast.success('Your listing is live.');
      }
      onCreated();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[1000] flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-app-surface border-b border-app-border px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            {step === 'form' && (
              <button
                onClick={() => setStep('type')}
                className="text-app-text-muted hover:text-app-text-secondary"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-xl font-semibold text-app-text">
              {step === 'type' ? 'What would you like to do?' : template?.label || 'Create Listing'}
            </h2>
          </div>
          <button onClick={onClose} className="text-app-text-muted hover:text-app-text-secondary">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Choose type */}
        {step === 'type' && (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TYPE_CARDS.map((type) => (
              <button
                key={type.key}
                onClick={() => handleSelectType(type.key)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-app-border hover:border-primary-300 hover:bg-primary-50 transition text-center"
              >
                <type.icon className="w-8 h-8" />
                <span className="text-sm font-semibold text-app-text">{type.label}</span>
                <span className="text-[11px] text-app-text-secondary">{type.description}</span>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Form */}
        {step === 'form' && (
          <>
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1">Title *</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={selectedType === 'wanted_request' ? 'What are you looking for?' : 'What are you listing?'}
                  className="w-full px-3 py-2.5 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-app-text-strong">Description</label>
                  <InlineDraftHelper
                    mode="listing"
                    compact
                    seed={title}
                    context={{ listingType: selectedType || undefined, category, existingTitle: title || undefined }}
                    onDraft={(fields) => {
                      if (fields.title) setTitle(fields.title);
                      if (fields.description) setDescription(fields.description);
                      if (fields.price) setPrice(fields.price);
                    }}
                  />
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                />
              </div>

              {/* Category (for goods/vehicles) */}
              {(template?.layer === 'goods') && (
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.slice(1).map((c) => (
                      <button
                        key={c.key}
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
              )}

              {/* Price (for sell/rent/gig types) */}
              {template?.requiresPrice && (
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1">Price</label>
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
                  {priceSuggestion && (
                    <p className="text-xs text-app-text-muted mt-1">
                      Suggested: ${priceSuggestion.low}&ndash;${priceSuggestion.high}
                    </p>
                  )}
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={isNegotiable} onChange={(e) => setIsNegotiable(e.target.checked)} className="rounded text-primary-600" />
                    <span className="text-sm text-app-text-strong">Price is negotiable</span>
                  </label>
                </div>
              )}

              {/* Budget max (for wanted) */}
              {selectedType === 'wanted_request' && (
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1">Max Budget (optional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-muted text-sm">$</span>
                    <input
                      value={budgetMax}
                      onChange={(e) => setBudgetMax(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-app-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              )}

              {/* Condition (for goods/vehicles) */}
              {template?.requiresCondition && (
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Condition</label>
                  <div className="flex flex-wrap gap-2">
                    {CONDITIONS.map((key) => (
                      <button
                        key={key}
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
              )}

              {/* Meetup preference */}
              {template?.layer === 'goods' && (
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-2">Meetup Preference</label>
                  <div className="flex flex-wrap gap-2">
                    {MEETUP_OPTIONS.map((opt) => (
                      <button key={opt.key} type="button" onClick={() => setMeetupPreference(opt.key)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${meetupPreference === opt.key ? 'bg-primary-600 text-white' : 'bg-app-surface-sunken text-app-text-strong hover:bg-app-hover'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery + Trade toggles */}
              {template?.layer === 'goods' && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={deliveryAvailable} onChange={(e) => setDeliveryAvailable(e.target.checked)} className="rounded text-primary-600" />
                    <span className="text-sm text-app-text-strong">Delivery available</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={openToTrades} onChange={(e) => setOpenToTrades(e.target.checked)} className="rounded text-primary-600" />
                    <span className="text-sm text-app-text-strong">Open to trades / swaps</span>
                  </label>
                </div>
              )}

              {/* Address attachment toggle */}
              {userHomeId && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                  <div>
                    <p className="text-sm font-medium text-green-800">Attach to My Address</p>
                    <p className="text-xs text-green-600">Adds a &ldquo;Verified Neighbor&rdquo; badge to build trust</p>
                  </div>
                  <button
                    onClick={() => setIsAddressAttached(!isAddressAttached)}
                    className={`w-10 h-6 rounded-full transition relative ${
                      isAddressAttached ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-app-surface rounded-full shadow transition ${
                        isAddressAttached ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              )}

              {/* Location sharing */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">Location Sharing</label>
                <div className="space-y-1.5">
                  {LOCATION_OPTIONS.filter(opt => opt.key !== 'exact' || isAddressAttached).map((opt) => (
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
              </div>

              {/* Media upload */}
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-2">
                  Photos / Videos ({files.length}/10)
                </label>
                <div className="flex flex-wrap gap-3">
                  {files.map((file, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden bg-app-surface-sunken border border-app-border">
                      {/* unoptimized: local blob URL */}
                      <Image src={URL.createObjectURL(file)} alt="" width={80} height={80} className="w-full h-full object-cover" unoptimized />
                      <button
                        onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center hover:bg-black/80"
                      >
                        x
                      </button>
                    </div>
                  ))}
                  {files.length < 10 && (
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
                          const newFiles = Array.from(e.target.files || []);
                          setFiles(prev => [...prev, ...newFiles].slice(0, 10));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-app-surface border-t border-app-border px-6 py-4 flex gap-3 rounded-b-2xl">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-app-border text-app-text-strong rounded-lg hover:bg-app-hover font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!title.trim() || creating}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Listing'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
