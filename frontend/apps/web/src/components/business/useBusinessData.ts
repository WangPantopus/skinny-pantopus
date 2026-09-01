import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type {
  BusinessUser,
  BusinessProfile,
  BusinessLocation,
  OnboardingStatus,
  FoundingOfferStatus,
  BusinessDashboardResponse,
} from '@pantopus/api';

interface BusinessAccess {
  hasAccess: boolean;
  isOwner: boolean;
  role_base: string | null;
}

export interface UseBusinessDataReturn {
  business: BusinessUser | null;
  profile: BusinessProfile | null;
  locations: BusinessLocation[];
  team: Record<string, any>[];
  catalog: Record<string, any>[];
  pages: Record<string, any>[];
  access: BusinessAccess;
  onboarding: OnboardingStatus | null;
  foundingOffer: FoundingOfferStatus | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}

export function useBusinessData(businessId: string): UseBusinessDataReturn {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [business, setBusiness] = useState<BusinessUser | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [team, setTeam] = useState<Record<string, any>[]>([]);
  const [catalog, setCatalog] = useState<Record<string, any>[]>([]);
  const [pages, setPages] = useState<Record<string, any>[]>([]);
  const [access, setAccess] = useState<BusinessAccess>({ hasAccess: false, isOwner: false, role_base: null });
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [foundingOffer, setFoundingOffer] = useState<FoundingOfferStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) { router.push('/login'); return; }

      const [res, foundingRes] = await Promise.all([
        api.businesses.getBusinessDashboard(businessId) as Promise<BusinessDashboardResponse>,
        api.businesses.getFoundingOfferStatus().catch(() => null),
      ]);
      setBusiness(res.business);
      setProfile(res.profile);
      setLocations(res.locations || []);
      setTeam(res.team || []);
      setCatalog(res.catalog || []);
      setPages(res.pages || []);
      setAccess(res.access || { hasAccess: false, isOwner: false, role_base: null });
      setOnboarding(res.onboarding || null);
      if (foundingRes) setFoundingOffer(foundingRes);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load dashboard';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [businessId, router]);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    business,
    profile,
    locations,
    team,
    catalog,
    pages,
    access,
    onboarding,
    foundingOffer,
    loading,
    error,
    refresh,
  };
}
