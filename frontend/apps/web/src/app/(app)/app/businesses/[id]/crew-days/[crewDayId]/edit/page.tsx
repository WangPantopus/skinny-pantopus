'use client';

import { useParams } from 'next/navigation';
import CrewDayFormScreen from '@/components/crew-day/crew/CrewDayFormScreen';

// Screen 14 for an existing day: a draft, a declined day, or an open day's editable fields.
export default function EditCrewDayPage() {
  const { id, crewDayId } = useParams<{ id: string; crewDayId: string }>();
  return <CrewDayFormScreen key={crewDayId} businessId={id} crewDayId={crewDayId} />;
}
