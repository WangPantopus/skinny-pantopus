"use client";

// Resolves the active scheduling owner (personal / home / business) and yields
// the SchedulingOwnerRef every @pantopus/api scheduling call expects. Web has
// no global identity hook — context is derived from the route, mirroring how
// AppShell parses `/app/homes/:id` and `/app/businesses/:id`. Pass an explicit
// `owner` to override (e.g. a host page that fixes a business context).

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { SchedulingOwnerRef } from "@pantopus/types";
import { detectOwnerFromPath } from "./schedulingOwner";

export { detectOwnerFromPath, ownerToParams } from "./schedulingOwner";

const SchedulingOwnerContext = createContext<SchedulingOwnerRef | null>(null);

export function SchedulingOwnerProvider({
  owner,
  children,
}: {
  owner?: SchedulingOwnerRef;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const value = useMemo<SchedulingOwnerRef>(
    () => owner ?? detectOwnerFromPath(pathname),
    [owner, pathname],
  );
  return (
    <SchedulingOwnerContext.Provider value={value}>
      {children}
    </SchedulingOwnerContext.Provider>
  );
}

/**
 * The active SchedulingOwnerRef. Works inside a SchedulingOwnerProvider, and
 * also falls back to route detection when used standalone.
 */
export function useSchedulingOwner(): SchedulingOwnerRef {
  const ctx = useContext(SchedulingOwnerContext);
  const pathname = usePathname();
  return ctx ?? detectOwnerFromPath(pathname);
}
