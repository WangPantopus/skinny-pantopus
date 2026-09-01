//
//  HomeIssuesListViewModel.swift
//  Pantopus
//
//  Per-home **issue tracker** (the `HomeIssue` collection). This is the
//  native counterpart of RN's `src/app/homes/[id]/maintenance.tsx`, which
//  despite its filename lists issues — not maintenance tasks. It is a
//  DIFFERENT backend collection from `MaintenanceListViewModel`
//  (`/api/homes/:id/maintenance`), and both surfaces ship side by side.
//
//  Routes:
//    • `GET  /api/homes/:id/issues`            — backend/routes/home.js:4386
//    • `POST /api/homes/:id/issues`            — backend/routes/home.js:4420
//    • `PUT  /api/homes/:id/issues/:issueId`   — backend/routes/home.js:4462
//
//  Tabs mirror RN's buckets exactly:
//    Open      → status `suggested` | `open`
//    Scheduled → status `scheduled` | `in_progress`
//    History   → status `completed` | `dismissed`
//

// swiftlint:disable type_body_length

import Foundation
import Observation
import SwiftUI

/// Tab identifiers — strings so they satisfy the
/// `ListOfRowsDataSource.selectedTab: String` contract.
enum HomeIssuesTab: String, CaseIterable {
    case open
    case scheduled
    case history
}

/// Canonical chip status derived from `HomeIssueDTO.status`.
public enum HomeIssueChipStatus: String, Sendable, Hashable {
    case open
    case scheduled
    case inProgress
    case completed
    case dismissed
    case unknown
}

/// One-shot events the view reacts to (sheet / confirm presentation).
public enum HomeIssuesEvent: Sendable, Equatable {
    case openReport
    case confirmDismiss(issueId: String, title: String)
}

/// Pure projection of one issue into a row's display fields. Exposed so
/// tests can exercise the derivation without standing the VM up.
public struct HomeIssueRowProjection: Sendable, Equatable {
    public let title: String
    public let subtitle: String?
    public let chipText: String
    public let chipVariant: StatusChipVariant
    public let chipIcon: PantopusIcon?
    public let status: HomeIssueChipStatus
}

@Observable
@MainActor
final class HomeIssuesListViewModel: ListOfRowsDataSource {
    let title = "Issues"

    var topBarAction: TopBarAction? {
        nil
    }

    var tabs: [ListOfRowsTab] {
        [
            ListOfRowsTab(id: HomeIssuesTab.open.rawValue, label: "Open", count: count(for: .open)),
            ListOfRowsTab(id: HomeIssuesTab.scheduled.rawValue, label: "Scheduled", count: count(for: .scheduled)),
            ListOfRowsTab(id: HomeIssuesTab.history.rawValue, label: "History", count: count(for: .history))
        ]
    }

