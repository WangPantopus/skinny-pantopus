//
//  EarnViewModel.swift
//  Pantopus
//
//  A10.11 / Block 2A — backs `EarnView`. The live path (`EarnViewModel()`)
//  fetches `GET /api/wallet` + `GET /api/mailbox/earnings/history`. The
//  hero's "Available to cash out" is the wallet balance, the same figure
//  Payments shows and withdraws. Mail-offer and ad payouts (the history
//  rows) are shown apart from it and marked not cashable: nothing credits
//  them to the wallet. The weekly-goal ring, linked payout method,
//  auto-cash-out, and 1099 tax docs have no source, so they stay nil and
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
        async let walletResult = client.perform(
            WalletEndpoints.balance(),
            as: WalletBalanceResponse.self
        )
        async let historyResult = client.perform(
            MailboxEndpoints.earningsHistory(),
            as: EarningsHistoryResponse.self
        )
        let wallet = await walletResult
        let history = await (try? (historyResult).get())?.earnings ?? []

        switch wallet {
        case let .success(walletDto):
            let rows = history.map(Self.earning(from:))
            let hasWalletMoney = walletDto.wallet.balance > 0 || (walletDto.wallet.lifetimeReceived ?? 0) > 0
            if hasWalletMoney || !rows.isEmpty {
                state = .populated(Self.content(wallet: walletDto.wallet, history: history, rows: rows))
            } else {
                state = .empty(waysToEarn: Self.waysToEarn)
            }
        case .failure:
            state = .error(message: "We couldn't load your earnings. Check your connection and try again.")
        }
    }

    /// Live `Ways to earn` rows. Only real facts: no sample counts or amounts,
    /// and no Refer row until referrals exist.
    static let waysToEarn: [EarnWayToEarn] = [
        EarnWayToEarn(
            kind: .browse,
            title: "Browse open tasks",
            meta: "Paid tasks near you",
            accent: .primary,
            featured: true
        ),
        EarnWayToEarn(
            kind: .offer,
            title: "Offer a service",
            meta: "Get matched to repeat clients",
            accent: .business
        )
    ]

    // MARK: - DTO → projection

    private static func content(
        wallet: WalletBalanceResponse.Wallet,
        history: [EarningEntryDTO],
        rows: [EarnEarning]
    ) -> EarnContent {
        let offerSum = history.reduce(0.0) { $0 + ($1.payoutAmount ?? 0) }
        return EarnContent(
            available: money(Double(wallet.balance) / 100),
            thisWeek: "",
            thisWeekMeta: "",
            pending: "",
            pendingMeta: "",
            offerEarnings: rows.isEmpty ? nil : "$" + money(offerSum),
            // Deferred slots — no source yet (Stripe Connect = Phase 3).
            weeklyGoal: nil,
            waysToEarn: waysToEarn,
            earnings: rows,
            payoutMethod: nil,
            autoCashOut: nil,
            taxDocs: nil
        )
    }

    private static func earning(from dto: EarningEntryDTO) -> EarnEarning {
        let date = parseDate(dto.viewedAt) ?? parseDate(dto.createdAt)
        return EarnEarning(
            id: dto.id,
            day: dayLabel(date),
            dateLabel: timeLabel(date),
            description: dto.subject?.nonEmpty ?? "Sponsored offer",
            counterparty: dto.senderBusinessName?.nonEmpty ?? "Pantopus",
            // Ad-payout rows have no gig category — the row renders a
            // neutral tile rather than a faked cleaning/handyman glyph.
            category: nil,
            // Nothing pays an ad payout out or credits it to the wallet.
            status: .offer,
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
