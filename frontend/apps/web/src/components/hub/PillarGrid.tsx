'use client';

import PersonalCard from './PersonalCard';
import HomeCard, { AttachHomeCTA } from './HomeCard';
import BusinessCard from './BusinessCard';
import type { HubPersonalCard, HubHomeCard, HubBusinessCard, HubBusiness } from './types';

interface PillarGridProps {
  personal: HubPersonalCard;
  home?: HubHomeCard;
  business?: HubBusinessCard;
  activeHomeId: string | null;
  businesses: HubBusiness[];
  hasHome: boolean;
  hasBusiness: boolean;
}

export default function PillarGrid({
  personal, home, business, activeHomeId, businesses, hasHome, hasBusiness,
}: PillarGridProps) {
  const bottomCards = 1 + (hasBusiness ? 1 : 0);

  return (
    <div className="space-y-4">
      <PersonalCard data={personal} />
      <div className={`grid gap-4 ${bottomCards >= 2 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
        {hasHome && home ? (
          <HomeCard data={home} homeId={activeHomeId} />
        ) : (
          <AttachHomeCTA />
        )}
        {hasBusiness && business && businesses.length > 0 && (
          <BusinessCard data={business} business={businesses[0]} />
        )}
      </div>
    </div>
  );
}
