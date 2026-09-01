//
//  PulsePostDetailViewModel.swift
//  Pantopus
//
//  Loads a single Pulse post, lets the user toggle reactions optimistic-
//  style, and posts new comments inline. Tap-targets for the multi-kind
//  reaction bar (Helpful/Heart/Going) all map to the single backend
//  `POST /:id/like` toggle today — see PR description for the discrepancy.
//

import Foundation
import Logging
import Observation

// swiftlint:disable file_length type_body_length

/// View-model state for the Pulse post detail screen.
public enum PulsePostDetailState: Sendable, Equatable {
    case loading
    case loaded(PulsePostDetailContent)
    case error(message: String)
}

/// Hydrated content for the Pulse post detail. Built in the VM from the
/// route handler's `PostDetailDTO` so the view sees only render-ready
/// values (formatted timestamps, mapped identity pillars, etc.).
public struct PulsePostDetailContent: Sendable, Equatable, Hashable {
    public let post: PostDetailDTO
    public let authorDisplayName: String
    public let authorAvatarURL: URL?
    public let authorIdentity: IdentityPillar
    public let authorVerified: Bool
    public let timeAndLocality: String
    public let intent: PostIntent
    public let media: [PostMediaItem]
    public let reactions: PostReactionCounts
    public let comments: [PostCommentRow]
    public let hiddenReplyCount: Int

    public init(
        post: PostDetailDTO,
        authorDisplayName: String,
        authorAvatarURL: URL?,
        authorIdentity: IdentityPillar,
        authorVerified: Bool,
        timeAndLocality: String,
        intent: PostIntent,
        media: [PostMediaItem],
        reactions: PostReactionCounts,
        comments: [PostCommentRow],
        hiddenReplyCount: Int
    ) {
        self.post = post
        self.authorDisplayName = authorDisplayName
        self.authorAvatarURL = authorAvatarURL
        self.authorIdentity = authorIdentity
        self.authorVerified = authorVerified
        self.timeAndLocality = timeAndLocality
        self.intent = intent
        self.media = media
        self.reactions = reactions
        self.comments = comments
        self.hiddenReplyCount = hiddenReplyCount
    }

    /// Copy with replaced interaction state — keeps optimistic updates
    /// from re-stating every identity field.
    public func replacing(
        reactions: PostReactionCounts? = nil,
        comments: [PostCommentRow]? = nil,
        hiddenReplyCount: Int? = nil
    ) -> PulsePostDetailContent {
        PulsePostDetailContent(
            post: post,
            authorDisplayName: authorDisplayName,
            authorAvatarURL: authorAvatarURL,
            authorIdentity: authorIdentity,
            authorVerified: authorVerified,
            timeAndLocality: timeAndLocality,
            intent: intent,
            media: media,
            reactions: reactions ?? self.reactions,
            comments: comments ?? self.comments,
            hiddenReplyCount: hiddenReplyCount ?? self.hiddenReplyCount
        )
    }
}

/// Loads + mutates a single Pulse post.
@MainActor
@Observable
public final class PulsePostDetailViewModel {
    /// Render-state.
    public private(set) var state: PulsePostDetailState = .loading

    /// Inline composer's draft text. Bound from the view.
    public var composerText: String = ""

    /// True while a comment is in flight.
    public private(set) var isSendingComment: Bool = false

    /// Transient error string surfaced in the toast overlay.
    public var toastMessage: String?

    /// True when the entire reply thread is expanded.
    public private(set) var showingAllReplies: Bool = false

    /// Bound to the view's overflow confirmation dialog so the Edit
    /// action sheet pops when the owner taps the top-bar's
    /// more-horizontal icon.
    public var showsOverflowMenu: Bool = false

    /// Comment the composer is replying to; nil sends a top-level comment.
    public private(set) var replyTarget: ReplyTarget?

    /// Set after a successful author delete so the view can pop back.
    public private(set) var didDeletePost: Bool = false

    /// "Nearby Providers" — organically matched local businesses for this
    /// post's `service_category`. Empty when the post has no category, is
    /// older than the 30-day window, or nothing matched; the card is hidden
    /// in all three cases, exactly like RN.
    public private(set) var nearbyProviders: [NearbyProviderRow] = []

