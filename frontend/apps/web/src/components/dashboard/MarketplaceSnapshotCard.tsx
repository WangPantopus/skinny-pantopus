'use client';

export default function MarketplaceSnapshotCard({
  inView,
  newToday,
  urgentDeadlines,
  myPendingOffers,
}: {
  inView: number;
  newToday: number;
  urgentDeadlines: number;
  myPendingOffers: number;
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
          <span className="font-semibold text-app-text">{newToday}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-app-text-secondary">Urgent deadlines</span>
          <span className="font-semibold text-app-text">{urgentDeadlines}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-app-text-secondary">Your pending offers</span>
          <span className="font-semibold text-app-text">{myPendingOffers}</span>
        </div>
      </div>
    </div>
  );
}
