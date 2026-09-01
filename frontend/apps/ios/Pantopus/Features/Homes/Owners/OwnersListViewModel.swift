//
//  OwnersListViewModel.swift
//  Pantopus
//
//  P15 / T6.3g — Backs `OwnersListView`. Reads
//  `GET /api/homes/:id/owners` (`backend/routes/homeOwnership.js:1381`)
//  and projects each `OwnerDTO` onto a `RowModel` using the avatar-first
//  shape: 40pt avatar with verified-check overlay + name + proof chip +
//  role subtitle + body proof-status line + kebab. FAB opens the
//  existing Invite Owner form. Kebab opens an action sheet with
//  Remove (DELETE /:ownerId).
//

import Foundation
import Observation
import SwiftUI

/// Surfaced to the view so it can present sheets / confirms in response
/// to row interactions without the VM holding view state.
public enum OwnersListEvent: Sendable, Equatable {
    case openInvite
    case confirmRemove(ownerId: String, displayName: String)
    /// H6 — push the per-home owner claim-review surface
    /// (`HomeClaimReviewView`). Fired by the top-bar gavel.
    case openClaimReview
}

/// `@Observable` data source for the Owners list screen.
@Observable
@MainActor
final class OwnersListViewModel: ListOfRowsDataSource {
    let title = "Owners"

