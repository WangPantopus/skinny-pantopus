import type { ReactNode } from "react";
import { CalendarX2 } from "lucide-react";
import TerminalState from "./TerminalState";
import type { Pillar } from "../pillarTokens";

/** No open times right now — a calm, expected outcome (not an error). Pass
 *  "try a wider range" / "notify me" / "join waitlist" affordances as children. */
export default function NoAvailabilityView({
  title = "No times are open right now",
  message = "Try a wider date range, or get notified when new times open up.",
  children,
  pillar,
}: {
  title?: string;
  message?: string;
  children?: ReactNode;
  pillar?: Pillar;
}) {
  return (
    <TerminalState
      icon={CalendarX2}
      title={title}
      body={message}
      pillar={pillar}
    >
      {children}
    </TerminalState>
  );
}
