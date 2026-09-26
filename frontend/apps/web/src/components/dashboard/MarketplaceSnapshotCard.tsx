'use client';

// Only figures the page actually knows: listings in view and those posted in the last day.
// (Urgent deadlines and pending offers have no data source, so they are not shown.)
export default function MarketplaceSnapshotCard({
  inView,
  newIn24h,
}: {
  inView: number;
  newIn24h: string;
}) {
  return (
    <div className="bg-app-surface rounded-xl p-4 border border-app-border shadow-sm">
      <h3 className="font-semibold text-sm text-app-text mb-3">📊 Marketplace Snapshot</h3>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-app-text-secondary">In view</span>
          <span className="font-semibold text-app-text">{inView}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-app-text-secondary">New in 24h</span>
          <span className="font-semibold text-app-text">{newIn24h}</span>
        </div>
      </div>
    </div>
  );
}
