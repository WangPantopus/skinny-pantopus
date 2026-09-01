//
//  FollowingViewModel.swift
//  Pantopus
//
//  §1A① — "Following" (Beacons you follow). Mirrors the My bids
//  ViewModel + service pattern: a cached row array, a `state` enum the
//  view renders from, optimistic row mutations that roll back on failure,
//  and a transient toast. Row actions (mark seen · mute · unfollow) all
//  key off `persona.id` per the backend routes.
//

// swiftlint:disable file_length type_body_length

import SwiftUI

@Observable
@MainActor
public final class FollowingViewModel {
    // MARK: - Observed surface

    public private(set) var state: FollowingViewState = .loading
    public private(set) var selectedSort: FollowingSort = .activity

    /// Bound to the view's `.sheet(item:)` — the row whose overflow menu
    /// is open. `nil` dismisses the action sheet.
    public var actionTarget: FollowingActionTarget?

    /// Transient confirmation / error banner.
    public var toast: ToastMessage?

    /// True while the long-press multi-select mode is active.
    public private(set) var isSelecting = false

    /// Membership ids currently ticked in multi-select mode.
    public private(set) var selectedRowIDs: Set<String> = []

    /// Bound to the view's bulk-unfollow `confirmationDialog`.
    public var pendingBulkUnfollow: FollowingBulkUnfollowRequest?

    // MARK: - Dependencies

    private let api: APIClient
    private let onBack: @MainActor () -> Void
    private let onDiscover: @MainActor () -> Void
    private let onOpenPersona: @MainActor (String) -> Void
    private let now: @Sendable () -> Date

    // MARK: - Cache

    private var items: [FollowingRowDTO] = []
    private var counts = FollowingCountsDTO(totalFollowing: 0, unreadBeacons: 0)
    private var loadedAtLeastOnce = false

    init(
        api: APIClient = .shared,
        onBack: @escaping @MainActor () -> Void = {},
        onDiscover: @escaping @MainActor () -> Void = {},
        onOpenPersona: @escaping @MainActor (String) -> Void = { _ in },
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.api = api
        self.onBack = onBack
        self.onDiscover = onDiscover
        self.onOpenPersona = onOpenPersona
        self.now = now
    }

    // MARK: - Loading

