//
//  MaintenanceListViewModel.swift
//  Pantopus
//
//  T6.3b / P10 — Per-home Maintenance list. Backs
//  `MaintenanceListView`. Wired to `GET /api/homes/:id/maintenance`
//  (route `backend/routes/home.js`, added in T6.3b).
//
//  Shell pattern mirrors Bills (T6.0a):
//   • `ListOfRowsDataSource` with 3 client-side tabs
//     (Scheduled / Completed / All) — backend supports a `?status=`
//     query param but the design's tabs cluster multiple statuses
//     into a single bucket (Scheduled = `scheduled|in_progress`), so
//     the VM owns the projection.
//   • `RowLeading.typeIcon` tinted from `MaintenanceCategory.from(task:)`.
//   • `RowTrailing.amountWithChip` with cost + lifecycle chip.
//   • Summary banner above the list — count of overdue + YTD spend.
//   • 60pt `canonicalCreate` FAB tinted `.home` (home-pillar identity).
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length function_body_length

/// Canonical chip status derived from `MaintenanceTaskDTO.status` +
/// `due_date`. Adds `overdue` (status=scheduled + due_date < now) and
/// `dueSoon` (status=scheduled + due_date within next 7 days) on top
/// of the 4 backend lifecycle values.
public enum MaintenanceChipStatus: String, Sendable, Hashable {
    case scheduled
    case dueSoon
    case overdue
    case inProgress
    case completed
    case cancelled
}

/// Tab identifiers — kept as strings so they survive the
/// `ListOfRowsDataSource.selectedTab: String` contract.
enum MaintenanceTab: String, CaseIterable {
    case scheduled
    case completed
    case all
}

private struct MaintenanceTabCounts {
    let scheduled: Int?
    let completed: Int?
    let all: Int?
}

/// Banner summary projection. Surfaced through `BannerConfig` so the
/// shared shell renders it without bespoke chrome.
public struct MaintenanceBannerSummary: Sendable, Equatable {
    /// Number of overdue tasks (status=scheduled + due_date < now).
    public let overdueCount: Int
    /// Pre-formatted YTD spend label (e.g. `"$1,420"`), or `nil` when
    /// nothing has been spent this year.
    public let ytdSpendLabel: String?
    /// Pre-formatted "X scheduled · next-up Y" subtitle when there is
    /// future work.
    public let scheduledSubtitle: String?

    public init(
        overdueCount: Int,
        ytdSpendLabel: String?,
        scheduledSubtitle: String?
    ) {
        self.overdueCount = overdueCount
        self.ytdSpendLabel = ytdSpendLabel
        self.scheduledSubtitle = scheduledSubtitle
    }

    public var hasContent: Bool {
        overdueCount > 0 || ytdSpendLabel != nil || scheduledSubtitle != nil
    }
}

/// Pure projection of one maintenance task into a row's display fields.
public struct MaintenanceRowProjection: Sendable, Equatable {
    public let title: String
    public let subtitle: String
    public let amount: String
    public let chipText: String
    public let chipVariant: StatusChipVariant
    public let chipIcon: PantopusIcon?
    public let status: MaintenanceChipStatus
    public let category: MaintenanceCategory
    public let inlineChip: RowChip?
    public let highlight: RowHighlight?
}

@Observable
@MainActor
final class MaintenanceListViewModel: ListOfRowsDataSource {
    let title = "Maintenance"

    /// Trailing top-bar action routes to the per-home **issue tracker**
    /// (`/api/homes/:id/issues`) — a different backend collection from
    /// the maintenance-task log this screen renders. RN files both under
    /// "Maintenance", so this is the least-surprising place to reach it.
    /// Nil when the host didn't wire `onOpenIssues` (previews / tests).
    var topBarAction: TopBarAction? {
        guard let onOpenIssues else { return nil }
        return TopBarAction(
            icon: .alertCircle,
            accessibilityLabel: "Home issues"
        ) { onOpenIssues() }
    }

    var tabs: [ListOfRowsTab] {
        let summary = tasks.map(counts) ?? MaintenanceTabCounts(
            scheduled: nil, completed: nil, all: nil
        )
        return [
            ListOfRowsTab(id: MaintenanceTab.scheduled.rawValue, label: "Scheduled", count: summary.scheduled),
            ListOfRowsTab(id: MaintenanceTab.completed.rawValue, label: "Completed", count: summary.completed),
            ListOfRowsTab(id: MaintenanceTab.all.rawValue, label: "All", count: summary.all)
        ]
    }

