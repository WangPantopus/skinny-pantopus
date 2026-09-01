// @ts-nocheck
'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getAuthToken } from '@pantopus/api';
import PackageUnboxing from '@/components/mailbox/PackageUnboxing';

function UnboxingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mailId = searchParams.get('id') || '';

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Unboxing</h1>
      </div>
      <PackageUnboxing mailId={mailId} onComplete={() => router.back()} />
    </div>
  );
}

export default function UnboxingPage() { return <Suspense><UnboxingContent /></Suspense>; }
