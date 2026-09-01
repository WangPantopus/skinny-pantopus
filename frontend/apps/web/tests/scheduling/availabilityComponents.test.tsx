import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import type { AvailabilitySchedule, AvailabilityRule } from "@pantopus/types";
import ScheduleList from "@/components/scheduling/availability/ScheduleList";
import WeeklyHoursGrid from "@/components/scheduling/availability/WeeklyHoursGrid";
import BlockOffForm from "@/components/scheduling/availability/BlockOffForm";
import BookingLimitsForm from "@/components/scheduling/availability/BookingLimitsForm";
import {
  rulesToDays,
  seedDefaultDays,
  type DayModel,
} from "@/components/scheduling/availability/serialize";

function makeSchedule(
  over: Partial<AvailabilitySchedule>,
): AvailabilitySchedule {
  return {
    id: "s1",
    user_id: "u1",
    name: "Working hours",
    timezone: "America/Los_Angeles",
    is_default: true,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("ScheduleList (B4)", () => {
  const schedules = [
    makeSchedule({ id: "s1", name: "Working hours", is_default: true }),
    makeSchedule({ id: "s2", name: "Evenings", is_default: false }),
  ];
  const rules: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
    schedule_id: "s1",
    weekday,
    start_time: "09:00",
    end_time: "17:00",
  }));

  it("renders rows with name, summary, and the default pill", () => {
    render(
      <ScheduleList
        schedules={schedules}
        rules={rules}
        onOpen={jest.fn()}
        onSetDefault={jest.fn()}
        onRename={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(screen.getByText("Working hours")).toBeInTheDocument();
    expect(screen.getByText("Evenings")).toBeInTheDocument();
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText(/Mon–Fri, 9:00 AM – 5:00 PM/)).toBeInTheDocument();
  });

  it("opens a row and surfaces overflow actions", () => {
    const onOpen = jest.fn();
    const onDelete = jest.fn();
    render(
      <ScheduleList
        schedules={schedules}
        rules={rules}
        onOpen={onOpen}
        onSetDefault={jest.fn()}
        onRename={jest.fn()}
        onDuplicate={jest.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText("Evenings"));
    expect(onOpen).toHaveBeenCalledWith("s2");

    fireEvent.click(screen.getByLabelText("Options for Evenings"));
    // Non-default schedule offers "Set as default".
    expect(
      screen.getByRole("menuitem", { name: /Set as default/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));
    expect(onDelete).toHaveBeenCalledWith(schedules[1]);
  });
});

describe("WeeklyHoursGrid (B5)", () => {
  function Harness({ initial }: { initial: DayModel[] }) {
    const [days, setDays] = useState(initial);
    return <WeeklyHoursGrid days={days} onChange={setDays} />;
  }

  it("renders all seven weekdays Monday-first", () => {
    render(<Harness initial={seedDefaultDays()} />);
    [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ].forEach((d) => expect(screen.getByText(d)).toBeInTheDocument());
  });

  it("toggles a day off → shows Unavailable", () => {
    render(<Harness initial={seedDefaultDays()} />);
    // Monday is on by default; its switch label is "Monday".
    const mondaySwitch = screen.getByRole("switch", { name: "Monday" });
    fireEvent.click(mondaySwitch);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("adds a second time block to a day", () => {
    const oneDay: DayModel[] = rulesToDays([
      { weekday: 1, start_time: "09:00", end_time: "17:00" },
    ]).filter((d) => d.weekday === 1);
    render(<Harness initial={oneDay} />);
    // Count the design's collapsed TimeRangeButton, not the raw <input>. The inputs only
    // exist once a block is expanded — the design replaced always-visible native time
    // inputs with a labelled time-range button, so asserting on "Start time" here made
    // this test depend on a control the design deliberately removed.
    const blocks = () => screen.getAllByLabelText(/^Time block:/);
    expect(blocks()).toHaveLength(1);
    fireEvent.click(screen.getByText(/Add a block/));
    expect(blocks()).toHaveLength(2);
  });

  it("reveals start and end inputs only after expanding a block", () => {
    const oneDay: DayModel[] = rulesToDays([
      { weekday: 1, start_time: "09:00", end_time: "17:00" },
    ]).filter((d) => d.weekday === 1);
    render(<Harness initial={oneDay} />);
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText(/^Time block:/)[0]);
    expect(screen.getByLabelText("Start time")).toBeInTheDocument();
    expect(screen.getByLabelText("End time")).toBeInTheDocument();
  });
});

describe("BlockOffForm (B9)", () => {
  it("blocks submit when end is not after start", () => {
    const onCreate = jest.fn();
    render(<BlockOffForm onCreate={onCreate} creating={false} />);
    fireEvent.change(screen.getByLabelText("End time"), {
      target: { value: "13:00" }, // before the 14:00 default start
    });
    fireEvent.click(screen.getByText("Save block"));
    expect(onCreate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/end time must be after the start time/i),
    ).toBeInTheDocument();
  });

  it("submits a valid block payload", () => {
    const onCreate = jest.fn();
    render(<BlockOffForm onCreate={onCreate} creating={false} />);
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Dentist" },
    });
    fireEvent.click(screen.getByText("Save block"));
    expect(onCreate).toHaveBeenCalledTimes(1);
    const payload = onCreate.mock.calls[0][0];
    expect(payload.title).toBe("Dentist");
    expect(typeof payload.start_at).toBe("string");
    expect(typeof payload.end_at).toBe("string");
    expect(new Date(payload.end_at) > new Date(payload.start_at)).toBe(true);
  });

  it("posts an all-day block spanning the day with no time inputs", () => {
    const onCreate = jest.fn();
    render(<BlockOffForm onCreate={onCreate} creating={false} />);
    fireEvent.click(screen.getByRole("switch", { name: "All day" }));
    expect(screen.queryByLabelText("Start time")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Save block"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });
});

describe("BookingLimitsForm (B7)", () => {
  // This surface used to be a read-only link-out to event types. The design specifies real
  // StepperRows (booking-limits-frames.jsx), and the component was rebuilt to match, so the
  // old "is read-only and hands off" assertions no longer describe the intended behaviour.
  it("renders the designed limit steppers", () => {
    render(<BookingLimitsForm />);
    for (const label of [
      "Minimum notice",
      "Book up to",
      "Max per day",
      "Max per week",
      "Per-person limit",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("exposes working increment and decrement controls", () => {
    render(<BookingLimitsForm />);
    expect(screen.getAllByLabelText("Increase").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Decrease").length).toBeGreaterThan(0);
  });
});
