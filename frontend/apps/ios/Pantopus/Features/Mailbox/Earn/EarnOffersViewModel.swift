//
//  EarnOffersViewModel.swift
//  Pantopus
//
//  Backs the Earn drawer's paid-offer wall (`Offers` tab of A10.11).
//
//  The wall is the money-IN engine RN ships at
//  `src/app/mailbox/earn.tsx`: list active offers, open an envelope,
//  dwell on it for the server's 15s minimum, then close to bank the
//  reward, plus save / reveal-code side actions.
//
//  Two rules this implementation holds to:
//  * **The dwell is real.** `open` starts a wall-clock timer; only when
//    it passes 15s does `close` fire with the measured `dwellMs`, and the
//    card flips to "earned" **only** if the server answers
//    `consumed: true`.
//  * **The balance is the server's.** Every state-changing call is
//    followed by a fresh `GET /earn/balance` read — the client never
//    increments a local total.
//
//  Routes: `backend/routes/mailboxV2.js` lines 794 / 831 / 858 / 940 /
//  979 / 989. Endpoint builders in `EarnOffersEndpoints`.
//

import Foundation
import Observation

@Observable
@MainActor
public final class EarnOffersViewModel {
    public enum State: Equatable, Sendable {
        case loading
        /// At least one active offer. `balance` is the server's numbers.
        case loaded(balance: EarnOffersBalance, offers: [EarnOfferItem])
        /// No active offers in the caller's area — the balance hero still
        /// renders so a returning earner can see what they banked.
        case empty(balance: EarnOffersBalance)
        case error(message: String)
    }

    public private(set) var state: State = .loading
    /// First-class daily-cap state — set when `POST /earn/open` answers
    /// 429 `{ capped: true }`. Rendered as a banner, never as an error.
    public private(set) var capNotice: EarnCapNotice?
    /// Set by `reveal(_:)`; the view presents it as an alert.
    public private(set) var revealedCode: EarnRevealedCode?
    public private(set) var toast: ToastMessage?
    /// Offers with an in-flight write, so their controls can disable.
    public private(set) var busyOfferIDs: Set<String> = []

    private let client: APIClient
    private let isLive: Bool
    private var dwellTasks: [String: Task<Void, Never>] = [:]
    private var toastTask: Task<Void, Never>?

    /// Live wall — the default view-model. Fetches on `load()`.
    public init() {
        client = .shared
        isLive = true
    }

    init(client: APIClient) {
        self.client = client
        isLive = true
    }

    /// Seeded state — previews and unit tests for the chrome.
    public init(state: State) {
        client = .shared
        isLive = false
        self.state = state
    }

    // MARK: - Loading

    public func load() async {
        guard isLive else { return }
        state = .loading
        await fetch()
    }

    /// First-appearance load. Tab switches re-enter the view but must not
    /// re-fetch — a running dwell timer would otherwise lose its card.
    public func loadIfNeeded() async {
        guard isLive, case .loading = state else { return }
        await fetch()
    }

    public func refresh() async {
        guard isLive else { return }
        await fetch()
    }

    private func fetch() async {
        async let offersOutcome = client.perform(
            EarnOffersEndpoints.offers(),
            as: EarnOffersResponse.self
        )
        async let balanceOutcome = client.perform(
            EarnOffersEndpoints.balance(),
            as: EarnBalanceResponse.self
        )
        let offersResult = await offersOutcome
        // Mirrors RN's `Promise.allSettled` — a balance blip must not
        // hide a perfectly good offer wall.
        let balance = await (try? balanceOutcome.get())?.balance
        let display = balance.map(Self.display(balance:)) ?? .zero

        switch offersResult {
        case let .success(response):
            let items = response.offers.map(Self.item(from:))
            state = items.isEmpty
                ? .empty(balance: display)
                : .loaded(balance: display, offers: items)
        case .failure:
            state = .error(
                message: "We couldn't load offers. Check your connection and try again."
            )
        }
    }

    // MARK: - Open → dwell → bank

