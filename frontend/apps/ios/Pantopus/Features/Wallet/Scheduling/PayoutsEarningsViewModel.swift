//
//  PayoutsEarningsViewModel.swift
//  Pantopus
//
//  G7 Payouts & Earnings (Stream I14) — the EXCLUSIVE Calendarly extension of
//  the A10.10 Wallet. Reuses the live Wallet read endpoints (balance /
//  transactions / pending-release) + Stripe Connect status, then layers a
//  booking-source filter (All / Gigs / Booking earnings / Packages) and renders
//  booking settlement honestly as Pending/Processing (payout settlement is
//  deferred server-side). Withdraw is gated on Connect payouts. Gated behind
//  `SchedulingFeatureFlags.paidEnabled`. Matches `wallet-earnings-frames.jsx`.
//

import Foundation
import Observation

/// The source axis for the earnings filter (a different axis than the Wallet's
/// activity-category icon).
enum EarningsSource: String, CaseIterable, Identifiable {
    case all
    case gigs
    case booking
    case packages

    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .all: "All"
        case .gigs: "Gigs"
        case .booking: "Booking earnings"
        case .packages: "Packages"
        }
    }
}

/// One projected earnings row.
struct EarningRow: Identifiable, Equatable {
    let id: String
    let day: String
    let description: String
    let time: String
    /// Display amount without symbol, e.g. `"48.00"`.
    let amount: String
    let direction: ActivityDirection
    let source: EarningsSource
    let isPending: Bool
    let isFee: Bool

    var statusLabel: String {
        if isFee { return "Fee" }
        if direction == .out { return "Payout" }
        return isPending ? "Pending" : "Cleared"
    }
}

@Observable
@MainActor
final class PayoutsEarningsViewModel {
    enum Phase: Equatable { case loading, loaded, error(String) }

    /// Withdraw / payout enablement, derived from the Connect account.
    enum PayoutState: Equatable { case enabled, onHold, notEnabled }

    enum Toast: Equatable { case success(String), error(String) }

    // MARK: Inputs

    let owner: SchedulingOwner
    let push: @MainActor (SchedulingRoute) -> Void
    private let client: SchedulingClient
    private let injectedPresenter: (any ConnectWebPresenting)?
    private let calendar: Calendar
    private let now: @Sendable () -> Date

    // MARK: State

    private(set) var phase: Phase = .loading
    var source: EarningsSource = .booking
    private(set) var payoutState: PayoutState = .notEnabled
    private(set) var connecting = false
    private(set) var withdrawing = false
    private(set) var toast: Toast?

    private(set) var availableDisplay = "0.00"
    private(set) var availableCents = 0
    private(set) var pendingDisplay = "$0.00"
    private(set) var pendingMeta = "Nothing pending"
    private(set) var monthDisplay = "$0.00"
    private(set) var monthMeta = "0 bookings this month"
    private(set) var allRows: [EarningRow] = []

    // MARK: Derived

    var rows: [EarningRow] {
        guard source != .all else { return allRows }
        return allRows.filter { $0.source == source }
    }

    var isEmpty: Bool {
        rows.isEmpty
    }

    /// Whole-screen empty state (no balance and nothing earned).
    var isFullyEmpty: Bool {
        availableCents == 0 && allRows.filter { $0.direction == .in }.isEmpty
    }

    var canWithdraw: Bool {
        payoutState == .enabled && availableCents >= 100
    }

    init(
        owner: SchedulingOwner,
        push: @escaping @MainActor (SchedulingRoute) -> Void,
        client: SchedulingClient,
        connectPresenter: (any ConnectWebPresenting)? = nil,
        calendar: Calendar = .current,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.owner = owner
        self.push = push
        self.client = client
        injectedPresenter = connectPresenter
        self.calendar = calendar
        self.now = now
    }

    // MARK: Lifecycle

    func load() async {
        phase = .loading
        await fetch()
    }

    func refresh() async {
        await load()
    }

    private func fetch(showLoading: Bool = true) async {
        if showLoading { phase = .loading }
        do {
            let balance: WalletBalanceResponse = try await client.request(WalletEndpoints.balance())
            let history: WalletTransactionsResponse = try await client.request(WalletEndpoints.transactions())
            let pending: WalletPendingReleaseResponse? = try? await client.request(WalletEndpoints.pendingRelease())
            let connect: ConnectAccountStatusResponse? = try? await client.request(ConnectEndpoints.accountStatus())

            availableCents = balance.wallet.balance
            availableDisplay = WalletViewModel.centsToPlain(balance.wallet.balance)
            applyPending(pending)
            applyMonth(history.transactions)
            allRows = history.transactions.map { Self.projectRow(from: $0, calendar: calendar, now: now()) }
            payoutState = Self.payoutState(for: connect?.account)
            phase = .loaded
        } catch let error as SchedulingError {
            phase = .error(error.userMessage ?? "Couldn't load your earnings.")
        } catch {
            phase = .error("Couldn't load your earnings.")
        }
    }

