'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PropertyDetail from '@/components/landlord/PropertyDetail';

export default function LandlordPropertyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const homeId = params.homeId as string;

  // Older Add Property links pointed here even though "new" is not a property ID.
  useEffect(() => {
    if (homeId === 'new') router.replace('/app/homes/new');
  }, [homeId, router]);
  if (homeId === 'new') return null;

  return <PropertyDetail homeId={homeId} />;
}
