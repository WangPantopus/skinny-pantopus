//
//  PulseFeedViewModel.swift
//  Pantopus
//
//  Backs the Pulse feed (Hub → Pulse pillar). Fetches
//  `GET /api/posts/feed?surface=place|connections` and refetches when the
//  surface toggle or the chip-row filter changes. Reactions optimistically
//  toggle the local count and hit `POST /api/posts/:id/like`; the card
//  overflow menu drives save / repost / share / hide / mute / not-helpful /
//  solve / report / delete against `backend/routes/posts.js`.
//

import Foundation
import Logging
import Observation

// swiftlint:disable file_length type_body_length

/// Render state for the Pulse feed screen.
public enum PulseFeedState: Sendable {
    case loading
    case empty(FeedEmptyContent)
    case loaded([PulsePostCardContent])
    case error(message: String)
}

/// Per-post client-side overrides applied on top of the last server page.
/// Keeps optimistic save / repost / solve state without re-fetching.
private struct PulsePostOverride {
    var isSaved: Bool?
    var isReposted: Bool?
    var shareCount: Int?
    var isSolved: Bool?
    var hasReacted: Bool?
    var likeCount: Int?
}

/// Pulse / Connections / Beacons feed view-model. The same engine backs all
/// three A03 surfaces; `surface` selects the backend query, the verified
/// floor, and the empty-state copy.
@Observable
@MainActor
public final class PulseFeedViewModel {
    /// Current render state.
    public private(set) var state: PulseFeedState = .loading

    /// Which surface this feed renders (Nearby / Connections / Beacons).
    public private(set) var surface: FeedSurface

    /// True when the Nearby / Connections toggle row should render. The
    /// Beacon Updates route locks its surface, matching RN's
    /// `hideSurfaceTabs`.
    public var showsSurfaceToggle: Bool {
        FeedSurface.toggleSurfaces.contains(surface)
    }

    /// Active chip-row filter. Drives the list query and the compose
    /// FAB's pre-fill.
    public private(set) var activeIntent: PulseIntent = .all

    // MARK: - Topic lane (Nearby only)

    /// Active topic lane. Non-nil swaps the post-type chip row for the
    /// topic's own mode chips — RN `useFeedFiltering.ts:45-50`.
    public private(set) var activeTopic: PulseTopic?

    /// Mode chip inside the Sports lane.
    public private(set) var sportsMode: PulseSportsMode = .forYou

    /// Event the `event` mode chip is scoped to. Defaults to the primary
    /// active event when the user hasn't picked one.
    public private(set) var eventKey: String?

    /// Currently-active major sports events, highest priority first.
    public private(set) var activeSportsEvents: [ActiveSportsEventDTO] = []

    /// Highest-priority active event — labels the `event` chip and backs
    /// the active-event module.
    public private(set) var primarySportsEvent: ActiveSportsEventDTO?

    /// Topics offered on this surface. Topic lanes are Nearby-only.
    public var availableTopics: [PulseTopic] {
        surface == .pulse ? PulseTopic.allCases : []
    }

    /// True while the Sports lane is showing.
    public var isInSportsLane: Bool {
        surface == .pulse && activeTopic == .sports
    }

    /// Mode chips for the active lane — the `event` chip is relabelled
    /// with the primary event's short label and hidden when nothing is
    /// live (RN `FeedScreen.tsx:117-127`).
    public var sportsModeChips: [(mode: PulseSportsMode, label: String)] {
        guard isInSportsLane else { return [] }
        let primaryLabel = primarySportsEvent?.chipLabel
        return PulseSportsMode.allCases.compactMap { mode in
            if mode == .event {
                guard let primaryLabel else { return nil }
                return (mode, primaryLabel)
            }
            return (mode, mode.label)
        }
    }

    // MARK: - Radius suggestion

    /// Radius of the viewer's active viewing location. Set by the
    /// context bar so the suggestion ladder lines up with the server.
    public var viewingRadiusMiles: Double = 100 {
        didSet {
            guard viewingRadiusMiles != oldValue else { return }
            // A manual radius change re-arms the banner (RN
            // `useRadiusSuggestion.ts:117-122`).
            radiusSuggestionDismissed = false
            recomputeRadiusSuggestion()
        }
    }

