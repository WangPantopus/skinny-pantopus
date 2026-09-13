'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SenderInvitationManager from '@/components/home/invitations/SenderInvitationManager';
export default function HomeInvitationsPage(){
  const homeId=useParams().id as string;
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-6"><Link href={`/app/homes/${homeId}/dashboard?tab=security`} className="text-sm text-blue-600 underline">Back to Home</Link>
    <SenderInvitationManager homeId={homeId}/></main>;
}