    /// Viewer's bookmark state (`POST /:id/save` toggle).
    public private(set) var isSaved: Bool = false

    /// Viewer's repost state (`POST /:id/share` with `shareType: repost`).
    public private(set) var isReposted: Bool = false

    /// Emoji the viewer picked from the long-press reaction popover.
    /// Maps onto the binary like server-side (parity with the RN app —
    /// there is no per-emoji backend yet), so it's session-local flair.
    public private(set) var selectedReactionEmoji: String?

    /// The popover's emoji palette — mirrors RN `PostReactionPicker`.
    public static let reactionEmojis = ["👍", "❤️", "🔥", "😂", "💯", "🎉"]

    /// The comment a reply is being composed against.
    public struct ReplyTarget: Sendable, Equatable {
        public let commentId: String
        public let authorName: String
    }

    private let postId: String
    private let currentUserId: String?
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.PulsePostDetail")
    private let maxInitialReplies = 3

    init(postId: String, currentUserId: String? = nil, client: APIClient = .shared) {
        self.postId = postId
        self.currentUserId = currentUserId
        self.client = client
    }

    /// True when the signed-in user authored the post on screen — the
    /// view uses this to gate the Edit overflow action.
    public var isOwner: Bool {
        guard let currentUserId, !currentUserId.isEmpty else { return false }
        guard case let .loaded(content) = state else { return false }
        return content.post.userId == currentUserId
    }

    /// First-load entry. Re-run via `refresh()` after a pull-to-refresh.
    public func load() async {
        state = .loading
        await fetch()
    }

    /// Pull-to-refresh.
    public func refresh() async {
        await fetch()
    }

    /// Expand the truncated reply list.
    public func showMoreReplies() {
        guard case let .loaded(content) = state else { return }
        showingAllReplies = true
        state = .loaded(rebuildContent(from: content.post))
    }

    /// Tap one of the reaction pills. Only `.helpful` is wired to a
    /// backend route today; the `ReactionsBar` view renders the other
    /// kinds as display-only so this method only ever sees `.helpful`,
    /// but we keep the guard as a safety net.
    public func tapReaction(_ kind: PostReactionKind) async {
        guard case var .loaded(content) = state else { return }
        guard kind.isBackendWired else { return }

        // Optimistic update on the helpful (likes) bucket.
        var optimistic = content.reactions
        let wasOn = optimistic.userReaction == .helpful
        if wasOn {
            optimistic.helpful = max(0, optimistic.helpful - 1)
            optimistic.userReaction = nil
            selectedReactionEmoji = nil
        } else {
            optimistic.helpful += 1
            optimistic.userReaction = .helpful
        }
        content = content.replacing(reactions: optimistic)
        state = .loaded(content)

        do {
            let response = try await client.request(
                PostsEndpoints.toggleLike(id: postId),
                as: PostLikeResponse.self
            )
            // Reconcile with server truth.
            var reconciled = optimistic
            reconciled.helpful = response.likeCount
            reconciled.userReaction = response.liked ? .helpful : nil
            state = .loaded(content.replacing(reactions: reconciled))
        } catch {
            logger.warning("Reaction toggle failed: \(error)")
            toastMessage = "Couldn't update your reaction"
            // Rollback.
            var rolled = optimistic
            if wasOn {
                rolled.helpful += 1
                rolled.userReaction = .helpful
            } else {
                rolled.helpful = max(0, rolled.helpful - 1)
                rolled.userReaction = nil
            }
            state = .loaded(content.replacing(reactions: rolled))
        }
    }

