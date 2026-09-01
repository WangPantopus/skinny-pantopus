//
//  PollsListViewModel.swift
//  Pantopus
//
//  Backs `PollsListView` (T6.3e / P13). Fetches `GET /api/homes/:id/polls`
//  (route `backend/routes/home.js:6984`) and maps each row to a
//  poll-kind-tinted `RowLeading.typeIcon` + `RowTrailing.chevron` with a
//  "Leading: <option>" chip on active polls.
//
//  Tab filtering is client-side per the design contract:
//    - Active = `status == "open"` AND (`closes_at` is null OR in the future)
//    - Closed = `status == "closed" / "canceled"` OR `closes_at` is in the past
//
//  Polls with `status == "open"` whose `closes_at` is within the next 24 h
//  carry a `closing` chip (warning tint). The "Closes Sat" / "Closes in
//  9 hr" meta is rendered as the row's chip-row trailing meta.
//

import Foundation
import Observation
import SwiftUI

// swiftlint:disable file_length type_body_length

/// Canonical poll-row status chip.
public enum PollChipStatus: String, Sendable, Hashable {
    case active
    case closing
    case closed
}

/// Tab identifiers for the Polls shell.
enum PollsTab: String, CaseIterable {
    case active
    case closed
}

/// One-shot event the view turns into a confirm sheet. The VM never
/// presents UI itself — same contract as `MyHomesListEvent`.
enum PollsListEvent: Equatable {
    /// "Close" tapped on an active poll card.
    case confirmClose(pollId: String, title: String)
    /// "Delete" tapped on an active poll card.
    case confirmDelete(pollId: String, title: String)
}

private struct PollsTabCounts {
    let active: Int?
    let closed: Int?
}

/// Banner data for the Polls summary banner. Pure projection from the
/// loaded polls + clock + viewer id.
public struct PollsBannerSummary: Sendable, Equatable {
    /// Number of active polls the viewer hasn't voted on yet.
    public let awaitingViewerVote: Int
    /// Total active polls in this household.
    public let totalActive: Int

    public init(awaitingViewerVote: Int, totalActive: Int) {
        self.awaitingViewerVote = awaitingViewerVote
        self.totalActive = totalActive
    }

    /// Whether the banner has anything to render. We hide it when no
    /// polls are active.
    public var hasContent: Bool {
        totalActive > 0
    }
}

/// Pure projection of one poll into a row's display fields. Public so
/// unit tests can exercise the chip / subtitle / leading-option mapping
/// without standing the VM up.
public struct PollRowProjection: Sendable, Equatable {
    public let title: String
    public let subtitle: String
    public let kind: PollKind
    public let chipStatus: PollChipStatus
    public let chipText: String
    public let chipVariant: StatusChipVariant
    public let chipIcon: PantopusIcon?
    /// Optional "Voted: <opt>" inline chip rendered after the status
    /// chip. Set when the viewer has cast a vote.
    public let votedChip: RowChip?
    /// Optional "Leading: <opt> · N" or "Winner: <opt>" chip rendered in
    /// the row's chip strip. `nil` when nobody has voted yet OR the
    /// backend didn't surface `option_counts`.
    public let leadingChip: RowChip?
    /// Right-edge meta showing "Closes Sat" / "Closed Oct 19".
    public let timeMeta: String?
}

/// ViewModel for the Polls list. Builds `RowModel`s from `PollDTO`s and
/// derives the chip status (active / closing / closed) client-side from
/// `status` + `closes_at` + clock.
@Observable
@MainActor
final class PollsListViewModel: ListOfRowsDataSource {
    let title = "Polls"
    /// No top-bar action in T6.3e — the design's filter glyph isn't
    /// wired to a real filter sheet yet, and the 2 tabs cover the
    /// filter intent. The FAB owns the canonical "Start a poll" action.
    var topBarAction: TopBarAction? {
        nil
    }

