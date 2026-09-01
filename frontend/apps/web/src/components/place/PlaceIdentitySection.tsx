// ============================================================
// Place — IdentityGroup (T4 verified).
//
// The web mirror of the verified ProfileDashboard's Identity group in
// docs/design/place: the verified-resident status row + a residency
// letter row, routing to the Identity center.
//
// The verify nudge (T3) and the "Locked until you verify" Band-D cards
// live in the shared archetype (VerifyBanner) and presentation
// (renderVerifyLocked); this group is the T4 counterpart the contract
// doesn't carry yet (launch set is Band A). Tokens only.
// ============================================================

'use client';

import { useRouter } from 'next/navigation';
import { BadgeCheck, FileText, Check } from 'lucide-react';
import { Group, SectionCard } from '@/components/archetypes/place';

export function IdentityGroup() {
  const router = useRouter();
  const goIdentity = () => router.push('/app/identity');
  return (
    <Group label="Identity">
      <SectionCard
        icon={BadgeCheck}
        title="Identity"
        chip={{ label: 'Verified', variant: 'success', icon: Check }}
        inline
        onClick={goIdentity}
      />
      <SectionCard
        icon={FileText}
        title="Residency letter"
        action={{ label: 'Generate a residency letter', onClick: goIdentity }}
        onClick={goIdentity}
      />
    </Group>
  );
}
