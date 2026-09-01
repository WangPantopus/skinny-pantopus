//
//  PublicProfileViewModel.swift
//  Pantopus
//
//  Loads the public profile and projects it onto the `StatsTabsBody`
//  content model. Tab state lives in the VM so switching doesn't refetch.
//
//  T3 — the route param may be a UUID *or* a handle (`pantopus://u/mariak`,
//  `https://pantopus.com/u/mariak`). We branch exactly like RN
//  (`src/app/user/[id].tsx:27,53-58`): UUIDs go to `GET /api/users/id/:id`,
//  handles to `GET /api/users/username/:username`. Both routes return the
//  same body, and every follow-up call (relationship, follow, connect,
//  block, posts) uses the *resolved* `profile.id`, never the raw param.
//
//  P6.5 — Persona vs Local chrome. The VM derives the profile kind
//  from the loaded DTO's metadata so the screen can swap banner color,
//  header chips, sticky CTAs, and post styling. The kind is purely a
//  presentation hint — backend doesn't carry an explicit field for it.
//

import Foundation
import Logging
import Observation

// swiftlint:disable file_length multiline_arguments type_body_length

/// Render state for the public profile screen.
public enum PublicProfileState: Sendable, Equatable {
    case loading
    case loaded(PublicProfileContent)
    case error(message: String)
}

/// P6.5 — Profile-kind discriminator that swaps the chrome between the
/// Persona (creator) and Local (verified neighbor) variants. Persona is
/// the default; the VM bumps it to `.local` when the loaded profile
/// carries a verified residency.
public enum PublicProfileKind: String, Sendable, Equatable, Hashable {
    case persona
    case local
}

/// A21.2 — the tab strip on the Local Beacon profile archetype. Separate
/// from `ProfileTab` so the persona path keeps its own body untouched.
///
/// Posts · About are the designed pair; Portfolio · Gigs · Reviews carry
/// the marketplace surfaces a verified neighbour actually has —
/// `GET /api/files/portfolio/:userId` (`backend/routes/files.js:526`),
/// `GET /api/gigs?user_id=…` (`backend/routes/gigs.js:2089`) and
/// `GET /api/reviews/user/:userId` (`backend/routes/reviews.js:149`).
public enum LocalProfileTab: String, Sendable, Equatable, Hashable, CaseIterable, Identifiable {
    case posts
    case about
    case portfolio
    case gigs
    case reviews

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .posts: "Posts"
        case .about: "About"
        case .portfolio: "Portfolio"
        case .gigs: "Gigs"
        case .reviews: "Reviews"
        }
    }
}

/// One post rendered beneath the stats/tabs body. Persona profiles
/// carry creator-economy broadcasts (with tier visibility chip and the
/// optional locked-paywall overlay); Local profiles carry Pulse-style
/// neighborhood posts (with an intent chip — Offer / Alert / Event).
public struct PublicProfilePost: Sendable, Hashable, Identifiable {
    public enum Visibility: String, Sendable, Hashable {
        case free
        case bronze
        case silver
        case gold
    }

    public enum Intent: String, Sendable, Hashable {
        case offer
        case alert
        case event
        case ask
    }

    public let id: String
    public let body: String
    public let timeAgo: String
    public let locality: String?
    public let reactions: Int
    public let replies: Int
    /// Persona-only — `nil` on Local posts.
    public let visibility: Visibility?
    /// Persona-only — `true` when this broadcast is gated behind a
    /// paid tier the visitor doesn't hold.
    public let isLocked: Bool
    /// Persona-only — tier rank required to unlock (`target_tier_rank`).
    public let targetTierRank: Int?
    /// Local-only — `nil` on Persona broadcasts.
    public let intent: Intent?

    public init(
        id: String,
        body: String,
        timeAgo: String,
        locality: String? = nil,
        reactions: Int = 0,
        replies: Int = 0,
        visibility: Visibility? = nil,
        isLocked: Bool = false,
        targetTierRank: Int? = nil,
        intent: Intent? = nil
    ) {
        self.id = id
        self.body = body
        self.timeAgo = timeAgo
        self.locality = locality
        self.reactions = reactions
        self.replies = replies
        self.visibility = visibility
        self.isLocked = isLocked
        self.targetTierRank = targetTierRank
        self.intent = intent
    }
}

