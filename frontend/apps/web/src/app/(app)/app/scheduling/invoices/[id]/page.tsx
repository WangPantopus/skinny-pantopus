// W15 · G13 — Invoice Detail route (owner). Thin client wrapper around the
// stream-owned InvoiceDetail component; the active business owner is resolved
// here so the invoice is read under the business, not the personal owner.

"use client";

import { useParams } from "next/navigation";
import { InvoiceDetail } from "@/components/scheduling/packages";
import BusinessOwnerBoundary from "@/components/scheduling/business/BusinessOwnerBoundary";

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : (raw ?? "");
  return (
    <BusinessOwnerBoundary>
      {(owner) => <InvoiceDetail id={id} owner={owner} />}
    </BusinessOwnerBoundary>
  );
}
