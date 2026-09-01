//
//  HomeClaimReviewViewModel.swift
//  Pantopus
//
//  H6 — Per-home **owner** claim review. This is NOT the platform-admin
//  queue in `Features/ReviewClaims/*` (that one reads
//  `/api/admin/claims*`); this screen is what a home owner sees when
//  someone claims their address.
//
//  Two claim collections feed it, and they are intentionally kept apart:
//    - Ownership claims  → `GET /api/homes/:id/ownership-claims`
//                          (`backend/routes/homeOwnership.js:490`)
//                          + `…/compare` (`homeOwnership.js:536`)
//    - Residency claims  → `GET /api/homes/:id/claims`
//                          (`backend/routes/home.js:6716`)
//
//  Mirrors RN `src/app/homes/[id]/owners/review-claim.tsx`.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Observation
import SwiftUI

// MARK: - Projection models

/// Which claim collection the screen is currently showing.
public enum HomeClaimReviewTab: String, Sendable, CaseIterable, Hashable {
    case ownership
    case residency
    case compare
}

/// Which action row an ownership claim gets. Mirrors the RN branch at
/// `review-claim.tsx:258-315`.
public enum HomeClaimReviewActionMode: Sendable, Equatable, Hashable {
    /// Verified household authority resolving a newcomer:
    /// invite / continue review / flag unknown person.
    case relationship
    /// Claim already sits on the challenge path — owners can't decide it.
    case adminReviewRequired
    /// Plain approve / reject / flag verdict.
    case verdict
}

/// One ownership claim row.
public struct HomeClaimReviewOwnershipItem: Sendable, Equatable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let initials: String
    public let subtitle: String?
    /// Small pills: claim type, strength, routing classification.
    public let metaChips: [String]
    public let accountAgeLabel: String?
    public let methodLabel: String?
    public let riskLabel: String?
    public let evidenceLabel: String?
    public let submittedLabel: String?
    public let isChallenged: Bool
    public let claimType: String
    public let actionMode: HomeClaimReviewActionMode

    /// "Invite as owner" vs plain "Invite" — RN `review-claim.tsx:266`.
    public var inviteTitle: String {
        claimType == "owner" ? "Invite as owner" : "Invite"
    }
}

/// One residency claim row.
public struct HomeClaimReviewResidencyItem: Sendable, Equatable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let initials: String
    public let roleLabel: String
    public let addressLabel: String?
    public let ageLabel: String?
}

/// One column entry in the side-by-side compare view.
public struct HomeClaimReviewPartyCard: Sendable, Equatable, Hashable, Identifiable {
    public let id: String
    public let name: String
    public let initials: String
    public let lines: [String]
}

/// Side-by-side incumbent-vs-challenger payload
/// (`GET /api/homes/:id/ownership-claims/compare`).
public struct HomeClaimReviewComparison: Sendable, Equatable, Hashable {
    public let homeTitle: String
    public let resolutionLabel: String?
    public let hasVerifiedOwner: Bool
    public let incumbents: [HomeClaimReviewPartyCard]
    public let challengers: [HomeClaimReviewPartyCard]
}

/// Everything the loaded screen renders.
public struct HomeClaimReviewData: Sendable, Equatable, Hashable {
    public let ownership: [HomeClaimReviewOwnershipItem]
    public let residency: [HomeClaimReviewResidencyItem]
    public let comparison: HomeClaimReviewComparison?
}

/// Screen state. Four-state rule: loading / empty / loaded / error.
public enum HomeClaimReviewState: Sendable, Equatable {
    case loading
    case empty
    case loaded(HomeClaimReviewData)
    case error(message: String)
}

// MARK: - View model

/// Drives `HomeClaimReviewView`.
@Observable
@MainActor
public final class HomeClaimReviewViewModel {
    /// Reviewable legacy states for the non-comparison fallback list —
    /// mirrors RN `review-claim.tsx:175-177` and the backend's
    /// `reviewableStates` guard (`homeOwnership.js:692`).
    static let pendingLegacyStates: Set<String> = [
        "submitted", "pending_review", "pending_challenge_window", "needs_more_info"
    ]

    /// Comparison phases the owner still has a say in — RN
    /// `review-claim.tsx:172-174`.
    static let pendingPhases: Set<String> = [
        "initiated", "evidence_submitted", "under_review", "challenged"
    ]

    /// Phases where a verified incumbent can offer a relationship
    /// resolution instead of a verdict — RN `review-claim.tsx:258`.
    static let relationshipPhases: Set<String> = [
        "initiated", "evidence_submitted", "under_review"
    ]

