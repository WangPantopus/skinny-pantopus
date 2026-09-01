import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import TerminalState from "./TerminalState";
import type { Pillar } from "../pillarTokens";

/** status:'expired' / 410 — link is invalid, used, or expired. Pass a
 *  "request a new link" affordance as children. */
export default function ExpiredView({
  title = "This link has expired",
  message = "This booking link is no longer valid. Ask the host for a fresh one.",
  children,
  pillar,
}: {
  title?: string;
  message?: string;
  children?: ReactNode;
  pillar?: Pillar;
}) {
  return (
    <TerminalState icon={Clock} title={title} body={message} pillar={pillar}>
      {children}
    </TerminalState>
  );
}