    var selectedTab: String = MaintenanceTab.scheduled.rawValue {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Log maintenance",
            variant: .canonicalCreate,
            tint: .home
        ) { [onAddTask] in onAddTask() }
    }

    /// Banner above the list. Only on the Scheduled tab when there's
    /// something to surface (overdue / scheduled / YTD spend).
    var banner: BannerConfig? {
        guard case .loaded = state, MaintenanceTab(rawValue: selectedTab) == .scheduled else {
            return nil
        }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .hammer,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Last-fetched payload so tab swaps don't refetch.
    private var tasks: [MaintenanceTaskDTO]?

    private let homeId: String
    private let api: APIClient
    private let onOpenTask: @Sendable (String) -> Void
    private let onAddTask: @Sendable () -> Void
    /// Route to the per-home issue tracker. Nil hides the top-bar action.
    private let onOpenIssues: (@Sendable () -> Void)?
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        api: APIClient = .shared,
        onOpenTask: @escaping @Sendable (String) -> Void = { _ in },
        onAddTask: @escaping @Sendable () -> Void = {},
        onOpenIssues: (@Sendable () -> Void)? = nil,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.api = api
        self.onOpenTask = onOpenTask
        self.onAddTask = onAddTask
        self.onOpenIssues = onOpenIssues
        self.now = now
    }

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {}

    func reloadAfterMutation() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: GetHomeMaintenanceResponse = try await api.request(
                HomesEndpoints.maintenance(homeId: homeId)
            )
            tasks = response.tasks
            rebuildState()
        } catch {
            tasks = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load your maintenance log."
            )
        }
    }

    private func rebuildState() {
        guard let tasks else { return }
        let nowDate = now()
        let tab = MaintenanceTab(rawValue: selectedTab) ?? .scheduled
        let filtered = tasks.filter { passes($0, tab: tab, now: nowDate) }
        if filtered.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .hammer,
                    headline: "No maintenance logged yet",
                    subcopy: "Track HVAC tune-ups, gutter cleans, filter swaps and " +
                        "inspections. Build a service history that protects warranties and resale value.",
                    ctaTitle: "Log maintenance"
                ) { [onAddTask] in onAddTask() }
            )
            return
        }
        let rows = filtered.map { row(for: $0, now: nowDate) }
        state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
    }

    // MARK: - Row + chip mapping

    func row(for task: MaintenanceTaskDTO, now: Date) -> RowModel {
        let projection = MaintenanceListViewModel.project(task: task, now: now)
        let taskId = task.id
        let category = projection.category
        return RowModel(
            id: task.id,
            title: projection.title,
            subtitle: projection.subtitle,
            template: .statusChip,
            leading: .typeIcon(
                category.icon,
                background: category.background,
                foreground: category.foreground
            ),
            trailing: .amountWithChip(
                amount: projection.amount,
                chipText: projection.chipText,
                chipVariant: projection.chipVariant,
                chipIcon: projection.chipIcon
            ),
            onTap: { [onOpenTask] in onOpenTask(taskId) },
            inlineChip: projection.inlineChip,
            highlight: projection.highlight
        )
    }

    /// Pure projection — exposed `static` so tests can exercise the
    /// derivation without standing the VM up.
    static func project(task: MaintenanceTaskDTO, now: Date) -> MaintenanceRowProjection {
        let chip = chipStatus(for: task, now: now)
        let category = MaintenanceCategory.from(task: task.task)
        let title = task.task.isEmpty ? category.label : task.task
        let amount = formatCost(task.cost)
        let dueShort = formatDateShort(iso: task.dueDate)
        let recurrenceLabel = recurrenceLabel(for: task.recurrence)
        let vendorLine = vendorSubtitle(vendor: task.vendor, recurrence: recurrenceLabel)

        switch chip {
        case .completed:
            return MaintenanceRowProjection(
                title: title,
                subtitle: vendorLine,
                amount: amount,
                chipText: "Completed",
                chipVariant: .success,
                chipIcon: .check,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: nil
            )
        case .cancelled:
            return MaintenanceRowProjection(
                title: title,
                subtitle: vendorLine,
                amount: amount,
                chipText: "Cancelled",
                chipVariant: .neutral,
                chipIcon: .x,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: .muted
            )
        case .overdue:
            return MaintenanceRowProjection(
                title: title,
                subtitle: vendorLine,
                amount: amount,
                chipText: "Overdue",
                chipVariant: .error,
                chipIcon: .alertCircle,
                status: chip,
                category: category,
                inlineChip: dueShort.map { RowChip(text: "Was due \($0)", icon: .clock, tint: .status(.error)) },
                highlight: nil
            )
        case .dueSoon:
            return MaintenanceRowProjection(
                title: title,
                subtitle: vendorLine,
                amount: amount,
                chipText: "Due soon",
                chipVariant: .warning,
                chipIcon: .clock,
                status: chip,
                category: category,
                inlineChip: dueShort.map { RowChip(text: $0, icon: .calendar, tint: .status(.warning)) },
                highlight: nil
            )
        case .inProgress:
            return MaintenanceRowProjection(
                title: title,
                subtitle: vendorLine,
                amount: amount,
                chipText: "In progress",
                chipVariant: .info,
                chipIcon: .hammer,
                status: chip,
                category: category,
                inlineChip: nil,
                highlight: nil
            )
        case .scheduled:
            return MaintenanceRowProjection(
                title: title,
                subtitle: vendorLine,
                amount: amount,
                chipText: "Scheduled",
                chipVariant: .info,
                chipIcon: .calendar,
                status: chip,
                category: category,
                inlineChip: dueShort.map { RowChip(text: $0, icon: .calendar, tint: .status(.info)) },
                highlight: nil
            )
        }
    }

    /// Chip-status projection:
    ///   - `cancelled`   when status is "cancelled"
    ///   - `completed`   when status is "completed"
    ///   - `inProgress`  when status is "in_progress"
    ///   - `overdue`     when status is "scheduled" + due_date < now
    ///   - `dueSoon`     when status is "scheduled" + due_date within 7d
    ///   - `scheduled`   otherwise (status="scheduled")
    static func chipStatus(for task: MaintenanceTaskDTO, now: Date) -> MaintenanceChipStatus {
        if task.status == "cancelled" { return .cancelled }
        if task.status == "completed" { return .completed }
        if task.status == "in_progress" { return .inProgress }
        if let iso = task.dueDate, let due = parseDate(iso) {
            if due < now { return .overdue }
            let sevenDaysOut = now.addingTimeInterval(7 * 24 * 60 * 60)
            if due <= sevenDaysOut { return .dueSoon }
        }
        return .scheduled
    }

    private func passes(_ task: MaintenanceTaskDTO, tab: MaintenanceTab, now: Date) -> Bool {
        let chip = MaintenanceListViewModel.chipStatus(for: task, now: now)
        switch tab {
        case .scheduled:
            // "Scheduled" bucket = anything not yet completed/cancelled.
            return chip != .completed && chip != .cancelled
        case .completed:
            return chip == .completed
        case .all:
            return chip != .cancelled
        }
    }

    private func counts(_ tasks: [MaintenanceTaskDTO]) -> MaintenanceTabCounts {
        let nowDate = now()
        var scheduled = 0
        var completed = 0
        var all = 0
        for t in tasks {
            let chip = MaintenanceListViewModel.chipStatus(for: t, now: nowDate)
            if chip == .cancelled { continue }
            all += 1
            if chip == .completed {
                completed += 1
            } else {
                scheduled += 1
            }
        }
        return MaintenanceTabCounts(scheduled: scheduled, completed: completed, all: all)
    }

    // MARK: - Banner

    func currentBannerSummary() -> MaintenanceBannerSummary {
        guard let tasks else {
            return MaintenanceBannerSummary(overdueCount: 0, ytdSpendLabel: nil, scheduledSubtitle: nil)
        }
        return MaintenanceListViewModel.summarize(tasks: tasks, now: now())
    }

    static func summarize(tasks: [MaintenanceTaskDTO], now: Date) -> MaintenanceBannerSummary {
        let calendar = Calendar(identifier: .gregorian)
        let yearStart = calendar.date(
            from: calendar.dateComponents([.year], from: now)
        ) ?? now
        var overdueCount = 0
        var scheduledCount = 0
        var ytdSpend: Decimal = 0
        var nextDue: (Date, MaintenanceTaskDTO)?
        for task in tasks {
            let chip = chipStatus(for: task, now: now)
            switch chip {
            case .overdue:
                overdueCount += 1
                scheduledCount += 1
                nextDue = earlierDueTask(nextDue, task: task, now: now, allowPast: true)
            case .scheduled, .dueSoon, .inProgress:
                scheduledCount += 1
                nextDue = earlierDueTask(nextDue, task: task, now: now)
            case .completed:
                if let cost = ytdCost(for: task, yearStart: yearStart) {
                    ytdSpend += cost
                }
            case .cancelled:
                continue
            }
        }
        let ytdLabel = ytdSpend > 0 ? formatCurrency(ytdSpend) : nil
        let scheduledSubtitle = scheduledSubtitle(
            scheduledCount: scheduledCount,
            nextDue: nextDue,
            now: now
        )
        return MaintenanceBannerSummary(
            overdueCount: overdueCount,
            ytdSpendLabel: ytdLabel,
            scheduledSubtitle: scheduledSubtitle
        )
    }

    private static func earlierDueTask(
        _ current: (Date, MaintenanceTaskDTO)?,
        task: MaintenanceTaskDTO,
        now: Date,
        allowPast: Bool = false
    ) -> (Date, MaintenanceTaskDTO)? {
        guard let iso = task.dueDate, let due = parseDate(iso) else { return current }
        guard allowPast || due >= now else { return current }
        guard let current else { return (due, task) }
        return due < current.0 ? (due, task) : current
    }

    private static func ytdCost(for task: MaintenanceTaskDTO, yearStart: Date) -> Decimal? {
        guard let cost = task.cost,
              let performedAt = parseDate(task.updatedAt ?? task.createdAt ?? ""),
              performedAt >= yearStart else {
            return nil
        }
        return cost
    }

    private static func scheduledSubtitle(
        scheduledCount: Int,
        nextDue: (Date, MaintenanceTaskDTO)?,
        now: Date
    ) -> String? {
        if scheduledCount == 0 {
            return nil
        }
        if let nextDue {
            let title = nextDue.1.task.isEmpty ? "next task" : nextDue.1.task
            let days = Int(nextDue.0.timeIntervalSince(now) / (24 * 60 * 60))
            let when = if days < 0 {
                "overdue"
            } else if days == 0 {
                "today"
            } else if days == 1 {
                "tomorrow"
            } else {
                "in \(days) days"
            }
            let prefix = scheduledCount == 1 ? "1 scheduled" : "\(scheduledCount) scheduled"
            return "\(prefix) · \(title) \(when)"
        }
        return scheduledCount == 1 ? "1 scheduled" : "\(scheduledCount) scheduled"
    }

    private func bannerTitle(for summary: MaintenanceBannerSummary) -> String {
        summary.scheduledSubtitle ?? "Maintenance"
    }

    private func bannerSubtitle(for summary: MaintenanceBannerSummary) -> String? {
        if summary.overdueCount > 0 {
            let label = summary.overdueCount == 1 ? "1 overdue" : "\(summary.overdueCount) overdue"
            if let ytd = summary.ytdSpendLabel {
                return "\(label) · \(ytd) spent YTD"
            }
            return label
        }
        if let ytd = summary.ytdSpendLabel {
            return "\(ytd) spent YTD · all current"
        }
        return "All current"
    }

    // MARK: - Formatting helpers

    private static func formatCost(_ cost: Decimal?) -> String {
        guard let cost else { return "—" }
        if cost == 0 { return "DIY" }
        return formatCurrency(cost)
    }

    static func formatCurrency(_ amount: Decimal) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        return formatter.string(from: amount as NSDecimalNumber) ?? "$\(amount)"
    }

    static func formatDateShort(iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    static func parseDate(_ iso: String) -> Date? {
        if iso.isEmpty { return nil }
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

    private static func recurrenceLabel(for recurrence: String) -> String? {
        switch recurrence {
        case "one_time": nil
        case "weekly": "Weekly"
        case "monthly": "Monthly"
        case "quarterly": "Quarterly"
        case "yearly": "Yearly"
        default: nil
        }
    }

    private static func vendorSubtitle(vendor: String?, recurrence: String?) -> String {
        let vendorPart: String = if let vendor, !vendor.isEmpty {
            vendor
        } else {
            "Self-managed"
        }
        if let recurrence {
            return "\(vendorPart) · \(recurrence)"
        }
        return vendorPart
    }
}
