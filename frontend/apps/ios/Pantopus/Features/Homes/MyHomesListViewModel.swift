//
//  MyHomesListViewModel.swift
//  Pantopus
//
//  Backs `MyHomesListView`. Fetches `GET /api/homes/my-homes` and
//  projects each home into the avatar-first List-of-Rows row shape
//  defined for T6.3f / P14:
//
//    • Leading — identity-green avatar tile (initials from address)
//    • Title   — nickname or formatted address
//    • Subtitle — role chip + locality (joined via "·")
//    • Body    — "Active home" home-tinted chip on the primary-owner row
//    • Trailing — chevron (tap → home dashboard)
//
//  Plus a `BannerConfig` intro card ("homes you belong to") and a 60pt
//  secondary-create FAB tinted home green.
//

import Foundation
import Observation
import SwiftUI

/// Outbound event the host view reacts to (confirm alerts).
enum MyHomesListEvent: Equatable {
    /// Owner tapped the row kebab on a home they are allowed to delete.
    case confirmDelete(homeId: String, name: String)
}

/// ViewModel for the "My homes" list.
@Observable
@MainActor
final class MyHomesListViewModel: ListOfRowsDataSource {
    let title = "My homes"
    /// A12.1 discovery entry point — mirrors RN's `/homes/find` route,
    /// which is how a user joins a home someone else already created.
    var topBarAction: TopBarAction? {
        TopBarAction(
            icon: .search,
            accessibilityLabel: "Find or add a home",
            handler: onFindHome
        )
    }

    let tabs: [ListOfRowsTab] = []
    var selectedTab: String = ""
    var fab: FABAction? {
        FABAction(
            icon: .plusCircle,
            accessibilityLabel: "Claim a home",
            variant: .secondaryCreate,
            tint: .home,
            handler: onAddHome
        )
    }

    var banner: BannerConfig? {
        guard case let .loaded(sections, _) = state,
              let count = sections.first?.rows.count,
              count > 0
        else {
            return nil
        }
        return BannerConfig(
            icon: .home,
            title: count == 1 ? "1 home you belong to" : "\(count) homes you belong to",
            subtitle: "Tap any home to jump into that household",
            tint: .home
        )
    }

    private(set) var state: ListOfRowsState = .loading

    /// Event the host view reacts to. Set by row kebab handlers; cleared
    /// by the view after dispatching.
    var pendingEvent: MyHomesListEvent?

    /// Surfaced by the view as an inline error banner when a delete
    /// fails (403 `DELETE_HOME_NOT_PRIMARY`, network, …).
    var actionError: String?

    /// Home id whose delete request is in flight — the view disables the
    /// confirm button while set.
    private(set) var deletingHomeId: String?

    private let api: APIClient
    private let onOpenHome: (String) -> Void
    private let onAddHome: @Sendable () -> Void
    /// Route to the ownership-evidence wizard for a home whose owner
    /// claim is still pending.
    private let onUploadOwnershipEvidence: (@Sendable (String) -> Void)?
    /// Route to the residency-verification variant of the evidence
    /// wizard for a home whose occupancy isn't verified yet.
    private let onVerifyResidency: (@Sendable (String) -> Void)?
    /// Route to the A12.1 "Find or Add Home" discovery surface.
    private let onFindHome: @Sendable () -> Void

    init(
        api: APIClient = .shared,
        onOpenHome: @escaping (String) -> Void = { _ in },
        onAddHome: @escaping @Sendable () -> Void = {},
        onFindHome: @escaping @Sendable () -> Void = {},
        onUploadOwnershipEvidence: (@Sendable (String) -> Void)? = nil,
        onVerifyResidency: (@Sendable (String) -> Void)? = nil
    ) {
        self.api = api
        self.onOpenHome = onOpenHome
        self.onAddHome = onAddHome
        self.onFindHome = onFindHome
        self.onUploadOwnershipEvidence = onUploadOwnershipEvidence
        self.onVerifyResidency = onVerifyResidency
    }

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {} // `my-homes` is not paginated.

    // MARK: - Mutations

    /// `DELETE /api/homes/:id` — route `backend/routes/home.js:3191`.
    /// Only reachable from rows whose `can_delete_home` flag is true; the
    /// confirm alert has already fired by the time this runs. Awaited (not
    /// optimistic) so a 403 leaves the row in place.
    func deleteHome(homeId: String) async {
        guard deletingHomeId == nil else { return }
        deletingHomeId = homeId
        actionError = nil
        defer { deletingHomeId = nil }
        do {
            let _: DeleteHomeResponse = try await api.request(
                HomeAdminEndpoints.deleteHome(homeId: homeId)
            )
            await fetch()
        } catch {
            actionError = (error as? APIError)?.errorDescription ?? "Failed to delete"
        }
    }

    private func fetch() async {
        do {
            let response: MyHomesResponse = try await api.request(HomesEndpoints.myHomes())
            let rows = response.homes.map { row(for: $0) }
            if rows.isEmpty {
                state = .empty(
                    ListOfRowsState.EmptyContent(
                        icon: .home,
                        headline: "You don’t belong to any homes yet",
                        subcopy: "Claim or join a verified home to unlock packages, bills, tasks, and member chat.",
                        ctaTitle: "Claim a home",
                        onCTA: onAddHome
                    )
                )
            } else {
                state = .loaded(sections: [RowSection(rows: rows)], hasMore: false)
            }
        } catch {
            state = .error(message: (error as? APIError)?.errorDescription ?? "Something went wrong.")
        }
    }

