"use client";

// Resolves the active Business scheduling owner for the paid host surfaces that
// live under /app/scheduling/* (Payments, Packages, Invoices). Route-based owner
// detection (useSchedulingOwner) yields "personal" on those paths — there is no
// /app/businesses/:id segment — so each business surface must resolve the active
// business itself (mirroring BusinessSettings / useBusinessOwner). This shared
// boundary owns the loading / no-business / multi-business-switcher chrome and
// hands a non-null business SchedulingOwnerRef (owner_type:'business' + owner_id)
// to its children, so the scheduling API calls finally carry owner_id.

import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import type { SchedulingOwnerRef } from "@pantopus/types";
import { ShimmerBlock } from "@/components/ui/Shimmer";
import { useBusinessOwner } from "./owner";
import { BusinessSwitcher } from "./ui";

export default function BusinessOwnerBoundary({
  children,
}: {
  children: (owner: SchedulingOwnerRef) => ReactNode;
}) {
  const biz = useBusinessOwner();

  if (biz.loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <ShimmerBlock className="h-8 w-44 rounded-lg" />
        <ShimmerBlock className="h-28 rounded-2xl" />
        <ShimmerBlock className="h-28 rounded-2xl" />
      </div>
    );
  }

  if (biz.unavailable || !biz.owner) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-business-bg text-app-business">
          <Building2 className="h-7 w-7" strokeWidth={1.8} aria-hidden />
        </span>
        <h2 className="mb-1.5 text-base font-semibold text-app-text">
          No business yet
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-app-text-secondary">
          Payments, packages, and invoices belong to a business. Create or join
          a business to manage them here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {biz.options.length > 1 && (
        <div className="mb-4 flex justify-end">
          <BusinessSwitcher
            options={biz.options}
            activeId={biz.active?.id ?? null}
            onChange={biz.setActiveId}
          />
        </div>
      )}
      {children(biz.owner)}
    </div>
  );
}
