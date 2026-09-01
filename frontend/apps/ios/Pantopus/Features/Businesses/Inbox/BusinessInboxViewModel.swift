//
//  BusinessInboxViewModel.swift
//  Pantopus
//
//  Drives the business-side inbox. Mirrors RN's `InboxTab` load flow: the
//  active section fetches on selection, each section keeps its own state,
//  and the unread badge comes from the chat route's `totalUnread`.
//

import Foundation
import Logging
import Observation

@MainActor
@Observable
public final class BusinessInboxViewModel {
    /// Currently selected section. Selecting re-fetches only that half.
    public private(set) var section: BusinessInboxSection = .messages
    public private(set) var state: BusinessInboxSectionState = .loading
    /// `totalUnread` from the chat route — renders in the header title.
    public private(set) var totalUnread: Int = 0

    private let businessId: String
    private let client: APIClient
    private let logger = Logger(label: "app.pantopus.ios.BusinessInbox")

    /// Per-section cache so flipping back doesn't re-blank the list.
    private var messagesState: BusinessInboxSectionState?
    private var mentionsState: BusinessInboxSectionState?

    public convenience init(businessId: String) {
        self.init(businessId: businessId, client: .shared)
    }

    /// Designated initializer — internal because `APIClient` is
    /// module-internal.
    init(businessId: String, client: APIClient) {
        self.businessId = businessId
        self.client = client
    }

    public func load() async {
        await fetch(section)
    }

    public func refresh() async {
        cache(nil, for: section)
        await fetch(section)
    }

    public func select(_ next: BusinessInboxSection) async {
        guard section != next else { return }
        section = next
        if let cached = cached(for: next) {
            state = cached
            return
        }
        await fetch(next)
    }

    // MARK: - Fetch

    private func fetch(_ target: BusinessInboxSection) async {
        state = .loading
        switch target {
        case .messages: await fetchRooms()
        case .mentions: await fetchMentions()
        }
    }

    private func fetchRooms() async {
        do {
            let response: BusinessInboxRoomsResponse = try await client.request(
                BusinessInboxEndpoints.rooms(businessId: businessId)
            )
            totalUnread = response.totalUnread ?? 0
            let rooms = response.rooms.map(Self.project(room:))
            let next: BusinessInboxSectionState = rooms.isEmpty ? .empty : .loadedRooms(rooms)
            apply(next, for: .messages)
        } catch {
            logger.warning("Business inbox rooms failed: \(error)")
            apply(.error(message: Self.message(for: error, fallback: "Couldn't load messages.")), for: .messages)
        }
    }

    private func fetchMentions() async {
        do {
            let response: BusinessMatchedPostsResponse = try await client.request(
                BusinessInboxEndpoints.matchedPosts(businessId: businessId)
            )
            let mentions = response.posts.map(Self.project(post:))
            let next: BusinessInboxSectionState = mentions.isEmpty ? .empty : .loadedMentions(mentions)
            apply(next, for: .mentions)
        } catch {
            logger.warning("Business inbox mentions failed: \(error)")
            apply(.error(message: Self.message(for: error, fallback: "Couldn't load mentions.")), for: .mentions)
        }
    }

    private func apply(_ next: BusinessInboxSectionState, for target: BusinessInboxSection) {
        cache(next, for: target)
        guard section == target else { return }
        state = next
    }

    private func cached(for target: BusinessInboxSection) -> BusinessInboxSectionState? {
        switch target {
        case .messages: messagesState
        case .mentions: mentionsState
        }
    }

    private func cache(_ value: BusinessInboxSectionState?, for target: BusinessInboxSection) {
        switch target {
        case .messages: messagesState = value
        case .mentions: mentionsState = value
        }
    }

    private static func message(for error: any Error, fallback: String) -> String {
        guard let apiError = error as? APIError else { return fallback }
        switch apiError {
        case .forbidden: return "You don't have access to this business inbox."
        case .transport: return "Check your connection and try again."
        default: return apiError.errorDescription ?? fallback
        }
    }

    // MARK: - Projection (pure; testable)

    static func project(room: BusinessInboxRoomDTO) -> BusinessInboxRoom {
        let handle = (room.otherParticipantUsername ?? "").trimmingCharacters(in: .whitespaces)
        let name = nonEmpty(room.otherParticipantName)
            ?? nonEmpty(room.roomName)
            ?? (handle.isEmpty ? "Conversation" : "@\(handle)")
        return BusinessInboxRoom(
            id: room.id,
            title: name,
            handle: handle,
            preview: room.lastMessagePreview ?? "",
            timeAgo: relativeTime(room.lastMessageAt),
            unreadCount: max(0, room.unreadCount ?? 0)
        )
    }

    static func project(post: BusinessMatchedPostDTO) -> BusinessInboxMention {
        let likes = post.likeCount ?? 0
        let comments = post.commentCount ?? 0
        var parts: [String] = []
        if likes > 0 { parts.append("\(likes) like\(likes == 1 ? "" : "s")") }
        if comments > 0 { parts.append("\(comments) comment\(comments == 1 ? "" : "s")") }
        return BusinessInboxMention(
            id: post.id,
            authorName: nonEmpty(post.creator?.name)
                ?? nonEmpty(post.creator?.username)
                ?? "Someone",
            avatarURL: post.creator?.profilePictureUrl.flatMap(URL.init(string:)),
            body: nonEmpty(post.title) ?? post.content ?? "",
            timeAgo: relativeTime(post.createdAt),
            engagement: parts.joined(separator: " · ")
        )
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    /// "2h ago" / "3d ago". Empty when the timestamp is missing or
    /// unparseable, so the row simply omits the meta.
    static func relativeTime(_ iso: String?) -> String {
        guard let iso, !iso.isEmpty else { return "" }
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = withFraction.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return ""
        }
        let elapsed = Date().timeIntervalSince(date)
        switch elapsed {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(elapsed / 60))m ago"
        case ..<86400: return "\(Int(elapsed / 3600))h ago"
        case ..<604_800: return "\(Int(elapsed / 86400))d ago"
        default: return "\(Int(elapsed / 604_800))w ago"
        }
    }
}
