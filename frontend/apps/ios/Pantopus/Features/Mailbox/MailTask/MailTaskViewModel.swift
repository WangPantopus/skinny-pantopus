//
//  MailTaskViewModel.swift
//  Pantopus
//
//  A17.12 / Block 2A — Mail-task detail view-model. The live path (no
//  explicit `seed`) fetches `GET /api/mailbox/v2/p3/tasks` and selects
//  the task by id (there is no detail-by-id route), mapping the flat
//  `HomeTask` fields — title / reference / priority / due / status / the
//  source-mail link — into `MailTaskContent`. The rich AI elf, subtask
//  checklist, snooze, completion summary, and next-up slots have no
//  backend source today, so they stay nil/empty and the view hides them
//  (never faked). Mark-done / reopen round-trip via
//  `PATCH /p3/tasks/:id`. An explicit `seed` keeps the view-model local
//  (the preview / test seam) and projects `MailTaskSampleData`.
//
//  Mirrors `ui/screens/mailbox/mail_task/MailTaskViewModel.kt` on Android.
//

import Foundation
import Observation

@Observable
@MainActor
public final class MailTaskViewModel {
    public private(set) var state: MailTaskState = .loading
    /// Transient banner; the view clears it after display.
    public var toast: String?
    /// Delegate sheet visibility — "Hand this off · Home drawer".
    public var showsDelegateSheet: Bool = false

    private let taskId: String
    /// Non-nil → preview / test seam (project the sample fixture, no fetch).
    private let seed: MailTaskSeed?
    private let client: APIClient
    /// Opens the originating / next-up mail item detail. Injected by the
    /// tab root so the card taps push `.mailItemDetail`.
    private let onOpenMail: @MainActor (String) -> Void
    private let onBack: @MainActor () -> Void

    init(
        taskId: String,
        seed: MailTaskSeed? = nil,
        client: APIClient = .shared,
        onOpenMail: @escaping @MainActor (String) -> Void = { _ in },
        onBack: @escaping @MainActor () -> Void = {}
    ) {
        self.taskId = taskId
        self.seed = seed
        self.client = client
        self.onOpenMail = onOpenMail
        self.onBack = onBack
    }

    // MARK: - Lifecycle

    public func load() async {
        // Preview / test seam: an explicit seed keeps the screen local.
        if let seed {
            state = .loaded(MailTaskSampleData.task(taskId: taskId, seed: seed))
            return
        }
        await fetch()
    }

    /// Retry after an error frame.
    public func retry() async {
        await fetch()
    }

    private func fetch() async {
        state = .loading
        let result = await client.perform(MailboxV2Endpoints.p3Tasks(), as: P3TasksResponse.self)
        switch result {
        case let .success(response):
            let all = response.active + response.completed
            if let dto = all.first(where: { $0.id == taskId }) {
                state = .loaded(Self.content(from: dto))
            } else {
                state = .error(message: "This task is no longer available.")
            }
        case .failure:
            state = .error(message: "We couldn't load this task. Check your connection and try again.")
        }
    }

    // MARK: - Derived chrome

    /// True once the task is marked done — flips the dock + hero treatment.
    public var isDone: Bool {
        guard case let .loaded(content) = state else { return seed == .done }
        return content.isDone
    }

    // MARK: - View intents

    public func tapBack() {
        onBack()
    }

    /// Toggle a checklist subtask. Live tasks carry no subtasks, so this
    /// only fires in the sample/preview path. No-op once done.
    public func toggleSubtask(id: String) {
        guard case var .loaded(content) = state, !content.isDone else { return }
        guard let index = content.subtasks.firstIndex(where: { $0.id == id }) else { return }
        content.subtasks[index].isDone.toggle()
        state = .loaded(content)
    }

    /// Mark the whole task done — optimistic flip + `PATCH status=completed`.
    public func markDone() {
        guard case var .loaded(content) = state, !content.isDone else { return }
        content.isDone = true
        state = .loaded(content)
        toast = "Marked done"
        persistStatus("completed", rollbackDoneTo: false)
    }

    /// Reopen a completed task — optimistic flip + `PATCH status=pending`.
    public func reopen() {
        guard case var .loaded(content) = state, content.isDone else { return }
        content.isDone = false
        state = .loaded(content)
        toast = "Task reopened"
        persistStatus("pending", rollbackDoneTo: true)
    }

    /// Persist the done/open flip. No-op in the seeded preview/test path;
    /// rolls the optimistic flip back on failure.
    private func persistStatus(_ status: String, rollbackDoneTo previous: Bool) {
        guard seed == nil else { return }
        let id = taskId
        Task {
            let result = await client.perform(
                MailboxV2Endpoints.updateP3Task(taskId: id, request: P3TaskUpdateRequest(status: status)),
                as: P3TaskResponse.self
            )
            if case .failure = result, case var .loaded(content) = state {
                content.isDone = previous
                state = .loaded(content)
                toast = "Couldn't save — try again"
            }
        }
    }

