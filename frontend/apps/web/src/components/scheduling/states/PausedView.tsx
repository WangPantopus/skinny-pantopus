import type { ReactNode } from "react";
import { PauseCircle } from "lucide-react";
import TerminalState from "./TerminalState";
import type { Pillar } from "../pillarTokens";

/** status:'paused' — host isn't taking bookings right now (reversible). */
export default function PausedView({
  title = "This page is paused",
  message,
  reopenAt,
  children,
  pillar,
}: {
  title?: string;
  message?: string;
  reopenAt?: string | null;
  children?: ReactNode;
  pillar?: Pillar;
}) {
  const body =
    message ??
    (reopenAt
      ? `The host has paused new bookings. Reopening ${reopenAt}.`
      : "The host isn't taking new bookings right now. Check back soon.");
  return (
    <TerminalState icon={PauseCircle} title={title} body={body} pillar={pillar}>
      {children}
    </TerminalState>
  );
}
