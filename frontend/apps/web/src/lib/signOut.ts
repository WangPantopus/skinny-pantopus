import * as api from '@pantopus/api';
import { clearAuthToken } from '@pantopus/api';
import { clearPendingPlaces } from '@/components/place/pendingPlace';
import { toast } from '@/components/ui/toast-store';
import { hardNavigate } from '@/lib/session-refresh';

/** Logs this browser out (Settings → Log Out, and Log out on your profile), then opens the sign-in page. */
export async function signOut(): Promise<void> {
  try {
    await api.auth.logout();
  } catch (err) {
    // Logout's Clear-Site-Data or a concurrent revocation can change the
    // session marker before its response arrives. Finish navigation if the
    // server already cleared the session cookie; preserve a newer sign-in.
    if ((err as { code?: string } | null)?.code === 'AUTH_SESSION_CHANGED') {
      const hasSessionCookie = document.cookie.split(';').some((cookie) => cookie.trim() === 'pantopus_session=1');
      if (!hasSessionCookie) {
        clearPendingPlaces();
        clearAuthToken();
        hardNavigate('/login');
      }
      return;
    }
    toast.error('Could not confirm sign-out. Please try again.');
    return;
  }
  clearPendingPlaces();
  clearAuthToken();
  hardNavigate('/login');
}