    /// Proposed radius change when the lane came back nearly empty (or
    /// overwhelmingly full). `nil` hides the banner.
    public private(set) var radiusSuggestion: FeedRadiusSuggestion?

    /// Session-scoped dismissal, re-armed whenever the radius changes —
    /// RN `useRadiusSuggestion.ts:117-122`.
    private var radiusSuggestionDismissed = false

    /// Locality name surfaced on the empty state. Set from the loaded
    /// first post or a backend hint.
    public private(set) var scopeLabel: String?

    /// True while a next-page fetch is in flight (footer spinner).
    public private(set) var isLoadingMore = false

    /// Transient banner text — mirrors RN's `showToast` calls.
    public var toastMessage: String?

    /// The post whose overflow menu is open, if any.
    public var overflowPostId: String?

    /// The post awaiting a report-reason pick, if any.
    public var reportingPostId: String?

    /// The post awaiting delete confirmation, if any.
    public var deletingPostId: String?

    /// The post whose author is awaiting mute confirmation, if any.
    public var mutingPostId: String?

    /// True while the preferences sheet is presented.
    public var showsPreferences = false

    /// Top-bar search query — filters the loaded rows client-side.
    public var searchText: String = "" {
        didSet { if searchText != oldValue { rebuildLoadedState() } }
    }

    private let api: APIClient
    private let locationProvider: any LocationProviding
    private let logger = Logger(label: "app.pantopus.ios.PulseFeed")
    /// Optional fixed coordinates (tests / previews). When nil, fetch
    /// resolves the device location before hitting the feed API.
    private let latitude: Double?
    private let longitude: Double?
    /// Caller-supplied viewer id (tests / previews). When nil the VM falls
    /// back to the signed-in session.
    private let explicitViewerId: String?
    /// Signed-in user id — gates delete / mark-solved / report per RN.
    private var viewerId: String? {
        if let explicitViewerId, !explicitViewerId.isEmpty { return explicitViewerId }
        if case let .signedIn(user) = AuthManager.shared.state { return user.id }
        return nil
    }

    private var resolvedLatitude: Double?
    private var resolvedLongitude: Double?
    private var loadedItems: [FeedPostDTO] = []
    private var isLoading = false
    private var hasMore = false
    private var nextCursorCreatedAt: String?
    private var nextCursorId: String?
    /// Optimistic per-post state layered over `loadedItems`.
    private var overrides: [String: PulsePostOverride] = [:]
    /// Posts removed client-side by *this* surface (deleted / dismissed).
    /// Hides live in `moderation` instead — they are app-wide.
    private var removedPostIds: Set<String> = []
    /// App-wide mute / hide layer shared by every feed surface, mirroring
    /// RN's `PantopusProvider` (`mutedEntities` + `hiddenPostIds`).
    private let moderation: FeedModerationStore
    /// Muted topics stay local: `POST /api/posts/mute/topic` is scoped to a
    /// surface, so a topic muted on Nearby is not muted on Beacons.
    private var mutedPostTypes: Set<String> = []

    init(
        api: APIClient = .shared,
        surface: FeedSurface = .pulse,
        latitude: Double? = nil,
        longitude: Double? = nil,
        viewerId: String? = nil,
        locationProvider: any LocationProviding = DeviceLocationProvider.shared,
        moderation: FeedModerationStore = .shared
    ) {
        self.api = api
        self.surface = surface
        self.latitude = latitude
        self.longitude = longitude
        self.locationProvider = locationProvider
        explicitViewerId = viewerId
        self.moderation = moderation
    }

    /// First-time load. Refetches when still empty so a location fix can
    /// populate the feed after permissions are granted.
    public func load() async {
        if case .loaded = state { return }
        await fetch()
    }

    /// Pull-to-refresh / retry.
    public func refresh() async {
        await fetch()
    }

    /// Nearby ↔ Connections toggle. Clears the chip filter like RN's
    /// `handleSurfaceChange` (`useFeedData.ts:228-233`).
    public func selectSurface(_ next: FeedSurface) async {
        guard next != surface else { return }
        surface = next
        activeIntent = .all
        // Leaving Nearby clears the topic lane — topics are Nearby-only
        // (RN `useFeedFiltering.ts:24-27`).
        if next != .pulse { activeTopic = nil }
        loadedItems = []
        overrides = [:]
        removedPostIds = []
        state = .loading
        await fetch()
    }

