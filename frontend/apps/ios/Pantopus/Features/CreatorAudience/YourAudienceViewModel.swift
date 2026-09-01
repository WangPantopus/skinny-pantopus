//
//  YourAudienceViewModel.swift
//  Pantopus
//
//  A22.2 "Your audience". Drives the creator's member-management screen:
//  fetches `/me/audience`, projects pending requests + tier-grouped active
//  members, and runs approve / decline / remove actions against
//  `PATCH /me/audience/:membershipId`. Same VM/service pattern as My Bids —
//  a single `state` enum plus fine-grained published fields.
//

// swiftlint:disable large_tuple type_body_length

import SwiftUI

@Observable
@MainActor
public final class YourAudienceViewModel {
    /// Single source of truth for the screen body.
    public private(set) var state: YourAudienceState = .loading
    /// Backend counts (computed before filtering) — drive the nav count
    /// line and the chip badges regardless of the active filter.
    public private(set) var counts: AudienceCounts = .zero
    /// Creator-named tier labels, accumulated across fetches so a chip can
    /// be labelled even when the current (filtered) page omits that tier.
    public private(set) var tierNames: [Int: String] = [:]

    /// Active filter chip. Mutated only through `select(filter:)`.
    public private(set) var filter: AudienceFilter = .all
    /// Active sort. Mutated only through `cycleSort()`; passed straight to
    /// the list endpoint's `sort` query param.
    public private(set) var sort: AudienceSort = .recent
    /// True while a follow-on page is in flight (drives the list footer).
    public private(set) var isLoadingMore = false
    /// True while the server says another page exists at `nextOffset`.
    public private(set) var hasMore = false
    /// Member whose overflow (•••) sheet is open.
    public var overflowTarget: AudienceMember?
    /// Member awaiting the destructive block confirmation.
    public var blockTarget: AudienceMember?
    /// Transient confirmation / error message.
    public var toast: String?
    /// Destructive action currently inside its 5-second undo window. While
    /// non-nil the row is already gone from the list but no `PATCH` has
    /// been sent yet.
    public private(set) var pendingUndo: PendingAudienceUndo?

    private let api: APIClient
    private var loadedAtLeastOnce = false
    /// Every row fetched so far for the current filter+sort, in server
    /// order. Pages append here; the tier grouping is re-derived from it.
    private var members: [AudienceMember] = []
    /// Offset the next page starts at, or nil when the list is exhausted.
    private var nextOffset: Int?
    /// Owning Beacon id, echoed on every `/me/audience` page. Needed by
    /// the block action, which goes through `/personas/:id/followers/…`.
    private var personaId: String?

    /// Timer that commits a destructive action once its undo window closes.
    private var undoTask: Task<Void, Never>?
    /// Pre-removal snapshot restored by Undo (and by a failed commit).
    private var undoSnapshot: (members: [AudienceMember], counts: AudienceCounts, state: YourAudienceState)?
    /// The action the undo window is holding.
    private var queuedAction: (action: AudienceMemberAction, member: AudienceMember)?

    /// Page size. Matches RN's `PAGE_SIZE`
    /// (`src/hooks/usePersonaAudienceList.ts:11`).
    static let pageSize = 50

    /// Undo window before the destructive `PATCH` fires. RN shows a
    /// 5000ms toast and commits at 5100ms
    /// (`src/app/audience/members.tsx:104-119`).
    static let undoWindowNanoseconds: UInt64 = 5_100_000_000

    init(api: APIClient = .shared) {
        self.api = api
    }

    // MARK: - Loading

