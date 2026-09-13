'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import MemberRemovalRecovery from '@/components/home/member-removals/MemberRemovalRecovery';

function Recovery() {
  const query = useSearchParams();
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-6">
    <Link href="/app/homes" className="text-sm text-blue-700 underline">Back to My Homes</Link>
    <h1 className="text-xl font-semibold">Member removal and recovery</h1>
    <MemberRemovalRecovery homeId={query.get('home') || undefined} targetId={query.get('target') || undefined} self={query.get('self') === '1'}/>
  </main>;
}
export default function MemberRemovalPage() {
  return <Suspense fallback={<p role="status" className="p-6">Opening removal recovery…</p>}><Recovery/></Suspense>;
}
