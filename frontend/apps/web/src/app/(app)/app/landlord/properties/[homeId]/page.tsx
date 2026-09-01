'use client';

import { useParams } from 'next/navigation';
import PropertyDetail from '@/components/landlord/PropertyDetail';

export default function LandlordPropertyDetailPage() {
  const params = useParams();
  const homeId = params.homeId as string;

  return <PropertyDetail homeId={homeId} />;
}
