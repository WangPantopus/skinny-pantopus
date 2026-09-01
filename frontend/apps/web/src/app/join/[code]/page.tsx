'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface JoinData {
  valid: boolean;
  referrer_name?: string;
  referrer_avatar?: string;
  code?: string;
}

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<JoinData | null>(null);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/public/join/${encodeURIComponent(code)}`);
        const json: JoinData = await res.json();
        setData(json);
      } catch {
        setData({ valid: false });
      } finally {
        setLoading(false);
      }
    })();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-3 text-sm text-app-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired code
  if (!data?.valid) {
    return (
      <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
        <div className="bg-app-surface rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-semibold text-app-text mb-2">This invite link has expired</h1>
          <p className="text-sm text-app-text-secondary mb-6">
            The link you followed is no longer active. You can still join Pantopus directly.
          </p>
          <button
            onClick={() => router.push('/register')}
            className="px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition"
          >
            Join Pantopus
          </button>
        </div>
      </div>
    );
  }

  // Valid referral
  const { referrer_name, referrer_avatar } = data;
  const initial = (referrer_name || 'P')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-app-surface-raised flex items-center justify-center p-4">
      <div className="bg-app-surface rounded-2xl shadow-lg overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gray-900 px-8 pt-10 pb-8 text-center">
          {referrer_avatar ? (
            <Image
              src={referrer_avatar}
              alt={referrer_name || 'Referrer'}
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2 border-white/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-500 text-white flex items-center justify-center text-xl font-bold mx-auto mb-3 border-2 border-white/20">
              {initial}
            </div>
          )}
          <h1 className="text-xl font-bold text-white mb-1">
            {referrer_name} invited you to Pantopus
          </h1>
          <p className="text-sm text-gray-300">
            Get things done by verified neighbors in your area
          </p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-sm font-medium text-app-text">Verified neighbors</p>
                <p className="text-xs text-app-text-secondary">Every helper is identity-verified and reviewed</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">⚡</span>
              <div>
                <p className="text-sm font-medium text-app-text">Fast & affordable</p>
                <p className="text-xs text-app-text-secondary">Post a task and get help in minutes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🔒</span>
              <div>
                <p className="text-sm font-medium text-app-text">Safe payments</p>
                <p className="text-xs text-app-text-secondary">Pay securely through the app</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push(`/register?invite_code=${encodeURIComponent(code)}`)}
            className="w-full py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition"
          >
            Join now
          </button>

          <div className="mt-3 text-center">
            <button
              onClick={() => router.push(`/login?invite_code=${encodeURIComponent(code)}`)}
              className="text-sm text-app-text-secondary hover:text-app-text transition"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-app-border-subtle px-8 py-4 text-center">
          <p className="text-[11px] text-app-text-muted">
            Pantopus — Your neighborhood, connected.
          </p>
        </div>
      </div>
    </div>
  );
}
