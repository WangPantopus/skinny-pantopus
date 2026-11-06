// W6 · D3 loading skeleton — shimmer, never "Loading…".

import { ShimmerBlock } from "@/components/ui/Shimmer";

export default function ConfirmedLoading() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <ShimmerBlock className="h-24 w-24 rounded-full" />
        <ShimmerBlock className="h-5 w-40 rounded" />
        <ShimmerBlock className="h-3 w-56 rounded" />
      </div>
      <ShimmerBlock className="h-40 w-full rounded-2xl" />
      <ShimmerBlock className="h-12 w-full rounded-xl" />
    </div>
  );
}