    public private(set) var state: HomeClaimReviewState = .loading
    /// `"<claimId>:<action>"` while a mutation is in flight, so the row
    /// can swap its action row for a spinner (RN `actionLoading`).
    public private(set) var actionLoading: String?
    public private(set) var toast: ToastMessage?

    /// Selected tab. `compare` is only reachable when the comparison
    /// payload resolved.
    public var selectedTab: HomeClaimReviewTab = .ownership

    let homeId: String
    private let api: APIClient
    private var loadedOnce = false

    init(homeId: String, api: APIClient = .shared) {
        self.homeId = homeId
        self.api = api
    }

    // MARK: - Load

    public func load() async {
        guard !loadedOnce else { return }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    public func clearToast() {
        toast = nil
    }

    /// True when the comparison payload resolved, gating the third tab.
    public var hasComparison: Bool {
        if case let .loaded(data) = state { return data.comparison != nil }
        return false
    }

    public var ownershipCount: Int {
        if case let .loaded(data) = state { return data.ownership.count }
        return 0
    }

    public var residencyCount: Int {
        if case let .loaded(data) = state { return data.residency.count }
        return 0
    }

    // MARK: - Mutations

    /// `POST /api/homes/:id/ownership-claims/:claimId/review`
    /// (`backend/routes/homeOwnership.js:665`).
    public func review(claimId: String, action: HomeClaimReviewVerdict) async {
        actionLoading = "\(claimId):\(action.rawValue)"
        defer { actionLoading = nil }
        do {
            let _: HomeOwnershipClaimActionResponse = try await api.request(
                HomeClaimReviewEndpoints.reviewOwnershipClaim(
                    homeId: homeId,
                    claimId: claimId,
                    request: HomeOwnershipClaimReviewRequest(action: action.rawValue)
                )
            )
            toast = ToastMessage(text: action.doneCopy, kind: .success)
            await fetch()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription ?? "Failed to review claim",
                kind: .error
            )
        }
    }

