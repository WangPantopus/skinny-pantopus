//
//  BeaconProfileViewModel.swift
//  Pantopus
//
//  A21.1 — the public Beacon profile, wired to the *persona* backend.
//  One screen, two roles:
//
//    - `.owner`           → "My Beacon" (drawer). Loads `GET /personas/me`.
//                           Shows the owner analytics strip, Edit, and the
//                           broadcast composer CTA. No persona yet → empty
//                           setup state.
//    - `.visitor(handle)` → someone else's Beacon (Following row, deep link).
//                           Loads `GET /personas/:handle`. Shows Follow /
//                           Following + locked tier-gated broadcasts.
//
//  Mirrors the React Native `app/identity/persona.tsx` (owner) and
//  `app/persona/[personaHandle]/index.tsx` (visitor) behaviour. Projects
//  onto the shared `PublicProfileChrome` content model so the design's
//  banner + identity block + broadcast cards are reused verbatim.
//

import Foundation
import Logging
import Observation

// swiftlint:disable file_length type_body_length

/// Which Beacon, and from whose vantage point.
public enum BeaconProfileMode: Sendable, Equatable, Hashable {
    /// The signed-in user's own Beacon — loaded from `/personas/me`.
    case owner
    /// Another user's Beacon by handle — loaded from `/personas/:handle`.
    case visitor(handle: String)
}

/// The tab strip beneath the identity block.
public enum BeaconProfileTab: String, Sendable, Equatable, Hashable, CaseIterable {
    case broadcasts
    case about
    case tiers
}

/// Visitor follow relationship, projected from the persona `viewer` blob.
public enum BeaconFollowStatus: String, Sendable, Equatable, Hashable {
    case none
    case pending
    case active
}

/// Render state for the Beacon profile screen.
public enum BeaconProfileState: Sendable, Equatable {
    case loading
    case loaded(BeaconProfileContent)
    /// Owner has not created a Beacon yet — render the setup invitation.
    case empty
    case error(message: String)
}

/// One subscription tier on the Tiers tab.
public struct BeaconTier: Sendable, Equatable, Hashable, Identifiable {
    public let id: String
    public let rank: Int
    public let name: String
    public let priceLabel: String
    public let detail: String?

    public init(id: String, rank: Int, name: String, priceLabel: String, detail: String?) {
        self.id = id
        self.rank = rank
        self.name = name
        self.priceLabel = priceLabel
        self.detail = detail
    }
}

/// One labelled link on the About tab.
public struct BeaconLink: Sendable, Equatable, Hashable, Identifiable {
    public var id: String {
        "\(label)|\(url)"
    }

    public let label: String
    public let url: String
}

/// Hydrated content emitted by `BeaconProfileViewModel`.
public struct BeaconProfileContent: Sendable, Equatable, Hashable {
    public let personaId: String
    public let channelId: String?
    public let isOwner: Bool
    public let handle: String
    public let displayName: String
    public let header: PublicProfileHeader
    public let stats: [ProfileStatCell]
    public let bio: String?
    public let categoryLabel: String?
    public let audienceLabel: String
    public let audienceModeLabel: String?
    public let links: [BeaconLink]
    public let posts: [PublicProfilePost]
    public let tiers: [BeaconTier]
    public let broadcastEnabled: Bool
    public let shareURL: String
    /// Raw follower count, kept alongside the formatted "Beacons" stat so the
    /// optimistic follow/unfollow bump recomputes from the number — not the
    /// compacted display string (which would turn "1.2K" into "13").
    public let followerCount: Int

    public init(
        personaId: String,
        channelId: String?,
        isOwner: Bool,
        handle: String,
        displayName: String,
        header: PublicProfileHeader,
        stats: [ProfileStatCell],
        bio: String?,
        categoryLabel: String?,
        audienceLabel: String,
        audienceModeLabel: String?,
        links: [BeaconLink],
        posts: [PublicProfilePost],
        tiers: [BeaconTier],
        broadcastEnabled: Bool,
        shareURL: String,
        followerCount: Int
    ) {
        self.personaId = personaId
        self.channelId = channelId
        self.isOwner = isOwner
        self.handle = handle
        self.displayName = displayName
        self.header = header
        self.stats = stats
        self.bio = bio
        self.categoryLabel = categoryLabel
        self.audienceLabel = audienceLabel
        self.audienceModeLabel = audienceModeLabel
        self.links = links
        self.posts = posts
        self.tiers = tiers
        self.broadcastEnabled = broadcastEnabled
        self.shareURL = shareURL
        self.followerCount = followerCount
    }
}

