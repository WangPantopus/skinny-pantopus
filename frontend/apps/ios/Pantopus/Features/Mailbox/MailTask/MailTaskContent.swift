//
//  MailTaskContent.swift
//  Pantopus
//
//  A17.12 — render-only models for the Mail-task detail screen. The
//  screen shows a task Pantopus auto-extracted from a piece of mail and
//  has two designed frames:
//
//  · open — `TaskCard` (priority, progress, due) + AI elf + `DueSnoozeCard`
//    (calendar block + quick-snooze) + `SubtaskChecklist` + `SourceMailCard`
//    + a delegate hint + the action dock (Mark done · Snooze · Delegate).
//  · done — the completed `TaskCard` (struck title, 3-of-3 progress) + AI
//    elf "Submitted — nice work" + a completion summary ("What got filed")
//    + the all-checked `SubtaskChecklist` + `SourceMailCard` + a
//    `NextUpCard` suggestion + the reopen / archive dock.
//
//  Mirrors `ui/screens/mailbox/mail_task/MailTaskContent.kt` on Android.
//

import SwiftUI

// MARK: - Priority

/// Task priority flag rendered on the hero. Drives the pill color + label.
public enum MailTaskPriority: String, Sendable, Hashable {
    case high
    case medium
    case low

    /// Pill label — "High priority" / "Medium priority" / "Low priority".
    public var label: String {
        switch self {
        case .high: "High priority"
        case .medium: "Medium priority"
        case .low: "Low priority"
        }
    }

    /// Soft pill background.
    public var background: Color {
        switch self {
        case .high: Theme.Color.errorBg
        case .medium: Theme.Color.warningBg
        case .low: Theme.Color.appSurfaceSunken
        }
    }

    /// Pill foreground / glyph tint.
    public var foreground: Color {
        switch self {
        case .high: Theme.Color.error
        case .medium: Theme.Color.warning
        case .low: Theme.Color.appTextStrong
        }
    }
}

// MARK: - Subtask

/// One row in the `SubtaskChecklist`. `isDone` toggles locally when the
/// user taps the row — the view-model owns the mutation.
public struct MailTaskSubtask: Identifiable, Sendable, Hashable {
    public let id: String
    public let label: String
    public let hint: String
    public var isDone: Bool

    public init(id: String, label: String, hint: String, isDone: Bool) {
        self.id = id
        self.label = label
        self.hint = hint
        self.isDone = isDone
    }
}

// MARK: - Due / snooze

/// Calendar-block + reminder payload for the `DueSnoozeCard`.
public struct MailTaskDue: Sendable, Hashable {
    /// Three-letter weekday for the calendar block ("FRI").
    public let weekday: String
    /// Day-of-month numeral ("30").
    public let day: String
    /// Three-letter month for the calendar header ("MAY").
    public let month: String
    /// Relative label ("Due tomorrow").
    public let label: String
    /// Clock time ("5:00 PM").
    public let time: String
    /// Countdown chip ("~1 day left").
    public let left: String
    /// Reminder sub-line ("Reminder set for 9:00 AM").
    public let reminderLabel: String
    /// Closing-window caption ("Closes Fri 5:00 PM").
    public let closesLabel: String

    public init(
        weekday: String,
        day: String,
        month: String,
        label: String,
        time: String,
        left: String,
        reminderLabel: String,
        closesLabel: String
    ) {
        self.weekday = weekday
        self.day = day
        self.month = month
        self.label = label
        self.time = time
        self.left = left
        self.reminderLabel = reminderLabel
        self.closesLabel = closesLabel
    }
}

/// One quick-snooze option in the `DueSnoozeCard` row.
public struct MailTaskSnoozeOption: Identifiable, Sendable, Hashable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    /// Sub-caption ("6:00 PM"); `nil` for "Pick a time".
    public let when: String?

    public init(id: String, icon: PantopusIcon, label: String, when: String?) {
        self.id = id
        self.icon = icon
        self.label = label
        self.when = when
    }
}

// MARK: - AI elf

/// One bullet in the task AI-elf strip.
public struct MailTaskElfBullet: Identifiable, Sendable, Hashable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let text: String

    public init(id: String, icon: PantopusIcon, label: String, text: String) {
        self.id = id
        self.icon = icon
        self.label = label
        self.text = text
    }
}

/// Sky-gradient elf strip payload (headline + summary + bullets).
public struct MailTaskElf: Sendable, Hashable {
    public let headline: String
    public let summary: String
    public let bullets: [MailTaskElfBullet]

    public init(headline: String, summary: String, bullets: [MailTaskElfBullet]) {
        self.headline = headline
        self.summary = summary
        self.bullets = bullets
    }
}

// MARK: - Source mail