/// Hydrated content emitted by `PublicProfileViewModel`.
public struct PublicProfileContent: Sendable, Equatable, Hashable {
    public let profile: PublicProfile
    public let kind: PublicProfileKind
    public let header: PublicProfileHeader
    public let stats: StatsTabsContent
    public let posts: [PublicProfilePost]
    /// B.2 (A10.5) — populated for `.local` profiles; drives the
    /// canonical neighbor layout. `nil` for `.persona`.
    public let neighbor: NeighborProfileContent?
    /// Persona-only — `true` when the signed-in user owns this persona.
    public let isOwner: Bool
    /// Persona handle for the privacy handshake (`@username`).
    public let personaHandle: String?

    public init(
        profile: PublicProfile,
        kind: PublicProfileKind,
        header: PublicProfileHeader,
        stats: StatsTabsContent,
        posts: [PublicProfilePost],
        neighbor: NeighborProfileContent? = nil,
        isOwner: Bool = false,
        personaHandle: String? = nil
    ) {
        self.profile = profile
        self.kind = kind
        self.header = header
        self.stats = stats
        self.posts = posts
        self.neighbor = neighbor
        self.isOwner = isOwner
        self.personaHandle = personaHandle
    }
}

/// Header surface for the public profile screen — the VM-prepared
/// arguments passed straight into `ProfileHeader`.
public struct PublicProfileHeader: Sendable, Equatable, Hashable {
    public let displayName: String
    public let handle: String?
    public let locality: String?
    public let avatarURL: URL?
    public let isVerified: Bool
    public let identityBadges: [IdentityPillarBadge]
    /// P6.5 — Gold "Persona · Verified" chip on Persona profiles.
    public let tierLabel: String?
    /// P6.5 — Green "Verified neighbor" shield chip on Local profiles.
    public let isVerifiedNeighbor: Bool

    public init(
        displayName: String,
        handle: String?,
        locality: String?,
        avatarURL: URL?,
        isVerified: Bool,
        identityBadges: [IdentityPillarBadge],
        tierLabel: String? = nil,
        isVerifiedNeighbor: Bool = false
    ) {
        self.displayName = displayName
        self.handle = handle
        self.locality = locality
        self.avatarURL = avatarURL
        self.isVerified = isVerified
        self.identityBadges = identityBadges
        self.tierLabel = tierLabel
        self.isVerifiedNeighbor = isVerifiedNeighbor
    }
}

/// In-flight state for an action button (Connect, Block).
public enum PublicProfileActionState: Sendable, Equatable {
    case idle
    case inFlight
    case succeeded
    case failed(message: String)
}

/// The viewer↔profile connection edge, as reported by
/// `GET /api/users/:id/relationship`
/// (`backend/routes/users.js:3685` → `visibilityPolicy.getRelationshipStatus`,
/// `backend/utils/visibilityPolicy.js:37`). Drives the Connect control's
/// label and what tapping it does — RN's `connectionState`
/// (`pantopus/frontend/apps/mobile/src/app/user/[id].tsx:80,203-221,392`).
public enum ProfileConnection: String, Sendable, Equatable, Hashable, CaseIterable {
    case none
    case pendingSent = "pending_sent"
    case pendingReceived = "pending_received"
    case connected
    case blocked

    /// Decode the server's string, defaulting anything unrecognised to
    /// `.none` — same fallback RN applies (`rel.relationship || 'none'`).
    public init(apiValue: String?) {
        self = ProfileConnection(rawValue: (apiValue ?? "").lowercased()) ?? .none
    }

    /// Connect-button copy. Mirrors RN `getConnectLabel`
    /// (`src/app/user/[id].tsx:391-398`).
    public var label: String {
        switch self {
        case .connected: "Connected"
        case .pendingSent: "Requested"
        case .pendingReceived: "Accept"
        case .none, .blocked: "Connect"
        }
    }

    /// RN disables the button only while a request is outstanding
    /// (`disabled={actionLoading || connectionState === 'pending_sent'}`).
    public var isActionable: Bool {
        self != .pendingSent
    }

    /// VoiceOver copy — mirrored as the Android `contentDescription`.
    public var accessibilityLabel: String {
        switch self {
        case .connected: "Connected. Tap to remove this connection"
        case .pendingSent: "Connection requested"
        case .pendingReceived: "Accept connection request"
        case .none, .blocked: "Connect"
        }
    }
}

