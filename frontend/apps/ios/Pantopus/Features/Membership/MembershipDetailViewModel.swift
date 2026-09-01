//
//  MembershipDetailViewModel.swift
//  Pantopus
//
//  A10.8 — Backs the fan-side membership manage screen. `load()` fetches
//  the fan's own membership from `GET /api/personas/:id/membership`
//  (`backend/routes/personaMembership.js:108`) and projects it onto the
//  existing `MembershipDetailContent`. The `MembershipSampleData` fixtures
//  remain the documented preview/test seam — they are injected only via the
//  `content:` / `slaMissed:` seeds (previews + snapshot baselines), never on
//  the live path.
//
//  Mutations, all real round-trips:
//    * Cancel   → `POST .../membership/cancel`   (`personaMembership.js:204`)
//    * Upgrade  → `POST .../membership/upgrade`  (`personaMembership.js:121`)
//                 — takes effect immediately.
//    * Downgrade→ `POST .../membership/downgrade`(`personaMembership.js:162`)
//                 — scheduled at `current_period_end`.
//    * Refund   → `POST .../membership/refund-request`
//                 (`personaMembership.js:251`) with `reason: sla_missed`.
//  The tier ladder for the picker comes from
//  `GET /api/personas/:handle/tiers` (`personas.js:1111`).
//

// swiftlint:disable type_body_length

import Foundation
import Observation

@Observable
@MainActor
public final class MembershipDetailViewModel {
    public private(set) var state: MembershipDetailState = .loading

    /// Transient error surfaced inline when a mutation round-trip fails.
    public var actionError: String?
    public private(set) var isCancelling = false

    /// Change-tier picker. `tierOptions` excludes the current rank; empty
    /// while the ladder is still loading or when the persona publishes a
    /// single tier.
    public var isTierPickerPresented = false
    public private(set) var tierOptions: [MembershipTierOption] = []
    public private(set) var isChangingTier = false
    /// Success copy after a tier change ("Downgrade scheduled — takes
    /// effect at the end of this period.").
    public private(set) var tierChangeConfirmation: String?

    /// Refund request sheet.
    public var isRefundSheetPresented = false
    public private(set) var isRequestingRefund = false
    public private(set) var refundConfirmation: String?
    public var refundError: String?

    private let api: APIClient
    private let personaId: String
    private let seededContent: MembershipDetailContent?
    private let startsSLAMissed: Bool
    private var currentTierRank: Int = 1
    private var personaHandle: String?

    /// - Parameters:
    ///   - personaId: Canonical route payload — the persona (UUID) whose
    ///     membership is being managed.
    ///   - api: Injected for tests; defaults to the shared client.
    ///   - content: Optional seed (previews / tests) — short-circuits the
    ///     fetch and renders the fixture.
    ///   - slaMissed: When `true` and no seed is supplied, renders the
    ///     refund-eligible sample frame (preview-only).
    init(
        personaId: String,
        api: APIClient = .shared,
        content: MembershipDetailContent? = nil,
        slaMissed: Bool = false
    ) {
        self.personaId = personaId
        self.api = api
        seededContent = content
        startsSLAMissed = slaMissed
    }

    public func load() async {
        state = .loading
        actionError = nil

        // Preview/test seam: a seeded fixture (or the slaMissed flag) renders
        // the deterministic sample without touching the network.
        if let seededContent {
            state = seededContent.slaAlert != nil ? .slaMissed(seededContent) : .populated(seededContent)
            return
        }
        if startsSLAMissed {
            state = .slaMissed(MembershipSampleData.slaMissed)
            return
        }

        do {
            let response: PersonaMembershipResponse = try await api.request(
                MembershipEndpoints.membership(personaId: personaId)
            )
            guard let membership = response.membership, membership.persona != nil else {
                state = .error(message: "We couldn't find your membership.")
                return
            }
            apply(membership)
            await loadTierLadder()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load membership."
            state = .error(message: message)
        }
    }

    public func refresh() async {
        await load()
    }

    /// Settle the freshly-read membership into state + the picker inputs.
    private func apply(_ membership: PersonaMembershipDTO) {
        currentTierRank = membership.tier?.rank ?? 1
        personaHandle = membership.persona?.handle
        state = .populated(Self.project(membership, personaId: personaId))
    }

    /// Public tier ladder for the picker. Non-blocking: a failure here
    /// leaves the picker empty rather than failing the whole screen
    /// (mirrors RN, which swallows the tier-list error).
    private func loadTierLadder() async {
        guard let personaHandle else {
            tierOptions = []
            return
        }
        do {
            let response: PersonaPublicTiersResponse = try await api.request(
                MembershipEndpoints.publicTiers(handle: personaHandle)
            )
            tierOptions = Self.tierOptions(response.tiers, currentRank: currentTierRank)
        } catch {
            tierOptions = []
        }
    }

    // MARK: - Change tier

    public func presentTierPicker() {
        actionError = nil
        tierChangeConfirmation = nil
        isTierPickerPresented = true
    }