    /// Tabs with live counts. Rebuilt whenever `polls` changes.
    var tabs: [ListOfRowsTab] {
        let summary = polls.map(counts) ?? PollsTabCounts(active: nil, closed: nil)
        return [
            ListOfRowsTab(id: PollsTab.active.rawValue, label: "Active", count: summary.active),
            ListOfRowsTab(id: PollsTab.closed.rawValue, label: "Closed", count: summary.closed)
        ]
    }

    var selectedTab: String = PollsTab.active.rawValue {
        didSet { rebuildState() }
    }

    var fab: FABAction? {
        FABAction(
            icon: .plus,
            accessibilityLabel: "Start a poll",
            variant: .secondaryCreate,
            tint: .home
        ) { [onStartPoll] in onStartPoll() }
    }

    /// Optional summary banner above the rows. Hidden on the Closed tab
    /// and when nothing is active.
    var banner: BannerConfig? {
        guard case .loaded = state, PollsTab(rawValue: selectedTab) == .active else {
            return nil
        }
        let summary = currentBannerSummary()
        guard summary.hasContent else { return nil }
        return BannerConfig(
            icon: .checkCircle,
            title: bannerTitle(for: summary),
            subtitle: bannerSubtitle(for: summary),
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Set when a card's Close / Delete footer button fires. The view
    /// drains it into a `confirmationDialog` and clears it.
    var pendingEvent: PollsListEvent?

    /// Surfaced by the view as an alert when a close / delete fails.
    var actionError: String?

    /// Poll id whose mutation is in flight — the footer buttons for that
    /// row stay rendered but the VM ignores repeat taps.
    private var mutatingPollId: String?

    private var polls: [PollDTO]?

    private let homeId: String
    private let viewerId: String?
    private let api: APIClient
    private let onOpenPoll: @Sendable (String) -> Void
    private let onStartPoll: @Sendable () -> Void
    /// Inject a stable "now" for tests; production uses `Date()`.
    private let now: @Sendable () -> Date

    init(
        homeId: String,
        viewerId: String? = nil,
        api: APIClient = .shared,
        onOpenPoll: @escaping @Sendable (String) -> Void = { _ in },
        onStartPoll: @escaping @Sendable () -> Void = {},
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.homeId = homeId
        self.viewerId = viewerId
        self.api = api
        self.onOpenPoll = onOpenPoll
        self.onStartPoll = onStartPoll
        self.now = now
    }

    func load() async {
        if case .loading = state {} else { state = .loading }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    /// Backend has no pagination on polls today.
    func loadMoreIfNeeded() async {}

    /// Re-issue the load after a successful create / vote — the detail
    /// view calls this on dismissal.
    func reloadAfterMutation() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: GetHomePollsResponse = try await api.request(
                HomesEndpoints.listPolls(homeId: homeId)
            )
            polls = response.polls
            rebuildState()
        } catch {
            polls = nil
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load polls for this home."
            )
        }
    }

    // MARK: - Close / delete

    /// "Close" tapped — hand the confirm to the view. RN raises the same
    /// prompt from the active poll card (`src/app/homes/[id]/polls.tsx:75-83`).
    func requestClose(pollId: String) {
        guard let poll = polls?.first(where: { $0.id == pollId }) else { return }
        pendingEvent = .confirmClose(pollId: pollId, title: poll.title)
    }

    /// "Delete" tapped — hand the confirm to the view
    /// (`src/app/homes/[id]/polls.tsx:85-93`).
    func requestDelete(pollId: String) {
        guard let poll = polls?.first(where: { $0.id == pollId }) else { return }
        pendingEvent = .confirmDelete(pollId: pollId, title: poll.title)
    }

    /// Close a poll to further votes — `PUT /api/homes/:id/polls/:pollId`
    /// with `status: "closed"` (route `backend/routes/home.js:7381`,
    /// `updatePollSchema` accepts `open / closed / canceled`).
    func closePoll(pollId: String) async {
        await mutate(pollId: pollId, status: "closed", failureCopy: "Couldn't close that poll. Try again.")
    }