    /// Heart toggle on a single comment — optimistic, reconciled with
    /// the server's `{liked, likeCount}`, rolled back on failure.
    public func toggleCommentLike(commentId: String) async {
        guard case let .loaded(content) = state else { return }
        guard let index = content.comments.firstIndex(where: { $0.id == commentId }) else { return }
        let original = content.comments[index]
        var rows = content.comments
        rows[index] = original.withReaction(
            count: max(0, original.reactionCount + (original.userReacted ? -1 : 1)),
            userReacted: !original.userReacted
        )
        state = .loaded(content.replacing(comments: rows))

        do {
            let response = try await client.request(
                PostsEndpoints.toggleCommentLike(postId: postId, commentId: commentId),
                as: CommentLikeResponse.self
            )
            guard case let .loaded(current) = state,
                  let liveIndex = current.comments.firstIndex(where: { $0.id == commentId }) else { return }
            var reconciled = current.comments
            reconciled[liveIndex] = reconciled[liveIndex].withReaction(
                count: response.likeCount,
                userReacted: response.liked
            )
            state = .loaded(current.replacing(comments: reconciled))
        } catch {
            logger.warning("Comment like toggle failed: \(error)")
            toastMessage = "Couldn't update your reaction"
            guard case let .loaded(current) = state,
                  let liveIndex = current.comments.firstIndex(where: { $0.id == commentId }) else { return }
            var rolled = current.comments
            rolled[liveIndex] = original
            state = .loaded(current.replacing(comments: rolled))
        }
    }

    /// Arm the composer to reply to a specific comment.
    public func beginReply(to comment: PostCommentRow) {
        replyTarget = ReplyTarget(commentId: comment.id, authorName: comment.authorName)
    }

    /// Drop back to top-level commenting.
    public func cancelReply() {
        replyTarget = nil
    }

    /// Author-only comment delete; re-fetches so counts stay in sync.
    public func deleteComment(commentId: String) async {
        do {
            _ = try await client.request(
                PostsEndpoints.deleteComment(postId: postId, commentId: commentId),
                as: PostActionAckResponse.self
            )
            if replyTarget?.commentId == commentId { replyTarget = nil }
            await fetch()
        } catch {
            logger.warning("Comment delete failed: \(error)")
            toastMessage = "Couldn't delete the comment"
        }
    }

    /// Author-only post delete. Sets `didDeletePost` so the view pops.
    public func deletePost() async {
        do {
            _ = try await client.request(
                PostsEndpoints.deletePost(id: postId),
                as: PostActionAckResponse.self
            )
            didDeletePost = true
        } catch {
            logger.warning("Post delete failed: \(error)")
            toastMessage = "Couldn't delete the post"
        }
    }

    /// File a report against the post.
    public func reportPost(reason: String) async {
        do {
            _ = try await client.request(
                PostsEndpoints.report(id: postId, reason: reason),
                as: PostActionAckResponse.self
            )
            toastMessage = "Report submitted. Thanks for flagging."
        } catch {
            logger.warning("Post report failed: \(error)")
            toastMessage = "Couldn't submit the report"
        }
    }

    /// Pick an emoji from the long-press popover. The emoji itself is
    /// local flair; if the post isn't liked yet, the pick also turns the
    /// like on (matching the RN behavior of recording the reaction).
    public func pickReactionEmoji(_ emoji: String) async {
        selectedReactionEmoji = emoji
        if case let .loaded(content) = state, content.reactions.userReaction != .helpful {
            await tapReaction(.helpful)
        }
    }

    /// Bookmark toggle — optimistic, reconciled with `{saved}`.
    public func toggleSave() async {
        let original = isSaved
        isSaved.toggle()
        do {
            let response = try await client.request(
                PostsEndpoints.toggleSave(id: postId),
                as: PostSaveResponse.self
            )
            isSaved = response.saved
        } catch {
            logger.warning("Save toggle failed: \(error)")
            toastMessage = "Couldn't update your bookmark"
            isSaved = original
        }
    }

    /// Repost toggle — optimistic, reconciled with `{reposted}`.
    public func toggleRepost() async {
        let original = isReposted
        isReposted.toggle()
        do {
            let response = try await client.request(
                PostsEndpoints.share(id: postId, shareType: "repost"),
                as: PostShareResponse.self
            )
            isReposted = response.reposted ?? !original
        } catch {
            logger.warning("Repost toggle failed: \(error)")
            toastMessage = "Couldn't update your repost"
            isReposted = original
        }
    }