/// View-model for the public profile screen.
@MainActor
@Observable
public final class PublicProfileViewModel {
    /// Render state.
    public private(set) var state: PublicProfileState = .loading

    /// Currently visible tab. Switching this is local; no refetch.
    public var selectedTab: ProfileTab = .about

    /// B.2 (A10.5) — selected tab for the canonical neighbor layout
    /// (About · Reviews · Verifications · Posts). Separate from
    /// `selectedTab` so the persona path is untouched.
    public var selectedNeighborTab: NeighborProfileTab = .about

    /// A21.2 — selected tab on the Local Beacon profile archetype
    /// (Posts · About). Switching is local; no refetch.
    public var selectedLocalTab: LocalProfileTab = .posts

    /// Connect button state — toggles between `idle` → `inFlight` →
    /// `succeeded` after a successful `POST /api/relationships/requests`.
    public private(set) var connectState: PublicProfileActionState = .idle

    /// The existing connection edge, seeded by
    /// `GET /api/users/:id/relationship` on load and kept current after
    /// every connect / accept / disconnect. Without it the Connect control
    /// is one-way; with it the button reads Connect / Requested / Accept /
    /// Connected exactly like RN.
    public private(set) var connection: ProfileConnection = .none

    /// Drives the "Remove connection?" confirm. RN's Connections centre
    /// gates the same `DELETE /api/relationships/:id` behind an alert
    /// (`src/app/connections.tsx:69-77`).
    public var showDisconnectConfirm: Bool = false

    /// Block action state — surfaces toast on success or failure of
    /// `POST /api/users/:userId/block`.
    public private(set) var blockState: PublicProfileActionState = .idle

    /// Drives the privacy handshake sheet for Persona follow/unlock.
    public var showFollowHandshake: Bool = false
    public var handshakePreselectedTierRank: Int?

    /// Drives the overflow action sheet presentation.
    public var showOverflow: Bool = false

    /// Transient toast surface used for action feedback.
    public var toastMessage: String?

    /// T3 — plain follow graph (`/api/users/:id/follow`), distinct from the
    /// persona privacy handshake. `true` once the viewer follows this user.
    public private(set) var isFollowing: Bool = false
    /// In-flight guard for the follow/unfollow toggle.
    public private(set) var isFollowInFlight: Bool = false
    /// `true` when a Follow affordance should render at all — someone else's
    /// profile, viewed by a signed-in user. Mirrors RN, which hides the whole
    /// action row on your own profile (`src/app/user/[id].tsx:522`).
    public private(set) var canFollow: Bool = false

    /// The raw route param — may be a UUID or a `@handle`.
    private let routeIdentifier: String
    /// The resolved `User.id`, known only after the profile loads. Every
    /// user-scoped mutation must use this, never `routeIdentifier`.
    private var resolvedUserId: String
    private let currentUserId: String?
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.PublicProfile")

    init(
        userId: String,
        currentUserId: String? = PublicProfileViewModel.signedInUserId(),
        client: APIClient = .shared
    ) {
        routeIdentifier = userId
        resolvedUserId = userId
        self.currentUserId = currentUserId
        self.client = client
    }

    /// The signed-in user, so `isOwner` (and the owner chrome behind it)
    /// resolves without every call site threading the id through. Mirrors
    /// Android, where the VM reads `AuthRepository.state`.
    static func signedInUserId() -> String? {
        if case let .signedIn(user) = AuthManager.shared.state {
            return user.id
        }
        return nil
    }

    public func load() async {
        state = .loading
        await fetch()
    }

    public func refresh() async {
        await fetch()
    }

    // MARK: - Connect control (relationship-aware)

    /// Copy on the Connect affordance for the current edge.
    public var connectLabel: String {
        connection.label
    }

    /// The control is hidden entirely on your own profile, for a signed-out
    /// viewer, and once the edge is `blocked` — RN drops the whole action
    /// row in those cases (`src/app/user/[id].tsx:522-523`).
    public var showsConnectAction: Bool {
        canFollow && connection != .blocked
    }

    /// Tapping is a no-op while a request is outstanding or in flight.
    public var isConnectEnabled: Bool {
        connection.isActionable && connectState != .inFlight
    }

