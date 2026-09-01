//
//  ChatConversationViewModel.swift
//  Pantopus
//
//  Backs the chat conversation screen (T2.2). Loads either the
//  room-message or person-conversation endpoint depending on the
//  route mode, projects rows into bubbles + day dividers + tail
//  groupings, dispatches optimistic sends with client-id → server-id
//  swap, debounces markRead, and reacts to socket events.
//

// swiftlint:disable file_length type_body_length

import Foundation
import Logging
import Observation

// swiftlint:disable cyclomatic_complexity large_tuple

/// Source-of-truth identifier for the thread, mirroring backend dual
/// mode. `.room` hits `/rooms/:id/messages`; `.person` hits
/// `/conversations/:otherUserId/messages`. `.ai` is a synthetic mode
/// for the "Ask Pantopus" thread (no backend wiring today — SSE
/// streaming via `/api/ai/chat` lands later).
public enum ChatThreadMode: Sendable, Hashable {
    case room(id: String)
    case person(otherUserId: String)
    case ai
}

public struct ChatInitialTopic: Sendable, Hashable {
    public let topicType: String
    public let topicRefId: String?
    public let title: String

    public init(topicType: String, topicRefId: String? = nil, title: String) {
        self.topicType = topicType
        self.topicRefId = topicRefId
        self.title = title
    }
}

public struct AIChatStreamRequest: Encodable, Sendable {
    public let message: String
    public let conversationId: String?
    public let images: [String]?

    public init(message: String, conversationId: String? = nil, images: [String]? = nil) {
        self.message = message
        self.conversationId = conversationId
        self.images = images
    }
}

public enum AIChatStreamEvent: Sendable, Equatable {
    case conversation(id: String)
    case textDelta(String)
    case draft(ChatAIDraftCard)
    case done
    case error(String)
}

protocol AIChatStreaming: Sendable {
    func streamChat(_ request: AIChatStreamRequest) -> AsyncThrowingStream<AIChatStreamEvent, any Error>
}

final class AIChatStreamClient: AIChatStreaming, @unchecked Sendable {
    static let shared = AIChatStreamClient()

    private let environment: AppEnvironment
    private let session: URLSession

    init(environment: AppEnvironment = .current, session: URLSession = .shared) {
        self.environment = environment
        self.session = session
    }

    func streamChat(_ request: AIChatStreamRequest) -> AsyncThrowingStream<AIChatStreamEvent, any Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let token = await AuthManager.shared.accessToken
                    let url = environment.apiBaseURL.appendingPathComponent("/api/ai/chat")
                    var urlRequest = URLRequest(url: url)
                    urlRequest.httpMethod = "POST"
                    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
                    urlRequest.setValue("text/event-stream", forHTTPHeaderField: "Accept")
                    if let token {
                        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                    }
                    urlRequest.httpBody = try JSONEncoder().encode(request)
                    let (bytes, response) = try await session.bytes(for: urlRequest)
                    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                        continuation.yield(.error("Failed to connect to AI."))
                        continuation.finish()
                        return
                    }
                    // AsyncLineSequence never yields the blank line that
                    // terminates an SSE event, so dispatch as soon as the
                    // event's data line arrives — the backend writes exactly
                    // one `data:` line per event (backend/routes/ai.js:136).
                    var eventName: String?
                    for try await line in bytes.lines {
                        if line.hasPrefix("event: ") {
                            eventName = String(line.dropFirst(7)).trimmingCharacters(in: .whitespacesAndNewlines)
                        } else if line.hasPrefix("data: "), let name = eventName {
                            Self.dispatch(eventName: name, data: String(line.dropFirst(6)), continuation: continuation)
                            eventName = nil
                        }
                    }
                    continuation.finish()
                } catch {
                    if Task.isCancelled {
                        continuation.finish()
                    } else {
                        continuation.finish(throwing: error)
                    }
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private static func dispatch(
        eventName: String,
        data: String,
        continuation: AsyncThrowingStream<AIChatStreamEvent, any Error>.Continuation
    ) {
        guard let object = try? JSONSerialization.jsonObject(with: Data(data.utf8)) as? [String: Any] else { return }
        switch eventName {
        case "conversation":
            if let id = object["conversationId"] as? String {
                continuation.yield(.conversation(id: id))
            }
        case "text_delta":
            if let delta = object["delta"] as? String {
                continuation.yield(.textDelta(delta))
            }
        case "draft":
            if let draft = Self.parseDraft(object) {
                continuation.yield(.draft(draft))
            }
        case "done":
            continuation.yield(.done)
        case "error":
            continuation.yield(.error((object["message"] as? String) ?? (object["error"] as? String) ?? "AI error."))
        default:
            break
        }
    }

    private static func parseDraft(_ object: [String: Any]) -> ChatAIDraftCard? {
        let type = (object["type"] as? String) ?? "draft"
        let valid = (object["valid"] as? Bool) ?? true
        let draft = object["draft"] as? [String: Any] ?? [:]
        let title = (draft["title"] as? String)
            ?? (draft["summary"] as? String)
            ?? (draft["content"] as? String)
            ?? "\(type.capitalized) draft"
        let summary = (draft["description"] as? String)
            ?? (draft["content"] as? String)
            ?? (draft["summary"] as? String)
        let price: String? = {
            if let price = draft["price"] { return "$\(price)" }
            if let amount = draft["amount"] { return "$\(amount)" }
            return nil
        }()
        return ChatAIDraftCard(
            id: "\(type)_\(UUID().uuidString)",
            type: type,
            title: title,
            summary: summary,
            priceLabel: price,
            valid: valid
        )
    }
}

/// Session-scoped memory of the Ask-Pantopus conversation id, keyed by
/// user, so closing and reopening the AI thread continues the same
/// backend conversation (`POST /api/ai/chat` accepts `conversationId`).
/// In-memory only — a fresh app launch starts a new conversation.
@MainActor
public final class AIConversationStore {
    public static let shared = AIConversationStore()

    private var conversationIdsByUserId: [String: String] = [:]

    public init() {}

    public func conversationId(forUserId userId: String) -> String? {
        conversationIdsByUserId[userId]
    }

    public func setConversationId(_ id: String, forUserId userId: String) {
        conversationIdsByUserId[userId] = id
    }
}

@Observable
@MainActor
public final class ChatConversationViewModel {
    /// Current render state.
    public private(set) var state: ChatConversationState = .loading

    /// Timeline row id (`bubble_<messageId>`) the view should scroll to.
    /// Set once when the screen is opened from Chat Search with a matched
    /// message that is present in the loaded page; the view clears it via
    /// `consumePendingScroll()` after scrolling.
    public private(set) var pendingScrollTargetId: String?

    /// True while the screen was opened from Chat Search and the matched
    /// message hasn't been scrolled to yet — the view skips its
    /// land-at-latest pass so the two don't fight over the position.
    public var hasPendingSearchTarget: Bool {
        scrollToMessageId != nil && !didResolveScrollTarget
    }

    /// Header counterparty data (drives the top-bar variant).
    public private(set) var counterparty: ChatCounterparty

    /// Live presence override for the person counterparty, driven by the
    /// `user:online` / `user:offline` socket events. `nil` until the
    /// first presence event arrives; the header falls back to the static
    /// flag the route carried.
    public private(set) var counterpartyOnline: Bool?

    /// Counterparty the header should render — the static value with the
    /// `online` flag replaced by the live presence override when one has
    /// arrived.
    public var headerCounterparty: ChatCounterparty {
        guard case let .person(name, initials, locality, verified, online) = counterparty else {
            return counterparty
        }
        return .person(
            name: name,
            initials: initials,
            locality: locality,
            verified: verified,
            online: counterpartyOnline ?? online
        )
    }

    /// A15 `.ctx-strip` — pinned gig context for gig-room threads.
    /// Loaded from `GET /api/gigs/:id` when the route carried a gig id;
    /// `nil` for non-gig threads or while the fetch is in flight.
    public private(set) var gigContext: ChatGigContextStrip?

    /// Live composer text. Bound by the view's `TextField`. Changes feed
    /// the throttled `typing:start` emitter (A15 typing indicator).
    public var composerText: String = "" {
        didSet {
            guard oldValue != composerText else { return }
            guard !isProgrammaticComposerWrite else { return }
            handleComposerTextChange()
        }
    }

    /// True while a send is in flight.
    public private(set) var isSending: Bool = false

    public private(set) var replyingTo: ChatReplyPreview?
    public private(set) var editingMessageId: String?
    public private(set) var topics: [ChatConversationTopic] = []
    public private(set) var selectedTopicId: String?

    /// User-facing notice set when the backend rejects a send with the
    /// gig pre-bid message cap (429 `PRE_BID_LIMIT`,
    /// `backend/routes/chats.js:1573`). Cleared on the next successful
    /// send or topic switch; the view renders it as a dismissible
    /// banner above the composer.
    public private(set) var sendLimitNotice: String?

    /// True while the block-user call is in flight.
    public private(set) var isBlocking = false

    /// True while `POST /api/users/:userId/report` is in flight.
    public private(set) var isReporting = false

    /// Set when typing indicator should render above the composer. Driven
    /// by `typing:user` / `typing:stopped` socket events scoped to this
    /// thread's rooms, with a 5s no-event auto-clear.
    public private(set) var isCounterpartyTyping: Bool = false

    /// True while an AI reply stream is in flight. The composer swaps its
    /// send disc for a stop button (A15.3) while this is set.
    public private(set) var isAIStreaming: Bool = false

    /// Local pre-send queue. Backend upload/send wiring is out of scope
    /// for this phase, but the UI can still render and remove queued
    /// attachments deterministically.
    public private(set) var queuedAttachments: [ChatQueuedAttachment] = []