    /// Chip-row tap. `all` clears the filter and the FAB pre-fill.
    public func selectIntent(_ intent: PulseIntent) async {
        guard intent != activeIntent else { return }
        activeIntent = intent
        await fetch()
    }

    /// Topic-chip tap. Passing `nil` (or re-tapping the active chip)
    /// exits the lane. Entering or leaving resets the post-type filter
    /// and the sports mode — RN `useFeedFiltering.ts:29-42`.
    public func selectTopic(_ topic: PulseTopic?) async {
        guard topic != activeTopic else { return }
        activeTopic = topic
        activeIntent = .all
        sportsMode = .forYou
        eventKey = nil
        if topic == .sports, activeSportsEvents.isEmpty {
            await loadActiveSportsEvents()
        }
        await fetch()
    }

    /// Sports mode-chip tap.
    public func selectSportsMode(_ mode: PulseSportsMode) async {
        guard mode != sportsMode else { return }
        sportsMode = mode
        await fetch()
    }

    /// "See threads" on the active-event module — pins the lane to that
    /// event and switches to the `event` mode.
    public func selectSportsEvent(eventKey key: String) async {
        eventKey = key
        sportsMode = .event
        await fetch()
    }

    /// Read `GET /api/sports/active-events`. Optional: a failure just
    /// hides the event chip and the module.
    public func loadActiveSportsEvents() async {
        let response: ActiveSportsEventsResponse? = try? await api.request(
            SportsEndpoints.activeEvents()
        )
        activeSportsEvents = response?.events ?? []
        primarySportsEvent = response?.primaryEvent ?? activeSportsEvents.first
    }

    /// Dismiss the radius-suggestion banner for this radius.
    public func dismissRadiusSuggestion() {
        radiusSuggestionDismissed = true
        radiusSuggestion = nil
    }

    /// Recompute the banner from the last page size. Called after every
    /// fetch and whenever the viewing radius changes.
    private func recomputeRadiusSuggestion() {
        guard surface == .pulse, !radiusSuggestionDismissed else {
            radiusSuggestion = nil
            return
        }
        radiusSuggestion = FeedRadiusSuggestion.compute(
            currentRadius: viewingRadiusMiles,
            itemCount: loadedItems.count
        )
    }

    /// Infinite scroll — call from the last visible row's `onAppear`.
    public func loadMoreIfNeeded(rowId: String) async {
        guard hasMore, !isLoading, !isLoadingMore else { return }
        guard case let .loaded(rows) = state, rows.last?.id == rowId else { return }
        await fetchNextPage()
    }

    /// Tap on a post's primary reaction. Optimistically toggles the
    /// per-post `userHasReacted` flag + helpful count, then hits
    /// `POST /api/posts/:id/like`. Rolls back on failure.
    public func tapReaction(postId: String) async {
        guard let item = loadedItems.first(where: { $0.id == postId }) else { return }
        let current = effectiveHasReacted(item)
        let currentCount = effectiveLikeCount(item)
        let toggled = !current
        overrides[postId, default: PulsePostOverride()].hasReacted = toggled
        overrides[postId, default: PulsePostOverride()].likeCount = max(0, currentCount + (toggled ? 1 : -1))
        rebuildLoadedState()

        do {
            let response = try await api.request(
                PostsEndpoints.toggleLike(id: postId),
                as: PostLikeResponse.self
            )
            overrides[postId, default: PulsePostOverride()].hasReacted = response.liked
            overrides[postId, default: PulsePostOverride()].likeCount = response.likeCount
        } catch {
            overrides[postId, default: PulsePostOverride()].hasReacted = current
            overrides[postId, default: PulsePostOverride()].likeCount = currentCount
        }
        rebuildLoadedState()
    }

    // MARK: - Overflow actions

    /// Public web URL handed to the system share sheet.
    public func shareURL(postId: String) -> URL? {
        URL(string: "https://www.pantopus.com/posts/\(postId)")
    }

