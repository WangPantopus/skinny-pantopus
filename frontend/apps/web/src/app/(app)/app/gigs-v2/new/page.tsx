'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { GIG_CATEGORIES } from '@pantopus/ui-utils';
import { PRO_CATEGORIES } from '@pantopus/types';
import LocationPicker, { type SelectedLocation } from '@/components/LocationPicker';
import { toast } from '@/components/ui/toast-store';
import type {
  ScheduleType,
  MagicDraftResponse,
  MagicTaskDraft,
  MagicPostResponse,
  SmartTemplate,
  TaskArchetype,
} from '@pantopus/types';

// V2 creation modules
import ArchetypeChips from '@/components/gig-v2-create/ArchetypeChips';
import CareModule, { isCareCategory, type CareData } from '@/components/gig-v2-create/CareModule';
import DeliveryModule, { isDeliveryCategory, type DeliveryData } from '@/components/gig-v2-create/DeliveryModule';
import EventModule, { type EventData } from '@/components/gig-v2-create/EventModule';
import LogisticsModule, { type LogisticsData } from '@/components/gig-v2-create/LogisticsModule';
import ProServicesModule, { isProCategory, type ProServicesData } from '@/components/gig-v2-create/ProServicesModule';
import RemoteModule, { type RemoteData } from '@/components/gig-v2-create/RemoteModule';
import UrgentModule, { type UrgentData } from '@/components/gig-v2-create/UrgentModule';

// ─── Constants ───────────────────────────────────────────────────────

const SCHEDULE_OPTIONS: { value: ScheduleType; label: string; icon: string }[] = [
  { value: 'asap', label: 'Now', icon: '⚡' },
  { value: 'today', label: 'Today', icon: '📅' },
  { value: 'scheduled', label: 'Schedule', icon: '🗓️' },
  { value: 'flexible', label: 'Flexible', icon: '🤷' },
];

const PAY_PRESETS = [20, 40, 60];

const ENGAGEMENT_LABELS: Record<string, { icon: string; label: string }> = {
  instant_accept: { icon: '⚡', label: 'Instant Accept' },
  curated_offers: { icon: '📋', label: 'Offers' },
  quotes: { icon: '💼', label: 'Quotes' },
};

const ALL_CATEGORIES = ['General', ...GIG_CATEGORIES];

function inferEngagementMode(category: string, scheduleType: ScheduleType): string {
  const isPro = PRO_CATEGORIES.some(c => c.toLowerCase() === (category || '').toLowerCase());
  if (isPro) return 'quotes';
  if (scheduleType === 'asap') return 'instant_accept';
  return 'curated_offers';
}

// ─── Undo Toast ──────────────────────────────────────────────────────

