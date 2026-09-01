//
//  MailTaskSampleData.swift
//  Pantopus
//
//  A17.12 — deterministic fixtures for the Mail-task detail screen.
//  Mirrors the open + done frames in `docs/designs/A17/tasks.jsx` so
//  previews, snapshot tests, and the no-backend wiring render the same
//  copy the designer specified ("Submit written comment on the 412 Elm
//  St rezoning", "Due tomorrow · Fri May 30 · 5:00 PM", confirmation
//  "#C-8841", "Hearing Jun 3, 6 PM", next-up "Pay Riverside Linen").
//
//  Mirrored on Android as `MailTaskSampleData.kt`.
//

import Foundation

/// Static fixtures backing the Mail-task sample frames. The backend
/// task endpoint is wired on web (`useTasks` / `useUpdateTask`); until
/// the native task API lands the screen drives off these projections,
/// keyed by the route's `taskId` (any id resolves to this fixture today).
public enum MailTaskSampleData {
    /// The canonical 412 Elm St rezoning task. `done` swaps the frame to
    /// the completed state (struck title, completion summary, next-up).
    public static func task(taskId: String = "t_412elm", done: Bool = false) -> MailTaskContent {
        MailTaskContent(
            taskId: taskId,
            timeLabel: "Auto-created · 1h ago",
            title: "Submit written comment on the 412 Elm St rezoning",
            reference: "Zoning variance ZA-2026-0188 · City of Oakland Planning",
            priority: .high,
            subtasks: subtasks,
            due: due,
            snoozeOptions: snoozeOptions,
            source: source,
            elfOpen: elfOpen,
            elfDone: elfDone,
            completion: completion,
            nextUp: nextUp,
            isDone: done
        )
    }

    /// Convenience seed resolver used by the view-model.
    public static func task(taskId: String, seed: MailTaskSeed) -> MailTaskContent {
        task(taskId: taskId, done: seed == .done)
    }

    // MARK: - Slot fixtures

    private static let subtasks: [MailTaskSubtask] = [
        MailTaskSubtask(
            id: "draft",
            label: "Draft your written comment",
            hint: "Pantopus pre-filled the case number + your address",
            isDone: true
        ),
        MailTaskSubtask(
            id: "photos",
            label: "Attach 2 site photos",
            hint: "Rear-yard setback, looking north",
            isDone: false
        ),
        MailTaskSubtask(
            id: "submit",
            label: "Submit via the Planning portal",
            hint: "oaklandca.gov/planning · case ZA-2026-0188",
            isDone: false
        )
    ]

    private static let due = MailTaskDue(
        weekday: "FRI",
        day: "30",
        month: "MAY",
        label: "Due tomorrow",
        time: "5:00 PM",
        left: "~1 day left",
        reminderLabel: "Reminder set for 9:00 AM",
        closesLabel: "Closes Fri 5:00 PM"
    )

    private static let snoozeOptions: [MailTaskSnoozeOption] = [
        MailTaskSnoozeOption(id: "evening", icon: .sun, label: "This evening", when: "6:00 PM"),
        MailTaskSnoozeOption(id: "tomorrowAm", icon: .sunDim, label: "Tomorrow AM", when: "Fri 9:00"),
        MailTaskSnoozeOption(id: "pick", icon: .calendarDays, label: "Pick a time", when: nil)
    ]

    private static let source = MailTaskSourceMail(
        mailId: "mail_412elm_hearing",
        categoryLabel: "Certified",
        sender: "City of Oakland · Planning",
        title: "Notice of public hearing — 412 Elm St",
        snippet: "Written comment accepted through May 30. Hearing scheduled June 3, 2026 at 6:00 PM.",
        time: "May 27"
    )

    private static let elfOpen = MailTaskElf(
        headline: "Pantopus made this task for you",
        summary: "I spotted a hard deadline in your certified mail from City Planning. "
            + "The comment window closes Fri May 30 at 5 PM — about a day out. I pre-drafted "
            + "a comment with the case number and your address; a quick review plus two photos "
            + "should do it.",
        bullets: [
            MailTaskElfBullet(id: "closes", icon: .clock, label: "Closes Fri 5:00 PM", text: "no late comments accepted"),
            MailTaskElfBullet(id: "draft", icon: .pencil, label: "Draft ready", text: "review + edit, ~10 min"),
            MailTaskElfBullet(id: "block", icon: .mapPin, label: "About your block", text: "412 Elm is 2 doors down")
        ]
    )

    private static let elfDone = MailTaskElf(
        headline: "Submitted — nice work",
        summary: "Your comment was filed with City Planning at 4:12 PM, well ahead of the 5 PM "
            + "cutoff. I saved the confirmation to your Vault and set a reminder for the June 3 "
            + "hearing in case you want to attend.",
        bullets: [
            MailTaskElfBullet(id: "confirm", icon: .badgeCheck, label: "Confirmation #C-8841", text: "saved to Vault"),
            MailTaskElfBullet(id: "hearing", icon: .calendarCheck, label: "Hearing Jun 3, 6 PM", text: "reminder set"),
            MailTaskElfBullet(id: "reopen", icon: .undo2, label: "Changed your mind?", text: "you can reopen below")
        ]
    )

    private static let completion = MailTaskCompletion(
        stamp: "Done May 28 · 4:12 PM",
        note: "1 day early",
        rows: [
            MailTaskCompletionRow(id: "comment", icon: .fileText, label: "Comment submitted", value: "3 paragraphs + 2 photos"),
            MailTaskCompletionRow(id: "confirmation", icon: .hash, label: "Confirmation", value: "C-8841", isMono: true),
            MailTaskCompletionRow(id: "filed", icon: .building2, label: "Filed with", value: "Oakland Planning"),
            MailTaskCompletionRow(id: "time", icon: .clock, label: "Time", value: "May 28 · 4:12 PM")
        ]
    )

    private static let nextUp = MailTaskNextUp(
        mailId: "mail_riverside_linen",
        categoryLabel: "Invoice",
        title: "Pay Riverside Linen — $642.50",
        due: "Due in 3 days",
        from: "From your Counter"
    )
}