    public func load() async {
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    /// Switch scope chips. Re-fetches page 1 with the matching query params.
    public func select(filter newFilter: AudienceFilter) async {
        guard filter != newFilter else { return }
        filter = newFilter
        await fetch()
    }

    /// Header sort control — cycles recent → tenure → tier → alpha and
    /// re-fetches from offset 0 with the new `sort`.
    public func cycleSort() async {
        sort = sort.next
        toast = "Sort: \(sort.label)"
        await fetch()
    }

    /// Called when the list's bottom sentinel scrolls into view. Fetches the
    /// next page when the server reported one; no-ops otherwise (mirrors
    /// RN's `onEndReached` → `fetchNextPage` guard).
    public func loadMore() async {
        guard hasMore, !isLoadingMore, let offset = nextOffset else { return }
        isLoadingMore = true
        await fetchPage(offset: offset, reset: false)
        isLoadingMore = false
    }

    private func fetch() async {
        if !loadedAtLeastOnce {
            state = .loading
        }
        await fetchPage(offset: 0, reset: true)
    }

    private func fetchPage(offset: Int, reset: Bool) async {
        do {
            let response: AudienceListResponse = try await api.request(
                AudienceProfileEndpoints.audience(
                    sort: sort.rawValue,
                    status: filter.statusParam,
                    tierRank: filter.tierRankParam,
                    limit: Self.pageSize,
                    offset: offset
                )
            )
            loadedAtLeastOnce = true
            apply(response, reset: reset)
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load your audience."
            if loadedAtLeastOnce {
                toast = message
            } else {
                state = .error(message: message)
            }
        }
    }

    private func apply(_ response: AudienceListResponse, reset: Bool) {
        let parsed = AudienceCounts(
            totalActive: response.counts.totalActive ?? 0,
            pending: response.counts.pending ?? 0,
            byTier: Self.byTier(response.counts.byTier)
        )
        counts = parsed
        personaId = response.persona?.id ?? personaId

        let page = response.items.compactMap(AudienceMember.init(dto:))
        for member in page where !member.tierName.isEmpty {
            tierNames[member.tierRank] = member.tierName
        }
        if reset {
            members = page
        } else {
            let known = Set(members.map(\.membershipId))
            members.append(contentsOf: page.filter { !known.contains($0.membershipId) })
        }

        // A page that came back empty means the cursor is spent even if the
        // server still advertised `hasMore` — never loop on an empty page.
        nextOffset = page.isEmpty ? nil : response.pagination?.nextOffset
        hasMore = nextOffset != nil

        // Full-empty is a property of the whole audience, not the current
        // filter, so it keys off the unfiltered counts.
        if parsed.totalActive == 0, parsed.pending == 0 {
            state = .empty
            return
        }

        let pending = members.filter(\.isPending)
        let groups = Self.groupByTier(members.filter { !$0.isPending }, names: tierNames)
        state = .loaded(AudienceLoaded(counts: parsed, pending: pending, tierGroups: groups))
    }

    // MARK: - Actions

    public func approve(_ member: AudienceMember) async {
        await perform(.approve, on: member)
    }

    public func decline(_ member: AudienceMember) async {
        await beginDestructive(.decline, on: member)
    }

    public func remove(_ member: AudienceMember) async {
        overflowTarget = nil
        await beginDestructive(.remove, on: member)
    }

    // MARK: - Destructive actions (optimistic + undo window)

    /// RN's destructive path: drop the row immediately, raise a 5-second
    /// "Tap to undo" toast, and only fire the `PATCH` once the window
    /// closes (`src/app/audience/members.tsx:95-121`). A second destructive
    /// tap commits the first one rather than dropping it on the floor.
    private func beginDestructive(_ action: AudienceMemberAction, on member: AudienceMember) async {
        await flushPendingUndo()

        undoSnapshot = (members, counts, state)
        queuedAction = (action, member)
        removeRowOptimistically(member)
        pendingUndo = PendingAudienceUndo(
            membershipId: member.membershipId,
            message: "\(Self.destructiveVerb(action)) \(member.handle) · Tap to undo"
        )

        undoTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.undoWindowNanoseconds)
            guard !Task.isCancelled else { return }
            await self?.commitQueuedAction()
        }
    }

    /// Undo tap — restores the row and never sends the request.
    public func undoPendingAction() {
        guard pendingUndo != nil else { return }
        undoTask?.cancel()
        undoTask = nil
        queuedAction = nil
        pendingUndo = nil
        restoreSnapshot()
    }

    /// Commit whatever the undo window is holding, right now.
    private func flushPendingUndo() async {
        guard queuedAction != nil else { return }
        undoTask?.cancel()
        undoTask = nil
        await commitQueuedAction()
    }

    private func commitQueuedAction() async {
        guard let queued = queuedAction else { return }
        queuedAction = nil
        pendingUndo = nil
        undoTask = nil
        do {
            _ = try await api.request(
                AudienceProfileEndpoints.memberAction(
                    membershipId: queued.member.membershipId,
                    action: queued.action.rawValue
                ),
                as: AudienceMemberActionResponse.self
            )
            undoSnapshot = nil
            // Re-fetch for authoritative counts + grouping.
            await fetch()
        } catch {
            // RN restores the row and shows a fixed retry message.
            restoreSnapshot()
            toast = "Could not complete action. Try again."
        }
    }

    /// Drop the row from the local page and decrement the matching count
    /// so the chips and the nav count line stay honest during the window.
    private func removeRowOptimistically(_ member: AudienceMember) {
        members.removeAll { $0.membershipId == member.membershipId }
        var next = counts
        if member.isPending {
            next.pending = max(0, next.pending - 1)
        } else {
            next.totalActive = max(0, next.totalActive - 1)
            next.byTier[member.tierRank] = max(0, (next.byTier[member.tierRank] ?? 1) - 1)
        }
        counts = next
        guard next.totalActive > 0 || next.pending > 0 else {
            state = .empty
            return
        }
        state = .loaded(
            AudienceLoaded(
                counts: next,
                pending: members.filter(\.isPending),
                tierGroups: Self.groupByTier(members.filter { !$0.isPending }, names: tierNames)
            )
        )
    }

    private func restoreSnapshot() {
        guard let snapshot = undoSnapshot else { return }
        members = snapshot.members
        counts = snapshot.counts
        state = snapshot.state
        undoSnapshot = nil
    }

    private static func destructiveVerb(_ action: AudienceMemberAction) -> String {
        action == .decline ? "Declined" : "Removed"
    }

    /// Overflow → Mute. Reversible: the member stays subscribed but stops
    /// receiving broadcasts (RN `src/components/audience/AudienceMemberSheet.tsx:89-98`).
    public func mute(_ member: AudienceMember) async {
        overflowTarget = nil
        await perform(.mute, on: member)
    }

    /// Overflow → Unmute. Restores broadcast delivery.
    public func unmute(_ member: AudienceMember) async {
        overflowTarget = nil
        await perform(.unmute, on: member)
    }

    /// Overflow → Block. Opens the destructive confirm; the PATCH only
    /// fires from `confirmBlock()`.
    public func requestBlock(_ member: AudienceMember) {
        overflowTarget = nil
        blockTarget = member
    }

    /// Commits the block via `PATCH /personas/:id/followers/:membershipId
    /// { status: "blocked" }` — the `/me/audience` action verbs have no
    /// block, so this is the only route that can set the status.
    public func confirmBlock(_ member: AudienceMember) async {
        blockTarget = nil
        guard let personaId else {
            toast = "Couldn't block \(member.displayName) — reload and try again."
            return
        }
        do {
            _ = try await api.request(
                AudienceProfileEndpoints.followerStatus(
                    personaId: personaId,
                    followId: member.membershipId,
                    status: "blocked"
                ),
                as: AudienceFollowerUpdateResponse.self
            )
            await fetch()
            toast = "Blocked \(member.displayName)."
        } catch {
            toast = (error as? APIError)?.errorDescription
                ?? "Couldn't block \(member.displayName)."
        }
    }

    /// Confirm-dialog body. Mirrors RN's copy
    /// (`src/app/identity/persona.tsx:600-604`).
    public func blockConfirmationMessage(for member: AudienceMember) -> String {
        "Block \(member.displayName) from this Beacon? They will lose access to follower-only updates."
    }

    /// Overflow → Message. No PII (user id) is exposed by the creator
    /// serializer, so a direct thread can't be opened from here yet.
    public func message(_ member: AudienceMember) {
        overflowTarget = nil
        toast = "Messaging \(member.displayName) is coming soon."
    }

    /// Overflow → Change tier. Tier moves aren't wired on mobile yet.
    public func changeTier(_: AudienceMember) {
        overflowTarget = nil
        toast = "Changing tiers is coming soon."
    }

    private func perform(_ action: AudienceMemberAction, on member: AudienceMember) async {
        do {
            _ = try await api.request(
                AudienceProfileEndpoints.memberAction(
                    membershipId: member.membershipId,
                    action: action.rawValue
                ),
                as: AudienceMemberActionResponse.self
            )
            // Re-fetch for authoritative counts + grouping (approve moves a
            // row from pending into its tier group; decline/remove drop it).
            await fetch()
            toast = Self.confirmation(for: action, member: member)
        } catch {
            toast = (error as? APIError)?.errorDescription
                ?? "Couldn't update \(member.displayName)."
        }
    }

    // MARK: - Derived view data

    /// Nav-bar count line — "5 members · 2 pending" / "0 members".
    public var countLine: String {
        if counts.totalActive == 0, counts.pending == 0 {
            return "0 members"
        }
        let memberWord = counts.totalActive == 1 ? "member" : "members"
        return "\(counts.totalActive) \(memberWord) · \(counts.pending) pending"
    }

    /// One chip per tier with a non-zero count, premium first (matches the
    /// design's VIP-before-Insiders order).
    public var tierChips: [AudienceTierChip] {
        counts.byTier
            .filter { $0.value > 0 }
            .keys
            .sorted(by: >)
            .map { rank in
                AudienceTierChip(
                    rank: rank,
                    name: tierNames[rank] ?? AudienceTierStyle.defaultName(rank: rank),
                    count: counts.byTier[rank] ?? 0
                )
            }
    }

    // MARK: - Helpers

    static func byTier(_ raw: [String: Int]?) -> [Int: Int] {
        var result: [Int: Int] = [:]
        for (key, value) in raw ?? [:] {
            if let rank = Int(key) { result[rank] = value }
        }
        return result
    }

    static func groupByTier(_ members: [AudienceMember], names: [Int: String]) -> [AudienceTierGroup] {
        Dictionary(grouping: members, by: \.tierRank)
            .map { rank, members in
                AudienceTierGroup(
                    rank: rank,
                    name: names[rank] ?? members.first?.tierName ?? AudienceTierStyle.defaultName(rank: rank),
                    members: members
                )
            }
            .sorted { $0.rank > $1.rank }
    }

    private static func confirmation(for action: AudienceMemberAction, member: AudienceMember) -> String {
        switch action {
        case .approve: "Approved \(member.displayName)."
        case .decline: "Declined \(member.displayName)."
        case .remove: "Removed \(member.displayName)."
        case .mute: "Muted \(member.displayName)."
        case .unmute: "Unmuted \(member.displayName)."
        }
    }
}

#if DEBUG
extension YourAudienceViewModel {
    /// Preview/snapshot factory — seeds the published state directly so
    /// previews don't hit the network. Setters are file-private, so this
    /// lives alongside the view-model.
    static func preview(
        _ state: YourAudienceState,
        counts: AudienceCounts,
        tierNames: [Int: String] = [:]
    ) -> YourAudienceViewModel {
        let viewModel = YourAudienceViewModel()
        viewModel.state = state
        viewModel.counts = counts
        viewModel.tierNames = tierNames
        return viewModel
    }
}
#endif
