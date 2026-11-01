//
//  ProfilePostCardsModel.swift
//  Pantopus
//
//  A person's posts on their profile, drawn with the Pulse card
//  (`PulsePostCard`): photos and videos, event times, tappable links,
//  Helpful, Save, Repost and the post menu (share, report). The rows come
//  from `GET /api/posts/user/:id`, which uses the feed's serializer, and each
//  tap calls the endpoint the Pulse feed calls for it
//  (`PulseFeedViewModel`).
//

import Foundation
import Logging
import Observation

/// The profile's post cards and what the viewer's taps did to them.
@MainActor
@Observable
public final class ProfilePostCardsModel {
    /// One card per post, in the order the server listed them.
    public private(set) var cards: [PulsePostCardContent] = []
    /// The post whose "Post options" menu is open.
    public var overflowPostId: String?
    /// The post being reported: the reason picker is open.
    public var reportingPostId: String?
    /// Bumped by every tap, so a read that started before one can't undo it.
    public private(set) var actionRevision = 0
    /// Action feedback ("Saved to your bookmarks."), shown by the profile's toast.
    @ObservationIgnored var onToast: (@MainActor (String) -> Void)?
    /// Whose profile this is: their own posts wear their profile color, as
    /// the header above them does (`ProfileAvatarColor`).
    @ObservationIgnored var profileUserId: String?

    @ObservationIgnored private var posts: [FeedPostDTO] = []
    @ObservationIgnored private var overrides: [String: Override] = [:]
    @ObservationIgnored private var pending: [String: Set<PulsePendingAction>] = [:]
    @ObservationIgnored private var preparingShares: Set<String> = []
    @ObservationIgnored private let viewerId: String?
    @ObservationIgnored private let client: APIClient
    @ObservationIgnored private let store: ScreenStore
    @ObservationIgnored private let logger = Logger(label: "app.pantopus.ios.ProfilePostCards")

    /// A tap's value until a later read confirms it.
    private struct Override {
        var hasReacted: Bool?
        var likeCount: Int?
        var isSaved: Bool?
        var isReposted: Bool?
        var shareCount: Int?
    }

    init(viewerId: String?, client: APIClient, store: ScreenStore) {
        self.viewerId = viewerId
        self.client = client
        self.store = store
    }

    /// The posts' ids, to ask the store whether one was changed elsewhere.
    var postIds: [String] {
        posts.map(\.id)
    }

    /// The card whose menu is open.
    var overflowCard: PulsePostCardContent? {
        cards.first { $0.id == overflowPostId }
    }

    /// Rows from a read. A tap still waiting for the server keeps its value;
    /// a settled one gives way to a read that started after the last tap.
    func show(_ rows: [FeedPostDTO], readRevision: Int) {
        posts = rows
        if readRevision == actionRevision {
            for id in Array(overrides.keys) where pending[id, default: []].isEmpty {
                overrides[id] = nil
            }
        }
        rebuild()
    }

    /// Whether the card's "Post options" menu has anything in it.
    func hasOptions(_ card: PulsePostCardContent) -> Bool {
        shareURL(postId: card.id) != nil || card.actions.canReport || pinTitle(postId: card.id) != nil
    }

    // MARK: - Taps

    /// Helpful (or Going on an Event): `POST /api/posts/:id/like`, shown at
    /// once and rolled back if the server refuses.
    func tapReaction(postId: String) async {
        guard let post = post(postId), begin(.reaction, postId: postId) else { return }
        let current = overrides[postId]?.hasReacted ?? post.userHasLiked
        let currentCount = overrides[postId]?.likeCount ?? post.likeCount
        let toggled = !current
        overrides[postId, default: Override()].hasReacted = toggled
        overrides[postId, default: Override()].likeCount = max(0, currentCount + (toggled ? 1 : -1))
        rebuild()
        defer { finish(.reaction, postId: postId) }
        do {
            let response = try await client.request(
                PostsEndpoints.toggleLike(id: postId, liked: toggled),
                as: PostLikeResponse.self
            )
            overrides[postId, default: Override()].hasReacted = response.liked
            overrides[postId, default: Override()].likeCount = response.likeCount
            store.markStale(topics: [ScreenTopic.posts, ScreenTopic.post(postId)])
        } catch {
            overrides[postId, default: Override()].hasReacted = current
            overrides[postId, default: Override()].likeCount = currentCount
            onToast?("Couldn't update your reaction.")
        }
    }

    /// `POST /api/posts/:id/save`, shown at once and rolled back on failure.
    func toggleSave(postId: String) async {
        guard let post = post(postId), begin(.save, postId: postId) else { return }
        let original = overrides[postId]?.isSaved ?? post.userHasSaved
        overrides[postId, default: Override()].isSaved = !original
        rebuild()
        defer { finish(.save, postId: postId) }
        do {
            let response = try await client.request(
                PostsEndpoints.toggleSave(id: postId, saved: !original),
                as: PostSaveResponse.self
            )
            overrides[postId, default: Override()].isSaved = response.saved
            store.markStale(topics: [ScreenTopic.posts, ScreenTopic.post(postId)])
            onToast?(response.saved ? "Saved to your bookmarks." : "Removed from bookmarks.")
        } catch {
            overrides[postId, default: Override()].isSaved = original
            onToast?("Couldn't update your bookmark.")
        }
    }

