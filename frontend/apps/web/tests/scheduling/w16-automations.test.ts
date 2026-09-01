// W16 Reminders / Workflows / Templates — targeted unit tests for this stream's
// pure logic: reminder read/write serialization (H1, must match A4's prefs key),
// workflow trigger/offset/validation (H2/H3), and template variable extraction /
// interpolation / validation (H5/H6/H7).

import {
  DEFAULT_REMINDERS,
  customToMinutes,
  readReminders,
  reminderRowLabel,
  reminderShort,
  summarizeReminders,
  writeReminders,
  type Prefs,
} from "@/components/scheduling/automations/reminders";
import {
  emptyWorkflowForm,
  formToWorkflowInput,
  offsetToParts,
  partsToOffset,
  triggerSummary,
  validateWorkflow,
} from "@/components/scheduling/automations/workflowMeta";
import {
  buildSampleVars,
  emptyTemplateForm,
  extractVariables,
  formToTemplateInput,
  insertToken,
  interpolate,
  validateTemplate,
} from "@/components/scheduling/automations/templateMeta";

describe("reminders read/write (shares A4's scheduling.reminder_minutes key)", () => {
  it("falls back to the smart default only when the key is absent", () => {
    expect(readReminders({})).toEqual(DEFAULT_REMINDERS);
    expect(readReminders({ scheduling: {} })).toEqual(DEFAULT_REMINDERS);
  });

  it("preserves an explicit empty selection (no reminders)", () => {
    expect(readReminders({ scheduling: { reminder_minutes: [] } })).toEqual([]);
  });

  it("reads stored minutes, dropping non-numbers", () => {
    const prefs = {
      scheduling: { reminder_minutes: [60, "x", 1440] },
    } as unknown as Prefs;
    expect(readReminders(prefs)).toEqual([60, 1440]);
  });

  it("writes sorted-descending, deduped, and preserves other keys", () => {
    const prefs: Prefs = {
      scheduling: { host: { new_booking: true }, reminder_minutes: [99] },
      top_level: 1,
    };
    const next = writeReminders(prefs, [60, 1440, 60, 0]);
    expect(
      (next.scheduling as Record<string, unknown>).reminder_minutes,
    ).toEqual([1440, 60, 0]);
    // Untouched neighbours round-trip.
    expect((next.scheduling as Record<string, unknown>).host).toEqual({
      new_booking: true,
    });
    expect(next.top_level).toBe(1);
  });

  it("converts custom value + unit to minutes (rejecting bad input)", () => {
    expect(customToMinutes(2, "hours")).toBe(120);
    expect(customToMinutes(1, "days")).toBe(1440);
    expect(customToMinutes(3, "weeks")).toBe(30240);
    expect(customToMinutes(0, "hours")).toBeNull();
    expect(customToMinutes(-1, "minutes")).toBeNull();
    expect(customToMinutes(Number.NaN, "minutes")).toBeNull();
  });

  it("labels minutes the way the H1 card + pinned summary read", () => {
    expect(reminderShort(0)).toBe("at start");
    expect(reminderShort(10080)).toBe("1 week");
    expect(reminderShort(20160)).toBe("2 weeks");
    expect(reminderShort(1440)).toBe("1 day");
    expect(reminderShort(120)).toBe("2 hours");
    expect(reminderShort(15)).toBe("15 min");
    expect(reminderRowLabel(0)).toBe("At start");
    expect(reminderRowLabel(1440)).toBe("1 day before");
    expect(summarizeReminders([])).toBe("No reminders");
    expect(summarizeReminders([60, 1440])).toBe("1 day + 1 hour before");
    expect(summarizeReminders([1440, 0])).toBe("1 day + at start");
  });
});

