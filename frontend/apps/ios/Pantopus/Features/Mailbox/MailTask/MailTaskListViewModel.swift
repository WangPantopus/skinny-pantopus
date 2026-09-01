//
//  MailTaskListViewModel.swift
//  Pantopus
//
//  A17.12 (list surface) — backs the Mail-tasks screen. Ports the RN
//  behaviour in `src/app/mailbox/tasks.tsx` (:47 load, :57 create, :96
//  toggle, :112 convert):
//
//  · `GET  /api/mailbox/v2/p3/tasks`             → `{ active, completed }`
//  · `POST /api/mailbox/v2/p3/tasks/from-mail`   → create from a mail item
//  · `PATCH /api/mailbox/v2/p3/tasks/:id`        → complete / reopen
//  · `POST /api/mailbox/v2/p3/tasks/:id/to-gig`  → post as a neighbor gig
//
//  Creating needs a `homeId`, which the backend does not infer — RN
//  resolves it from `GET /api/homes/my-homes` and takes the first home
//  (`tasks.tsx:70-76`); we do the same and surface the same "No Home"
//  alert when the user has none.
//
//  Mirrors `ui/screens/mailbox/mail_task/MailTaskListViewModel.kt` on
//  Android.
//

import Foundation
import Observation

@Observable
@MainActor
public final class MailTaskListViewModel {
    public private(set) var state: MailTaskListState = .loading

    /// `.create` when the screen was opened from a mail item.
    public var mode: MailTaskListMode
    /// Collapsible "Completed (n)" section — collapsed by default, as in RN.
    public var showsCompleted = false
    /// Transient success banner; the view clears it after display.
    public var toast: String?
    /// Blocking error alert (mirrors RN's `Alert.alert` failure paths).
    public var alert: MailTaskListAlert?
    /// Row awaiting the "Post as Task" confirm dialog.
    public var convertTarget: MailTaskRow?

    // MARK: Create-form fields

    public var draftTitle: String
    public var draftDescription: String = ""
    public var draftPriority: MailTaskPriority = .medium
    public private(set) var isCreating = false
    public private(set) var convertingTaskId: String?

    /// The originating mail, when the screen was opened from one.
    public let mailId: String?
    public let mailSubject: String?
    public let mailSender: String?

    private let client: APIClient
    private let onOpenTask: @MainActor (String) -> Void
    private let onBack: @MainActor () -> Void
    private let onPostAsNeighborTask: @MainActor (String) -> Void

    init(
        mailId: String? = nil,
        mailSubject: String? = nil,
        mailSender: String? = nil,
        client: APIClient = .shared,
        onOpenTask: @escaping @MainActor (String) -> Void = { _ in },
        onBack: @escaping @MainActor () -> Void = {},
        onPostAsNeighborTask: @escaping @MainActor (String) -> Void = { _ in }
    ) {
        self.onPostAsNeighborTask = onPostAsNeighborTask
        self.mailId = mailId
        self.mailSubject = mailSubject
        self.mailSender = mailSender
        self.client = client
        self.onOpenTask = onOpenTask
        self.onBack = onBack
        mode = mailId == nil ? .list : .create
        draftTitle = mailSubject ?? ""
    }

    // MARK: - Lifecycle

    public func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    private func fetch() async {
        state = .loading
        let result = await client.perform(MailboxV2Endpoints.p3Tasks(), as: P3TasksResponse.self)
        switch result {
        case let .success(response):
            let active = response.active.map(Self.row(from:))
            let completed = response.completed.map(Self.row(from:))
            state = active.isEmpty && completed.isEmpty
                ? .empty
                : .loaded(active: active, completed: completed)
        case .failure:
            state = .error(message: "We couldn't load your mail tasks. Check your connection and try again.")
        }
    }

    // MARK: - Navigation intents

    public func tapBack() {
        if mode == .create, mailId != nil {
            // RN's create frame backs out to the list, not out of the screen.
            mode = .list
            return
        }
        onBack()
    }

    public func openTask(_ row: MailTaskRow) {
        onOpenTask(row.id)
    }

    /// Enter the create frame from the list (only meaningful when the
    /// screen carries an originating mail).
    public func startCreate() {
        guard mailId != nil else {
            alert = MailTaskListAlert(
                title: "No Mail",
                message: "This task must be linked to a mail item."
            )
            return
        }
        mode = .create
    }

    public func cancelCreate() {
        mode = .list
    }

    /// A17.8 → "Ask a Neighbor". RN's create frame offers "Post as Neighbor
    /// Task Instead", which leaves the task pipeline entirely and opens the
    /// package-gig form for the source mail in post-delivery mode
    /// (`src/app/mailbox/tasks.tsx:231-240`).
    public func postAsNeighborTask() {
        guard let mailId else {
            alert = MailTaskListAlert(
                title: "No Mail",
                message: "This task must be linked to a mail item."
            )
            return
        }
        onPostAsNeighborTask(mailId)
    }

    // MARK: - Create

