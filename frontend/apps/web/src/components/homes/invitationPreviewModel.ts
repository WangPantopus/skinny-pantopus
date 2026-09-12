export interface InvitationPreview {
  invitation: {
    id: string;
    status: 'pending' | 'accepted' | 'expired' | 'revoked';
    proposed_role?: string;
    expires_at?: string | null;
    created_at?: string;
    access_start_at?: string | null;
    access_end_at?: string | null;
  };
  home?: { id: string; name: string; city: string; home_type: string | null };
  inviter?: { name: string; username: string | null; profilePicture: string | null };
  expired?: boolean;
  alreadyUsed?: boolean;
}

const uuid = (value: unknown) => typeof value === 'string'
  && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

/** Terminal public previews deliberately omit Home and recipient details. */
export function validateInvitationPreview(value: unknown): asserts value is InvitationPreview {
  const preview = value as InvitationPreview | null;
  const invitation = preview?.invitation;
  let valid = !!invitation && uuid(invitation.id)
    && ['pending', 'accepted', 'expired', 'revoked'].includes(invitation.status)
    && (preview.expired === undefined || typeof preview.expired === 'boolean')
    && (preview.alreadyUsed === undefined || typeof preview.alreadyUsed === 'boolean');
  if (valid && invitation && preview) {
    if (invitation.status === 'pending') {
      valid = !preview.expired && !preview.alreadyUsed && !!preview.home && uuid(preview.home.id)
        && typeof preview.home.name === 'string'
        && typeof preview.home.city === 'string' && (preview.home.home_type === null || typeof preview.home.home_type === 'string')
        && typeof invitation.proposed_role === 'string' && invitation.proposed_role.trim().length > 0
        && date(invitation.created_at) && (invitation.expires_at === null || date(invitation.expires_at))
        && [invitation.access_start_at, invitation.access_end_at].every(value => value == null || date(value))
        && !!preview.inviter && typeof preview.inviter.name === 'string'
        && (preview.inviter.username === null || typeof preview.inviter.username === 'string')
        && (preview.inviter.profilePicture === null || typeof preview.inviter.profilePicture === 'string');
    } else {
      valid = preview.home === undefined && preview.inviter === undefined
        && preview.expired === (invitation.status === 'expired')
        && preview.alreadyUsed === (invitation.status === 'accepted');
    }
  }
  if (!valid) throw new Error('The invitation response could not be checked. Please retry.');
}

export function invitationReadFailure(error: unknown): { title: string; message: string } {
  const failure = error as { code?: string; response?: { data?: { code?: string } } } | null;
  const code = failure?.code ?? failure?.response?.data?.code;
  if (code === 'INVITE_NOT_FOUND' || code === 'INVITE_INVALID') return {
    title: 'Invitation not found', message: 'This link is unavailable. Check the complete link with the sender, or retry.',
  };
  if (code === 'INVITER_ACCESS_CHANGED') return {
    title: 'Invitation needs review', message: 'The sender’s current access no longer allows this invitation. Ask the household for a new invitation, or retry to check again.',
  };
  return { title: 'Could not load invitation', message: 'The invitation could not be checked right now. Retry to check its current status.' };
}