    /// `POST /earn/open`. Starts the dwell window on success; surfaces the
    /// daily cap as `capNotice` rather than a generic error.
    public func open(_ offerId: String) async {
        guard case let .loaded(_, offers) = state,
              let offer = offers.first(where: { $0.id == offerId }),
              offer.engagement == .unopened,
              !busyOfferIDs.contains(offerId)
        else { return }

        busyOfferIDs.insert(offerId)
        defer { busyOfferIDs.remove(offerId) }

        do {
            let response = try await client.request(
                EarnOffersEndpoints.openOffer(offerId: offerId),
                as: EarnOpenOfferResponse.self
            )
            capNotice = nil
            if response.alreadyOpened == true {
                // A transaction already existed — no new dwell window.
                updateEngagement(offerId, to: .pending)
                await refreshBalance()
                return
            }
            updateEngagement(offerId, to: .dwelling(secondsRemaining: EarnOfferDwell.seconds))
            await refreshBalance()
            startDwell(offerId)
        } catch let error as APIError {
            if case let .clientError(status, _) = error, status == 429 {
                capNotice = EarnCapNotice()
            } else {
                showToast(error.errorDescription ?? "We couldn't open that offer.", kind: .error)
            }
        } catch {
            showToast("We couldn't open that offer.", kind: .error)
        }
    }

    /// Cancels every running dwell timer. Called when the wall leaves the
    /// screen — mirrors RN's `clearInterval` cleanup on unmount.
    public func cancelDwellTimers() {
        for task in dwellTasks.values {
            task.cancel()
        }
        dwellTasks.removeAll()
    }

    private func startDwell(_ offerId: String) {
        dwellTasks[offerId]?.cancel()
        let started = Date()
        dwellTasks[offerId] = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                let elapsed = Date().timeIntervalSince(started)
                let remaining = max(0, Int((Double(EarnOfferDwell.seconds) - elapsed).rounded(.up)))
                updateEngagement(offerId, to: .dwelling(secondsRemaining: remaining))
                if elapsed >= Double(EarnOfferDwell.seconds) { break }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
            guard !Task.isCancelled else { return }
            let dwellMs = Int(Date().timeIntervalSince(started) * 1000)
            await bank(offerId: offerId, dwellMs: dwellMs)
        }
    }

    /// `POST /earn/close/:offerId`. The card only claims the payout when
    /// the server says `consumed: true`.
    private func bank(offerId: String, dwellMs: Int) async {
        dwellTasks[offerId] = nil
        do {
            let response = try await client.request(
                EarnOffersEndpoints.closeOffer(offerId: offerId, dwellMs: dwellMs),
                as: EarnCloseOfferResponse.self
            )
            if response.consumed {
                updateEngagement(offerId, to: .earned)
                await refreshBalance()
            } else {
                updateEngagement(
                    offerId,
                    to: Self.engagement(forStatus: response.status) ?? .pending
                )
            }
        } catch {
            // Reward stays un-banked — never fake an earn the server
            // hasn't accepted.
            updateEngagement(offerId, to: .pending)
        }
    }

    // MARK: - Save / reveal

    /// `POST /earn/save/:offerId` — RN confirms with "Offer saved".
    public func save(_ offerId: String) async {
        guard !busyOfferIDs.contains(offerId) else { return }
        busyOfferIDs.insert(offerId)
        defer { busyOfferIDs.remove(offerId) }
        do {
            _ = try await client.request(
                EarnOffersEndpoints.saveOffer(offerId: offerId),
                as: EarnSaveOfferResponse.self
            )
            showToast("Offer saved", kind: .success)
        } catch {
            showToast("We couldn't save that offer.", kind: .error)
        }
    }

    /// `POST /earn/reveal/:offerId` — pops the promo code in an alert.
    public func reveal(_ offerId: String) async {
        guard case let .loaded(_, offers) = state,
              let offer = offers.first(where: { $0.id == offerId }),
              !busyOfferIDs.contains(offerId)
        else { return }

        busyOfferIDs.insert(offerId)
        defer { busyOfferIDs.remove(offerId) }
        do {
            let response = try await client.request(
                EarnOffersEndpoints.revealOffer(offerId: offerId),
                as: EarnRevealOfferResponse.self
            )
            revealedCode = EarnRevealedCode(
                id: offerId,
                businessName: offer.businessName,
                code: Self.trimmed(response.code)
            )
        } catch {
            showToast("We couldn't reveal that code.", kind: .error)
        }
    }

    // MARK: - Dismissals

    public func dismissCapNotice() {
        capNotice = nil
    }

    public func dismissRevealedCode() {
        revealedCode = nil
    }

    public func dismissToast() {
        toastTask?.cancel()
        toast = nil
    }

    // MARK: - Mutation helpers

    private func updateEngagement(_ offerId: String, to engagement: EarnOfferItem.Engagement) {
        guard case let .loaded(balance, offers) = state,
              let index = offers.firstIndex(where: { $0.id == offerId })
        else { return }
        var updated = offers
        updated[index].engagement = engagement
        state = .loaded(balance: balance, offers: updated)
    }

    /// Re-reads the server's balance and swaps it into the current state.
    private func refreshBalance() async {
        let outcome = await client.perform(
            EarnOffersEndpoints.balance(),
            as: EarnBalanceResponse.self
        )
        guard case let .success(response) = outcome else { return }
        let display = Self.display(balance: response.balance)
        switch state {
        case let .loaded(_, offers):
            state = .loaded(balance: display, offers: offers)
        case .empty:
            state = .empty(balance: display)
        case .loading, .error:
            break
        }
    }

    private func showToast(_ text: String, kind: ToastKind) {
        toast = ToastMessage(text: text, kind: kind)
        toastTask?.cancel()
        toastTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            guard !Task.isCancelled else { return }
            self?.toast = nil
        }
    }
}