/// View-model for the public Beacon profile screen.
@MainActor
@Observable
public final class BeaconProfileViewModel {
    public private(set) var state: BeaconProfileState = .loading

    /// Locally-held tab selection — switching never refetches.
    public var selectedTab: BeaconProfileTab = .broadcasts

    /// Visitor follow relationship. Owner mode leaves this `.none`.
    public private(set) var followStatus: BeaconFollowStatus = .none
    public private(set) var notificationsEnabled: Bool = false

    /// In-flight guard for follow / unfollow / preference toggles.
    public private(set) var followBusy: Bool = false

    /// Transient toast surface for action feedback.
    public var toastMessage: String?

    /// Drives the visitor follow handshake sheet.
    public var showFollowHandshake: Bool = false
    /// Pre-selects a paid tier when unlocking a locked broadcast.
    public var handshakePreselectedTierRank: Int?

    private let mode: BeaconProfileMode
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.BeaconProfile")
    /// Broadcast ids already reported as read this session, so a pull-to-
    /// refresh doesn't double-count. RN keeps the same `Set` in a ref
    /// (`src/app/persona/[personaHandle]/index.tsx:61`).
    private var markedBroadcastIds: Set<String> = []

    init(mode: BeaconProfileMode, client: APIClient = .shared) {
        self.mode = mode
        self.client = client
    }

    public var isOwner: Bool {
        if case .owner = mode { return true }
        return false
    }

    /// The handle currently loaded (for the follow handshake + share).
    public private(set) var loadedHandle: String = ""
    public private(set) var loadedPersonaId: String = ""

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    // MARK: - Fetch

    private func fetch() async {
        do {
            let envelope = try await loadPersonaEnvelope()
            guard let persona = envelope.persona else {
                // Owner with no Beacon yet → setup invitation. A visitor
                // hitting a missing persona is a not-found error instead.
                state = isOwner ? .empty : .error(message: "Beacon not found.")
                return
            }
            loadedHandle = persona.handle ?? ""
            loadedPersonaId = persona.id
            projectViewer(persona.viewer)

            // Posts + tiers fetch by handle, in order. Failures degrade to
            // empties rather than failing the whole screen.
            let posts = await loadPosts(handle: loadedHandle)
            let tiers = await loadTiers(handle: loadedHandle)

            state = .loaded(build(persona: persona, channel: envelope.channel, posts: posts, tiers: tiers))
            markBroadcastsRead(posts, viewer: persona.viewer)
        } catch let error as APIError {
            logger.warning("Beacon load failed: \(error)")
            state = .error(message: friendlyMessage(for: error))
        } catch {
            logger.warning("Beacon load failed: \(error)")
            state = .error(message: "Something went wrong.")
        }
    }

    private func loadPersonaEnvelope() async throws -> BeaconPersonaResponse {
        switch mode {
        case .owner:
            return try await client.request(
                AudienceProfileEndpoints.me,
                as: BeaconPersonaResponse.self
            )
        case let .visitor(handle):
            let clean = handle.hasPrefix("@") ? String(handle.dropFirst()) : handle
            return try await client.request(
                PrivacyHandshakeEndpoints.persona(handle: clean),
                as: BeaconPersonaResponse.self
            )
        }
    }

    private func loadPosts(handle: String) async -> [BeaconPostDTO] {
        guard !handle.isEmpty else { return [] }
        do {
            let res = try await client.request(
                AudienceProfileEndpoints.posts(handle: handle),
                as: BeaconPostsResponse.self
            )
            return res.posts
        } catch {
            logger.debug("Beacon posts load failed: \(error)")
            return []
        }
    }

