// W6 · D1/D2 loading skeleton — shimmer, never "Loading…".

import { ShimmerBlock } from "@/components/ui/Shimmer";

export default function ConfirmLoading() {
  return (
    <div className="mx-auto w-full max-w-md">
      <div className="flex h-12 items-center justify-center border-b border-app-border bg-app-surface">
        <ShimmerBlock className="h-4 w-24 rounded" />
      </div>
      <div className="space-y-3.5 px-4 py-4">
        <ShimmerBlock className="h-36 w-full rounded-2xl" />
        <ShimmerBlock className="h-3 w-40 self-center rounded" />
        <div className="space-y-3 pt-2">
          <ShimmerBlock className="h-3 w-20 rounded" />
          <ShimmerBlock className="h-11 w-full rounded-lg" />
          <ShimmerBlock className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
