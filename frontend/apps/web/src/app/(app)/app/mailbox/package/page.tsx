'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Package, Truck, CheckCircle, Clock } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const STATUS_ICON: Record<string, { icon: typeof Package; color: string; label: string }> = {
  label_created: { icon: Package, color: '#6b7280', label: 'Label Created' },
  in_transit:    { icon: Truck,   color: '#0284c7', label: 'In Transit' },
  out_for_delivery: { icon: Truck, color: '#f59e0b', label: 'Out for Delivery' },
  delivered:     { icon: CheckCircle, color: '#16a34a', label: 'Delivered' },
  exception:     { icon: Clock,   color: '#dc2626', label: 'Exception' },
};

function PackageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';

  const [pkg, setPkg] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [sender, setSender] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    if (!mailId) return;
    setLoading(true);
    api.mailboxV2.getPackageDashboard(mailId)
      .then((result) => {
        setPkg(result.package);
        setTimeline(result.timeline || []);
        setSender(result.sender);
      })
      .catch(() => toast.error('Failed to load package'))
      .finally(() => setLoading(false));
  }, [mailId]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (!pkg) return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-app-text-secondary mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
      <p className="text-center text-app-text-muted py-16">Package not found</p>
    </div>
  );

  const status = STATUS_ICON[pkg.status] || STATUS_ICON.label_created;
  const StatusIcon = status.icon;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <h1 className="text-xl font-bold text-app-text">Package</h1>
      </div>

      {/* Package info */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: status.color + '15' }}>
            <StatusIcon className="w-6 h-6" style={{ color: status.color }} />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-app-text">{pkg.description || 'Package'}</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: status.color + '15', color: status.color }}>{status.label}</span>
          </div>
        </div>
        {sender && <p className="text-sm text-app-text-secondary">From: {sender.display}</p>}
        {pkg.carrier && <p className="text-sm text-app-text-secondary mt-1">Carrier: {pkg.carrier}</p>}
        {pkg.tracking_number && <p className="text-xs text-app-text-muted font-mono mt-1">#{pkg.tracking_number}</p>}
        {pkg.estimated_delivery && <p className="text-sm text-app-text-secondary mt-1">ETA: {new Date(pkg.estimated_delivery).toLocaleDateString()}</p>}
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-app-surface border border-app-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-app-text-strong mb-3">Tracking Timeline</h2>
          <div className="space-y-3">
            {timeline.map((event: any, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-app-text">{event.description || event.status}</p>
                  {event.location && <p className="text-xs text-app-text-muted">{event.location}</p>}
                  {event.timestamp && <p className="text-xs text-app-text-muted">{new Date(event.timestamp).toLocaleString()}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unboxing link */}
      {pkg.status === 'delivered' && (
        <button onClick={() => router.push(`/app/mailbox/unboxing?id=${mailId}`)}
          className="w-full mt-4 py-3 bg-amber-50 border border-amber-300 text-amber-700 rounded-xl font-semibold text-sm hover:bg-amber-100 transition">
          &#x1F381; Start Unboxing
        </button>
      )}
    </div>
  );
}

export default function PackagePage() { return <Suspense><PackageContent /></Suspense>; }