    /// `POST /api/homes/:id/ownership-claims/:claimId/resolve-relationship`
    /// (`backend/routes/homeOwnership.js:1014`).
    public func resolveRelationship(
        claimId: String,
        action: HomeClaimRelationshipAction
    ) async {
        actionLoading = "\(claimId):\(action.rawValue)"
        defer { actionLoading = nil }
        do {
            let _: HomeOwnershipClaimActionResponse = try await api.request(
                HomeClaimReviewEndpoints.resolveOwnershipClaimRelationship(
                    homeId: homeId,
                    claimId: claimId,
                    request: HomeClaimRelationshipResolveRequest(action: action.rawValue)
                )
            )
            toast = ToastMessage(
                text: action == .inviteToHousehold ? "Invitation sent." : "Claim updated.",
                kind: .success
            )
            await fetch()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? "Failed to update claimant relationship",
                kind: .error
            )
        }
    }

    /// `POST /api/homes/:id/claim/:claimId/approve|reject`
    /// (`backend/routes/home.js:6752` / `:6838`).
    public func reviewResidency(claimId: String, approve: Bool) async {
        actionLoading = claimId
        defer { actionLoading = nil }
        do {
            let endpoint = approve
                ? HomeClaimReviewEndpoints.approveResidencyClaim(homeId: homeId, claimId: claimId)
                : HomeClaimReviewEndpoints.rejectResidencyClaim(homeId: homeId, claimId: claimId)
            let _: HomeResidencyClaimActionResponse = try await api.request(endpoint)
            toast = ToastMessage(
                text: approve ? "Claim approved" : "Claim rejected",
                kind: .success
            )
            await fetch()
        } catch {
            toast = ToastMessage(
                text: (error as? APIError)?.errorDescription
                    ?? (approve ? "Failed to approve claim" : "Failed to reject claim"),
                kind: .error
            )
        }
    }

    // MARK: - Fetch

    /// Three independent reads, all tolerated individually — the
    /// ownership list is gated on `ownership.manage`, the residency list
    /// on `members.manage`, and `compare` additionally sits behind a
    /// server feature flag. RN uses `Promise.allSettled` for the same
    /// reason (`review-claim.tsx:34`). Only a total wipe-out surfaces
    /// the error state.
    private func fetch() async {
        async let ownershipTask: HomeOwnershipClaimsResponse? = optional {
            try await self.api.request(
                HomeClaimReviewEndpoints.ownershipClaims(homeId: self.homeId)
            )
        }
        async let residencyTask: HomeResidencyClaimsResponse? = optional {
            try await self.api.request(
                HomeClaimReviewEndpoints.residencyClaims(homeId: self.homeId)
            )
        }
        async let comparisonTask: HomeClaimComparisonDTO? = optional {
            try await self.api.request(
                HomeClaimReviewEndpoints.ownershipClaimComparison(homeId: self.homeId)
            )
        }

        let ownershipResponse = await ownershipTask
        let residencyResponse = await residencyTask
        let comparisonResponse = await comparisonTask

        guard ownershipResponse != nil || residencyResponse != nil || comparisonResponse != nil
        else {
            state = .error(message: "We couldn't load the claims on this home.")
            return
        }
        loadedOnce = true

        let ownership = Self.ownershipItems(
            comparison: comparisonResponse,
            fallback: ownershipResponse?.claims ?? []
        )
        let residency = Self.residencyItems(from: residencyResponse?.claims ?? [])
        let comparison = comparisonResponse.map { Self.comparison(from: $0) }

        if ownership.isEmpty, residency.isEmpty, comparison == nil {
            state = .empty
            selectedTab = .ownership
            return
        }
        if comparison == nil, selectedTab == .compare {
            selectedTab = .ownership
        }
        state = .loaded(
            HomeClaimReviewData(
                ownership: ownership,
                residency: residency,
                comparison: comparison
            )
        )
    }

    /// Swallow a per-request failure so one 403/404 doesn't wipe the
    /// whole screen — mirrors RN's `Promise.allSettled`.
    private func optional<T: Sendable>(
        _ operation: @Sendable () async throws -> T
    ) async -> T? {
        do {
            return try await operation()
        } catch {
            return nil
        }
    }

    // MARK: - Projection

    /// Prefer the comparison payload (hydrated claimants + phase-v2
    /// routing); fall back to the masked list. RN does the same at
    /// `review-claim.tsx:171-177`.
    static func ownershipItems(
        comparison: HomeClaimComparisonDTO?,
        fallback: [HomeOwnershipClaimDTO]
    ) -> [HomeClaimReviewOwnershipItem] {
        if let comparison, !comparison.claims.isEmpty {
            let hasVerifiedOwner = comparison.incumbent?.hasVerifiedOwner ?? false
            return comparison.claims
                .filter { pendingPhases.contains($0.claimPhaseV2 ?? "") }
                .map { item(from: $0, hasVerifiedOwner: hasVerifiedOwner) }
        }
        return fallback
            .filter { pendingLegacyStates.contains($0.state) }
            .map { item(from: $0) }
    }

    private static func item(
        from claim: HomeClaimComparisonClaimDTO,
        hasVerifiedOwner: Bool
    ) -> HomeClaimReviewOwnershipItem {
        let phase = claim.claimPhaseV2 ?? ""
        let claimType = claim.claimType ?? "owner"
        let isChallenged = phase == "challenged"
        let mode: HomeClaimReviewActionMode = {
            if hasVerifiedOwner, relationshipPhases.contains(phase) { return .relationship }
            if isChallenged { return .adminReviewRequired }
            return .verdict
        }()
        let name = displayName(
            name: claim.claimant?.name,
            username: claim.claimant?.username
        )
        var chips: [String] = [claimType == "owner" ? "Owner claim" : humanise(claimType)]
        if let strength = claim.claimStrength?.nilIfEmpty {
            chips.append("Strength: \(humanise(strength))")
        }
        if let routing = claim.routingClassification?.nilIfEmpty {
            chips.append("Route: \(humanise(routing))")
        }
        return HomeClaimReviewOwnershipItem(
            id: claim.id,
            displayName: name,
            initials: initials(for: name),
            subtitle: claim.claimant?.email?.nilIfEmpty,
            metaChips: chips,
            accountAgeLabel: accountAgeLabel(from: claim.claimant?.createdAt),
            methodLabel: claim.method.flatMap { methodLabel($0) },
            riskLabel: riskLabel(claim.riskScore),
            evidenceLabel: evidenceLabel(claim.evidence?.count ?? 0),
            submittedLabel: submittedLabel(claim.createdAt),
            isChallenged: isChallenged,
            claimType: claimType,
            actionMode: mode
        )
    }

    private static func item(from claim: HomeOwnershipClaimDTO) -> HomeClaimReviewOwnershipItem {
        let claimType = claim.claimType ?? "owner"
        // The list endpoint masks the claimant outright
        // (`homeOwnership.js:513`), so there is no name to render.
        let name = "Masked claimant"
        var chips: [String] = [claimType == "owner" ? "Owner claim" : humanise(claimType)]
        chips.append("Status: \(humanise(claim.state))")
        return HomeClaimReviewOwnershipItem(
            id: claim.id,
            displayName: name,
            initials: "?",
            subtitle: nil,
            metaChips: chips,
            accountAgeLabel: claim.claimant?.accountAgeDays.map { "Account \($0)d old" },
            methodLabel: (claim.claimant?.method ?? claim.method).flatMap { methodLabel($0) },
            riskLabel: riskLabel(claim.claimant?.riskScore ?? claim.riskScore),
            evidenceLabel: evidenceLabel(claim.evidence?.count ?? 0),
            submittedLabel: submittedLabel(claim.createdAt),
            isChallenged: false,
            claimType: claimType,
            actionMode: .verdict
        )
    }

    static func residencyItems(
        from claims: [HomeResidencyClaimDTO]
    ) -> [HomeClaimReviewResidencyItem] {
        claims
            .filter { $0.status == "pending" }
            .map { claim in
                let name = displayName(
                    name: claim.claimant?.name,
                    username: claim.claimant?.username,
                    fallback: "User"
                )
                return HomeClaimReviewResidencyItem(
                    id: claim.id,
                    displayName: name,
                    initials: initials(for: name),
                    roleLabel: "Requesting: \(roleLabel(claim.claimedRole))",
                    addressLabel: claim.claimedAddress?.nilIfEmpty,
                    ageLabel: dayAgeLabel(claim.createdAt)
                )
            }
    }

    static func comparison(from dto: HomeClaimComparisonDTO) -> HomeClaimReviewComparison {
        let incumbents = (dto.incumbent?.owners ?? []).map { owner -> HomeClaimReviewPartyCard in
            let name = displayName(
                name: owner.user?.name,
                username: owner.user?.username,
                fallback: "Owner"
            )
            var lines: [String] = []
            if owner.isPrimaryOwner == true { lines.append("Primary owner") }
            if let tier = owner.verificationTier?.nilIfEmpty {
                lines.append("Tier: \(humanise(tier))")
            }
            if let via = owner.addedVia?.nilIfEmpty { lines.append("Added via \(humanise(via))") }
            if let since = shortDate(owner.createdAt) { lines.append("Owner since \(since)") }
            return HomeClaimReviewPartyCard(
                id: owner.id,
                name: name,
                initials: initials(for: name),
                lines: lines
            )
        }
        let challengers = dto.claims.map { claim -> HomeClaimReviewPartyCard in
            let name = displayName(
                name: claim.claimant?.name,
                username: claim.claimant?.username
            )
            var lines: [String] = []
            if let phase = claim.claimPhaseV2?.nilIfEmpty { lines.append(humanise(phase)) }
            if let strength = claim.claimStrength?.nilIfEmpty {
                lines.append("Strength: \(humanise(strength))")
            }
            let evidenceCount = claim.evidence?.count ?? 0
            lines.append(evidenceCount == 1 ? "1 evidence file" : "\(evidenceCount) evidence files")
            if let submitted = submittedLabel(claim.createdAt) { lines.append(submitted) }
            return HomeClaimReviewPartyCard(
                id: claim.id,
                name: name,
                initials: initials(for: name),
                lines: lines
            )
        }
        let homeTitle = dto.home?.name?.nilIfEmpty
            ?? dto.home?.address?.nilIfEmpty
            ?? "This home"
        let resolutionRaw = (dto.householdResolutionState
            ?? dto.home?.householdResolutionState)?.nilIfEmpty
        return HomeClaimReviewComparison(
            homeTitle: homeTitle,
            resolutionLabel: resolutionRaw.map { humanise($0) },
            hasVerifiedOwner: dto.incumbent?.hasVerifiedOwner ?? false,
            incumbents: incumbents,
            challengers: challengers
        )
    }

    // MARK: - Formatting helpers

    static func displayName(
        name: String?,
        username: String?,
        fallback: String = "Claimant"
    ) -> String {
        if let name = name?.nilIfEmpty { return name }
        if let username = username?.nilIfEmpty { return "@\(username)" }
        return fallback
    }

    static func initials(for name: String) -> String {
        let cleaned = name.hasPrefix("@") ? String(name.dropFirst()) : name
        let parts = cleaned
            .split(separator: " ")
            .compactMap { $0.first.map(String.init) }
        guard !parts.isEmpty else { return "?" }
        return parts.prefix(2).joined().uppercased()
    }

    /// `owner_claim` → `owner claim`. Backend enums are snake_case
    /// everywhere; RN does the same replace (`review-claim.tsx:240`).
    static func humanise(_ raw: String) -> String {
        raw.replacingOccurrences(of: "_", with: " ")
    }

    static func roleLabel(_ raw: String?) -> String {
        switch raw {
        case "owner": "Owner"
        case "renter": "Renter"
        case "household": "Household"
        case "property_manager": "Property Mgr"
        case "guest": "Guest"
        case "member": "Member"
        default: "Member"
        }
    }

    static func methodLabel(_ raw: String) -> String? {
        switch raw {
        case "postcard": "Postcard"
        case "doc_upload": "Document upload"
        case "fast_track": "Fast-track invite"
        case "id_verification": "ID verification"
        default: raw.isEmpty ? nil : humanise(raw).capitalized
        }
    }

    static func riskLabel(_ score: Double?) -> String? {
        guard let score else { return nil }
        return "Risk \(Int(score.rounded()))"
    }

    static func evidenceLabel(_ count: Int) -> String? {
        guard count > 0 else { return nil }
        return count == 1 ? "1 file" : "\(count) files"
    }

    static func accountAgeLabel(from iso: String?) -> String? {
        guard let days = dayDelta(from: iso) else { return nil }
        return "Account \(days)d old"
    }

    static func dayAgeLabel(_ iso: String?) -> String? {
        guard let days = dayDelta(from: iso) else { return nil }
        return "\(days)d ago"
    }

    /// Day-granular so iOS and Android read identically.
    static func submittedLabel(_ iso: String?) -> String? {
        guard let days = dayDelta(from: iso) else { return nil }
        switch days {
        case 0: return "Submitted today"
        case 1: return "Submitted 1d ago"
        default: return "Submitted \(days)d ago"
        }
    }

    static func shortDate(_ iso: String?) -> String? {
        guard let iso, let date = parseDate(iso) else { return nil }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        return formatter.string(from: date)
    }

    private static func dayDelta(from iso: String?) -> Int? {
        guard let iso, let date = parseDate(iso) else { return nil }
        return max(0, Int(Date().timeIntervalSince(date) / 86400))
    }

    private static func parseDate(_ iso: String) -> Date? {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }
}

