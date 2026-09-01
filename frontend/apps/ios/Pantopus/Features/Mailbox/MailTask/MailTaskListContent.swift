//
//  MailTaskListContent.swift
//  Pantopus
//
//  A17.12 (list surface) — render-only models for the Mail-tasks screen:
//  the list of every mail-linked task plus the "create a task from this
//  mail" form. The designs folder carries a frame for the *detail*
//  (`tasks.jsx` → A17.12) but none for the list, so the list follows the
//  A17 chrome (nav row + section cards) and mirrors the RN behaviour in
//  `src/app/mailbox/tasks.tsx` one-for-one: active rows, a collapsible
//  "Completed (n)" section, tap-to-complete / reopen, and
//  convert-to-neighbor-gig.
//
//  Mirrors `ui/screens/mailbox/mail_task/MailTaskListContent.kt` on
//  Android.
//

import Foundation

// MARK: - Row

/// One mail-linked task row. Projected from `P3TaskDTO`; only the fields
/// the backend actually returns are modelled (no faked subtasks/elf).
public struct MailTaskRow: Identifiable, Sendable, Hashable {
    public let id: String
    public let title: String
    /// Backend `description` — used as the confirm-dialog body when the
    /// user converts the task to a neighbor gig.
    public let detail: String
    public let priority: MailTaskPriority
    /// Pre-formatted "Due tomorrow" / "Due Jun 3" label, nil when unset.
    public let dueLabel: String?
    /// Sender of the originating mail (server-enriched `mail_sender`).
    public let mailSender: String?
    /// Subject of the originating mail (server-enriched `mail_preview`).
    public let mailPreview: String?
    public let isDone: Bool
    /// True once `converted_to_gig_id` is set — the row shows a "Posted
    /// as neighbor task" badge and the convert action is withdrawn.
    public let isConvertedToGig: Bool

    public init(
        id: String,
        title: String,
        detail: String,
        priority: MailTaskPriority,
        dueLabel: String?,
        mailSender: String?,
        mailPreview: String?,
        isDone: Bool,
        isConvertedToGig: Bool
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.priority = priority
        self.dueLabel = dueLabel
        self.mailSender = mailSender
        self.mailPreview = mailPreview
        self.isDone = isDone
        self.isConvertedToGig = isConvertedToGig
    }

    /// Copy with a flipped done flag — used by the optimistic toggle.
    public func withDone(_ done: Bool) -> MailTaskRow {
        MailTaskRow(
            id: id,
            title: title,
            detail: detail,
            priority: priority,
            dueLabel: dueLabel,
            mailSender: mailSender,
            mailPreview: mailPreview,
            isDone: done,
            isConvertedToGig: isConvertedToGig
        )
    }

    /// Copy marked as converted — used after `POST /p3/tasks/:id/to-gig`.
    public func withConvertedToGig() -> MailTaskRow {
        MailTaskRow(
            id: id,
            title: title,
            detail: detail,
            priority: priority,
            dueLabel: dueLabel,
            mailSender: mailSender,
            mailPreview: mailPreview,
            isDone: isDone,
            isConvertedToGig: true
        )
    }
}

// MARK: - State

/// Four render states for the Mail-tasks list (Block 2F state rule).
public enum MailTaskListState: Sendable {
    case loading
    case empty
    case loaded(active: [MailTaskRow], completed: [MailTaskRow])
    case error(message: String)
}

/// Which frame the screen shows. `.create` is entered when the screen is
/// opened from a mail item (RN `tasks.tsx:28`).
public enum MailTaskListMode: String, Sendable, Hashable {
    case list
    case create
}

/// Blocking alert payload — mirrors RN's `Alert.alert(title, message)`
/// error paths so the copy matches across platforms.
public struct MailTaskListAlert: Identifiable, Sendable, Hashable {
    public let id = UUID()
    public let title: String
    public let message: String

    public init(title: String, message: String) {
        self.title = title
        self.message = message
    }
}
