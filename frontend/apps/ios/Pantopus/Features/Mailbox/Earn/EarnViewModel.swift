//
//  EarnViewModel.swift
//  Pantopus
//
//  A10.11 / Block 2A — backs `EarnView`. The live path (`EarnViewModel()`)
//  fetches `GET /api/mailbox/earnings/summary` + `/earnings/history` and
//  projects the earnings DISPLAY: the available/pending balance hero and
//  the recent-earnings list. The weekly-goal ring, linked payout method,
//  auto-cash-out, and 1099 tax docs have no source on those endpoints
//  (the last three are Stripe Connect — Phase 3), so they stay nil and
//  the view hides them rather than faking them. Seeded `content` / `state`
//  initialisers are the preview/test seam.
//

import Foundation
import Observation

@Observable
@MainActor
public final class EarnViewModel {
    public enum State: Equatable, Sendable {
        case loading
        case populated(EarnContent)
        /// New earner — no earnings yet. Carries only the shared
        /// `Ways to earn` rows; every other slot is a fixed gated /
        /// nudge treatment owned by the view.
        case empty(waysToEarn: [EarnWayToEarn])
        case error(message: String)
    }

    public private(set) var state: State = .loading

    /// How this instance resolves `load()`.
    private enum Source {
        /// Fetch from the backend.
        case live
        /// Project seeded content (nil → empty new-earner frame).
        case content(EarnContent?, [EarnWayToEarn])
        /// Keep an explicitly-seeded state (loading / error chrome).
        case seededState
    }

    private let source: Source
    private let client: APIClient

    /// Live earner. The default `EarnView` view-model — fetches on `load()`.
    public init() {
        source = .live
        client = .shared
    }

    init(client: APIClient) {
        source = .live
        self.client = client
    }

    /// Seeded active/new earner. Pass `content: nil` for the empty frame.
    public init(
        content: EarnContent?,
        waysToEarn: [EarnWayToEarn] = EarnSampleData.waysToEarn
    ) {
        source = .content(content, waysToEarn)
        client = .shared
    }

    /// Seed an explicit state — previews/tests for the loading + error chrome.
    public init(state: State) {
        source = .seededState
        client = .shared
        self.state = state
    }

    public func load() async {
        switch source {
        case .live:
            await fetch()
        case let .content(content, waysToEarn):
            state = content.map { .populated($0) } ?? .empty(waysToEarn: waysToEarn)
        case .seededState:
            break
        }
    }

    public func refresh() async {
        await load()
    }

    private func fetch() async {
        state = .loading
        async let summaryResult = client.perform(
            MailboxEndpoints.earningsSummary(),
            as: EarningsSummaryResponse.self
        )
        async let historyResult = client.perform(
            MailboxEndpoints.earningsHistory(),
            as: EarningsHistoryResponse.self
        )
        let summary = await summaryResult
        let history = await (try? (historyResult).get())?.earnings ?? []

        switch summary {
        case let .success(summaryDto):
            let rows = history.map(Self.earning(from:))
            if summaryDto.totalEarned > 0 || !rows.isEmpty {
                state = .populated(Self.content(summary: summaryDto, history: history, rows: rows))
            } else {
                state = .empty(waysToEarn: EarnSampleData.waysToEarn)
            }
        case .failure:
            state = .error(message: "We couldn't load your earnings. Check your connection and try again.")
        }
    }

    // MARK: - DTO → projection

    private static func content(
        summary: EarningsSummaryResponse,
        history: [EarningEntryDTO],
        rows: [EarnEarning]
    ) -> EarnContent {
        let available = max(0, summary.totalEarned - summary.pendingEarnings)
        let thisWeekRows = history.filter { isThisWeek($0.viewedAt ?? $0.createdAt) }
        let thisWeekSum = thisWeekRows.reduce(0.0) { $0 + ($1.payoutAmount ?? 0) }
        let pendingCount = history.filter { ($0.payoutStatus ?? "").lowercased() == "pending" }.count
        return EarnContent(
            available: money(available),
            thisWeek: "$" + money(thisWeekSum),
            thisWeekMeta: thisWeekRows.count == 1 ? "1 this week" : "\(thisWeekRows.count) this week",
            pending: "$" + money(summary.pendingEarnings),
            pendingMeta: pendingCount == 1 ? "1 on hold" : "\(pendingCount) on hold",
            // Deferred slots — no `/earnings/*` source (Stripe = Phase 3).
            weeklyGoal: nil,
            waysToEarn: EarnSampleData.waysToEarn,
            earnings: rows,
            payoutMethod: nil,
            autoCashOut: nil,
            taxDocs: nil
        )
    }

    private static func earning(from dto: EarningEntryDTO) -> EarnEarning {
        let date = parseDate(dto.viewedAt) ?? parseDate(dto.createdAt)
        let isPending = (dto.payoutStatus ?? "").lowercased() == "pending"
        return EarnEarning(
            id: dto.id,
            day: dayLabel(date),
            dateLabel: timeLabel(date),
            description: dto.subject?.nonEmpty ?? "Sponsored offer",
            counterparty: dto.senderBusinessName?.nonEmpty ?? "Pantopus",
            // Ad-payout rows have no gig category — the row renders a
            // neutral tile rather than a faked cleaning/handyman glyph.
            category: nil,
            status: isPending ? .pending(clearsLabel: "soon") : .paid,
            amount: money(dto.payoutAmount ?? 0)
        )
    }

    // MARK: - Formatting helpers

    private static func money(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    private static func dayLabel(_ date: Date?) -> String {
        guard let date else { return "" }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        return dayMonthFormatter.string(from: date)
    }

    private static func timeLabel(_ date: Date?) -> String {
        guard let date else { return "" }
        return timeFormatter.string(from: date).lowercased()
    }

    private static func isThisWeek(_ value: String?) -> Bool {
        guard let date = parseDate(value) else { return false }
        return Calendar.current.isDate(date, equalTo: Date(), toGranularity: .weekOfYear)
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        return isoFractional.date(from: value)
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
    private static let timeFormatter = displayFormatter("h:mm a")
    private static let dayMonthFormatter = displayFormatter("MMM d")
}

private extension String {
    /// Trimmed value, or nil when empty — so blank server strings fall back.
    var nonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
