'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Eye } from 'lucide-react';

function SubmittedContent() {
  const router = useRouter();
  const { id: homeId } = useParams<{ id: string }>();

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="flex flex-col items-center text-center pt-12">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-6">
          <Send className="w-10 h-10 text-blue-600" />
        </div>

        <h1 className="text-2xl font-bold text-app-text mb-3">Check your request</h1>
        <p className="text-base text-app-text-strong leading-relaxed mb-2">
          Check Status to see whether your request is saved and whether the property owner has responded.
        </p>
        <p className="text-sm text-app-text-muted mb-10">
          Review times depend on the property owner.
        </p>

        <div className="w-full space-y-3">
          <button onClick={() => router.push(`/app/homes/${homeId}/verify-landlord`)}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gray-900 text-white rounded-xl font-bold text-base hover:bg-gray-800 transition">
            <Eye className="w-4 h-4" /> Check Status
          </button>
          <button onClick={() => router.push(`/app/homes/${homeId}/dashboard`)}
            className="w-full py-3 border border-app-border rounded-xl text-sm font-semibold text-app-text-secondary hover:bg-app-hover transition">
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SubmittedPage() { return <Suspense><SubmittedContent /></Suspense>; }