function UndoToast({
  gigId,
  undoWindowMs,
  onUndone,
}: {
  gigId: string;
  undoWindowMs: number;
  onUndone: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'countdown' | 'notifying'>('countdown');
  const [undoing, setUndoing] = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.max(0, 100 - (elapsed / undoWindowMs) * 100);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(interval);
        setPhase('notifying');
      }
    }, 50);
    return () => clearInterval(interval);
  }, [undoWindowMs]);

  useEffect(() => {
    if (phase !== 'notifying') return;
    const t = setTimeout(() => router.push(`/app/gigs-v2/${gigId}`), 2000);
    return () => clearTimeout(t);
  }, [phase, gigId, router]);

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      await api.magicTask.undoTask(gigId);
      onUndone();
    } catch {
      router.push(`/app/gigs-v2/${gigId}`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-xl bg-gray-900 rounded-t-xl px-6 pt-4 pb-6 shadow-2xl">
        {phase === 'notifying' ? (
          <p className="text-white font-semibold text-center">✓ Top matches being notified</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold">Task posted!</span>
              <button
                onClick={handleUndo}
                disabled={undoing}
                className="px-4 py-1.5 text-sm font-semibold text-blue-400 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {undoing ? 'Undoing…' : 'Undo'}
              </button>
            </div>
            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────────────────

type Screen = 'composer' | 'posted';

function QuickComposerContent() {
  const router = useRouter();

  // ── Auth check ──
  useEffect(() => {
    if (!getAuthToken()) router.push('/login');
  }, [router]);

  // ── Screen state ──
  const [screen, setScreen] = useState<Screen>('composer');

  // ── Composer fields ──
  const [text, setText] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('asap');
  const [scheduledDate, setScheduledDate] = useState('');
  const [price, setPrice] = useState('');
  const [openToOffers, setOpenToOffers] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);

  // ── Templates ──
  const [templates, setTemplates] = useState<SmartTemplate[]>([]);

  useEffect(() => {
    api.magicTask.getTemplateLibrary()
      .then(res => setTemplates(res.templates || []))
      .catch(() => {});
  }, []);

  // ── Archetype & module state ──
  const [archetypeOverride, setArchetypeOverride] = useState<TaskArchetype | null>(null);
  const [deliveryData, setDeliveryData] = useState<DeliveryData>({
    pickupAddress: '', pickupNotes: '', dropoffAddress: '', dropoffNotes: '',
    deliveryProofRequired: false, items: [],
  });
  const [proServicesData, setProServicesData] = useState<ProServicesData>({
    requiresLicense: false, licenseType: '', requiresInsurance: false,
    scopeDescription: '', depositRequired: false, depositAmount: '',
  });
  const [careData, setCareData] = useState<CareData>({
    careType: 'child', agesOrDetails: '', count: 1, specialNeeds: '',
    languagePreference: '', preferredHelperId: null, emergencyNotes: '',
  });
  const [logisticsData, setLogisticsData] = useState<LogisticsData>({
    workerCount: 1, vehicleNeeded: false, vehicleType: '', toolsNeeded: [],
    accessInstructions: '', petsOnProperty: false, stairsInfo: 'none', heavyLifting: false,
  });
  const [remoteData, setRemoteData] = useState<RemoteData>({
    deliverableType: 'document', fileFormat: '', revisionCount: 1,
    timezone: '', meetingRequired: false, dueDate: null,
  });
  const [eventData, setEventData] = useState<EventData>({
    eventType: 'party', guestCount: null, shiftStart: null, shiftEnd: null,
    dressCode: '', roleType: 'general', venueDetails: '',
  });
  const [urgentData, setUrgentData] = useState<UrgentData>({
    responseWindowMinutes: 15, fulfillmentMode: 'come_here',
    shareLocationDuringTask: false, roadsideVehicleNotes: '',
  });

  // ── Draft state ──
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftResponse, setDraftResponse] = useState<MagicDraftResponse | null>(null);
  const [draftCategory, setDraftCategory] = useState('');
  const [engagementMode, setEngagementMode] = useState('curated_offers');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  // ── Post state ──
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [postResult, setPostResult] = useState<MagicPostResponse | null>(null);

  // ── Handlers ──

  const handleGo = async () => {
    if (!text.trim()) return;
    setDrafting(true);
    setDraftError('');
    try {
      const response = await api.magicTask.getMagicDraft({
        text: text.trim(),
        context: {
          locationMode:
            selectedLocation?.mode === 'address' || selectedLocation?.mode === 'custom'
              ? 'address'
            : selectedLocation?.mode || 'home',
          ...(price && !openToOffers ? { budget: Number(price) } : {}),
        },
      });
      setDraftResponse(response);
      setDraftCategory(response.draft.category || '');
      setEngagementMode(
        inferEngagementMode(response.draft.category, response.draft.schedule_type)
      );
    } catch (err: any) {
      setDraftError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setDrafting(false);
    }
  };

  // ── Derived module visibility (matches mobile logic) ──
  const inferredArchetype = (draftResponse?.draft?.task_archetype || 'general') as TaskArchetype;
  const activeArchetype = archetypeOverride || inferredArchetype;
  const showDelivery = activeArchetype === 'delivery_errand' || (!archetypeOverride && isDeliveryCategory(draftCategory));
  const showProServices = activeArchetype === 'pro_service_quote' || (!archetypeOverride && isProCategory(draftCategory));
  const showCare = activeArchetype === 'care_task' || (!archetypeOverride && isCareCategory(draftCategory));
  const showLogistics = activeArchetype === 'home_service' || activeArchetype === 'pro_service_quote' || activeArchetype === 'event_shift';
  const showRemote = activeArchetype === 'remote_task';
  const showEvent = activeArchetype === 'event_shift';
  const showUrgent = scheduleType === 'asap';

  const handlePost = async () => {
    if (!draftResponse) return;
    const draft = draftResponse.draft;

    const locationOptional = activeArchetype === 'remote_task';
    if (!locationOptional && !selectedLocation?.address) {
      setPostError('Please select a location before posting.');
      return;
    }

    setPosting(true);
    setPostError('');
    try {
      // Merge user's overrides (schedule, price, category) into the AI draft
      const mergedDraft: Record<string, any> = {
        ...draft,
        category: draftCategory,
        schedule_type: scheduleType,
        ...(scheduleType === 'scheduled' && scheduledDate
          ? { time_window_start: new Date(scheduledDate).toISOString() }
          : {}),
        ...(price && !openToOffers ? { budget_fixed: Number(price), pay_type: 'fixed' } : {}),
        ...(openToOffers ? { pay_type: 'offers' } : {}),
      };

      // Override archetype if user selected one
      if (archetypeOverride) {
        mergedDraft.task_archetype = archetypeOverride;
      }

      // Merge engagement-mode module data
      if (showDelivery) {
        mergedDraft.pickup_address = deliveryData.pickupAddress || null;
        mergedDraft.pickup_notes = deliveryData.pickupNotes || null;
        mergedDraft.dropoff_address = deliveryData.dropoffAddress || null;
        mergedDraft.dropoff_notes = deliveryData.dropoffNotes || null;
        mergedDraft.delivery_proof_required = deliveryData.deliveryProofRequired;
        if (deliveryData.items.length > 0) mergedDraft.items = deliveryData.items;
      }
      if (showProServices) {
        mergedDraft.requires_license = proServicesData.requiresLicense;
        mergedDraft.license_type = proServicesData.licenseType || null;
        mergedDraft.requires_insurance = proServicesData.requiresInsurance;
        mergedDraft.scope_description = proServicesData.scopeDescription || null;
        mergedDraft.deposit_required = proServicesData.depositRequired;
        mergedDraft.deposit_amount = proServicesData.depositAmount ? parseFloat(proServicesData.depositAmount) : null;
      }
      if (showCare) mergedDraft.care_details = careData;
      if (showLogistics) mergedDraft.logistics_details = logisticsData;
      if (showRemote) mergedDraft.remote_details = remoteData;
      if (showEvent) mergedDraft.event_details = eventData;
      if (showUrgent) {
        mergedDraft.starts_asap = true;
        mergedDraft.response_window_minutes = urgentData.responseWindowMinutes;
        mergedDraft.urgent_details = urgentData;
        mergedDraft.is_urgent = true;
      }

      // Determine engagement mode
      let finalEngagement = engagementMode;
      if (showProServices) finalEngagement = 'quotes';
      if (showUrgent) finalEngagement = 'instant_accept';

      const result = await api.magicTask.magicPost({
        text,
        draft: mergedDraft as any,
        location: selectedLocation ? {
          mode: selectedLocation.mode === 'custom' ? 'custom' : selectedLocation.mode,
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          address: selectedLocation.address,
          city: selectedLocation.city,
          state: selectedLocation.state,
          zip: selectedLocation.zip,
          homeId: selectedLocation.homeId,
          place_id: selectedLocation.place_id,
        } : undefined,
        source_flow: 'magic',
        engagement_mode: finalEngagement as any,
        ai_confidence: draftResponse.confidence,
      });
      setPostResult(result);
      setScreen('posted');
    } catch (err: any) {
      setPostError(err?.message || 'Failed to post task. Please try again.');
      setPosting(false);
    }
  };

  const handleEditDetails = () => {
    if (!draftResponse) return;
    const draft = draftResponse.draft;
    const prefill = JSON.stringify({
      title: draft.title,
      description: draft.description,
      price: draft.budget_fixed || draft.hourly_rate || '',
      category: draftCategory,
      tags: draft.tags?.join(',') || '',
      ...(selectedLocation ? {
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: selectedLocation.address,
        city: selectedLocation.city || null,
        state: selectedLocation.state || null,
        zip: selectedLocation.zip || null,
        mode: selectedLocation.mode,
        homeId: selectedLocation.homeId || null,
        place_id: selectedLocation.place_id || null,
      } : {}),
    });
    router.push(`/app/gigs/new?prefill=${encodeURIComponent(prefill)}`);
  };

  const handleTemplateSelect = (t: SmartTemplate) => {
    if (t.template.title) setText(t.template.title);
    if (t.template.schedule_type) setScheduleType(t.template.schedule_type);
  };

  const cycleEngagement = () => {
    const modes = ['instant_accept', 'curated_offers', 'quotes'] as const;
    const idx = modes.indexOf(engagementMode as any);
    setEngagementMode(modes[(idx + 1) % modes.length]);
  };

  const handleUndone = useCallback(() => {
    setPostResult(null);
    setDraftResponse(null);
    setText('');
    setScreen('composer');
    toast.success('Task undone');
  }, []);

  const draft = draftResponse?.draft;
  const payLabel = (() => {
    // User-set price takes priority
    if (price && !openToOffers) return `$${price}`;
    if (openToOffers) return 'Open to offers';
    if (!draft) return '';
    // AI draft values
    if (draft.pay_type === 'hourly' && draft.hourly_rate) return `$${draft.hourly_rate}/hr`;
    if (draft.pay_type === 'fixed' && draft.budget_fixed) return `$${draft.budget_fixed}`;
    // AI-suggested range
    if (draft.budget_range) return `$${draft.budget_range.min}–$${draft.budget_range.max}`;
    return 'Open to offers';
  })();
  const engInfo = ENGAGEMENT_LABELS[engagementMode] || ENGAGEMENT_LABELS.curated_offers;
  const scheduleLabel = draft
    ? SCHEDULE_OPTIONS.find(s => s.value === scheduleType)
    : null;

  // ── Posted screen ──
  if (screen === 'posted' && postResult) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <UndoToast
          gigId={postResult.gig.id}
          undoWindowMs={postResult.gig.undo_window_ms ?? 10000}
          onUndone={handleUndone}
        />
      </div>
    );
  }

  // ── Composer + Preview ──
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-app-text">Quick Post</h1>
        <p className="text-app-text-secondary text-sm mt-1">
          Describe what you need in one sentence — AI handles the rest
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Left: Composer (~60%) ── */}
        <div className="flex-1 lg:max-w-[60%] space-y-5">
          {/* Template chips */}
          {templates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateSelect(t)}
                  className="px-3 py-1.5 text-sm rounded-full border border-app-border hover:border-primary-400 hover:bg-primary-50 transition-colors"
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          )}

          {/* Magic text input */}
          <div className="relative">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              disabled={drafting}
              placeholder="e.g. I need someone to help me move a couch this Saturday…"
              rows={4}
              className="w-full rounded-xl border border-app-border bg-white px-4 py-3 text-base resize-none focus:ring-2 focus:ring-primary-400 focus:border-transparent disabled:opacity-60 placeholder:text-gray-400"
            />
            <div className="absolute top-3 right-3 text-primary-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2L12.09 8.26L18.18 8.97L13.54 13.14L14.81 19.02L10 16.27L5.19 19.02L6.46 13.14L1.82 8.97L7.91 8.26L10 2Z" />
              </svg>
            </div>
          </div>

          {/* When chips */}
          <div>
            <label className="block text-sm font-medium text-app-text-secondary mb-2">When</label>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScheduleType(opt.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    scheduleType === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
            {scheduleType === 'scheduled' && (
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={e => setScheduledDate(e.target.value)}
                className="mt-2 rounded-lg border border-app-border px-3 py-2 text-sm"
              />
            )}
          </div>

          {/* Where */}
          <div>
            <label className="block text-sm font-medium text-app-text-secondary mb-2">Where</label>
            <LocationPicker value={selectedLocation} onChange={setSelectedLocation} />
          </div>

          {/* Budget (optional) */}
          <div>
            <label className="block text-sm font-medium text-app-text-secondary mb-2">
              Budget <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              {PAY_PRESETS.map(amt => (
                <button
                  key={amt}
                  onClick={() => { setPrice(String(amt)); setOpenToOffers(false); }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    price === String(amt) && !openToOffers
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <input
                type="number"
                placeholder="Custom"
                value={openToOffers ? '' : price}
                onChange={e => { setPrice(e.target.value); setOpenToOffers(false); }}
                className="w-24 rounded-full border border-app-border px-3 py-2 text-sm"
              />
              <button
                onClick={() => { setOpenToOffers(!openToOffers); if (!openToOffers) setPrice(''); }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  openToOffers
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Open to offers
              </button>
            </div>
            {!price && !openToOffers && (
              <p className="text-xs text-gray-400 mt-1.5">Leave empty and AI will suggest a price range</p>
            )}
          </div>

          {/* Archetype selection (after draft ready) */}
          {draftResponse && (
            <ArchetypeChips
              inferredArchetype={inferredArchetype}
              selectedArchetype={archetypeOverride}
              onSelect={setArchetypeOverride}
            />
          )}

          {/* Engagement-mode-specific modules (progressive disclosure) */}
          {draftResponse && (
            <div className="space-y-4">
              {showDelivery && (
                <DeliveryModule category={draftCategory} data={deliveryData} onChange={setDeliveryData} />
              )}
              {showProServices && (
                <ProServicesModule category={draftCategory} data={proServicesData} onChange={setProServicesData} />
              )}
              {showCare && (
                <CareModule category={draftCategory} data={careData} onChange={setCareData} />
              )}
              {showLogistics && (
                <LogisticsModule data={logisticsData} onChange={setLogisticsData} />
              )}
              {showRemote && (
                <RemoteModule data={remoteData} onChange={setRemoteData} />
              )}
              {showEvent && (
                <EventModule data={eventData} onChange={setEventData} />
              )}
              {showUrgent && (
                <UrgentModule data={urgentData} onChange={setUrgentData} />
              )}
            </div>
          )}

          {/* Go button */}
          <button
            onClick={handleGo}
            disabled={!text.trim() || drafting}
            className="w-full flex items-center justify-center gap-2 bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
          >
            {drafting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                Drafting…
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2L12.09 8.26L18.18 8.97L13.54 13.14L14.81 19.02L10 16.27L5.19 19.02L6.46 13.14L1.82 8.97L7.91 8.26L10 2Z" />
                </svg>
                Go
              </>
            )}
          </button>

          {draftError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {draftError}
            </div>
          )}
        </div>

        {/* ── Right: Live Preview (~40%) ── */}
        <div className="lg:w-[40%] lg:min-w-[340px]">
          {draft ? (
            <div className="sticky top-8 space-y-4">
              <div className="bg-white border border-app-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Preview</h3>

                <h2 className="text-xl font-bold text-gray-900 mb-2">{draft.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-4">{draft.description}</p>

                {/* Chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Category chip — clickable */}
                  <div className="relative">
                    <button
                      onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                      className="px-3 py-1 rounded-full text-sm font-medium border border-primary-500 text-primary-600 hover:bg-primary-50"
                    >
                      {draftCategory || 'Category'}
                    </button>
                    {showCategoryPicker && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto w-48">
                        {ALL_CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            onClick={() => {
                              setDraftCategory(cat);
                              setEngagementMode(inferEngagementMode(cat, draft.schedule_type));
                              setShowCategoryPicker(false);
                            }}
                            className={`block w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                              cat === draftCategory ? 'font-semibold text-primary-600' : 'text-gray-700'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {scheduleLabel && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                      {scheduleLabel.icon} {scheduleLabel.label}
                    </span>
                  )}

                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                    {payLabel}
                  </span>
                </div>

                {/* Engagement mode */}
                <button
                  onClick={cycleEngagement}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 mb-3"
                >
                  {engInfo.icon} {engInfo.label}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>

                {/* Privacy note */}
                <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Exact address shared after someone is accepted
                </div>
              </div>

              {postError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {postError}
                </div>
              )}

              {/* CTAs */}
              <button
                onClick={handlePost}
                disabled={posting}
                className="w-full bg-primary-600 text-white py-3.5 rounded-xl font-semibold text-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {posting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Posting…
                  </span>
                ) : (
                  'Post'
                )}
              </button>

              <button
                onClick={handleEditDetails}
                className="w-full py-3 rounded-xl font-semibold text-primary-600 border border-primary-500 hover:bg-primary-50 transition-colors"
              >
                Edit details
              </button>
            </div>
          ) : (
            <div className="sticky top-8 bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">✨</div>
              <p className="text-gray-500 text-sm">
                Type what you need and tap <strong>Go</strong> — your draft will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page Export ──────────────────────────────────────────────────────

export default function QuickComposerPage() {
  return (
    <Suspense>
      <QuickComposerContent />
    </Suspense>
  );
}
