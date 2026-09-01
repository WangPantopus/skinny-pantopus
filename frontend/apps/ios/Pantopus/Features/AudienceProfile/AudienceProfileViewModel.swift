//
//  AudienceProfileViewModel.swift
//  Pantopus
//
//  Backs the T3.3 Public Profile management screen — three tabs
//  (Updates / Followers / Threads) plus the owner-side composer that
//  POSTs to `/api/broadcast/channels/:id/messages`. Loads a parallel
//  bundle of GETs; an empty `/api/personas/me` response transitions
//  the screen to `.empty` so the host can offer the Public Profile
//  setup CTA from the firewall doc §6.2.
//

// swiftlint:disable function_parameter_count

import Foundation
import Observation

@Observable
@MainActor
public final class AudienceProfileViewModel {
    public private(set) var state: AudienceProfileState = .loading
    public var activeTab: AudienceProfileTab = .updates
    public var selectedTierRank: Int?
    public var followerSearchText: String = ""
    public var followerSort: FollowerSort = .newestActive
    public var activeThreadFilter: ThreadsFilter = .all
    public var composer: UpdateComposerState = .init()

    private let api: APIClient
    /// Exposed so the host can route the full Compose Broadcast surface
    /// (`YouRoute.composeBroadcast(personaId:)`) with the persona id.
    public private(set) var personaId: String?
    private var personaHandle: String?
    private var channelId: String?

    init(api: APIClient = .shared) {
        self.api = api
    }

    public func load() async {
        state = .loading
        composer.error = nil
        do {
            let me: PersonaMeResponse = try await api.request(AudienceProfileEndpoints.me)
            guard let persona = me.persona, let handle = persona.handle else {
                state = .empty(message: "Set up payments, invite your first followers, and send a broadcast when you're ready.")
                return
            }
            personaId = persona.id
            personaHandle = handle
            channelId = me.channel?.id

            // Sequential GETs — the per-screen latency hit is small
            // and the deterministic order keeps the
            // SequencedURLProtocol-based tests off the flaky-async-
            // ordering edge.
            let audience: AudienceListResponse =
                try await api.request(AudienceProfileEndpoints.audience())
            let posts: PersonaPostsResponse =
                try await api.request(AudienceProfileEndpoints.posts(handle: handle))
            let tiers: PersonaTiersResponse =
                try await api.request(AudienceProfileEndpoints.tiers(handle: handle))
            let stats: MembershipStatsResponse =
                try await api.request(AudienceProfileEndpoints.membershipStats(personaId: persona.id))
            let threadsResp: PersonaThreadsResponse =
                try await api.request(AudienceProfileEndpoints.threads(personaId: persona.id))

            state = .loaded(
                Self.project(
                    persona: persona,
                    audience: audience,
                    posts: posts.posts,
                    tiers: tiers.tiers,
                    stats: stats.counts,
                    threads: threadsResp.threads,
                    channelId: me.channel?.id
                )
            )
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load Public Profile."
            state = .error(message: message)
        }
    }

    public func selectTab(_ tab: AudienceProfileTab) {
        activeTab = tab
    }

    public func selectTierFilter(_ rank: Int?) {
        selectedTierRank = rank
    }

    public func selectFollowerSort(_ sort: FollowerSort) {
        followerSort = sort
    }

    public func selectThreadFilter(_ filter: ThreadsFilter) {
        activeThreadFilter = filter
    }

    /// POST the composer's body to the persona's broadcast channel.
    /// On success the composer text clears and `load()` reruns so the
    /// updates feed picks up the new row.
    public func submitUpdate() async {
        guard composer.canSubmit, let channelId else { return }
        let snapshot = composer
        composer.isSubmitting = true
        composer.error = nil
        let body = PublishUpdateBody(
            body: snapshot.text.trimmingCharacters(in: .whitespacesAndNewlines),
            visibility: snapshot.visibility.rawValue,
            targetTierRank: snapshot.visibility == .tierOrAbove ? snapshot.targetTierRank : nil
        )
        do {
            let _: PublishUpdateResponse = try await api.request(
                AudienceProfileEndpoints.publishUpdate(channelId: channelId, body: body)
            )
            composer = UpdateComposerState(visibility: snapshot.visibility, targetTierRank: snapshot.targetTierRank)
            await load()
        } catch {
            composer.isSubmitting = false
            composer.error = (error as? APIError)?.errorDescription ?? "Couldn't post update."
        }
    }

