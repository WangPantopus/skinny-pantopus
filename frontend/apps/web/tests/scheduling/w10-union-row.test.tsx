// W10 — UnionEventRow render branch: an event row shows a category chip and the
// assignee avatar; a booking row (source:'booking') is read-only — it shows the
// status pill + a chevron and no category chip / assignees.

import { render, screen } from "@testing-library/react";
import UnionEventRow from "@/components/scheduling/home/UnionEventRow";
import type { HomeMember } from "@/components/scheduling/home/helpers";
import type { HomeCalendarUnionEvent } from "@pantopus/types";

const member: HomeMember = {
  id: "u1",
  name: "Maria",
  initials: "MK",
  avatarUrl: null,
  gradient: "linear-gradient(135deg,#34d399,#16a34a)",
};

function base(over: Partial<HomeCalendarUnionEvent>): HomeCalendarUnionEvent {
  return {
    id: "e1",
    home_id: "h1",
    event_type: "chore",
    title: "Trash out",
    description: null,
    start_at: new Date(2026, 5, 16, 8, 0).toISOString(),
    end_at: null,
    location_notes: "Curb",
    recurrence_rule: null,
    assigned_to: ["u1"],
    alerts_enabled: true,
    created_by: "u1",
    created_at: "",
    updated_at: "",
    visibility: "members",
    source: "event",
    ...over,
  };
}

describe("UnionEventRow", () => {
  it("renders an event row with category + location + assignee", () => {
    render(<UnionEventRow event={base({})} members={[member]} />);
    expect(screen.getByText("Trash out")).toBeInTheDocument();
    expect(screen.getByText("Chore")).toBeInTheDocument();
    expect(screen.getByText("Curb")).toBeInTheDocument();
    expect(screen.getByText("MK")).toBeInTheDocument();
  });

  it("renders a booking row as read-only with a status pill and no category", () => {
    render(
      <UnionEventRow
        event={base({
          id: "b1",
          source: "booking",
          booking_id: "bk1",
          booking_status: "confirmed",
          title: "Haircut — Sam",
          event_type: "appointment",
          assigned_to: null,
        })}
        members={[]}
      />,
    );
    expect(screen.getByText("Haircut — Sam")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    // booking rows never render an editable category chip
    expect(screen.queryByText("Appointment")).not.toBeInTheDocument();
  });
});
