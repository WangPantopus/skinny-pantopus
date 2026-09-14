import { homeIam } from '@pantopus/api';

/** The authority shared by the data loader and navigation provider must agree. */
export function homeAccessFingerprint(access: homeIam.HomeAccess): string {
  return JSON.stringify({
    hasAccess: access.hasAccess,
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
