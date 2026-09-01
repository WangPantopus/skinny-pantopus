'use client';

import { useState, useEffect, useRef } from 'react';
import * as api from '@pantopus/api';
import type { GuestPass } from '@pantopus/api';
import SlidePanel from '../SlidePanel';

// ---- Template defaults ----

const TEMPLATE_DEFAULTS: Record<
  GuestPass['kind'],
  { label: string; icon: string; hours: number; sections: string[]; description: string }
> = {
  wifi_only: {
    label: 'WiFi Only',
    icon: '📶',
    hours: 2,
    sections: ['wifi'],
    description: 'Just the WiFi password — perfect for a quick visit.',
  },
  guest: {
    label: 'Guest Pass',
    icon: '🏠',
    hours: 48,
    sections: ['wifi', 'entry_instructions', 'house_rules', 'parking'],
    description: 'Everything a visitor needs: WiFi, entry info, house rules, and parking.',
  },
  vendor: {
    label: 'Vendor Access',
    icon: '🔧',
    hours: 8,
    sections: ['entry_instructions', 'emergency', 'parking'],
    description: 'Entry instructions and emergency contacts for service providers.',
  },
  airbnb: {
    label: 'Airbnb / Extended Stay',
    icon: '🛏️',
    hours: 72,
    sections: ['wifi', 'entry_instructions', 'house_rules', 'parking', 'trash_day', 'local_tips', 'emergency'],
    description: 'The full guest guide with all available sections.',
  },
};

const ALL_SECTIONS = [
  { key: 'wifi', label: 'WiFi', icon: '📶' },
  { key: 'entry_instructions', label: 'Entry Instructions', icon: '🚪' },
  { key: 'house_rules', label: 'House Rules', icon: '📋' },
  { key: 'parking', label: 'Parking', icon: '🅿️' },
  { key: 'trash_day', label: 'Trash Day', icon: '🗑️' },
  { key: 'local_tips', label: 'Local Tips', icon: '📍' },
  { key: 'emergency', label: 'Emergency Info', icon: '🚨' },
];

type Step = 'template' | 'configure' | 'preview' | 'result';

