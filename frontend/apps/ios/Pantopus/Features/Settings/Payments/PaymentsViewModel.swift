//
//  PaymentsViewModel.swift
//  Pantopus
//
//  Projects the A14.6 Payments screen into render state. Phase 3 (3A)
//  wires the Payment-methods card to the real backend (`/api/payments`):
//  list saved methods, add a card via Stripe PaymentSheet, set-default
//  and remove (optimistic). The balance hero / Payouts (Stripe Connect) /
//  Activity sections render an honest "not set up yet" scaffold in the
//  live frame — they're wired in 3C. The fixture seam (`init(seed:)`)
//  drives previews + snapshot tests against the full design.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Observation

/// Which sample frame to load. Selecting a seed puts the view-model in
/// fixture mode — `load()` projects the static fixture and the network /
/// PaymentSheet collaborators are never touched. Live mode (the default
/// `init()`) fetches from the backend.
public enum PaymentsSeed: Sendable, Hashable {
    case populated
    case empty
}

@Observable
@MainActor
public final class PaymentsViewModel {
    public private(set) var state: PaymentsState = .loading
    /// Transient, user-facing error from a row action (set-default /
    /// remove / add-card). The view surfaces it as an alert.
    public private(set) var actionError: String?
    /// Card queued for removal — drives the destructive confirmation. The
    /// DELETE only fires once the user confirms, so the action menu's
    /// "Remove Card" item sets this instead of calling `removeMethod(_:)`.
    public private(set) var pendingRemoval: PaymentMethod?

    private let api: APIClient
    private let sheetPresenter: any PaymentSheetPresenting
    /// Non-`nil` → fixture mode (previews / snapshots / projection tests).
    private let seed: PaymentsSeed?

    /// Live (production) — real backend + Stripe PaymentSheet.
    public convenience init() {
        self.init(api: .shared, sheetPresenter: StripePaymentSheetPresenter())
    }

    /// Live with injected collaborators — used by the live-path unit tests.
    init(api: APIClient, sheetPresenter: any PaymentSheetPresenting) {
        self.api = api
        self.sheetPresenter = sheetPresenter
        seed = nil
    }

    /// Fixture-driven — previews, snapshot tests, projection tests.
    public init(seed: PaymentsSeed) {
        api = .shared
        sheetPresenter = StripePaymentSheetPresenter()
        self.seed = seed
    }

    // MARK: - Load

    public func load() async {
        await load(showLoading: true)
    }

    /// `showLoading == false` keeps the current frame on screen while re-reading,
    /// so a pull-to-refresh does not tear the list down under the user's finger.
    /// Mirrors `WalletViewModel.fetchLive(showLoading:)`.
    private func load(showLoading: Bool) async {
        if let seed {
            state = .loaded(Self.fixture(for: seed))
            return
        }
        if showLoading { state = .loading }
        do {
            let methods = try await fetchMethods()
            // History + lifetime totals are supplementary — a failure there
            // shouldn't sink the whole screen, so each degrades on its own
            // (the "couldn't load" activity row / an em-dash tile) while the
            // methods card still renders.
            state = await .loaded(
                Self.liveFrame(
                    methods: methods,
                    activity: fetchActivity(),
                    earnings: fetchEarnings(),
                    connectAccount: fetchConnectAccount()
                )
            )
        } catch {
            state = .error(message: Self.message(for: error))
        }
    }

    /// Pull-to-refresh + the error frame's Retry. Keeps a loaded frame on screen
    /// while re-reading (the pull indicator is the progress signal); only an
    /// error frame falls back to the loading shell, exactly as Wallet does on
    /// both platforms.
    public func refresh() async {
        let showLoading: Bool = if case .error = state { true } else { false }
        await load(showLoading: showLoading)
    }

    // MARK: - Add a card (Stripe PaymentSheet, SetupIntent)

