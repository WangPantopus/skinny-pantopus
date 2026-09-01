import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import TerminalState from "./TerminalState";
import type { Pillar } from "../pillarTokens";

/** status:'secret' / 403 — a private link. Pass a code-input affordance as children. */
export default function SecretView({
  title = "This is a private link",
  message = "Ask the host for an access code or a fresh link to continue.",
  children,
  pillar,
}: {
  title?: string;
  message?: string;
  children?: ReactNode;
  pillar?: Pillar;
}) {
  return (
    <TerminalState icon={Lock} title={title} body={message} pillar={pillar}>
      {children}
    </TerminalState>
  );
}