    /// `POST /api/posts/:id/save` — optimistic bookmark toggle with
    /// rollback (RN `useFeedData.ts:126`).
    public func toggleSave(postId: String) async {
        guard let item = loadedItems.first(where: { $0.id == postId }) else { return }
        let original = effectiveIsSaved(item)
        overrides[postId, default: PulsePostOverride()].isSaved = !original
        rebuildLoadedState()
        do {
            let response = try await api.request(
                PostsEndpoints.toggleSave(id: postId),
                as: PostSaveResponse.self
            )
            overrides[postId, default: PulsePostOverride()].isSaved = response.saved
            toastMessage = response.saved ? "Saved to your bookmarks." : "Removed from bookmarks."
        } catch {
            overrides[postId, default: PulsePostOverride()].isSaved = original
            toastMessage = "Couldn't update your bookmark."
        }
        rebuildLoadedState()
    }

    /// `POST /api/posts/:id/share` with `shareType: "repost"` — optimistic
    /// toggle + count, rolled back on failure (RN `useFeedData.ts:140`).
    public func toggleRepost(postId: String) async {
        guard let item = loadedItems.first(where: { $0.id == postId }) else { return }
        let original = effectiveIsReposted(item)
        let originalCount = effectiveShareCount(item)
        overrides[postId, default: PulsePostOverride()].isReposted = !original
        overrides[postId, default: PulsePostOverride()].shareCount = max(0, originalCount + (original ? -1 : 1))
        rebuildLoadedState()
        do {
            let response = try await api.request(
                PostsEndpoints.share(id: postId, shareType: "repost"),
                as: PostShareResponse.self
            )
            let reposted = response.reposted ?? !original
            overrides[postId, default: PulsePostOverride()].isReposted = reposted
            overrides[postId, default: PulsePostOverride()].shareCount = response.shareCount ?? originalCount
            toastMessage = reposted ? "Reposted to your network." : "Repost removed."
        } catch {
            overrides[postId, default: PulsePostOverride()].isReposted = original
            overrides[postId, default: PulsePostOverride()].shareCount = originalCount
            toastMessage = "Could not update repost."
        }
        rebuildLoadedState()
    }

    /// Records the external share once the system sheet was used —
    /// count bump only, never surfaced (RN `useFeedData.ts:173`).
    public func recordShare(postId: String) async {
        do {
            _ = try await api.request(
                PostsEndpoints.share(id: postId, shareType: "external"),
                as: PostShareResponse.self
            )
        } catch {
            logger.warning("Share record failed: \(error)")
        }
    }

    /// `POST /api/posts/hide/:id` — drops the row immediately, restores it
    /// if the call fails. The hide is recorded app-wide (RN's
    /// `addHiddenPost`), so the post stays gone on every other surface too.
    public func hidePost(postId: String) async {
        moderation.addHiddenPost(postId)
        rebuildLoadedState()
        do {
            _ = try await api.request(
                FeedActionsEndpoints.hidePost(id: postId),
                as: PostActionAckResponse.self
            )
            toastMessage = "Post hidden from your feed."
        } catch {
            moderation.removeHiddenPost(postId)
            toastMessage = "Couldn't hide that post."
            rebuildLoadedState()
        }
    }

    /// `POST /api/posts/:id/not-helpful` — ranking signal only; the row
    /// stays put (RN `useFeedData.ts:187`).
    public func markNotHelpful(postId: String) async {
        do {
            _ = try await api.request(
                FeedActionsEndpoints.notHelpful(id: postId, surface: surface.moderationSurface),
                as: FeedNotHelpfulResponse.self
            )
            toastMessage = "Thanks! We'll show fewer posts like this."
        } catch {
            toastMessage = "Couldn't send that feedback."
        }
    }

    /// `PATCH /api/posts/:id/solve` — author-only (RN
    /// `useFeedData.ts:202`).
    public func markSolved(postId: String) async {
        do {
            _ = try await api.request(
                FeedActionsEndpoints.solve(id: postId),
                as: FeedSolveResponse.self
            )
            overrides[postId, default: PulsePostOverride()].isSolved = true
            toastMessage = "Marked as solved."
            rebuildLoadedState()
        } catch {
            toastMessage = "Couldn't mark that solved."
        }
    }

