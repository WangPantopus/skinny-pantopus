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

/// The tabs on a person's profile (the 11-01 redesign): Posts and About, and
/// Work only when there is work to show. Separate from `ProfileTab` so the
/// persona path keeps its own body untouched.
///
/// Work holds the portfolio, the tasks they posted (with Open gigs on) and
/// their reviews: `GET /api/files/portfolio/:userId`
/// (`backend/routes/files.js:526`), `GET /api/gigs?user_id=…`
/// (`backend/routes/gigs.js:2089`) and `GET /api/reviews/user/:userId`
/// (`backend/routes/reviews.js:149`).
public enum LocalProfileTab: String, Sendable, Equatable, Hashable, CaseIterable, Identifiable {
    case posts
    case about
    case work

    public var id: String {
        rawValue
    }

    public var label: String {
        switch self {
        case .posts: "Posts"
        case .about: "About"
        case .work: "Work"
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
    /// Attachments resolved from the row's parallel `media_*` arrays via
    /// `PostMediaItem.items` — the same items the Pulse card renders, so a
    /// `live_photo` slot keeps its LIVE dot and long-press playback here.
    /// Empty when the broadcast is locked for the viewer: the paywall CTA
    /// replaces the body and `/personas/:handle/posts` does not strip media
    /// server-side, so suppressing it client-side is the only guard.
    public let media: [PostMediaItem]
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
        media: [PostMediaItem] = [],
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
        self.media = media
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
    /// False when `displayName` is the stand-in for someone with no name: the avatar shows no initials.
    public let hasName: Bool
    /// One line about them, shown in bold under the name.
    public let tagline: String?
    /// The city the trust line names: the verified home's city, else the
    /// profile's. Nil when the read leaves it out (their "Who can see your
    /// general area" setting).
    public let trustCity: String?
    /// "Joined Oct 2026", or "Joined this week".
    public let joinedLabel: String?
    /// Joined in the last 14 days: an empty Posts tab says "<name> just joined".
    public let joinedRecently: Bool
    /// Their avatar color on the profile screens (`ProfileAvatarColor`).
    public let avatarColor: ProfileAvatarColor

    public init(
        displayName: String,
        handle: String?,
        locality: String?,
        avatarURL: URL?,
        isVerified: Bool,
        identityBadges: [IdentityPillarBadge],
        tierLabel: String? = nil,
        isVerifiedNeighbor: Bool = false,
        hasName: Bool = true,
        tagline: String? = nil,
        trustCity: String? = nil,
        joinedLabel: String? = nil,
        joinedRecently: Bool = false,
        avatarColor: ProfileAvatarColor = .sky
    ) {
        self.displayName = displayName
        self.handle = handle
        self.locality = locality
        self.avatarURL = avatarURL
        self.isVerified = isVerified
        self.identityBadges = identityBadges
        self.tierLabel = tierLabel
        self.isVerifiedNeighbor = isVerifiedNeighbor
        self.hasName = hasName
        self.tagline = tagline
        self.trustCity = trustCity
        self.joinedLabel = joinedLabel
        self.joinedRecently = joinedRecently
        self.avatarColor = avatarColor
    }

    /// The first word of the name ("Rowan"), for "Connect with Rowan?".
    public var firstName: String {
        let first = displayName.split(separator: " ").first.map(String.init) ?? displayName
        return first.isEmpty ? "them" : first
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

    /// True while this account's own block (`UserBlock`) of the person is in
    /// place: the overflow offers Unblock instead of Block.
    public private(set) var isBlockedByViewer: Bool = false

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
    /// `true` once `GET /api/users/:id/relationship` has answered. Follow
    /// and Connect stay hidden until then and after a failed read, so a
    /// failure can't offer "Connect" or "Follow" to someone the viewer is
    /// already connected to or follows.
    public private(set) var relationshipLoaded: Bool = false
    /// `true` when the Local post feed couldn't load. The feed then offers
    /// Try again instead of the "Quiet for now" empty state.
    public private(set) var postsLoadFailed: Bool = false
    /// True while a first read of the posts is out: the header and buttons
    /// already show and only the Posts tab waits.
    public private(set) var postsLoading: Bool = false
    /// The Local profile's posts drawn as Pulse cards: photos and videos,
    /// tappable links, Helpful, Save, Repost, share and report.
    public let postCards: ProfilePostCardsModel
    /// Drives the "Unfollow …?" confirm, so one tap on Following never unfollows.
    public var showUnfollowConfirm: Bool = false
    /// Drives the "Withdraw your request?" confirm behind Requested.
    public var showWithdrawConfirm: Bool = false
    /// True when the block check or `GET /api/users/:id/relationship` failed:
    /// the header leaves the relationship button out instead of guessing.
    /// Until either answers, it holds the button's place.
    public private(set) var relationshipReadFailed: Bool = false
    /// How many portfolio items the person has, read once so Work shows only
    /// when there's work to show. Nil until read, and after a failed read.
    public private(set) var portfolioCount: Int?
    /// When the Local posts were read. A post on this profile changed
    /// elsewhere after that (its page, the feed) makes the next opening re-read them.
    private var postsReadAt: Date?

    /// The raw route param — may be a UUID or a `@handle`.
    private let routeIdentifier: String
    /// The resolved `User.id`, known only after the profile loads. Every
    /// user-scoped mutation must use this, never `routeIdentifier`.
    private var resolvedUserId: String
    /// The loaded profile's archetype; decides which block scope gates the
    /// Follow / Connect affordances in `loadRelationship(id:)`.
    private var profileKind: PublicProfileKind = .persona
    private let currentUserId: String?
    /// Your own profile shown as this audience would see it (Preview as): every
    /// read carries `?as=`, nothing is read about a relationship, and the page
    /// renders as a visitor's. Nil for the real profile.
    public let previewAudience: ProfileAudience?
    private let client: APIClient
    /// The screen store (Instant Screens, "Other people": fresh 5 minutes,
    /// not saved on the phone). The profile and its posts come from it; the
    /// relationship and block checks that gate Follow and Connect are read
    /// fresh every time.
    private let store: ScreenStore
    private let logger = Logger(label: "app.pantopus.ios.PublicProfile")

    init(
        userId: String,
        currentUserId: String? = PublicProfileViewModel.signedInUserId(),
        client: APIClient = .shared,
        previewAudience: ProfileAudience? = nil
    ) {
        routeIdentifier = userId
        resolvedUserId = userId
        self.currentUserId = currentUserId
        self.previewAudience = previewAudience
        self.client = client
        store = ScreenStore.store(for: client)
        postCards = ProfilePostCardsModel(viewerId: currentUserId, client: client, store: store)
        postCards.onToast = { [weak self] message in self?.toastMessage = message }
        // A preview always reads fresh: what the audience sees, not a saved copy.
        if previewAudience == nil { showStoredCopy() }
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

    /// Opening the profile: the store's copy at once (Follow and Connect wait
    /// for the relationship read), re-read once out of date.
    public func load() async {
        if case .loaded = state {} else { state = .loading }
        await fetch(force: false)
    }

    public func refresh() async {
        await fetch(force: true)
    }

    /// Reopening a profile seen in the last few minutes shows it at once.
    private func showStoredCopy() {
        guard let profile = store.peek(profileEndpoint, as: PublicProfile.self)?.value else { return }
        resolvedUserId = profile.id
        postCards.profileUserId = profile.id
        let kind = derivedKind(from: profile)
        profileKind = kind
        var rows: [FeedPostDTO] = []
        if kind == .local {
            guard let copy = store.peek(PostsEndpoints.userPosts(userId: profile.id), as: FeedResponse.self) else { return }
            rows = copy.value.posts
            postsReadAt = copy.fetchedAt
            postCards.show(rows, readRevision: postCards.actionRevision)
        }
        state = .loaded(build(from: profile, kind: kind, posts: rows.map { project(post: $0) }))
    }

    /// A post on this profile was changed somewhere else since its list was
    /// read: a reply or Helpful on its page, a save in Pulse.
    private var postsChangedElsewhere: Bool {
        guard let postsReadAt else { return false }
        let topics = Set(postCards.postIds.map(ScreenTopic.post))
        return store.wasMarked(topics: topics, kind: .otherPeople, since: postsReadAt)
    }

    /// A follow, connection or block changed this profile's counts and edges:
    /// the next opening reads it again, and so do your connection lists.
    private func profileChanged() {
        store.remove(profileEndpoint)
        if !UserSocialEndpoints.isUUID(routeIdentifier) {
            store.remove(UserSocialEndpoints.profileByUsername(UserSocialEndpoints.normalizeHandle(routeIdentifier)))
        }
        store.markStale(topics: [ScreenTopic.connections])
    }

    // MARK: - Connect control (relationship-aware)

    /// Copy on the Connect affordance for the current edge.
    public var connectLabel: String {
        connection.label
    }

    /// The control is hidden entirely on your own profile, for a signed-out
    /// viewer, and once the edge is `blocked` — RN drops the whole action
    /// row in those cases (`src/app/user/[id].tsx:522-523`). It also waits
    /// for the relationship read, so a failed read never shows "Connect".
    public var showsConnectAction: Bool {
        canFollow && relationshipLoaded && connection != .blocked
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
            if let failure = await sendConnectionRequest() { toastMessage = failure }
        case .pendingReceived:
            await acceptConnectionRequest()
        case .connected:
            showDisconnectConfirm = true
        case .pendingSent, .blocked:
            return
        }
    }

    /// `POST /api/relationships/requests` (relationships.js:193), with the
    /// Connect sheet's note when there is one: the server sends it as the
    /// request notification's text and keeps no copy. Returns what went
    /// wrong, or nil once the request is out.
    @discardableResult
    public func sendConnectionRequest(note: String? = nil) async -> String? {
        guard connectState != .inFlight else { return nil }
        connectState = .inFlight
        let body = ConnectionRequestBody(addresseeId: resolvedUserId, message: note)
        do {
            let response = try await client.request(
                RelationshipsEndpoints.sendRequest(body: body),
                as: ConnectionRequestResponse.self
            )
            profileChanged()
            // They had asked first: the server connected you both instead.
            if response.message?.localizedCaseInsensitiveContains("established") == true {
                connectState = .succeeded
                connection = .connected
                toastMessage = "Connected"
                await reloadAfterConnectionChange()
                return nil
            }
            connectState = .succeeded
            connection = .pendingSent
            toastMessage = "Connection request sent"
            return nil
        } catch let error as APIError {
            let message = error.errorDescription ?? "Couldn't send the request. Try again."
            connectState = .failed(message: message)
            logger.warning("Connect failed: \(error)")
            return message
        } catch {
            connectState = .failed(message: "Something went wrong")
            logger.warning("Connect failed: \(error)")
            return "Couldn't send the request. Try again."
        }
    }

    /// The Connect sheet's "Just follow <name>'s public posts". Returns what
    /// went wrong, or nil once following.
    public func followFromConnectSheet() async -> String? {
        guard !isFollowing else { return nil }
        guard canFollow, relationshipLoaded else { return "Following isn't available right now. Try again." }
        toastMessage = nil
        await toggleFollow()
        guard isFollowing else {
            // The sheet says it instead of a toast hidden behind it.
            let failure = toastMessage ?? "Couldn't follow. Try again."
            toastMessage = nil
            return failure
        }
        if case let .loaded(payload) = state {
            toastMessage = "\(payload.header.firstName)'s public posts will show up in your Pulse."
        }
        return nil
    }

    /// Requested → Withdraw: finds your pending request in
    /// `GET /api/relationships/requests/sent` (relationships.js:914) and
    /// deletes it (`DELETE /api/relationships/:id`, relationships.js:779),
    /// which either person may do. They aren't notified.
    public func withdrawRequest() async {
        showWithdrawConfirm = false
        guard connection == .pendingSent, connectState != .inFlight else { return }
        connectState = .inFlight
        do {
            let sent = try await client.request(ConnectionsEndpoints.sentRequests, as: SentRequestsResponse.self)
            guard let match = sent.requests.first(where: { $0.addressee?.id == resolvedUserId }) else {
                connectState = .idle
                profileChanged()
                await reloadAfterConnectionChange()
                toastMessage = "That request is no longer pending."
                return
            }
            _ = try await client.request(ConnectionsEndpoints.disconnect(id: match.id), as: RelationshipActionEcho.self)
            connectState = .idle
            connection = .none
            profileChanged()
            toastMessage = "Request withdrawn"
        } catch let error as APIError {
            let message = error.errorDescription ?? "Couldn't withdraw the request."
            connectState = .failed(message: message)
            toastMessage = message
            logger.warning("Withdraw failed: \(error)")
        } catch {
            connectState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't withdraw the request."
            logger.warning("Withdraw failed: \(error)")
        }
    }

    /// "Not now" on a request they sent you: finds it in
    /// `GET /api/relationships/requests/pending` (relationships.js:890) and
    /// declines it (`POST /api/relationships/:id/reject`, relationships.js:471),
    /// which removes it so they can ask again later. They aren't notified.
    public func declineRequest() async {
        guard connection == .pendingReceived, connectState != .inFlight else { return }
        connectState = .inFlight
        do {
            let pending = try await client.request(RelationshipsEndpoints.pending, as: PendingRequestsResponse.self)
            guard let match = pending.requests.first(where: { $0.requester?.id == resolvedUserId }) else {
                connectState = .idle
                profileChanged()
                await reloadAfterConnectionChange()
                toastMessage = "That request is no longer pending."
                return
            }
            _ = try await client.request(RelationshipsEndpoints.reject(id: match.id), as: RelationshipActionEcho.self)
            connectState = .idle
            connection = .none
            profileChanged()
            toastMessage = "Request declined"
        } catch let error as APIError {
            let message = error.errorDescription ?? "Couldn't decline the request."
            connectState = .failed(message: message)
            toastMessage = message
            logger.warning("Decline failed: \(error)")
        } catch {
            connectState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't decline the request."
            logger.warning("Decline failed: \(error)")
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
                profileChanged()
                await reloadAfterConnectionChange()
                toastMessage = "That request is no longer pending."
                return
            }
            _ = try await client.request(
                RelationshipsEndpoints.accept(id: match.id),
                as: RelationshipActionEcho.self
            )
            connectState = .succeeded
            connection = .connected
            profileChanged()
            toastMessage = "Connected"
            await reloadAfterConnectionChange()
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
                profileChanged()
                await reloadAfterConnectionChange()
                toastMessage = "You're not connected to this neighbor."
                return
            }
            _ = try await client.request(
                ConnectionsEndpoints.disconnect(id: match.id),
                as: RelationshipActionEcho.self
            )
            connectState = .idle
            connection = .none
            profileChanged()
            toastMessage = "Connection removed"
            await reloadAfterConnectionChange()
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

    /// Connection-only posts and profile fields have a different audience now.
    /// Retire the previous copy before the read, so a failure cannot retain it.
    private func reloadAfterConnectionChange() async {
        store.remove(PostsEndpoints.userPosts(userId: resolvedUserId))
        postCards.show([], readRevision: postCards.actionRevision)
        postsReadAt = nil
        relationshipLoaded = false
        state = .loading
        await fetch(force: true)
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

    /// True when the signed-in owner's link still uses the username the
    /// server made up and this device hasn't asked them to pick one yet
    /// (`UsernameShareSheet.swift`).
    public var asksForUsernameBeforeSharing: Bool {
        guard case let .loaded(payload) = state, payload.isOwner,
              payload.profile.chosenUsername == nil,
              let currentUserId else { return false }
        return !UsernamePromptMemory.wasAsked(currentUserId)
    }

    /// Asked once per account on this device.
    public func markAskedForUsername() {
        if let currentUserId { UsernamePromptMemory.markAsked(currentUserId) }
    }

    /// The loaded profile's username ("" before it loads).
    public var loadedUsername: String {
        guard case let .loaded(payload) = state else { return "" }
        return payload.profile.username
    }

    /// True once the loaded profile is the signed-in person's own.
    public var isOwnProfileLoaded: Bool {
        guard case let .loaded(payload) = state else { return false }
        return payload.isOwner
    }

    /// The profile's public web link for the header's "Share profile" sheet
    /// (web `/u/:username`, the link web's own profile Share uses).
    public var profileShareURL: URL? {
        guard case let .loaded(payload) = state, !payload.profile.username.isEmpty else { return nil }
        return URL(string: InviteLinks.profileURLString(username: payload.profile.username))
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
            // Blocked lists, the profile's block count and chats change.
            store.markStale(topics: [ScreenTopic.profileMe, ScreenTopic.chats, ScreenTopic.posts])
            // RN flips `connectionState` to 'blocked' on the same success,
            // which is what drops the Connect / Follow row
            // (`src/app/user/[id].tsx:322`).
            connection = .blocked
            isBlockedByViewer = true
            profileChanged()
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

    /// Lift this account's own block (`DELETE /api/users/:userId/block`,
    /// blocks.js:105), as Settings → Blocked users does, then load the profile
    /// again so posts, Follow and Connect come back.
    public func unblock() async {
        guard blockState != .inFlight else { return }
        blockState = .inFlight
        do {
            _ = try await client.request(
                BlocksEndpoints.unblock(userId: resolvedUserId),
                as: EmptyResponse.self
            )
            blockState = .idle
            isBlockedByViewer = false
            connection = .none
            toastMessage = "User unblocked"
            store.markStale(topics: [ScreenTopic.profileMe, ScreenTopic.chats, ScreenTopic.posts])
            profileChanged()
            await fetch(force: true)
        } catch let error as APIError {
            let message = friendlyMessage(for: error)
            blockState = .failed(message: message)
            toastMessage = message
            logger.warning("Unblock failed: \(error)")
        } catch {
            blockState = .failed(message: "Something went wrong")
            toastMessage = "Couldn't unblock this user"
            logger.warning("Unblock failed: \(error)")
        }
    }

    private func fetch(force: Bool) async {
        do {
            let profile: PublicProfile = if let previewAudience {
                // Not through the store: a preview's answers never stand in for the real profile.
                try await client.request(PublicProfileEndpoints.profile(id: resolvedUserId, previewAs: previewAudience.rawValue))
            } else {
                try await store.load(profileEndpoint, as: PublicProfile.self, kind: .otherPeople, force: force).value
            }
            resolvedUserId = profile.id
            postCards.profileUserId = profile.id
            let kind = derivedKind(from: profile)
            profileKind = kind
            // A21.2 — the Local archetype renders a real neighbourhood post
            // feed, so pull the author's posts the way the RN `PostsTab`
            // does (`GET /api/posts/user/:id`). Persona profiles keep an
            // empty list on purpose: that endpoint returns plain posts, not
            // tier-gated broadcasts, and feeding them into the broadcast
            // card would invent a visibility chip the API never sent.
            var rows: [FeedPostDTO] = []
            if kind == .local {
                // Nothing on screen yet: the header and buttons show now, so a
                // slow posts read holds only the Posts tab.
                if case .loaded = state {} else {
                    postsLoading = true
                    state = .loaded(build(from: profile, kind: kind, posts: []))
                }
                rows = await loadUserPosts(id: profile.id, force: force || postsChangedElsewhere)
                postsLoading = false
            }
            state = .loaded(build(from: profile, kind: kind, posts: rows.map { project(post: $0) }))
            await loadRelationship(id: profile.id)
            if kind == .local { await loadPortfolioCount(id: profile.id) }
        } catch is CancellationError {
            return
        } catch let error as APIError {
            logger.warning("Profile load failed: \(error)")
            // A failed refresh keeps the profile on screen; gone or hidden shows the server's answer.
            if case .loaded = state, !ScreenStore.isRefusal(error) {
                if force { toastMessage = friendlyMessage(for: error) }
                return
            }
            state = .error(message: friendlyMessage(for: error))
        } catch {
            logger.warning("Profile load failed: \(error)")
            state = .error(message: "Something went wrong")
        }
    }

    /// UUIDs resolve by id; handles resolve by username. Mirrors RN's
    /// `fetchPublicProfileByIdentifier` (`src/app/user/[id].tsx:53-58`).
    /// Once loaded, a refresh goes by id: the owner may have just changed
    /// the username the route was opened with.
    private var profileEndpoint: Endpoint {
        let identifier = UserSocialEndpoints.isUUID(resolvedUserId)
            ? resolvedUserId
            : routeIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
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
        guard previewAudience == nil, currentUserId != nil, currentUserId != id else {
            canFollow = false
            isFollowing = false
            return
        }
        relationshipReadFailed = false

        // Personal UserBlock rows are deliberately distinct from the
        // Relationship graph: GET /:id/relationship reports only the
        // latter. The local-neighbor Follow/Connect row is the scope that
        // uses personal block visibility; Persona and Relationship
        // affordances retain their established independent policy.
        if profileKind == .local {
            // Resolve the existing personal block list before offering any
            // affordance, so a fresh profile navigation cannot restore
            // Follow/Connect for a user this account has already blocked.
            // A failed read fails closed by leaving the profile
            // non-actionable; it must never turn an unavailable
            // authorization check into an affordance.
            do {
                let personal = try await client.request(
                    BlocksEndpoints.blocked,
                    as: UserBlocksResponse.self
                )
                isBlockedByViewer = personal.blocked.contains { $0.userId == id }
                if isBlockedByViewer {
                    canFollow = false
                    isFollowing = false
                    connection = .blocked
                    return
                }
            } catch {
                // Leaving the screen cancels the read: nothing failed, so nothing changes.
                if Task.isCancelled { return }
                logger.warning("Blocked-list load failed: \(error)")
                canFollow = false
                isFollowing = false
                relationshipReadFailed = true
                toastMessage = "Couldn't verify block status. Actions are unavailable."
                return
            }
        }

        canFollow = true
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
            relationshipLoaded = true
        } catch {
            if Task.isCancelled { return }
            logger.debug("Relationship load failed: \(error)")
            relationshipLoaded = false
            relationshipReadFailed = true
            toastMessage = "Couldn't load connection status. Try again later."
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
            profileChanged()
            toastMessage = isFollowing ? "Following" : "Unfollowed"
        } catch let error as APIError {
            logger.warning("Follow toggle failed: \(error)")
            toastMessage = followFailureMessage(for: error, wasFollowing: wasFollowing)
        } catch {
            logger.warning("Follow toggle failed: \(error)")
            toastMessage = wasFollowing ? "Couldn't unfollow." : "Couldn't follow."
        }
    }

    /// The Unfollow button of the "Unfollow …?" confirm: it only ever unfollows.
    public func unfollow() async {
        guard isFollowing else { return }
        await toggleFollow()
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
    /// `components/profile/PostsTab` fetch. A failure doesn't fail the whole
    /// profile: the feed stays empty and `postsLoadFailed` makes it offer
    /// Try again rather than the design's "Quiet for now" state. The rows
    /// are the feed's (`feedService` serializer), so they also feed the
    /// Pulse cards.
    private func loadUserPosts(id: String, force: Bool) async -> [FeedPostDTO] {
        let readRevision = postCards.actionRevision
        if let previewAudience {
            return await loadPreviewPosts(id: id, audience: previewAudience, readRevision: readRevision)
        }
        do {
            let snapshot = try await store.load(
                PostsEndpoints.userPosts(userId: id),
                as: FeedResponse.self,
                kind: .otherPeople,
                // Your own taps on posts (here, in Pulse) mark this list too.
                topics: [ScreenTopic.posts],
                force: force
            )
            postsLoadFailed = false
            postsReadAt = snapshot.fetchedAt
            postCards.show(snapshot.value.posts, readRevision: readRevision)
            return snapshot.value.posts
        } catch {
            logger.debug("Profile posts load failed: \(error)")
            postsLoadFailed = true
            postCards.show([], readRevision: readRevision)
            return []
        }
    }

    /// How many portfolio items there are, so Work shows only when there's
    /// work to show. Your own read includes private documents
    /// (`GET /api/files/portfolio`); someone else's is the public list. A
    /// failed read leaves it nil and Work stays hidden (yours stays shown).
    /// The posts the audience sees (`?as=`); signed-out visitors see none
    /// (`sign_in_required`), so "anyone" reads nothing.
    private func loadPreviewPosts(id: String, audience: ProfileAudience, readRevision: Int) async -> [FeedPostDTO] {
        guard audience != .anyone else {
            postCards.show([], readRevision: readRevision)
            return []
        }
        do {
            let response = try await client.request(
                PostsEndpoints.userPosts(userId: id, previewAs: audience.rawValue),
                as: FeedResponse.self
            )
            postsLoadFailed = false
            postCards.show(response.posts, readRevision: readRevision)
            return response.posts
        } catch {
            logger.debug("Preview posts load failed: \(error)")
            postsLoadFailed = true
            postCards.show([], readRevision: readRevision)
            return []
        }
    }

    private func loadPortfolioCount(id: String) async {
        // A preview counts what everyone can see: the public list.
        let isOwn = currentUserId == id && previewAudience == nil
        do {
            let response = try await client.request(
                isOwn ? ProfileTabsEndpoints.myPortfolio() : ProfileTabsEndpoints.portfolio(userId: id),
                as: PortfolioListResponse.self
            )
            portfolioCount = response.files.count
        } catch {
            logger.debug("Portfolio count failed: \(error)")
            portfolioCount = nil
        }
    }

    /// The tabs to show: Posts and About, and Work when the person has a
    /// portfolio, reviews or (with Open gigs on) posted tasks. Your own
    /// profile always has Work, where "Add portfolio item" lives.
    public func localTabs(for payload: PublicProfileContent) -> [LocalProfileTab] {
        let profile = payload.profile
        let hasWork = (portfolioCount ?? 0) > 0
            || (profile.reviewCount ?? 0) > 0
            || (LaunchFeatures.openGigs && (profile.gigsPosted ?? 0) > 0)
        return hasWork || payload.isOwner ? [.posts, .about, .work] : [.posts, .about]
    }

    /// True when someone is signed in (the relationship read needs it).
    public var hasSignedInViewer: Bool {
        currentUserId != nil
    }

    /// What tapping "Verified neighbor" explains.
    public func trustExplainer(for header: PublicProfileHeader) -> String {
        if let city = header.trustCity {
            return "Pantopus confirmed \(header.firstName) lives in \(city). Their address is never shown."
        }
        return "Pantopus confirmed \(header.firstName)'s home address. The address itself is never shown."
    }

    private func project(post: FeedPostDTO) -> PublicProfilePost {
        PublicProfilePost(
            id: post.id,
            body: post.content.isEmpty ? (post.title ?? "") : post.content,
            media: PostMediaItem.items(
                urls: post.mediaURLs,
                types: post.mediaTypes,
                thumbnails: post.mediaThumbnails,
                liveURLs: post.mediaLiveURLs
            ),
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
            // A made-up username is never shown as "@…" or in "Report @…".
            handle: profile.chosenUsername,
            locality: profile.locality,
            avatarURL: (profile.profilePictureURL ?? profile.avatarURL).flatMap(URL.init(string:)),
            // No avatar check: `verified` is the account email flag that sign-in
            // sets, and a check reads as identity or residency verification.
            isVerified: false,
            identityBadges: buildBadges(profile),
            // No server field verifies a persona, so the chip names the kind only.
            // Launch cuts #1 + #2: no "Persona" chip while personas are hidden.
            tierLabel: kind == .persona && LaunchFeatures.beacon && LaunchFeatures.personas ? "Persona" : nil,
            // The chip needs the verified home itself: unverified people get the
            // neighbor layout too while creators are cut.
            isVerifiedNeighbor: hasHomeResidency(profile),
            hasName: profile.hasName,
            tagline: profile.tagline,
            trustCity: trustCity(profile),
            joinedLabel: Self.joinedLabel(profile.createdAt),
            joinedRecently: Self.joinedWithin(days: 14, iso: profile.createdAt),
            avatarColor: ProfileAvatarColor(userId: profile.id)
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
        // Launch cut #4 (Open Gigs): no gig count, like the hidden Gigs tab (as on Android).
        if LaunchFeatures.openGigs, let gigsCompleted = profile.gigsCompleted, gigsCompleted > 0 {
            stats.append(
                ProfileStatCell(id: "gigs", value: "\(gigsCompleted)", label: "Gigs")
            )
        } else if LaunchFeatures.openGigs, let gigsPosted = profile.gigsPosted, gigsPosted > 0 {
            stats.append(
                ProfileStatCell(id: "gigs", value: "\(gigsPosted)", label: "Gigs")
            )
        }
        // No reviews or rating yet: no stats row (BeaconIdentityBlock hides an empty one)
        // rather than a "— Activity" cell that reads as a broken stat.

        let reviewCards = profile.reviews.map { r in
            ProfileReviewCard(
                id: r.id ?? UUID().uuidString,
                reviewerName: r.reviewerName ?? "Anonymous",
                reviewerAvatarURL: r.reviewerAvatar.flatMap(URL.init(string:)),
                rating: r.rating,
                body: r.comment ?? r.content ?? "",
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
        // A preview is rendered the way the audience sees it, not as yours.
        let isOwner = previewAudience == nil && (currentUserId.map { $0 == profile.id } ?? false)
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
            // No response-time data exists yet; "—" until it does.
            NeighborStat(
                id: "response",
                value: isNew ? "New" : "—",
                label: "Response",
                valueColor: isNew ? Theme.Color.primary600 : Theme.Color.appText
            )
        ]

        let hero = NeighborHero(
            name: profile.displayName,
            locality: profile.locality,
            avatarURL: (profile.profilePictureURL ?? profile.avatarURL).flatMap(URL.init(string:)),
            // No avatar check: `verified` is the account email flag that sign-in
            // sets, and a check reads as identity or residency verification.
            isVerified: false,
            identity: isNew ? .fresh : .personal,
            kicker: neighborSince(profile.createdAt, isNew: isNew)
        )

        let welcome = isNew
            ? NeighborWelcome(
                title: "Say hello",
                body: "Send \(firstName(profile.displayName)) a friendly hello."
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
            // No mutual-neighbor data comes from the server, so no strip.
            mutuals: nil,
            welcome: welcome,
            posts: posts,
            isNewNeighbor: isNew,
            primaryCtaLabel: isNew ? "Say hi" : "Message"
        )
    }

    private func neighborVerifications(_ profile: PublicProfile, isNew: Bool) -> [NeighborVerification] {
        let tile: NeighborVerification.Tile = isNew ? .success : .primary
        // Review count says nothing about when an email or address was verified.
        let trailing: NeighborVerification.Trailing = .check
        var items: [NeighborVerification] = []
        // Only what the payload shows: verified residency (method unknown) and
        // the account's confirmed email. No server field records an ID check.
        if hasHomeResidency(profile) {
            items.append(NeighborVerification(
                id: "address", icon: .home, label: "Address",
                meta: "Verified", tile: tile, trailing: trailing
            ))
        }
        if profile.verified ?? false {
            items.append(NeighborVerification(
                id: "email", icon: .mail, label: "Email",
                meta: "Confirmed", tile: tile, trailing: trailing
            ))
        }
        return items
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

    /// The city the trust line names: the verified home's city when there is
    /// one, else the profile's own. The read leaves both out for viewers the
    /// person's "Who can see your general area" setting doesn't name.
    private func trustCity(_ profile: PublicProfile) -> String? {
        var homeCity: String?
        if case let .object(map) = profile.residency ?? .null, case let .string(city) = map["city"] ?? .null {
            homeCity = city
        }
        let city = hasHomeResidency(profile) ? (homeCity ?? profile.city) : profile.city
        guard let city = city?.trimmingCharacters(in: .whitespacesAndNewlines), !city.isEmpty else { return nil }
        return city
    }

    /// "Joined Oct 2026", or "Joined this week" in someone's first seven days.
    static func joinedLabel(_ iso: String?, now: Date = Date()) -> String? {
        guard let date = joinedDate(iso) else { return nil }
        if now.timeIntervalSince(date) < 7 * 86400 { return "Joined this week" }
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMMyyyy")
        return "Joined \(formatter.string(from: date))"
    }

    /// Whether the account is younger than `days`.
    static func joinedWithin(days: Int, iso: String?, now: Date = Date()) -> Bool {
        guard let date = joinedDate(iso) else { return false }
        return now.timeIntervalSince(date) < Double(days) * 86400
    }

    /// `created_at`, with or without fractional seconds; Postgres sends six
    /// digits ("…:56.123456+00:00"), which are cut to three when the plain
    /// read fails.
    private static func joinedDate(_ iso: String?) -> Date? {
        guard var raw = iso, !raw.isEmpty else { return nil }
        if let date = PlanTime.parse(raw) { return date }
        guard let range = raw.range(of: #"\.\d{4,}"#, options: .regularExpression) else { return nil }
        raw.replaceSubrange(range, with: raw[range].prefix(4))
        return PlanTime.parse(raw)
    }

    /// P6.5 — Kind heuristic. A profile with a verified residency
    /// blob is a Local (verified neighbor) profile; everyone else is
    /// treated as a Persona (creator) profile. Backend doesn't ship an
    /// explicit creator/local discriminator yet — this signal is the
    /// closest stable proxy. While the creator side is cut for launch
    /// (Beacon + Personas) nobody is a creator: every person gets the
    /// neighbor layout, verified or not.
    private func derivedKind(from profile: PublicProfile) -> PublicProfileKind {
        guard LaunchFeatures.beacon, LaunchFeatures.personas else { return .local }
        return hasHomeResidency(profile) ? .local : .persona
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