    /// Public web URL handed to the system share sheet.
    public var shareURL: URL? {
        URL(string: "https://www.pantopus.com/posts/\(postId)")
    }

    /// Record an external share after the share sheet was used.
    public func recordShare() async {
        do {
            _ = try await client.request(
                PostsEndpoints.share(id: postId),
                as: PostShareResponse.self
            )
        } catch {
            // Count bump only — not worth surfacing to the user.
            logger.warning("Share record failed: \(error)")
        }
    }

    /// Submit the composer's current text — top-level, or as a reply
    /// when `replyTarget` is armed. On success we re-fetch the post so
    /// the comment list, count, and any backend-side mutations
    /// (rate-limit windows, derived fields) stay in sync.
    public func sendComment() async {
        let body = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty, case .loaded = state, !isSendingComment else { return }
        isSendingComment = true
        defer { isSendingComment = false }
        let req = PostCommentRequest(comment: body, parentCommentId: replyTarget?.commentId)
        do {
            _ = try await client.request(
                PostsEndpoints.createComment(id: postId, body: req),
                as: PostCommentCreateResponse.self
            )
            composerText = ""
            replyTarget = nil
            await fetch()
        } catch {
            logger.warning("Comment send failed: \(error)")
            toastMessage = "Couldn't post your comment"
        }
    }

    // MARK: - Internal helpers

    private func fetch() async {
        do {
            let response = try await client.request(
                PostsEndpoints.detail(id: postId),
                as: PostDetailResponse.self
            )
            isSaved = response.post.userHasSaved
            isReposted = response.post.userHasReposted
            state = .loaded(rebuildContent(from: response.post))
        } catch let error as APIError {
            logger.warning("Post detail load failed: \(error)")
            state = .error(message: friendlyMessage(for: error))
        } catch {
            logger.warning("Post detail load failed: \(error)")
            state = .error(message: "Something went wrong")
        }
    }

    /// `GET /api/posts/:id/matched-businesses?cached=true`
    /// (`backend/routes/posts.js:2550`). Best-effort — a failure just hides
    /// the card rather than failing the post. Kicked from its own `.task`
    /// so the card never blocks (or fails) the post itself.
    public func loadNearbyProviders() async {
        await fetchNearbyProviders()
    }

    private func fetchNearbyProviders() async {
        do {
            let response = try await client.request(
                MatchedBusinessesEndpoints.matchedBusinesses(postId: postId),
                as: MatchedBusinessesResponse.self
            )
            nearbyProviders = response.businesses.compactMap(Self.providerRow(from:))
        } catch {
            logger.warning("Matched businesses load failed: \(error)")
            nearbyProviders = []
        }
    }

    /// Rows need a username to route to `/business/:username`; a payload
    /// without one is dropped rather than rendered as a dead tap target.
    static func providerRow(from dto: MatchedBusinessDTO) -> NearbyProviderRow? {
        guard let username = dto.username, !username.isEmpty else { return nil }
        return NearbyProviderRow(
            id: dto.businessUserId,
            username: username,
            name: dto.name?.isEmpty == false ? (dto.name ?? username) : username,
            avatarURL: dto.profilePictureUrl.flatMap(URL.init(string:)),
            category: dto.categories?.first,
            ratingLabel: NearbyProviderFormat.ratingLabel(dto.averageRating),
            reviewCountLabel: (dto.reviewCount ?? 0) > 0 ? "\(dto.reviewCount ?? 0)" : nil,
            distanceLabel: NearbyProviderFormat.distanceLabel(dto.distanceMiles),
            neighborLabel: NearbyProviderFormat.neighborLabel(dto.neighborCount),
            isNew: dto.isNewBusiness ?? false
        )
    }

