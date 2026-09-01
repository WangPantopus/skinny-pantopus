'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useCallback, type ReactNode } from 'react';
import { Package, Home, PenLine, MessageCircle } from 'lucide-react';

type GigCreationModalProps = {
  source: 'post_delivery' | 'pre_delivery';
  packageTitle: string;
  packageDescription?: string;
  deliveryEta?: string;
  homeAddress?: string;
  photoUrl?: string;
  /** Nearby verified neighbors (for pre-delivery) */
  neighbors?: { userId: string; name: string; distance: string }[];
  onGigCreated: (gigId: string) => void;
  onClose: () => void;
  /** Creates the gig via API */
  createGig: (data: {
    gigType: string;
    title: string;
    description: string;
    compensation?: number;
    suggestedStart?: string;
  }) => Promise<{ gigId: string }>;
};

const REQUEST_TYPES: { value: string; label: string; icon: ReactNode }[] = [
  { value: 'hold', label: 'Hold package', icon: <Package className="w-4 h-4" /> },
  { value: 'inside', label: 'Bring inside', icon: <Home className="w-4 h-4" /> },
  { value: 'sign', label: 'Sign for it', icon: <PenLine className="w-4 h-4" /> },
  { value: 'custom', label: 'Custom request', icon: <MessageCircle className="w-4 h-4" /> },
];

const SUGGESTED_AMOUNTS = [5, 10, 15, 20];

export default function GigCreationModal({
  source,
  packageTitle,
  packageDescription,
  deliveryEta,
  homeAddress,
  photoUrl,
  neighbors,
  onGigCreated,
  onClose,
  createGig,
}: GigCreationModalProps) {
  // ── Form state ────────────────────────────────────────────
  const [title, setTitle] = useState(
    source === 'post_delivery'
      ? `Help assembling ${packageTitle}`
      : `Package help needed — ${packageTitle}`,
  );
  const [description, setDescription] = useState(
    packageDescription || (source === 'post_delivery'
      ? `Package delivered. Need help assembling/setting up.${homeAddress ? `\n\nAddress: ${homeAddress}` : ''}`
      : `Expecting a delivery.${deliveryEta ? ` ETA: ${deliveryEta}` : ''}${homeAddress ? `\n\nAddress: ${homeAddress}` : ''}`),
  );
  const [editable, setEditable] = useState(false);
  const [requestType, setRequestType] = useState<string>('hold');
  const [customRequest, setCustomRequest] = useState('');
  const [compensation, setCompensation] = useState<number>(10);
  const [customComp, setCustomComp] = useState('');
  const [verifiedFirst, setVerifiedFirst] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [gigId, setGigId] = useState('');

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const gigType = source === 'post_delivery' ? 'assembly' : requestType;
      const finalComp = customComp ? parseInt(customComp, 10) : compensation;
      const desc = source === 'pre_delivery' && requestType === 'custom'
        ? `${description}\n\nRequest: ${customRequest}`
        : description;

      const result = await createGig({
        gigType,
        title,
        description: desc,
        compensation: finalComp,
        suggestedStart: deliveryEta,
      });
      setGigId(result.gigId);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }, [source, requestType, title, description, customRequest, compensation, customComp, deliveryEta, createGig]);

  // ── Success state ─────────────────────────────────────────
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="w-full max-w-md mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-6 text-center">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-app-text mb-1">
            Task Posted!
          </h3>
          <p className="text-sm text-app-text-secondary mb-4">
            {verifiedFirst
              ? 'Sent to verified neighbors first'
              : 'Posted to neighborhood'}
          </p>
          <button
            type="button"
            onClick={() => onGigCreated(gigId)}
            className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // ── Modal ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border-subtle flex-shrink-0">
          <h3 className="text-sm font-semibold text-app-text">
            {source === 'post_delivery' ? 'Ask for Assembly Help' : 'Request Package Help'}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Pre-delivery: request type selector */}
          {source === 'pre_delivery' && (
            <div>
              <label className="text-xs text-app-text-secondary mb-2 block">What do you need?</label>
              <div className="grid grid-cols-2 gap-2">
                {REQUEST_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => setRequestType(rt.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      requestType === rt.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-app-border text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800'
                    }`}
                  >
                    <span>{rt.icon}</span>
                    {rt.label}
                  </button>
                ))}
              </div>

              {requestType === 'custom' && (
                <textarea
                  value={customRequest}
                  onChange={(e) => setCustomRequest(e.target.value)}
                  placeholder="Describe what you need..."
                  rows={2}
                  className="mt-2 w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                />
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="text-xs text-app-text-secondary mb-1 block">Title</label>
            {editable ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            ) : (
              <p className="text-sm text-app-text font-medium">{title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-app-text-secondary mb-1 block">Description</label>
            {editable ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
              />
            ) : (
              <p className="text-sm text-app-text-secondary dark:text-app-text-muted whitespace-pre-wrap">{description}</p>
            )}
          </div>

          {/* Package photo */}
          {photoUrl && (
            <div>
              <label className="text-xs text-app-text-secondary mb-1 block">Package photo</label>
              <img
                src={photoUrl}
                alt="Package"
                className="w-full max-h-32 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Pre-delivery: nearby neighbors */}
          {source === 'pre_delivery' && neighbors && neighbors.length > 0 && (
            <div>
              <label className="text-xs text-app-text-secondary mb-2 block">Verified neighbors nearby</label>
              <div className="space-y-1.5">
                {neighbors.map((n) => (
                  <div
                    key={n.userId}
                    className="flex items-center gap-2 px-3 py-2 bg-app-surface-raised rounded-lg"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary-600">{n.name.charAt(0)}</span>
                    </div>
                    <span className="text-sm text-app-text-strong flex-1">{n.name}</span>
                    <span className="text-[10px] text-app-text-muted">{n.distance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compensation */}
          <div>
            <label className="text-xs text-app-text-secondary mb-2 block">Compensation</label>
            <div className="flex items-center gap-2">
              {SUGGESTED_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => { setCompensation(amt); setCustomComp(''); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${
                    compensation === amt && !customComp
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-app-border text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800'
                  }`}
                >
                  ${amt}
                </button>
              ))}
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-app-text-muted">$</span>
                <input
                  type="number"
                  value={customComp}
                  onChange={(e) => setCustomComp(e.target.value)}
                  placeholder="Other"
                  className="w-full text-sm pl-6 pr-3 py-1.5 border border-app-border rounded-md bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Verified neighbors first */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedFirst}
              onChange={(e) => setVerifiedFirst(e.target.checked)}
              className="w-4 h-4 rounded border-app-border text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-app-text-strong">
              Post to Verified Neighbors first
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-app-border-subtle flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          {!editable && (
            <button
              type="button"
              onClick={() => setEditable(true)}
              className="px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted border border-app-border hover:bg-app-hover dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              Edit first
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              submitting || !title.trim()
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
                Posting...
              </span>
            ) : (
              'Post Task'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
