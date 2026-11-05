'use client';

import { useParams } from 'next/navigation';
import CrewDayProblemScreen from '@/components/crew-day/CrewDayProblemScreen';

// Screen 7, Something needs attention, from a booking's Done card (or "Add a note or photo" on an open case).
export default function CrewDayProblemPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  return <CrewDayProblemScreen key={bookingId} bookingId={bookingId} />;
}
