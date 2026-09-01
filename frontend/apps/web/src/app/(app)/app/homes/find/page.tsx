'use client';

import { Suspense, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Home, ChevronRight, PlusCircle, QrCode } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

function FindContent() {
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.homes.discoverHomes({ q: query.trim() });
      setResults(res.homes || []);
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleInviteCode = useCallback(async () => {
    if (!inviteCode.trim()) return;
    try {
      const res = await api.homes.getInviteByToken(inviteCode.trim());
      if (res.invitation?.home_id) {
        router.push(`/app/homes/${res.invitation.home_id}`);
      } else {
        toast.error('Invalid invite code');
      }
    } catch {
      toast.error('Invalid invite code');
    }
  }, [inviteCode, router]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition">
          <ArrowLeft className="w-5 h-5 text-app-text" />
        </button>
        <h1 className="text-xl font-bold text-app-text">Find or Add Home</h1>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-app-surface border border-app-border rounded-xl px-3.5 py-2.5 mb-4">
        <Search className="w-4 h-4 text-app-text-muted flex-shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by address, city, or zip..."
          className="flex-1 text-sm text-app-text bg-transparent outline-none placeholder:text-app-text-muted"
        />
        <button onClick={handleSearch} disabled={query.trim().length < 2}
          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition">
          Search
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-7 w-7 border-2 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-2 mb-6">
          {results.map((home: any) => (
            <button key={home.id} onClick={() => router.push(`/app/homes/${home.id}/claim-owner`)}
              className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-xl p-4 hover:bg-app-hover transition text-left">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Home className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-app-text truncate">{home.address}</p>
                <p className="text-xs text-app-text-secondary mt-0.5">{[home.city, home.state, home.zipcode].filter(Boolean).join(', ')}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-app-text-muted flex-shrink-0" />
            </button>
          ))}
        </div>
      ) : searched ? (
        <div className="text-center py-12">
          <p className="text-sm text-app-text-secondary mb-4">No homes found</p>
          <button onClick={() => router.push('/app/homes/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-200 transition">
            <PlusCircle className="w-4 h-4" /> Add a new home
          </button>
        </div>
      ) : null}

      {/* Invite code section */}
      <div className="border-t border-app-border pt-4">
        <button onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 mb-3">
          <QrCode className="w-4 h-4" /> Have an invite code?
        </button>

        {showInvite && (
          <div className="flex gap-2">
            <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInviteCode()}
              placeholder="Enter invite code"
              className="flex-1 px-3 py-2.5 border border-app-border rounded-lg text-sm text-app-text bg-app-surface placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            <button onClick={handleInviteCode}
              className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
              Go
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FindHomePage() { return <Suspense><FindContent /></Suspense>; }
