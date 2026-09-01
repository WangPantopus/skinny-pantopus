//
//  HouseholdTasksListViewModel.swift
//  Pantopus
//
//  T6.3c — Backs `HouseholdTasksListView` (P11). Fetches
//  `GET /api/homes/:id/tasks` (route `backend/routes/home.js:4170`) and
//  projects each task into the shared `ListOfRowsView` archetype with
//  three tabs (Active / Done / Recurring) tinted in the home pillar.
//
//  Distinct from `MyTasksViewModel` (T5.3.2) which lists the user's
//  posted-to-neighbours gigs reached via `me.gigs`. This is the
//  PER-HOME chore list — internal "who's vacuuming, taking out the
//  trash, walking the dog" — reached via `me.tasks` and the Home
//  Dashboard "Tasks" quick-action tile.
//
//  Design contract (see `householdtasks-frames.jsx`):
//    • Three tabs with live counts:
//        - Active    = status in {open, in_progress}
//        - Done      = status == 'done' (rolling 30-day window)
//        - Recurring = recurrence_rule != nil
//    • Active rows render a home-tinted summary banner (`N due today`
//      + overdue count) above the list when there's anything to say.
//    • 56pt `secondaryCreate` FAB tinted `.home` per the design brief.
//    • Category-tinted leading tile (`HouseholdTaskCategory` palette)
//      shown when the task is unassigned; `RowLeading.avatar` shown
//      with the home identity ring when an assignee is set.
//    • Active trailing = round-checkbox `circularAction` that
//      optimistically toggles to Done.
//    • Done trailing = success status chip; "Done by … · …" surfaces
//      in the subtitle.
//    • Recurring trailing = kebab; recurrence cadence surfaces in the
//      inline chip.
//
//  Backend deviation from prompt: the prompt specifies
//  `template_id != null` for the Recurring filter, but the live
//  `HomeTask` schema (`backend/database/schema.sql:6833`) has no
//  `template_id` column — recurrence is captured in the
//  `recurrence_rule` RRULE text field. The Recurring filter therefore
//  uses `recurrence_rule != nil`, which is the canonical signal today.
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

/// Canonical chip status for one household task. Reduces the backend's
/// 4-state `status` column to the 3 buckets the design surfaces.
public enum HouseholdTaskChipStatus: String, Sendable, Hashable {
    case active
    case done
    case canceled
}

/// Tab identifiers — kept as raw strings so they survive the
/// `ListOfRowsDataSource.selectedTab: String` contract.
enum HouseholdTasksTab: String, CaseIterable {
    case active
    case done
    case recurring
}

private struct HouseholdTasksTabCounts {
    let active: Int?
    let done: Int?
    let recurring: Int?
}

/// Banner data for the Active-tab summary banner. Pure projection from
/// the loaded tasks + clock — exposed as a top-level value so tests can
/// exercise it without standing the VM up.
public struct HouseholdTasksBannerSummary: Sendable, Equatable {
    /// Count of active tasks whose `due_at` falls within today's local
    /// 24-hour window (inclusive of overdue).
    public let dueTodayCount: Int
    /// Count of active tasks whose `due_at` is strictly before today
    /// (rolls into the warning copy under the banner).
    public let overdueCount: Int

    public init(dueTodayCount: Int, overdueCount: Int) {
        self.dueTodayCount = dueTodayCount
        self.overdueCount = overdueCount
    }

    /// Whether the banner has anything to render. The Active tab hides
    /// the banner when this returns `false` so a fresh household with
    /// only future-dated chores doesn't carry a "0 due today" preamble.
    public var hasContent: Bool {
        dueTodayCount > 0 || overdueCount > 0
    }
}

/// One-shot event the view turns into a confirm sheet. Mirrors the
/// `MyHomesListEvent` pattern: the VM never presents UI itself.
enum HouseholdTasksListEvent: Equatable {
    /// The row's trash affordance was tapped — the view opens the
    /// destructive confirm naming `title`.
    case confirmDelete(taskId: String, title: String)
}

