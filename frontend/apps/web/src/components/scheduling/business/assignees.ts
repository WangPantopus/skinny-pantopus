// Assignee payload builders for Round-robin (G1) and Collective (G2). The
// backend's PUT /event-types/:id/assignees REPLACES the whole set (DELETE then
// INSERT) and validates every subject is a team member (400 INVALID_ASSIGNEE).
// Round-robin fairness rides on `weight`; priority order rides on `priority`.
// Pure (no React / no api) so the payload mapping is unit-testable.

import type { AssignmentMode, EventTypeAssignee } from "@pantopus/types";

/** The three round-robin fairness rules from the G1 design. */
export type RoundRobinRule = "balanced" | "priority" | "strict";

export const ROUND_ROBIN_RULES: {
  id: RoundRobinRule;
  name: string;
  desc: string;
  icon: string;
}[] = [
  {
    id: "balanced",
    name: "Balanced",
    desc: "Spread bookings by weight",
    icon: "scale",
  },
  {
    id: "priority",
    name: "Priority order",
    desc: "Fill the top of the list first",
    icon: "list-ordered",
  },
  {
    id: "strict",
    name: "Strict round-robin",
    desc: "One each, strictly in turn",
    icon: "repeat",
  },
];

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 9;

export function clampWeight(w: number): number {
  if (!Number.isFinite(w)) return 1;
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, Math.round(w)));
}

/** Selection state the round-robin sheet edits. */
export interface RoundRobinSelection {
  rule: RoundRobinRule;
  /** Ordered member ids (order matters for "priority"). */
  order: string[];
  /** Checked members. */
  selected: Set<string>;
  /** Per-member weight (only meaningful when rule === 'balanced'). */
  weights: Record<string, number>;
}

/**
 * Build the assignee rows for a round-robin config.
 * - balanced → weight carries fairness; priority flat (0).
 * - priority → weight flat (1); priority encodes list order (0 = top).
 * - strict   → weight flat (1); priority flat (0) — pure rotation.
 */
export function buildRoundRobinAssignees(
  sel: RoundRobinSelection,
): EventTypeAssignee[] {
  const chosen = sel.order.filter((id) => sel.selected.has(id));
  return chosen.map((id, index) => ({
    subject_id: id,
    subject_type: "business_team",
    weight: sel.rule === "balanced" ? clampWeight(sel.weights[id] ?? 1) : 1,
    priority: sel.rule === "priority" ? index : 0,
    is_active: true,
  }));
}

/** Collective: every chosen member is required and free at once (flat weight). */
export function buildCollectiveAssignees(
  selectedIds: string[],
): EventTypeAssignee[] {
  return selectedIds.map((id) => ({
    subject_id: id,
    subject_type: "business_team",
    weight: 1,
    priority: 0,
    is_active: true,
  }));
}

/** Round-robin needs at least one member; rotation needs ≥2 to actually rotate. */
export function canSaveRoundRobin(sel: RoundRobinSelection): boolean {
  return countSelected(sel.selected) >= 1;
}

export function rotationActive(sel: RoundRobinSelection): boolean {
  return countSelected(sel.selected) >= 2;
}

function countSelected(selected: Set<string>): number {
  let n = 0;
  for (const _ of selected) n++;
  return n;
}

/** Hydrate the round-robin sheet from existing assignee rows + the full roster. */
export function selectionFromAssignees(
  assignees: EventTypeAssignee[] | undefined,
  rosterIds: string[],
): RoundRobinSelection {
  const active = (assignees ?? []).filter((a) => a.is_active !== false);
  const selected = new Set(active.map((a) => a.subject_id));
  const weights: Record<string, number> = {};
  for (const a of active) weights[a.subject_id] = clampWeight(a.weight ?? 1);
  // Order: existing assignees by priority first, then any remaining roster.
  const byPriority = [...active].sort(
    (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
  );
  const order: string[] = [];
  const push = (id: string) => {
    if (id && !order.includes(id)) order.push(id);
  };
  byPriority.forEach((a) => push(a.subject_id));
  rosterIds.forEach(push);
  const rule = inferRule(active);
  return { rule, order, selected, weights };
}

/** Infer the fairness rule from existing rows (weights → balanced, distinct
 *  priorities → priority order, else strict). */
export function inferRule(active: EventTypeAssignee[]): RoundRobinRule {
  if (active.some((a) => (a.weight ?? 1) > 1)) return "balanced";
  const priorities = new Set(active.map((a) => a.priority ?? 0));
  if (priorities.size > 1) return "priority";
  return "strict";
}

/** The assignment_mode an event type should carry for a given surface. */
export function modeForRoundRobin(): AssignmentMode {
  return "round_robin";
}
export function modeForCollective(): AssignmentMode {
  return "collective";
}
