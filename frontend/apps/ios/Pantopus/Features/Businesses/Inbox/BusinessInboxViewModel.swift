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
    public private(set) var isLoadingMore = false
    public private(set) var isRefreshingRooms = false
    public private(set) var refreshFailure: String?
    public var canLoadMore: Bool {
        roomsResponse?.hasMore == true && roomsResponse?.nextCursor != nil
    }

    private let businessId: String
    private let client: APIClient
    private let accountSession: Int
    private let logger = Logger(label: "app.pantopus.ios.BusinessInbox")

    /// Per-section cache so flipping back doesn't re-blank the list.
    private var messagesState: BusinessInboxSectionState?
    private var mentionsState: BusinessInboxSectionState?
    private var roomsResponse: BusinessInboxRoomsResponse?
    private var roomsGeneration = 0
    private var pageRequest: UUID?
    private var mentionsGeneration = 0
    private var socketTasks: [Task<Void, Never>] = []
    private var refreshTask: Task<Void, Never>?
    private var needsRefresh = false

    public convenience init(businessId: String) {
        self.init(businessId: businessId, client: .shared)
    }

    /// Designated initializer — internal because `APIClient` is
    /// module-internal.
    init(businessId: String, client: APIClient) {
        self.businessId = businessId
        self.client = client
        accountSession = AuthManager.shared.requestSessionGeneration
    }

    public func load() async {
        subscribeToChanges()
        await fetch(section)
    }

    public func refresh() async {
        await fetch(section)
    }

    public func select(_ next: BusinessInboxSection) async {
        guard section != next else { return }
        section = next
        if let cached = cached(for: next) { state = cached }
        await fetch(next)
    }

    // MARK: - Fetch

    private func fetch(_ target: BusinessInboxSection) async {
        if cached(for: target) == nil { state = .loading }
        switch target {
        case .messages: await fetchRooms()
        case .mentions: await fetchMentions()
        }
    }

    private func fetchRooms() async {
        guard client !== APIClient.shared || accountSession == AuthManager.shared.requestSessionGeneration else { return }
        guard !isRefreshingRooms else { needsRefresh = true
            return
        }
        roomsGeneration += 1
        let generation = roomsGeneration
        let session = AuthManager.shared.requestSessionGeneration
        let minimumCount = roomsResponse?.rooms.count ?? 0
        isRefreshingRooms = true
        defer { if generation == roomsGeneration { isRefreshingRooms = false } }
        do {
            var response: BusinessInboxRoomsResponse = try await client.request(BusinessInboxEndpoints.rooms(businessId: businessId))
            guard response.hasMore != true || response.nextCursor != nil else { throw APIError.invalidResponse }
            var cursors: Set<String> = []
            while response.rooms.count < minimumCount, response.hasMore == true {
                guard current(generation, session: session), let cursor = response.nextCursor,
                      cursors.insert(cursor).inserted else { throw APIError.invalidResponse }
                let page: BusinessInboxRoomsResponse = try await client.request(
                    BusinessInboxEndpoints.rooms(businessId: businessId, before: cursor)
                )
                response = try Self.appending(page, to: response, after: cursor)
            }
            guard current(generation, session: session) else { return }
            applyRooms(response)
        } catch {
            guard current(generation, session: session) else { return }
            handleRoomsFailure(error, fallback: "Couldn't refresh messages. Try again.")
        }
    }

    public func loadMore() async {
        guard client !== APIClient.shared || accountSession == AuthManager.shared.requestSessionGeneration else { return }
        guard !isRefreshingRooms, !isLoadingMore, let current = roomsResponse,
              current.hasMore == true, let cursor = current.nextCursor else { return }
        let generation = roomsGeneration
        let session = AuthManager.shared.requestSessionGeneration
        let request = UUID()
        pageRequest = request
        isLoadingMore = true
        defer {
            if pageRequest == request {
                pageRequest = nil
                isLoadingMore = false
            }
        }
        do {
            let page: BusinessInboxRoomsResponse = try await client.request(
                BusinessInboxEndpoints.rooms(businessId: businessId, before: cursor)
            )
            guard self.current(generation, session: session) else { return }
            try applyRooms(Self.appending(page, to: current, after: cursor))
        } catch {
            guard self.current(generation, session: session) else { return }
            handleRoomsFailure(error, fallback: "Couldn't load more messages. Try again.")
        }
    }

    private func current(_ generation: Int, session: Int) -> Bool {
        generation == roomsGeneration && session == AuthManager.shared.requestSessionGeneration && !Task.isCancelled
            && (client !== APIClient.shared || session == accountSession)
    }

    private func applyRooms(_ response: BusinessInboxRoomsResponse) {
        roomsResponse = response
        totalUnread = response.totalUnread ?? 0
        refreshFailure = nil
        let rows = response.rooms.map(Self.project(room:))
        apply(rows.isEmpty ? .empty : .loadedRooms(rows), for: .messages)
    }

    private func handleRoomsFailure(_ error: any Error, fallback: String) {
        if ScreenStore.isRefusal(error) {
            roomsResponse = nil
            totalUnread = 0
            refreshFailure = nil
            apply(.error(message: Self.message(for: error, fallback: "Couldn't load messages.")), for: .messages)
        } else if roomsResponse != nil {
            refreshFailure = fallback
        } else {
            apply(.error(message: Self.message(for: error, fallback: "Couldn't load messages.")), for: .messages)
        }
    }

    private static func appending(
        _ page: BusinessInboxRoomsResponse, to current: BusinessInboxRoomsResponse, after cursor: String
    ) throws -> BusinessInboxRoomsResponse {
        guard page.hasMore != true || (page.nextCursor != nil && page.nextCursor != cursor) else { throw APIError.invalidResponse }
        var seen = Set(current.rooms.map(\.id))
        return BusinessInboxRoomsResponse(
            rooms: current.rooms + page.rooms.filter { seen.insert($0.id).inserted },
            total: page.total,
            totalUnread: page.totalUnread,
            hasMore: page.hasMore,
            nextCursor: page.nextCursor
        )
    }

    public func teardown() {
        roomsGeneration += 1
        mentionsGeneration += 1
        isRefreshingRooms = false
        isLoadingMore = false
        pageRequest = nil
        socketTasks.forEach { $0.cancel() }
        socketTasks.removeAll()
        refreshTask?.cancel()
        refreshTask = nil
        needsRefresh = false
    }

    private func subscribeToChanges() {
        guard socketTasks.isEmpty, client === APIClient.shared else { return }
        for event in ["message:new", "message:edited", "message:deleted", "messages:read"] {
            socketTasks.append(Task { [weak self] in
                for await _ in SocketClient.shared.events(named: event, as: JSONValue.self) {
                    guard let self, !Task.isCancelled else { return }
                    requestRefresh()
                }
            })
        }
    }

    /// Generic chat invalidation includes off-head business rooms and revoked
    /// membership, delivered through the existing account screen-store signal.
    public func invalidateMessages() {
        requestRefresh()
    }

    private func requestRefresh() {
        needsRefresh = true
        guard refreshTask == nil else { return }
        refreshTask = Task { [weak self] in
            guard let self else { return }
            repeat {
                needsRefresh = false
                do { try await Task.sleep(nanoseconds: 350_000_000) } catch { return }
                await fetchRooms()
            } while needsRefresh && !Task.isCancelled
            refreshTask = nil
        }
    }

    private func fetchMentions() async {
        guard client !== APIClient.shared || accountSession == AuthManager.shared.requestSessionGeneration else { return }
        mentionsGeneration += 1
        let generation = mentionsGeneration
        let session = AuthManager.shared.requestSessionGeneration
        do {
            let response: BusinessMatchedPostsResponse = try await client.request(
                BusinessInboxEndpoints.matchedPosts(businessId: businessId)
            )
            guard generation == mentionsGeneration, session == AuthManager.shared.requestSessionGeneration,
                  !Task.isCancelled else { return }
            let mentions = response.posts.map(Self.project(post:))
            let next: BusinessInboxSectionState = mentions.isEmpty ? .empty : .loadedMentions(mentions)
            apply(next, for: .mentions)
        } catch {
            guard generation == mentionsGeneration, session == AuthManager.shared.requestSessionGeneration,
                  !Task.isCancelled else { return }
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
        // A made-up username (user_…) is never shown.
        let handle = MadeUpUsername.chosen(room.otherParticipantUsername) ?? ""
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
                ?? MadeUpUsername.chosen(post.creator?.username)
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
