import * as api from '@pantopus/api';

/** Where signing in lands when it isn't headed anywhere in particular (the auth pages' default). */
const DEFAULT_LANDING = '/app/place';

/**
 * Where to go right after signing in or up. Someone invited to a household by email before they had an account, who
 * signed up without the email's button, lands on that invitation instead of the default landing, once (the server's
 * GET /api/homes/invitations/next, as the apps ask after a fresh sign-in). A sign-in headed somewhere in particular
 * (an invite page, a plan, a place being previewed) keeps its destination; any failure keeps the default.
 */
export async function landingAfterSignIn(redirectTo: string): Promise<string> {
  if (redirectTo !== DEFAULT_LANDING) return redirectTo;
  try {
    const { token } = await api.homes.getNextHomeInvitation();
    return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? `/invite/${token}` : redirectTo;
  } catch {
    return redirectTo;
  }
}
