// W15 · G9 — Create / Edit Package route. `id === "new"` creates; any other id
// edits. Thin client wrapper around the stream-owned PackageEditor. Packages are
// a business surface, so the active business owner is resolved here.

"use client";

import { useParams } from "next/navigation";
import { PackageEditor } from "@/components/scheduling/packages";
import BusinessOwnerBoundary from "@/components/scheduling/business/BusinessOwnerBoundary";

export default function PackageEditPage() {
  const params = useParams<{ id: string }>();
  const raw = params?.id;
  const id = Array.isArray(raw) ? raw[0] : (raw ?? "new");
  return (
    <BusinessOwnerBoundary>
      {(owner) => <PackageEditor id={id} owner={owner} />}
    </BusinessOwnerBoundary>
  );
}