    /// The Connect affordance. What it does depends on the edge the server
    /// reported, mirroring RN's `handleConnect`
    /// (`src/app/user/[id].tsx:201-224`):
    ///
    /// - `none` → `POST /api/relationships/requests`
    /// - `pending_received` → resolve the inbound row, then
    ///   `POST /api/relationships/:id/accept`
    /// - `connected` → raise the disconnect confirm (RN's Connections
    ///   centre alert), which then calls `DELETE /api/relationships/:id`
    /// - `pending_sent` / `blocked` → inert
    public func connect() async {
        guard connectState != .inFlight else { return }
        switch connection {
        case .none:
            await sendConnectionRequest()
        case .pendingReceived:
            await acceptConnectionRequest()
        case .connected:
            showDisconnectConfirm = true
        case .pendingSent, .blocked:
            return
        }
    }

    /// `POST /api/relationships/requests` (relationships.js:67).
    private func sendConnectionRequest() async {
        connectState = .inFlight
        let body = ConnectionRequestBody(addresseeId: resolvedUserId)
        do {
            _ = try await client.request(
                RelationshipsEndpoints.sendRequest(body: body),
                as: ConnectionRequestResponse.self
            )
            connectState = .succeeded
            connection = .pendingSent
            toastMessage = "Connection request sent"
        } catch let error as APIError {
            let message = friendlyMessage(for: error)
            connectState = .failed(message: message)
            toastMessage = message
            logger.warning("Connect failed: \(error)")
        } catch {
            connectState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't send the request"
            logger.warning("Connect failed: \(error)")
        }
    }

    /// Accept the inbound request. The relationship id isn't on the
    /// profile payload, so resolve it from
    /// `GET /api/relationships/requests/pending` (relationships.js:669)
    /// first — exactly what RN does before calling accept.
    private func acceptConnectionRequest() async {
        connectState = .inFlight
        do {
            let pending = try await client.request(
                RelationshipsEndpoints.pending,
                as: PendingRequestsResponse.self
            )
            guard let match = pending.requests.first(where: { $0.requester?.id == resolvedUserId }) else {
                connectState = .idle
                // The row moved (withdrawn / already handled) — re-read the
                // edge rather than leaving the button lying.
                await loadRelationship(id: resolvedUserId)
                toastMessage = "That request is no longer pending."
                return
            }
            _ = try await client.request(
                RelationshipsEndpoints.accept(id: match.id),
                as: RelationshipActionEcho.self
            )
            connectState = .succeeded
            connection = .connected
            toastMessage = "Connected"
        } catch let error as APIError {
            let message = friendlyMessage(for: error)
            connectState = .failed(message: message)
            toastMessage = message
            logger.warning("Accept failed: \(error)")
        } catch {
            connectState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't accept that request"
            logger.warning("Accept failed: \(error)")
        }
    }

    /// Confirmed disconnect. Resolves the accepted row from
    /// `GET /api/relationships?status=accepted` (relationships.js:622) and
    /// deletes it (`DELETE /api/relationships/:id`, relationships.js:578).
    public func disconnect() async {
        showDisconnectConfirm = false
        guard connection == .connected, connectState != .inFlight else { return }
        connectState = .inFlight
        do {
            let list = try await client.request(
                RelationshipsEndpoints.list(status: "accepted"),
                as: RelationshipsListResponse.self
            )
            guard let match = list.relationships.first(where: { $0.otherUser?.id == resolvedUserId }) else {
                connectState = .idle
                await loadRelationship(id: resolvedUserId)
                toastMessage = "You're not connected to this neighbor."
                return
            }
            _ = try await client.request(
                ConnectionsEndpoints.disconnect(id: match.id),
                as: RelationshipActionEcho.self
            )
            connectState = .idle
            connection = .none
            toastMessage = "Connection removed"
        } catch let error as APIError {
            let message = friendlyMessage(for: error)
            connectState = .failed(message: message)
            toastMessage = message
            logger.warning("Disconnect failed: \(error)")
        } catch {
            connectState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't remove that connection"
            logger.warning("Disconnect failed: \(error)")
        }
    }

    /// Dismiss the confirm without disconnecting.
    public func cancelDisconnect() {
        showDisconnectConfirm = false
    }

    /// Follow entry point behind every Follow affordance.
    ///
    /// A Beacon (persona with a resolvable handle) keeps the privacy
    /// handshake wizard — that flow owns tier selection and Stripe
    /// Checkout. Everyone else (ordinary neighbours, personas with no
    /// Beacon bridge) now takes the plain `/api/users/:id/follow` path
    /// instead of the old dead-end toast. Mirrors RN, whose profile screen
    /// only ever calls `followUser`/`unfollowUser`
    /// (`src/app/user/[id].tsx:184-199`).
    public func follow() {
        if canOpenHandshake {
            handshakePreselectedTierRank = nil
            showFollowHandshake = true
            return
        }
        Task { await toggleFollow() }
    }

