'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import {
  AlertCircle, ArrowLeft, ArrowRight, Calendar, ChefHat, ChevronDown, ChevronUp,
  Clock, Heart, Loader2, MapPin, Shield, ShoppingCart, Truck,
  Type, Users, Utensils, X,
} from 'lucide-react';
import type { GenerateSlotsPreset } from '@pantopus/types';
import ScheduleSection from '@/components/support-trains/ScheduleSection';
import WhereSection, {
  toSupportTrainDeliveryLocation,
  type HomeInfo,
  type LocationOption,
  type ResolvedLocation,
} from '@/components/support-trains/WhereSection';
import {
  PRESET_SLOT_DEFAULTS,
  normalizeGenerateSlotsPreset,
  buildSupportTrainGenerateSlotsPayload,
} from '@/components/support-trains/scheduleUtils';

// ============================================================
// CREATE SUPPORT TRAIN (Web) — Two-step single-page flow
// Step 1: Story input + support mode chips + optional location
// Step 2: Review editable cards + publish
// Mirrors mobile `support-trains/new.tsx` + `support-trains/review.tsx`.
// ============================================================

const SUPPORT_MODES = [
  { key: 'meal', label: 'Meals', icon: ChefHat },
  { key: 'groceries', label: 'Groceries', icon: ShoppingCart },
  { key: 'takeout', label: 'Takeout', icon: Truck },
  { key: 'gift_funds', label: 'Gift Funds', icon: Heart },
] as const;

const SHARING_MODES = [
  { key: 'private_link', label: 'Private link', desc: 'Anyone with the link can view' },
  { key: 'invited_only', label: 'Invited only', desc: 'Only people you invite' },
  { key: 'direct_share_only', label: 'Direct share', desc: 'Only people you share with directly' },
] as const;

const CUISINE_OPTIONS = [
  'American', 'BBQ', 'Breakfast / Brunch', 'Chinese', 'Comfort food', 'French', 'Greek',
  'Indian', 'Italian', 'Japanese', 'Korean', 'Mediterranean', 'Mexican', 'Middle Eastern',
  'Southeast Asian', 'Spanish', 'Thai', 'Vietnamese', 'Vegetarian', 'Vegan',
];

function cuisineKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '_');
}

type Step = 'story' | 'review';

type MissingField = { key: string; label: string; card: string };

// Homes API → HomeInfo
function homesFromApi(raw: any): HomeInfo[] {
  const homes = raw?.homes ?? [];
  return homes
    .map((h: any): HomeInfo | null => {
      const coords = h?.location?.coordinates;
      const hasCoords = Array.isArray(coords) && coords.length >= 2
        && Number.isFinite(coords[0]) && Number.isFinite(coords[1]);
      const lat = hasCoords ? coords[1] : NaN;
      const lng = hasCoords ? coords[0] : NaN;
      return {
        id: String(h?.id ?? ''),
        name: String(h?.name ?? h?.address ?? 'Home'),
        address: h?.address ?? undefined,
        city: h?.city ?? '',
        state: h?.state ?? '',
        latitude: lat,
        longitude: lng,
        hasLocation: hasCoords,
      };
    })
    .filter((h: HomeInfo | null): h is HomeInfo => !!h && !!h.id);
}