    /// Quick-snooze tap — pushes due date out one day via PATCH.
    public func snooze(optionId: String) {
        guard case let .loaded(content) = state,
              let option = content.snoozeOptions.first(where: { $0.id == optionId }) else { return }
        toast = "Snoozed · \(option.label)"
        guard seed == nil else { return }
        let due = ISO8601DateFormatter().string(from: Date().addingTimeInterval(86400))
        Task {
            let result = await client.perform(
                MailboxV2Endpoints.updateP3Task(
                    taskId: taskId,
                    request: P3TaskUpdateRequest(status: nil, dueAt: due)
                ),
                as: P3TaskResponse.self
            )
            if case .failure = result {
                toast = "Couldn't snooze — try again"
            }
        }
    }

    /// Open the snooze picker from the dock chip. Stubbed.
    public func snoozeFromDock() {
        toast = "Snooze options"
    }

    /// Delegate → "Hand this off · Home drawer". Opens the delegate sheet.
    public func delegate() {
        showsDelegateSheet = true
    }

    /// Open the originating mail (`SourceMailCard` tap).
    public func openSourceMail() {
        guard case let .loaded(content) = state, let source = content.source else { return }
        onOpenMail(source.mailId)
    }

    /// Open the next-up suggestion (`NextUpCard` tap, done frame).
    public func openNextUp() {
        guard case let .loaded(content) = state, let nextUp = content.nextUp else { return }
        onOpenMail(nextUp.mailId)
    }

    /// Add-a-step affordance on the checklist header. Stubbed.
    public func addStep() {
        toast = "Add a step"
    }

    /// Calendar dock chip (open frame) — stubbed.
    public func addToCalendar() {
        toast = "Added to calendar"
    }

    /// "View confirmation" dock chip — opens the source mail when linked.
    public func viewConfirmation() {
        openSourceMail()
    }

    /// Archive dock chip. It only renders on the completed frame, and the
    /// backend has no archived status for tasks (`PATCH /p3/tasks/:id` accepts
    /// pending / in_progress / completed) — so archiving means "make sure it's
    /// done, then put it away". `markDone()` no-ops when it already is; the
    /// dismissal is what the user sees.
    public func archive() {
        markDone()
        onBack()
    }

    // MARK: - DTO → projection

    private static func content(from dto: P3TaskDTO) -> MailTaskContent {
        let priority = MailTaskPriority(rawValue: dto.priority ?? "medium") ?? .medium
        let isDone = (dto.status ?? "") == "completed"
        return MailTaskContent(
            taskId: dto.id,
            timeLabel: timeLabel(createdAt: dto.createdAt),
            title: dto.title,
            reference: dto.description ?? "",
            priority: priority,
            due: due(from: dto.dueAt),
            source: source(from: dto),
            isDone: isDone
        )
    }

    private static func source(from dto: P3TaskDTO) -> MailTaskSourceMail? {
        guard let mailId = dto.mailId, !mailId.isEmpty else { return nil }
        return MailTaskSourceMail(
            mailId: mailId,
            categoryLabel: "Mail",
            sender: dto.mailSender ?? "",
            title: dto.mailPreview ?? "Original mail",
            snippet: "",
            time: ""
        )
    }

    private static func timeLabel(createdAt: String?) -> String {
        guard let createdAt, let date = parseDate(createdAt) else { return "Auto-created" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return "Auto-created · \(formatter.localizedString(for: date, relativeTo: Date()))"
    }

    private static func due(from dueAt: String?) -> MailTaskDue? {
        guard let dueAt, let date = parseDate(dueAt) else { return nil }
        let calendar = Calendar.current
        return MailTaskDue(
            weekday: weekdayFormatter.string(from: date).uppercased(),
            day: String(calendar.component(.day, from: date)),
            month: monthFormatter.string(from: date).uppercased(),
            label: dueLabel(for: date, calendar: calendar),
            time: timeFormatter.string(from: date),
            // No backend source — the live path hides the DueSnoozeCard that
            // would render these, so they stay blank rather than faked.
            left: "",
            reminderLabel: "",
            closesLabel: ""
        )
    }

    private static func dueLabel(for date: Date, calendar: Calendar) -> String {
        if calendar.isDateInToday(date) { return "Due today" }
        if calendar.isDateInTomorrow(date) { return "Due tomorrow" }
        return "Due \(dayMonthFormatter.string(from: date))"
    }

    // MARK: - Date parsing / formatting

    private static func parseDate(_ value: String) -> Date? {
        isoFractional.date(from: value)
            ?? isoPlain.date(from: value)
            ?? dateOnlyFormatter.date(from: value)
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain = ISO8601DateFormatter()

    private static func displayFormatter(_ pattern: String) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = pattern
        return formatter
    }

    private static let dateOnlyFormatter = displayFormatter("yyyy-MM-dd")
    private static let weekdayFormatter = displayFormatter("EEE")
    private static let monthFormatter = displayFormatter("MMM")
    private static let timeFormatter = displayFormatter("h:mm a")
    private static let dayMonthFormatter = displayFormatter("MMM d")
}