// MARK: - DTO → projection

extension EarnOffersViewModel {
    private static func display(balance: EarnBalanceDTO) -> EarnOffersBalance {
        EarnOffersBalance(
            total: money(balance.total),
            available: money(balance.available),
            pending: money(balance.pending),
            hasPending: balance.pending > 0
        )
    }

    private static func item(from dto: EarnOfferDTO) -> EarnOfferItem {
        let name = trimmed(dto.businessName) ?? "Local business"
        return EarnOfferItem(
            id: dto.id,
            businessName: name,
            initials: initials(explicit: dto.businessInit, name: name),
            title: trimmed(dto.offerTitle) ?? "Sponsored offer",
            subtitle: trimmed(dto.offerSubtitle),
            expiryLabel: expiryLabel(dto.expiresAt),
            payoutLabel: payoutLabel(dto.payoutAmount),
            engagement: engagement(dto)
        )
    }

    private static func engagement(_ dto: EarnOfferDTO) -> EarnOfferItem.Engagement {
        guard dto.opened || dto.transaction != nil else { return .unopened }
        return engagement(forStatus: dto.transaction?.status) ?? .pending
    }

    private static func engagement(forStatus status: String?) -> EarnOfferItem.Engagement? {
        switch (status ?? "").lowercased() {
        case "verified", "available", "paid": .earned
        case "flagged": .held
        case "pending": .pending
        default: nil
        }
    }

    // MARK: - Formatting

    private static func money(_ value: Double) -> String {
        String(format: "%.2f", value)
    }

    /// `"25¢"` under a dollar, `"$1.50"` at or above — RN renders cents
    /// for the sub-dollar payouts every seeded offer uses.
    private static func payoutLabel(_ amount: Double) -> String {
        guard amount > 0 else { return "" }
        if amount < 1 {
            return "\(Int((amount * 100).rounded()))¢"
        }
        return "$" + money(amount)
    }

    private static func expiryLabel(_ isoDate: String?) -> String {
        guard let date = parseDate(isoDate) else { return "Limited time" }
        return "Offer expires " + monthDayFormatter.string(from: date)
    }

    private static func initials(explicit: String?, name: String) -> String {
        if let explicit = trimmed(explicit) {
            return String(explicit.prefix(2)).uppercased()
        }
        let words = name.split(separator: " ").prefix(2)
        let letters = words.compactMap { $0.first.map(String.init) }
        return letters.joined().uppercased()
    }

    private static func trimmed(_ value: String?) -> String? {
        guard let value else { return nil }
        let result = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.isEmpty ? nil : result
    }

    private static func parseDate(_ value: String?) -> Date? {
        guard let value else { return nil }
        return isoFractional.date(from: value) ?? isoPlain.date(from: value)
    }

    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoPlain = ISO8601DateFormatter()

    private static let monthDayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter
    }()
}
