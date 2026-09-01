//
//  MyBusinessesViewModel.swift
//  Pantopus
//
//  A08 — "My businesses": the user's index of every business they own or
//  staff. Backed by `GET /api/businesses/my-businesses`. Bespoke screen
//  (the A08 row anatomy — category logo tile + verification check, role
//  chip, team-avatar stack, 3-cell stats band / amber pending strip —
//  exceeds the shared ListOfRows `RowModel`, so we project a dedicated
//  card model here).
//
//  Per row:
//    • 56pt category-tinted logo tile (glyph or initials) + violet
//      verification check (verified) or amber hourglass (pending)
//    • name + `<Category> · <locality>`
//    • role chip + team-avatar stack ("N on team")
//    • stats band (open chats · bookings this week · ★rating) when
//      verified, OR an amber "Verification pending" strip when not.
//
//  Stats / verification / team come from the enriched response
//  (`backend/routes/businesses.js:682`). The "Primary" badge in the
//  design is intentionally omitted — no primary-business concept exists
//  in the backend.
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class MyBusinessesViewModel {
    let title = "My businesses"

    enum ViewState: Equatable {
        case loading
        case loaded([BusinessCardModel])
        case empty
        case error(String)
    }

    private(set) var state: ViewState = .loading

    /// Count of all businesses the user owns or staffs (verified + pending),
    /// for the intro card — mirrors the A08 mockup which counts the pending
    /// row too. Nil while loading / empty.
    var introCount: Int? {
        if case let .loaded(cards) = state { return cards.count }
        return nil
    }

    private let api: APIClient
    let onOpenBusiness: (String) -> Void
    let onRegister: @Sendable () -> Void
    let onClaim: @Sendable () -> Void

    init(
        api: APIClient = .shared,
        onOpenBusiness: @escaping (String) -> Void = { _ in },
        onRegister: @escaping @Sendable () -> Void = {},
        onClaim: @escaping @Sendable () -> Void = {}
    ) {
        self.api = api
        self.onOpenBusiness = onOpenBusiness
        self.onRegister = onRegister
        self.onClaim = onClaim
    }

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    private func fetch() async {
        do {
            let response: MyBusinessesResponse = try await api.request(
                BusinessesEndpoints.myBusinesses()
            )
            let cards = response.businesses.map(BusinessCardModel.init(membership:))
            state = cards.isEmpty ? .empty : .loaded(cards)
        } catch {
            state = .error((error as? APIError)?.errorDescription ?? "Something went wrong.")
        }
    }
}

// MARK: - Card model

/// Fully-projected display row for the A08 business card. Pure value type
/// so it's trivially testable from `MyBusinessesViewModelTests`.
struct BusinessCardModel: Identifiable, Hashable {
    let id: String
    let name: String
    let category: CategoryStyle
    let categoryLabel: String?
    let locality: String
    let localityIsPlaceholder: Bool
    let logoURL: URL?
    let role: RoleStyle?
    let teamCount: Int
    let teamInitials: [String]
    let verified: Bool
    let pending: Bool
    let openChats: Int
    let bookingsThisWeek: Int
    let ratingText: String
    let reviewCount: Int

    init(membership m: BusinessMembership) {
        let business = m.business
        id = m.businessUserId
        name = business.name?.nonEmpty
            ?? business.username?.nonEmpty
            ?? "Untitled business"

        category = CategoryStyle.resolve(
            categories: m.profile?.categories,
            businessType: m.profile?.businessType
        )
        categoryLabel = category.label

        let place = [business.city, business.state]
            .compactMap { $0?.nonEmpty }
            .joined(separator: ", ")
        if place.isEmpty {
            locality = "Online only"
            localityIsPlaceholder = true
        } else {
            locality = place
            localityIsPlaceholder = false
        }

        logoURL = business.profilePictureURL.flatMap(URL.init(string:))
        role = RoleStyle.resolve(m.roleBase)

        teamCount = m.team?.count ?? 0
        teamInitials = (m.team?.members ?? []).prefix(3).map { member in
            member.initials?.nonEmpty ?? "?"
        }

        let tier = m.profile?.identityVerificationTier
        verified = BusinessCardModel.isVerified(tier: tier)
        pending = !verified

        openChats = m.stats?.openChats ?? 0
        bookingsThisWeek = m.stats?.bookingsThisWeek ?? 0

        reviewCount = business.reviewCount ?? 0
        if let rating = business.averageRating, (business.reviewCount ?? 0) > 0 {
            ratingText = String(format: "%.1f", rating)
        } else {
            ratingText = "New"
        }
    }

    /// Anything above `bi0_unverified` (and non-nil) earns the verified mark.
    static func isVerified(tier: String?) -> Bool {
        guard let tier = tier?.nonEmpty else { return false }
        return tier != "bi0_unverified"
    }
}

// MARK: - Role palette

/// Role chip styling. Owner/Admin keep the Business violet; Editor/Manager
/// borrow the Personal blue (cross-pillar ops); Staff/Viewer go neutral.
struct RoleStyle: Hashable {
    let label: String
    let icon: PantopusIcon
    let variant: StatusChipVariant

    static func resolve(_ roleBase: String?) -> RoleStyle? {
        guard let role = roleBase?.nonEmpty?.lowercased() else { return nil }
        switch role {
        case "owner":
            return RoleStyle(label: "Owner", icon: .crown, variant: .business)
        case "admin":
            return RoleStyle(label: "Admin", icon: .shieldCheck, variant: .business)
        case "manager":
            return RoleStyle(label: "Manager", icon: .briefcase, variant: .personal)
        case "editor":
            return RoleStyle(label: "Editor", icon: .briefcase, variant: .personal)
        case "staff":
            return RoleStyle(label: "Staff", icon: .user, variant: .neutral)
        case "viewer":
            return RoleStyle(label: "Viewer", icon: .user, variant: .neutral)
        default:
            return RoleStyle(label: role.capitalized, icon: .user, variant: .neutral)
        }
    }
}

// MARK: - Category palette

/// Drives the logo-tile color + glyph and the category label. Token-only
/// (no hex) per the Features hex guard — category accents map onto the
/// semantic palette.
struct CategoryStyle: Hashable {
    let label: String?
    let icon: PantopusIcon
    /// Solid tile fill (start == end keeps it token-only).
    let fill: Color

    static func resolve(categories: [String]?, businessType: String?) -> CategoryStyle {
        let raw = categories?.first { !$0.isEmpty }
            ?? businessType
        let key = raw?.lowercased() ?? ""
        let label = raw?
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
            .nonEmpty

        if key.contains("handy") || key.contains("repair") || key.contains("contractor") {
            return CategoryStyle(label: label, icon: .hammer, fill: Theme.Color.warning)
        }
        if key.contains("pet") || key.contains("dog") || key.contains("vet") {
            return CategoryStyle(label: label, icon: .pawPrint, fill: Theme.Color.error)
        }
        if key.contains("tutor") || key.contains("educat") || key.contains("class") || key.contains("school") {
            return CategoryStyle(label: label, icon: .graduationCap, fill: Theme.Color.personal)
        }
        if key.contains("clean") {
            return CategoryStyle(label: label, icon: .sparkles, fill: Theme.Color.success)
        }
        return CategoryStyle(label: label, icon: .building2, fill: Theme.Color.business)
    }
}

private extension String {
    var nonEmpty: String? {
        isEmpty ? nil : self
    }
}