export default function NewSupportTrainPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('story');

  // ── Step 1 state ─────────────────────────────────────────────
  const [story, setStory] = useState('');
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  // ── Homes (for Where section) ────────────────────────────────
  const [homes, setHomes] = useState<HomeInfo[]>([]);
  useEffect(() => {
    if (!getAuthToken()) return;
    api.homes.getMyHomes()
      .then((res) => setHomes(homesFromApi(res)))
      .catch(() => {});
  }, []);

  // ── Step 2 state (initialized on draft) ──────────────────────
  const [draftData, setDraftData] = useState<any>({});
  const [summaryChips, setSummaryChips] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [draftStory, setDraftStory] = useState('');
  const [householdSize, setHouseholdSize] = useState('');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [restrictionInput, setRestrictionInput] = useState('');
  const [preferences, setPreferences] = useState<string[]>([]);
  const [contactless, setContactless] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [sharingMode, setSharingMode] = useState<string>('private_link');
  const [enableMeals, setEnableMeals] = useState(true);
  const [enableTakeout, setEnableTakeout] = useState(true);
  const [enableGroceries, setEnableGroceries] = useState(true);
  const [enableGiftFunds, setEnableGiftFunds] = useState(false);

  // Schedule
  const [schedulePreset, setSchedulePreset] = useState<GenerateSlotsPreset>('every_dinner');
  const [scheduleRangeStart, setScheduleRangeStart] = useState<Date>(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0); return d;
  });
  const [scheduleRangeEnd, setScheduleRangeEnd] = useState<Date>(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + 14); return d;
  });
  const [scheduleWeekdays, setScheduleWeekdays] = useState<boolean[]>(
    () => Array.from({ length: 7 }, () => false),
  );
  const [scheduleSlotStart, setScheduleSlotStart] = useState<string>('17:00');
  const [scheduleSlotEnd, setScheduleSlotEnd] = useState<string>('19:00');

  // Delivery location
  const [locationOption, setLocationOption] = useState<LocationOption>(null);
  const [resolvedLocation, setResolvedLocation] = useState<ResolvedLocation | null>(null);

  // UI
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // ── Computed: missing essentials ─────────────────────────────
  const computedMissingEssentials = useMemo<MissingField[]>(() => {
    const missing: MissingField[] = [];
    if (!title.trim()) missing.push({ key: 'title', label: 'Title', card: 'title' });
    if (!draftStory.trim()) missing.push({ key: 'recipient', label: "Who it's for", card: 'who' });
    if (!resolvedLocation) missing.push({ key: 'address', label: 'Delivery location', card: 'where' });
    const anyDow = scheduleWeekdays.some(Boolean);
    if (!anyDow) missing.push({ key: 'schedule_dow', label: 'Schedule days', card: 'schedule' });
    if (!scheduleSlotStart || !scheduleSlotEnd) {
      missing.push({ key: 'schedule_slot_time', label: 'Slot time window', card: 'schedule' });
    } else if (scheduleSlotStart >= scheduleSlotEnd) {
      missing.push({ key: 'schedule_time', label: 'Slot time window', card: 'schedule' });
    }
    return missing;
  }, [title, draftStory, resolvedLocation, scheduleWeekdays, scheduleSlotStart, scheduleSlotEnd]);

  const toggleMode = useCallback((mode: string) => {
    setSelectedModes((prev) => (prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]));
  }, []);

  const toggleCard = useCallback((card: string) => {
    setExpandedCard((prev) => (prev === card ? null : card));
  }, []);

  const addRestriction = useCallback(() => {
    const trimmed = restrictionInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (trimmed && !restrictions.includes(trimmed)) {
      setRestrictions((prev) => [...prev, trimmed]);
      setRestrictionInput('');
    }
  }, [restrictionInput, restrictions]);

  const toggleCuisine = useCallback((label: string) => {
    const key = cuisineKey(label);
    setPreferences((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }, []);

  // ── Apply the AI draft (or skip it) ──────────────────────────
  const applyDraft = useCallback(
    (d: any, chips: string[]) => {
      setDraftData(d);
      setSummaryChips(chips);
      setTitle(d.recipient_summary || d.story?.slice(0, 60) || '');
      setDraftStory(d.story || story);
      setHouseholdSize(d.household_size ? String(d.household_size) : '');
      setRestrictions(d.dietary_restrictions || []);
      setPreferences(d.dietary_preferences || []);
      setContactless(!!d.contactless_preferred);
      setSpecialInstructions(d.special_instructions || '');

      const preset = normalizeGenerateSlotsPreset(d.suggested_schedule);
      const def = PRESET_SLOT_DEFAULTS[preset];
      setSchedulePreset(preset);
      setScheduleSlotStart(def.start);
      setScheduleSlotEnd(def.end);

      const days = Number(d.suggested_duration_days) || 14;
      const start = new Date(); start.setHours(12, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + days);
      setScheduleRangeStart(start);
      setScheduleRangeEnd(end);

      setExpandedCard(null);
      setStep('review');
    },
    [story],
  );

  const handleDraft = useCallback(async () => {
    if (!getAuthToken()) { router.push('/login'); return; }
    if (story.trim().length < 10) return;
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await api.supportTrains.draftFromStory({
        story: story.trim(),
        support_modes_requested: selectedModes.length > 0 ? (selectedModes as any) : undefined,
      });
      applyDraft(result.draft || {}, result.summary_chips || []);
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate draft';
      if (msg.includes('AI_UNAVAILABLE') || msg.includes('AI_TIMEOUT')) {
        setDraftError('AI is temporarily unavailable. You can try again or create manually.');
      } else {
        setDraftError(msg);
      }
    } finally {
      setDrafting(false);
    }
  }, [story, selectedModes, router, applyDraft]);

  const handleManualCreate = useCallback(() => {
    applyDraft({ story: story.trim() }, []);
  }, [story, applyDraft]);

  // ── Publish ──────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    setPublishError(null);
    if (computedMissingEssentials.length > 0) {
      const first = computedMissingEssentials[0];
      setExpandedCard(first.card);
      setPublishError(`Please complete: ${first.label}`);
      return;
    }
    setPublishing(true);
    try {
      const delivery_location = toSupportTrainDeliveryLocation(resolvedLocation);

      const draftPayload = {
        ...draftData,
        story: draftStory,
        household_size: householdSize ? parseInt(householdSize, 10) : null,
        dietary_restrictions: restrictions,
        dietary_preferences: preferences,
        preferred_dropoff_window: scheduleSlotStart
          ? { start_time: scheduleSlotStart, end_time: scheduleSlotEnd || null }
          : null,
        contactless_preferred: contactless,
        special_instructions: specialInstructions || null,
        summary_chips: summaryChips,
      };

      const createResult = await api.supportTrains.createSupportTrain({
        draft_payload: draftPayload,
        title: title.trim(),
        sharing_mode: sharingMode as any,
        enable_home_cooked_meals: enableMeals,
        enable_takeout: enableTakeout,
        enable_groceries: enableGroceries,
        enable_gift_funds: enableGiftFunds,
        ...(delivery_location ? { delivery_location } : {}),
      });

      const trainId = createResult.support_train_id;

      await api.supportTrains.upsertRecipientProfile(trainId, {
        household_size: householdSize ? parseInt(householdSize, 10) : null,
        contactless_preferred: contactless,
        special_instructions: specialInstructions || null,
        allergies: restrictions,
        dietary_styles: preferences,
        preferred_dropoff_start_time: scheduleSlotStart || null,
        preferred_dropoff_end_time: scheduleSlotEnd || null,
      } as any);

      const slotPayload = buildSupportTrainGenerateSlotsPayload(
        schedulePreset,
        scheduleRangeStart,
        scheduleRangeEnd,
        scheduleWeekdays,
        scheduleSlotStart,
        scheduleSlotEnd,
      );
      await api.supportTrains.generateSlots(trainId, slotPayload);

      await api.supportTrains.publishSupportTrain(trainId);
      router.replace(`/app/support-trains/${trainId}`);
    } catch (err: any) {
      setPublishError(err?.message || 'Failed to publish. Please try again.');
    } finally {
      setPublishing(false);
    }
  }, [
    computedMissingEssentials, resolvedLocation, draftData, draftStory, householdSize,
    restrictions, preferences, scheduleSlotStart, scheduleSlotEnd, contactless, specialInstructions,
    summaryChips, title, sharingMode, enableMeals, enableTakeout, enableGroceries, enableGiftFunds,
    schedulePreset, scheduleRangeStart, scheduleRangeEnd, scheduleWeekdays, router,
  ]);

  // ─── Step 1: Story ───────────────────────────────────────────
  if (step === 'story') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button onClick={() => router.back()} className="text-sm text-app-text-secondary hover:text-app-text mb-6 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="text-3xl font-bold text-app-text mb-2">Start a Support Train</h1>
        <p className="text-app-text-secondary mb-8">
          What&apos;s happening, and what kind of support would help most right now?
        </p>

        <textarea
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="My sister just had a baby. Family of 4. Dinners for two weeks would really help. No peanuts. Contactless after 5pm."
          className="w-full h-40 p-4 bg-app-surface border border-app-border rounded-xl text-app-text placeholder:text-app-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          maxLength={2000}
        />
        <p className="text-xs text-app-text-muted text-right mt-1">{story.length}/2000</p>

        <p className="text-sm font-medium text-app-text-secondary mt-6 mb-3">Support types (optional)</p>
        <div className="flex flex-wrap gap-2 mb-8">
          {SUPPORT_MODES.map((m) => {
            const Icon = m.icon;
            const selected = selectedModes.includes(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMode(m.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition ${
                  selected
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-app-border text-app-text-secondary hover:border-primary-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                {m.label}
              </button>
            );
          })}
        </div>

        {draftError && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-700 dark:text-red-300 mb-3">{draftError}</p>
            <div className="flex gap-3">
              <button onClick={handleDraft} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700">Try Again</button>
              <button onClick={handleManualCreate} className="px-4 py-2 border border-app-border text-sm rounded-lg text-app-text-secondary hover:bg-app-surface-sunken">Edit Manually</button>
            </div>
          </div>
        )}

        <button
          onClick={handleDraft}
          disabled={drafting || story.trim().length < 10}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition"
        >
          {drafting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Continue</>}
        </button>
      </div>
    );
  }

  // ─── Step 2: Review ──────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <button onClick={() => setStep('story')} className="text-sm text-app-text-secondary hover:text-app-text mb-6 flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to story
      </button>

      <h1 className="text-3xl font-bold text-app-text mb-2">Review &amp; Publish</h1>

      {summaryChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 mb-6">
          {summaryChips.map((chip, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200">
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Missing essentials */}
      {computedMissingEssentials.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">Missing essentials</p>
          <div className="flex flex-wrap gap-2">
            {computedMissingEssentials.map((f) => (
              <button
                key={f.key}
                onClick={() => setExpandedCard(f.card)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition"
              >
                <AlertCircle className="w-3.5 h-3.5" /> {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-6">
        <Card title="Title *" icon={Type} expanded={expandedCard === 'title'} onToggle={() => toggleCard('title')}>
          <TextField value={title} onChange={setTitle} placeholder="Support Train title" maxLength={200} />
        </Card>

        <Card title="Who it's for *" icon={Users} expanded={expandedCard === 'who'} onToggle={() => toggleCard('who')}>
          <FieldLabel>Story</FieldLabel>
          <textarea
            value={draftStory}
            onChange={(e) => setDraftStory(e.target.value)}
            className="w-full p-3 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text resize-y h-24 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <FieldLabel>Household size</FieldLabel>
          <TextField value={householdSize} onChange={setHouseholdSize} placeholder="e.g. 4" type="number" />
        </Card>

        <Card title="Support types" icon={Heart} expanded={expandedCard === 'support'} onToggle={() => toggleCard('support')}>
          <ToggleRow label="Home-cooked meals" checked={enableMeals} onChange={setEnableMeals} />
          <ToggleRow label="Takeout / delivery" checked={enableTakeout} onChange={setEnableTakeout} />
          <ToggleRow label="Groceries" checked={enableGroceries} onChange={setEnableGroceries} />
          <ToggleRow label="Gift funds" checked={enableGiftFunds} onChange={setEnableGiftFunds} />
        </Card>

        <Card title="Schedule *" icon={Calendar} expanded={expandedCard === 'schedule'} onToggle={() => toggleCard('schedule')}>
          <ScheduleSection
            preset={schedulePreset}
            onPresetChange={setSchedulePreset}
            rangeStart={scheduleRangeStart}
            rangeEnd={scheduleRangeEnd}
            onRangeStartChange={setScheduleRangeStart}
            onRangeEndChange={setScheduleRangeEnd}
            weekdaysEnabled={scheduleWeekdays}
            onWeekdaysEnabledChange={setScheduleWeekdays}
            slotStart={scheduleSlotStart}
            slotEnd={scheduleSlotEnd}
            onSlotStartChange={setScheduleSlotStart}
            onSlotEndChange={setScheduleSlotEnd}
          />
        </Card>

        <Card title="Delivery location *" icon={MapPin} expanded={expandedCard === 'where'} onToggle={() => toggleCard('where')}>
          <WhereSection
            homes={homes}
            locationOption={locationOption}
            onLocationOptionChange={setLocationOption}
            resolvedLocation={resolvedLocation}
            onResolvedLocationChange={setResolvedLocation}
          />
        </Card>

        <Card title="Food preferences" icon={Utensils} expanded={expandedCard === 'food'} onToggle={() => toggleCard('food')}>
          <FieldLabel>Allergies / restrictions</FieldLabel>
          {restrictions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {restrictions.map((r) => (
                <span key={r} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 capitalize">
                  {r.replace(/_/g, ' ')}
                  <button onClick={() => setRestrictions((prev) => prev.filter((x) => x !== r))}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={restrictionInput}
              onChange={(e) => setRestrictionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRestriction())}
              className="flex-1 p-2.5 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Add restriction (e.g. nuts, dairy)"
            />
            <button onClick={addRestriction} className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">Add</button>
          </div>

          <FieldLabel>Preferences</FieldLabel>
          <p className="text-xs text-app-text-muted -mt-1 mb-2">Optional — pick a few cuisines to guide helpers.</p>
          <div className="flex flex-wrap gap-2">
            {CUISINE_OPTIONS.map((label) => {
              const key = cuisineKey(label);
              const selected = preferences.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => toggleCuisine(label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    selected
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-app-border text-app-text-secondary hover:border-primary-400'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Drop-off details" icon={Clock} expanded={expandedCard === 'dropoff'} onToggle={() => toggleCard('dropoff')}>
          <ToggleRow label="Contactless preferred" checked={contactless} onChange={setContactless} />
          <FieldLabel>Special instructions</FieldLabel>
          <textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="w-full p-3 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text resize-y h-20 focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Gate code, doorbell note, etc."
          />
        </Card>

        <Card title="Privacy & sharing" icon={Shield} expanded={expandedCard === 'privacy'} onToggle={() => toggleCard('privacy')}>
          <FieldLabel>Sharing mode</FieldLabel>
          <div className="space-y-2">
            {SHARING_MODES.map((s) => {
              const active = sharingMode === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSharingMode(s.key)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    active
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20'
                      : 'border-app-border hover:border-primary-300'
                  }`}
                >
                  <p className={`text-sm font-medium ${active ? 'text-primary-700 dark:text-primary-300' : 'text-app-text'}`}>{s.label}</p>
                  <p className="text-xs text-app-text-muted mt-0.5">{s.desc}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-app-text-muted mt-3 italic">
            Exact address stays hidden until an organizer chooses to share it with a signed-up helper.
          </p>
        </Card>
      </div>

      {publishError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          {publishError}
        </div>
      )}

      <button
        onClick={handlePublish}
        disabled={publishing}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition text-lg"
      >
        {publishing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publish Support Train'}
      </button>
    </div>
  );
}

// ─── Shared sub-components ──────────────────────────────────────

function Card({ title, icon: Icon, expanded, onToggle, children }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-app-surface border border-app-border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-4 hover:bg-app-surface-sunken transition">
        <Icon className="w-5 h-5 text-app-text-muted" />
        <span className="flex-1 text-left text-sm font-semibold text-app-text">{title}</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-app-text-muted" /> : <ChevronDown className="w-4 h-4 text-app-text-muted" />}
      </button>
      {expanded && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function TextField({ value, onChange, placeholder, maxLength, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; type?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      type={type}
      className="w-full p-2.5 bg-app-surface-sunken border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500"
    />
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider mt-2">{children}</p>;
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer">
      <span className="text-sm text-app-text">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-6 rounded-full transition relative ${checked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
        type="button"
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}