    /// Unlock a tier-gated broadcast on a Persona profile.
    public func unlockBroadcast(tierRank: Int?) {
        guard canOpenHandshake else {
            toastMessage = Self.handshakeUnavailableMessage
            return
        }
        handshakePreselectedTierRank = tierRank
        showFollowHandshake = true
    }

    /// Shown instead of silently no-op'ing when this profile carries no
    /// resolvable Beacon handle. Mirrors the Android string exactly.
    static let handshakeUnavailableMessage = "Following isn't available from this profile yet."

    public func clearHandshakeTier() {
        handshakePreselectedTierRank = nil
    }

    private var canOpenHandshake: Bool {
        guard case let .loaded(payload) = state,
              payload.kind == .persona,
              !payload.isOwner,
              let handle = payload.personaHandle,
              !handle.isEmpty else { return false }
        return true
    }

    /// Handle for the privacy handshake sheet.
    public var loadedPersonaHandle: String {
        guard case let .loaded(payload) = state else { return "" }
        return payload.personaHandle ?? ""
    }

    /// Block this user. Wraps `POST /api/users/:userId/block`
    /// (blocks.js:13).
    public func block() async {
        guard blockState != .inFlight else { return }
        blockState = .inFlight
        do {
            _ = try await client.request(
                BlocksEndpoints.block(userId: resolvedUserId),
                as: EmptyResponse.self
            )
            blockState = .succeeded
            // RN flips `connectionState` to 'blocked' on the same success,
            // which is what drops the Connect / Follow row
            // (`src/app/user/[id].tsx:322`).
            connection = .blocked
            toastMessage = "User blocked"
        } catch let error as APIError {
            let message = friendlyMessage(for: error)
            blockState = .failed(message: message)
            toastMessage = message
            logger.warning("Block failed: \(error)")
        } catch {
            blockState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't block this user"
            logger.warning("Block failed: \(error)")
        }
    }

    private func fetch() async {
        do {
            let profile = try await client.request(profileEndpoint, as: PublicProfile.self)
            resolvedUserId = profile.id
            let kind = derivedKind(from: profile)
            // A21.2 — the Local archetype renders a real neighbourhood post
            // feed, so pull the author's posts the way the RN `PostsTab`
            // does (`GET /api/posts/user/:id`). Persona profiles keep an
            // empty list on purpose: that endpoint returns plain posts, not
            // tier-gated broadcasts, and feeding them into the broadcast
            // card would invent a visibility chip the API never sent.
            let posts = kind == .local ? await loadUserPosts(id: profile.id) : []
            state = .loaded(build(from: profile, kind: kind, posts: posts))
            await loadRelationship(id: profile.id)
        } catch let error as APIError {
            logger.warning("Profile load failed: \(error)")
            state = .error(message: friendlyMessage(for: error))
        } catch {
            logger.warning("Profile load failed: \(error)")
            state = .error(message: "Something went wrong")
        }
    }

    /// UUIDs resolve by id; handles resolve by username. Mirrors RN's
    /// `fetchPublicProfileByIdentifier` (`src/app/user/[id].tsx:53-58`).
    private var profileEndpoint: Endpoint {
        let identifier = routeIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
        if UserSocialEndpoints.isUUID(identifier) {
            return PublicProfileEndpoints.profile(id: identifier)
        }
        return UserSocialEndpoints.profileByUsername(
            UserSocialEndpoints.normalizeHandle(identifier)
        )
    }

    /// `GET /api/users/:id/relationship` — seeds the Follow and Connect
    /// poses. Requires auth, so a signed-out viewer just gets the resting
    /// state (and no Follow affordance).
    private func loadRelationship(id: String) async {
        canFollow = currentUserId != nil && currentUserId != id
        guard canFollow else {
            isFollowing = false
            return
        }
        do {
            let relationship = try await client.request(
                UserSocialEndpoints.relationship(userId: id),
                as: UserRelationshipResponse.self
            )
            isFollowing = relationship.following ?? false
            connection = ProfileConnection(apiValue: relationship.relationship)
            switch connection {
            case .pendingSent, .connected:
                connectState = .succeeded
            case .none, .pendingReceived, .blocked:
                connectState = .idle
            }
        } catch {
            logger.debug("Relationship load failed: \(error)")
        }
    }