    private func loadTiers(handle: String) async -> [PersonaTierDTO] {
        guard !handle.isEmpty else { return [] }
        do {
            let res = try await client.request(
                AudienceProfileEndpoints.tiers(handle: handle),
                as: PersonaTiersResponse.self
            )
            return res.tiers
        } catch {
            logger.debug("Beacon tiers load failed: \(error)")
            return []
        }
    }

    // MARK: - Read receipts

    /// Report every broadcast the viewer just saw as read. Fire-and-forget:
    /// the increment feeds the creator's read-count analytics, so a failure
    /// must never surface to the fan. The owner's own views are skipped
    /// (the backend ignores them anyway) and a locked / tier-gated row is
    /// skipped because the viewer never actually read it.
    ///
    /// Mirrors RN `markBroadcastPostsRead`
    /// (`src/app/persona/[personaHandle]/index.tsx:63-72`).
    private func markBroadcastsRead(_ posts: [BeaconPostDTO], viewer: BeaconViewerDTO?) {
        guard !isOwner, !(viewer?.isOwner ?? false) else { return }
        let eligible = posts.filter { post in
            guard let channelId = post.broadcastChannelId, !channelId.isEmpty else { return false }
            guard post.locked != true else { return false }
            return !markedBroadcastIds.contains(post.id)
        }
        guard !eligible.isEmpty else { return }
        for post in eligible {
            markedBroadcastIds.insert(post.id)
        }
        Task { [weak self] in
            guard let self else { return }
            for post in eligible {
                do {
                    _ = try await client.request(
                        BroadcastReadEndpoints.markRead(messageId: post.id),
                        as: EmptyResponse.self
                    )
                } catch {
                    // Let a later visit retry this one.
                    markedBroadcastIds.remove(post.id)
                    logger.debug("Broadcast read receipt failed for \(post.id): \(error)")
                }
            }
        }
    }

    // MARK: - Actions

    /// Visitor Follow. Tier-1 (free) follows route through the privacy
    /// handshake wizard, mirroring the RN `/persona/:handle/follow` flow.
    /// Owner mode and already-following are no-ops.
    public func follow() {
        guard !isOwner, !followBusy, followStatus == .none else { return }
        handshakePreselectedTierRank = nil
        showFollowHandshake = true
    }

    /// Visitor unlock on a tier-gated broadcast — opens the privacy
    /// handshake with the post's target tier pre-selected.
    public func unlockBroadcast(tierRank: Int?) {
        guard !isOwner else { return }
        handshakePreselectedTierRank = tierRank
        showFollowHandshake = true
    }

    public func clearHandshakeTier() {
        handshakePreselectedTierRank = nil
    }

    public func unfollow() async {
        guard !isOwner, !followBusy, followStatus != .none, !loadedPersonaId.isEmpty else { return }
        followBusy = true
        defer { followBusy = false }
        do {
            _ = try await client.request(
                FollowingEndpoints.unfollow(personaId: loadedPersonaId),
                as: EmptyResponse.self
            )
            followStatus = .none
            notificationsEnabled = false
            toastMessage = "Unfollowed"
            if case let .loaded(content) = state {
                state = .loaded(content.bumpingFollowers(by: -1))
            }
        } catch {
            logger.warning("Unfollow failed: \(error)")
            toastMessage = "Couldn't unfollow."
        }
    }

    /// Toggle "notify when live" for an active follower.
    public func toggleNotifications() async {
        guard followStatus == .active, !followBusy, !loadedPersonaId.isEmpty else { return }
        followBusy = true
        defer { followBusy = false }
        let next = notificationsEnabled ? "none" : "all"
        do {
            _ = try await client.request(
                PrivacyHandshakeEndpoints.updatePreferences(
                    personaId: loadedPersonaId,
                    body: FollowPreferencesBody(notificationLevel: next)
                ),
                as: EmptyResponse.self
            )
            notificationsEnabled.toggle()
        } catch {
            logger.warning("Notification preference failed: \(error)")
            toastMessage = "Couldn't update notifications."
        }
    }

