'use client';

interface LoadingSkeletonProps {
  variant: 'gig-card' | 'listing-card' | 'gig-detail' | 'feed-post';
  count?: number;
}

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-app-surface-sunken ${className || ''}`} />;
}

function GigCardSkeleton() {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-5">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 mr-4">
          <SkeletonPulse className="h-5 w-3/4 mb-2" />
          <SkeletonPulse className="h-3.5 w-1/3" />
        </div>
        <SkeletonPulse className="h-7 w-16 rounded-lg" />
      </div>
      <SkeletonPulse className="h-4 w-full mb-2" />
      <SkeletonPulse className="h-4 w-2/3 mb-4" />
      <div className="flex gap-2 mb-3">
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <SkeletonPulse className="h-6 w-14 rounded-full" />
          <SkeletonPulse className="h-6 w-20 rounded-full" />
        </div>
        <SkeletonPulse className="h-4 w-12" />
      </div>
    </div>
  );
}

function ListingCardSkeleton() {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
      <SkeletonPulse className="h-44 w-full rounded-none" />
      <div className="p-4">
        <SkeletonPulse className="h-5 w-3/4 mb-2" />
        <SkeletonPulse className="h-4 w-1/2 mb-3" />
        <div className="flex justify-between items-center">
          <SkeletonPulse className="h-6 w-20 rounded-lg" />
          <SkeletonPulse className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

function GigDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-app-surface rounded-xl border border-app-border p-6">
        <SkeletonPulse className="h-7 w-2/3 mb-3" />
        <SkeletonPulse className="h-4 w-1/3 mb-4" />
        <SkeletonPulse className="h-4 w-full mb-2" />
        <SkeletonPulse className="h-4 w-5/6 mb-2" />
        <SkeletonPulse className="h-4 w-3/4" />
      </div>
      {/* Sidebar-like section */}
      <div className="bg-app-surface rounded-xl border border-app-border p-6">
        <SkeletonPulse className="h-5 w-1/2 mb-4" />
        <div className="space-y-3">
          <div className="flex justify-between">
            <SkeletonPulse className="h-4 w-24" />
            <SkeletonPulse className="h-4 w-16" />
          </div>
          <div className="flex justify-between">
            <SkeletonPulse className="h-4 w-20" />
            <SkeletonPulse className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <SkeletonPulse className="h-4 w-28" />
            <SkeletonPulse className="h-4 w-12" />
          </div>
        </div>
      </div>
      {/* Action area */}
      <div className="bg-app-surface rounded-xl border border-app-border p-6">
        <SkeletonPulse className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

function FeedPostSkeleton() {
  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-5">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonPulse className="h-10 w-10 rounded-full" />
        <div className="flex-1">
          <SkeletonPulse className="h-4 w-28 mb-1.5" />
          <SkeletonPulse className="h-3 w-16" />
        </div>
      </div>
      <SkeletonPulse className="h-4 w-full mb-2" />
      <SkeletonPulse className="h-4 w-4/5 mb-4" />
      <SkeletonPulse className="h-48 w-full rounded-lg mb-4" />
      <div className="flex gap-6">
        <SkeletonPulse className="h-4 w-12" />
        <SkeletonPulse className="h-4 w-16" />
        <SkeletonPulse className="h-4 w-10" />
      </div>
    </div>
  );
}

const SKELETON_MAP = {
  'gig-card': GigCardSkeleton,
  'listing-card': ListingCardSkeleton,
  'gig-detail': GigDetailSkeleton,
  'feed-post': FeedPostSkeleton,
};

export default function LoadingSkeleton({ variant, count = 1 }: LoadingSkeletonProps) {
  const Component = SKELETON_MAP[variant];
  if (count === 1) return <Component />;
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
    </div>
  );
}