/// Pure projection of one task into a row's display fields.
public struct HouseholdTaskRowProjection: Sendable, Equatable {
    public let title: String
    public let subtitle: String
    public let chipText: String?
    public let chipVariant: StatusChipVariant?
    public let chipIcon: PantopusIcon?
    public let recurrenceChip: String?
    public let category: HouseholdTaskCategory
    public let isAssigned: Bool
    public let assigneeLabel: String?
    public let highlight: RowHighlight?
}

private struct HouseholdTaskDueProjection {
    let chipText: String?
    let chipVariant: StatusChipVariant?
    let chipIcon: PantopusIcon?
    let dueLine: String?

    static let empty = HouseholdTaskDueProjection(
        chipText: nil,
        chipVariant: nil,
        chipIcon: nil,
        dueLine: nil
    )
}

/// ViewModel for the Household tasks list. Builds `RowModel`s from
/// `HomeTaskDTO`s and re-renders the tab filter client-side — backend
/// supports `?status=` queries (line 4178 of `home.js` doesn't actually
/// filter today) but the design wants three buckets the server doesn't
/// speak, so the VM owns the projection.
@Observable
@MainActor
final class HouseholdTasksListViewModel: ListOfRowsDataSource {
    let title = "Tasks"

    /// No top-bar action in T6.3c: the design's filter glyph isn't
    /// wired to a real filter sheet yet; the 3 tabs cover the design's
    /// filter intent. The FAB owns the canonical "Add a task" action so
    /// we don't need a duplicate entry point in the top bar. Tracked
    /// for a follow-up if a filter sheet ships.
    var topBarAction: TopBarAction? {
        nil
    }

    /// Tabs with live counts. Rebuilt whenever `tasks` changes.
    var tabs: [ListOfRowsTab] {
        let summary = tasks.map(counts) ?? HouseholdTasksTabCounts(
            active: nil, done: nil, recurring: nil
        )
        return [
            ListOfRowsTab(id: HouseholdTasksTab.active.rawValue, label: "Active", count: summary.active),
            ListOfRowsTab(id: HouseholdTasksTab.done.rawValue, label: "Done", count: summary.done),
            ListOfRowsTab(id: HouseholdTasksTab.recurring.rawValue, label: "Recurring", count: summary.recurring)
        ]
    }

    var selectedTab: String = HouseholdTasksTab.active.rawValue {
        didSet { rebuildState() }
    }