/// `action` values accepted by `reviewClaimSchema`
/// (`backend/routes/homeOwnership.js:39`).
public enum HomeClaimReviewVerdict: String, Sendable, CaseIterable {
    case approve
    case reject
    case flag

    var title: String {
        switch self {
        case .approve: "Approve"
        case .reject: "Reject"
        case .flag: "Flag as suspicious"
        }
    }

    /// RN confirm body — `review-claim.tsx:65`.
    var confirmBody: String {
        "Are you sure you want to \(rawValue) this claim?"
    }

    /// RN emits `Claim ${action}ed` verbatim, which renders "approveed".
    /// Fixed here (and mirrored on Android) rather than mirroring a typo.
    var doneCopy: String {
        switch self {
        case .approve: "Claim approved"
        case .reject: "Claim rejected"
        case .flag: "Claim flagged for review"
        }
    }

    var isDestructive: Bool {
        self != .approve
    }
}

/// `action` values accepted by `resolveRelationshipSchema`
/// (`backend/routes/homeOwnership.js:54`).
public enum HomeClaimRelationshipAction: String, Sendable, CaseIterable {
    case inviteToHousehold = "invite_to_household"
    case declineRelationship = "decline_relationship"
    case flagUnknownPerson = "flag_unknown_person"

    /// RN titles — `review-claim.tsx:94-98`.
    func title(isOwnerClaim: Bool) -> String {
        switch self {
        case .inviteToHousehold: isOwnerClaim ? "Invite As Owner" : "Invite To Household"
        case .declineRelationship: "Let Review Continue"
        case .flagUnknownPerson: "Flag Unknown Person"
        }
    }

    /// RN copy — `review-claim.tsx:99-105`.
    func body(isOwnerClaim: Bool) -> String {
        switch self {
        case .inviteToHousehold:
            isOwnerClaim
                ? "This sends a co-owner invitation. After identity confirmation, "
                + "they become a verified owner of this home."
                : "This sends the claimant a household invite so they can merge "
                + "into the home after identity confirmation."
        case .declineRelationship:
            "This leaves the claim on its normal review path without changing its state."
        case .flagUnknownPerson:
            "This flags the claimant for admin review."
        }
    }

    var isDestructive: Bool {
        self == .flagUnknownPerson
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
