// G4 — Member Working-Hours Editor. W13-owned route.

import { Suspense } from "react";
import MemberHoursEditor from "@/components/scheduling/business/MemberHoursEditor";

export const metadata = {
  title: "Member working hours · Pantopus",
};

export default async function MemberHoursPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;
  return (
    <Suspense fallback={null}>
      <MemberHoursEditor memberId={decodeURIComponent(memberId)} />
    </Suspense>
  );
}
