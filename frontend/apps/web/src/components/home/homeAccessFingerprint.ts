import { homeIam } from '@pantopus/api';

/** The authority shared by the data loader and navigation provider must agree. */
export function homeAccessFingerprint(access: homeIam.HomeAccess): string {
  return JSON.stringify({
    hasAccess: access.hasAccess,
    expiresAt: access.access_expires_at,
    permissions: [...access.permissions].sort(),
    role: access.effective_role_base ?? access.role_base,
    owner: access.isOwner,
    verification: access.verification_status,
    verificationRequired: access.verification_required === true,
    verificationKind: access.verification_kind,
    age: access.age_band,
    occupancy: access.occupancy,
  });
}

export function homeAccessExpiry(access: homeIam.HomeAccess): number | null {
  if (access.access_expires_at == null) return null;
  const expiry = typeof access.access_expires_at === 'string' ? Date.parse(access.access_expires_at) : NaN;
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    throw new Error('Home access changed or could not be confirmed. Reload to check current access.');
  }
  return expiry;
}

/** Keep long-lived timers within the browser limit and recheck the saved date. */
export function watchHomeAccessExpiry(expiry: number | null, retire: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    if (expiry === null) return;
    const remaining = expiry - Date.now();
    if (remaining <= 0) retire();
    else timer = setTimeout(check, Math.min(remaining, 2_147_483_647));
  };
  check();
  return () => clearTimeout(timer);
}

/** A current applicant may open verification; this never authorizes Home data. */
export async function readCurrentHomeAccess(homeId: string): Promise<homeIam.HomeAccess> {
  try {
    return await homeIam.getMyHomeAccess(homeId);
  } catch (failure) {
    const error = failure as { statusCode?: number; data?: { verification_required?: boolean; verification_status?: string; verification_kind?: 'ownership' | 'residency' } };
    const status = error?.data?.verification_status;
    if (error?.statusCode !== 403 || error.data?.verification_required !== true || !status ||
      !['unverified', 'provisional', 'provisional_bootstrap', 'pending_doc', 'pending_postcard', 'pending_approval', 'pending', 'none'].includes(status)) throw failure;
    return {
      hasAccess: false, isOwner: false, role_base: null, effective_role_base: null, permissions: [], occupancy: null,
      verification_required: true, verification_status: status, verification_kind: error.data.verification_kind,
    };
  }
}