    public func tapAddMethod() async {
        guard seed == nil else { return }
        do {
            let params: AddCardSheetParams = try await api.request(PaymentsEndpoints.addCardSheet())
            let outcome = await sheetPresenter.presentAddCard(
                setupIntentClientSecret: params.setupIntent,
                customer: params.customer,
                ephemeralKey: params.ephemeralKey,
                publishableKey: params.publishableKey
            )
            switch outcome {
            case .completed:
                // The attached card is reconciled into the backend by the
                // `payment_method.attached` webhook; re-read the source of
                // truth so the list reflects server state.
                await reloadMethods()
            case .canceled:
                break
            case let .failed(message):
                actionError = message
            }
        } catch {
            actionError = Self.message(for: error)
        }
    }

    // MARK: - Set default / remove (optimistic, then reconcile)

    public func setDefault(_ id: String) async {
        guard seed == nil, case let .loaded(loaded) = state else { return }
        let previous = loaded
        state = .loaded(loaded.markingDefault(id))
        do {
            try await api.request(PaymentsEndpoints.setDefaultMethod(id: id))
            await reloadMethods()
        } catch {
            state = .loaded(previous)
            actionError = "Couldn't update your default payment method. Please try again."
        }
    }

    /// Queue `method` for the destructive confirmation. Nothing is sent to
    /// the backend until `removeMethod(_:)` runs from its confirm action.
    public func requestRemoval(_ method: PaymentMethod) {
        pendingRemoval = method
    }

    public func cancelRemoval() {
        pendingRemoval = nil
    }

    /// Confirm action of the removal confirmation — the only caller that
    /// issues `DELETE /api/payments/methods/{id}`.
    public func removeMethod(_ id: String) async {
        pendingRemoval = nil
        guard seed == nil, case let .loaded(loaded) = state else { return }
        let previous = loaded
        state = .loaded(loaded.removingMethod(id))
        do {
            try await api.request(PaymentsEndpoints.removeMethod(id: id))
            await reloadMethods()
        } catch {
            state = .loaded(previous)
            actionError = "Couldn't remove that payment method. Please try again."
        }
    }

    public func clearActionError() {
        actionError = nil
    }

    /// Non-wallet rows can still be observed here; payout rows route through
    /// `PaymentsView` into the Wallet surface where Connect is live.
    public func tapRow(_: String) async {}
    public func tapCloseAccount() async {}

    // MARK: - Backend

    private func fetchMethods() async throws -> [PaymentMethod] {
        let response: PaymentMethodsResponse = try await api.request(PaymentsEndpoints.methods())
        return response.paymentMethods.map(Self.uiMethod(from:))
    }

    /// `GET /api/payments/history` → the Activity card. A transport failure
    /// keeps the screen usable and says so rather than claiming the user has
    /// no transactions.
    private func fetchActivity() async -> PaymentsActivity {
        do {
            let response: PaymentHistoryResponse = try await api.request(PaymentHistoryEndpoints.history())
            return Self.activity(from: response.transactions)
        } catch {
            return .empty(
                title: "Couldn't load transactions",
                body: "Pull down to refresh and try again."
            )
        }
    }

    /// `GET /api/payments/earnings` + `GET /api/payments/spending` → the
    /// "Earnings & Spending" card. Mirrors RN `PayoutsTab`'s
    /// `Promise.allSettled`: each figure degrades to RN's em-dash on its own,
    /// and when *neither* could be read the card is hidden rather than
    /// claiming the user earned and spent nothing.
    private func fetchEarnings() async -> PaymentsEarnings? {
        let earned: PaymentsEarningsResponse? = try? await api.request(EarningsEndpoints.earnings())
        let spent: SpendingSummaryResponse? = try? await api.request(EarningsEndpoints.spending())
        return Self.earnings(earned: earned?.earnings, spent: spent?.spending)
    }

    /// `GET /api/payments/connect/account` — drives the Payouts card. A 404
    /// (the seller has never connected) or any transport error degrades to
    /// `nil`, which renders the honest not-connected scaffold.
    private func fetchConnectAccount() async -> ConnectAccountDTO? {
        let response: ConnectAccountStatusResponse? = try? await api.request(
            ConnectEndpoints.accountStatus()
        )
        return response?.account
    }

