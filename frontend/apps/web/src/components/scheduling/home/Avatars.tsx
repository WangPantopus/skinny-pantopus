"use client";

// Household member avatars (gradient initials fallback + overlapping stack),
// matching the W10 design. Shared by agenda rows, the detail attendee list, and
// the assign-to picker.

import type { HomeMember } from "./helpers";

export function Avatar({
  member,
  size = 28,
  dim = false,
}: {
  member: HomeMember;
  size?: number;
  dim?: boolean;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-app-surface font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        letterSpacing: "-0.02em",
        background: member.avatarUrl ? undefined : member.gradient,
        opacity: dim ? 0.4 : 1,
      }}
      title={member.name}
      aria-label={member.name}
    >
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.avatarUrl}
          alt={member.name}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        member.initials
      )}
    </div>
  );
}

export function AvatarStack({
  members,
  size = 26,
  max = 4,
}: {
  members: HomeMember[];
  size?: number;
  max?: number;
}) {
  if (!members.length) return null;
  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <div
          key={m.id}
          style={{ marginLeft: i === 0 ? 0 : -9, zIndex: shown.length - i }}
        >
          <Avatar member={m} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <div
          className="flex shrink-0 items-center justify-center rounded-full border-2 border-app-surface bg-app-surface-sunken font-bold text-app-text-muted"
          style={{
            marginLeft: -9,
            width: size,
            height: size,
            fontSize: size * 0.34,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
}