    public private(set) var shareableGigs: [ChatShareGigOption] = []
    public private(set) var shareableListings: [ChatShareListingOption] = []
    public private(set) var isLoadingShareOptions = false
    public private(set) var shareOptionsError: String?
    public private(set) var isSharingLocation = false

    /// Capability chips for the AI welcome card (tap-to-send).
    public let aiPrompts: [ChatPromptChip]

    /// Quick-start chips for the empty state.
    public let emptyChips: [ChatPromptChip]

    /// Fan-side quota and tier state for persona DMs. `nil` for regular
    /// DMs and AI threads.
    public private(set) var fanEntitlement: ChatFanEntitlement?

    /// A15.3 capability chips shown in the AI welcome card. Tapping one
    /// sends its label as the thread's first message.
    public static let defaultAICapabilities: [ChatPromptChip] = [
        ChatPromptChip(id: "price", label: "Price a task", icon: .hammer),
        ChatPromptChip(id: "draft", label: "Draft a Pulse post", icon: .pencil),
        ChatPromptChip(id: "mail", label: "Summarize mail", icon: .mailbox),
        ChatPromptChip(id: "neighbor", label: "Find a neighbor", icon: .search)
    ]

    /// Quick-start chips for a human DM's empty state.
    public static let defaultEmptyChips: [ChatPromptChip] = [
        ChatPromptChip(id: "intro", label: "Introduce yourself", icon: .hand),
        ChatPromptChip(id: "gig", label: "Ask about the gig", icon: .briefcase),
        ChatPromptChip(id: "listing", label: "Share a listing", icon: .tag)
    ]

    /// Whether the composer's send disc is enabled (text present + not
    /// in flight). Bound by the view.
    public var canSend: Bool {
        (!composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !queuedAttachments.isEmpty) && !isSending
    }

    /// True when another older page can be fetched.
    public var canLoadOlder: Bool {
        hasMore && oldestCursor != nil
    }

    private let api: APIClient
    private let socket: SocketClient
    private let uploader: MultipartUploader
    private let aiClient: any AIChatStreaming
    private let aiConversationStore: AIConversationStore
    private let locationProvider: any LocationProviding
    private let mode: ChatThreadMode
    private let currentUserId: String
    private let initialTopic: ChatInitialTopic?
    /// Gig backing a `.room` thread (from the unified-conversations
    /// row's `gig_id`). Drives the pinned context strip. `nil` for
    /// non-gig rooms, person threads, and AI.
    private let gigId: String?
    /// Registry consulted by `AppDelegate.willPresent` to suppress chat
    /// push banners for the thread the user is already viewing.
    private let activeThreadTracker: ActiveChatThreadTracker
    /// Message to scroll to on first load (Chat Search deep-link). `nil`
    /// for normal opens, which land on the latest message.
    private let scrollToMessageId: String?
    private var didResolveScrollTarget = false
    private let logger = Logger(label: "app.pantopus.ios.ChatConversation")

    private var messages: [ChatMessageDTO] = []
    private var pendingByClientId: [String: ChatMessageDTO] = [:]
    private var failedClientIds: Set<String> = []
    private var activeRoomIds: Set<String> = []
    private var joinedRoomIds: Set<String> = []
    private var hasMore: Bool = false
    private var oldestCursor: String?
    private var markReadTask: Task<Void, Never>?
    private var socketTasks: [Task<Void, Never>] = []
    /// Socket-down fallback: polls `refresh()` every 30s while the
    /// connection is not `.connected`, so the loaded thread keeps
    /// receiving replies. Cancelled on reconnect and teardown. Never
    /// runs for the AI thread (its messages are local-only).
    private var fallbackPollTask: Task<Void, Never>?
    /// Auto-clears `isCounterpartyTyping` ~5s after the last typing event.
    private var typingClearTask: Task<Void, Never>?
    /// Last `typing:start` emit — throttles outgoing typing signals to
    /// one per ≥6s, bounding sustained typing at 10 emits/min (the
    /// backend silently drops `typing:start` past 10/min,
    /// `backend/socket/chatSocketio.js:23`). Agreed cross-platform
    /// value: 6 000 ms on both clients.
    private var lastTypingEmitAt: Date?
    /// Whether we owe the room a `typing:stop` (a start was emitted).
    private var didEmitTypingStart = false
    /// True while `composerText` is being seeded programmatically
    /// (edit seeding, edit-failure restore, capability-chip taps).
    /// Suppresses the typing emitter so only real keystrokes broadcast
    /// `typing:start` to the room.
    private var isProgrammaticComposerWrite = false
    /// In-flight AI reply stream, held so the composer's stop button can
    /// cancel it mid-generation.
    private var aiStreamTask: Task<Void, Never>?
    private var aiConversationId: String?
    private var aiDraftsByMessageId: [String: [ChatAIDraftCard]] = [:]
    /// Person-mode direct room — resolved once via `POST /api/chat/direct`
    /// (find-or-create, idempotent server-side) and cached for the VM's
    /// lifetime. Person threads must always send here, never to a shared
    /// gig/group room surfaced by the aggregated fetch.
    private var directRoomId: String?
    /// In-flight direct-room resolution, shared so concurrent sends make
    /// a single `POST /api/chat/direct`.
    private var directRoomTask: Task<String, any Error>?
    /// Send inputs captured per optimistic row, keyed by its bare-UUID
    /// `clientMessageId`. Survives refetches so retry resends the same
    /// payload under the same idempotency key.
    private var sendContextsByClientId: [String: PendingSendContext] = [:]

    /// Inputs needed to (re)send one optimistic message. Captured at
    /// send time so retry doesn't re-read mutated composer state.
    private struct PendingSendContext {
        let text: String
        /// Uploaded attachment ids — set after the first successful
        /// upload so a retry after a failed POST doesn't re-upload.
        var fileIds: [String]?
        let replyToId: String?
        let topicId: String?
        /// Explicit type for rich sends (`gig_offer`, `location`, …).
        /// `nil` for composer sends, which infer `text` / `file` and are
        /// the only sends that carry the queued composer attachments.
        let messageType: String?
        let metadata: [String: JSONValue]?
    }

    private enum ChatSendError: Error {
        case noRoom
    }

    init(
        mode: ChatThreadMode,
        counterparty: ChatCounterparty,
        currentUserId: String,
        scrollToMessageId: String? = nil,
        initialTopic: ChatInitialTopic? = nil,
        gigId: String? = nil,
        api: APIClient = .shared,
        socket: SocketClient = .shared,
        uploader: MultipartUploader = .shared,
        aiClient: any AIChatStreaming = AIChatStreamClient.shared,
        aiConversationStore: AIConversationStore = .shared,
        locationProvider: any LocationProviding = DeviceLocationProvider.shared,
        activeThreadTracker: ActiveChatThreadTracker = .shared
    ) {
        self.mode = mode
        self.counterparty = counterparty
        self.currentUserId = currentUserId
        self.initialTopic = initialTopic
        self.scrollToMessageId = scrollToMessageId
        self.gigId = gigId
        self.api = api
        self.socket = socket
        self.uploader = uploader
        self.aiClient = aiClient
        self.aiConversationStore = aiConversationStore
        self.locationProvider = locationProvider
        self.activeThreadTracker = activeThreadTracker
        aiPrompts = Self.defaultAICapabilities
        emptyChips = Self.defaultEmptyChips
        // Continue the user's existing AI conversation across thread
        // opens within this app session.
        if case .ai = mode {
            aiConversationId = aiConversationStore.conversationId(forUserId: currentUserId)
        }
    }

    /// Preview/snapshot seam — seeds a fixed render state with no network
    /// fetch or socket subscriptions. Not used in production navigation;
    /// `load()` early-returns on a seeded `.loaded` state so the fixture
    /// survives `.task`.
    init(
        previewState: ChatConversationState,
        counterparty: ChatCounterparty,
        fanEntitlement: ChatFanEntitlement? = nil,
        composerText: String = "",
        isCounterpartyTyping: Bool = false,
        queuedAttachments: [ChatQueuedAttachment] = []
    ) {
        mode = .ai
        self.counterparty = counterparty
        currentUserId = "preview_me"
        scrollToMessageId = nil
        initialTopic = nil
        gigId = nil
        api = .shared
        socket = .shared
        uploader = .shared
        aiClient = AIChatStreamClient.shared
        aiConversationStore = .shared
        locationProvider = DeviceLocationProvider.shared
        activeThreadTracker = .shared
        aiPrompts = Self.defaultAICapabilities
        emptyChips = Self.defaultEmptyChips
        self.fanEntitlement = fanEntitlement
        state = previewState
        self.composerText = composerText
        self.isCounterpartyTyping = isCounterpartyTyping
        self.queuedAttachments = queuedAttachments
    }

    // No `deinit { cancel }` — Swift 6's strict concurrency disallows
    // touching `@MainActor`-isolated stored properties from the
    // nonisolated `deinit`. The view calls `teardown()` from
    // `.onDisappear`, and each task captures `[weak self]` so it
    // exits cleanly once the VM is deallocated.

    // MARK: - Public API

    public func load() async {
        if case .loaded = state { return }
        await restoreAIConversationIfNeeded()
        await loadTopicsIfNeeded()
        await fetch(.reload)
        subscribeToSockets()
        prefetchDirectRoomIfNeeded()
        loadGigContextIfNeeded()
    }