    // MARK: - Projection

    private func projectViewer(_ viewer: BeaconViewerDTO?) {
        guard let viewer, !(viewer.isOwner ?? false) else {
            followStatus = .none
            notificationsEnabled = false
            return
        }
        switch viewer.followStatus {
        case "pending": followStatus = .pending
        case "active", "muted": followStatus = .active
        default: followStatus = (viewer.isFollowing ?? false) ? .active : .none
        }
        notificationsEnabled = followStatus == .active && (viewer.notificationLevel ?? "all") != "none"
    }

    private func build(
        persona: BeaconPersonaDTO,
        channel: BroadcastChannelDTO?,
        posts: [BeaconPostDTO],
        tiers: [PersonaTierDTO]
    ) -> BeaconProfileContent {
        let displayName = persona.displayName ?? persona.handle ?? "Beacon"
        let handle = persona.handle ?? ""
        let audienceLabel = (persona.audienceLabel ?? "followers").capitalizedFirst
        let isVerified = persona.credential?.status == "verified"

        let header = PublicProfileHeader(
            displayName: displayName,
            handle: handle.isEmpty ? nil : handle,
            locality: nil,
            avatarURL: persona.avatarUrl.flatMap(URL.init(string:)),
            isVerified: isVerified,
            identityBadges: [],
            tierLabel: isVerified ? "Persona · Verified" : "Persona · New",
            isVerifiedNeighbor: false
        )

        return BeaconProfileContent(
            personaId: persona.id,
            channelId: channel?.id,
            isOwner: isOwner,
            handle: handle,
            displayName: displayName,
            header: header,
            stats: buildStats(persona: persona),
            bio: persona.bio,
            categoryLabel: persona.category.map { titleCase($0) },
            audienceLabel: audienceLabel,
            audienceModeLabel: audienceModeLabel(persona.audienceMode),
            links: (persona.publicLinks ?? []).compactMap { link in
                guard let label = link.label, let url = link.url, !label.isEmpty, !url.isEmpty else { return nil }
                return BeaconLink(label: label, url: url)
            },
            posts: posts.map { project(post: $0) },
            tiers: tiers.map { project(tier: $0) },
            broadcastEnabled: persona.broadcastEnabled ?? (channel != nil),
            shareURL: handle.isEmpty ? "https://pantopus.com" : "https://pantopus.com/@\(handle)",
            followerCount: persona.followerCount ?? 0
        )
    }

    private func buildStats(persona: BeaconPersonaDTO) -> [ProfileStatCell] {
        // Two real stats only — the design's third cell ("Member" / "Mo.
        // revenue") has no field on the persona serializer, so it is omitted
        // rather than fabricated.
        [
            ProfileStatCell(id: "beacons", value: beaconCompactCount(persona.followerCount ?? 0), label: "Beacons"),
            ProfileStatCell(id: "broadcasts", value: beaconCompactCount(persona.postCount ?? 0), label: "Broadcasts")
        ]
    }

    private func project(post: BeaconPostDTO) -> PublicProfilePost {
        // One lock verdict drives both the paywall chrome and the media
        // suppression: `/personas/:handle/posts` hands back the `media_*`
        // arrays on gated rows too, so dropping the items here is the only
        // thing keeping a paid attachment off a non-member's screen.
        let isLockedForViewer = !isOwner && (post.locked ?? false)
        return PublicProfilePost(
            id: post.id,
            body: post.locked == true ? (post.teaser ?? "") : (post.body ?? ""),
            media: isLockedForViewer ? [] : PostMediaItem.items(
                urls: post.mediaUrls ?? [],
                types: post.mediaTypes,
                thumbnails: post.mediaThumbnails,
                liveURLs: post.mediaLiveURLs
            ),
            timeAgo: timeAgo(post.createdAt),
            locality: nil,
            reactions: post.reactions ?? 0,
            replies: post.replies ?? 0,
            visibility: visibility(post.visibility, rank: post.targetTierRank),
            isLocked: isLockedForViewer,
            targetTierRank: post.targetTierRank,
            intent: nil
        )
    }