    public func load() async {
        if !loadedAtLeastOnce { state = .loading }
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// Re-fetch with a new server sort. No-op when the sort is unchanged.
    public func selectSort(_ sort: FollowingSort) async {
        guard sort != selectedSort else { return }
        selectedSort = sort
        state = .loading
        await fetch()
    }

    private func fetch() async {
        do {
            let response: FollowingListResponse = try await api.request(
                FollowingEndpoints.list(sort: selectedSort.wire)
            )
            items = response.items
            counts = response.counts
            loadedAtLeastOnce = true
            rebuild()
        } catch {
            if !loadedAtLeastOnce {
                let message = (error as? APIError)?.errorDescription ?? "Couldn't load who you follow."
                state = .error(message: message)
            } else {
                toast = ToastMessage(text: "Couldn't refresh.", kind: .error)
            }
        }
    }

    /// Recomputes `state` from the cached rows.
    private func rebuild() {
        guard !items.isEmpty else {
            state = .empty
            return
        }
        let sections = FollowingProjection.sections(from: items, now: now())
        let total = items.count
        let unread = items.filter { ($0.mutedUntil == nil) && ($0.unreadCount ?? 0) > 0 }.count
        state = .loaded(sections: sections, totalFollowing: total, unreadBeacons: unread)
    }

    // MARK: - Navigation passthroughs

    public func back() {
        onBack()
    }

    public func discover() {
        onDiscover()
    }

    public func openPersona(handle: String) {
        onOpenPersona(handle)
    }

    // MARK: - Row action sheet

    public func openActions(for row: FollowingRow) {
        actionTarget = row.actionTarget
    }

    public func closeActions() {
        actionTarget = nil
    }

    /// "Mark seen" — zero the row's unread count and re-group. Optimistic.
    public func markSeen(_ target: FollowingActionTarget) async {
        actionTarget = nil
        guard let index = items.firstIndex(where: { $0.membershipId == target.id }) else { return }
        let previous = items
        items[index] = items[index].markedSeen(at: isoNow())
        rebuild()
        do {
            _ = try await api.request(
                FollowingEndpoints.markSeen(personaId: target.personaId),
                as: FollowingSeenResponse.self
            )
        } catch {
            items = previous
            rebuild()
            toast = ToastMessage(text: "Couldn't mark seen.", kind: .error)
        }
    }

    /// Apply a temporary mute of `days` (nil clears it). Optimistic.
    public func mute(_ target: FollowingActionTarget, days: Int?) async {
        actionTarget = nil
        guard let index = items.firstIndex(where: { $0.membershipId == target.id }) else { return }
        let previous = items
        let until = days.map { isoNow(offsetDays: $0) }
        items[index] = items[index].mutedCopy(until: until)
        rebuild()
        do {
            let response = try await api.request(
                FollowingEndpoints.mute(personaId: target.personaId, days: days),
                as: FollowingMuteResponse.self
            )
            // Reconcile with the server's authoritative timestamp.
            if let idx = items.firstIndex(where: { $0.membershipId == target.id }) {
                items[idx] = items[idx].mutedCopy(until: response.mutedUntil)
                rebuild()
            }
            if days != nil {
                toast = ToastMessage(text: "Muted \(target.displayName).", kind: .success)
            } else {
                toast = ToastMessage(text: "Unmuted \(target.displayName).", kind: .success)
            }
        } catch {
            items = previous
            rebuild()
            toast = ToastMessage(text: "Couldn't update mute.", kind: .error)
        }
    }

    /// Unfollow — optimistically removes the row, restoring it on failure
    /// (e.g. a paid membership the backend refuses to drop here).
    public func unfollow(_ target: FollowingActionTarget) async {
        actionTarget = nil
        guard let index = items.firstIndex(where: { $0.membershipId == target.id }) else { return }
        let previous = items
        let previousCounts = counts
        items.remove(at: index)
        counts = FollowingCountsDTO(
            totalFollowing: max(0, counts.totalFollowing - 1),
            unreadBeacons: counts.unreadBeacons
        )
        rebuild()
        do {
            _ = try await api.request(FollowingEndpoints.unfollow(personaId: target.personaId))
            toast = ToastMessage(text: "Unfollowed \(target.displayName).", kind: .success)
        } catch {
            items = previous
            counts = previousCounts
            rebuild()
            let message = (error as? APIError)?.errorDescription
                ?? "Couldn't unfollow \(target.displayName)."
            toast = ToastMessage(text: message, kind: .error)
        }
    }

    // MARK: - Notification level (inline bell)

    /// Cycle the row's bell All → Highlights → Off → All. Optimistic; rolls
    /// the level back and toasts on failure, exactly like RN's
    /// `handleBellCycle` (`pantopus/frontend/apps/mobile/src/app/beacons/following.tsx:121`).
    public func cycleNotificationLevel(_ row: FollowingRow) async {
        guard !row.isPaused else { return }
        guard let index = items.firstIndex(where: { $0.membershipId == row.id }) else { return }
        let previous = items[index].notificationLevel
        let next = row.notificationLevel.next
        items[index] = items[index].notificationLevelCopy(next.rawValue)
        rebuild()
        do {
            let response = try await api.request(
                FollowingEndpoints.notificationLevel(personaId: row.personaId, level: next.rawValue),
                as: FollowPreferencesResponse.self
            )
            // Reconcile with the server's authoritative value.
            if let idx = items.firstIndex(where: { $0.membershipId == row.id }),
               let serverLevel = response.notificationLevel {
                items[idx] = items[idx].notificationLevelCopy(serverLevel)
                rebuild()
            }
            toast = ToastMessage(text: "Notifications: \(next.toastLabel)", kind: .success)
        } catch {
            if let idx = items.firstIndex(where: { $0.membershipId == row.id }) {
                items[idx] = items[idx].notificationLevelCopy(previous)
                rebuild()
            }
            toast = ToastMessage(text: "Couldn't change notifications.", kind: .error)
        }
    }

    /// Set an explicit level from the action sheet's segmented control.
    public func setNotificationLevel(
        _ target: FollowingActionTarget,
        level: FollowingNotificationLevel
    ) async {
        guard let index = items.firstIndex(where: { $0.membershipId == target.id }) else { return }
        let previous = items[index].notificationLevel
        items[index] = items[index].notificationLevelCopy(level.rawValue)
        actionTarget?.notificationLevel = level
        rebuild()
        do {
            _ = try await api.request(
                FollowingEndpoints.notificationLevel(personaId: target.personaId, level: level.rawValue),
                as: FollowPreferencesResponse.self
            )
            toast = ToastMessage(text: "Notifications: \(level.toastLabel)", kind: .success)
        } catch {
            if let idx = items.firstIndex(where: { $0.membershipId == target.id }) {
                items[idx] = items[idx].notificationLevelCopy(previous)
                rebuild()
            }
            actionTarget?.notificationLevel = FollowingNotificationLevel.from(previous)
            toast = ToastMessage(text: "Couldn't change notifications.", kind: .error)
        }
    }

    // MARK: - Multi-select + bulk unfollow

    /// Long-press a row: enter select mode with that row ticked.
    public func beginSelection(_ row: FollowingRow) {
        isSelecting = true
        selectedRowIDs = [row.id]
    }

    /// Tap a row while selecting: toggle its tick.
    public func toggleSelection(_ row: FollowingRow) {
        if selectedRowIDs.contains(row.id) {
            selectedRowIDs.remove(row.id)
        } else {
            selectedRowIDs.insert(row.id)
        }
    }

    public func isSelected(_ row: FollowingRow) -> Bool {
        selectedRowIDs.contains(row.id)
    }

    /// Cancel — leaves the rows untouched.
    public func exitSelection() {
        isSelecting = false
        selectedRowIDs = []
    }

    /// Build the confirm-dialog payload for the current selection. Paid
    /// memberships are counted separately and skipped, matching RN.
    public func requestBulkUnfollow() {
        let selected = items.filter { selectedRowIDs.contains($0.membershipId) }
        guard !selected.isEmpty else { return }
        let unfollowable = selected.filter { ($0.paidTier?.rank ?? 0) <= 1 }
        guard !unfollowable.isEmpty else {
            toast = ToastMessage(
                text: "Paid memberships are managed in Audience.",
                kind: .error
            )
            return
        }
        pendingBulkUnfollow = FollowingBulkUnfollowRequest(
            membershipIDs: unfollowable.map(\.membershipId),
            personaIDs: unfollowable.map(\.persona.id),
            skippedPaidCount: selected.count - unfollowable.count
        )
    }

    public func cancelBulkUnfollow() {
        pendingBulkUnfollow = nil
    }

    /// Fan out `DELETE /api/personas/:id/follow` over the selection. There is
    /// no bulk route server-side — RN's `unfollowMany`
    /// (`pantopus/frontend/packages/api/src/endpoints/personas.ts:286`) fans
    /// out the same way and buckets the results into
    /// succeeded / skippedPaid / failed.
    public func confirmBulkUnfollow(_ request: FollowingBulkUnfollowRequest) async {
        pendingBulkUnfollow = nil
        let previous = items
        let previousCounts = counts
        let removing = Set(request.membershipIDs)
        items.removeAll { removing.contains($0.membershipId) }
        counts = FollowingCountsDTO(
            totalFollowing: max(0, counts.totalFollowing - removing.count),
            unreadBeacons: counts.unreadBeacons
        )
        exitSelection()
        rebuild()

        var succeeded = 0
        var skippedPaid = 0
        var failed: [String] = []
        for (index, personaId) in request.personaIDs.enumerated() {
            do {
                _ = try await api.request(FollowingEndpoints.unfollow(personaId: personaId))
                succeeded += 1
            } catch {
                if Self.isPaidMembershipConflict(error) {
                    skippedPaid += 1
                } else {
                    failed.append(request.membershipIDs[index])
                }
            }
        }

        if !failed.isEmpty {
            // Restore only the rows the server refused.
            let restore = Set(failed)
            let restored = previous.filter { restore.contains($0.membershipId) }
            items.append(contentsOf: restored)
            counts = FollowingCountsDTO(
                totalFollowing: min(previousCounts.totalFollowing, counts.totalFollowing + restored.count),
                unreadBeacons: counts.unreadBeacons
            )
            rebuild()
        }

        if !failed.isEmpty {
            toast = ToastMessage(text: "\(failed.count) couldn't be unfollowed.", kind: .error)
        } else if skippedPaid > 0 {
            toast = ToastMessage(
                text: "\(skippedPaid) paid membership\(skippedPaid == 1 ? "" : "s") skipped.",
                kind: .neutral
            )
        } else if succeeded > 0 {
            toast = ToastMessage(
                text: "Unfollowed \(succeeded) Beacon\(succeeded == 1 ? "" : "s").",
                kind: .success
            )
        }
        // Re-sync from the server to settle any partial state.
        await fetch()
    }

    /// The backend answers a paid membership with 409 +
    /// `code: paid_membership_managed_by_subscription`
    /// (`backend/routes/personas.js:1190`). The client maps 4xx onto
    /// `.clientError(status:message:)`, so match on the status.
    private static func isPaidMembershipConflict(_ error: Error) -> Bool {
        guard let apiError = error as? APIError else { return false }
        if case let .clientError(status, message) = apiError {
            if status == 409 { return true }
            return (message ?? "").lowercased().contains("paid membership")
        }
        return false
    }

    // MARK: - Time helpers

    private func isoNow(offsetDays: Int = 0) -> String {
        let date = now().addingTimeInterval(TimeInterval(offsetDays) * 86400)
        return Self.isoFormatter.string(from: date)
    }

    private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}

// MARK: - DTO mutation copies

/// In-module copy helpers so optimistic mutations don't need to reach for
/// the synthesized memberwise initializer at every call site.
extension FollowingRowDTO {
    func markedSeen(at iso: String) -> FollowingRowDTO {
        FollowingRowDTO(
            membershipId: membershipId,
            persona: persona,
            fanHandle: fanHandle,
            notificationLevel: notificationLevel,
            mutedUntil: mutedUntil,
            paidTier: paidTier,
            latestPost: latestPost,
            unreadCount: 0,
            followedAt: followedAt,
            lastSeenAt: iso
        )
    }