    /// `POST /api/posts/seeded/:factId/dismiss` — optimistic removal
    /// (RN `useFeedData.ts:194`).
    public func dismissSeededFact(factId: String) async {
        removedPostIds.insert(factId)
        rebuildLoadedState()
        do {
            _ = try await api.request(
                FeedActionsEndpoints.dismissSeededFact(factId: factId),
                as: FeedSeededDismissResponse.self
            )
        } catch {
            removedPostIds.remove(factId)
            rebuildLoadedState()
        }
    }

    /// `POST /api/posts/mute` — mutes the post's author (user or business)
    /// and strips every one of their rows from the visible list.
    public func muteAuthor(postId: String) async {
        guard let item = loadedItems.first(where: { $0.id == postId }) else { return }
        let entityType: FeedMuteEntityType = item.businessAuthorId != nil ? .business : .user
        guard let entityId = item.businessAuthorId ?? item.userId else { return }
        let name = item.creator?.displayName ?? "this author"
        // App-wide: RN's `addMute` lives on the provider, so the author is
        // filtered on every surface, not just this one.
        moderation.addMute(entityType: entityType, entityId: entityId)
        rebuildLoadedState()
        do {
            _ = try await api.request(
                FeedActionsEndpoints.mute(entityType: entityType, entityId: entityId),
                as: PostActionAckResponse.self
            )
            toastMessage = "Muted \(name)."
        } catch {
            moderation.removeMute(entityType: entityType, entityId: entityId)
            toastMessage = "Couldn't mute \(name)."
            rebuildLoadedState()
        }
    }

    /// `POST /api/posts/mute/topic` — mutes the post's type on this
    /// surface and strips matching rows straight away.
    public func muteTopic(postId: String) async {
        guard let item = loadedItems.first(where: { $0.id == postId }),
              let postType = item.postType, !postType.isEmpty else { return }
        let label = PulseIntent.from(postType: postType).cardChipLabel
        mutedPostTypes.insert(postType)
        rebuildLoadedState()
        do {
            _ = try await api.request(
                FeedActionsEndpoints.muteTopic(postType: postType, surface: surface.backendSurface),
                as: PostActionAckResponse.self
            )
            toastMessage = "Muted \(label) on \(surface.toggleLabel)."
        } catch {
            mutedPostTypes.remove(postType)
            toastMessage = "Couldn't mute \(label)."
            rebuildLoadedState()
        }
    }

    /// `POST /api/posts/:id/report` — one of the `reportPostSchema`
    /// reasons (`backend/routes/posts.js:3168`).
    public func reportPost(postId: String, reason: String) async {
        do {
            _ = try await api.request(
                PostsEndpoints.report(id: postId, reason: reason),
                as: PostActionAckResponse.self
            )
            toastMessage = "Report sent. We'll review it shortly."
        } catch {
            toastMessage = "Couldn't send that report."
        }
    }

    /// `DELETE /api/posts/:id` — author-only, optimistic removal with
    /// rollback (RN `useFeedData.ts:209`).
    public func deletePost(postId: String) async {
        removedPostIds.insert(postId)
        rebuildLoadedState()
        do {
            _ = try await api.request(
                PostsEndpoints.deletePost(id: postId),
                as: PostActionAckResponse.self
            )
        } catch {
            removedPostIds.remove(postId)
            toastMessage = "Could not delete post."
            rebuildLoadedState()
        }
    }

    // MARK: - Fetch

    private func fetch() async {
        if isLoading { return }
        isLoading = true
        defer { isLoading = false }
        if case .loaded = state {} else { state = .loading }
        do {
            let coords = await resolvedCoordinates()
            let response: FeedResponse = try await api.request(
                PostsEndpoints.feed(
                    surface: surface.backendSurface,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    postType: isInSportsLane ? nil : activeIntent.postType,
                    limit: 20,
                    topic: topicQueryValue,
                    sportsMode: isInSportsLane ? sportsMode.rawValue : nil,
                    eventKey: isInSportsLane ? resolvedEventKey : nil
                )
            )
            loadedItems = response.posts
            applyPagination(response.pagination)
            scopeLabel = response.posts.first?.locationName ?? scopeLabel
            recomputeRadiusSuggestion()
            rebuildLoadedState()
        } catch {
            let message = (error as? APIError)?.errorDescription ?? "Couldn't load posts."
            state = .error(message: message)
        }
    }