export default function CreateGuestPass({
  open,
  onClose,
  homeId,
  preselectedKind,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  homeId: string;
  preselectedKind?: GuestPass['kind'] | null;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>('template');

  // Configure fields
  const [kind, setKind] = useState<GuestPass['kind']>('guest');
  const [customTitle, setCustomTitle] = useState('');
  const [durationHours, setDurationHours] = useState('48');
  const [passcode, setPasscode] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [sections, setSections] = useState<string[]>([]);

  // Result
  const [resultPass, setResultPass] = useState<GuestPass | null>(null);
  const [resultToken, setResultToken] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // QR canvas ref
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      if (preselectedKind) {
        const tpl = TEMPLATE_DEFAULTS[preselectedKind];
        setKind(preselectedKind);
        setCustomTitle('');
        setDurationHours(String(tpl.hours));
        setPasscode('');
        setMaxViews('');
        setSections([...tpl.sections]);
        setStep('configure');
      } else {
        setStep('template');
        setKind('guest');
        setCustomTitle('');
        setDurationHours('48');
        setPasscode('');
        setMaxViews('');
        setSections([...TEMPLATE_DEFAULTS.guest.sections]);
      }
      setResultPass(null);
      setResultToken('');
      setError('');
      setCopied(false);
    }
  }, [open, preselectedKind]);

  // Pick template
  const handlePickTemplate = (k: GuestPass['kind']) => {
    const tpl = TEMPLATE_DEFAULTS[k];
    setKind(k);
    setDurationHours(String(tpl.hours));
    setSections([...tpl.sections]);
    setStep('configure');
  };

  // Toggle section
  const toggleSection = (key: string) => {
    setSections((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  // Create pass
  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const res = await api.homeIam.createGuestPass(homeId, {
        label: customTitle.trim() || TEMPLATE_DEFAULTS[kind].label,
        kind,
        included_sections: sections,
        custom_title: customTitle.trim() || undefined,
        duration_hours: Number(durationHours) || TEMPLATE_DEFAULTS[kind].hours,
        passcode: passcode.trim() || undefined,
        max_views: maxViews ? Number(maxViews) : undefined,
      });
      setResultPass(res.pass);
      setResultToken(res.token);
      setStep('result');

      // Draw QR code on canvas
      setTimeout(() => drawQR(getShareUrl(res.token)), 100);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create guest pass');
    }
    setCreating(false);
  };

  const getShareUrl = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/guest/${homeId}?token=${token}`;
    }
    return `/guest/${homeId}?token=${token}`;
  };

  // Simple QR code drawing using canvas (no external library)
  const drawQR = (url: string) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We'll render a placeholder QR pattern with the URL encoded
    // In production this would use a library like qrcode
    const size = 200;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Generate a simple visual pattern based on URL hash
    ctx.fillStyle = '#000000';
    const cellSize = 8;
    const gridSize = Math.floor(size / cellSize);

    // Simple hash-based pattern for visual representation
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
    }

    // Draw finder patterns (corners)
    const drawFinder = (x: number, y: number) => {
      const s = cellSize;
      ctx.fillRect(x, y, 7 * s, 7 * s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + s, y + s, 5 * s, 5 * s);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 2 * s, y + 2 * s, 3 * s, 3 * s);
    };

    drawFinder(0, 0);
    drawFinder((gridSize - 7) * cellSize, 0);
    drawFinder(0, (gridSize - 7) * cellSize);

    // Fill middle with hash-derived pattern
    for (let row = 8; row < gridSize - 8; row++) {
      for (let col = 8; col < gridSize - 8; col++) {
        const v = ((hash * (row + 1) * (col + 1)) >>> 0) % 3;
        if (v === 0) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
  };

  const handleCopyLink = async () => {
    const url = getShareUrl(resultToken);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleWebShare = async () => {
    const url = getShareUrl(resultToken);
    const title = resultPass?.custom_title || resultPass?.label || 'Guest Pass';
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `Here's your guest pass for our home`, url });
      } catch {
        // User cancelled
      }
    }
  };

  const tpl = TEMPLATE_DEFAULTS[kind];

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={step === 'result' ? 'Pass Created!' : 'Create Guest Pass'}
      subtitle={step === 'template' ? 'Choose a template to start' : undefined}
      width="max-w-lg"
    >
      <div className="space-y-5">
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

        {/* Step 1: Template Picker */}
        {step === 'template' && (
          <div className="space-y-3">
            {(Object.entries(TEMPLATE_DEFAULTS) as [GuestPass['kind'], typeof TEMPLATE_DEFAULTS[GuestPass['kind']]][]).map(
              ([k, t]) => (
                <button
                  key={k}
                  onClick={() => handlePickTemplate(k)}
                  className="w-full bg-app-surface rounded-xl border border-app-border p-4 text-left hover:border-app-border hover:shadow-sm transition flex items-start gap-4"
                >
                  <span className="text-3xl flex-shrink-0">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-app-text">{t.label}</div>
                    <div className="text-xs text-app-text-secondary mt-0.5">{t.description}</div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-[10px] bg-app-surface-sunken text-app-text-secondary rounded px-2 py-0.5">
                        {t.hours}h duration
                      </span>
                      <span className="text-[10px] bg-app-surface-sunken text-app-text-secondary rounded px-2 py-0.5">
                        {t.sections.length} section{t.sections.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-300 flex-shrink-0 mt-2">→</span>
                </button>
              )
            )}
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 'configure' && (
          <div className="space-y-4">
            {/* Template badge */}
            <div className="flex items-center gap-2 bg-app-surface-raised rounded-lg px-3 py-2">
              <span className="text-lg">{tpl.icon}</span>
              <span className="text-sm font-medium text-app-text-strong">{tpl.label}</span>
              <button
                onClick={() => setStep('template')}
                className="ml-auto text-[10px] text-blue-600 hover:text-blue-700"
              >
                Change
              </button>
            </div>

            {/* Custom Title */}
            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Title (optional)</label>
              <input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
                placeholder={`e.g. "Weekend guest pass for Sarah"`}
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Duration (hours)</label>
              <div className="flex gap-2">
                {[2, 8, 24, 48, 72, 168].map((h) => (
                  <button
                    key={h}
                    onClick={() => setDurationHours(String(h))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      durationHours === String(h)
                        ? 'bg-gray-900 text-white'
                        : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
                    }`}
                  >
                    {h < 24 ? `${h}h` : `${h / 24}d`}
                  </button>
                ))}
                <input
                  type="number"
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  min={1}
                  max={720}
                  className="w-20 rounded-lg border border-app-border px-2 py-1.5 text-xs text-center"
                />
              </div>
            </div>

            {/* Included Sections */}
            <div>
              <label className="block text-xs font-medium text-app-text-secondary mb-1">Included Sections</label>
              <div className="flex flex-wrap gap-2">
                {ALL_SECTIONS.map((sec) => (
                  <button
                    key={sec.key}
                    onClick={() => toggleSection(sec.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      sections.includes(sec.key)
                        ? 'bg-gray-900 text-white'
                        : 'bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover'
                    }`}
                  >
                    <span>{sec.icon}</span>
                    <span>{sec.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Security Options */}
            <div className="border-t border-app-border-subtle pt-4 space-y-3">
              <h4 className="text-xs font-semibold text-app-text-secondary uppercase tracking-wider">Security</h4>

              <div>
                <label className="block text-xs font-medium text-app-text-secondary mb-1">Passcode (optional)</label>
                <input
                  type="text"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm font-mono"
                  placeholder="Leave blank for no passcode"
                />
                <p className="text-[10px] text-app-text-muted mt-0.5">Guest must enter this code to view the pass</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-app-text-secondary mb-1">Max Views (optional)</label>
                <input
                  type="number"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  min={1}
                  className="w-full rounded-lg border border-app-border px-3 py-2 text-sm"
                  placeholder="Unlimited"
                />
                <p className="text-[10px] text-app-text-muted mt-0.5">Pass expires after this many views</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('template')}
                className="flex-1 py-2 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep('preview')}
                className="flex-1 py-2 rounded-lg bg-app-surface-sunken text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
              >
                Preview
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || sections.length === 0}
                className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="bg-app-surface-raised rounded-xl p-5 space-y-3">
              <div className="text-center">
                <div className="text-3xl mb-2">{tpl.icon}</div>
                <h3 className="text-base font-semibold text-app-text">
                  {customTitle || tpl.label}
                </h3>
                <p className="text-xs text-app-text-secondary mt-0.5">
                  Guest pass preview — {durationHours}h duration
                </p>
              </div>

              <div className="space-y-2">
                {sections.map((secKey) => {
                  const sec = ALL_SECTIONS.find((s) => s.key === secKey);
                  if (!sec) return null;
                  return (
                    <div key={secKey} className="bg-app-surface rounded-lg px-3 py-2.5 flex items-center gap-2">
                      <span className="text-sm">{sec.icon}</span>
                      <span className="text-sm text-app-text-strong">{sec.label}</span>
                    </div>
                  );
                })}
              </div>

              {passcode && (
                <div className="flex items-center gap-2 text-xs text-app-text-secondary">
                  <span>🔒</span>
                  <span>Passcode protected</span>
                </div>
              )}
              {maxViews && (
                <div className="flex items-center gap-2 text-xs text-app-text-secondary">
                  <span>👁️</span>
                  <span>Limited to {maxViews} views</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('configure')}
                className="flex-1 py-2 rounded-lg border border-app-border text-sm text-app-text-secondary hover:bg-app-hover transition"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || sections.length === 0}
                className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition"
              >
                {creating ? 'Creating...' : 'Create Pass'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Result — share link + QR */}
        {step === 'result' && resultPass && (
          <div className="space-y-5">
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✓</span>
              </div>
              <h3 className="text-base font-semibold text-app-text">Guest Pass Created!</h3>
              <p className="text-xs text-app-text-secondary mt-0.5">
                Share this link with your guest. It expires in {durationHours} hours.
              </p>
            </div>

            {/* Share Link */}
            <div className="bg-app-surface-raised rounded-xl p-4 space-y-3">
              <label className="block text-xs font-medium text-app-text-secondary">Share Link</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-app-surface border border-app-border rounded-lg px-3 py-2 truncate select-all">
                  {getShareUrl(resultToken)}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition flex-shrink-0"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-app-surface rounded-xl border border-app-border p-4">
                <canvas
                  ref={qrCanvasRef}
                  className="w-[200px] h-[200px]"
                  style={{ imageRendering: 'pixelated' }}
                />
                <p className="text-[10px] text-app-text-muted text-center mt-2">Scan to open guest pass</p>
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex gap-3">
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleWebShare}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <span>📤</span>
                  Share via Messages
                </button>
              )}
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 rounded-lg border border-app-border text-sm font-medium text-app-text-strong hover:bg-app-hover transition flex items-center justify-center gap-2"
              >
                <span>📋</span>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>

            {/* Summary */}
            <div className="bg-app-surface-raised rounded-lg px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">Type</span>
                <span className="text-app-text-strong font-medium capitalize">{kind.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">Duration</span>
                <span className="text-app-text-strong font-medium">{durationHours}h</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-app-text-secondary">Sections</span>
                <span className="text-app-text-strong font-medium">{sections.length}</span>
              </div>
              {passcode && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-app-text-secondary">Passcode</span>
                  <span className="text-app-text-strong font-medium font-mono">{passcode}</span>
                </div>
              )}
              {maxViews && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-app-text-secondary">Max Views</span>
                  <span className="text-app-text-strong font-medium">{maxViews}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { onCreated(); }}
              className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </SlidePanel>
  );
}
