'use client';

import { Check, ChevronDown, MessageSquare, UserPlus } from 'lucide-react';
import ProfileMenu from './ProfileMenu';
import { buttonRow, primaryButton, secondaryButton } from './profileButtons';

export type RelationshipState = 'none' | 'pending_sent' | 'pending_received' | 'connected' | 'blocked';

interface RelationshipActionsProps {
  /** The name this viewer sees, for "Rowan Park wants to connect". */
  name: string;
  relationship: RelationshipState;
  /** False until the relationship is read: Connect waits for it, and a failed read never offers it. */
  relationshipKnown: boolean;
  /** The read failed: only Message is offered. */
  relationshipFailed?: boolean;
  busy?: boolean;
  /** Your own profile previewed as someone else: the buttons show but do nothing. */
  inert?: boolean;
  onConnect: () => void;
  onWithdraw: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onDisconnect: () => void;
  onMessage: () => void;
}

const iconClass = 'w-[1.1875rem] h-[1.1875rem] shrink-0';

/**
 * Connect and Message, by where the two of you stand: none → Connect + Message; request sent → Requested (withdraw)
 * + Message; request received → "<name> wants to connect" with Accept / Not now, above Message; connected → Message +
 * Connected ▾ (Disconnect). Someone you blocked gets no buttons (the ⋯ menu unblocks).
 */
export default function RelationshipActions({
  name,
  relationship,
  relationshipKnown,
  relationshipFailed = false,
  busy = false,
  inert = false,
  onConnect,
  onWithdraw,
  onAccept,
  onDecline,
  onDisconnect,
  onMessage,
}: RelationshipActionsProps) {
  if (relationship === 'blocked') return null;
  const disabled = inert || busy;

  const message = (primary: boolean) => (
    <button type="button" onClick={onMessage} disabled={inert} className={primary ? primaryButton : secondaryButton}>
      <MessageSquare aria-hidden="true" className={iconClass} strokeWidth={2.25} />
      Message
    </button>
  );

  if (relationshipKnown && relationship === 'pending_received') {
    return (
      <div className="mt-[1.125rem] flex flex-col gap-2.5">
        <section aria-label={`${name} wants to connect`} className="rounded-2xl border border-app bg-surface p-4">
          <p className="text-base leading-[1.375rem] font-semibold text-app [overflow-wrap:anywhere]">{name} wants to connect</p>
          <p className="mt-0.5 text-[0.875rem] leading-5 text-app-muted">
            You&apos;ll see each other&apos;s connections-only posts and can invite each other to plans.
          </p>
          <div className={`mt-3 ${buttonRow}`}>
            <button type="button" onClick={onAccept} disabled={disabled} className={primaryButton}>
              Accept
            </button>
            <button type="button" onClick={onDecline} disabled={disabled} className={secondaryButton}>
              Not now
            </button>
          </div>
        </section>
        <div className="flex [&>button]:flex-1">{message(false)}</div>
      </div>
    );
  }

  let relationshipButton = null;
  if (!relationshipKnown && !relationshipFailed) {
    // Still reading where you stand: a quiet placeholder keeps the row from jumping.
    relationshipButton = (
      <button type="button" disabled aria-busy="true" className={primaryButton}>
        <UserPlus aria-hidden="true" className={iconClass} strokeWidth={2.25} />
        Connect
      </button>
    );
  } else if (relationshipKnown && relationship === 'none') {
    relationshipButton = (
      <button type="button" onClick={onConnect} disabled={disabled} aria-haspopup="dialog" className={primaryButton}>
        <UserPlus aria-hidden="true" className={iconClass} strokeWidth={2.25} />
        Connect
      </button>
    );
  } else if (relationshipKnown && relationship === 'pending_sent') {
    relationshipButton = (
      <button
        type="button"
        onClick={onWithdraw}
        disabled={disabled}
        aria-label="Requested. Withdraw your request"
        className={secondaryButton}
      >
        <Check aria-hidden="true" className={iconClass} strokeWidth={2.5} />
        Requested
      </button>
    );
  } else if (relationshipKnown && relationship === 'connected') {
    relationshipButton = (
      <ProfileMenu
        menuLabel={`Your connection with ${name}`}
        disabled={disabled}
        trigger={
          <>
            <Check aria-hidden="true" className={iconClass} strokeWidth={2.5} />
            Connected
            <ChevronDown aria-hidden="true" className="w-[0.9375rem] h-[0.9375rem] shrink-0" strokeWidth={2.5} />
          </>
        }
        triggerClassName={`${secondaryButton} w-full`}
        align="right"
        items={[{ key: 'disconnect', label: 'Disconnect', destructive: true, onSelect: onDisconnect }]}
      />
    );
  }

  // Connected people message first; everyone else connects first.
  const connected = relationshipKnown && relationship === 'connected';
  return (
    <div className={`mt-[1.125rem] ${buttonRow}`}>
      {connected ? (
        <>
          {message(true)}
          {relationshipButton}
        </>
      ) : (
        <>
          {relationshipButton}
          {message(false)}
        </>
      )}
    </div>
  );
}
