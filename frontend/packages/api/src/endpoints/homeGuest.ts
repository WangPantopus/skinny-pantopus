// ============================================================
// HOME GUEST ENDPOINTS (Public — no auth required)
// Guest pass viewing and shared resource access
// ============================================================

import { get } from '../client';

// ---- Types ----

export interface GuestPassView {
  pass: {
    label: string;
    kind: string;
    custom_title: string | null;
    expires_at: string | null;
    home_name: string | null;
    welcome_message: string | null;
  };
  sections: {
    wifi?: { network_name: string; password: string } | { network_name: string; password: string }[];
    parking?: string | null;
    house_rules?: string | null;
    entry_instructions?: string | null;
    trash_day?: string | null;
    local_tips?: string | null;
    emergency?: any[];
    docs?: any[];
  };
}

export interface SharedResourceView {
  grant: {
    resource_type: string;
    can_view: boolean;
    can_edit: boolean;
    expires_at: string | null;
  };
  resource: Record<string, any>;
}

export interface PasscodeRequired {
  requiresPasscode: true;
  error: string;
}

// ---- Guest Pass View ----

/**
 * View a guest pass by token (public — no auth required).
 * Returns 403 with { requiresPasscode: true } if a passcode is needed.
 */
export async function viewGuestPass(token: string, passcode?: string): Promise<GuestPassView> {
  const params = passcode ? { passcode } : undefined;
  return get<GuestPassView>(`/api/homes/guest/${token}`, params);
}

// ---- Shared Resource View ----

/**
 * View a shared resource by scoped grant token (public — no auth required).
 * Returns 403 with { requiresPasscode: true } if a passcode is needed.
 */
export async function viewSharedResource(token: string, passcode?: string): Promise<SharedResourceView> {
  const params = passcode ? { passcode } : undefined;
  return get<SharedResourceView>(`/api/homes/shared/${token}`, params);
}
