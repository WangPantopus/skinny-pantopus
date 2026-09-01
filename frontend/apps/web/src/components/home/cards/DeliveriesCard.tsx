'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, Mailbox, CheckCircle, HandHelping, XCircle, Undo2, ChevronLeft, Hammer } from 'lucide-react';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';

const STATUS_CONFIG: Record<string, { icon: ReactNode; label: string; color: string }> = {
  expected: { icon: <Package className="w-5 h-5" />, label: 'Expected', color: 'bg-app-surface-sunken text-app-text-secondary' },
  in_transit: { icon: <Truck className="w-5 h-5" />, label: 'In Transit', color: 'bg-blue-100 text-blue-700' },
  out_for_delivery: { icon: <Mailbox className="w-5 h-5" />, label: 'Out for Delivery', color: 'bg-amber-100 text-amber-700' },
  delivered: { icon: <CheckCircle className="w-5 h-5" />, label: 'Delivered', color: 'bg-green-100 text-green-700' },
  picked_up: { icon: <HandHelping className="w-5 h-5" />, label: 'Picked Up', color: 'bg-emerald-100 text-emerald-700' },
  lost: { icon: <XCircle className="w-5 h-5" />, label: 'Lost', color: 'bg-red-100 text-red-700' },
  returned: { icon: <Undo2 className="w-5 h-5" />, label: 'Returned', color: 'bg-app-surface-sunken text-app-text-secondary' },
};

type SubTab = 'expected' | 'delivered' | 'archived';

// ---- Preview ----

export function DeliveriesCardPreview({
  packages,
  pendingPkgs,
  onExpand,
}: {
  packages: Record<string, any>[];
  pendingPkgs: number;
  onExpand: () => void;
}) {
  const arriving = packages.filter(
    (p) => p.status === 'in_transit' || p.status === 'out_for_delivery' || p.status === 'expected'
  );

  return (
    <DashboardCard
      title="Deliveries"
      icon={<Package className="w-5 h-5" />}
      visibility="members"
      count={pendingPkgs}
      badge={arriving.length > 0 ? `${arriving.length} arriving` : undefined}
      onClick={onExpand}
    >
      {arriving.length > 0 ? (
        <div className="space-y-2">
          {arriving.slice(0, 3).map((p) => {
            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.expected;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-app-text-strong truncate">{p.description || p.carrier || 'Package'}</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cfg.color}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><Package className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No packages expected</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function DeliveriesCard({
  packages,
  homeId,
  onAddPackage,
  onMarkPickedUp,
  onPackageClick,
  onBack,
  highlightPackageId,
}: {
  packages: Record<string, any>[];
  homeId: string;
  onAddPackage: () => void;
  onMarkPickedUp: (pkgId: string) => void;
  onPackageClick?: (pkg: Record<string, any>) => void;
  onBack: () => void;
  highlightPackageId?: string;
}) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<SubTab>('expected');

  const filtered = useMemo(() => {
    switch (subTab) {
      case 'expected':
        return packages.filter((p) => p.status !== 'picked_up' && p.status !== 'returned' && p.status !== 'lost');
      case 'delivered':
        return packages.filter((p) => p.status === 'delivered');
      case 'archived':
        return packages.filter((p) => p.status === 'picked_up' || p.status === 'returned' || p.status === 'lost');
      default:
        return packages;
    }
  }, [packages, subTab]);

  const SUB_TABS: { key: SubTab; label: string; count: number }[] = [
    { key: 'expected', label: 'Expected', count: packages.filter((p) => p.status !== 'picked_up' && p.status !== 'returned' && p.status !== 'lost').length },
    { key: 'delivered', label: 'Delivered', count: packages.filter((p) => p.status === 'delivered').length },
    { key: 'archived', label: 'Archived', count: packages.filter((p) => p.status === 'picked_up' || p.status === 'returned' || p.status === 'lost').length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Package className="w-5 h-5" /> Deliveries</h2>
        </div>
        <button
          onClick={onAddPackage}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Track Package
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              subTab === t.key ? 'bg-gray-900 text-white' : 'text-app-text-secondary hover:bg-app-hover'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
                subTab === t.key ? 'bg-glass/20 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mb-2"><Package className="w-8 h-8 mx-auto text-app-text-muted" /></div>
            <p className="text-sm text-app-text-secondary">No packages in this category</p>
          </div>
        ) : (
          filtered.map((pkg) => {
            const cfg = STATUS_CONFIG[pkg.status] || STATUS_CONFIG.expected;
            return (
              <div
                key={pkg.id}
                id={`pkg-${pkg.id}`}
                className={`px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition cursor-pointer group ${
                  pkg.id === highlightPackageId ? 'bg-emerald-50 ring-1 ring-emerald-300' : ''
                }`}
                onClick={() => onPackageClick?.(pkg)}
              >
                <span className="flex-shrink-0">{cfg.icon}</span>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-app-text">{pkg.description || 'Package'}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {pkg.carrier && <span className="text-[10px] text-app-text-secondary">{pkg.carrier}</span>}
                    {pkg.tracking_number && (
                      <span className="text-[10px] text-app-text-muted font-mono">{pkg.tracking_number?.slice(0, 12)}…</span>
                    )}
                    {pkg.expected_at && (
                      <span className="text-[10px] text-app-text-muted">
                        ETA: {new Date(pkg.expected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {pkg.visibility && <VisibilityChip visibility={pkg.visibility} />}
                  </div>
                </div>

                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                  {cfg.label}
                </span>

                {pkg.status === 'delivered' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMarkPickedUp(pkg.id); }}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition flex-shrink-0"
                  >
                    Pick Up
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Need assembly help hint */}
      {packages.filter((p) => p.status === 'delivered').length > 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 flex items-center gap-3">
          <Hammer className="w-5 h-5 text-emerald-700" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-800">Need assembly help?</p>
            <p className="text-xs text-emerald-600">Post a task to find local help with assembling your delivery.</p>
          </div>
          <button
            onClick={() => router.push(`/app/gigs/new?home_id=${homeId}&type=assembly`)}
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition flex-shrink-0"
          >
            Post Gig
          </button>
        </div>
      )}
    </div>
  );
}
