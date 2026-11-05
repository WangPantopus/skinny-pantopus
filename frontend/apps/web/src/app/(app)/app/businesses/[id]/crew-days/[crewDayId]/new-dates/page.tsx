'use client';

import { useParams } from 'next/navigation';
import CrewDayProposeDatesScreen from '@/components/crew-day/crew/CrewDayProposeDatesScreen';

// Screen 18, Propose new dates, from the crew's day ("If plans change").
export default function ProposeNewDatesPage() {
  const { id, crewDayId } = useParams<{ id: string; crewDayId: string }>();
  return <CrewDayProposeDatesScreen key={crewDayId} businessId={id} crewDayId={crewDayId} />;
}