    func notificationLevelCopy(_ level: String?) -> FollowingRowDTO {
        FollowingRowDTO(
            membershipId: membershipId,
            persona: persona,
            fanHandle: fanHandle,
            notificationLevel: level,
            mutedUntil: mutedUntil,
            paidTier: paidTier,
            latestPost: latestPost,
            unreadCount: unreadCount,
            followedAt: followedAt,
            lastSeenAt: lastSeenAt
        )
    }

    func mutedCopy(until iso: String?) -> FollowingRowDTO {
        FollowingRowDTO(
            membershipId: membershipId,
            persona: persona,
            fanHandle: fanHandle,
            notificationLevel: notificationLevel,
            mutedUntil: iso,
            paidTier: paidTier,
            latestPost: latestPost,
            unreadCount: unreadCount,
            followedAt: followedAt,
            lastSeenAt: lastSeenAt
        )
    }
}

#if DEBUG
extension FollowingViewModel {
    /// Seed a loaded state from sample rows without touching the network —
    /// used by previews and snapshot fixtures.
    static func previewLoaded() -> FollowingViewModel {
        let vm = FollowingViewModel()
        vm.items = FollowingSampleData.rows
        vm.counts = FollowingCountsDTO(
            totalFollowing: FollowingSampleData.rows.count,
            unreadBeacons: 3
        )
        vm.loadedAtLeastOnce = true
        vm.rebuild()
        return vm
    }