    /// T3 — plain follow / unfollow for an ordinary neighbor.
    /// `POST` / `DELETE /api/users/:id/follow`
    /// (`backend/routes/users.js:3520` / `:3593`). Awaited, not optimistic,
    /// so a rejected follow (blocked, curator account) can't leave the
    /// button lying — same as RN's `handleFollow`
    /// (`src/app/user/[id].tsx:184-199`).
    public func toggleFollow() async {
        guard canFollow, !isFollowInFlight else { return }
        isFollowInFlight = true
        defer { isFollowInFlight = false }
        let wasFollowing = isFollowing
        do {
            let endpoint = wasFollowing
                ? UserSocialEndpoints.unfollow(userId: resolvedUserId)
                : UserSocialEndpoints.follow(userId: resolvedUserId)
            let response = try await client.request(endpoint, as: UserFollowResponse.self)
            isFollowing = response.following ?? !wasFollowing
            toastMessage = isFollowing ? "Following" : "Unfollowed"
        } catch let error as APIError {
            logger.warning("Follow toggle failed: \(error)")
            toastMessage = followFailureMessage(for: error, wasFollowing: wasFollowing)
        } catch {
            logger.warning("Follow toggle failed: \(error)")
            toastMessage = wasFollowing ? "Couldn't unfollow." : "Couldn't follow."
        }
    }

    private func followFailureMessage(for error: APIError, wasFollowing: Bool) -> String {
        let fallback = wasFollowing ? "Couldn't unfollow." : "Couldn't follow."
        switch error {
        case .clientError:
            // The backend sends readable copy here ("You are already
            // following this user", "Cannot follow curator accounts") and
            // `APIError.errorDescription` already unwraps `{error: …}`.
            return error.errorDescription ?? fallback
        case .forbidden:
            return "You can't follow this profile."
        case .transport:
            return "Check your connection and try again."
        default:
            return fallback
        }
    }

    /// A21.2 — the Local profile's post feed. Mirrors the RN
    /// `components/profile/PostsTab` fetch. Failures degrade to an empty
    /// feed (which renders the design's "Quiet for now" state) rather than
    /// failing the whole profile.
    private func loadUserPosts(id: String) async -> [PublicProfilePost] {
        do {
            let response = try await client.request(
                PostsEndpoints.userPosts(userId: id),
                as: MyPostsResponse.self
            )
            return response.posts.map { project(post: $0) }
        } catch {
            logger.debug("Profile posts load failed: \(error)")
            return []
        }
    }

    private func project(post: MyPostDTO) -> PublicProfilePost {
        PublicProfilePost(
            id: post.id,
            body: post.content.isEmpty ? (post.title ?? "") : post.content,
            timeAgo: relativeTimestamp(post.createdAt),
            locality: post.locationName,
            reactions: post.likeCount,
            replies: post.commentCount,
            visibility: nil,
            isLocked: false,
            targetTierRank: nil,
            intent: Self.intent(forPostType: post.postType)
        )
    }

    /// Maps the backend `post_type` onto the design's intent chip. Types
    /// with no honest counterpart (general, recommendation, lost & found,
    /// local update…) render with no chip rather than borrowing a
    /// misleading label.
    static func intent(forPostType type: String?) -> PublicProfilePost.Intent? {
        switch type ?? "" {
        case "service_offer", "deal": .offer
        case "alert", "heads_up": .alert
        case "event": .event
        case "ask_local", "ask": .ask
        default: nil
        }
    }

