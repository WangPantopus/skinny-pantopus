'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import * as api from '@pantopus/api';
import type { HomeBusinessLink } from '@pantopus/api';
import type { HomeVendor, BusinessUser } from '@pantopus/types';
import { Building2, Star } from 'lucide-react';
import { toast } from '@/components/ui/toast-store';
import { confirmStore } from '@/components/ui/confirm-store';

export default function VendorsTab({ homeId }: { homeId: string }) {
  type BusinessLinkKind = HomeBusinessLink['kind'];
  const [linkedBusinesses, setLinkedBusinesses] = useState<HomeBusinessLink[]>([]);
  const [legacyVendors, setLegacyVendors] = useState<HomeVendor[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BusinessUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [linkKind, setLinkKind] = useState<BusinessLinkKind>('favorite');

  const [showAddManual, setShowAddManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bizRes, vendorRes] = await Promise.allSettled([
        api.homeProfile.getHomeBusinessLinks(homeId),
        api.homeProfile.getHomeVendors(homeId),
      ]);
      if (bizRes.status === 'fulfilled') setLinkedBusinesses(bizRes.value.links || []);
      if (vendorRes.status === 'fulfilled') setLegacyVendors(vendorRes.value.vendors || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [homeId]);

  useEffect(() => { loadAll(); }, [homeId, loadAll]);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.homeProfile.searchBusinesses(homeId, searchQuery);
        setSearchResults(res.results || []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, homeId]);

  const handleLinkBusiness = async (businessUserId: string) => {
    try {
      await api.homeProfile.linkBusiness(homeId, {
	        business_user_id: businessUserId,
	        kind: linkKind,
      });
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to link business');
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    const yes = await confirmStore.open({ title: 'Remove this business link?', confirmLabel: 'Remove', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.homeProfile.removeBusinessLink(homeId, linkId);
      setLinkedBusinesses((prev) => prev.filter((l) => l.id !== linkId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    }
  };

  const handleAddManualVendor = async () => {
    if (!manualName.trim()) return;
    try {
      await api.homeProfile.createHomeVendor(homeId, {
        name: manualName.trim(),
        service_category: manualCategory || undefined,
        phone: manualPhone || undefined,
        notes: manualNotes || undefined,
      });
      setManualName('');
      setManualCategory('');
      setManualPhone('');
      setManualNotes('');
      setShowAddManual(false);
      loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add vendor');
    }
  };

  const kindColors: Record<string, string> = {
    favorite: 'bg-pink-50 text-pink-700 border-pink-200',
    vendor: 'bg-blue-50 text-blue-700 border-blue-200',
    building_amenity: 'bg-green-50 text-green-700 border-green-200',
    recommended: 'bg-amber-50 text-amber-700 border-amber-200',
    blocked: 'bg-red-50 text-red-700 border-red-200',
  };

  if (loading) {
    return <div className="text-center py-12 text-app-muted text-sm">Loading vendors…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-app">Vendors & Businesses</h2>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowSearch(!showSearch); setShowAddManual(false); }}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition"
          >
            + Link Business
          </button>
          <button
            onClick={() => { setShowAddManual(!showAddManual); setShowSearch(false); }}
            className="px-3 py-1.5 rounded-lg border border-app-strong text-xs font-semibold text-app-strong hover:bg-surface-raised transition"
          >
            + Manual Vendor
          </button>
        </div>
      </div>

      {showSearch && (
        <div className="bg-surface rounded-xl border border-app p-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search businesses by name or username…"
              className="flex-1 rounded-lg border border-app-strong px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              autoFocus
            />
            <select
              value={linkKind}
	              onChange={(e) => setLinkKind(e.target.value as BusinessLinkKind)}
              className="rounded-lg border border-app-strong px-2 py-2 text-xs"
            >
              <option value="favorite">Favorite</option>
              <option value="vendor">Vendor</option>
              <option value="recommended">Recommended</option>
              <option value="building_amenity">Amenity</option>
            </select>
          </div>

          {searching && <p className="text-xs text-app-muted">Searching…</p>}

          {searchResults.length > 0 && (
            <div className="divide-y divide-app">
              {searchResults.map((biz) => (
                <div key={biz.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    {biz.profile_picture_url ? (
                      <Image src={biz.profile_picture_url} alt="" className="w-8 h-8 rounded-lg object-cover" width={32} height={32} sizes="32px" quality={75} />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 text-xs font-bold">
                        {(biz.name || 'B')[0]}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-app">{biz.name}</div>
                      <div className="text-[10px] text-app-muted">
                        @{biz.username}
	                        {(biz.profile?.categories?.length || 0) > 0 && ` · ${biz.profile?.categories?.[0]}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLinkBusiness(biz.id)}
                    className="px-3 py-1 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-app-muted">No businesses found.</p>
          )}
        </div>
      )}

      {showAddManual && (
        <div className="bg-surface rounded-xl border border-app p-4 space-y-3">
          <h3 className="text-sm font-semibold text-app">Add Manual Vendor</h3>
          <input
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Vendor name *"
            className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={manualCategory}
              onChange={(e) => setManualCategory(e.target.value)}
              placeholder="Category (e.g. Plumber)"
              className="rounded-lg border border-app-strong px-3 py-2 text-sm"
            />
            <input
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="Phone number"
              className="rounded-lg border border-app-strong px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-app-strong px-3 py-2 text-sm resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAddManual(false)} className="px-3 py-1.5 text-xs text-app-secondary hover:text-app-strong">Cancel</button>
            <button
              onClick={handleAddManualVendor}
              disabled={!manualName.trim()}
              className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition"
            >
              Add Vendor
            </button>
          </div>
        </div>
      )}

      {linkedBusinesses.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-secondary uppercase tracking-wider mb-2">Linked Businesses</h3>
          <div className="space-y-2">
            {linkedBusinesses.map((link) => (
              <div key={link.id} className="bg-surface rounded-xl border border-app p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {link.business?.profile_picture_url ? (
                    <Image src={link.business.profile_picture_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" width={40} height={40} sizes="40px" quality={75} />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 font-bold flex-shrink-0">
                      {(link.business?.name || 'B')[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a href={`/${link.business?.username}`} className="text-sm font-semibold text-app hover:text-violet-600 transition truncate">
                        {link.business?.name || 'Business'}
                      </a>
                      <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 border capitalize ${kindColors[link.kind] || kindColors.favorite}`}>
                        {link.kind.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-app-muted truncate">
                      @{link.business?.username}
	                      {(link.business?.average_rating ?? 0) > 0 && <><span> · </span><Star className="w-3 h-3 inline fill-current" /><span> {link.business?.average_rating?.toFixed(1)}</span></>}
	                      {(link.profile?.categories?.length || 0) > 0 && ` · ${link.profile?.categories?.join(', ')}`}
                    </div>
                    {link.notes && (
                      <div className="text-xs text-app-secondary mt-0.5 italic truncate">{link.notes}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveLink(link.id)}
                  className="text-app-muted hover:text-red-500 p-1 flex-shrink-0"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {legacyVendors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-app-secondary uppercase tracking-wider mb-2">Manual Vendors</h3>
          <div className="space-y-2">
            {legacyVendors.map((v) => (
              <div key={v.id} className="bg-surface rounded-xl border border-app p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-app">{v.name}</span>
                      {v.trusted && (
                        <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Trusted</span>
                      )}
                      {v.service_category && (
                        <span className="text-[10px] text-app-secondary bg-surface-muted rounded-full px-2 py-0.5">{v.service_category}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-app-secondary">
                      {v.phone && (
                        <a href={`tel:${v.phone}`} className="text-violet-600 hover:underline">{v.phone}</a>
                      )}
                      {v.email && (
                        <a href={`mailto:${v.email}`} className="text-violet-600 hover:underline">{v.email}</a>
                      )}
                      {v.website && (
                        <a href={v.website} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">Website</a>
                      )}
                    </div>
                    {v.notes && (
                      <div className="text-xs text-app-muted mt-1">{v.notes}</div>
                    )}
                    {v.rating && (
                      <div className="flex items-center gap-0.5 text-yellow-500 mt-0.5">{Array.from({ length: v.rating }, (_, i) => <Star key={`f${i}`} className="w-3 h-3 fill-current" />)}{Array.from({ length: 5 - v.rating }, (_, i) => <Star key={`e${i}`} className="w-3 h-3" />)}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {linkedBusinesses.length === 0 && legacyVendors.length === 0 && !showSearch && !showAddManual && (
        <div className="text-center py-12 bg-surface rounded-xl border border-app">
          <div className="mb-2 flex justify-center"><Building2 className="w-8 h-8 text-app-muted" /></div>
          <h3 className="text-sm font-semibold text-app-strong">No vendors yet</h3>
          <p className="text-xs text-app-muted mt-1 max-w-xs mx-auto">
            Link Pantopus businesses or add manual vendors to keep track of your trusted service providers.
          </p>
        </div>
      )}
    </div>
  );
}