    /// Upgrade (immediate) or downgrade (scheduled at period end),
    /// selected by comparing the target rank with the current one — the
    /// backend enforces the same split across two distinct routes.
    public func changeTier(to option: MembershipTierOption) async {
        guard !isChangingTier, option.rank != currentTierRank else { return }
        isChangingTier = true
        actionError = nil
        tierChangeConfirmation = nil
        defer { isChangingTier = false }
        let endpoint = option.direction == .upgrade
            ? MembershipEndpoints.upgrade(personaId: personaId, tierRank: option.rank)
            : MembershipEndpoints.downgrade(personaId: personaId, tierRank: option.rank)
        do {
            let response: PersonaMembershipResponse = try await api.request(endpoint)
            isTierPickerPresented = false
            tierChangeConfirmation = option.direction == .upgrade
                ? "Tier upgraded."
                : "Downgrade scheduled — takes effect at the end of this period."
            if let membership = response.membership, membership.persona != nil {
                apply(membership)
                // Re-derive the ladder so directions flip around the new rank.
                await loadTierLadder()
            } else {
                await load()
            }
        } catch {
            actionError = (error as? APIError)?.errorDescription
                ?? "Couldn't change tier. Please try again."
        }
    }

    // MARK: - Refund request

    public func presentRefundSheet() {
        refundError = nil
        refundConfirmation = nil
        isRefundSheetPresented = true
    }

    /// SLA-missed refund. The backend re-validates that one of the fan's
    /// threads is genuinely past its reply window and answers
    /// `400 no_sla_missed_thread` when it isn't — surfaced verbatim so the
    /// fan understands why nothing was refunded.
    public func requestRefund() async {
        guard !isRequestingRefund else { return }
        isRequestingRefund = true
        refundError = nil
        defer { isRequestingRefund = false }
        do {
            let response: PersonaMembershipResponse = try await api.request(
                MembershipEndpoints.refundRequest(
                    personaId: personaId,
                    body: MembershipRefundRequestBody(reason: "sla_missed")
                )
            )
            isRefundSheetPresented = false
            refundConfirmation =
                "Refund requested. You'll get a confirmation email shortly."
            if let membership = response.membership, membership.persona != nil {
                apply(membership)
            } else {
                await load()
            }
        } catch {
            refundError = Self.refundErrorMessage(error)
        }
    }

    static func refundErrorMessage(_ error: any Error) -> String {
        guard let apiError = error as? APIError else { return "Couldn't request a refund." }
        switch apiError {
        case let .clientError(status, message):
            if status == 409 {
                return "You've already requested a refund for this membership."
            }
            return APIError.friendlyClientMessage(message) ?? "Couldn't request a refund."
        default:
            return apiError.errorDescription ?? "Couldn't request a refund."
        }
    }

    /// "Give it a week" — drop the SLA banner and settle back to the happy
    /// path. The gentle alternative to a refund; never a guilt-trip.
    public func dismissSLAAlert() {
        guard case let .slaMissed(content) = state else { return }
        state = .populated(content.clearingSLAAlert())
    }

    /// Single-tap cancel. Returns `true` once the backend confirms so the
    /// host can advance to its cancellation screen. No charge (see header).
    /// On failure surfaces `actionError` inline and stays put.
    @discardableResult
    public func cancel() async -> Bool {
        guard !isCancelling else { return false }
        isCancelling = true
        actionError = nil
        defer { isCancelling = false }
        do {
            _ = try await api.request(
                MembershipEndpoints.cancelMembership(personaId: personaId),
                as: PersonaMembershipResponse.self
            )
            return true
        } catch {
            actionError = (error as? APIError)?.errorDescription
                ?? "Couldn't cancel right now. Please try again."
            return false
        }
    }

    // MARK: - Projection

    static func project(_ dto: PersonaMembershipDTO, personaId: String = "") -> MembershipDetailContent {
        MembershipDetailContent(
            persona: projectPersona(dto.persona),
            tier: MembershipTier(rank: dto.tier?.rank),
            priceLabel: priceLabel(cents: dto.tier?.priceCents, currency: dto.tier?.currency),
            periodLabel: periodLabel(interval: dto.tier?.billingInterval),
            renewalLabel: renewalLabel(end: dto.currentPeriodEnd, cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false),
            // Payment-method detail isn't on the membership read (Phase 3,
            // Stripe). Surface an honest, non-fabricated descriptor.
            paymentLabel: "Managed by Stripe",
            benefits: benefits(from: dto.tier),
            policyFootnote: MembershipSampleData.policyFootnote,
            slaAlert: nil,
            personaId: dto.persona?.id ?? personaId,
            inbox: MembershipInboxCard(
                remainingThreads: dto.quotaRemaining?.msgThreads,
                threadsPerPeriod: dto.tier?.msgThreadsPerPeriod
            ),
            hasScheduledTierChange: dto.scheduledTierChange?.tierId != nil,
            isTerminal: ["canceled", "expired"].contains(dto.status ?? ""),
            cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false
        )
    }