    private func build(
        from profile: PublicProfile,
        kind: PublicProfileKind,
        posts: [PublicProfilePost]
    ) -> PublicProfileContent {
        let header = PublicProfileHeader(
            displayName: profile.displayName,
            handle: profile.username.isEmpty ? nil : profile.username,
            locality: profile.locality,
            avatarURL: (profile.profilePictureURL ?? profile.avatarURL).flatMap(URL.init(string:)),
            isVerified: profile.verified ?? false,
            identityBadges: buildBadges(profile),
            tierLabel: kind == .persona ? "Persona · Verified" : nil,
            isVerifiedNeighbor: kind == .local
        )

        var stats: [ProfileStatCell] = []
        if let reviewCount = profile.reviewCount, reviewCount > 0 || !profile.reviews.isEmpty {
            stats.append(
                ProfileStatCell(id: "reviews", value: "\(profile.reviewCount ?? profile.reviews.count)", label: "Reviews")
            )
        }
        if let rating = profile.averageRating, rating > 0 {
            stats.append(
                ProfileStatCell(id: "rating", value: String(format: "%.1f", rating), label: "Rating")
            )
        }
        if let gigsCompleted = profile.gigsCompleted, gigsCompleted > 0 {
            stats.append(
                ProfileStatCell(id: "gigs", value: "\(gigsCompleted)", label: "Gigs")
            )
        } else if let gigsPosted = profile.gigsPosted, gigsPosted > 0 {
            stats.append(
                ProfileStatCell(id: "gigs", value: "\(gigsPosted)", label: "Gigs")
            )
        }
        if stats.isEmpty {
            stats.append(ProfileStatCell(id: "placeholder", value: "—", label: "Activity"))
        }

        let reviewCards = profile.reviews.map { r in
            ProfileReviewCard(
                id: r.id ?? UUID().uuidString,
                reviewerName: r.reviewerName ?? "Anonymous",
                reviewerAvatarURL: r.reviewerAvatar.flatMap(URL.init(string:)),
                rating: r.rating,
                body: r.content ?? "",
                timestamp: relativeTimestamp(r.createdAt)
            )
        }

        let statsContent = StatsTabsContent(
            stats: stats,
            bio: profile.bio,
            skills: profile.skills,
            reviews: reviewCards
        )

        let neighbor = kind == .local
            ? buildNeighbor(from: profile, reviews: reviewCards, posts: posts)
            : nil
        let isOwner = currentUserId.map { $0 == profile.id } ?? false
        // A Beacon (`PublicPersona.handle`) lives in a different namespace
        // from `User.username` — persona handles are generated independently
        // (`identityProfiles.generateUniqueAudienceHandle`) and the persona
        // serializer deliberately never exposes the owning user. Passing the
        // username here would hand the privacy handshake a handle that can
        // resolve to a *different* creator's Beacon, so it stays nil until
        // `GET /api/users/id/:id` carries an approved Beacon bridge.
        let personaHandle: String? = nil

        return PublicProfileContent(
            profile: profile,
            kind: kind,
            header: header,
            stats: statsContent,
            posts: posts,
            neighbor: neighbor,
            isOwner: isOwner,
            personaHandle: personaHandle
        )
    }

    /// B.2 (A10.5) — project the live profile onto the canonical neighbor
    /// content. Fields the public DTO can't carry (verification ledger
    /// detail, mutual neighbors, response time) are synthesised
    /// deterministically; the empty-review path drives the new-neighbor
    /// degraded frame.
    private func buildNeighbor(
        from profile: PublicProfile,
        reviews: [ProfileReviewCard],
        posts: [PublicProfilePost]
    ) -> NeighborProfileContent {
        let reviewCount = profile.reviewCount ?? reviews.count
        let isNew = reviewCount == 0
        let rating = profile.averageRating ?? 0
        let jobs = profile.gigsCompleted ?? 0

        let ratingStat = NeighborStat(
            id: "rating",
            value: rating > 0 ? String(format: "%.1f", rating) : "—",
            label: reviewCount > 0 ? "\(reviewCount) reviews" : "No reviews yet",
            icon: .star,
            valueColor: reviewCount > 0 ? Theme.Color.appText : Theme.Color.appTextMuted,
            iconColor: reviewCount > 0 ? Theme.Color.warning : Theme.Color.appTextMuted
        )
        let stats = [
            ratingStat,
            NeighborStat(id: "jobs", value: "\(jobs)", label: "Jobs done"),
            NeighborStat(
                id: "response",
                value: isNew ? "New" : "~45m",
                label: "Response",
                valueColor: isNew ? Theme.Color.primary600 : Theme.Color.appText
            )
        ]

        let hero = NeighborHero(
            name: profile.displayName,
            locality: profile.locality,
            avatarURL: (profile.profilePictureURL ?? profile.avatarURL).flatMap(URL.init(string:)),
            isVerified: profile.verified ?? false,
            identity: isNew ? .fresh : .personal,
            kicker: neighborSince(profile.createdAt, isNew: isNew)
        )

        let welcome = isNew
            ? NeighborWelcome(
                title: "Be the welcome wagon",
                body: "\(firstName(profile.displayName)) just moved in. A quick hello goes a long way — "
                    + "and first messages from verified neighbors travel fast."
            )
            : nil

        return NeighborProfileContent(
            hero: hero,
            stats: stats,
            bio: profile.bio,
            skills: profile.skills,
            verifications: neighborVerifications(profile, isNew: isNew),
            reviews: reviews,
            reviewCount: reviewCount,
            mutuals: isNew ? neighborMutuals(for: profile) : nil,
            welcome: welcome,
            posts: posts,
            isNewNeighbor: isNew,
            primaryCtaLabel: isNew ? "Say hi" : "Message"
        )
    }