    /// Followers narrowed by `selectedTierRank`, then `followerSearchText`
    /// (display name + handle, case-insensitive), then ordered by
    /// `followerSort`. The default sort `.newestActive` preserves the
    /// natural API order — the backend already serves most-recently-
    /// active first.
    public var visibleFollowers: [FollowerRowContent] {
        guard case let .loaded(loaded) = state else { return [] }
        var rows = loaded.followers
        if let rank = selectedTierRank {
            rows = rows.filter { $0.tierRank == rank }
        }
        let query = followerSearchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !query.isEmpty {
            rows = rows.filter { row in
                row.displayName.lowercased().contains(query)
                    || row.handle.lowercased().contains(query)
            }
        }
        return Self.sortFollowers(rows, by: followerSort)
    }

    /// Threads filtered by `activeThreadFilter`.
    public var visibleThreads: [ThreadRowContent] {
        guard case let .loaded(loaded) = state else { return [] }
        return loaded.threads.filter { Self.matchesThreadFilter($0, filter: activeThreadFilter) }
    }

    static func matchesThreadFilter(_ row: ThreadRowContent, filter: ThreadsFilter) -> Bool {
        switch filter {
        case .all: true
        case .unread: row.unreadCount > 0
        case .bronzePlus: row.tierRank >= 2
        case .flagged: row.flagged
        }
    }

    // MARK: - Projection

    static func project(
        persona: PersonaSummaryDTO,
        audience: AudienceListResponse,
        posts: [PersonaPostDTO],
        tiers: [PersonaTierDTO],
        stats: MembershipStatsCounts,
        threads: [PersonaThreadDTO],
        channelId: String?
    ) -> AudienceProfileLoaded {
        let header = AudienceHeaderContent(
            displayName: persona.displayName ?? persona.handle ?? "Public Profile",
            handle: persona.handle.map { "@\($0)" },
            followerCount: audience.counts.totalActive ?? persona.followerCount ?? 0,
            newThisWeek: audience.counts.pending ?? 0,
            postCount: persona.postCount ?? posts.count
        )
        let updates = posts.compactMap(Self.updateCard)
        let analytics = analyticsCells(stats: stats)
        let breakdown = tierBreakdown(counts: audience.counts, tiers: tiers)
        let chips = tierChips(counts: audience.counts, tiers: tiers)
        let followers = audience.items.compactMap(Self.followerRow)
        let threadRows = threads.compactMap(Self.threadRow)
        let threadsFilterChips = Self.threadsFilterChips(threads: threadRows)
        return AudienceProfileLoaded(
            header: header,
            updates: updates,
            analyticsCells: analytics,
            tierBreakdown: breakdown,
            tierChips: chips,
            followers: followers,
            threads: threadRows,
            threadsFilterChips: threadsFilterChips,
            channelId: channelId
        )
    }

    static func threadsFilterChips(threads: [ThreadRowContent]) -> [ThreadsFilterChipContent] {
        let total = threads.count
        let unread = threads.filter { $0.unreadCount > 0 }.count
        let bronzePlus = threads.filter { $0.tierRank >= 2 }.count
        return [
            ThreadsFilterChipContent(filter: .all, count: total),
            ThreadsFilterChipContent(filter: .unread, count: unread),
            ThreadsFilterChipContent(filter: .bronzePlus, count: bronzePlus),
            ThreadsFilterChipContent(filter: .flagged, count: nil)
        ]
    }

    private static func updateCard(_ dto: PersonaPostDTO) -> UpdateCardContent? {
        let visibility = UpdateVisibility(rawValue: dto.visibility ?? "followers") ?? .followers
        return UpdateCardContent(
            id: dto.id,
            body: dto.body ?? "",
            timeAgo: timeAgo(from: dto.createdAt),
            visibility: visibility,
            targetTierRank: dto.targetTierRank,
            deliveredCount: dto.deliveredCount ?? 0,
            readCount: dto.readCount ?? 0
        )
    }

    private static func analyticsCells(stats: MembershipStatsCounts) -> [AnalyticsCellContent] {
        [
            AnalyticsCellContent(id: "followers", label: "Followers", value: "\(stats.followers ?? 0)"),
            AnalyticsCellContent(id: "members", label: "Members", value: "\(stats.members ?? 0)"),
            AnalyticsCellContent(id: "insiders", label: "Insiders", value: "\(stats.insiders ?? 0)"),
            AnalyticsCellContent(id: "direct", label: "Direct", value: "\(stats.direct ?? 0)")
        ]
    }

    private static func tierBreakdown(
        counts: AudienceCountsDTO,
        tiers: [PersonaTierDTO]
    ) -> TierBreakdownContent {
        let byTier = counts.byTier ?? [:]
        let sortedTiers = tiers.sorted { $0.rank < $1.rank }
        var segments: [TierBreakdownContent.TierSegment] = []
        for tier in sortedTiers {
            let count = byTier[String(tier.rank)] ?? 0
            segments.append(
                TierBreakdownContent.TierSegment(
                    id: tier.id,
                    rank: tier.rank,
                    name: tier.name,
                    count: count
                )
            )
        }
        let total = segments.reduce(0) { $0 + $1.count }
        return TierBreakdownContent(total: total, segments: segments)
    }