    /// Ladder rows for the change-tier picker — current rank removed,
    /// direction derived from the rank comparison so the sheet can state
    /// "Takes effect immediately" vs "Scheduled for the end of this period".
    static func tierOptions(
        _ tiers: [PersonaPublicTierDTO],
        currentRank: Int
    ) -> [MembershipTierOption] {
        tiers
            .filter { $0.rank != currentRank }
            .sorted { $0.rank < $1.rank }
            .map { tier in
                MembershipTierOption(
                    id: tier.id,
                    rank: tier.rank,
                    name: tier.name ?? "Tier \(tier.rank)",
                    priceLabel: tierPriceLabel(tier),
                    direction: tier.rank > currentRank ? .upgrade : .downgrade
                )
            }
    }

    static func tierPriceLabel(_ tier: PersonaPublicTierDTO) -> String {
        let price = priceLabel(cents: tier.priceCents, currency: tier.currency)
        if price == "Free" { return price }
        return "\(price) / \(periodLabel(interval: tier.billingInterval))"
    }

    private static func projectPersona(_ dto: MembershipPersonaDTO?) -> MembershipPersona {
        let name = dto?.displayName ?? dto?.handle ?? "Creator"
        return MembershipPersona(
            id: dto?.id ?? "",
            name: name,
            initials: initials(from: name),
            subtitle: subtitle(
                category: dto?.category,
                audienceLabel: dto?.audienceLabel,
                followerCount: dto?.followerCount
            ),
            pillar: .business,
            pillarLabel: "Creator",
            verified: dto?.credential?.status == "verified"
        )
    }

    private static func initials(from name: String) -> String {
        let chars = name.split(separator: " ").prefix(2).compactMap(\.first).map(String.init)
        return chars.joined().uppercased()
    }

    private static func subtitle(category: String?, audienceLabel: String?, followerCount: Int?) -> String {
        var parts: [String] = []
        if let category, !category.isEmpty { parts.append(category.capitalized) }
        if let followerCount {
            parts.append("\(followerCount.formatted()) \(audienceLabel ?? "members")")
        }
        return parts.joined(separator: " · ")
    }

    private static func priceLabel(cents: Int?, currency: String?) -> String {
        guard let cents, cents > 0 else { return "Free" }
        let symbol = if let currency, currency.lowercased() != "usd" {
            "\(currency.uppercased()) "
        } else {
            "$"
        }
        if cents % 100 == 0 { return "\(symbol)\(cents / 100)" }
        return String(format: "\(symbol)%.2f", Double(cents) / 100.0)
    }

    private static func periodLabel(interval: String?) -> String {
        switch interval {
        case "year", "yearly", "annual": "year"
        case "week", "weekly": "week"
        default: "month"
        }
    }

    private static func renewalLabel(end iso: String?, cancelAtPeriodEnd: Bool) -> String {
        guard let iso, let date = parseDate(iso) else {
            return cancelAtPeriodEnd ? "Cancels at the end of this period" : "Renews automatically"
        }
        let dateStr = date.formatted(.dateTime.month(.abbreviated).day())
        if cancelAtPeriodEnd { return "Cancels on \(dateStr)" }
        let days = max(0, Calendar.current.dateComponents([.day], from: Date(), to: date).day ?? 0)
        return "Renews on \(dateStr) · \(days) days from now"
    }

    private static func parseDate(_ iso: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: iso)
    }

    /// Benefit rows derived from the tier's perk fields — real data from the
    /// membership read, not fabricated. Empty when the tier carries no perks.
    private static func benefits(from tier: MembershipTierDTO?) -> [MembershipBenefit] {
        guard let tier else { return [] }
        var rows: [MembershipBenefit] = []
        if let threads = tier.msgThreadsPerPeriod, threads != 0 {
            rows.append(
                MembershipBenefit(
                    id: "threads",
                    icon: .messageCircle,
                    label: "Direct message threads",
                    meta: threads < 0 ? "Unlimited" : "\(threads) per period"
                )
            )
        }
        if tier.creatorCanInitiateDm == true {
            rows.append(
                MembershipBenefit(
                    id: "creatorDm",
                    icon: .mail,
                    label: "Creator can message you",
                    meta: "Replies land in your inbox"
                )
            )
        }
        if let policy = tier.replyPolicy, !policy.isEmpty {
            rows.append(
                MembershipBenefit(
                    id: "replyPolicy",
                    icon: .messageCircle,
                    label: "Reply policy",
                    meta: policy.replacingOccurrences(of: "_", with: " ").capitalized
                )
            )
        }
        return rows
    }
}

private extension MembershipTier {
    /// Map the backend tier rank (1–4) onto the fan-facing 3-rung ladder.
    /// Rank 4 (Direct) folds into Gold — the membership card models only
    /// Bronze / Silver / Gold paper-card treatments.
    init(rank: Int?) {
        switch rank ?? 1 {
        case ...1: self = .bronze
        case 2: self = .silver
        default: self = .gold
        }
    }
}