    var selectedTab: String = HomeIssuesTab.open.rawValue {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Report issue",
            variant: .canonicalCreate,
            tint: .home
        ) { [weak self] in
            Task { @MainActor in self?.pendingEvent = .openReport }
        }
    }

    var banner: BannerConfig? {
        guard case .loaded = state,
              HomeIssuesTab(rawValue: selectedTab) == .open,
              let openCount = count(for: .open), openCount > 0
        else {
            return nil
        }
        return BannerConfig(
            icon: .wrench,
            title: openCount == 1 ? "1 open issue" : "\(openCount) open issues",
            subtitle: "Schedule the fix or mark it done once it's handled.",
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// One-shot navigation/presentation signal consumed by the view.
    var pendingEvent: HomeIssuesEvent?

    /// Inline error shown as a toast after a failed mutation.
    var toast: ToastMessage?

    /// Last-fetched payload so tab swaps don't refetch.
    private var issues: [HomeIssueDTO]?

    private let homeId: String
    private let api: APIClient

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    // MARK: - Load

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {} // `/issues` is not paginated.

    private func fetch() async {
        do {
            let response: HomeIssuesResponse = try await api.request(
                HomeIssuesEndpoints.list(homeId: homeId)
            )
            issues = response.issues
            rebuildState()
        } catch {
            issues = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load this home's issues."
            )
        }
    }

    // MARK: - Mutations

    /// Creates an issue. Mirrors RN `maintenance.tsx:53` — title required,
    /// description optional — then refetches so the list is server-truth.
    func createIssue(title: String, description: String?) async -> Bool {
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedTitle.isEmpty else { return false }
        let trimmedDescription = description?.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            _ = try await api.request(
                HomeIssuesEndpoints.create(
                    homeId: homeId,
                    request: CreateHomeIssueRequest(
                        title: trimmedTitle,
                        description: (trimmedDescription?.isEmpty ?? true) ? nil : trimmedDescription
                    )
                )
            ) as HomeIssueResponse
            await fetch()
            return true
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Failed to create issue",
                kind: .error
            )
            return false
        }
    }

    /// Status transition — RN `maintenance.tsx:65` (`updateStatus`).
    func updateStatus(issueId: String, status: String) async {
        do {
            _ = try await api.request(
                HomeIssuesEndpoints.update(
                    homeId: homeId,
                    issueId: issueId,
                    request: .status(status)
                )
            ) as HomeIssueResponse
            await fetch()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Failed to update issue",
                kind: .error
            )
        }
    }

    /// Dismiss — RN `maintenance.tsx:75` sends `status: 'dismissed'` after
    /// a destructive confirm.
    func dismissIssue(issueId: String) async {
        do {
            _ = try await api.request(
                HomeIssuesEndpoints.update(
                    homeId: homeId,
                    issueId: issueId,
                    request: .status("dismissed")
                )
            ) as HomeIssueResponse
            await fetch()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Failed to dismiss issue",
                kind: .error
            )
        }
    }

    // MARK: - Projection

    private func rebuildState() {
        guard let issues else { return }
        let tab = HomeIssuesTab(rawValue: selectedTab) ?? .open
        let filtered = issues.filter { bucket(for: $0) == tab }
        if filtered.isEmpty {
            state = .empty(emptyContent(for: tab))
            return
        }
        state = .loaded(sections: [RowSection(rows: filtered.map(row(for:)))], hasMore: false)
    }

    private func emptyContent(for tab: HomeIssuesTab) -> ListOfRowsState.EmptyContent {
        switch tab {
        case .open:
            ListOfRowsState.EmptyContent(
                icon: .wrench,
                headline: "No open issues",
                subcopy: "Report a leak, a broken appliance, or anything else that needs " +
                    "fixing. Everyone in the household sees it and can track the fix.",
                ctaTitle: "Report issue"
            ) { [weak self] in
                Task { @MainActor in self?.pendingEvent = .openReport }
            }
        case .scheduled:
            ListOfRowsState.EmptyContent(
                icon: .calendar,
                headline: "Nothing scheduled",
                subcopy: "Issues you schedule for a fix show up here until they're completed.",
                ctaTitle: "Report issue"
            ) { [weak self] in
                Task { @MainActor in self?.pendingEvent = .openReport }
            }
        case .history:
            ListOfRowsState.EmptyContent(
                icon: .checkCircle,
                headline: "No history",
                subcopy: "Completed and dismissed issues are archived here.",
                ctaTitle: "Report issue"
            ) { [weak self] in
                Task { @MainActor in self?.pendingEvent = .openReport }
            }
        }
    }

    private func row(for issue: HomeIssueDTO) -> RowModel {
        let projection = HomeIssuesListViewModel.project(issue: issue)
        let issueId = issue.id
        let issueTitle = issue.title
        return RowModel(
            id: issue.id,
            title: projection.title,
            subtitle: projection.subtitle,
            template: .statusChip,
            leading: .typeIcon(
                icon(for: projection.status),
                background: background(for: projection.status),
                foreground: foreground(for: projection.status)
            ),
            trailing: .statusChip(text: projection.chipText, variant: projection.chipVariant),
            onTap: {},
            body: nil,
            timeMeta: HomeIssuesListViewModel.formatDateShort(iso: issue.updatedAt ?? issue.createdAt),
            footer: footer(for: issue, status: projection.status, title: issueTitle, issueId: issueId)
        )
    }

    private func footer(
        for _: HomeIssueDTO,
        status: HomeIssueChipStatus,
        title: String,
        issueId: String
    ) -> RowFooter? {
        var actions: [RowFooterAction] = []
        switch status {
        case .open:
            actions.append(
                RowFooterAction(
                    title: "Schedule",
                    icon: .calendar,
                    variant: .primary,
                    identifier: "homeIssues.row_\(issueId).schedule"
                ) { [weak self] in
                    Task { @MainActor in await self?.updateStatus(issueId: issueId, status: "scheduled") }
                }
            )
        case .scheduled, .inProgress:
            actions.append(
                RowFooterAction(
                    title: "Mark complete",
                    icon: .checkCircle,
                    variant: .primary,
                    identifier: "homeIssues.row_\(issueId).complete"
                ) { [weak self] in
                    Task { @MainActor in await self?.updateStatus(issueId: issueId, status: "completed") }
                }
            )
        case .completed, .dismissed, .unknown:
            break
        }
        if status != .completed, status != .dismissed {
            actions.append(
                RowFooterAction(
                    title: "Dismiss",
                    icon: .trash2,
                    variant: .destructive,
                    identifier: "homeIssues.row_\(issueId).dismiss"
                ) { [weak self] in
                    Task { @MainActor in
                        self?.pendingEvent = .confirmDismiss(issueId: issueId, title: title)
                    }
                }
            )
        }
        return actions.isEmpty ? nil : RowFooter(actions: actions)
    }

    /// Pure projection — `static` so tests can assert the derivation.
    static func project(issue: HomeIssueDTO) -> HomeIssueRowProjection {
        let status = chipStatus(for: issue)
        let detail = issue.description?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfBlank
        let severity = issue.severity?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .nilIfBlank
        let subtitle: String? = detail ?? severity.map { "\($0.capitalized) severity" }
        switch status {
        case .open:
            return HomeIssueRowProjection(
                title: issue.title,
                subtitle: subtitle,
                chipText: "Open",
                chipVariant: .warning,
                chipIcon: .alertCircle,
                status: status
            )
        case .scheduled:
            return HomeIssueRowProjection(
                title: issue.title,
                subtitle: subtitle,
                chipText: "Scheduled",
                chipVariant: .info,
                chipIcon: .calendar,
                status: status
            )
        case .inProgress:
            return HomeIssueRowProjection(
                title: issue.title,
                subtitle: subtitle,
                chipText: "In progress",
                chipVariant: .business,
                chipIcon: .wrench,
                status: status
            )
        case .completed:
            return HomeIssueRowProjection(
                title: issue.title,
                subtitle: subtitle,
                chipText: "Completed",
                chipVariant: .success,
                chipIcon: .checkCircle,
                status: status
            )
        case .dismissed:
            return HomeIssueRowProjection(
                title: issue.title,
                subtitle: subtitle,
                chipText: "Dismissed",
                chipVariant: .neutral,
                chipIcon: .xCircle,
                status: status
            )
        case .unknown:
            return HomeIssueRowProjection(
                title: issue.title,
                subtitle: subtitle,
                chipText: (issue.status ?? "Unknown").capitalized,
                chipVariant: .neutral,
                chipIcon: nil,
                status: status
            )
        }
    }

    /// RN buckets `suggested` alongside `open` (`maintenance.tsx:36`),
    /// so both map onto the same canonical `.open` chip status.
    static func chipStatus(for issue: HomeIssueDTO) -> HomeIssueChipStatus {
        switch issue.status ?? "open" {
        case "suggested", "open": .open
        case "scheduled": .scheduled
        case "in_progress": .inProgress
        case "completed", "resolved": .completed
        case "dismissed": .dismissed
        default: .unknown
        }
    }

    private func bucket(for issue: HomeIssueDTO) -> HomeIssuesTab? {
        switch HomeIssuesListViewModel.chipStatus(for: issue) {
        case .open:
            .open
        case .scheduled, .inProgress:
            .scheduled
        case .completed, .dismissed:
            .history
        case .unknown:
            nil
        }
    }

    private func count(for tab: HomeIssuesTab) -> Int? {
        guard let issues else { return nil }
        return issues.filter { bucket(for: $0) == tab }.count
    }

    // MARK: - Presentation helpers

    private func icon(for status: HomeIssueChipStatus) -> PantopusIcon {
        switch status {
        case .open: .alertCircle
        case .scheduled: .calendar
        case .inProgress: .wrench
        case .completed: .checkCircle
        case .dismissed: .xCircle
        case .unknown: .wrench
        }
    }

    private func background(for status: HomeIssueChipStatus) -> Color {
        switch status {
        case .open: Theme.Color.warningBg
        case .scheduled: Theme.Color.primary50
        case .inProgress: Theme.Color.businessBg
        case .completed: Theme.Color.successBg
        case .dismissed, .unknown: Theme.Color.appSurfaceSunken
        }
    }

    private func foreground(for status: HomeIssueChipStatus) -> Color {
        switch status {
        case .open: Theme.Color.warning
        case .scheduled: Theme.Color.primary600
        case .inProgress: Theme.Color.business
        case .completed: Theme.Color.success
        case .dismissed, .unknown: Theme.Color.appTextSecondary
        }
    }

    static func formatDateShort(iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoShort = ISO8601DateFormatter()
        isoShort.formatOptions = [.withInternetDateTime]
        let parsed = isoFull.date(from: iso) ?? isoShort.date(from: iso)
        guard let parsed else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: parsed)
    }
}

private extension String {
    /// `nil` when the string is empty; otherwise the string.
    var nilIfBlank: String? {
        isEmpty ? nil : self
    }
}