    /// Pure projection — the unit-test surface for the card.
    static func earnings(earned: EarningsSummary?, spent: SpendingSummary?) -> PaymentsEarnings? {
        guard earned != nil || spent != nil else { return nil }
        return PaymentsEarnings(
            totalEarned: earned.map { centsToCurrency($0.totalEarned) } ?? "—",
            totalSpent: spent.map { centsToCurrency($0.totalSpent) } ?? "—",
            caption: "Total earned includes funds still in review or on hold. "
                + "Your wallet balance shows what's withdrawable now."
        )
    }

    private func reloadMethods() async {
        do {
            let methods = try await fetchMethods()
            if case let .loaded(current) = state {
                state = .loaded(current.replacingMethods(methods))
            } else {
                state = .loaded(Self.liveFrame(methods: methods))
            }
        } catch {
            // Keep the optimistic state; surface a soft error.
            actionError = Self.message(for: error)
        }
    }

    private static func message(for error: any Error) -> String {
        (error as? APIError)?.errorDescription ?? "Couldn't load your payment methods. Please try again."
    }

    // MARK: - Projection

    private static func fixture(for seed: PaymentsSeed) -> PaymentsLoaded {
        switch seed {
        case .populated: PaymentsSampleData.populated
        case .empty: PaymentsSampleData.empty
        }
    }

    /// Live frame: real saved methods + a payout entry point + the real
    /// transaction history. The balance hero stays nil because Wallet owns
    /// the earnings-in surface.
    static func liveFrame(
        methods: [PaymentMethod],
        activity: PaymentsActivity = .empty(
            title: "No transactions yet",
            body: "Hires and sales will appear here."
        ),
        earnings: PaymentsEarnings? = nil,
        connectAccount: ConnectAccountDTO? = nil
    ) -> PaymentsLoaded {
        PaymentsLoaded(
            balance: nil,
            methods: methods,
            payouts: payouts(from: connectAccount),
            activity: activity,
            canCloseAccount: false,
            footerCaption: "Payments are processed securely by Stripe.",
            earnings: earnings
        )
    }

    // MARK: - Transaction history projection

    /// Project `GET /api/payments/history` rows onto the Activity card. An
    /// empty feed keeps the genuine empty state.
    static func activity(from entries: [PaymentHistoryEntryDTO]) -> PaymentsActivity {
        guard !entries.isEmpty else {
            return .empty(title: "No transactions yet", body: "Hires and sales will appear here.")
        }
        return .transactions(entries.map(transaction(from:)))
    }

    /// One history row → one Activity row. Mirrors RN `HistoryTab`: payouts
    /// and debits read as money out, credits as money in, tips get the star.
    static func transaction(from entry: PaymentHistoryEntryDTO) -> PaymentsTransaction {
        let isPayout = entry.entryType == "payout"
        let isTip = entry.paymentType == "tip"
        let isOutgoing = isPayout
            || entry.direction?.lowercased() == "debit"
            || (entry.direction == nil && entry.isSender == true)
        let kind: PaymentsTransaction.Kind = if isTip {
            .tip
        } else if isPayout {
            .payout
        } else if isOutgoing {
            .sent
        } else {
            .received
        }
        return PaymentsTransaction(
            id: entry.id,
            kind: kind,
            title: title(for: entry, isPayout: isPayout),
            meta: meta(for: entry, isPayout: isPayout, isOutgoing: isOutgoing),
            amount: "\(isOutgoing ? "-" : "+")\(centsToCurrency(entry.amountCents))",
            isOutgoing: isOutgoing
        )
    }

    private static func title(for entry: PaymentHistoryEntryDTO, isPayout: Bool) -> String {
        if isPayout {
            if let last4 = entry.destinationLast4, !last4.isEmpty {
                return "Payout to bank ••••\(last4)"
            }
            return entry.description ?? "Payout"
        }
        if let gigTitle = entry.gig?.title, !gigTitle.isEmpty { return gigTitle }
        if let description = entry.description, !description.isEmpty { return description }
        if let type = entry.paymentType, !type.isEmpty { return humanised(type) }
        return "Payment"
    }

