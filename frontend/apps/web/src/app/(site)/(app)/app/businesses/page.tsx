'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';

export default function BusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<api.BusinessMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) { router.push('/login'); return; }
      const res = await api.businesses.getMyBusinesses();
      setBusinesses(res.businesses ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load businesses');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const ROLE_LABELS: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    editor: 'Editor',
    staff: 'Staff',
    viewer: 'Viewer',
  };

  return (
    <div className="bg-app-surface-raised">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-app-text">My Businesses</h1>
          <Link
            href="/app/businesses/new"
            className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
          >
            Create business
          </Link>
        </div>

        {loading ? (
          <div className="text-app-text-secondary">Loading…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : businesses.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <div className="mb-3 flex justify-center"><Building2 className="w-8 h-8 text-app-text-muted" /></div>
            <div className="text-lg font-semibold text-app-text">No businesses yet</div>
            <p className="mt-1 text-app-text-secondary max-w-md mx-auto">
              Create a business profile to showcase your services, manage locations, build custom pages, and connect with customers.
            </p>
            <Link
              href="/app/businesses/new"
              className="inline-block mt-4 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
            >
              Create your first business
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {businesses.map((m) => {
              const biz = m.business;
              const profile = m.profile;
              const name = biz?.name || biz?.username || 'Untitled Business';
              const categories = (profile?.categories || []).join(', ');
              const isPublished = profile?.is_published;

              return (
                <div
                  key={m.business_user_id}
                  className="rounded-xl border border-app-border bg-app-surface p-5 flex items-start justify-between gap-4 hover:border-app-border transition"
                >
                  <div
                    className="cursor-pointer flex-1 min-w-0"
                    onClick={() => router.push(`/app/businesses/${m.business_user_id}/dashboard`)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-app-text truncate">{name}</span>
                      {isPublished ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 border border-green-200">
                          Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                          Draft
                        </span>
                      )}
                    </div>
                    {categories && (
                      <div className="text-sm text-app-text-secondary mt-0.5 truncate">{categories}</div>
                    )}
                    {profile?.description && (
                      <div className="text-sm text-app-text-secondary mt-1 line-clamp-2">{profile.description}</div>
                    )}
                    <div className="mt-2 inline-flex items-center rounded-full border border-app-border px-2.5 py-1 text-xs font-semibold text-app-text-strong">
                      {ROLE_LABELS[m.role_base] || m.role_base}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/app/businesses/${m.business_user_id}/dashboard`}
                      className="px-3 py-2 rounded-lg border border-app-border text-sm font-semibold text-app-text hover:bg-app-hover transition"
                    >
                      Dashboard
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