    private static func tierChips(
        counts: AudienceCountsDTO,
        tiers: [PersonaTierDTO]
    ) -> [TierChipContent] {
        let byTier = counts.byTier ?? [:]
        let total = (counts.totalActive ?? 0)
        var chips: [TierChipContent] = [
            TierChipContent(id: "all", rank: nil, label: "All", count: total)
        ]
        for tier in tiers.sorted(by: { $0.rank < $1.rank }) {
            let count = byTier[String(tier.rank)] ?? 0
            chips.append(
                TierChipContent(id: "tier_\(tier.rank)", rank: tier.rank, label: tier.name, count: count)
            )
        }
        return chips
    }

    private static func followerRow(_ dto: FanDTO) -> FollowerRowContent? {
        guard let handle = dto.fanHandle else { return nil }
        let rank = dto.tier?.rank ?? 1
        let tierName = dto.tier?.name ?? "Follower"
        let tenure = dto.tenureMonths.map { months -> String in
            months <= 0 ? "Just joined" : (months == 1 ? "1 mo." : "\(months) mo.")
        }
        return FollowerRowContent(
            id: dto.id,
            displayName: dto.fanDisplayName ?? handle,
            handle: "@\(handle)",
            avatarUrl: dto.fanAvatarUrl,
            tierName: tierName,
            tierRank: rank,
            tenureLabel: tenure,
            tenureMonths: dto.tenureMonths,
            joinedMonth: dto.joinedMonth,
            verifiedLocal: dto.verifiedLocal ?? false
        )
    }

    private static func threadRow(_ dto: PersonaThreadDTO) -> ThreadRowContent? {
        let handle = dto.fanHandle ?? ""
        return ThreadRowContent(
            id: dto.id,
            displayName: dto.fanDisplayName ?? (handle.isEmpty ? "Follower" : handle),
            handle: handle.isEmpty ? "" : "@\(handle)",
            avatarUrl: dto.fanAvatarUrl,
            tierName: dto.tier?.name,
            tierRank: dto.tier?.rank ?? 1,
            preview: dto.lastMessagePreview ?? "",
            timeAgo: timeAgo(from: dto.lastMessageAt),
            unreadCount: dto.unreadCount ?? 0,
            flagged: dto.flagged ?? false
        )
    }

    private static func timeAgo(from iso: String?) -> String {
        guard let iso, let date = ISO8601DateFormatter().date(from: iso) else { return "" }
        let interval = Date().timeIntervalSince(date)
        let minutes = Int(interval / 60)
        if minutes < 1 { return "Just now" }
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        if days < 7 { return "\(days)d ago" }
        let weeks = days / 7
        return "\(weeks)w ago"
    }
}

extension AudienceProfileViewModel {
    /// Orders followers per the chosen sort. `.newestActive` preserves the
    /// backend's natural order; other sorts use a stable tie-break on the
    /// original index so equal keys keep their relative position.
    static func sortFollowers(
        _ rows: [FollowerRowContent],
        by sort: FollowerSort
    ) -> [FollowerRowContent] {
        if sort == .newestActive { return rows }
        let indexed = Array(rows.enumerated())
        switch sort {
        case .newestActive:
            return rows
        case .highestTier:
            return indexed
                .sorted { lhs, rhs in
                    if lhs.element.tierRank != rhs.element.tierRank {
                        return lhs.element.tierRank > rhs.element.tierRank
                    }
                    return lhs.offset < rhs.offset
                }
                .map(\.element)
        case .recentlyJoined:
            return indexed
                .sorted { lhs, rhs in
                    let lhsKey = lhs.element.tenureMonths ?? Int.max
                    let rhsKey = rhs.element.tenureMonths ?? Int.max
                    if lhsKey != rhsKey { return lhsKey < rhsKey }
                    return lhs.offset < rhs.offset
                }
                .map(\.element)
        case .mostEngaged:
            return indexed
                .sorted { lhs, rhs in
                    if lhs.element.tierRank != rhs.element.tierRank {
                        return lhs.element.tierRank > rhs.element.tierRank
                    }
                    let lhsKey = lhs.element.tenureMonths ?? -1
                    let rhsKey = rhs.element.tenureMonths ?? -1
                    if lhsKey != rhsKey { return lhsKey > rhsKey }
                    return lhs.offset < rhs.offset
                }
                .map(\.element)
        }
    }
}