    private func project(tier: PersonaTierDTO) -> BeaconTier {
        let price: String
        if let cents = tier.priceCents, cents > 0 {
            let dollars = Double(cents) / 100
            let symbol = (tier.currency ?? "usd").uppercased() == "USD" ? "$" : ""
            price = dollars.truncatingRemainder(dividingBy: 1) == 0
                ? "\(symbol)\(Int(dollars))/mo"
                : String(format: "\(symbol)%.2f/mo", dollars)
        } else {
            price = "Free"
        }
        return BeaconTier(id: tier.id, rank: tier.rank, name: tier.name, priceLabel: price, detail: tier.description)
    }

    /// Maps a broadcast's tier-gating onto the design's visibility chip.
    /// The `/personas/:handle/posts` endpoint returns raw `Post` rows whose
    /// `visibility` enum can never be a tier string (the DB CHECK forbids
    /// `tier_or_above`/`subscribers`), so the source of truth is
    /// `target_tier_rank` — mirrors the RN derivation. The string branch
    /// stays as a defensive fallback for a future broadcast serializer.
    private func visibility(_ raw: String?, rank: Int?) -> PublicProfilePost.Visibility {
        if let rank, rank > 0 {
            switch rank {
            case 1: return .bronze
            case 2: return .silver
            default: return .gold
            }
        }
        if raw == "tier_or_above" || raw == "subscribers" { return .bronze }
        return .free
    }

    // MARK: - Formatting

    private func audienceModeLabel(_ mode: String?) -> String? {
        switch mode {
        case "open": "Anyone can follow"
        case "approval_required": "Owner approves followers"
        case "invite_only": "Invite only"
        case "organization_managed": "Organization managed"
        default: nil
        }
    }

    private func titleCase(_ value: String) -> String {
        value.split { $0 == "_" || $0 == " " }
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    private func timeAgo(_ iso: String?) -> String {
        guard let date = Self.parseDate(iso) else { return "" }
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "Just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<172_800: return "Yesterday"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default:
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
    }

    private static func parseDate(_ iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
    }

    private func friendlyMessage(for error: APIError) -> String {
        switch error {
        case .notFound: "Beacon not found."
        case .forbidden: "This Beacon is private."
        case .transport: "Check your connection and try again."
        default: "Something went wrong. Try again."
        }
    }
}

// MARK: - Helpers

private extension String {
    var capitalizedFirst: String {
        guard let first else { return self }
        return first.uppercased() + dropFirst()
    }
}

/// Compact count formatter shared by the stat builder and the optimistic
/// follower bump (1_234 → "1.2K", 3_400_000 → "3.4M").
func beaconCompactCount(_ value: Int) -> String {
    if value >= 1_000_000 { return String(format: "%.1fM", Double(value) / 1_000_000) }
    if value >= 1000 { return String(format: "%.1fK", Double(value) / 1000) }
    return "\(value)"
}

extension BeaconProfileContent {
    /// Optimistic follower-count bump after a follow / unfollow. Recomputes
    /// the "Beacons" stat from the raw `followerCount` (then re-compacts) so
    /// a Beacon with ≥1000 followers no longer collapses "1.2K" → "13".
    func bumpingFollowers(by delta: Int) -> BeaconProfileContent {
        let next = max(followerCount + delta, 0)
        let updated = stats.map { stat -> ProfileStatCell in
            guard stat.id == "beacons" else { return stat }
            return ProfileStatCell(id: stat.id, value: beaconCompactCount(next), label: stat.label)
        }
        return BeaconProfileContent(
            personaId: personaId,
            channelId: channelId,
            isOwner: isOwner,
            handle: handle,
            displayName: displayName,
            header: header,
            stats: updated,
            bio: bio,
            categoryLabel: categoryLabel,
            audienceLabel: audienceLabel,
            audienceModeLabel: audienceModeLabel,
            links: links,
            posts: posts,
            tiers: tiers,
            broadcastEnabled: broadcastEnabled,
            shareURL: shareURL,
            followerCount: next
        )
    }
}
