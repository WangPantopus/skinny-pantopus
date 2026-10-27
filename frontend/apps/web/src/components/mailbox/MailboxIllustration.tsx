'use client';

// The household's mailbox on its post (Mail tab drawings: Main, R1-Before,
// R2-Delivery, R4-NoMail boards): closed with the flag down, or with the door
// open, empty or with today's stack inside. The house number sits on the door.

export type MailboxState = 'closed' | 'open-empty' | 'open-stack';

export default function MailboxIllustration({
  state = 'closed',
  number,
  size = 72,
  animate = false,
  className = '',
}: {
  state?: MailboxState;
  /** The house number painted on the door (blank when the address isn't known). */
  number?: string | null;
  size?: number;
  /** Play the delivery moment: the door drops open and the stack slides out. */
  animate?: boolean;
  className?: string;
}) {
  const open = state !== 'closed';
  const label = (number ?? '').slice(0, 6);
  return (
    <svg
      width={size}
      height={open ? size * 1.0833 : size}
      viewBox={open ? '0 0 120 130' : '0 0 120 120'}
      aria-hidden="true"
      className={`flex-shrink-0 ${className}`}
    >
      <rect x="54" y={open ? 104 : 92} width="12" height={open ? 26 : 28} rx="2" fill="#8a6a4a" />
      <path d="M18 94 V50 A42 42 0 0 1 102 50 V94 Z" fill="#0284c7" />
      <path d="M27 90 V53 A33 33 0 0 1 93 53 V90 Z" fill={open ? '#0b2537' : '#0369a1'} />
      {state === 'open-stack' ? (
        <g className={animate ? 'animate-mail-slide-out [animation-delay:300ms]' : undefined}>
          <rect x="35" y="66" width="50" height="16" rx="1.5" fill="#fbf6ea" transform="rotate(-4 60 74)" />
          <rect x="37" y="72" width="46" height="14" rx="1.5" fill="#ffffff" transform="rotate(3 60 79)" />
          <rect x="39" y="79" width="44" height="10" rx="1.5" fill="#0c4a6e" />
        </g>
      ) : null}
      {open ? (
        <>
          <polygon points="27,90 93,90 104,110 16,110" fill="#0369a1" className={animate ? 'origin-top animate-mail-door-open [transform-box:fill-box]' : undefined} />
          <rect x="51" y="102" width="18" height="5" rx="2.5" fill="#e0f2fe" />
        </>
      ) : (
        <>
          <rect x="51" y="38" width="18" height="6" rx="3" fill="#e0f2fe" />
          <rect x="40" y="68" width="40" height="13" rx="2" fill="#f8fafc" />
          {label ? (
            <text x="60" y="78" textAnchor="middle" fontFamily="ui-monospace, Menlo, monospace" fontSize="9" fontWeight="700" fill="#0f172a">{label}</text>
          ) : null}
        </>
      )}
      <rect x="102" y="64" width="16" height="7" rx="1.5" fill="#c2410c" />
    </svg>
  );
}
