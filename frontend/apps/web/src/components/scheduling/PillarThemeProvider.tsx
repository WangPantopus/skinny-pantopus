"use client";

// Provides the active pillar (personal / home / business) to descendants so
// every scheduling surface themes consistently with the app identity tokens.
// Components may also call pillarTokens(ownerType) directly without this.

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { SchedulingOwnerType } from "@pantopus/types";
import {
  type Pillar,
  type PillarTokens,
  pillarForOwner,
  pillarTokens,
} from "./pillarTokens";

const PillarContext = createContext<Pillar>("personal");

export function PillarThemeProvider({
  pillar,
  ownerType,
  children,
}: {
  pillar?: Pillar;
  ownerType?: SchedulingOwnerType | null;
  children: ReactNode;
}) {
  const value: Pillar = pillar ?? pillarForOwner(ownerType);
  return (
    <PillarContext.Provider value={value}>{children}</PillarContext.Provider>
  );
}

export function usePillar(): Pillar {
  return useContext(PillarContext);
}

export function usePillarTokens(): PillarTokens {
  return pillarTokens(useContext(PillarContext));
}

/**
 * The active owner's pillar accent (color class + soft bg + ring + raw hex),
 * derived from PillarThemeProvider context. This is the canonical way an
 * invitee-facing surface reads its accent — never hardcode a pillar color.
 * For host-side operational CTAs (Approve / primary dock / FAB) use the fixed
 * PRIMARY_BLUE / PRIMARY_BLUE_CLS from pillarTokens instead.
 */
export const useOwnerAccent = usePillarTokens;