    private func neighborVerifications(_ profile: PublicProfile, isNew: Bool) -> [NeighborVerification] {
        let tile: NeighborVerification.Tile = isNew ? .success : .primary
        let trailing: NeighborVerification.Trailing = isNew ? .status("Recent") : .check
        var items: [NeighborVerification] = []
        if hasHomeResidency(profile) {
            items.append(NeighborVerification(
                id: "address", icon: .home, label: "Address",
                meta: "Verified · postcard", tile: tile, trailing: trailing
            ))
        }
        if profile.verified ?? false {
            items.append(NeighborVerification(
                id: "identity", icon: .badgeCheck, label: "Identity",
                meta: "Government ID", tile: tile, trailing: trailing
            ))
        }
        items.append(NeighborVerification(
            id: "email", icon: .mail, label: "Email",
            meta: profile.username.isEmpty ? "Confirmed" : "\(profile.username)@…",
            tile: tile, trailing: trailing
        ))
        return items
    }

    private func neighborMutuals(for profile: PublicProfile) -> NeighborMutuals {
        let seed = profile.id.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        let names = [
            ["Jamal", "Ravi", "Lena", "Amina"],
            ["Maya", "Chen", "Priya", "Owen"],
            ["Noah", "Iris", "Sam", "Leah"]
        ][seed % 3]
        return NeighborMutuals(
            count: names.count,
            names: names.joined(separator: ", "),
            initials: names.map { String($0.prefix(1)) }
        )
    }

    private func neighborSince(_ iso: String?, isNew: Bool) -> String? {
        guard let iso else { return isNew ? "New here" : nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return isNew ? "New here" : nil
        }
        let days = Int(Date().timeIntervalSince(date) / 86400)
        if days < 14 {
            return "Joined \(max(days, 0)) days ago"
        }
        let year = Calendar.current.component(.year, from: date)
        return "Neighbor since \(year)"
    }

    private func firstName(_ name: String) -> String {
        name.split(separator: " ").first.map(String.init) ?? name
    }

    /// P6.5 — Kind heuristic. A profile with a verified residency
    /// blob is a Local (verified neighbor) profile; everyone else is
    /// treated as a Persona (creator) profile. Backend doesn't ship an
    /// explicit creator/local discriminator yet — this signal is the
    /// closest stable proxy.
    private func derivedKind(from profile: PublicProfile) -> PublicProfileKind {
        hasHomeResidency(profile) ? .local : .persona
    }

    private func buildBadges(_ profile: PublicProfile) -> [IdentityPillarBadge] {
        let verified = profile.verified ?? false
        return [
            IdentityPillarBadge(pillar: .personal, state: verified ? .verified : .unverified),
            IdentityPillarBadge(pillar: .home, state: hasHomeResidency(profile) ? .verified : .unverified),
            IdentityPillarBadge(
                pillar: .business,
                state: profile.accountType == "business" ? .verified : .unverified
            )
        ]
    }

    private func hasHomeResidency(_ profile: PublicProfile) -> Bool {
        guard case let .object(map) = profile.residency ?? .null else { return false }
        if case let .bool(value) = map["verified"] ?? .null { return value }
        return !map.isEmpty
    }

    private func relativeTimestamp(_ iso: String?) -> String {
        guard let iso else { return "" }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) ?? Date()
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "Just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default:
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .none
            return display.string(from: date)
        }
    }

    private func friendlyMessage(for error: APIError) -> String {
        switch error {
        case .notFound: "We couldn't find this profile."
        case .forbidden: "This profile is private."
        case .transport: "Check your connection and try again."
        default: "Something went wrong. Try again."
        }
    }
}