    /// Restore the most recent Ask-Pantopus conversation across app
    /// relaunches: `GET /api/ai/conversations` returns summaries ordered
    /// newest-updated first, and `POST /api/ai/chat` resumes server-side
    /// state when handed that conversation id. No-op when the session
    /// store already holds an id (same-session reopen).
    ///
    /// TODO: render restored history — the backend exposes only the
    /// conversation LIST (`backend/routes/ai.js:358`); there is no
    /// per-conversation messages endpoint (no AI message rows exist —
    /// history lives in the provider's `previous_response_id` state,
    /// `backend/services/ai/agentService.js:68`). When a messages route
    /// lands, seed `messages` here via `localMessage(...)` with user vs
    /// assistant rows by role.
    private func restoreAIConversationIfNeeded() async {
        guard case .ai = mode, aiConversationId == nil else { return }
        do {
            let response: AIConversationsResponse = try await api.request(AIEndpoints.conversations())
            guard let latest = response.conversations.first else { return }
            aiConversationId = latest.id
            aiConversationStore.setConversationId(latest.id, forUserId: currentUserId)
        } catch {
            // Non-fatal — the thread simply starts a fresh conversation.
            logger.warning("AI conversation restore failed: \(error)")
        }
    }

    /// Fetch the gig backing a `.room` thread and publish the pinned
    /// context strip (A15 `.ctx-strip`). Fire-and-forget — the thread
    /// renders fine without it.
    private func loadGigContextIfNeeded() {
        guard case .room = mode, let gigId, !gigId.isEmpty, gigContext == nil else { return }
        Task { [weak self] in
            guard let self else { return }
            do {
                let response: GigDetailResponse = try await api.request(GigsEndpoints.detail(id: gigId))
                let gig = response.gig
                let price = gig.price.map { "$\(Int($0.rounded()))" }
                let meta = [gig.category?.capitalized, gig.status?.capitalized]
                    .compactMap { $0 }
                    .joined(separator: " · ")
                gigContext = ChatGigContextStrip(
                    gigId: gigId,
                    title: price.map { "\(gig.title) · \($0)" } ?? gig.title,
                    meta: meta.isEmpty ? nil : meta
                )
            } catch {
                logger.warning("gig context load failed: \(error)")
            }
        }
    }

    /// Resolve the person thread's direct room in the background so the
    /// first send doesn't pay the find-or-create round trip. Only runs
    /// when history exists — opening an empty thread must not create
    /// rooms for conversations that never start.
    private func prefetchDirectRoomIfNeeded() {
        guard case .person = mode, directRoomId == nil, !messages.isEmpty else { return }
        Task { [weak self] in
            _ = try? await self?.ensureRoomId()
        }
    }

    public func refresh() async {
        await loadTopicsIfNeeded()
        // Merge, don't reload: refresh() fires on every socket echo, the
        // offline poll, and pull-to-refresh. A reload would tear the
        // thread down to the shimmer, wipe any older pages the user had
        // scrolled to, and reset the scroll position on each of those.
        // Reload only out of an error state, where nothing is on screen.
        if case .error = state {
            await fetch(.reload)
        } else {
            await fetch(.merge)
        }
    }

    public func selectTopic(_ topicId: String?) async {
        selectedTopicId = selectedTopicId == topicId ? nil : topicId
        sendLimitNotice = nil
        await fetch(.reload)
    }

    /// Dismiss the pre-bid send-limit banner.
    public func dismissSendLimitNotice() {
        sendLimitNotice = nil
    }

    /// Scroll-to-top trigger — fetch the next older page.
    public func loadOlder() async {
        guard hasMore, let cursor = oldestCursor else { return }
        await fetch(.older(cursor: cursor))
    }

    /// Send the current composer text. Optimistic — prepends a row
    /// with a client-side id; on success swaps to the server id, on
    /// failure marks the row as failed for the view's retry CTA.
    public func send() async {
        let hasQueuedFiles = queuedAttachments.contains { $0.data != nil }
        guard canSend || hasQueuedFiles else { return }
        let trimmed = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        composerText = ""
        isSending = true
        defer { isSending = false }

        if let editingMessageId {
            do {
                let response: SendChatMessageResponse = try await api.request(
                    ChatEndpoints.editMessage(
                        id: editingMessageId,
                        body: EditChatMessageBody(messageText: trimmed)
                    )
                )
                applyUpdatedMessage(response.message)
                cancelMessageAction()
            } catch {
                setComposerTextSilently(trimmed)
                logger.warning("chat edit failed: \(error)")
            }
            return
        }

        // AI thread: no backend wired in T2.2; surface a placeholder
        // optimistic row so the design's "Ask anything…" composer
        // still feels alive.
        if case .ai = mode {
            await sendAIMessage(trimmed)
            return
        }

        let clientId = Self.newClientMessageId()
        let pending = optimisticMessage(
            text: trimmed.isEmpty ? "Attachment" : trimmed,
            clientId: clientId,
            roomId: knownRoomIdHint()
        )
        pendingByClientId[clientId] = pending
        sendContextsByClientId[clientId] = PendingSendContext(
            text: trimmed,
            fileIds: nil,
            replyToId: replyingTo?.messageId,
            topicId: selectedTopicId,
            messageType: nil,
            metadata: nil
        )
        rebuild()
        await performSend(clientId: clientId)
    }

    /// Retry a failed optimistic send. Accepts the timeline row id
    /// (`client_<uuid>`) or the bare client id, and resends with the
    /// same `clientMessageId` — the backend dedups on it, so a retry
    /// after a lost response can't double-post.
    public func retry(clientId rawId: String) async {
        guard !isSending else { return }
        let clientId = Self.bareClientId(rawId)
        guard pendingByClientId[clientId] != nil, sendContextsByClientId[clientId] != nil else { return }
        failedClientIds.remove(clientId)
        isSending = true
        defer { isSending = false }
        rebuild()
        await performSend(clientId: clientId)
    }

    /// Shared send/retry tail. Resolves the destination room (creating
    /// the direct room on a person thread's first message), uploads the
    /// composer's queued attachments at most once, and POSTs under the
    /// pending row's idempotency key.
    @discardableResult
    private func performSend(clientId: String) async -> Bool {
        guard var context = sendContextsByClientId[clientId] else { return false }
        do {
            let roomId = try await ensureRoomId()
            if context.messageType == nil, context.fileIds == nil {
                context.fileIds = try await uploadQueuedAttachmentsIfNeeded(roomId: roomId)
                sendContextsByClientId[clientId] = context
            }
            let fileIds = context.fileIds ?? []
            let response: SendChatMessageResponse = try await api.request(
                ChatEndpoints.sendMessage(
                    body: SendChatMessageBody(
                        roomId: roomId,
                        messageText: context.text.isEmpty ? nil : context.text,
                        messageType: context.messageType ?? (fileIds.isEmpty ? "text" : "file"),
                        fileIds: fileIds.isEmpty ? nil : fileIds,
                        clientMessageId: clientId,
                        replyToId: sanitizedReplyToId(context.replyToId, roomId: roomId),
                        topicId: context.topicId,
                        metadata: context.metadata
                    )
                )
            )
            // Swap optimistic → server message. The socket echo may have
            // landed it via a refetch already, so replace-by-id.
            pendingByClientId[clientId] = nil
            sendContextsByClientId[clientId] = nil
            failedClientIds.remove(clientId)
            upsert(response.message)
            replyingTo = nil
            sendLimitNotice = nil
            if context.messageType == nil {
                queuedAttachments = []
            }
            rebuild()
            scheduleMarkRead(for: roomId)
            return true
        } catch {
            if Self.isPreBidLimit(error) {
                sendLimitNotice = "Message limit reached — place a bid or wait for acceptance to keep chatting."
            }
            // Don't resurrect a row that a concurrent socket echo already
            // confirmed and retired (lost-response race — the server
            // broadcasts `message:new` before the POST's HTTP response).
            guard sendContextsByClientId[clientId] != nil else {
                logger.warning("chat send failed but row already confirmed: \(error)")
                return false
            }
            failedClientIds.insert(clientId)
            logger.warning("chat send failed: \(error)")
            rebuild()
            return false
        }
    }

    /// Whether an error is the gig room's pre-bid message cap — a 429
    /// whose body carries `code: "PRE_BID_LIMIT"`
    /// (`backend/routes/chats.js:1573`). The HTTP client surfaces 4xx
    /// bodies as the raw string on `APIError.clientError`, so we match
    /// the marker rather than re-decoding.
    private static func isPreBidLimit(_ error: any Error) -> Bool {
        guard case let APIError.clientError(status, message) = error else { return false }
        return status == 429 && (message?.contains("PRE_BID_LIMIT") ?? false)
    }

    /// Insert a persisted message, replacing any copy that already
    /// arrived through a socket-triggered refetch.
    private func upsert(_ message: ChatMessageDTO) {
        if let index = messages.firstIndex(where: { $0.id == message.id }) {
            messages[index] = message
        } else {
            messages.append(message)
        }
    }

    /// Bare lowercase UUID — the send validator is `Joi.string().uuid()`
    /// (`backend/routes/chats.js:159`), so a prefixed id fails the whole
    /// request with a 400. The `client_` prefix lives only on the local
    /// optimistic row id.
    private static func newClientMessageId() -> String {
        UUID().uuidString.lowercased()
    }

    private static func bareClientId(_ rawId: String) -> String {
        rawId.hasPrefix("client_") ? String(rawId.dropFirst("client_".count)) : rawId
    }

    /// The wire `replyToId` is accepted only when it points at a
    /// persisted message that lives in the room we're actually sending
    /// to. The backend rejects the whole send (400) if the reply target
    /// is missing, soft-deleted, or in a different room
    /// (`backend/routes/chats.js:1654`). Two cases this guards:
    /// - person threads aggregate messages across every shared room
    ///   (direct + gig + group), but we always send to the direct room —
    ///   a reply to a gig/group bubble would 400;
    /// - an optimistic (`client_`-prefixed) row isn't a UUID and isn't
    ///   persisted yet.
    /// In either case we drop the linkage and still deliver the text,
    /// rather than failing the message permanently.
    private func sanitizedReplyToId(_ replyToId: String?, roomId: String) -> String? {
        guard let replyToId else { return nil }
        return messages.first { $0.id == replyToId && $0.roomId == roomId }?.id
    }

