// Member avatar: profile photo when present, otherwise a tinted initials chip.
// Used by the find-a-time roster, suggested-slot dots and the who's-free grid.

import clsx from "clsx";
import { initials, tintForId, type MemberView } from "./members";

const SIZES: Record<string, string> = {
  xs: "h-[18px] w-[18px] text-[8px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-10 w-10 text-sm",
};

export default function MemberAvatar({
  member,
  size = "md",
  dim = false,
  className,
}: {
  member: MemberView;
  size?: keyof typeof SIZES;
  /** Render muted (member busy / not free for this slot). */
  dim?: boolean;
  className?: string;
}) {
  const dims = SIZES[size];
  if (member.avatarUrl) {
    return (
      // Native img keeps household avatars working across storage hosts without
      // Next/image host config churn (matches the public-share avatar pattern).
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.avatarUrl}
        alt=""
        className={clsx(
          "flex-shrink-0 rounded-full object-cover",
          dims,
          dim && "opacity-40 grayscale",
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={clsx(
        "flex flex-shrink-0 items-center justify-center rounded-full font-bold text-white",
        dims,
        dim ? "bg-app-text-muted/50" : tintForId(member.userId),
        className,
      )}
    >
      {initials(member.name)}
    </span>
  );
}