    private func row(for entry: MyHome) -> RowModel {
        let home = entry.home
        let displayTitle = home.name?.nilIfEmpty
            ?? home.address?.nilIfEmpty
            ?? "Unnamed home"
        let locality = [home.city, home.state]
            .compactMap { $0?.nilIfEmpty }
            .joined(separator: ", ")
            .nilIfEmpty
        let role = roleLabel(for: entry)
        let subtitleParts = [role, locality].compactMap { $0 }
        let subtitle = subtitleParts.isEmpty ? nil : subtitleParts.joined(separator: " · ")

        let pending = MyHomesListViewModel.pendingVerification(for: entry)
        var chips: [RowChip]? = if entry.isPrimaryOwner == true {
            [
                RowChip(
                    text: "Active home",
                    icon: .home,
                    tint: .custom(
                        background: Theme.Color.homeBg,
                        foreground: Theme.Color.home
                    )
                )
            ]
        } else {
            nil
        }
        // Parity with RN (`src/app/homes/index.tsx:235`): a home whose
        // ownership claim or occupancy is still unverified carries a
        // "Pending verification" chip and an inline upload CTA.
        if pending != nil {
            var merged = chips ?? []
            merged.append(
                RowChip(
                    text: "Pending verification",
                    icon: .clock,
                    tint: .status(.warning)
                )
            )
            chips = merged
        }

        // Parity with RN (`src/app/homes/index.tsx:249`): the destructive
        // affordance only appears on rows the server says the viewer may
        // delete. Everyone else keeps the plain drill-down chevron.
        let canDelete = entry.canDeleteHome == true
        let homeId = entry.id

        return RowModel(
            id: entry.id,
            title: displayTitle,
            subtitle: subtitle,
            template: .avatarKebab,
            leading: .avatar(
                name: displayTitle,
                imageURL: nil,
                identity: .home,
                ringProgress: entry.ownershipStatus == "verified" ? 1.0 : 0.3
            ),
            trailing: canDelete ? .kebab : .chevron,
            onTap: { @Sendable in
                Task { @MainActor in self.onOpenHome(entry.id) }
            },
            onSecondary: canDelete
                ? { @Sendable [weak self] in
                    Task { @MainActor in
                        self?.pendingEvent = .confirmDelete(homeId: homeId, name: displayTitle)
                    }
                }
                : nil,
            chips: chips,
            footer: pendingFooter(for: entry, pending: pending)
        )
    }

    /// The "Upload documents to verify …" strip RN renders under a
    /// pending row (`src/app/homes/index.tsx:262-283`). Owner-pending
    /// rows route to the ownership evidence wizard; residency-pending
    /// rows route to its residency variant.
    private func pendingFooter(
        for entry: MyHome,
        pending: PendingVerification?
    ) -> RowFooter? {
        guard let pending else { return nil }
        let homeId = entry.id
        switch pending {
        case .owner:
            guard let onUploadOwnershipEvidence else { return nil }
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Upload documents to verify ownership",
                    icon: .upload,
                    variant: .primary,
                    identifier: "myHomes.row_\(homeId).verifyOwnership"
                ) { onUploadOwnershipEvidence(homeId) }
            ])
        case .residency:
            guard let onVerifyResidency else { return nil }
            return RowFooter(actions: [
                RowFooterAction(
                    title: "Upload documents to verify residency",
                    icon: .upload,
                    variant: .primary,
                    identifier: "myHomes.row_\(homeId).verifyResidency"
                ) { onVerifyResidency(homeId) }
            ])
        }
    }

    /// Which verification (if any) this row is still waiting on.
    /// Predicate copied from RN `src/app/homes/index.tsx:181-184`.
    enum PendingVerification: Equatable {
        case owner
        case residency
    }

    static func pendingVerification(for entry: MyHome) -> PendingVerification? {
        let role = entry.occupancy?.role
        let isPendingOwner = role == "pending_owner" || entry.ownershipStatus == "pending"
        if isPendingOwner { return .owner }
        let occupancyActive = entry.occupancy?.isActive ?? true
        let verificationStatus = entry.occupancy?.verificationStatus
        let needsVerification = verificationStatus.map { status in
            !status.isEmpty && !["verified", "moved_out"].contains(status)
        } ?? false
        // RN treats "no occupancy row at all" as nothing to verify — the
        // pending-resident branch only fires off an actual occupancy.
        guard entry.occupancy != nil else { return nil }
        return (!occupancyActive || needsVerification) ? .residency : nil
    }

    /// Maps the backend's role enum onto the canonical four-role label
    /// vocabulary the design uses: Owner / Tenant / Housemate / Guest.
    /// Order: ownership_status wins; otherwise occupancy.role_base; final
    /// fallback "Member".
    private func roleLabel(for entry: MyHome) -> String? {
        if let status = entry.ownershipStatus {
            switch status {
            case "verified":
                return "Owner"
            case "pending":
                return "Owner (pending)"
            default:
                break
            }
        }
        switch entry.occupancy?.roleBase {
        case "lease_resident":
            return "Tenant"
        case "household_member":
            return "Housemate"
        case "guest":
            return "Guest"
        case "owner":
            return "Owner"
        case "admin", "manager":
            return "Manager"
        case nil:
            return nil
        case let roleBase?:
            return roleBase.capitalized
        }
    }
}

private extension String {
    /// Returns `nil` when the string is empty; otherwise the string.
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