    private func sendAIMessage(_ text: String) async {
        let imageURLs = await (try? uploadQueuedAIImagesIfNeeded()) ?? []
        let userMessage = localMessage(
            id: "ai_user_\(UUID().uuidString)",
            text: text,
            userId: currentUserId,
            type: "text",
            imageURLs: imageURLs
        )
        let assistantId = "ai_assistant_\(UUID().uuidString)"
        let assistantMessage = localMessage(id: assistantId, text: "", userId: "ai", type: "ai_reply")
        messages.append(userMessage)
        messages.append(assistantMessage)
        queuedAttachments = []
        rebuild()

        let request = AIChatStreamRequest(
            message: text.isEmpty ? "What can you tell me about this image?" : text,
            conversationId: aiConversationId,
            images: imageURLs.isEmpty ? nil : imageURLs
        )
        // The stream is consumed in a stored Task so the composer's stop
        // button (A15.3) can cancel it mid-generation via
        // `cancelAIStream()`; partial text already rendered is kept.
        isAIStreaming = true
        let task = Task { [weak self] in
            var streamedText = ""
            guard let client = self?.aiClient else { return }
            do {
                for try await event in client.streamChat(request) {
                    guard let self else { return }
                    switch event {
                    case let .conversation(id):
                        aiConversationId = id
                        aiConversationStore.setConversationId(id, forUserId: currentUserId)
                    case let .textDelta(delta):
                        streamedText += delta
                        replaceLocalMessage(id: assistantId, text: streamedText, type: "ai_reply", userId: "ai")
                    case let .draft(draft):
                        aiDraftsByMessageId[assistantId, default: []].append(draft)
                        rebuild()
                    case let .error(message):
                        replaceLocalMessage(id: assistantId, text: message, type: "ai_reply", userId: "ai")
                    case .done:
                        break
                    }
                }
            } catch {
                if !Task.isCancelled {
                    self?.replaceLocalMessage(
                        id: assistantId,
                        text: "I lost the connection. Please try again.",
                        type: "ai_reply",
                        userId: "ai"
                    )
                }
            }
            if Task.isCancelled {
                self?.finalizeCancelledAIStream(assistantId: assistantId, partialText: streamedText)
            }
        }
        aiStreamTask = task
        await task.value
        aiStreamTask = nil
        isAIStreaming = false
    }

    /// A15.3 stop button — cancel the in-flight AI reply stream. Text
    /// that already streamed in stays as the final reply; an empty
    /// placeholder bubble is dropped.
    public func cancelAIStream() {
        aiStreamTask?.cancel()
    }

    private func finalizeCancelledAIStream(assistantId: String, partialText: String) {
        if partialText.isEmpty {
            messages.removeAll { $0.id == assistantId }
            rebuild()
        } else {
            replaceLocalMessage(id: assistantId, text: partialText, type: "ai_reply", userId: "ai")
        }
    }

    /// Toggle a reaction on a message.
    public func react(messageId: String, reaction: String) async {
        do {
            let response: ReactToChatMessageResponse = try await api.request(
                ChatEndpoints.reactToMessage(id: messageId, reaction: reaction),
                as: ReactToChatMessageResponse.self
            )
            if let reactions = response.reactions {
                applyReactions(reactions, to: messageId)
            }
        } catch {
            logger.warning("chat react failed: \(error)")
        }
    }

    public func beginReply(to messageId: String) {
        guard let message = combinedMessages().first(where: { $0.id == messageId }) else { return }
        replyingTo = ChatReplyPreview(
            messageId: message.id,
            senderName: message.sender?.name ?? (message.userId == currentUserId ? "You" : "Message"),
            text: message.messageText ?? ""
        )
        editingMessageId = nil
    }

    public func beginEdit(messageId: String) {
        guard let message = messages.first(where: { $0.id == messageId }),
              message.userId == currentUserId,
              let text = message.messageText else { return }
        editingMessageId = messageId
        replyingTo = nil
        setComposerTextSilently(text)
    }

    public func cancelMessageAction() {
        replyingTo = nil
        editingMessageId = nil
    }

    public func delete(messageId: String) async {
        guard messages.contains(where: { $0.id == messageId && $0.userId == currentUserId }) else { return }
        do {
            _ = try await api.request(ChatEndpoints.deleteMessage(id: messageId), as: EmptyResponse.self)
            messages.removeAll { $0.id == messageId }
            rebuild()
        } catch {
            logger.warning("chat delete failed: \(error)")
        }
    }

    /// Delete a batch of own messages by looping the single-message
    /// endpoint (`DELETE /api/chat/messages/:messageId` — no bulk route
    /// exists). Per-id failures are logged and skipped so one bad id
    /// doesn't strand the rest of the selection.
    public func bulkDelete(ids: [String]) async {
        for id in ids {
            await delete(messageId: id)
        }
    }

    /// Block the person counterparty — `POST /api/users/:userId/block`
    /// (route `backend/routes/blocks.js:13`, mounted at `/api/users`).
    /// Returns true on success so the details sheet can dismiss and the
    /// screen can pop back. No-ops for room/AI threads.
    public func blockCounterparty() async -> Bool {
        guard case let .person(otherUserId) = mode, !isBlocking else { return false }
        isBlocking = true
        defer { isBlocking = false }
        do {
            _ = try await api.request(BlocksEndpoints.block(userId: otherUserId), as: EmptyResponse.self)
            return true
        } catch {
            logger.warning("block user failed: \(error)")
            return false
        }
    }

    /// Report the person counterparty — `POST /api/users/:userId/report`
    /// (route `backend/routes/users.js:4153`, validator `:4137`).
    /// `reason` must be one of the backend's six reason codes; `details`
    /// is optional free text (≤ 1000 chars). Returns true on success so
    /// the details sheet can show its confirmation. No-ops for room/AI
    /// threads.
    public func reportCounterparty(reason: String, details: String?) async -> Bool {
        guard case let .person(otherUserId) = mode, !isReporting else { return false }
        isReporting = true
        defer { isReporting = false }
        do {
            _ = try await api.request(
                UsersEndpoints.report(userId: otherUserId, reason: reason, details: details),
                as: EmptyResponse.self
            )
            return true
        } catch {
            logger.warning("report user failed: \(error)")
            return false
        }
    }