/// "Pulled from this mail" card payload. Tapping the card opens the
/// originating mail item detail (`mailId`).
public struct MailTaskSourceMail: Sendable, Hashable {
    public let mailId: String
    public let categoryLabel: String
    public let sender: String
    public let title: String
    public let snippet: String
    public let time: String

    public init(
        mailId: String,
        categoryLabel: String,
        sender: String,
        title: String,
        snippet: String,
        time: String
    ) {
        self.mailId = mailId
        self.categoryLabel = categoryLabel
        self.sender = sender
        self.title = title
        self.snippet = snippet
        self.time = time
    }
}

// MARK: - Completion summary (done frame)

/// One row in the "What got filed" completion summary.
public struct MailTaskCompletionRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let icon: PantopusIcon
    public let label: String
    public let value: String
    /// Render the value in a monospaced face (confirmation numbers).
    public let isMono: Bool

    public init(id: String, icon: PantopusIcon, label: String, value: String, isMono: Bool = false) {
        self.id = id
        self.icon = icon
        self.label = label
        self.value = value
        self.isMono = isMono
    }
}

/// Done-frame completion stamp shown on the hero ("Done May 28 · 4:12 PM").
public struct MailTaskCompletion: Sendable, Hashable {
    public let stamp: String
    public let note: String
    public let rows: [MailTaskCompletionRow]

    public init(stamp: String, note: String, rows: [MailTaskCompletionRow]) {
        self.stamp = stamp
        self.note = note
        self.rows = rows
    }
}

// MARK: - Next up (done frame)

/// "Next up from your mail" suggestion card payload.
public struct MailTaskNextUp: Sendable, Hashable {
    public let mailId: String
    public let categoryLabel: String
    public let title: String
    public let due: String
    public let from: String

    public init(mailId: String, categoryLabel: String, title: String, due: String, from: String) {
        self.mailId = mailId
        self.categoryLabel = categoryLabel
        self.title = title
        self.due = due
        self.from = from
    }
}

// MARK: - Content

/// Full projection backing the Mail-task screen. The view-model owns one
/// of these once loaded and mutates `subtasks` / `isDone` locally.
public struct MailTaskContent: Sendable, Hashable {
    public let taskId: String
    public let timeLabel: String
    public let title: String
    public let reference: String
    public let priority: MailTaskPriority
    public var subtasks: [MailTaskSubtask]
    // The slots below have no backend source on the native task API today,
    // so the live path leaves them nil/empty (the view hides them) while
    // `MailTaskSampleData` fills them for previews + snapshots.
    public let due: MailTaskDue?
    public let snoozeOptions: [MailTaskSnoozeOption]
    public let source: MailTaskSourceMail?
    public let elfOpen: MailTaskElf?
    public let elfDone: MailTaskElf?
    public let completion: MailTaskCompletion?
    public let nextUp: MailTaskNextUp?
    public var isDone: Bool

    public init(
        taskId: String,
        timeLabel: String,
        title: String,
        reference: String,
        priority: MailTaskPriority,
        subtasks: [MailTaskSubtask] = [],
        due: MailTaskDue? = nil,
        snoozeOptions: [MailTaskSnoozeOption] = [],
        source: MailTaskSourceMail? = nil,
        elfOpen: MailTaskElf? = nil,
        elfDone: MailTaskElf? = nil,
        completion: MailTaskCompletion? = nil,
        nextUp: MailTaskNextUp? = nil,
        isDone: Bool = false
    ) {
        self.taskId = taskId
        self.timeLabel = timeLabel
        self.title = title
        self.reference = reference
        self.priority = priority
        self.subtasks = subtasks
        self.due = due
        self.snoozeOptions = snoozeOptions
        self.source = source
        self.elfOpen = elfOpen
        self.elfDone = elfDone
        self.completion = completion
        self.nextUp = nextUp
        self.isDone = isDone
    }

    /// Total subtasks.
    public var totalSteps: Int {
        subtasks.count
    }

    /// Steps counted as finished. When the task is marked done every step
    /// reads as complete regardless of its own flag.
    public var finishedSteps: Int {
        isDone ? totalSteps : subtasks.filter(\.isDone).count
    }

    /// Progress fraction in `0...1`.
    public var progress: Double {
        guard totalSteps > 0 else { return 0 }
        return Double(finishedSteps) / Double(totalSteps)
    }

    /// The elf payload for the current frame (nil on the live path).
    public var elf: MailTaskElf? {
        isDone ? elfDone : elfOpen
    }
}

// MARK: - State

/// Lifecycle state for the Mail-task screen.
@MainActor
public enum MailTaskState {
    case loading
    case loaded(MailTaskContent)
    case error(message: String)
}

/// Initial seed for the screen — `active` (open) or `done`.
public enum MailTaskSeed: Sendable, Hashable {
    case active
    case done
}