    static func previewEmpty() -> FollowingViewModel {
        let vm = FollowingViewModel()
        vm.loadedAtLeastOnce = true
        vm.rebuild()
        return vm
    }
}

/// Sample payload mirroring the §1A① design frames.
enum FollowingSampleData {
    static func persona(
        _ id: String,
        _ handle: String,
        _ name: String,
        verified: Bool = true
    ) -> FollowingPersonaDTO {
        FollowingPersonaDTO(
            id: id,
            handle: handle,
            displayName: name,
            avatarUrl: nil,
            status: "active",
            verified: verified,
            followerCount: nil
        )
    }

    static func post(_ snippet: String, hoursAgo: Double) -> FollowingPostDTO {
        let date = Date().addingTimeInterval(-hoursAgo * 3600)
        let iso = ISO8601DateFormatter().string(from: date)
        return FollowingPostDTO(id: UUID().uuidString, snippet: snippet, createdAt: iso)
    }

    static let rows: [FollowingRowDTO] = [
        FollowingRowDTO(
            membershipId: "m1",
            persona: persona("p1", "maplebakery", "Maple Bakery"),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: nil,
            paidTier: FollowingTierDTO(rank: 2, name: "Insiders", priceCents: 500),
            latestPost: post(
                "Croissants are back tomorrow at 7am \u{2014} first 30 half-off for followers.",
                hoursAgo: 2
            ),
            unreadCount: 3,
            followedAt: nil,
            lastSeenAt: nil
        ),
        FollowingRowDTO(
            membershipId: "m2",
            persona: persona("p2", "burnsidelib", "Burnside Library"),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: nil,
            paidTier: nil,
            latestPost: post(
                "Toddler story time Saturday \u{2014} 10am sharp in the kids\u{2019} room.",
                hoursAgo: 5
            ),
            unreadCount: 12,
            followedAt: nil,
            lastSeenAt: nil
        ),
        FollowingRowDTO(
            membershipId: "m3",
            persona: persona("p3", "elmparkcity", "Elm Park Council"),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: nil,
            paidTier: nil,
            latestPost: post(
                "Street sweeping shifts to Thursdays starting next week.",
                hoursAgo: 24
            ),
            unreadCount: 40,
            followedAt: nil,
            lastSeenAt: nil
        ),
        FollowingRowDTO(
            membershipId: "m4",
            persona: persona("p4", "raetheplumber", "Rae the Plumber"),
            fanHandle: nil,
            notificationLevel: "none",
            mutedUntil: ISO8601DateFormatter().string(
                from: Date().addingTimeInterval(86400 * 3)
            ),
            paidTier: nil,
            latestPost: post(
                "Quick tip: a shower that drips after you shut it off is a $4 cartridge.",
                hoursAgo: 48
            ),
            unreadCount: 0,
            followedAt: nil,
            lastSeenAt: nil
        ),
        FollowingRowDTO(
            membershipId: "m5",
            persona: persona("p5", "samikim", "Sami Kim"),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: nil,
            paidTier: nil,
            latestPost: post(
                "The new ramen place on 8th is worth the hype. Tonkotsu is the move.",
                hoursAgo: 72
            ),
            unreadCount: 0,
            followedAt: nil,
            lastSeenAt: nil
        ),
        FollowingRowDTO(
            membershipId: "m6",
            persona: persona("p6", "otispark", "Otis Park", verified: false),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: nil,
            paidTier: nil,
            latestPost: nil,
            unreadCount: 0,
            followedAt: nil,
            lastSeenAt: nil
        ),
        FollowingRowDTO(
            membershipId: "m7",
            persona: persona("p7", "bayridgesketch", "Bay Ridge Sketch Club"),
            fanHandle: nil,
            notificationLevel: "all",
            mutedUntil: nil,
            paidTier: nil,
            latestPost: nil,
            unreadCount: 0,
            followedAt: nil,
            lastSeenAt: nil
        )
    ]
}
#endif