    private static func meta(
        for entry: PaymentHistoryEntryDTO,
        isPayout: Bool,
        isOutgoing: Bool
    ) -> String {
        var parts: [String] = []
        if let date = shortDate(entry.createdAt) { parts.append(date) }
        if let status = entry.status, !status.isEmpty { parts.append(humanised(status)) }
        if !isPayout {
            let counterparty = isOutgoing ? entry.payee?.displayName : entry.payer?.displayName
            if let counterparty {
                parts.append(isOutgoing ? "to \(counterparty)" : "from \(counterparty)")
            }
        }
        return parts.joined(separator: " · ")
    }

    /// `gig_payment` → `Gig payment`, `authorize_pending` → `Authorize pending`.
    private static func humanised(_ raw: String) -> String {
        let spaced = raw.replacingOccurrences(of: "_", with: " ")
        return spaced.prefix(1).uppercased() + spaced.dropFirst()
    }

    private static let centsFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.usesGroupingSeparator = true
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "en_US")
        return formatter
    }()

    /// Integer cents → `"$1,284.50"`. Formatting only — the server's amount
    /// is never re-derived or rounded.
    static func centsToCurrency(_ cents: Int) -> String {
        let dollars = Double(abs(cents)) / 100.0
        let plain = centsFormatter.string(from: NSNumber(value: dollars)) ?? String(format: "%.2f", dollars)
        return "$\(plain)"
    }

    private static let iso8601Fraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Plain: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static let shortDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    static func shortDate(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        guard let date = iso8601Fraction.date(from: raw) ?? iso8601Plain.date(from: raw) else { return nil }
        return shortDateFormatter.string(from: date)
    }

    /// Project the live Connect status onto the Payouts card. Mirrors RN
    /// `PayoutsTab` (`PayoutsTab.tsx:129-248`) three-way split — onboarded
    /// (`charges_enabled && payouts_enabled`) / account created but still
    /// verifying / never connected — instead of always rendering the
    /// not-connected scaffold. Stripe hands the platform no bank details for
    /// an Express account, so the connected frame points at the seller's own
    /// Stripe dashboard (reachable through the Wallet payout surface) rather
    /// than inventing a bank name.
    static func payouts(from account: ConnectAccountDTO?) -> PaymentsPayouts {
        guard let account, let id = account.stripeAccountId, !id.isEmpty else {
            return notConnectedPayouts
        }
        guard account.chargesEnabled, account.payoutsEnabled else {
            return verifyingPayouts
        }
        let connectedOn = connectedDate(account.createdAt).map { "Connected \($0)" }
        return PaymentsPayouts(
            stripe: PaymentsPayoutRow(
                id: "payouts.stripe",
                leadingBrand: .stripe,
                label: "Stripe Connect",
                subtext: connectedOn ?? "Card payments and payouts enabled",
                trailing: .chipChevron(label: "Connected", tone: .success)
            ),
            payoutMethod: PaymentsPayoutRow(
                id: "payouts.method",
                leadingBrand: .bank,
                label: "Payout method",
                subtext: "Managed in your Stripe dashboard",
                trailing: .chevron
            ),
            payoutSchedule: nil,
            taxInfo: PaymentsPayoutRow(
                id: "payouts.tax",
                label: "Tax info",
                subtext: "Collected by Stripe during setup",
                trailing: .chevron
            ),
            helper: "Stripe handles payouts. Funds clear to your bank in 1–2 business days."
        )
    }

    private static let verifyingPayouts = PaymentsPayouts(
        stripe: PaymentsPayoutRow(
            id: "payouts.stripe",
            leadingBrand: .stripe,
            label: "Stripe Connect",
            subtext: "Account verification in progress",
            trailing: .ctaChip(label: "Continue setup", tone: .primary)
        ),
        payoutMethod: PaymentsPayoutRow(
            id: "payouts.method",
            label: "Payout method",
            subtext: "Available once Stripe finishes verification",
            trailing: .gatedDash
        ),
        payoutSchedule: nil,
        taxInfo: PaymentsPayoutRow(
            id: "payouts.tax",
            label: "Tax info",
            subtext: "W-9 collected during setup",
            trailing: .gatedDash
        ),
        helper: "Stripe is verifying your identity. This usually takes 1–2 business days."
    )

    private static let connectedDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d, yyyy"
        return formatter
    }()

    /// `StripeAccount.created_at` → "Mar 12, 2024". `nil` keeps the row on the
    /// capability line rather than showing a fabricated date.
    static func connectedDate(_ raw: String?) -> String? {
        guard let raw, !raw.isEmpty else { return nil }
        guard let date = iso8601Fraction.date(from: raw) ?? iso8601Plain.date(from: raw) else { return nil }
        return connectedDateFormatter.string(from: date)
    }

    private static let notConnectedPayouts = PaymentsPayouts(
        stripe: PaymentsPayoutRow(
            id: "payouts.stripe",
            leadingBrand: .stripe,
            label: "Stripe Connect",
            subtext: "Receive payments from neighbors",
            trailing: .ctaChip(label: "Connect", tone: .primary)
        ),
        payoutMethod: PaymentsPayoutRow(
            id: "payouts.method",
            label: "Payout method",
            subtext: "Add after connecting Stripe",
            trailing: .gatedDash
        ),
        payoutSchedule: nil,
        taxInfo: PaymentsPayoutRow(
            id: "payouts.tax",
            label: "Tax info",
            subtext: "W-9 collected during setup",
            trailing: .gatedDash
        ),
        helper: "Required before you can post paid tasks or sell on Marketplace."
    )

    static func uiMethod(from dto: PaymentMethodDTO) -> PaymentMethod {
        let isBank = dto.paymentMethodType == "us_bank_account"
            || (dto.cardBrand == nil && dto.bankLast4 != nil)
        let last4 = isBank ? (dto.bankLast4 ?? "••••") : (dto.cardLast4 ?? "••••")
        let name = isBank ? (dto.bankName ?? "Bank account") : cardName(dto.cardBrand)
        let label = "\(name) •• \(last4)"

        let subtext: String? = if isBank {
            dto.bankAccountType.map { "\($0.capitalized) account" }
        } else if let month = dto.cardExpMonth, let year = dto.cardExpYear {
            String(format: "Expires %02d/%02d", month, year % 100)
        } else {
            nil
        }

        return PaymentMethod(
            id: dto.id,
            brand: isBank ? .bank : brand(from: dto.cardBrand),
            label: label,
            subtext: subtext,
            chip: dto.isDefault ? PaymentMethodChip(label: "Default", tone: .primary) : nil,
            last4: isBank ? dto.bankLast4 : dto.cardLast4
        )
    }

    private static func brand(from cardBrand: String?) -> PaymentMethodBrand {
        switch (cardBrand ?? "").lowercased() {
        case "visa": .visa
        case "mastercard": .mastercard
        case "amex", "american_express": .amex
        default: .card
        }
    }

    private static func cardName(_ cardBrand: String?) -> String {
        let raw = (cardBrand ?? "").trimmingCharacters(in: .whitespaces)
        return switch raw.lowercased() {
        case "visa": "Visa"
        case "mastercard": "Mastercard"
        case "amex", "american_express": "Amex"
        case "": "Card"
        default: raw.capitalized
        }
    }
}

// MARK: - PaymentsLoaded transforms

private extension PaymentsLoaded {
    func replacingMethods(_ methods: [PaymentMethod]) -> PaymentsLoaded {
        PaymentsLoaded(
            balance: balance,
            methods: methods,
            payouts: payouts,
            activity: activity,
            canCloseAccount: canCloseAccount,
            footerCaption: footerCaption,
            earnings: earnings
        )
    }

    func markingDefault(_ id: String) -> PaymentsLoaded {
        replacingMethods(methods.map { method in
            PaymentMethod(
                id: method.id,
                brand: method.brand,
                label: method.label,
                subtext: method.subtext,
                chip: method.id == id ? PaymentMethodChip(label: "Default", tone: .primary) : nil,
                last4: method.last4
            )
        })
    }

    func removingMethod(_ id: String) -> PaymentsLoaded {
        replacingMethods(methods.filter { $0.id != id })
    }
}