    /// H6 — entry point to the per-home claim-review surface
    /// (`HomeClaimReviewView`). Deliberately un-badged: counting pending
    /// claims would mean two extra owner-scoped reads on every roster
    /// load, and the review screen already shows per-tab counts.
    /// Nil when the host didn't wire a claim-review destination
    /// (previews / tests) so the gavel is never a dead button.
    var topBarAction: TopBarAction? {
        guard showsClaimReview else { return nil }
        return TopBarAction(
            icon: .gavel,
            accessibilityLabel: "Review claims on this home"
        ) { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openClaimReview }
        }
    }

    let tabs: [ListOfRowsTab] = []
    var selectedTab: String = ""

    var fab: FABAction? {
        FABAction(
            icon: .userPlus,
            accessibilityLabel: "Invite an owner",
            variant: .secondaryCreate,
            tint: .home
        ) { @Sendable [weak self] in
            Task { @MainActor in self?.pendingEvent = .openInvite }
        }
    }

    private(set) var state: ListOfRowsState = .loading

    /// Event the view should react to. Set by row handlers; cleared by
    /// the view after dispatching.
    var pendingEvent: OwnersListEvent?

    let homeId: String
    private let currentUserId: String?
    private let api: APIClient
    /// Cached roster — preserves backend ordering (primary first) and
    /// drives optimistic-remove rollback.
    private var owners: [OwnerDTO] = []

    /// True only when the host supplied an `onOpenClaimReview` handler.
    private let showsClaimReview: Bool

    init(
        homeId: String,
        currentUserId: String? = nil,
        api: APIClient = .shared,
        showsClaimReview: Bool = false
    ) {
        self.homeId = homeId
        self.currentUserId = currentUserId
        self.api = api
        self.showsClaimReview = showsClaimReview
    }

    // MARK: - ListOfRowsDataSource

    func load() async {
        if case .loaded = state { return }
        state = .loading
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    func loadMoreIfNeeded() async {
        // Backend doesn't paginate /owners.
    }

    // MARK: - Mutations

    /// Apply the result of the Invite Owner flow — the backend returns
    /// the new ownership claim id rather than a hydrated `OwnerDTO`, so
    /// the simplest correct behaviour is to refetch the roster so the
    /// new pending row appears in the right order.
    func handleInviteCompleted() {
        Task { await refresh() }
    }

    /// Look up a cached owner by id — used by the view to seed copy on
    /// confirm dialogs.
    func cachedOwner(withId id: String) -> OwnerDTO? {
        owners.first { $0.id == id }
    }

    /// Optimistic remove with rollback on failure. When the backend
    /// returns a `quorum_action_id`, the row is *not* actually removed
    /// server-side until quorum resolves — we still drop the row from
    /// the visible list and emit a confirmation message via the view's
    /// alert handler. The view can reissue `refresh()` to surface the
    /// canonical state.
    func removeOwner(ownerId: String) async {
        guard let idx = owners.firstIndex(where: { $0.id == ownerId }) else { return }
        let previous = owners
        owners.remove(at: idx)
        applyState()
        do {
            let _: RemoveOwnerResponse = try await api.request(
                HomesEndpoints.removeOwner(homeId: homeId, ownerId: ownerId)
            )
        } catch {
            owners = previous
            applyState()
        }
    }

    // MARK: - Private

    private func fetch() async {
        do {
            let response: OwnersResponse = try await api.request(
                HomesEndpoints.listOwners(homeId: homeId)
            )
            owners = response.owners
            applyState()
        } catch {
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "Couldn't load owners. Try again."
            )
        }
    }

    private func applyState() {
        guard !owners.isEmpty else {
            state = .empty(
                ListOfRowsState.EmptyContent(
                    icon: .shield,
                    headline: "No owners yet",
                    subcopy:
                    "Invite a spouse, sibling, or co-investor who's on the " +
                        "deed. They'll upload proof and split the share with you.",
                    ctaTitle: "Invite an owner"
                ) { @Sendable [weak self] in
                    Task { @MainActor in self?.pendingEvent = .openInvite }
                }
            )
            return
        }
        let total = owners.count
        let rows = owners.enumerated().map { offset, owner in
            row(for: owner, position: offset, totalOwners: total)
        }
        state = .loaded(
            sections: [RowSection(rows: rows)],
            hasMore: false
        )
    }

    /// Project one DTO into a `RowModel`. `position` drives the avatar
    /// tone cycle; `totalOwners` drives the role-subtitle wording
    /// ("Sole owner" vs "Co-owner").
    ///
    /// Slot map (mirrors the P15 brief):
    ///   - title:    owner name
    ///   - inlineChip: "You" pill when the viewer matches the subject.
    ///       The brief reserves this slot for a "Resident" chip when the
    ///       owner also lives at the home, but the `/owners` endpoint
    ///       doesn't currently join residency — Resident is tracked as a
    ///       backend follow-up (see PR description).
    ///   - subtitle: role ("Sole owner" / "Primary owner" / "Co-owner" /
    ///       "Invited · awaiting verification") with a shield prefix.
    ///   - body:     verbose proof label ("Deed on file" /
    ///       "Pending review") with the proof glyph prefix.
    ///   - trailing: kebab → confirms removal. "View claim" and "Edit"
    ///       are deferred — there's no `claim_id` exposed on the
    ///       `HomeOwner` row today and no per-owner edit endpoint
    ///       (only re-invite via the same flow).
    private func row(for owner: OwnerDTO, position: Int, totalOwners: Int) -> RowModel {
        let displayName = displayName(for: owner)
        let proof = OwnerProof.resolve(
            ownerStatus: owner.ownerStatus,
            verificationTier: owner.verificationTier
        )
        let tone = OwnerTone.at(position)
        let avatarURL: URL? = {
            guard let raw = owner.user?.profilePictureUrl?.nilIfEmpty else { return nil }
            return URL(string: raw)
        }()
        let isYou = currentUserId.map { $0 == owner.subjectId } ?? false
        let youChip: RowChip? = isYou ? RowChip(
            text: "You",
            tint: .custom(
                background: Theme.Color.primary50,
                foreground: Theme.Color.primary700
            )
        ) : nil

        return RowModel(
            id: owner.id,
            title: displayName,
            subtitle: roleSubtitle(
                isPrimary: owner.isPrimaryOwner,
                totalOwners: totalOwners,
                isPending: owner.ownerStatus.lowercased() == "pending"
            ),
            template: .avatarKebab,
            leading: .avatarWithBadge(
                name: displayName,
                imageURL: avatarURL,
                background: .gradient(tone.gradient),
                size: .medium,
                verified: proof != .pending
            ),
            trailing: .kebab,
            onTap: { @Sendable in
                // Tapping the row itself is a no-op for now — the only
                // interactive surface is the kebab menu. A future
                // "View claim" destination would push here.
            },
            onSecondary: { @Sendable [weak self] in
                Task { @MainActor in
                    self?.pendingEvent = .confirmRemove(
                        ownerId: owner.id,
                        displayName: displayName
                    )
                }
            },
            body: proof.bodyLabel,
            subtitleIcon: .shield,
            bodyIcon: proof.icon,
            inlineChip: youChip
        )
    }

    private func displayName(for owner: OwnerDTO) -> String {
        if let name = owner.user?.name?.nilIfEmpty { return name }
        if let username = owner.user?.username?.nilIfEmpty { return "@\(username)" }
        // Mask non-user subjects (business / trust) and orphaned rows.
        let suffix = String(owner.subjectId.suffix(4))
        switch owner.subjectType.lowercased() {
        case "business": return "Business · \(suffix)"
        case "trust": return "Trust · \(suffix)"
        default: return "Owner · \(suffix)"
        }
    }

    private func roleSubtitle(
        isPrimary: Bool,
        totalOwners: Int,
        isPending: Bool
    ) -> String {
        if isPending { return "Invited · awaiting verification" }
        if totalOwners <= 1 { return "Sole owner" }
        return isPrimary ? "Primary owner" : "Co-owner"
    }
}

private extension String {
    var nilIfEmpty: String? {
        isEmpty ? nil : self
    }
}