    /// `POST /api/posts/:id/share` as a repost, shown at once and rolled
    /// back on failure.
    func toggleRepost(postId: String) async {
        guard let post = post(postId), begin(.repost, postId: postId) else { return }
        let original = overrides[postId]?.isReposted ?? post.userHasReposted
        let originalCount = overrides[postId]?.shareCount ?? post.shareCount
        overrides[postId, default: Override()].isReposted = !original
        overrides[postId, default: Override()].shareCount = max(0, originalCount + (original ? -1 : 1))
        rebuild()
        defer { finish(.repost, postId: postId) }
        do {
            let response = try await client.request(
                PostsEndpoints.share(id: postId, shareType: "repost", reposted: !original),
                as: PostShareResponse.self
            )
            let reposted = response.reposted ?? !original
            overrides[postId, default: Override()].isReposted = reposted
            overrides[postId, default: Override()].shareCount = response.shareCount ?? originalCount
            store.markStale(topics: [ScreenTopic.posts, ScreenTopic.post(postId)])
            onToast?(reposted ? "Reposted to your network." : "Repost removed.")
        } catch {
            overrides[postId, default: Override()].isReposted = original
            overrides[postId, default: Override()].shareCount = originalCount
            onToast?("Could not update repost.")
        }
    }

    // MARK: - Post menu

    /// "Pin to profile" / "Unpin from profile" on your own posts (the server
    /// marks only those); nil hides it.
    func pinTitle(postId: String) -> String? {
        guard let post = post(postId) else { return nil }
        return ProfilePins.shared.menuTitle(postId, server: post.profilePinned)
    }

    /// Pins or unpins your post; the toast says what happened, or why not.
    func togglePin(postId: String) async {
        guard let post = post(postId) else { return }
        let toast = await ProfilePins.shared.toggle(postId, server: post.profilePinned, client: client)
        onToast?(toast.text)
    }

    /// The public web link handed to the share sheet; nil unless the post is public.
    func shareURL(postId: String) -> URL? {
        guard post(postId)?.canShareExternally == true else { return nil }
        return URL(string: "https://www.pantopus.com/posts/\(postId)")
    }

    /// The list may predate an audience change, so the server confirms the
    /// post can still be shared before its link leaves the app.
    func authorizeShare(postId: String) async -> URL? {
        guard shareURL(postId: postId) != nil, let actor = viewerId,
              preparingShares.insert(postId).inserted else { return nil }
        let sessionId = AuthManager.shared.sessionId
        defer { preparingShares.remove(postId) }
        do {
            let response: PostShareResponse = try await client.request(PostsEndpoints.share(id: postId, checkOnly: true))
            guard response.canShare == true, !Task.isCancelled, viewerId == actor,
                  sessionId == AuthManager.shared.sessionId else { return nil }
            return shareURL(postId: postId)
        } catch {
            onToast?("Couldn't share this post. Try again.")
            return nil
        }
    }

    /// Counts the share once the system sheet was used; never shown.
    func recordShare(postId: String, sessionId: String?) async {
        guard sessionId == AuthManager.shared.sessionId, viewerId != nil else { return }
        do {
            _ = try await client.request(
                PostsEndpoints.share(id: postId, shareType: "external"),
                as: PostShareResponse.self
            )
        } catch {
            logger.warning("Share record failed: \(error)")
        }
    }

    /// `POST /api/posts/:id/report` with one of Pulse's report reasons.
    func report(postId: String, reason: String) async {
        do {
            _ = try await client.request(
                PostsEndpoints.report(id: postId, reason: reason),
                as: PostActionAckResponse.self
            )
            onToast?("Report sent. We'll review it shortly.")
        } catch {
            onToast?("Couldn't send that report.")
        }
    }

    // MARK: - Helpers

    private func post(_ postId: String) -> FeedPostDTO? {
        posts.first { $0.id == postId }
    }

    private func begin(_ action: PulsePendingAction, postId: String) -> Bool {
        guard pending[postId, default: []].insert(action).inserted else { return false }
        actionRevision += 1
        return true
    }

    private func finish(_ action: PulsePendingAction, postId: String) {
        pending[postId]?.remove(action)
        actionRevision += 1
        rebuild()
    }

    private func rebuild() {
        cards = posts.map { post in
            var live = PulseCardLiveValues(post)
            if let value = overrides[post.id] {
                live.hasReacted = value.hasReacted ?? live.hasReacted
                live.likeCount = value.likeCount ?? live.likeCount
                live.isSaved = value.isSaved ?? live.isSaved
                live.isReposted = value.isReposted ?? live.isReposted
                live.shareCount = value.shareCount ?? live.shareCount
            }
            live.pending = pending[post.id] ?? []
            var card = PulseFeedViewModel.card(for: post, viewerId: viewerId, surface: nil, live: live)
            // Every post here is the person's own; one written for a business keeps the business look.
            if let profileUserId, post.businessAuthorId == nil {
                card.avatarColor = ProfileAvatarColor(userId: profileUserId).color
            }
            return card
        }
    }
}
