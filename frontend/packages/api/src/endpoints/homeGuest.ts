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
  return get<GuestPassView>(`/api/homes/guest/${token}`, undefined, passcodeConfig(passcode));
}

// The passcode travels percent-encoded in a header, never in the URL, so no URL
// log (CDN, load balancer, server) records it.
function passcodeConfig(passcode?: string) {
  return passcode ? { headers: { 'X-Pantopus-Share-Passcode': encodeURIComponent(passcode) } } : undefined;
}

// ---- Shared Resource View ----

/**
 * View a shared resource by scoped grant token (public — no auth required).
 * Returns 403 with { requiresPasscode: true } if a passcode is needed.
 */
export async function viewSharedResource(token: string, passcode?: string): Promise<SharedResourceView> {
  return get<SharedResourceView>(`/api/homes/shared/${token}`, undefined, passcodeConfig(passcode));
}