    /// FAB matches the brief: `secondaryCreate` (52pt) tinted `.home`.
    /// Bills uses `canonicalCreate` (56pt); the brief for tasks
    /// explicitly requests `secondaryCreate` so the chore-list visual
    /// weight stays a notch below the bill-money FAB.
    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Add a task",
            variant: .secondaryCreate,
            tint: .home
        ) { [onAddTask] in onAddTask() }
    }

    /// Optional summary banner above the rows. Nil on Done / Recurring;
    /// nil on Active when nothing is due today and nothing is overdue.
    /// Loading / empty / error states also hide it.
    var banner: BannerConfig? {
        guard case .loaded = state, HouseholdTasksTab(rawValue: selectedTab) == .active else {
            return nil
        }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .listChecks,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Set when a row's trash affordance fires. The view drains it into
    /// a `confirmationDialog` and clears it.
    var pendingEvent: HouseholdTasksListEvent?

    /// Surfaced by the view as an alert when a delete fails (403 no
    /// permission, network, …).
    var actionError: String?

    /// Last successful payload — held so a tab change can re-filter
    /// without re-fetching.
    private var tasks: [HomeTaskDTO]?

    private let homeId: String
    private let api: APIClient
    private let onOpenTask: @Sendable (String) -> Void
    private let onAddTask: @Sendable () -> Void
    private let onEditRecurring: @Sendable (String) -> Void
    /// Inject a stable "now" for tests; production uses `Date()`.
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenTask: @escaping @Sendable (String) -> Void = { _ in },
        onAddTask: @escaping @Sendable () -> Void = {},
        onEditRecurring: @escaping @Sendable (String) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenTask = onOpenTask
        self.onAddTask = onAddTask
        self.onEditRecurring = onEditRecurring
        self.now = now
    }

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    /// Backend has no pagination on tasks today.
    func loadMoreIfNeeded() async {}

    private func fetch() async {
        do {
            let response: GetHomeTasksResponse = try await api.request(
                HomesEndpoints.tasks(homeId: homeId)
            )
            tasks = response.tasks
            rebuildState()
        } catch {
            tasks = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your tasks."
            )
        }
    }

    /// Optimistic Active-tab "toggle done" — flips the row locally,
    /// fires the PUT, rolls back on failure. Called from the row's
    /// circular checkbox action.
    func toggleDone(taskId: String) async {
        guard var loaded = tasks, let idx = loaded.firstIndex(where: { $0.id == taskId }) else {
            return
        }
        let original = loaded[idx]
        let newStatus = original.status == "done" ? "open" : "done"
        let completedAt = newStatus == "done"
            ? ISO8601DateFormatter().string(from: now())
            : nil
        // Build optimistic snapshot.
        loaded[idx] = HomeTaskDTO(
            id: original.id,
            homeId: original.homeId,
            taskType: original.taskType,
            title: original.title,
            description: original.description,
            assignedTo: original.assignedTo,
            dueAt: original.dueAt,
            recurrenceRule: original.recurrenceRule,
            status: newStatus,
            priority: original.priority,
            completedAt: completedAt,
            createdBy: original.createdBy,
            createdAt: original.createdAt,
            updatedAt: original.updatedAt
        )
        tasks = loaded
        rebuildState()
        do {
            let _: HomeTaskResponse = try await api.request(
                HomesEndpoints.updateTask(
                    homeId: homeId,
                    taskId: taskId,
                    request: UpdateHomeTaskRequest(
                        status: newStatus,
                        completedAt: completedAt
                    )
                )
            )
        } catch {
            // Roll back.
            if var rolled = tasks, let i = rolled.firstIndex(where: { $0.id == taskId }) {
                rolled[i] = original
                tasks = rolled
                rebuildState()
            }
        }
    }

    /// Row trash tapped — hand the confirm to the view. RN raises the
    /// same confirm from the row's trash glyph
    /// (`src/app/homes/[id]/tasks.tsx:76-84`).
    func requestDelete(taskId: String) {
        guard let task = tasks?.first(where: { $0.id == taskId }) else { return }
        pendingEvent = .confirmDelete(taskId: taskId, title: task.title)
    }

    /// `DELETE /api/homes/:id/tasks/:taskId` — route
    /// `backend/routes/home.js:4354`. Optimistically drops the row, then
    /// restores it (and surfaces `actionError`) if the server refuses.
    func deleteTask(taskId: String) async {
        guard let loaded = tasks, let idx = loaded.firstIndex(where: { $0.id == taskId }) else {
            return
        }
        let original = loaded[idx]
        var pruned = loaded
        pruned.remove(at: idx)
        tasks = pruned
        rebuildState()
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.deleteTask(homeId: homeId, taskId: taskId)
            )
        } catch {
            // Roll back — put the row back where it was.
            var rolled = tasks ?? []
            rolled.insert(original, at: min(idx, rolled.count))
            tasks = rolled
            rebuildState()
            actionError = (error as? APIError)?.errorDescription
                ?? "Couldn't delete that task. Try again."
        }
    }

    private func rebuildState() {
        guard let tasks else { return }
        let nowDate = now()
        let tab = HouseholdTasksTab(rawValue: selectedTab) ?? .active
        let filtered = tasks.filter { passes($0, tab: tab, now: nowDate) }
        if filtered.isEmpty {
            state = .empty(emptyContent(for: tab))
            return
        }
        let rows = filtered.map { row(for: $0, tab: tab, now: nowDate) }
        state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
    }

    private func emptyContent(for tab: HouseholdTasksTab) -> ListOfRowsState.EmptyContent {
        switch tab {
        case .active:
            ListOfRowsState.EmptyContent(
                icon: .listChecks,
                headline: "No tasks yet",
                subcopy: "Track who's doing what. Add a one-off chore, or set up the recurring stuff " +
                    "(trash, dog walks, plants) once and let it spawn itself.",
                ctaTitle: "Add a task"
            ) { [onAddTask] in onAddTask() }
        case .done:
            ListOfRowsState.EmptyContent(
                icon: .checkCircle,
                headline: "Nothing done yet",
                subcopy: "Finished chores from the last 30 days will show up here.",
                ctaTitle: "Add a task"
            ) { [onAddTask] in onAddTask() }
        case .recurring:
            ListOfRowsState.EmptyContent(
                icon: .arrowsRepeat,
                headline: "No recurring chores",
                subcopy: "Set up the weekly trash run, daily dog walks, or plant watering once and they'll spawn themselves.",
                ctaTitle: "Add a recurring task"
            ) { [onAddTask] in onAddTask() }
        }
    }

    // MARK: - Row + chip mapping

    func row(for task: HomeTaskDTO, tab: HouseholdTasksTab, now: Date) -> RowModel {
        let projection = HouseholdTasksListViewModel.project(task: task, now: now)
        let taskId = task.id
        return RowModel(
            id: task.id,
            title: projection.title,
            subtitle: projection.subtitle,
            template: .statusChip,
            leading: leading(for: task, projection: projection),
            trailing: trailing(for: task, tab: tab, projection: projection, taskId: taskId),
            onTap: { [onOpenTask] in onOpenTask(taskId) },
            inlineChip: tab == .recurring && projection.recurrenceChip != nil
                ? RowChip(
                    text: projection.recurrenceChip ?? "",
                    icon: .arrowsRepeat,
                    tint: .custom(
                        background: projection.category.background,
                        foreground: projection.category.foreground
                    )
                )
                : nil,
            chips: chipsLine(for: tab, projection: projection),
            highlight: projection.highlight
        )
    }

    private func leading(
        for _: HomeTaskDTO,
        projection: HouseholdTaskRowProjection
    ) -> RowLeading {
        if projection.isAssigned, let label = projection.assigneeLabel {
            // The brief specifies `avatar of assignee with identity
            // ring` — render with the home identity pillar so the ring
            // matches the home-green tab strip + FAB tint.
            return .avatar(
                name: label,
                imageURL: nil,
                identity: .home,
                ringProgress: 1.0
            )
        }
        return .typeIcon(
            projection.category.icon,
            background: projection.category.background,
            foreground: projection.category.foreground
        )
    }

    /// Active + Done rows carry a two-button trailing: the checkbox that
    /// toggles the task **both ways** (RN's checkbox does `done → open`
    /// as well, `src/app/homes/[id]/tasks.tsx:52-58`) and the trash
    /// affordance RN puts on every row (`:167-169`). Recurring keeps its
    /// kebab — a recurring chore is still deletable from the Active tab,
    /// where the same row also appears.
    private func trailing(
        for task: HomeTaskDTO,
        tab: HouseholdTasksTab,
        projection _: HouseholdTaskRowProjection,
        taskId: String
    ) -> RowTrailing {
        switch tab {
        case .active, .done:
            let isDone = task.status == "done"
            return .iconActions(
                primary: RowIconAction(
                    icon: isDone ? .check : .circle,
                    accessibilityLabel: isDone ? "Mark not done" : "Mark done",
                    background: isDone ? Theme.Color.homeBg : Theme.Color.appSurface,
                    foreground: isDone ? Theme.Color.home : Theme.Color.appTextMuted
                ) { [weak self] in
                    Task { @MainActor [weak self] in
                        await self?.toggleDone(taskId: taskId)
                    }
                },
                secondary: RowIconAction(
                    icon: .trash,
                    accessibilityLabel: "Delete task",
                    background: Theme.Color.appSurfaceSunken,
                    foreground: Theme.Color.error
                ) { [weak self] in
                    Task { @MainActor [weak self] in
                        self?.requestDelete(taskId: taskId)
                    }
                }
            )
        case .recurring:
            return .kebab
        }
    }

    private func chipsLine(
        for tab: HouseholdTasksTab,
        projection: HouseholdTaskRowProjection
    ) -> [RowChip]? {
        guard tab != .recurring,
              let text = projection.chipText,
              let variant = projection.chipVariant else {
            return nil
        }
        return [RowChip(text: text, icon: projection.chipIcon, tint: .status(variant))]
    }

    /// Pure mapping from a task + clock to display strings. Exposed
    /// `static` so unit tests can exercise the chip / subtitle
    /// derivation without standing the VM up.
    static func project(task: HomeTaskDTO, now: Date) -> HouseholdTaskRowProjection {
        let category = HouseholdTaskCategory.from(title: task.title, taskType: task.taskType)
        let assigneeLabel = assigneeDisplay(for: task.assignedTo)
        let isAssigned = assigneeLabel != nil
        let recurrenceChip = humanRecurrence(rule: task.recurrenceRule)
        // Status / chip / subtitle vary by status.
        switch task.status {
        case "done":
            let doneTime = humanRelativeTime(iso: task.completedAt ?? task.updatedAt, now: now)
            let by = assigneeLabel ?? "Someone"
            return HouseholdTaskRowProjection(
                title: task.title,
                subtitle: doneTime.map { "Done by \(by) · \($0)" } ?? "Done by \(by)",
                chipText: nil,
                chipVariant: nil,
                chipIcon: nil,
                recurrenceChip: recurrenceChip,
                category: category,
                isAssigned: isAssigned,
                assigneeLabel: assigneeLabel,
                highlight: .muted
            )
        case "canceled":
            return HouseholdTaskRowProjection(
                title: task.title,
                subtitle: "Canceled",
                chipText: "Canceled",
                chipVariant: .neutral,
                chipIcon: .x,
                recurrenceChip: recurrenceChip,
                category: category,
                isAssigned: isAssigned,
                assigneeLabel: assigneeLabel,
                highlight: .muted
            )
        default:
            // open / in_progress
            let due = dueChip(for: task.dueAt, now: now)
            let assigneeLine = assigneeLabel.map { "Assigned to \($0)" } ?? "Unassigned"
            let subtitle = due.dueLine.map { "\(assigneeLine) · \($0)" } ?? assigneeLine
            return HouseholdTaskRowProjection(
                title: task.title,
                subtitle: subtitle,
                chipText: due.chipText,
                chipVariant: due.chipVariant,
                chipIcon: due.chipIcon,
                recurrenceChip: recurrenceChip,
                category: category,
                isAssigned: isAssigned,
                assigneeLabel: assigneeLabel,
                highlight: nil
            )
        }
    }

    /// Pure helper — maps `due_at` + clock to (chip text, chip variant,
    /// chip icon, subtitle-due-line). Returns `nil`s when the task has
    /// no due date.
    private static func dueChip(
        for iso: String?,
        now: Date
    ) -> HouseholdTaskDueProjection {
        guard let iso, let due = parseDate(iso) else {
            return .empty
        }
        let calendar = Calendar.current
        let dueDay = calendar.startOfDay(for: due)
        let nowDay = calendar.startOfDay(for: now)
        let days = calendar.dateComponents([.day], from: nowDay, to: dueDay).day ?? 0
        if days < 0 {
            let lateBy = -days
            let label = lateBy == 1 ? "1 day late" : "\(lateBy) days late"
            return HouseholdTaskDueProjection(
                chipText: label,
                chipVariant: .error,
                chipIcon: .alertCircle,
                dueLine: label
            )
        }
        if days == 0 {
            return HouseholdTaskDueProjection(
                chipText: "Today",
                chipVariant: .warning,
                chipIcon: .clock,
                dueLine: "Due today"
            )
        }
        if days == 1 {
            return HouseholdTaskDueProjection(
                chipText: "Tomorrow",
                chipVariant: .warning,
                chipIcon: .clock,
                dueLine: "Due tomorrow"
            )
        }
        if days <= 7 {
            let label = formatWeekday(due) ?? "This week"
            return HouseholdTaskDueProjection(
                chipText: label,
                chipVariant: .neutral,
                chipIcon: nil,
                dueLine: "Due \(label)"
            )
        }
        let label = formatDateShort(date: due) ?? "Later"
        return HouseholdTaskDueProjection(
            chipText: label,
            chipVariant: .neutral,
            chipIcon: nil,
            dueLine: "Due \(label)"
        )
    }

    /// Pass the row through tab membership. Per the brief:
    ///   - Active    = status in {open, in_progress}
    ///   - Done      = status == done within the last 30 days
    ///   - Recurring = recurrence_rule != nil
    static func passes(
        _ task: HomeTaskDTO,
        tab: HouseholdTasksTab,
        now: Date
    ) -> Bool {
        switch tab {
        case .active:
            return task.status == "open" || task.status == "in_progress"
        case .done:
            guard task.status == "done" else { return false }
            // 30-day rolling window from `completed_at` (falls back to
            // `updated_at` when missing — backend auto-sets
            // `completed_at` on first transition but older rows may
            // miss it).
            guard let iso = task.completedAt ?? task.updatedAt,
                  let date = parseDate(iso) else {
                return true
            }
            return now.timeIntervalSince(date) <= 30 * 24 * 60 * 60
        case .recurring:
            guard let rule = task.recurrenceRule else { return false }
            return !rule.isEmpty
        }
    }

    /// Instance-method wrapper exposing the static `passes` so the
    /// instance can read its injected clock.
    private func passes(
        _ task: HomeTaskDTO,
        tab: HouseholdTasksTab,
        now: Date
    ) -> Bool {
        HouseholdTasksListViewModel.passes(task, tab: tab, now: now)
    }

    private func counts(_ tasks: [HomeTaskDTO]) -> HouseholdTasksTabCounts {
        let nowDate = now()
        let active = tasks.filter { HouseholdTasksListViewModel.passes($0, tab: .active, now: nowDate) }.count
        let done = tasks.filter { HouseholdTasksListViewModel.passes($0, tab: .done, now: nowDate) }.count
        let recurring = tasks.filter { HouseholdTasksListViewModel.passes($0, tab: .recurring, now: nowDate) }.count
        return HouseholdTasksTabCounts(active: active, done: done, recurring: recurring)
    }

    // MARK: - Banner

    func currentBannerSummary() -> HouseholdTasksBannerSummary {
        guard let tasks else {
            return HouseholdTasksBannerSummary(dueTodayCount: 0, overdueCount: 0)
        }
        return HouseholdTasksListViewModel.summarize(tasks: tasks, now: now())
    }

    /// Pure summary projection. Public-static for tests.
    static func summarize(
        tasks: [HomeTaskDTO],
        now: Date
    ) -> HouseholdTasksBannerSummary {
        var dueToday = 0
        var overdue = 0
        let calendar = Calendar.current
        let nowDay = calendar.startOfDay(for: now)
        for task in tasks {
            // Only active rows roll up into the banner.
            guard task.status == "open" || task.status == "in_progress" else { continue }
            guard let iso = task.dueAt, let due = parseDate(iso) else { continue }
            let dueDay = calendar.startOfDay(for: due)
            let comps = calendar.dateComponents([.day], from: nowDay, to: dueDay)
            let days = comps.day ?? 0
            if days < 0 {
                overdue += 1
            } else if days == 0 {
                dueToday += 1
            }
        }
        return HouseholdTasksBannerSummary(dueTodayCount: dueToday, overdueCount: overdue)
    }

    private func bannerTitle(for summary: HouseholdTasksBannerSummary) -> String {
        if summary.dueTodayCount == 0 && summary.overdueCount > 0 {
            return summary.overdueCount == 1
                ? "1 task overdue"
                : "\(summary.overdueCount) tasks overdue"
        }
        return summary.dueTodayCount == 1
            ? "1 task due today"
            : "\(summary.dueTodayCount) tasks due today"
    }

    private func bannerSubtitle(for summary: HouseholdTasksBannerSummary) -> String? {
        if summary.overdueCount > 0 {
            return summary.overdueCount == 1
                ? "1 overdue · finish or reassign"
                : "\(summary.overdueCount) overdue · finish or reassign"
        }
        return "You're on track for the week"
    }

    // MARK: - Formatting helpers

    private static func assigneeDisplay(for assigneeId: String?) -> String? {
        guard let assigneeId, !assigneeId.isEmpty else { return nil }
        // The backend returns just an id today — no joined user
        // profile. Until a server-side join lands, surface a short
        // identifier so the row stays distinguishable. The string is
        // intentionally a fingerprint, not a name, so the UI doesn't
        // lie about who's assigned.
        let prefix = assigneeId.prefix(4).uppercased()
        return "Member \(prefix)"
    }

    /// Human-readable rendering of an RRULE-ish recurrence string. The
    /// backend stores free-form text; we surface the friendliest
    /// rendering we can derive without a full RRULE parser.
    static func humanRecurrence(rule: String?) -> String? {
        guard let raw = rule?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let lower = raw.lowercased()
        // Match common iCalendar shorthand.
        if lower.contains("freq=daily") { return "Daily" }
        if lower.contains("freq=weekly") {
            // Try to pluck the BYDAY token.
            if let byday = parseByDay(lower) { return "Weekly · \(byday)" }
            return "Weekly"
        }
        if lower.contains("freq=monthly") { return "Monthly" }
        if lower.contains("freq=yearly") { return "Yearly" }
        // Pre-formatted human strings (e.g. "Weekly · Tue") flow through
        // unchanged — useful so seed data and the v0 web client can
        // round-trip without a stricter contract.
        return raw
    }

    private static func parseByDay(_ rrule: String) -> String? {
        guard let range = rrule.range(of: "byday=") else { return nil }
        let tail = rrule[range.upperBound...]
        let token = tail.split(separator: ";", maxSplits: 1).first.map(String.init) ?? String(tail)
        // RRULE uses MO/TU/WE/TH/FR/SA/SU.
        let map: [String: String] = [
            "mo": "Mon", "tu": "Tue", "we": "Wed", "th": "Thu",
            "fr": "Fri", "sa": "Sat", "su": "Sun"
        ]
        let pieces = token
            .split(separator: ",")
            .map { String($0).trimmingCharacters(in: .whitespaces).lowercased() }
            .compactMap { map[$0] }
        return pieces.isEmpty ? nil : pieces.joined(separator: ", ")
    }

    /// "2h ago" / "yesterday" / "Mar 4" — short, relative.
    static func humanRelativeTime(iso: String?, now: Date) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let delta = now.timeIntervalSince(date)
        if delta < 60 { return "just now" }
        if delta < 3600 {
            let minutes = Int(delta / 60)
            return "\(minutes)m ago"
        }
        if delta < 24 * 3600 {
            let hours = Int(delta / 3600)
            return "\(hours)h ago"
        }
        if delta < 48 * 3600 {
            return "yesterday"
        }
        return formatDateShort(date: date)
    }

    static func formatDateShort(date: Date) -> String? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    static func formatWeekday(_ date: Date) -> String? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    static func parseDate(_ iso: String) -> Date? {
        // Accept full ISO timestamps and bare yyyy-MM-dd strings.
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFull.date(from: iso) { return d }
        let isoShort = ISO8601DateFormatter()
        isoShort.formatOptions = [.withInternetDateTime]
        if let d = isoShort.date(from: iso) { return d }
        let day = DateFormatter()
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = TimeZone(secondsFromGMT: 0)
        day.dateFormat = "yyyy-MM-dd"
        return day.date(from: iso)
    }
}
