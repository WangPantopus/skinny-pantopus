'use client';

import { useParams } from 'next/navigation';
import AdminCrewDayScreen from '@/components/crew-day/admin/AdminCrewDayScreen';

// Screen 21: one Crew Day (or street request) for the operator.
export default function AdminCrewDayPage() {
  const { crewDayId } = useParams<{ crewDayId: string }>();
  return <AdminCrewDayScreen key={crewDayId} crewDayId={crewDayId} />;
}
