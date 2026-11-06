'use client';

import { useParams } from 'next/navigation';
import CrewDayBookingScreen from '@/components/crew-day/CrewDayBookingScreen';

// Screen 5, Your Crew Day: one booking (notification links and Your Crew Days open it).
export default function CrewDayBookingPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  return <CrewDayBookingScreen key={bookingId} bookingId={bookingId} />;
}