    /// Mark every message in the thread as read for the current user.
    /// Debounced — repeated calls within 600 ms collapse to one.
    public func scheduleMarkRead() {
        markReadTask?.cancel()
        markReadTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 600_000_000)
            await self?.performMarkRead()
        }
    }

    public func teardown() {
        emitTypingStopIfNeeded()
        markReadTask?.cancel()
        typingClearTask?.cancel()
        aiStreamTask?.cancel()
        fallbackPollTask?.cancel()
        fallbackPollTask = nil
        socketTasks.forEach { $0.cancel() }
        socketTasks.removeAll()
        activeThreadTracker.clear(owner: ObjectIdentifier(self))
    }

    // MARK: - Typing (A15)

    /// Composer text changed — emit `typing:start` at most once per ≥6s
    /// while non-empty, and `typing:stop` when cleared. Emits only when
    /// a room id is already known (never creates rooms for typing).
    private func handleComposerTextChange() {
        if composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            emitTypingStopIfNeeded()
            return
        }
        guard let roomId = typingRoomId() else { return }
        let now = Date()
        if let last = lastTypingEmitAt, now.timeIntervalSince(last) < 6 { return }
        lastTypingEmitAt = now
        didEmitTypingStart = true
        socket.emit("typing:start", payload: ["roomId": roomId])
    }

    /// Write `composerText` without feeding the typing emitter — for
    /// programmatic seeds (beginEdit, edit-failure restore, capability
    /// chips), which must not broadcast "typing…" before the user has
    /// touched the keyboard, nor burn the backend's 10/min typing budget.
    private func setComposerTextSilently(_ text: String) {
        isProgrammaticComposerWrite = true
        composerText = text
        isProgrammaticComposerWrite = false
    }

    private func emitTypingStopIfNeeded() {
        guard didEmitTypingStart else { return }
        didEmitTypingStart = false
        lastTypingEmitAt = nil
        guard let roomId = typingRoomId() else { return }
        socket.emit("typing:stop", payload: ["roomId": roomId])
    }

    /// Room to scope typing signals to. `nil` when no room is resolved
    /// yet — a person thread before its direct room exists must not
    /// create one just to say "typing…".
    private func typingRoomId() -> String? {
        switch mode {
        case let .room(id): id
        case .person: directRoomId
        case .ai: nil
        }
    }

    /// Whether a typing event belongs to this thread's indicator. Room /
    /// group threads accept any non-self member of an active room. A
    /// person thread's `activeRoomIds` includes every shared room (gig /
    /// group rooms with extra members too), so it must additionally
    /// require the event to come from the counterparty — otherwise a
    /// third member typing in a shared group room would render as the
    /// counterparty typing in the 1:1 thread.
    private func isTypingEventForThisThread(_ event: ChatRealtimeTyping) -> Bool {
        guard activeRoomIds.contains(event.roomId), event.userId != currentUserId else { return false }
        if case let .person(otherUserId) = mode {
            return event.userId == otherUserId
        }
        return true
    }

    private func handleTypingStarted(_ event: ChatRealtimeTyping) {
        guard isTypingEventForThisThread(event) else { return }
        isCounterpartyTyping = true
        typingClearTask?.cancel()
        typingClearTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            guard !Task.isCancelled else { return }
            self?.isCounterpartyTyping = false
        }
    }

    private func handleTypingStopped(_ event: ChatRealtimeTyping) {
        guard isTypingEventForThisThread(event) else { return }
        typingClearTask?.cancel()
        isCounterpartyTyping = false
    }

    /// Tap a welcome-card capability chip — send its label as the
    /// thread's first message (transitions the AI thread out of the
    /// welcome/empty state).
    public func sendCapabilityPrompt(_ chip: ChatPromptChip) async {
        setComposerTextSilently(chip.label)
        await send()
    }

    public func queueSamplePhotoAttachment() {
        appendQueuedAttachment(ChatQueuedAttachment(id: "queued_photo", kind: .image, filename: "shelves.jpg", mimeType: "image/jpeg"))
    }

    public func queueSampleDocumentAttachment() {
        appendQueuedAttachment(ChatQueuedAttachment(id: "queued_pdf", kind: .document, filename: "shelf.pdf", mimeType: "application/pdf"))
    }

    public func queueSampleAttachments() {
        queueSamplePhotoAttachment()
        queueSampleDocumentAttachment()
    }

    public func removeQueuedAttachment(id: String) {
        queuedAttachments.removeAll { $0.id == id }
    }

    public func queueAttachment(kind: ChatQueuedAttachmentKind, filename: String, mimeType: String, data: Data) {
        appendQueuedAttachment(
            ChatQueuedAttachment(
                id: UUID().uuidString,
                kind: kind,
                filename: filename,
                mimeType: mimeType,
                data: data
            )
        )
    }

    public func loadShareableGigs() async {
        isLoadingShareOptions = true
        shareOptionsError = nil
        defer { isLoadingShareOptions = false }
        do {
            let response: MyGigsResponse = try await api.request(GigsEndpoints.myGigs())
            shareableGigs = response.gigs.map {
                ChatShareGigOption(
                    id: $0.id,
                    title: $0.title,
                    category: $0.category,
                    price: $0.price,
                    status: $0.status
                )
            }
        } catch {
            shareOptionsError = friendlyMessage(error)
            shareableGigs = []
        }
    }

    public func loadShareableListings() async {
        isLoadingShareOptions = true
        shareOptionsError = nil
        defer { isLoadingShareOptions = false }
        do {
            let response: MyListingsResponse = try await api.request(ListingsEndpoints.myListings(limit: 100))
            shareableListings = response.listings.compactMap { listing in
                guard let title = listing.title, !title.isEmpty else { return nil }
                let imageURL = listing.firstImage ?? listing.mediaUrls?.first
                return ChatShareListingOption(
                    id: listing.id,
                    title: title,
                    category: listing.category,
                    price: listing.price,
                    isFree: listing.isFree ?? false,
                    condition: listing.condition,
                    imageURL: imageURL
                )
            }
        } catch {
            shareOptionsError = friendlyMessage(error)
            shareableListings = []
        }
    }

    public func sendCurrentLocation() async {
        guard !isSharingLocation, !isSending else { return }
        isSharingLocation = true
        defer { isSharingLocation = false }
        guard let coordinate = await locationProvider.requestCurrent(timeoutSeconds: 4) else { return }
        var address = String(format: "%.2f, %.2f", coordinate.latitude, coordinate.longitude)
        do {
            let response: GeoReverseResponse = try await api.request(
                GeoEndpoints.reverse(latitude: coordinate.latitude, longitude: coordinate.longitude)
            )
            let locality = response.normalized.localityLabel
            if !locality.isEmpty { address = locality }
        } catch {
            // keep coordinate fallback
        }
        await sendRichMessage(
            messageText: address,
            messageType: "location",
            metadata: [
                "latitude": .number(coordinate.latitude),
                "longitude": .number(coordinate.longitude),
                "address": .string(address)
            ]
        )
    }

    public func sendGigOffer(_ gig: ChatShareGigOption) async {
        var metadata: [String: JSONValue] = [
            "gigId": .string(gig.id),
            "title": .string(gig.title)
        ]
        if let category = gig.category { metadata["category"] = .string(category) }
        if let price = gig.price { metadata["price"] = .number(price) }
        if let status = gig.status { metadata["status"] = .string(status) }
        await sendRichMessage(
            messageText: gig.title,
            messageType: "gig_offer",
            metadata: metadata,
            topicForPerson: ("task", gig.id, gig.title)
        )
    }

    public func sendListingOffer(_ listing: ChatShareListingOption) async {
        var metadata: [String: JSONValue] = [
            "listingId": .string(listing.id),
            "title": .string(listing.title),
            "isFree": .bool(listing.isFree)
        ]
        if let category = listing.category { metadata["category"] = .string(category) }
        if let price = listing.price { metadata["price"] = .number(price) }
        if let condition = listing.condition { metadata["condition"] = .string(condition) }
        if let imageURL = listing.imageURL { metadata["imageUrl"] = .string(imageURL) }
        await sendRichMessage(
            messageText: listing.title,
            messageType: "listing_offer",
            metadata: metadata,
            topicForPerson: ("listing", listing.id, listing.title)
        )
    }

    private func sendRichMessage(
        messageText: String,
        messageType: String,
        metadata: [String: JSONValue],
        topicForPerson: (type: String, refId: String, title: String)? = nil
    ) async {
        if case .ai = mode { return }
        guard !isSending else { return }
        isSending = true
        defer { isSending = false }

        let topicId = await resolveTopicIdForShare(topicForPerson)
        let clientId = Self.newClientMessageId()
        let pending = optimisticRichMessage(
            text: messageText,
            clientId: clientId,
            roomId: knownRoomIdHint(),
            messageType: messageType,
            metadata: metadata
        )
        pendingByClientId[clientId] = pending
        sendContextsByClientId[clientId] = PendingSendContext(
            text: messageText,
            fileIds: nil,
            replyToId: replyingTo?.messageId,
            topicId: topicId,
            messageType: messageType,
            metadata: metadata
        )
        rebuild()
        let succeeded = await performSend(clientId: clientId)
        if succeeded, topicForPerson != nil {
            await loadTopicsIfNeeded()
        }
    }

    private func resolveTopicIdForShare(
        _ topic: (type: String, refId: String, title: String)?
    ) async -> String? {
        guard let topic else { return selectedTopicId }
        guard case let .person(otherUserId) = mode else { return selectedTopicId }
        do {
            let response: FindOrCreateTopicResponse = try await api.request(
                ChatEndpoints.findOrCreateTopic(
                    otherUserId: otherUserId,
                    body: FindOrCreateTopicBody(
                        topicType: topic.type,
                        topicRefId: topic.refId,
                        title: topic.title
                    )
                )
            )
            selectedTopicId = response.topic.id
            return response.topic.id
        } catch {
            logger.warning("find/create share topic failed: \(error)")
            return selectedTopicId
        }
    }

    private func optimisticRichMessage(
        text: String,
        clientId: String,
        roomId: String,
        messageType: String,
        metadata: [String: JSONValue]
    ) -> ChatMessageDTO {
        ChatMessageDTO(
            id: "client_\(clientId)",
            roomId: roomId,
            userId: currentUserId,
            messageText: text,
            messageType: messageType,
            metadata: .object(metadata),
            replyToId: nil,
            clientMessageId: clientId,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            editedAt: nil,
            deletedAt: nil,
            deliveredAt: nil,
            readAt: nil,
            sender: nil
        )
    }

    private func appendQueuedAttachment(_ attachment: ChatQueuedAttachment) {
        guard !queuedAttachments.contains(where: { $0.id == attachment.id }) else { return }
        queuedAttachments = Array((queuedAttachments + [attachment]).prefix(5))
    }

    private func uploadQueuedAttachmentsIfNeeded(roomId: String) async throws -> [String] {
        let files = queuedAttachments.compactMap { attachment -> MultipartFile? in
            guard let data = attachment.data else { return nil }
            return MultipartFile(
                fieldName: "files",
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                data: data
            )
        }
        guard !files.isEmpty else { return [] }
        let response = try await uploader.uploadChatMedia(roomId: roomId, files: files)
        return response.media.map(\.id)
    }

    private func uploadQueuedAIImagesIfNeeded() async throws -> [String] {
        let files = queuedAttachments.compactMap { attachment -> MultipartFile? in
            guard let data = attachment.data, attachment.mimeType.hasPrefix("image/") else { return nil }
            return MultipartFile(fieldName: "files", filename: attachment.filename, mimeType: attachment.mimeType, data: data)
        }
        guard !files.isEmpty else { return [] }
        let response = try await uploader.uploadAIMedia(files: files)
        return response.images.map(\.url)
    }

    // MARK: - Fetch

    /// How a fetch treats the state already on screen.
    private enum FetchKind {
        /// Full reload — shimmer + wiped pagination. First load, topic
        /// switch, and error-retry only.
        case reload
        /// Silent newest-page merge — keeps the rendered rows, scroll
        /// position, and loaded older pages. Socket echoes,
        /// pull-to-refresh, and the offline poll.
        case merge
        /// Older-page prepend (scroll-to-top pagination).
        case older(cursor: String)
    }

    private func fetch(_ kind: FetchKind) async {
        // AI thread messages are local-only — there is no persisted
        // history to refetch, so refresh/pull-to-refresh must be a
        // no-op BEFORE any clearing or the gesture would wipe the
        // visible conversation (including mid-stream). A fresh thread
        // still lands on `.empty` so the welcome card renders.
        if case .ai = mode {
            if messages.isEmpty {
                state = .empty
            }
            return
        }
        if case .reload = kind {
            state = .loading
            messages = []
            // Pending / failed optimistic rows survive refetches —
            // eating an in-flight or failed send here would lose the
            // message and its retry CTA. Confirmed rows are retired in
            // `apply(response:kind:)` by `client_message_id` match.
            oldestCursor = nil
            hasMore = false
        }
        let before: String? =
            if case let .older(cursor) = kind { cursor } else { nil }
        switch mode {
        case .ai:
            // Handled by the early return above.
            return
        case let .room(roomId):
            await fetchRoom(roomId: roomId, before: before, kind: kind)
        case let .person(otherUserId):
            await fetchPerson(otherUserId: otherUserId, before: before, kind: kind)
        }
    }

    private func loadTopicsIfNeeded() async {
        guard case let .person(otherUserId) = mode else { return }
        if let initialTopic, selectedTopicId == nil {
            do {
                let response: FindOrCreateTopicResponse = try await api.request(
                    ChatEndpoints.findOrCreateTopic(
                        otherUserId: otherUserId,
                        body: FindOrCreateTopicBody(
                            topicType: initialTopic.topicType,
                            topicRefId: initialTopic.topicRefId,
                            title: initialTopic.title
                        )
                    )
                )
                selectedTopicId = response.topic.id
            } catch {
                logger.warning("find/create topic failed: \(error)")
            }
        }
        do {
            let response: ConversationTopicsResponse = try await api.request(ChatEndpoints.conversationTopics(otherUserId: otherUserId))
            topics = response.topics.map {
                ChatConversationTopic(id: $0.id, topicType: $0.topicType, title: $0.title, status: $0.status)
            }
        } catch {
            logger.warning("load topics failed: \(error)")
        }
    }

    private func fetchRoom(roomId: String, before: String?, kind: FetchKind) async {
        do {
            let response: ChatMessagesResponse = try await api.request(
                ChatEndpoints.roomMessages(roomId: roomId, before: before)
            )
            apply(response: response, kind: kind)
            scheduleMarkRead(for: roomId)
        } catch {
            handleFetchFailure(error, kind: kind)
        }
    }

    private func fetchPerson(otherUserId: String, before: String?, kind: FetchKind) async {
        do {
            let response: ChatMessagesResponse = try await api.request(
                ChatEndpoints.conversationMessages(otherUserId: otherUserId, before: before, topicId: selectedTopicId)
            )
            apply(response: response, kind: kind)
            scheduleMarkRead(for: otherUserId)
        } catch {
            handleFetchFailure(error, kind: kind)
        }
    }

    private func handleFetchFailure(_ error: any Error, kind: FetchKind) {
        if case .reload = kind {
            state = .error(message: friendlyMessage(error))
        } else {
            logger.warning("chat refetch failed: \(error)")
        }
    }

    private func apply(response: ChatMessagesResponse, kind: FetchKind) {
        if case .merge = kind, !messages.isEmpty {
            // Newest-page refetch while older pages may be loaded —
            // replace held copies (edits/reactions land) and append rows
            // we don't hold yet. Never touches the pagination cursors, so
            // a socket echo can't wipe the history the user scrolled to.
            var didChange = false
            for fetched in response.messages {
                if let index = messages.firstIndex(where: { $0.id == fetched.id }) {
                    if messages[index] != fetched {
                        messages[index] = fetched
                        didChange = true
                    }
                } else {
                    messages.append(fetched)
                    didChange = true
                }
            }
            if didChange {
                messages.sort { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
            }
            retireConfirmedClientIds(in: response)
            updateActiveRooms(response: response)
            rebuild()
            joinActiveRoomsIfPossible()
            return
        }
        // Backend returns messages oldest-first (ascending) — see
        // backend/routes/chats.js, which fetches the newest N rows then
        // reverses them. Drop ids we already hold (a send completing while
        // this fetch was in flight may have upserted its message ahead of
        // us), then sort by (created_at, id) so the held array stays
        // oldest-first regardless of which page these rows came from.
        let existingIds = Set(messages.map(\.id))
        let incoming = response.messages.filter { !existingIds.contains($0.id) }
        messages.append(contentsOf: incoming)
        messages.sort { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
        retireConfirmedClientIds(in: response)
        updateActiveRooms(response: response)
        hasMore = response.hasMore ?? false
        oldestCursor = response.nextCursor ?? Self.paginationCursor(for: messages.first)
        rebuild()
        joinActiveRoomsIfPossible()
    }

    /// A fetched row carrying one of our client ids means that send
    /// landed server-side (e.g. the POST response was lost, then a
    /// socket refetch ran) — retire every trace of the optimistic
    /// copy so a delivered message can never linger as "failed".
    private func retireConfirmedClientIds(in response: ChatMessagesResponse) {
        for clientId in response.messages.compactMap(\.clientMessageId)
            where pendingByClientId[clientId] != nil
            || sendContextsByClientId[clientId] != nil
            || failedClientIds.contains(clientId) {
            pendingByClientId[clientId] = nil
            sendContextsByClientId[clientId] = nil
            failedClientIds.remove(clientId)
        }
    }

    /// Stable `(created_at|id)` cursor for keyset pagination. Avoids raw
    /// ISO strings with `+` offsets — those become spaces in query strings.
    private static func paginationCursor(for message: ChatMessageDTO?) -> String? {
        guard let message else { return nil }
        let timestamp = normalizeTimestampForPagination(message.createdAt)
        return "\(timestamp)|\(message.id)"
    }

    private static func normalizeTimestampForPagination(_ raw: String) -> String {
        raw
            .replacingOccurrences(of: "+00:00", with: "Z")
            .replacingOccurrences(of: "+0000", with: "Z")
    }

    private func updateActiveRooms(response: ChatMessagesResponse) {
        var ids = Set(response.roomIds ?? [])
        ids.formUnion(response.messages.map(\.roomId))
        if case let .room(roomId) = mode {
            ids.insert(roomId)
        }
        if let directRoomId {
            ids.insert(directRoomId)
        }
        activeRoomIds = ids
        // Keep the push layer's "currently viewing" registry in sync so
        // foreground chat pushes for this thread don't show a banner.
        activeThreadTracker.setActiveRooms(ids, owner: ObjectIdentifier(self))
    }

    // MARK: - Mark-read

    private func performMarkRead() async {
        guard let target = await resolveRoomIdForReadMark() else { return }
        let endpoint =
            switch mode {
            case let .person(otherUserId):
                ChatEndpoints.markConversationRead(otherUserId: otherUserId)
            default:
                ChatEndpoints.markRoomRead(roomId: target)
            }
        do {
            _ = try await api.request(endpoint, as: EmptyResponse.self)
        } catch {
            logger.warning("markRead failed: \(error)")
        }
    }

    private func scheduleMarkRead(for _: String) {
        scheduleMarkRead()
    }

    private func resolveRoomIdForReadMark() async -> String? {
        switch mode {
        case let .room(id): id
        case let .person(otherUserId): otherUserId
        case .ai: nil
        }
    }

    /// Resolve the room to send into. Room threads use their fixed id.
    /// Person threads always send to the pair's direct room — found or
    /// created via `POST /api/chat/direct` and cached — never to a
    /// shared gig/group room surfaced by the aggregated fetch, which
    /// would misfile plain DMs and trip gig pre-bid send limits.
    private func ensureRoomId() async throws -> String {
        switch mode {
        case let .room(id):
            return id
        case .ai:
            throw ChatSendError.noRoom
        case let .person(otherUserId):
            if let directRoomId { return directRoomId }
            if let inFlight = directRoomTask {
                return try await inFlight.value
            }
            let task = Task { [api] in
                let response: CreateDirectChatResponse = try await api.request(
                    ChatEndpoints.createDirectChat(otherUserId: otherUserId)
                )
                return response.roomId
            }
            directRoomTask = task
            defer { directRoomTask = nil }
            let roomId = try await task.value
            directRoomId = roomId
            // Join the freshly resolved room so the socket delivers
            // `message:new` for replies that land in it.
            if !activeRoomIds.contains(roomId) {
                activeRoomIds.insert(roomId)
                activeThreadTracker.setActiveRooms(activeRoomIds, owner: ObjectIdentifier(self))
                joinActiveRoomsIfPossible()
            }
            return roomId
        }
    }

    /// Best-known room id for the optimistic row (cosmetic only — the
    /// authoritative id is resolved by `ensureRoomId()` at send time).
    private func knownRoomIdHint() -> String {
        switch mode {
        case let .room(id): id
        case .person: directRoomId ?? ""
        case .ai: ""
        }
    }

    // MARK: - Realtime

    private func subscribeToSockets() {
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await state in socket.connectionStates() {
                if state == .connected {
                    joinedRoomIds.removeAll()
                    joinActiveRoomsIfPossible()
                }
                updateFallbackPolling(isConnected: state == .connected)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "message:new", as: ChatRealtimeMessage.self) {
                handleIncoming(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "message:edited", as: ChatRealtimeMessageUpdate.self) {
                handleUpdate(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "message:deleted", as: ChatRealtimeMessageDelete.self) {
                handleDelete(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "message:reaction_updated", as: ChatRealtimeReaction.self) {
                handleReaction(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "typing:user", as: ChatRealtimeTyping.self) {
                handleTypingStarted(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "typing:stopped", as: ChatRealtimeTyping.self) {
                handleTypingStopped(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "user:online", as: ChatRealtimePresence.self) {
                handlePresence(event, online: true)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let self else { return }
            for await event in socket.events(named: "user:offline", as: ChatRealtimePresence.self) {
                handlePresence(event, online: false)
            }
        })
        joinActiveRoomsIfPossible()
    }

    /// Live presence (A15 header dot / "Active now"). Only the person
    /// thread's counterparty matters — room/group/AI threads have no
    /// single presence subject.
    private func handlePresence(_ event: ChatRealtimePresence, online: Bool) {
        guard case let .person(otherUserId) = mode, event.userId == otherUserId else { return }
        counterpartyOnline = online
    }

    /// Start/stop the socket-down fallback poll. While disconnected, a
    /// loaded non-AI thread refetches every 30s so incoming replies
    /// still land; reconnecting cancels the loop (the socket resumes
    /// realtime delivery and `room:join` backfills the gap).
    private func updateFallbackPolling(isConnected: Bool) {
        if isConnected {
            fallbackPollTask?.cancel()
            fallbackPollTask = nil
            return
        }
        guard fallbackPollTask == nil else { return }
        if case .ai = mode { return }
        fallbackPollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                guard !Task.isCancelled else { return }
                guard let self else { return }
                await refresh()
            }
        }
    }

    private func joinActiveRoomsIfPossible() {
        guard socket.connectionState == .connected else { return }
        let pendingRooms = activeRoomIds.subtracting(joinedRoomIds)
        guard !pendingRooms.isEmpty else { return }
        for roomId in pendingRooms {
            joinedRoomIds.insert(roomId)
            socketTasks.append(Task { [weak self] in
                guard let self else { return }
                let ack: ChatRoomJoinAck? = await socket.emitWithAck(
                    "room:join",
                    payload: ["roomId": roomId],
                    as: ChatRoomJoinAck.self
                )
                guard ack?.success == true, let backfill = ack?.messages, !backfill.isEmpty else { return }
                mergeBackfill(backfill)
            })
        }
    }

    private func mergeBackfill(_ backfill: [ChatMessageDTO]) {
        // A backfill row carrying one of our client ids means that send
        // landed server-side (lost POST response + missed `message:new`
        // echo — exactly the reconnect case backfill exists for). Retire
        // every trace of the optimistic copy, same contract as
        // `apply(response:)`, so the delivered message can't render next
        // to its own "Failed — Retry" twin.
        var retiredPending = false
        for clientId in backfill.compactMap(\.clientMessageId)
            where pendingByClientId[clientId] != nil
            || sendContextsByClientId[clientId] != nil
            || failedClientIds.contains(clientId) {
            pendingByClientId[clientId] = nil
            sendContextsByClientId[clientId] = nil
            failedClientIds.remove(clientId)
            retiredPending = true
        }
        let existingIds = Set(messages.map(\.id))
        let newMessages = backfill.filter { !existingIds.contains($0.id) }
        guard !newMessages.isEmpty else {
            if retiredPending { rebuild() }
            return
        }
        messages.append(contentsOf: newMessages)
        messages.sort { $0.createdAt < $1.createdAt }
        rebuild()
        scheduleMarkRead()
    }

    /// Merge a reaction count update into the matching message. The
    /// minimal patch is the count — the projection re-derives the
    /// delivery state + stamp from the existing message fields.
    private func handleReaction(_ event: ChatRealtimeReaction) {
        guard messages.contains(where: { $0.id == event.messageId }) else { return }
        // Reactions don't change the message body — just trigger a
        // re-fetch so the server count is canonical.
        Task { await self.refresh() }
    }

    private func handleIncoming(_ event: ChatRealtimeMessage) {
        guard activeRoomIds.contains(event.roomId) else { return }
        // Server-side echo of our own optimistic message. Retire every
        // trace of it — clearing the send context and any failed mark
        // too, so a lost POST response resolving moments later can't
        // re-flag the now-confirmed message as failed.
        if let clientId = event.clientMessageId, pendingByClientId[clientId] != nil {
            pendingByClientId[clientId] = nil
            sendContextsByClientId[clientId] = nil
            failedClientIds.remove(clientId)
            Task { await self.refresh() }
            return
        }
        // Someone else's message in this thread → append + rebuild.
        if messages.contains(where: { $0.id == event.id }) { return }
        Task { await self.refresh() }
    }

    private func handleUpdate(_ event: ChatRealtimeMessageUpdate) {
        if let roomId = event.roomId, !activeRoomIds.contains(roomId) { return }
        guard let index = messages.firstIndex(where: { $0.id == event.id }) else { return }
        let original = messages[index]
        // Construct an updated DTO by re-encoding/decoding the
        // delta — the simpler path is to just refetch.
        Task { await self.refresh() }
        _ = original
    }

    private func handleDelete(_ event: ChatRealtimeMessageDelete) {
        if let roomId = event.roomId, !activeRoomIds.contains(roomId) { return }
        messages.removeAll { $0.id == event.id }
        rebuild()
    }

    private func applyUpdatedMessage(_ updated: ChatMessageDTO) {
        if let index = messages.firstIndex(where: { $0.id == updated.id }) {
            messages[index] = updated
        } else {
            messages.append(updated)
        }
        rebuild()
    }

    private func applyReactions(_ reactions: [ChatReactionSummary], to messageId: String) {
        guard let index = messages.firstIndex(where: { $0.id == messageId }) else { return }
        messages[index] = messages[index].replacingReactions(reactions)
        rebuild()
    }

    // MARK: - Projection

    private func rebuild() {
        let combined = combinedMessages()
        if combined.isEmpty {
            state = .empty
            return
        }
        // Topic dividers render only in a person thread's unfiltered
        // ("All") view, and only when the pair has at least one topic —
        // a topicId change between consecutive messages (nil → non-nil
        // included) starts a new labeled segment.
        let showsTopicDividers: Bool = {
            guard case .person = mode else { return false }
            return selectedTopicId == nil && !topics.isEmpty
        }()
        var rows: [ChatTimelineRow] = []
        var lastDayKey: String?
        var lastTopicId: String?
        for (index, message) in combined.enumerated() {
            let dayKey = Self.dayKey(for: message.createdAt)
            if dayKey != lastDayKey {
                rows.append(.dayDivider(ChatDayDivider(id: dayKey, label: Self.dayLabel(for: message.createdAt))))
                lastDayKey = dayKey
            }
            if showsTopicDividers {
                if index > 0, message.topicId != lastTopicId {
                    let label = topics.first { $0.id == message.topicId }?.title ?? "General"
                    rows.append(.topicDivider(ChatTopicDivider(id: message.id, label: label)))
                }
                lastTopicId = message.topicId
            }
            if message.messageType == "broadcast_reference" {
                rows.append(.broadcastReference(Self.broadcastReference(for: message)))
                continue
            }
            let side: ChatMessageSide = (message.userId == currentUserId) ? .outgoing : .incoming
            let previousSameSide =
                index > 0 &&
                combined[index - 1].userId == message.userId &&
                Self.dayKey(for: combined[index - 1].createdAt) == dayKey
            let nextSameSide =
                index + 1 < combined.count &&
                combined[index + 1].userId == message.userId &&
                Self.dayKey(for: combined[index + 1].createdAt) == dayKey
            let hasTail = !nextSameSide
            let deliveryState: ChatDeliveryState? = {
                guard side == .outgoing else { return nil }
                if let clientId = message.clientMessageId, failedClientIds.contains(clientId) {
                    return .failed
                }
                if message.id.hasPrefix("client_") { return .sending }
                if message.readAt != nil { return .read }
                return .delivered
            }()
            // Failed / in-flight rows keep their stamp row even when
            // grouped (no tail) — the stamp is the only surface for the
            // "Sending..." spinner and the "Failed to send" + Retry CTA,
            // which must never be hidden by group rhythm. Tail visuals
            // stay driven by `hasTail`.
            let showStamp = hasTail || deliveryState == .failed || deliveryState == .sending
            let stamp: String? = showStamp ? Self.stampLabel(for: message, currentUserId: currentUserId) : nil
            var body = Self.bodyForMessage(message)
            if message.messageType == "ai_reply" {
                body = .aiReply(text: message.messageText ?? "", estimate: nil, drafts: aiDraftsByMessageId[message.id] ?? [])
            }
            let replyPreview = Self.replyPreview(for: message, in: combined)
            let reactions = message.reactions.map {
                ChatBubbleReaction(id: $0.reaction, reaction: $0.reaction, count: $0.count, reactedByMe: $0.reactedByMe)
            }
            rows.append(.bubble(ChatBubbleContent(
                id: message.id,
                side: side,
                body: body,
                replyPreview: replyPreview,
                reactions: reactions,
                hasTail: hasTail,
                isContinuation: previousSameSide,
                stamp: stamp,
                deliveryState: deliveryState,
                lockedTier: Self.lockedTier(for: message),
                sentSupportTier: Self.sentSupportTier(for: message)
            )))
        }
        state = .loaded(rows: rows)
        resolveScrollTargetIfNeeded(rows: rows)
    }

    /// Resolve the Chat Search scroll target once: if the deep-linked
    /// message is present in the loaded page, publish its row id for the
    /// view to scroll to. The matched message is guaranteed to be in the
    /// first page because search indexes the same most-recent page.
    private func resolveScrollTargetIfNeeded(rows: [ChatTimelineRow]) {
        guard !didResolveScrollTarget, let target = scrollToMessageId else { return }
        let rowId = "bubble_\(target)"
        guard rows.contains(where: { $0.id == rowId }) else { return }
        didResolveScrollTarget = true
        // Publish on the next beat so the populated frame is mounted and
        // laid out before the view reacts — it scrolls in `.onChange`,
        // which only fires for a value that changes while it is on screen.
        Task { [weak self] in
            try? await Task.sleep(nanoseconds: 50_000_000)
            self?.pendingScrollTargetId = rowId
        }
    }

    /// Clear the scroll target after the view has scrolled to it.
    public func consumePendingScroll() {
        pendingScrollTargetId = nil
    }

    /// Merge persisted messages with optimistic pending rows. Failed
    /// rows stay in the list with the same id so the retry CTA can
    /// target them.
    private func combinedMessages() -> [ChatMessageDTO] {
        let pending = pendingByClientId.values.sorted { $0.createdAt < $1.createdAt }
        return messages + pending
    }

    /// Optimistic local row. Its `id` keeps the `client_` prefix — the
    /// projection and views key "still sending" off that — while
    /// `clientMessageId` stays a bare UUID for the wire.
    private func optimisticMessage(text: String, clientId: String, roomId: String) -> ChatMessageDTO {
        ChatMessageDTO(
            id: "client_\(clientId)",
            roomId: roomId,
            userId: currentUserId,
            messageText: text,
            messageType: "text",
            metadata: nil,
            replyToId: nil,
            clientMessageId: clientId,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            editedAt: nil,
            deletedAt: nil,
            deliveredAt: nil,
            readAt: nil,
            sender: nil
        )
    }

    private func localMessage(id: String, text: String, userId: String, type: String, imageURLs: [String] = []) -> ChatMessageDTO {
        ChatMessageDTO(
            id: id,
            roomId: "ai",
            userId: userId,
            messageText: text,
            messageType: type,
            metadata: imageURLs.isEmpty ? nil : .object(["image_urls": .array(imageURLs.map(JSONValue.string))]),
            replyToId: nil,
            clientMessageId: nil,
            createdAt: ISO8601DateFormatter().string(from: Date()),
            editedAt: nil,
            deletedAt: nil,
            deliveredAt: nil,
            readAt: nil,
            sender: nil
        )
    }

    private func replaceLocalMessage(id: String, text: String, type: String, userId: String) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        messages[index] = localMessage(id: id, text: text, userId: userId, type: type)
        rebuild()
    }

    // MARK: - Body / stamp helpers

    private static func bodyForMessage(_ message: ChatMessageDTO) -> ChatBubbleContent.Body {
        if let urls = message.metadata?.dictValue?["image_urls"]?.arrayValue?
            .compactMap(\.stringValue)
            .compactMap({ Self.resolvedMediaURL($0) }),
            !urls.isEmpty {
            return .textWithImages(text: message.messageText ?? "", imageURLs: urls)
        }
        if let firstAttachment = message.attachments.first {
            let mime = firstAttachment.mimeType ?? ""
            if mime.hasPrefix("image/"), let rawURL = firstAttachment.fileURL {
                return .image(url: Self.resolvedMediaURL(rawURL))
            }
            return .attachment(
                filename: firstAttachment.originalFilename ?? "Attachment",
                sizeLabel: fileSizeLabel(firstAttachment.fileSize)
            )
        }
        switch message.messageType {
        case "ai_reply":
            return .aiReply(text: message.messageText ?? "", estimate: nil, drafts: [])
        case "image":
            let url = (message.metadata?.dictValue?["image_url"]?.stringValue).flatMap(Self.resolvedMediaURL)
            return .image(url: url)
        case "file", "audio":
            let name = message.metadata?.dictValue?["filename"]?.stringValue ?? "Attachment"
            return .attachment(filename: name, sizeLabel: nil)
        case "gig_offer":
            let meta = message.metadata?.dictValue
            let gigId = Self.metaString(meta, keys: "gigId", "gig_id")
                ?? Self.extractEntityId(from: message.messageText, collection: "gigs")
            let title = Self.metaString(meta, keys: "title") ?? message.messageText ?? "Shared gig"
            return .gigOfferCard(ChatGigOfferCard(
                gigId: gigId ?? "",
                title: title,
                category: Self.metaString(meta, keys: "category"),
                priceLabel: Self.metaPriceLabel(meta),
                status: Self.metaString(meta, keys: "status")
            ))
        case "listing_offer":
            let meta = message.metadata?.dictValue
            let listingId = Self.metaString(meta, keys: "listingId", "listing_id")
                ?? Self.extractEntityId(from: message.messageText, collection: "listings")
            let title = Self.metaString(meta, keys: "title") ?? message.messageText ?? "Shared listing"
            let isFree = Self.metaBool(meta, keys: "isFree", "is_free") ?? false
            let imageRaw = Self.metaString(meta, keys: "imageUrl", "image_url")
            return .listingOfferCard(ChatListingOfferCard(
                listingId: listingId ?? "",
                title: title,
                category: Self.metaString(meta, keys: "category"),
                priceLabel: Self.metaListingPriceLabel(meta, isFree: isFree),
                condition: Self.metaString(meta, keys: "condition"),
                imageURL: imageRaw.flatMap(URL.init(string:))
            ))
        case "location":
            let meta = message.metadata?.dictValue
            let address = Self.metaString(meta, keys: "address") ?? message.messageText ?? "Pinned location"
            let latitude = Self.metaDouble(meta, keys: "latitude", "lat") ?? 0
            let longitude = Self.metaDouble(meta, keys: "longitude", "lng", "lon") ?? 0
            return .locationCard(ChatLocationCard(
                latitude: latitude,
                longitude: longitude,
                address: address
            ))
        default:
            return .text(message.messageText ?? "")
        }
    }

    private static func resolvedMediaURL(_ raw: String?) -> URL? {
        ChatMediaURL.resolve(raw: raw)
    }

    private static func metaString(_ meta: [String: JSONValue]?, keys: String...) -> String? {
        guard let meta else { return nil }
        for key in keys {
            if let value = meta[key]?.stringValue, !value.isEmpty { return value }
        }
        return nil
    }

    private static func metaDouble(_ meta: [String: JSONValue]?, keys: String...) -> Double? {
        guard let meta else { return nil }
        for key in keys {
            if let value = meta[key]?.numberValue { return value }
            if let value = meta[key]?.stringValue, let parsed = Double(value) { return parsed }
        }
        return nil
    }

    private static func metaBool(_ meta: [String: JSONValue]?, keys: String...) -> Bool? {
        guard let meta else { return nil }
        for key in keys {
            if let value = meta[key]?.boolValue { return value }
        }
        return nil
    }

    private static func metaPriceLabel(_ meta: [String: JSONValue]?) -> String? {
        guard let raw = metaDouble(meta, keys: "price") else { return nil }
        return "$\(Int(raw.rounded()))"
    }

    private static func metaListingPriceLabel(_ meta: [String: JSONValue]?, isFree: Bool) -> String {
        if isFree { return "FREE" }
        guard let raw = metaDouble(meta, keys: "price") else { return "Make Offer" }
        return "$\(Int(raw.rounded()))"
    }

    private static func extractEntityId(from text: String?, collection: String) -> String? {
        guard let text, !text.isEmpty else { return nil }
        let pattern = #"/\#(collection)/([A-Za-z0-9-]+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, range: range),
              let idRange = Range(match.range(at: 1), in: text) else { return nil }
        return String(text[idRange])
    }

    private static func fileSizeLabel(_ bytes: Int?) -> String? {
        guard let bytes else { return nil }
        if bytes >= 1_000_000 {
            return String(format: "%.1f MB", Double(bytes) / 1_000_000)
        }
        if bytes >= 1000 {
            return "\(bytes / 1000) KB"
        }
        return "\(bytes) B"
    }

    private static func replyPreview(for message: ChatMessageDTO, in messages: [ChatMessageDTO]) -> ChatReplyPreview? {
        guard let replyToId = message.replyToId,
              let original = messages.first(where: { $0.id == replyToId }) else { return nil }
        return ChatReplyPreview(
            messageId: original.id,
            senderName: original.sender?.name ?? "Message",
            text: original.messageText ?? ""
        )
    }

    private static func lockedTier(for message: ChatMessageDTO) -> String? {
        guard let metadata = message.metadata?.dictValue else { return nil }
        let isLocked =
            metadata["tier_locked"]?.boolValue
                ?? metadata["is_locked"]?.boolValue
                ?? metadata["locked"]?.boolValue
                ?? false
        guard isLocked else { return nil }
        return metadata["required_tier"]?.stringValue
            ?? metadata["locked_tier"]?.stringValue
            ?? metadata["tier"]?.stringValue
            ?? "Silver"
    }

    private static func sentSupportTier(for message: ChatMessageDTO) -> String? {
        guard let metadata = message.metadata?.dictValue else { return nil }
        return metadata["sent_support_tier"]?.stringValue
            ?? metadata["support_tier"]?.stringValue
            ?? metadata["paid_support_tier"]?.stringValue
    }

    private static func broadcastReference(for message: ChatMessageDTO) -> ChatBroadcastReference {
        let metadata = message.metadata?.dictValue
        return ChatBroadcastReference(
            id: message.id,
            title: metadata?["title"]?.stringValue ?? "Broadcast referenced",
            subtitle: metadata?["subtitle"]?.stringValue ?? "This conversation started from a creator broadcast.",
            metric: metadata?["metric"]?.stringValue ?? "Audience update"
        )
    }

    private static func dayKey(for iso: String) -> String {
        guard let date = parseISO(iso) else { return iso }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func dayLabel(for iso: String) -> String {
        guard let date = parseISO(iso) else { return iso }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date).uppercased()
    }

    private static func stampLabel(for message: ChatMessageDTO, currentUserId: String) -> String? {
        guard let date = parseISO(message.createdAt) else { return nil }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        let time = formatter.string(from: date)
        let isOutgoing = message.userId == currentUserId
        let sender = message.sender?.name.flatMap { $0.isEmpty ? nil : $0 }
        if isOutgoing {
            return time
        } else if let sender {
            return "\(sender) · \(time)"
        } else {
            return time
        }
    }

    private static func parseISO(_ raw: String) -> Date? {
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f1.date(from: raw) ?? ISO8601DateFormatter().date(from: raw)
    }

    private func friendlyMessage(_ error: any Error) -> String {
        (error as? APIError)?.errorDescription ?? "Couldn't load this conversation."
    }
}
