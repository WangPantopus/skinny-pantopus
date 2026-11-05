// W6 · D4 loading skeleton — shimmer, never "Loading…".

import { ShimmerBlock } from "@/components/ui/Shimmer";

export default function ManageLoading() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-12 items-center justify-center border-b border-app-border bg-app-surface">
        <ShimmerBlock className="h-4 w-24 rounded" />
      </div>
      <div className="space-y-3.5 px-4 py-4">
        <ShimmerBlock className="h-6 w-24 rounded-full" />
        <ShimmerBlock className="h-44 w-full rounded-2xl" />
        <ShimmerBlock className="h-14 w-full rounded-xl" />
        <ShimmerBlock className="h-14 w-full rounded-xl" />
      </div>
    </div>
  );
}
