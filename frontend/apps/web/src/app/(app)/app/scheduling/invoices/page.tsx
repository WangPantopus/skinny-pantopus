// W15 · G12 — Invoices List route (owner, business-only). Thin client wrapper
// around the stream-owned InvoiceList component; the active business owner is
// resolved here so invoices are scoped to the business, not the personal owner.

"use client";

import { InvoiceList } from "@/components/scheduling/packages";
import BusinessOwnerBoundary from "@/components/scheduling/business/BusinessOwnerBoundary";

export default function InvoicesPage() {
  return (
    <BusinessOwnerBoundary>
      {(owner) => <InvoiceList owner={owner} />}
    </BusinessOwnerBoundary>
  );
}
