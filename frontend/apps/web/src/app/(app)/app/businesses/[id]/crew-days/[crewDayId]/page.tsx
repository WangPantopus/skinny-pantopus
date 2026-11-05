'use client';

import { useParams } from 'next/navigation';
import CrewDayCrewScreen from '@/components/crew-day/crew/CrewDayCrewScreen';

// The crew's day (screens 15, 16, 18, 19): notification links and the dashboard's Crew Days tab open it.
export default function CrewDayCrewPage() {
  const { id, crewDayId } = useParams<{ id: string; crewDayId: string }>();
  return <CrewDayCrewScreen key={crewDayId} businessId={id} crewDayId={crewDayId} />;
}
