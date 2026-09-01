@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LargeClass")

package app.pantopus.android.ui.screens.mailbox.mail_task

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.12 — deterministic fixtures for the Mail-task detail screen.
 * Mirrors the open + done frames in `docs/designs/A17/tasks.jsx` and the
 * iOS `MailTaskSampleData.swift` so previews, Paparazzi snapshots, and
 * the no-backend wiring render the same copy ("Submit written comment on
 * the 412 Elm St rezoning", "Due tomorrow · Fri May 30 · 5:00 PM",
 * confirmation "#C-8841", next-up "Pay Riverside Linen").
 */
object MailTaskSampleData {
    /**
     * The canonical 412 Elm St rezoning task. [done] swaps the frame to
     * the completed state (struck title, completion summary, next-up).
     */
    fun task(
        taskId: String = "t_412elm",
        done: Boolean = false,
    ): MailTaskContent =
        MailTaskContent(
            taskId = taskId,
            timeLabel = "Auto-created · 1h ago",
            title = "Submit written comment on the 412 Elm St rezoning",
            reference = "Zoning variance ZA-2026-0188 · City of Oakland Planning",
            priority = MailTaskPriority.High,
            subtasks =
                listOf(
                    MailTaskSubtask(
                        id = "draft",
                        label = "Draft your written comment",
                        hint = "Pantopus pre-filled the case number + your address",
                        isDone = true,
                    ),
                    MailTaskSubtask(
                        id = "photos",
                        label = "Attach 2 site photos",
                        hint = "Rear-yard setback, looking north",
                        isDone = false,
                    ),
                    MailTaskSubtask(
                        id = "submit",
                        label = "Submit via the Planning portal",
                        hint = "oaklandca.gov/planning · case ZA-2026-0188",
                        isDone = false,
                    ),
                ),
            due =
                MailTaskDue(
                    weekday = "FRI",
                    day = "30",
                    month = "MAY",
                    label = "Due tomorrow",
                    time = "5:00 PM",
                    left = "~1 day left",
                    reminderLabel = "Reminder set for 9:00 AM",
                    closesLabel = "Closes Fri 5:00 PM",
                ),
            snoozeOptions =
                listOf(
                    MailTaskSnoozeOption("evening", PantopusIcon.Sun, "This evening", "6:00 PM"),
                    MailTaskSnoozeOption("tomorrowAm", PantopusIcon.SunDim, "Tomorrow AM", "Fri 9:00"),
                    MailTaskSnoozeOption("pick", PantopusIcon.CalendarDays, "Pick a time", null),
                ),
            source =
                MailTaskSourceMail(
                    mailId = "mail_412elm_hearing",
                    categoryLabel = "Certified",
                    sender = "City of Oakland · Planning",
                    title = "Notice of public hearing — 412 Elm St",
                    snippet =
                        "Written comment accepted through May 30. Hearing scheduled June 3, 2026 at 6:00 PM.",
                    time = "May 27",
                ),
            elfOpen =
                MailTaskElf(
                    headline = "Pantopus made this task for you",
                    summary =
                        "I spotted a hard deadline in your certified mail from City Planning. " +
                            "The comment window closes Fri May 30 at 5 PM — about a day out. I pre-drafted " +
                            "a comment with the case number and your address; a quick review plus two photos " +
                            "should do it.",
                    bullets =
                        listOf(
                            MailTaskElfBullet("closes", PantopusIcon.Clock, "Closes Fri 5:00 PM", "no late comments accepted"),
                            MailTaskElfBullet("draft", PantopusIcon.Pencil, "Draft ready", "review + edit, ~10 min"),
                            MailTaskElfBullet("block", PantopusIcon.MapPin, "About your block", "412 Elm is 2 doors down"),
                        ),
                ),
            elfDone =
                MailTaskElf(
                    headline = "Submitted — nice work",
                    summary =
                        "Your comment was filed with City Planning at 4:12 PM, well ahead of the 5 PM " +
                            "cutoff. I saved the confirmation to your Vault and set a reminder for the June 3 " +
                            "hearing in case you want to attend.",
                    bullets =
                        listOf(
                            MailTaskElfBullet("confirm", PantopusIcon.BadgeCheck, "Confirmation #C-8841", "saved to Vault"),
                            MailTaskElfBullet("hearing", PantopusIcon.CalendarCheck, "Hearing Jun 3, 6 PM", "reminder set"),
                            MailTaskElfBullet("reopen", PantopusIcon.Undo2, "Changed your mind?", "you can reopen below"),
                        ),
                ),
            completion =
                MailTaskCompletion(
                    stamp = "Done May 28 · 4:12 PM",
                    note = "1 day early",
                    rows =
                        listOf(
                            MailTaskCompletionRow("comment", PantopusIcon.FileText, "Comment submitted", "3 paragraphs + 2 photos"),
                            MailTaskCompletionRow("confirmation", PantopusIcon.Hash, "Confirmation", "C-8841", isMono = true),
                            MailTaskCompletionRow("filed", PantopusIcon.Building2, "Filed with", "Oakland Planning"),
                            MailTaskCompletionRow("time", PantopusIcon.Clock, "Time", "May 28 · 4:12 PM"),
                        ),
                ),
            nextUp =
                MailTaskNextUp(
                    mailId = "mail_riverside_linen",
                    categoryLabel = "Invoice",
                    title = "Pay Riverside Linen — $642.50",
                    due = "Due in 3 days",
                    from = "From your Counter",
                ),
            isDone = done,
        )

    /** Convenience seed resolver used by the view-model. */
    fun task(
        taskId: String,
        seed: MailTaskSeed,
    ): MailTaskContent = task(taskId = taskId, done = seed == MailTaskSeed.Done)
}