    /// Retire a poll — same route with `status: "canceled"`, the schema's
    /// removal value. The backend exposes no DELETE for polls, so this is
    /// the strongest retire the API offers; a canceled poll drops out of
    /// the Active tab exactly like a closed one.
    func deletePoll(pollId: String) async {
        await mutate(pollId: pollId, status: "canceled", failureCopy: "Couldn't delete that poll. Try again.")
    }

    private func mutate(pollId: String, status: String, failureCopy: String) async {
        guard mutatingPollId == nil else { return }
        mutatingPollId = pollId
        defer { mutatingPollId = nil }
        do {
            let _: EmptyResponse = try await api.request(
                HomesEndpoints.updatePoll(
                    homeId: homeId,
                    pollId: pollId,
                    request: UpdatePollRequest(status: status)
                )
            )
            // RN re-fetches after the mutation rather than patching
            // locally, so the vote counts stay server-authoritative.
            await fetch()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? failureCopy
        }
    }

    private func rebuildState() {
        guard let polls else { return }
        let nowDate = now()
        let tab = PollsTab(rawValue: selectedTab) ?? .active
        let filtered = polls.filter { passes($0, tab: tab, now: nowDate) }
        if filtered.isEmpty {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .checkCircle,
                    headline: emptyHeadline(for: tab),
                    subcopy: emptySubcopy(for: tab),
                    ctaTitle: tab == .active ? "Start a poll" : nil
                ) { [onStartPoll] in
                    if tab == .active { onStartPoll() }
                }
            )
            return
        }
        let rows = filtered.map { row(for: $0, now: nowDate) }
        state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
    }

    // MARK: - Row + chip mapping

    func row(for poll: PollDTO, now: Date) -> RowModel {
        let projection = PollsListViewModel.project(poll: poll, now: now)
        let pollId = poll.id
        var chips: [RowChip] = [
            RowChip(text: projection.chipText, icon: projection.chipIcon, tint: .status(projection.chipVariant))
        ]
        if let leading = projection.leadingChip {
            chips.append(leading)
        }
        if let voted = projection.votedChip {
            chips.append(voted)
        }
        return RowModel(
            id: poll.id,
            title: projection.title,
            subtitle: projection.subtitle,
            template: .fileChevron,
            leading: .typeIcon(
                projection.kind.icon,
                background: projection.kind.background,
                foreground: projection.kind.foreground
            ),
            trailing: .chevron,
            onTap: { [onOpenPoll] in onOpenPoll(pollId) },
            chips: chips,
            timeMeta: projection.timeMeta,
            highlight: projection.chipStatus == .closed ? .muted : nil,
            footer: footer(for: projection, pollId: pollId)
        )
    }

    /// RN renders a Close + Delete action strip under every **active**
    /// poll card (`src/app/homes/[id]/polls.tsx:198-209`); closed polls
    /// carry no actions. Rendered here as the shell's `RowFooter`.
    private func footer(for projection: PollRowProjection, pollId: String) -> RowFooter? {
        guard projection.chipStatus != .closed else { return nil }
        return RowFooter(actions: [
            RowFooterAction(
                title: "Close",
                icon: .lock,
                variant: .ghost,
                identifier: "polls.row_\(pollId).close"
            ) { [weak self] in
                Task { @MainActor [weak self] in self?.requestClose(pollId: pollId) }
            },
            RowFooterAction(
                title: "Delete",
                icon: .trash,
                variant: .destructive,
                identifier: "polls.row_\(pollId).delete"
            ) { [weak self] in
                Task { @MainActor [weak self] in self?.requestDelete(pollId: pollId) }
            }
        ])
    }

    /// Pure mapping from a poll + clock to display strings. Exposed
    /// `static` so unit tests can exercise the chip / subtitle / leading
    /// derivation without standing the VM up.
    static func project(poll: PollDTO, now: Date) -> PollRowProjection {
        let kind = PollKind.from(pollType: poll.pollType, title: poll.title)
        let chipStatus = chipStatus(for: poll, now: now)
        let voteWord = poll.voteCount == 1 ? "vote" : "votes"
        let subtitleParts: [String] = {
            var parts = ["\(poll.voteCount) \(voteWord)"]
            parts.append("\(poll.options.count) options")
            return parts
        }()
        let subtitle = subtitleParts.joined(separator: " · ")
        let timeMeta = timeMetaText(for: poll, status: chipStatus, now: now)
        let chipText: String
        let chipVariant: StatusChipVariant
        let chipIcon: PantopusIcon?
        switch chipStatus {
        case .active:
            chipText = "Active"
            chipVariant = .success
            chipIcon = .circle
        case .closing:
            chipText = "Closes soon"
            chipVariant = .warning
            chipIcon = .clock
        case .closed:
            chipText = "Closed"
            chipVariant = .neutral
            chipIcon = .lock
        }
        let votedChip = votedChip(for: poll)
        let leadingChip = leadingChip(for: poll, status: chipStatus)
        return PollRowProjection(
            title: poll.title,
            subtitle: subtitle,
            kind: kind,
            chipStatus: chipStatus,
            chipText: chipText,
            chipVariant: chipVariant,
            chipIcon: chipIcon,
            votedChip: votedChip,
            leadingChip: leadingChip,
            timeMeta: timeMeta
        )
    }

    /// Derive the chip status per the T6.3e contract:
    ///   - `closed`   when status is "closed" / "canceled" OR closes_at is past
    ///   - `closing`  when active AND closes_at is within next 24 h
    ///   - `active`   otherwise
    static func chipStatus(for poll: PollDTO, now: Date) -> PollChipStatus {
        let normalised = poll.status.lowercased()
        if normalised == "closed" || normalised == "canceled" || normalised == "cancelled" {
            return .closed
        }
        if let iso = poll.closesAt, let closesAt = parseDate(iso) {
            if closesAt < now { return .closed }
            let dayOut = now.addingTimeInterval(24 * 60 * 60)
            if closesAt <= dayOut { return .closing }
        }
        return .active
    }

    private static func votedChip(for poll: PollDTO) -> RowChip? {
        guard let votes = poll.myVote, let firstKey = votes.first else { return nil }
        let label = poll.options.first { $0.id == firstKey }?.label ?? firstKey
        return RowChip(
            text: "Voted: \(label)",
            icon: .check,
            tint: .status(.info)
        )
    }

    private static func leadingChip(for poll: PollDTO, status: PollChipStatus) -> RowChip? {
        guard let leading = leadingOption(for: poll) else { return nil }
        let voteWord = leading.votes == 1 ? "vote" : "votes"
        let prefix = status == .closed ? "Winner" : "Leading"
        return RowChip(
            text: "\(prefix): \(leading.label) · \(leading.votes) \(voteWord)",
            icon: status == .closed ? .badgeCheck : nil,
            tint: status == .closed
                ? .status(.success)
                : .custom(
                    background: PollLeadingChipTint.background,
                    foreground: PollLeadingChipTint.foreground
                )
        )
    }

    /// Find the (label, count) with the most votes. Falls back to the
    /// first option when there's a tie at zero — but only returns a
    /// chip when at least one vote exists.
    private static func leadingOption(for poll: PollDTO) -> (label: String, votes: Int)? {
        guard !poll.options.isEmpty else { return nil }
        var topLabel: String?
        var topVotes = 0
        for option in poll.options {
            let votes = poll.optionCounts[option.id]
                ?? poll.optionCounts[option.label]
                ?? 0
            if votes > topVotes {
                topVotes = votes
                topLabel = option.label
            }
        }
        guard topVotes > 0, let label = topLabel else { return nil }
        return (label, topVotes)
    }

    private static func timeMetaText(
        for poll: PollDTO,
        status: PollChipStatus,
        now: Date
    ) -> String? {
        guard let iso = poll.closesAt, let closes = parseDate(iso) else { return nil }
        switch status {
        case .closed:
            let label = formatDateShort(iso: iso)
            return label.map { "Closed \($0)" }
        case .closing:
            let seconds = closes.timeIntervalSince(now)
            if seconds <= 0 { return "Closes today" }
            let hours = Int((seconds / 3600).rounded(.down))
            if hours <= 0 {
                let minutes = max(1, Int((seconds / 60).rounded(.down)))
                return "Closes in \(minutes) min"
            }
            return "Closes in \(hours) hr"
        case .active:
            let label = formatDateShort(iso: iso)
            return label.map { "Closes \($0)" }
        }
    }

    // MARK: - Tab filtering / counts

    private func passes(_ poll: PollDTO, tab: PollsTab, now: Date) -> Bool {
        let status = PollsListViewModel.chipStatus(for: poll, now: now)
        switch tab {
        case .active:
            return status != .closed
        case .closed:
            return status == .closed
        }
    }

    private func counts(_ polls: [PollDTO]) -> PollsTabCounts {
        let nowDate = now()
        var active = 0
        var closed = 0
        for poll in polls {
            switch PollsListViewModel.chipStatus(for: poll, now: nowDate) {
            case .active, .closing: active += 1
            case .closed: closed += 1
            }
        }
        return PollsTabCounts(active: active, closed: closed)
    }

    // MARK: - Banner

    /// Compute the banner summary for the currently-loaded polls.
    /// Exposed `internal` so tests can exercise it without going through
    /// the SwiftUI view body.
    func currentBannerSummary() -> PollsBannerSummary {
        guard let polls else {
            return PollsBannerSummary(awaitingViewerVote: 0, totalActive: 0)
        }
        return PollsListViewModel.summarize(polls: polls, viewerId: viewerId, now: now())
    }

    /// Pure summary projection. Public-static for tests.
    ///
    /// `viewerId` is accepted for API symmetry — the backend's `my_vote`
    /// field is already scoped to the requesting user, so the calculation
    /// works whether or not the caller passes one. The parameter stays in
    /// the signature so future expansion (different backlog rules per
    /// viewer role) can land without changing the call sites.
    static func summarize(
        polls: [PollDTO],
        viewerId: String?,
        now: Date
    ) -> PollsBannerSummary {
        _ = viewerId
        var awaiting = 0
        var totalActive = 0
        for poll in polls {
            switch chipStatus(for: poll, now: now) {
            case .closed: continue
            case .active, .closing: totalActive += 1
            }
            if poll.myVote == nil || poll.myVote?.isEmpty == true {
                awaiting += 1
            }
        }
        return PollsBannerSummary(awaitingViewerVote: awaiting, totalActive: totalActive)
    }

    private func bannerTitle(for summary: PollsBannerSummary) -> String {
        if summary.awaitingViewerVote > 0 {
            let count = summary.awaitingViewerVote
            return count == 1
                ? "1 poll needs your vote"
                : "\(count) polls need your vote"
        }
        return "You're caught up on votes"
    }

    private func bannerSubtitle(for summary: PollsBannerSummary) -> String? {
        if summary.totalActive == 0 { return nil }
        let count = summary.totalActive
        return count == 1
            ? "1 active in this household"
            : "\(count) active in this household"
    }

    // MARK: - Empty copy

    private func emptyHeadline(for tab: PollsTab) -> String {
        switch tab {
        case .active: "No active polls"
        case .closed: "No closed polls yet"
        }
    }

    private func emptySubcopy(for tab: PollsTab) -> String {
        switch tab {
        case .active:
            "Ask the household. Paint colours, weekend plans, whether to replace " +
                "the dishwasher — get a quick read instead of a long thread."
        case .closed:
            "Closed polls show up here once a vote wraps up or a member closes it manually."
        }
    }

    // MARK: - Formatting

    static func formatDateShort(iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    static func parseDate(_ iso: String) -> Date? {
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
