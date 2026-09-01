import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import TerminalState from "./TerminalState";
import type { Pillar } from "../pillarTokens";

/** status:'unavailable' / 404 — page/booking not found or offline. */
export default function UnavailableView({
  title = "This booking page isn’t available",
  message = "The link may be wrong, or the host has taken this page offline.",
  children,
  pillar,
}: {
  title?: string;
  message?: string;
  children?: ReactNode;
  pillar?: Pillar;
}) {
  return (
    <TerminalState icon={SearchX} title={title} body={message} pillar={pillar}>
      {children}
    </TerminalState>
  );
}
