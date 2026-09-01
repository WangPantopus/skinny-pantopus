'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, Home, Building2, Link as LinkIcon, ChevronRight, ChevronDown, ChevronUp, MapPin, Loader2, PlusCircle } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

export type PostingTarget =
  | { type: 'current_location'; latitude: number; longitude: number; label: string }
  | { type: 'home'; homeId: string; latitude: number; longitude: number; label: string }
  | { type: 'business'; businessId: string; latitude: number; longitude: number; label: string }
  | { type: 'connections' };

interface PostTargetPickerProps {
  open: boolean;
  onSelect: (target: PostingTarget) => void;
  onClose: () => void;
}

interface HomeItem { id: string; label: string; latitude: number; longitude: number; }
interface BusinessItem { id: string; name: string; latitude: number; longitude: number; label: string; }

export default function PostTargetPicker({ open, onSelect, onClose }: PostTargetPickerProps) {
  const [homes, setHomes] = useState<HomeItem[]>([]);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [locating, setLocating] = useState(false);
  const [expanded, setExpanded] = useState<'home' | 'business' | null>(null);

  useEffect(() => {
    if (!open) { setExpanded(null); return; }
    let cancelled = false;
    setLoadingData(true);

    Promise.all([
      api.homes.getMyHomes().catch(() => ({ homes: [] })),
      api.businesses.getMyBusinesses().catch(() => ({ businesses: [] })),
    ]).then(async ([homesRes, bizRes]) => {
      if (cancelled) return;
      const mappedHomes: HomeItem[] = ((homesRes as any).homes || [])
        .filter((h: any) => h.location?.latitude || h.location?.coordinates?.length === 2)
        .map((h: any) => ({
          id: h.id,
          label: [h.city, h.state].filter(Boolean).join(', ') || 'Home',
          latitude: Number(h.location?.latitude ?? h.location?.coordinates?.[1]),
          longitude: Number(h.location?.longitude ?? h.location?.coordinates?.[0]),
        }));

      setHomes(mappedHomes);

      // Load business locations (requires per-business fetch like mobile)
      const bizMembers = ((bizRes as any).businesses || []).filter((m: any) => m.business);
      const mappedBiz: BusinessItem[] = [];
      for (const m of bizMembers) {
        const b = m.business;
        try {
          const bizData = await api.businesses.getBusiness(b.id);
          const primary = ((bizData as any).locations || []).find((l: any) => l.is_primary) || ((bizData as any).locations || [])[0];
          if (primary?.location?.latitude && primary?.location?.longitude) {
            mappedBiz.push({
              id: b.id, name: b.name,
              latitude: primary.location.latitude, longitude: primary.location.longitude,
              label: [primary.city, primary.state].filter(Boolean).join(', ') || b.name,
            });
          }
        } catch { /* skip businesses without locations */ }
      }
      setBusinesses(mappedBiz);
      setLoadingData(false);
    });

    return () => { cancelled = true; };
  }, [open]);

  const handleCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }),
      );
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      let label = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
      try {
        const result = await api.geo.reverseGeocode(lat, lng);
        if (result?.normalized) {
          const parts = [result.normalized.city, result.normalized.state].filter(Boolean);
          if (parts.length) label = parts.join(', ');
        }
      } catch { /* keep coord fallback */ }
      onSelect({ type: 'current_location', latitude: lat, longitude: lng, label });
    } catch { toast.error('Could not get your location'); }
    finally { setLocating(false); }
  }, [onSelect]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-app-surface rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <button onClick={onClose} className="text-sm text-app-text-secondary">Cancel</button>
          <h2 className="text-base font-semibold text-app-text">Post To</h2>
          <div className="w-12" />
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className="text-sm font-bold text-app-text px-5 pt-4 pb-2">Where do you want to post?</p>

          {/* Current Location */}
          <OptionRow icon={Navigation} iconBg="bg-blue-100" iconColor="text-blue-600" label="Current Location" desc="Post to the area where you are right now"
            onClick={handleCurrentLocation} loading={locating} />

          {/* Home */}
          {loadingData ? (
            <OptionRow icon={Home} iconBg="bg-green-100" iconColor="text-green-600" label="Home Area" desc="Loading..." disabled />
          ) : homes.length > 0 ? (
            <>
              <OptionRow icon={Home} iconBg="bg-green-100" iconColor="text-green-600" label="Home Area"
                desc={homes.length === 1 ? homes[0].label : `${homes.length} homes`}
                onClick={() => homes.length === 1 ? onSelect({ type: 'home', homeId: homes[0].id, latitude: homes[0].latitude, longitude: homes[0].longitude, label: homes[0].label }) : setExpanded(expanded === 'home' ? null : 'home')}
                trailing={homes.length > 1 ? (expanded === 'home' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : undefined} />
              {expanded === 'home' && homes.map((h) => (
                <button key={h.id} onClick={() => onSelect({ type: 'home', homeId: h.id, latitude: h.latitude, longitude: h.longitude, label: h.label })}
                  className="flex items-center gap-2 pl-16 pr-5 py-3 bg-app-surface-sunken hover:bg-app-hover w-full text-left">
                  <MapPin className="w-4 h-4 text-app-text-secondary" /><span className="flex-1 text-sm text-app-text">{h.label}</span><ChevronRight className="w-4 h-4 text-app-text-muted" />
                </button>
              ))}
            </>
          ) : (
            <OptionRow icon={Home} iconBg="bg-green-100" iconColor="text-green-600" label="Home Area" desc="Add a home to post here" disabled
              trailing={<PlusCircle className="w-4 h-4 text-app-text-muted" />} />
          )}

          {/* Business */}
          {!loadingData && businesses.length > 0 && (
            <>
              <OptionRow icon={Building2} iconBg="bg-purple-100" iconColor="text-purple-600" label="Business Area"
                desc={businesses.length === 1 ? businesses[0].name : `${businesses.length} businesses`}
                onClick={() => businesses.length === 1 ? onSelect({ type: 'business', businessId: businesses[0].id, latitude: businesses[0].latitude, longitude: businesses[0].longitude, label: businesses[0].label }) : setExpanded(expanded === 'business' ? null : 'business')}
                trailing={businesses.length > 1 ? (expanded === 'business' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : undefined} />
              {expanded === 'business' && businesses.map((b) => (
                <button key={b.id} onClick={() => onSelect({ type: 'business', businessId: b.id, latitude: b.latitude, longitude: b.longitude, label: b.label })}
                  className="flex items-center gap-2 pl-16 pr-5 py-3 bg-app-surface-sunken hover:bg-app-hover w-full text-left">
                  <MapPin className="w-4 h-4 text-app-text-secondary" /><span className="flex-1 text-sm text-app-text">{b.name}</span><ChevronRight className="w-4 h-4 text-app-text-muted" />
                </button>
              ))}
            </>
          )}

          <div className="h-px bg-app-border mx-5 my-2" />

          {/* Connections */}
          <OptionRow icon={LinkIcon} iconBg="bg-orange-100" iconColor="text-orange-600" label="Connections" desc="Share with people you trust"
            onClick={() => onSelect({ type: 'connections' })} />
        </div>
      </div>
    </div>
  );
}

function OptionRow({ icon: Icon, iconBg, iconColor, label, desc, onClick, loading, disabled, trailing }: {
  icon: typeof Navigation; iconBg: string; iconColor: string; label: string; desc?: string;
  onClick?: () => void; loading?: boolean; disabled?: boolean; trailing?: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={`flex items-center gap-3 px-5 py-3.5 w-full text-left hover:bg-app-hover transition ${disabled ? 'opacity-50' : ''}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-app-text">{label}</p>
        {desc && <p className="text-xs text-app-text-secondary mt-0.5">{desc}</p>}
      </div>
      {loading ? <Loader2 className="w-4 h-4 text-app-text-muted animate-spin" /> : trailing || <ChevronRight className="w-4 h-4 text-app-text-muted" />}
    </button>
  );
}
