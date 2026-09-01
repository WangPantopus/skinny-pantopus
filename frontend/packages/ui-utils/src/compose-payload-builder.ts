// ============================================================
// COMPOSE PAYLOAD BUILDER
// Maps human-readable ComposeState into the ComputedBackendPayload
// accepted by POST /api/mailbox/send.
// The user never sees backend field names — this module is the bridge.
// ============================================================

import type {
  ComposeState,
  ComputedBackendPayload,
  MailIntent,
  VisibilityMode,
} from '@pantopus/types';

// ─── Internal mapping tables ───────────────────────────────

const VISIBILITY_MAP: Record<VisibilityMode, 'attn_only' | 'home_members' | 'attn_plus_admins'> = {
  private_to_recipient: 'attn_only',
  household_visible: 'home_members',
  recipient_plus_admins: 'attn_plus_admins',
};

type MailEnvelopeType = 'letter' | 'bill' | 'notice' | 'package' | 'document' | 'promotion';

const INTENT_TO_ENVELOPE_TYPE: Record<MailIntent, MailEnvelopeType> = {
  personal_note: 'letter',
  bill_request: 'bill',
  household_notice: 'notice',
  package_pickup: 'package',
  document: 'document',
  certified_signature: 'document',
  offer_promotion: 'promotion',
};

// ─── Content assembly ──────────────────────────────────────

function assembleLetterContent(draft: ComposeState['contentDraft']): string {
  const parts: string[] = [];
  if (draft.salutation) parts.push(draft.salutation);
  if (draft.body) parts.push(draft.body);
  if (draft.closing) parts.push(draft.closing);
  if (draft.signature) parts.push(draft.signature);
  return parts.join('\n\n');
}

function collectAttachments(state: ComposeState): string[] | undefined {
  const attachments: string[] = [];
  if (state.voicePostscriptUri) {
    attachments.push(state.voicePostscriptUri);
  }
  if (state.photoAttachments.length > 0) {
    attachments.push(...state.photoAttachments);
  }
  return attachments.length > 0 ? attachments : undefined;
}

// ─── Payload builder ───────────────────────────────────────

/**
 * Transforms the human-readable ComposeState into the ComputedBackendPayload
 * that the POST /api/mailbox/send endpoint expects.
 *
 * Design principle: the user never sees delivery_visibility, object_format,
 * or any other backend field name. This function is the only place where
 * human choices map to backend values.
 */
export function buildBackendPayload(state: ComposeState): ComputedBackendPayload {
  const intent = state.mailIntent!;
  const outcomes = state.outcomes;

  // --- Destination block ---
  const destination: ComputedBackendPayload['destination'] =
    state.destinationHomeId
      ? {
          deliveryTargetType: 'home',
          homeId: state.destinationHomeId,
          ...(state.destinationUserId && { attnUserId: state.destinationUserId }),
          visibility: VISIBILITY_MAP[state.visibilityMode],
        }
      : undefined;

  // --- Recipient block ---
  const recipientMode =
    state.destinationMode === 'self_at_home'
      ? 'self'
      : state.destinationUserId
        ? 'user'
        : 'home';

  const recipient: ComputedBackendPayload['recipient'] = {
    mode: recipientMode as 'self' | 'user' | 'home',
    ...(state.destinationUserId && { userId: state.destinationUserId }),
    ...(state.destinationHomeId && { homeId: state.destinationHomeId }),
  };

  // --- Envelope block ---
  const needsAck =
    outcomes.includes('acknowledge') ||
    outcomes.includes('sign_confirm') ||
    intent === 'certified_signature';

  const envelope: ComputedBackendPayload['envelope'] = {
    type: INTENT_TO_ENVELOPE_TYPE[intent],
    ...(state.contentDraft.subject && { subject: state.contentDraft.subject }),
    ...(needsAck && { ackRequired: true }),
  };

  // Bill/Request: payout amount from subject field (used as the amount field)
  if (outcomes.includes('pay_now') && state.contentDraft.subject) {
    const amount = parseFloat(state.contentDraft.subject);
    if (!Number.isNaN(amount) && amount > 0) {
      envelope.payoutAmount = amount;
    }
  }

  // --- Object block ---
  const attachments = collectAttachments(state);
  const objectBlock: ComputedBackendPayload['object'] = {
    format: 'plain_text',
    content: assembleLetterContent(state.contentDraft),
    ...(state.contentDraft.subject && { title: state.contentDraft.subject }),
    ...(attachments && { attachments }),
    payload: {
      stationeryTheme: state.stationeryTheme,
      inkSelection: state.inkSelection,
      outcomes: state.outcomes,
      ...(state.voicePostscriptUri && { voicePostscriptUri: state.voicePostscriptUri }),
    },
  };

  // --- Policy block ---
  const policy: ComputedBackendPayload['policy'] = {};
  if (needsAck) {
    policy.ackRequired = true;
  }
  if (outcomes.includes('pay_now') && envelope.payoutAmount) {
    policy.payoutAmount = envelope.payoutAmount;
  }

  // --- Tracking block ---
  const tracking: ComputedBackendPayload['tracking'] = {
    composeSource: 'four_moment_flow',
    mailIntent: intent,
    outcomeSelections: outcomes,
  };

  return {
    destination,
    recipient,
    envelope,
    object: objectBlock,
    ...(Object.keys(policy).length > 0 && { policy }),
    tracking,
  };
}

// ─── Validation ────────────────────────────────────────────

/**
 * Validates required fields per mail intent before send.
 * Returns human-readable errors — never backend field names.
 */
export function validateComposeState(state: ComposeState): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Universal requirements
  if (!state.mailIntent) {
    errors.push('Please choose what kind of mail you are sending.');
  }
  if (!state.destinationHomeId && !state.destinationUserId) {
    errors.push('Please choose who this mail is for.');
  }

  // Intent-specific validation
  if (state.mailIntent) {
    switch (state.mailIntent) {
      case 'personal_note':
        if (!state.contentDraft.body.trim()) {
          errors.push('Your note needs a message. Write something worth sending.');
        }
        break;

      case 'bill_request': {
        const amount = parseFloat(state.contentDraft.subject);
        if (!state.contentDraft.subject.trim() || Number.isNaN(amount) || amount <= 0) {
          errors.push('Please enter an amount for the bill.');
        }
        break;
      }

      case 'certified_signature':
        if (!state.contentDraft.subject.trim()) {
          errors.push('Certified mail requires a subject line.');
        }
        break;

      case 'household_notice':
        if (!state.contentDraft.body.trim()) {
          errors.push('Your notice needs a message.');
        }
        break;

      case 'document':
        if (!state.contentDraft.subject.trim()) {
          errors.push('Please add a title for the document.');
        }
        break;

      case 'package_pickup':
        if (!state.contentDraft.body.trim()) {
          errors.push('Please add delivery details or instructions.');
        }
        break;

      case 'offer_promotion':
        if (!state.contentDraft.subject.trim()) {
          errors.push('Your offer needs a headline.');
        }
        break;
    }
  }

  // Photo limit check (max 2 per design doc)
  if (state.photoAttachments.length > 2) {
    errors.push('Maximum 2 photos per mail.');
  }

  return { valid: errors.length === 0, errors };
}