    /// `POST /p3/tasks/from-mail`. Resolves the home first (the backend
    /// requires an explicit `homeId`), then prepends the created task to
    /// the active bucket and returns to the list frame.
    public func create() async {
        let title = draftTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else {
            alert = MailTaskListAlert(title: "Title Required", message: "Please enter a task title.")
            return
        }
        guard let mailId else {
            alert = MailTaskListAlert(title: "No Mail", message: "This task must be linked to a mail item.")
            return
        }
        guard !isCreating else { return }
        isCreating = true
        defer { isCreating = false }

        guard let homeId = await firstHomeId() else {
            alert = MailTaskListAlert(title: "No Home", message: "You need to be associated with a home.")
            return
        }

        let description = draftDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        let request = P3CreateTaskFromMailRequest(
            mailId: mailId,
            homeId: homeId,
            title: title,
            description: description.isEmpty ? nil : description,
            priority: draftPriority.rawValue
        )
        let result = await client.perform(
            MailboxTasksEndpoints.createTaskFromMail(request),
            as: P3TaskResponse.self
        )
        switch result {
        case let .success(response):
            let row = Self.row(from: response.task)
            insertActive(row)
            draftDescription = ""
            draftPriority = .medium
            mode = .list
            toast = "\u{201C}\(row.title)\u{201D} has been created"
        case .failure:
            alert = MailTaskListAlert(title: "Error", message: "Could not create task.")
        }
    }

    /// RN resolves the home with `api.homes.getHomes()` and takes the
    /// first entry (`tasks.tsx:70-76`).
    private func firstHomeId() async -> String? {
        let result = await client.perform(HomesEndpoints.myHomes(), as: MyHomesResponse.self)
        guard case let .success(response) = result else { return nil }
        return response.homes.first?.id
    }

    // MARK: - Complete / reopen

    /// Optimistically move the row between buckets, then persist with
    /// `PATCH /p3/tasks/:id`. Rolls back and alerts on failure.
    public func toggle(_ row: MailTaskRow) {
        guard case let .loaded(active, completed) = state else { return }
        let nextDone = !row.isDone
        let moved = row.withDone(nextDone)
        if nextDone {
            state = .loaded(
                active: active.filter { $0.id != row.id },
                completed: [moved] + completed
            )
        } else {
            state = .loaded(
                active: [moved] + active,
                completed: completed.filter { $0.id != row.id }
            )
        }
        let status = nextDone ? "completed" : "pending"
        Task {
            let result = await client.perform(
                MailboxV2Endpoints.updateP3Task(taskId: row.id, request: P3TaskUpdateRequest(status: status)),
                as: P3TaskResponse.self
            )
            if case .failure = result {
                restore(row)
                alert = MailTaskListAlert(title: "Error", message: "Could not update task.")
            }
        }
    }

    /// Undo an optimistic toggle by putting the row back where it was.
    private func restore(_ row: MailTaskRow) {
        guard case let .loaded(active, completed) = state else { return }
        var nextActive = active.filter { $0.id != row.id }
        var nextCompleted = completed.filter { $0.id != row.id }
        if row.isDone {
            nextCompleted = [row] + nextCompleted
        } else {
            nextActive = [row] + nextActive
        }
        state = .loaded(active: nextActive, completed: nextCompleted)
    }

    // MARK: - Convert to neighbor gig

    /// Row tap on an unconverted active task opens the RN confirm sheet
    /// ("Post as Task" / "Close").
    public func requestConvert(_ row: MailTaskRow) {
        guard !row.isConvertedToGig else { return }
        convertTarget = row
    }

    /// `POST /p3/tasks/:id/to-gig`. On success the backend links the gig
    /// onto the task and flips it to `in_progress`; we mirror that by
    /// badging the row.
    public func confirmConvert() async {
        guard let row = convertTarget else { return }
        convertTarget = nil
        convertingTaskId = row.id
        defer { convertingTaskId = nil }
        let detail = row.detail.trimmingCharacters(in: .whitespacesAndNewlines)
        let result = await client.perform(
            MailboxTasksEndpoints.convertTaskToGig(
                taskId: row.id,
                request: P3TaskToGigRequest(
                    title: row.title,
                    description: detail.isEmpty ? nil : detail
                )
            ),
            as: P3TaskToGigResponse.self
        )
        switch result {
        case let .success(response):
            markConverted(row.id)
            let title = response.title ?? row.title
            toast = "\u{201C}\(title)\u{201D} posted as a neighbor task"
        case .failure:
            alert = MailTaskListAlert(title: "Error", message: "Could not convert to gig.")
        }
    }

    private func markConverted(_ taskId: String) {
        guard case let .loaded(active, completed) = state else { return }
        state = .loaded(
            active: active.map { $0.id == taskId ? $0.withConvertedToGig() : $0 },
            completed: completed.map { $0.id == taskId ? $0.withConvertedToGig() : $0 }
        )
    }

    private func insertActive(_ row: MailTaskRow) {
        switch state {
        case let .loaded(active, completed):
            state = .loaded(active: [row] + active, completed: completed)
        default:
            state = .loaded(active: [row], completed: [])
        }
    }

    // MARK: - Derived

    public var activeCount: Int {
        if case let .loaded(active, _) = state { return active.count }
        return 0
    }

    public var completedCount: Int {
        if case let .loaded(_, completed) = state { return completed.count }
        return 0
    }

    // MARK: - DTO → projection

    private static func row(from dto: P3TaskDTO) -> MailTaskRow {
        MailTaskRow(
            id: dto.id,
            title: dto.title,
            detail: dto.description ?? "",
            priority: MailTaskPriority(rawValue: dto.priority ?? "medium") ?? .medium,
            dueLabel: dueLabel(from: dto.dueAt),
            mailSender: dto.mailSender,
            mailPreview: dto.mailPreview,
            isDone: (dto.status ?? "") == "completed",
            isConvertedToGig: !(dto.convertedToGigId ?? "").isEmpty
        )
    }

    private static func dueLabel(from dueAt: String?) -> String? {
        guard let dueAt, let date = parseDate(dueAt) else { return nil }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Due today" }
        if calendar.isDateInTomorrow(date) { return "Due tomorrow" }
        return "Due \(dayMonthFormatter.string(from: date))"
    }

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

    private static let dateOnlyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let dayMonthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter
    }()
}