describe("workflow trigger summary + offset", () => {
  it("weaves the offset into timed triggers and omits it otherwise", () => {
    expect(
      triggerSummary({ trigger: "before_start", offset_minutes: 60 }),
    ).toBe("1 hour before it starts");
    expect(triggerSummary({ trigger: "before_start", offset_minutes: 0 })).toBe(
      "When it starts",
    );
    expect(triggerSummary({ trigger: "after_end", offset_minutes: 1440 })).toBe(
      "1 day after it ends",
    );
    expect(triggerSummary({ trigger: "booking_created" })).toBe(
      "When a booking is created",
    );
  });

  it("splits/recombines an offset on the largest whole unit", () => {
    expect(offsetToParts(0)).toEqual({ value: 0, unit: "minutes" });
    expect(offsetToParts(60)).toEqual({ value: 1, unit: "hours" });
    expect(offsetToParts(1440)).toEqual({ value: 1, unit: "days" });
    expect(offsetToParts(90)).toEqual({ value: 90, unit: "minutes" });
    expect(partsToOffset(2, "hours")).toBe(120);
    const rt = offsetToParts(partsToOffset(3, "days"));
    expect(rt).toEqual({ value: 3, unit: "days" });
  });

  it("drops the offset for non-timed triggers in the API input", () => {
    const timed = formToWorkflowInput({
      ...emptyWorkflowForm(),
      name: "  Heads up  ",
      trigger: "before_start",
      offset_minutes: 120,
    });
    expect(timed.offset_minutes).toBe(120);
    expect(timed.name).toBe("Heads up");

    const instant = formToWorkflowInput({
      ...emptyWorkflowForm(),
      name: "Welcome",
      trigger: "booking_created",
      offset_minutes: 120,
    });
    expect(instant.offset_minutes).toBe(0);
  });

  it("validates name presence/length and message length", () => {
    expect(
      validateWorkflow({ ...emptyWorkflowForm(), name: "" }).name,
    ).toBeTruthy();
    expect(
      validateWorkflow({ ...emptyWorkflowForm(), name: "a".repeat(201) }).name,
    ).toBeTruthy();
    expect(
      validateWorkflow({
        ...emptyWorkflowForm(),
        name: "ok",
        message_template: "x".repeat(5001),
      }).message_template,
    ).toBeTruthy();
    expect(
      validateWorkflow({ ...emptyWorkflowForm(), name: "Reminder" }),
    ).toEqual({});
  });
});

describe("template variables + interpolation", () => {
  it("extracts unique variables across subject and body, in first-seen order", () => {
    expect(
      extractVariables(
        "Hi {{invitee_name}}",
        "{{event_name}} {{invitee_name}}",
      ),
    ).toEqual(["invitee_name", "event_name"]);
  });

  it("builds sample values for known and unknown tokens", () => {
    expect(buildSampleVars(["invitee_name", "custom_thing"])).toEqual({
      invitee_name: "Alex Rivera",
      custom_thing: "Custom Thing",
    });
  });

  it("interpolates known tokens and leaves unknown ones intact", () => {
    expect(
      interpolate("Hi {{invitee_name}}, {{unknown}}", {
        invitee_name: "Al",
      }),
    ).toBe("Hi Al, {{unknown}}");
  });

  it("inserts a {{token}} at the caret (clamping out-of-range)", () => {
    expect(insertToken("Hello ", "name", 6)).toBe("Hello {{name}}");
    expect(insertToken("ab", "x", 1)).toBe("a{{x}}b");
    expect(insertToken("ab", "x", 999)).toBe("ab{{x}}");
  });

  it("only sends a subject for channels that need one", () => {
    const email = formToTemplateInput({
      ...emptyTemplateForm(),
      name: "Note",
      channel: "email",
      subject: "  Hi  ",
      body: "  Body  ",
    });
    expect(email.subject).toBe("Hi");
    expect(email.body).toBe("Body");

    const push = formToTemplateInput({
      ...emptyTemplateForm(),
      name: "Ping",
      channel: "push",
      subject: "ignored",
      body: "Body",
    });
    expect(push.subject).toBeUndefined();
  });

  it("requires an email subject, a body, and a name", () => {
    expect(
      validateTemplate({
        ...emptyTemplateForm(),
        name: "T",
        channel: "email",
        subject: "",
        body: "Hi",
      }).subject,
    ).toBeTruthy();
    expect(
      validateTemplate({
        ...emptyTemplateForm(),
        name: "T",
        channel: "push",
        subject: "",
        body: "Hi",
      }).subject,
    ).toBeUndefined();
    expect(
      validateTemplate({ ...emptyTemplateForm(), name: "T", body: "" }).body,
    ).toBeTruthy();
    expect(
      validateTemplate({ ...emptyTemplateForm(), name: "", body: "Hi" }).name,
    ).toBeTruthy();
    expect(
      validateTemplate({
        ...emptyTemplateForm(),
        name: "Welcome",
        channel: "email",
        subject: "Hello",
        body: "Hi {{invitee_name}}",
      }),
    ).toEqual({});
  });
});
