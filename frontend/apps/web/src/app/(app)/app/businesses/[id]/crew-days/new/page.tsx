'use client';

import { useParams, useSearchParams } from 'next/navigation';
import CrewDayFormScreen from '@/components/crew-day/crew/CrewDayFormScreen';

// Screen 14, New Crew Day; `?repeat=<crewDayId>` is "Offer a Crew Day here again" (filled in from that day).
export default function NewCrewDayPage() {
  const { id } = useParams<{ id: string }>();
  const repeat = useSearchParams().get('repeat');
  return <CrewDayFormScreen key={repeat ?? 'new'} businessId={id} repeatOf={repeat} />;
}
