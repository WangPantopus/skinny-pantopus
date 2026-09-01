// W13 · G1 — Round-Robin sheet render + state-machine. The sheet only touches
// the api on save, so the none-selected / single-member / rotation states are
// verifiable with a plain render (no api mock needed).

import { render, screen, fireEvent } from "@testing-library/react";
import type { EventTypeAssignee, SchedulingOwnerRef } from "@pantopus/types";
import RoundRobinSheet from "@/components/scheduling/business/RoundRobinSheet";
import type { TeamMemberView } from "@/components/scheduling/business/members";

const owner: SchedulingOwnerRef = { ownerType: "business", ownerId: "biz-1" };
const roster: TeamMemberView[] = [
  {
    id: "a",
    seatId: "s1",
    name: "Dana Reyes",
    role: "Stylist",
    isYou: false,
    isActive: true,
  },
  {
    id: "b",
    seatId: "s2",
    name: "Marcus Lee",
    role: "Stylist",
    isYou: false,
    isActive: true,
  },
  {
    id: "c",
    seatId: "s3",
    name: "Priya Nair",
    role: "Color",
    isYou: true,
    isActive: true,
  },
];

function renderSheet(initial: EventTypeAssignee[]) {
  return render(
    <RoundRobinSheet
      open
      onClose={() => {}}
      owner={owner}
      eventTypeId="et-1"
      eventTypeName="Haircut"
      roster={roster}
      initialAssignees={initial}
    />,
  );
}

describe("RoundRobinSheet (G1)", () => {
  it("renders the three rotation rules + the full roster", () => {
    renderSheet([]);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
    expect(screen.getByText("Priority order")).toBeInTheDocument();
    expect(screen.getByText("Strict round-robin")).toBeInTheDocument();
    expect(screen.getByText("Dana Reyes")).toBeInTheDocument();
    expect(screen.getByText("Marcus Lee")).toBeInTheDocument();
    // The viewer's own row is tagged.
    expect(
      screen.getByText(/You · uses personal availability/),
    ).toBeInTheDocument();
  });

  it("starts in the none-selected state: warning shown, Done disabled", () => {
    renderSheet([]);
    expect(
      screen.getByText("Pick at least one member to take bookings."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
  });

  it("selecting one member enables Done and shows the single-member note", () => {
    renderSheet([]);
    fireEvent.click(screen.getByLabelText("Add Dana Reyes"));
    expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
    expect(
      screen.getByText(/Rotation needs two or more members/),
    ).toBeInTheDocument();
  });

  it("hydrates from existing assignees and shows the rotation note for ≥2", () => {
    renderSheet([
      {
        subject_id: "a",
        subject_type: "business_team",
        weight: 1,
        priority: 0,
        is_active: true,
      },
      {
        subject_id: "b",
        subject_type: "business_team",
        weight: 1,
        priority: 0,
        is_active: true,
      },
    ]);
    expect(screen.getByRole("button", { name: "Done" })).toBeEnabled();
    expect(
      screen.getByText(/New bookings rotate across 2 members/),
    ).toBeInTheDocument();
  });

  it("balanced rule exposes a weight stepper for selected members", () => {
    renderSheet([
      {
        subject_id: "a",
        subject_type: "business_team",
        weight: 2,
        priority: 0,
        is_active: true,
      },
    ]);
    // Balanced is inferred from weight>1 → weight chip ×2 visible.
    expect(screen.getByText("×2")).toBeInTheDocument();
    // Raising the weight updates the chip.
    fireEvent.click(screen.getByLabelText("Raise weight"));
    expect(screen.getByText("×3")).toBeInTheDocument();
  });
});
