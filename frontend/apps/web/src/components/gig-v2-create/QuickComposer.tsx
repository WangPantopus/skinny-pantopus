'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import * as api from '@pantopus/api';
import type { ScheduleType, MagicDraftResponse } from '@pantopus/types';

import TemplateChipsRow from './TemplateChipsRow';
import WhenChips from './WhenChips';
import WhereChips from './WhereChips';
import PaySelector from './PaySelector';
import DetailsAccordion from './DetailsAccordion';
import DeliveryModule, { isDeliveryCategory, type DeliveryData } from './DeliveryModule';
import ProServicesModule, { isProCategory, type ProServicesData } from './ProServicesModule';

const PLACEHOLDERS = [
  'I need someone to help me move a couch',
  'Walk my dog this afternoon',
  'Help me assemble IKEA furniture',
  'Need a ride to the airport tomorrow',
  'Fix a leaky faucet in my kitchen',
];

interface QuickComposerProps {
  onDraftReady: (response: MagicDraftResponse) => void;
  hasHome?: boolean;
}

export default function QuickComposer({ onDraftReady, hasHome = false }: QuickComposerProps) {
  // Core fields
  const [text, setText] = useState('');
  const [scheduleType, setScheduleType] = useState<ScheduleType>('asap');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);

  // Location
  const [locationMode, setLocationMode] = useState<'home' | 'current' | 'address'>('home');
  const [address, setAddress] = useState('');

  // Pay
  const [price, setPrice] = useState('');
  const [openToOffers, setOpenToOffers] = useState(false);

  // Engagement-mode modules
  const [detectedCategory, setDetectedCategory] = useState('');
  const [deliveryData, setDeliveryData] = useState<DeliveryData>({
    pickupAddress: '',
    pickupNotes: '',
    dropoffAddress: '',
    dropoffNotes: '',
    deliveryProofRequired: true,
    items: [],
  });
  const [proServicesData, setProServicesData] = useState<ProServicesData>({
    requiresLicense: false,
    licenseType: '',
    requiresInsurance: false,
    scopeDescription: '',
    depositRequired: false,
    depositAmount: '',
  });

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const placeholder = PLACEHOLDERS[Math.floor(Date.now() / 60000) % PLACEHOLDERS.length];

  const handleGo = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.magicTask.getMagicDraft({
        text: text.trim(),
        context: {
          locationMode: locationMode === 'address' ? 'address' : locationMode,
        },
      });
      onDraftReady(response);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: any) => {
    if (template.template.title) setText(template.template.title);
    if (template.template.schedule_type) setScheduleType(template.template.schedule_type);
    if (template.template.category) setDetectedCategory(template.template.category);
  };

  const canSubmit = text.trim().length > 0 && !loading;

  return (
    <div className="space-y-4">
      {/* Template chips */}
      <TemplateChipsRow onSelect={handleTemplateSelect} />

      {/* Magic text input */}
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          maxLength={2000}
          rows={4}
          className="w-full px-4 py-3.5 pr-12 border-2 border-app-border rounded-2xl text-base text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 resize-none min-h-[120px]"
        />
        <Sparkles className="absolute right-3.5 top-3.5 w-5 h-5 text-emerald-600" />
        {text.length > 0 && (
          <span className="absolute right-3.5 bottom-3 text-xs text-app-text-muted">
            {text.length}/2000
          </span>
        )}
      </div>

      {/* When */}
      <WhenChips
        value={scheduleType}
        onChange={setScheduleType}
        scheduledDate={scheduledDate}
        onScheduledDateChange={setScheduledDate}
      />

      {/* Where */}
      <WhereChips
        value={locationMode}
        onChange={setLocationMode}
        address={address}
        hasHome={hasHome}
        onAddressChange={setAddress}
      />

      {/* Delivery module (progressive disclosure) */}
      <DeliveryModule
        category={detectedCategory}
        data={deliveryData}
        onChange={setDeliveryData}
      />

      {/* Pro services module */}
      <ProServicesModule
        category={detectedCategory}
        data={proServicesData}
        onChange={setProServicesData}
      />

      {/* Optional details accordion */}
      <DetailsAccordion>
        <PaySelector
          price={price}
          onPriceChange={setPrice}
          openToOffers={openToOffers}
          onOpenToOffersChange={setOpenToOffers}
        />
      </DetailsAccordion>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Go button */}
      <button
        type="button"
        onClick={handleGo}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-semibold text-lg hover:bg-emerald-700 disabled:opacity-40 transition"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            Processing&hellip;
          </span>
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            Go
          </>
        )}
      </button>
    </div>
  );
}
