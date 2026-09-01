'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { Wifi, DoorOpen, Lock, Package, Warehouse, Siren, Key, ChevronLeft } from 'lucide-react';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';
import { confirmStore } from '@/components/ui/confirm-store';

const ACCESS_TYPES: Record<string, { icon: ReactNode; label: string }> = {
  wifi: { icon: <Wifi className="w-5 h-5" />, label: 'Wi-Fi' },
  door_code: { icon: <DoorOpen className="w-5 h-5" />, label: 'Door Code' },
  gate_code: { icon: <Lock className="w-5 h-5" />, label: 'Gate Code' },
  lockbox: { icon: <Package className="w-5 h-5" />, label: 'Lockbox' },
  garage: { icon: <Warehouse className="w-5 h-5" />, label: 'Garage' },
  alarm: { icon: <Siren className="w-5 h-5" />, label: 'Alarm' },
  other: { icon: <Key className="w-5 h-5" />, label: 'Other' },
};

// ---- Preview ----

export function AccessCardPreview({
  secrets,
  onExpand,
}: {
  secrets: Record<string, any>[];
  onExpand: () => void;
}) {
  return (
    <DashboardCard
      title="Access Codes"
      icon={<Key className="w-5 h-5" />}
      visibility="sensitive"
      count={secrets.length}
      onClick={onExpand}
    >
      {secrets.length > 0 ? (
        <div className="space-y-1.5">
          {secrets.slice(0, 4).map((s) => {
            const cfg = ACCESS_TYPES[s.access_type] || ACCESS_TYPES.other;
            return (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="flex-shrink-0">{cfg.icon}</span>
                <span className="text-app-text-strong truncate">{s.label || cfg.label}</span>
                <span className="text-gray-300 ml-auto"><Lock className="w-3 h-3" /></span>
              </div>
            );
          })}
          {secrets.length > 4 && <p className="text-xs text-app-text-muted">+{secrets.length - 4} more</p>}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><Key className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No access codes stored</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function AccessCard({
  secrets,
  homeId: _homeId,
  can,
  onSecretsChange: _onSecretsChange,
  onBack,
}: {
  secrets: Record<string, any>[];
  homeId: string;
  can: (perm: string) => boolean;
  onSecretsChange: (s: Record<string, any>[]) => void;
  onBack: () => void;
}) {
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-hide revealed secrets after 30 seconds
  useEffect(() => {
    if (revealedIds.size === 0) return;
    const timer = setTimeout(() => {
      setRevealedIds(new Set());
    }, 30000);
    return () => clearTimeout(timer);
  }, [revealedIds]);

  const handleReveal = useCallback(async (secretId: string) => {
    const yes = await confirmStore.open({ title: 'Reveal this secret value?' });
    if (!yes) return;
    setRevealedIds((prev) => new Set(prev).add(secretId));
  }, []);

  const handleCopy = useCallback(async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API not available
    }
  }, []);

  // Filter by permission
  const visibleSecrets = secrets.filter((s) => {
    if (s.access_type === 'wifi') return can('access.view_wifi');
    return can('access.view_codes');
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Key className="w-5 h-5" /> Access Codes</h2>
        </div>
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
        {visibleSecrets.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mb-2"><Lock className="w-8 h-8 mx-auto text-app-text-muted" /></div>
            <p className="text-sm text-app-text-secondary">No access codes you can view</p>
          </div>
        ) : (
          visibleSecrets.map((secret) => {
            const cfg = ACCESS_TYPES[secret.access_type] || ACCESS_TYPES.other;
            const isRevealed = revealedIds.has(secret.id);
            const isSensitive = secret.visibility === 'sensitive' || secret.visibility === 'managers';

            return (
              <div key={secret.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0">{cfg.icon}</span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-app-text">{secret.label || cfg.label}</span>
                      {secret.visibility && <VisibilityChip visibility={secret.visibility} />}
                      {isSensitive && !isRevealed && <Lock className="w-3 h-3 text-app-text-muted" />}
                    </div>

                    {/* Value section */}
                    {isRevealed ? (
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="text-sm font-mono bg-app-surface-raised px-2 py-1 rounded text-app-text select-all">
                          {secret.values?.[0]?.value || secret.secret_value || '•••'}
                        </code>
                        <button
                          onClick={() => handleCopy(secret.values?.[0]?.value || secret.secret_value || '', secret.id)}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary hover:bg-app-hover transition"
                        >
                          {copiedId === secret.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1.5">
                        <button
                          onClick={() => handleReveal(secret.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 transition"
                        >
                          Tap to reveal
                        </button>
                      </div>
                    )}

                    {/* Additional values (e.g., WiFi password separate from SSID) */}
                    {isRevealed && secret.values && secret.values.length > 1 && (
                      <div className="mt-1 space-y-1">
                        {secret.values.slice(1).map((v: Record<string, any>, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] text-app-text-muted">{v.label || `Value ${i + 2}`}:</span>
                            <code className="text-xs font-mono text-app-text-strong">{v.value}</code>
                          </div>
                        ))}
                      </div>
                    )}

                    {secret.notes && isRevealed && (
                      <p className="text-xs text-app-text-muted mt-1">{secret.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
