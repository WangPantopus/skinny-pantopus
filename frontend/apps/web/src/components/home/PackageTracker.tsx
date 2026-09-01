'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { Mailbox, Truck, Package, CheckCircle, Home, MailOpen, Mail } from 'lucide-react';

const STATUS_CONFIG: Record<string, { icon: ReactNode; label: string; color: string }> = {
  expected: { icon: <Mailbox className="w-5 h-5" />, label: 'Expected', color: 'text-blue-600' },
  in_transit: { icon: <Truck className="w-5 h-5" />, label: 'In Transit', color: 'text-purple-600' },
  out_for_delivery: { icon: <Package className="w-5 h-5" />, label: 'Out for Delivery', color: 'text-orange-600' },
  delivered: { icon: <CheckCircle className="w-5 h-5" />, label: 'Delivered', color: 'text-green-600' },
  picked_up: { icon: <Home className="w-5 h-5" />, label: 'Picked Up', color: 'text-app-text-secondary' },
};

export default function PackageTracker({
  packages,
  onAdd,
  onMarkPickedUp,
  homeId,
  highlightPackageId,
}: {
  packages: Record<string, any>[];
  onAdd?: () => void;
  onMarkPickedUp?: (pkgId: string) => void;
  homeId?: string;
  highlightPackageId?: string;
}) {
  useEffect(() => {
    if (!highlightPackageId) return;
    const target = document.getElementById(`home-package-${highlightPackageId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightPackageId]);

  const pending = packages.filter(
    (p) => p.status !== 'picked_up' && p.status !== 'returned'
  );

  return (
    <div className="bg-app-surface rounded-xl border border-app-border">
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-app-text">Packages</h3>
          <p className="text-xs text-app-text-secondary mt-0.5">
            {pending.length} incoming
          </p>
        </div>
        {onAdd && (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
          >
            + Track
          </button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mb-2"><MailOpen className="w-8 h-8 mx-auto text-app-text-muted" /></div>
          <p className="text-sm text-app-text-secondary">No packages being tracked.</p>
        </div>
      ) : (
        <div className="divide-y divide-app-border-subtle">
          {packages.map((pkg) => {
            const cfg = STATUS_CONFIG[pkg.status] || STATUS_CONFIG.expected;
            const sourceMatch = String(pkg.delivery_instructions || '').match(/MAILBOX_FANOUT:([0-9a-f-]{36})/i);
            const sourceMailId = sourceMatch?.[1] || null;
            return (
              <div
                id={`home-package-${pkg.id}`}
                key={pkg.id}
                className={`px-5 py-3.5 flex items-center gap-3 transition group ${
                  pkg.id === highlightPackageId
                    ? 'bg-emerald-50 ring-1 ring-emerald-300'
                    : 'hover:bg-app-hover/50'
                }`}
              >
                <span className="flex-shrink-0">{cfg.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text truncate">
                    {pkg.description || pkg.vendor_name || 'Package'}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    {pkg.carrier && (
                      <span className="text-xs text-app-text-muted">via {pkg.carrier}</span>
                    )}
                    {pkg.expected_at && (
                      <span className="text-xs text-app-text-muted">
                        ETA {new Date(pkg.expected_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {pkg.tracking_number && (
                    <div className="text-[10px] text-app-text-muted mt-0.5 font-mono truncate">
                      {pkg.tracking_number}
                    </div>
                  )}
                  {sourceMailId && homeId && (
                    <div className="mt-1">
                      <Link
                        href={`/app/mailbox/${sourceMailId}?scope=home&homeId=${homeId}`}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200"
                      >
                        <Mail className="w-3 h-3" /> From Mail
                      </Link>
                    </div>
                  )}
                </div>

                {onMarkPickedUp && pkg.status === 'delivered' && (
                  <button
                    onClick={() => onMarkPickedUp(pkg.id)}
                    className="opacity-0 group-hover:opacity-100 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition flex-shrink-0"
                  >
                    Pick up
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