    private func applyPending(_ pending: WalletPendingReleaseResponse?) {
        let cents = pending?.totalPendingCents ?? 0
        let count = (pending?.inReviewCount ?? 0) + (pending?.releasingSoonCount ?? 0)
        pendingDisplay = WalletViewModel.centsToCurrency(cents)
        if cents == 0 {
            pendingMeta = "Nothing pending"
        } else {
            pendingMeta = "\(count) booking\(count == 1 ? "" : "s")"
        }
    }

    private func applyMonth(_ transactions: [WalletTransactionDTO]) {
        let incomeThisMonth = transactions.filter { tx in
            guard Self.direction(for: tx.type) == .in, let date = WalletViewModel.parseDate(tx.createdAt) else { return false }
            return calendar.isDate(date, equalTo: now(), toGranularity: .month)
        }
        let cents = incomeThisMonth.reduce(0) { $0 + $1.amount }
        monthDisplay = WalletViewModel.centsToCurrency(cents)
        let count = incomeThisMonth.count
        monthMeta = "\(count) booking\(count == 1 ? "" : "s") this month"
    }

    // MARK: Withdraw

    func withdraw() async {
        guard !withdrawing, canWithdraw else {
            if payoutState != .enabled { toast = .error("Set up payouts before withdrawing.") }
            return
        }
        withdrawing = true
        defer { withdrawing = false }
        do {
            let response: WalletWithdrawResponse = try await client.request(
                WalletEndpoints.withdraw(body: WalletWithdrawRequest(amount: availableCents, idempotencyKey: UUID().uuidString))
            )
            toast = .success(response.message ?? "Withdrawal initiated.")
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            toast = .error(error.userMessage ?? "Couldn't process the withdrawal.")
        } catch {
            toast = .error("Couldn't process the withdrawal.")
        }
    }

    // MARK: Connect (set up / re-verify)

    func setupPayouts() async {
        guard !connecting else { return }
        connecting = true
        defer { connecting = false }
        let presenter = injectedPresenter ?? ConnectWebPresenter()
        _ = try? await client.request(ConnectEndpoints.createAccount(), as: ConnectCreateAccountResponse.self)
        do {
            let link: ConnectOnboardingResponse = try await client.request(ConnectEndpoints.onboarding())
            guard let url = URL(string: link.onboardingUrl) else {
                toast = .error("Couldn't open payout setup.")
                return
            }
            await presenter.present(url: url)
            await fetch(showLoading: false)
        } catch let error as SchedulingError {
            toast = .error(error.userMessage ?? "Couldn't start payout setup.")
        } catch {
            toast = .error("Couldn't start payout setup.")
        }
    }

    func openDashboard() async {
        let presenter = injectedPresenter ?? ConnectWebPresenter()
        do {
            let link: ConnectDashboardResponse = try await client.request(ConnectEndpoints.dashboard())
            guard let url = URL(string: link.dashboardUrl) else { return }
            await presenter.present(url: url)
        } catch let error as SchedulingError {
            toast = .error(error.userMessage ?? "Couldn't open your payout dashboard.")
        } catch {
            toast = .error("Couldn't open your payout dashboard.")
        }
    }

    func clearToast() {
        toast = nil
    }

    // MARK: - Pure projections (unit-test surface)

    static func payoutState(for account: ConnectAccountDTO?) -> PayoutState {
        guard let account, account.stripeAccountId != nil else { return .notEnabled }
        return account.payoutsEnabled ? .enabled : .onHold
    }

    static func direction(for type: String) -> ActivityDirection {
        switch type {
        case "withdrawal", "gig_payment", "tip_sent", "transfer_out", "cancellation_fee":
            .out
        default:
            .in
        }
    }

    /// Classify a transaction onto the earnings source axis. Fees / bank moves
    /// fall through to `.gigs` only when income; otherwise they appear under
    /// "All" and the fee styling.
    static func source(for type: String, description: String?) -> EarningsSource {
        let hay = (type + " " + (description ?? "")).lowercased()
        if hay.contains("package") || hay.contains("credit") { return .packages }
        if hay.contains("book") { return .booking }
        return .gigs
    }

    static func projectRow(
        from tx: WalletTransactionDTO,
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> EarningRow {
        let date = WalletViewModel.parseDate(tx.createdAt)
        let direction = direction(for: tx.type)
        let isFee = tx.type == "cancellation_fee" || tx.type == "fee"
        return EarningRow(
            id: tx.id,
            day: WalletViewModel.dayLabel(date, calendar: calendar, now: now),
            description: tx.description ?? Self.fallbackDescription(for: tx.type),
            time: WalletViewModel.timeLabel(date, calendar: calendar),
            amount: WalletViewModel.centsToPlain(tx.amount),
            direction: direction,
            source: source(for: tx.type, description: tx.description),
            isPending: tx.status == "pending",
            isFee: isFee
        )
    }

    static func fallbackDescription(for type: String) -> String {
        switch type {
        case "gig_income", "gig_payment": "Booking payment"
        case "tip_income": "Tip received"
        case "cancellation_fee": "Cancellation fee"
        case "refund": "Refund"
        case "withdrawal": "Withdrawal"
        default: "Earning"
        }
    }
}