    private func rebuildContent(from post: PostDetailDTO) -> PulsePostDetailContent {
        let displayName = post.creator?.displayName ?? "Pantopus user"
        let avatarURL = post.creator?.profilePictureURL.flatMap(URL.init(string:))
        let media = PostMediaItem.items(
            urls: post.mediaURLs,
            types: post.mediaTypes,
            thumbnails: post.mediaThumbnails,
            liveURLs: post.mediaLiveURLs
        )
        let identity: IdentityPillar = mapAccountType(post.creator?.accountType)
        let timeAndLocality = formatTimeAndLocality(
            createdAt: post.createdAt,
            // The post's own place label wins (A10.4 meta line); creator
            // locality and home city are fallbacks for legacy rows.
            locality: post.locationName ?? post.creator?.locality ?? post.home?.city
        )
        let intent = PostIntent.from(purpose: post.purpose, postType: post.postType)
        let reactions = PostReactionCounts(
            helpful: post.likeCount,
            heart: 0,
            going: 0,
            userReaction: post.userHasLiked ? .helpful : nil
        )
        let (rows, hidden) = buildCommentRows(post.comments)
        return PulsePostDetailContent(
            post: post,
            authorDisplayName: displayName,
            authorAvatarURL: avatarURL,
            authorIdentity: identity,
            // TODO(backend): backend `CREATOR_SELECT` for posts does not
            // include the `verified` column today, so the post header
            // can never show a verified badge. Wire this up once
            // feedService.js#CREATOR_SELECT joins `verified`.
            authorVerified: false,
            timeAndLocality: timeAndLocality,
            intent: intent,
            media: media,
            reactions: reactions,
            comments: rows,
            hiddenReplyCount: hidden
        )
    }

    private func mapAccountType(_ accountType: String?) -> IdentityPillar {
        switch accountType {
        case "business": .business
        case "home": .home
        default: .personal
        }
    }

    private func buildCommentRows(_ comments: [PostCommentDTO]) -> (rows: [PostCommentRow], hidden: Int) {
        // Group by parent → flatten with indentLevel capped at 1.
        let topLevel = comments.filter { $0.parentCommentId == nil && !$0.isDeleted }
        let repliesByParent = Dictionary(
            grouping: comments.filter { $0.parentCommentId != nil && !$0.isDeleted }
        ) { $0.parentCommentId ?? "" }

        var rows: [PostCommentRow] = []
        var visibleReplyCount = 0
        var totalReplyCount = 0

        for parent in topLevel {
            rows.append(row(from: parent, indent: 0))
            let replies = (repliesByParent[parent.id] ?? [])
                .sorted { ($0.createdAt) < ($1.createdAt) }
            totalReplyCount += replies.count
            let cap = showingAllReplies ? replies.count : min(maxInitialReplies, replies.count)
            for reply in replies.prefix(cap) {
                rows.append(row(from: reply, indent: 1))
                visibleReplyCount += 1
            }
        }

        let hidden = showingAllReplies ? 0 : max(0, totalReplyCount - visibleReplyCount)
        return (rows, hidden)
    }

    private func row(from comment: PostCommentDTO, indent: Int) -> PostCommentRow {
        let name = comment.author?.displayName ?? "Pantopus user"
        let attachments = (comment.attachments ?? []).compactMap { URL(string: $0.fileURL) }
        return PostCommentRow(
            id: comment.id,
            authorName: name,
            authorAvatarURL: comment.author?.profilePictureURL.flatMap(URL.init(string:)),
            authorIdentity: mapAccountType(comment.author?.accountType),
            body: comment.comment,
            timestamp: relativeTimestamp(comment.createdAt),
            reactionCount: comment.likeCount ?? 0,
            userReacted: comment.userHasLiked ?? false,
            indentLevel: indent,
            authorUserId: comment.author?.id,
            attachmentURLs: attachments,
            isOwn: currentUserId != nil && comment.userId == currentUserId
        )
    }

    private func formatTimeAndLocality(createdAt: String, locality: String?) -> String {
        let ts = relativeTimestamp(createdAt)
        if let locality, !locality.isEmpty {
            return "\(ts) · \(locality)"
        }
        return ts
    }

    private func relativeTimestamp(_ iso: String) -> String {
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
        case .notFound: "We couldn't find this post."
        case .forbidden: "You don't have access to this post."
        case .transport: "Check your connection and try again."
        default: "Something went wrong. Try again."
        }
    }
}