    /// Keyset-paged follow-up fetch — appends below the loaded rows.
    private func fetchNextPage() async {
        guard let cursorCreatedAt = nextCursorCreatedAt, let cursorId = nextCursorId else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let coords = await resolvedCoordinates()
            let response: FeedResponse = try await api.request(
                PostsEndpoints.feed(
                    surface: surface.backendSurface,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    postType: isInSportsLane ? nil : activeIntent.postType,
                    limit: 20,
                    cursorCreatedAt: cursorCreatedAt,
                    cursorId: cursorId,
                    topic: topicQueryValue,
                    sportsMode: isInSportsLane ? sportsMode.rawValue : nil,
                    eventKey: isInSportsLane ? resolvedEventKey : nil
                )
            )
            // Seeded/system cards can repeat across pages — dedupe by id.
            let known = Set(loadedItems.map(\.id))
            loadedItems += response.posts.filter { !known.contains($0.id) }
            applyPagination(response.pagination)
            rebuildLoadedState()
        } catch {
            // Leave the loaded rows alone; the next scroll retries.
            hasMore = true
        }
    }

    /// `topic` param — Place-only, and only while a lane is active
    /// (`backend/routes/posts.js:1481-1484` rejects it elsewhere).
    private var topicQueryValue: String? {
        guard surface == .pulse, let activeTopic else { return nil }
        return activeTopic.queryValue
    }

    /// `eventKey` param — the user's pick, else the primary active event.
    private var resolvedEventKey: String? {
        eventKey ?? primarySportsEvent?.eventKey
    }

    private func applyPagination(_ pagination: FeedPagination?) {
        hasMore = pagination?.hasMore ?? false
        nextCursorId = pagination?.nextCursor
        nextCursorCreatedAt = pagination?.nextCursorCreatedAt
        if nextCursorId == nil || nextCursorCreatedAt == nil { hasMore = false }
    }

    /// Re-projects `loadedItems` (applying removals, mutes, optimistic
    /// overrides, and the search filter) into the render state. No-op while
    /// loading/error.
    private func rebuildLoadedState() {
        let visible = loadedItems.filter { isVisible($0) }
        if visible.isEmpty {
            if case .error = state { return }
            state = .empty(surface.emptyContent(scopeLabel: scopeLabel, followCount: 0))
            return
        }
        var rows = visible.map { project($0) }
        let needle = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if !needle.isEmpty {
            rows = rows.filter {
                $0.body.lowercased().contains(needle)
                    || ($0.title?.lowercased().contains(needle) ?? false)
                    || $0.authorName.lowercased().contains(needle)
            }
        }
        state = .loaded(rows)
    }

    private func isVisible(_ post: FeedPostDTO) -> Bool {
        if removedPostIds.contains(post.id) { return false }
        guard moderation.isVisible(
            postId: post.id,
            userId: post.userId,
            businessAuthorId: post.businessAuthorId
        ) else { return false }
        if let postType = post.postType, mutedPostTypes.contains(postType) { return false }
        return true
    }

    private func resolvedCoordinates() async -> (latitude: Double?, longitude: Double?) {
        if let latitude, let longitude {
            return (latitude, longitude)
        }
        if let resolvedLatitude, let resolvedLongitude {
            return (resolvedLatitude, resolvedLongitude)
        }
        if let cached = locationProvider.cachedCoordinate() {
            resolvedLatitude = cached.latitude
            resolvedLongitude = cached.longitude
            return (cached.latitude, cached.longitude)
        }
        if let fresh = await locationProvider.requestCurrent(timeoutSeconds: 4) {
            resolvedLatitude = fresh.latitude
            resolvedLongitude = fresh.longitude
            return (fresh.latitude, fresh.longitude)
        }
        return (nil, nil)
    }

    // MARK: - Optimistic accessors

    private func effectiveIsSaved(_ post: FeedPostDTO) -> Bool {
        overrides[post.id]?.isSaved ?? post.userHasSaved
    }

    private func effectiveIsReposted(_ post: FeedPostDTO) -> Bool {
        overrides[post.id]?.isReposted ?? post.userHasReposted
    }

    private func effectiveShareCount(_ post: FeedPostDTO) -> Int {
        overrides[post.id]?.shareCount ?? post.shareCount
    }

    private func effectiveIsSolved(_ post: FeedPostDTO) -> Bool {
        overrides[post.id]?.isSolved ?? (post.state == "solved")
    }

    private func effectiveHasReacted(_ post: FeedPostDTO) -> Bool {
        overrides[post.id]?.hasReacted ?? post.userHasLiked
    }

    private func effectiveLikeCount(_ post: FeedPostDTO) -> Int {
        overrides[post.id]?.likeCount ?? post.likeCount
    }

    // MARK: - Projection

    private func project(_ post: FeedPostDTO) -> PulsePostCardContent {
        let intent = PulseIntent.from(postType: post.postType)
        let initials = Self.initials(from: post.creator?.displayName ?? "?")
        let isBusiness = post.creator?.accountType == "business" || post.businessAuthorId != nil
        let hasReacted = effectiveHasReacted(post)
        let likeCount = effectiveLikeCount(post)
        let attendees: PulseAttendeeStrip? = intent == .event
            ? PulseAttendeeStrip(
                avatars: [],
                goingCount: likeCount, // backend doesn't surface attendees yet
                userIsGoing: hasReacted
            )
            : nil
        let isOwner = Self.isOwner(post: post, viewerId: viewerId)
        let isSolved = effectiveIsSolved(post)
        return PulsePostCardContent(
            id: post.id,
            authorName: post.creator?.displayName ?? "Pantopus user",
            authorInitials: initials,
            // Beacons authors are all verified by definition; on Pulse, fall
            // back to account-type until the backend surfaces creator.verified.
            authorVerified: surface.authorsAlwaysVerified || isBusiness,
            avatarTint: isBusiness ? .violet : .sky,
            meta: Self.metaString(post: post, intent: intent),
            intent: intent,
            title: intent == .event ? post.title : nil,
            body: post.content,
            // The backend persists a single like counter; the secondary
            // verb is display-only and has no count source, so it stays 0
            // (comment count lives on the Reply affordance instead).
            reactions: intent.reactionTemplate(
                helpfulCount: likeCount,
                secondaryCount: 0
            ),
            attendees: attendees,
            userHasReacted: hasReacted,
            // Image tiles render the full-size stills (thumbnails are
            // 200×200 and look soft at card width); thumbnails still ride
            // along because they're the only poster a video tile has.
            media: PostMediaItem.items(
                urls: post.mediaURLs,
                types: post.mediaTypes,
                thumbnails: post.mediaThumbnails,
                liveURLs: post.mediaLiveURLs
            ),
            commentCount: post.commentCount,
            actions: PulsePostActions(
                isSeeded: post.isSeeded,
                isSaved: effectiveIsSaved(post),
                isReposted: effectiveIsReposted(post),
                shareCount: effectiveShareCount(post),
                isSolved: isSolved,
                isOwner: isOwner,
                canMarkSolved: isOwner && post.postType == "ask_local" && !isSolved,
                canFlagNotHelpful: surface.supportsNotHelpful && !isOwner && !post.isSeeded,
                muteEntityType: post.businessAuthorId != nil ? .business : (post.userId != nil ? .user : nil),
                muteEntityId: post.businessAuthorId ?? post.userId,
                muteEntityName: post.creator?.displayName ?? "this author",
                postType: post.postType,
                topicLabel: intent.cardChipLabel
            )
        )
    }

    private static func isOwner(post: FeedPostDTO, viewerId: String?) -> Bool {
        guard let viewerId, !viewerId.isEmpty else { return false }
        if post.userId == viewerId { return true }
        return post.creator?.id == viewerId
    }

    private static func metaString(post: FeedPostDTO, intent _: PulseIntent) -> String {
        let relative = relative(timestamp: post.createdAt)
        if let locality = post.locationName, !locality.isEmpty {
            return "\(relative) · \(locality)"
        }
        return relative
    }

    private static func relative(timestamp: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: timestamp) ?? ISO8601DateFormatter().date(from: timestamp) ?? Date()
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private static func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}
