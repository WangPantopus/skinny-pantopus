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
import PDFKit

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
    /// Draft cards this app shows beyond the original ones; the server offers
    /// the matching tools only to apps that list them. `action` cards are
    /// one-tap requests through endpoints the app already uses, and `link`
    /// buttons open screens in the app (contract
    /// `docs/product/ai-assistant-phase1-contract-2026-10-20.md`, section 3).
    public static let supportedCards = ["pickup_schedule", "action", "link"]

    public let message: String
    public let conversationId: String?
    public let images: [String]?
    public let cards: [String]
    /// What the person was looking at when they tapped Ask, for a thread
    /// opened from a screen.
    public let context: AIChatContext?

    public init(message: String, conversationId: String? = nil, images: [String]? = nil, context: AIChatContext? = nil) {
        self.message = message
        self.conversationId = conversationId
        self.images = images
        cards = Self.supportedCards
        self.context = context
    }
}

public enum AIChatStreamEvent: Sendable, Equatable {
    case conversation(id: String)
    /// What the assistant is doing while a tool runs ("Drafting your post…").
    case status(String)
    case textDelta(String)
    case draft(ChatAIDraftCard)
    /// A button under the reply that opens a screen in the app.
    case link(ChatAILink)
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
                    // This stream bypasses APIClient, so renew a lapsing token first, as it does;
                    // otherwise the first message after the token expires fails.
                    await AuthManager.shared.refreshIfExpiringSoon()
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
                        let status = (response as? HTTPURLResponse)?.statusCode
                        // The day's budget and the off switch say so in their own words.
                        if let message = await Self.pausedMessage(bytes) {
                            continuation.yield(.error(message))
                        } else {
                            // 429: the hourly limit (backend/middleware/rateLimiter.js aiChatLimiter), not a connection problem.
                            continuation.yield(.error(status == 429
                                    ? "You've reached this hour's limit for Pantopus AI. Please try again later."
                                    : "Failed to connect to AI."))
                        }
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
        case "status":
            if let message = object["message"] as? String, !message.isEmpty {
                continuation.yield(.status(message))
            }
        case "text_delta":
            if let delta = object["delta"] as? String {
                continuation.yield(.textDelta(delta))
            }
        case "draft":
            if let draft = Self.parseDraft(object) {
                continuation.yield(.draft(draft))
            }
        case "link":
            if let label = object["label"] as? String, !label.isEmpty, let url = object["url"] as? String, !url.isEmpty {
                continuation.yield(.link(ChatAILink(label: label, url: url)))
            }
        case "done":
            continuation.yield(.done)
        case "error":
            // AI_BUDGET and AI_DISABLED, like every error, show their message as sent.
            continuation.yield(.error((object["message"] as? String) ?? (object["error"] as? String) ?? "AI error."))
        default:
            break
        }
    }

    /// A refused stream's own message when it is the day's budget
    /// (`AI_BUDGET`) or the off switch (`AI_DISABLED`); nil otherwise.
    private static func pausedMessage(_ bytes: URLSession.AsyncBytes) async -> String? {
        var data = Data()
        do {
            for try await byte in bytes {
                data.append(byte)
                if data.count > 8192 { break }
            }
        } catch {
            return nil
        }
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let code = (object["code"] as? String) ?? (object["error"] as? String),
              code == "AI_BUDGET" || code == "AI_DISABLED",
              let message = object["message"] as? String, !message.isEmpty else { return nil }
        return message
    }

    static func parseDraft(_ object: [String: Any]) -> ChatAIDraftCard? {
        let type = (object["type"] as? String) ?? "draft"
        let valid = (object["valid"] as? Bool) ?? true
        let draft = object["draft"] as? [String: Any] ?? [:]
        if type == "action" {
            return actionCard(from: draft)
        }
        let story = (draft["story"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let content = (draft["content"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = type == "support_train"
            ? "Support Train"
            : (draft["title"] as? String)
            ?? (draft["summary"] as? String)
            ?? (draft["content"] as? String)
            ?? "\(type.capitalized) draft"
        let summary = (draft["description"] as? String)
            ?? (draft["content"] as? String)
            ?? (draft["summary"] as? String)
            ?? story
        let price: String? = {
            if let price = draft["price"] { return "$\(price)" }
            if let amount = draft["amount"] { return "$\(amount)" }
            return nil
        }()
        // "Use draft" carries the text into the composer it opens.
        let headline = (draft["title"] as? String).flatMap { $0.isEmpty ? nil : $0 }
        let prefill: ChatAIDraftPrefill? =
            switch type {
            case "post": content.flatMap { $0.isEmpty ? nil : postPrefill(body: $0, title: headline, draft: draft) }
            case "support_train": story.flatMap { $0.isEmpty ? nil : ChatAIDraftPrefill(body: $0) }
            default: nil
            }
        return ChatAIDraftCard(
            id: "\(type)_\(UUID().uuidString)",
            type: type,
            title: title,
            summary: summary,
            priceLabel: price,
            valid: valid,
            prefill: prefill,
            pickup: type == "pickup_schedule" ? pickupSchedule(from: draft) : nil
        )
    }

    /// A post card's text with every field it carries for the composer: the
    /// event's times and place, when a deal ends, lost or found, the Heads Up kind.
    static func postPrefill(body: String, title: String?, draft: [String: Any]) -> ChatAIDraftPrefill {
        let text: (String) -> String? = { key in
            (draft[key] as? String).flatMap { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : $0 }
        }
        var prefill = ChatAIDraftPrefill(body: body, postType: text("postType"), title: title)
        prefill.eventDate = text("eventDate")
        prefill.eventEndDate = text("eventEndDate")
        prefill.eventVenue = text("eventVenue")
        prefill.dealExpiresAt = text("dealExpiresAt")
        prefill.lostFoundType = text("lostFoundType")
        prefill.safetyAlertKind = text("safetyAlertKind")
        return prefill
    }

    /// An action card (`type: "action"`), or nil when its envelope can't be read.
    static func actionCard(from draft: [String: Any]) -> ChatAIDraftCard? {
        guard JSONSerialization.isValidJSONObject(draft),
              let data = try? JSONSerialization.data(withJSONObject: draft),
              let envelope = try? JSONDecoder().decode(AIActionCardDTO.self, from: data) else { return nil }
        return ChatAIDraftCard(
            id: "action_\(envelope.id)",
            type: "action",
            title: envelope.title,
            summary: nil,
            priceLabel: nil,
            valid: true,
            action: ChatAIActionCard(envelope: envelope)
        )
    }

    /// A pickup-days card's schedule, or nil when the draft lacks the home or the garbage day.
    static func pickupSchedule(from draft: [String: Any]) -> ChatAIPickupSchedule? {
        guard let homeId = draft["home_id"] as? String, !homeId.isEmpty,
              let weekday = draft["garbage_weekday"] as? String, !weekday.isEmpty else { return nil }
        return ChatAIPickupSchedule(
            homeId: homeId,
            garbageWeekday: weekday,
            recyclingFrequency: (draft["recycling_frequency"] as? String) ?? "not_set",
            recyclingNextDate: draft["recycling_next_date"] as? String
        )
    }

    /// A restored draft's fields (`GET /api/ai/conversations/:id/messages`) as
    /// the stream's JSON objects, so restored and live cards are built alike.
    static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case let .string(text):
            return text
        case let .number(number):
            // A whole number reads "$80", as JSONSerialization's numbers do, not "$80.0".
            if number.rounded() == number, abs(number) < 1e15 { return Int(number) }
            return number
        case let .bool(flag):
            return flag
        case let .object(object):
            return object.mapValues { foundationValue($0) }
        case let .array(items):
            return items.map { foundationValue($0) }
        case .null:
            return NSNull()
        }
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
    /// People who tapped "New chat": reopening the thread must not resume their previous conversation.
    private var freshStartUserIds: Set<String> = []

    public init() {}

    public func conversationId(forUserId userId: String) -> String? {
        conversationIdsByUserId[userId]
    }

    public func setConversationId(_ id: String, forUserId userId: String) {
        conversationIdsByUserId[userId] = id
        freshStartUserIds.remove(userId)
    }

    /// "New chat": forget the conversation; the next message starts a new one.
    public func startFresh(forUserId userId: String) {
        conversationIdsByUserId[userId] = nil
        freshStartUserIds.insert(userId)
    }

    public func didStartFresh(forUserId userId: String) -> Bool {
        freshStartUserIds.contains(userId)
    }

    /// Sign-out: nothing of the last account's assistant thread stays in memory.
    public func clear() {
        conversationIdsByUserId.removeAll()
        freshStartUserIds.removeAll()
    }
}

/// A brief or nudge the assistant thread opens at (`pantopus://assistant?nudge=`,
/// `docs/product/ai-assistant-phase2-contract-2026-10-20.md` §8.2): its
/// Notification id and, when its metadata named it, its conversation.
public struct AIAssistantNudge: Hashable, Sendable {
    public let notificationId: String
    public let conversationId: String?

    public init(notificationId: String, conversationId: String? = nil) {
        self.notificationId = notificationId
        self.conversationId = conversationId
    }
}

/// How reading an assistant conversation's turns went: shown (or overtaken by a
/// message sent meanwhile), gone (404), or not read (offline, a server error).
private enum AIHistoryLoad {
    case read, missing, failed
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
    public private(set) var isViewingSearchContext = false
    public private(set) var isViewingEarlierHistory = false
    private static let retainedMessageLimit = 600
    /// Exclusive upper edge of a window whose newer rows were evicted.
    private var earlierHistoryBefore: String?
    private var hasLatestHistoryWindow = false
    private var historyCacheVersion: Int?

    /// True while the screen was opened from Chat Search (or at a nudge) and
    /// the matched message hasn't been scrolled to yet — the view skips its
    /// land-at-latest pass so the two don't fight over the position. It
    /// stays true from finding the message until the view has scrolled to
    /// it: the populated frame appears in between, and its pass would
    /// otherwise pin the thread back to the bottom.
    public var hasPendingSearchTarget: Bool {
        scrollToMessageId != nil && (!didResolveScrollTarget || awaitingTargetScroll)
    }

    /// Header counterparty data (drives the top-bar variant).
    public private(set) var counterparty: ChatCounterparty

    /// Live presence override for the person counterparty, driven by the
    /// `user:online` / `user:offline` socket events. `nil` until the
    /// first presence event arrives. Unknown presence never displays Active now.
    public private(set) var counterpartyOnline: Bool?

    /// The other person's id in a person DM (for the header's profile link),
    /// nil in rooms and the AI thread.
    public var profileUserId: String? {
        guard case let .person(otherUserId) = mode, !otherUserId.isEmpty else { return nil }
        return otherUserId
    }

    /// Counterparty the header should render — the static value with the
    /// `online` flag replaced by the live presence override when one has
    /// arrived.
    public var headerCounterparty: ChatCounterparty {
        guard case let .person(name, initials, locality, verified, _) = counterparty else {
            return counterparty
        }
        return .person(
            name: name,
            initials: initials,
            locality: locality,
            verified: verified,
            online: counterpartyOnline == true
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
            scheduleDraftSave()
            guard !isProgrammaticComposerWrite else { return }
            handleComposerTextChange()
        }
    }

    /// True while a send is in flight.
    public private(set) var isSending: Bool = false

    public private(set) var replyingTo: ChatReplyPreview? {
        didSet { if oldValue != replyingTo { scheduleDraftSave() } }
    }

    public private(set) var editingMessageId: String? {
        didSet { if oldValue != editingMessageId { scheduleDraftSave() } }
    }

    public private(set) var topics: [ChatConversationTopic] = []
    private var topicsConfirmed = false
    public private(set) var selectedTopicId: String? {
        didSet {
            if oldValue != selectedTopicId {
                lastReadBoundaries = [:]
                activeThreadTracker.setActiveRooms(activeRoomIds, owner: ObjectIdentifier(self), topicId: selectedTopicId)
                scheduleDraftSave()
            }
        }
    }

    /// User-facing notice set when the backend rejects a send with the
    /// gig pre-bid message cap (429 `PRE_BID_LIMIT`,
    /// `backend/routes/chats.js:1573`), refuses it (403), or, in the
    /// assistant thread, won't take a file (`POST /api/upload/ai-media`).
    /// Cleared on the next successful send, the assistant's next Send or a
    /// topic switch; the view renders it as a dismissible banner above the
    /// composer.
    public private(set) var sendLimitNotice: String?

    /// Set when a delete, edit or reaction fails, so the rollback isn't
    /// silent. The view shows it as a toast and clears it after display.
    public var actionFailure: String?

    /// A downloaded file attachment for the view to preview (QuickLook).
    /// The view clears it when the preview closes.
    public var previewFileURL: URL?

    /// True while a tapped file attachment downloads; a second tap waits.
    private var isOpeningAttachment = false

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

    /// What the assistant is doing while a tool runs ("Drafting your post…"),
    /// shown in place of "Thinking…" until the reply or its card arrives.
    public private(set) var aiStatus: String?

    /// True while "Delete conversation" runs; the header's menu waits.
    public private(set) var isDeletingAIConversation = false

    /// Local pre-send queue. Backend upload/send wiring is out of scope
    /// for this phase, but the UI can still render and remove queued
    /// attachments deterministically.
    public private(set) var queuedAttachments: [ChatQueuedAttachment] = [] {
        didSet { if oldValue != queuedAttachments { scheduleDraftSave() } }
    }

    public private(set) var shareableGigs: [ChatShareGigOption] = []
    public private(set) var shareableListings: [ChatShareListingOption] = []
    public private(set) var isLoadingShareOptions = false
    public private(set) var shareOptionsError: String?
    public private(set) var isSharingLocation = false

    /// Capability chips for the AI welcome card (tap-to-send). A thread
    /// opened from a screen's Ask offers that screen's starter prompts.
    public let aiPrompts: [ChatPromptChip]

    /// The screen a thread was opened from with Ask: sent with each message
    /// as `context`, and shown above the conversation ("About: …").
    public let aiTopic: AIAskTopic?

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
        // The assistant can't look people up (it points to Search); it can start a Support Train.
        ChatPromptChip(id: "support_train", label: "Start a Support Train", icon: .utensils)
    ]

    /// Quick-start chips for a human DM's empty state.
    public static let defaultEmptyChips: [ChatPromptChip] = [
        ChatPromptChip(id: "intro", label: "Introduce yourself", icon: .hand),
        ChatPromptChip(id: "gig", label: "Ask about the gig", icon: .briefcase),
        ChatPromptChip(id: "listing", label: "Share a listing", icon: .tag)
    ]

    /// First-launch scope. Launch cut #4 (Open gigs): the assistant doesn't price tasks, so
    /// "Price a task" gives way to the nearby question the web assistant offers. Launch cut #10
    /// (Mailbox): "Summarize mail" gives way to a home question it answers from the home's calendar.
    static var launchAICapabilities: [ChatPromptChip] {
        defaultAICapabilities.map { chip in
            switch chip.id {
            case "price" where !LaunchFeatures.openGigs:
                ChatPromptChip(id: "nearby", label: "What's happening nearby?", icon: .mapPin)
            case "mail" where !LaunchFeatures.mailbox:
                ChatPromptChip(id: "pickup", label: "When's my pickup?", icon: .calendar)
            default:
                chip
            }
        }
    }

    /// First-launch scope: "Ask about the gig" (launch cut #4, Open gigs) and
    /// "Share a listing" (launch cut #3, Marketplace) are hidden.
    static var launchEmptyChips: [ChatPromptChip] {
        defaultEmptyChips.filter { chip in
            switch chip.id {
            case "gig": LaunchFeatures.openGigs
            case "listing": LaunchFeatures.marketplace
            default: true
            }
        }
    }

    /// The line shown in place of the composer when the conversation takes no
    /// messages: the room closed, or the server refuses sends here (a direct
    /// chat with a draft or closed business).
    public var roomClosedNote: String? {
        inactiveRoomNote ?? sendRefusalNote
    }

    private var inactiveRoomNote: String?
    /// The server's sentence from the latest message read (`sendRefusal`).
    private var sendRefusalNote: String?

    /// Whether the composer's send disc is enabled (text present + not
    /// in flight). Bound by the view.
    public var canSend: Bool {
        roomClosedNote == nil && (!composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !queuedAttachments.isEmpty) &&
            !isSending && !isDeletingAIConversation
    }

    /// True when another older page can be fetched.
    public var canLoadOlder: Bool {
        hasMore && oldestCursor != nil
    }

    private let api: APIClient
    /// The thread as last seen this session, with a bounded encrypted recent
    /// copy for relaunch. Both are cleared when the account changes.
    private let store: ScreenStore
    private let socket: SocketClient
    private let uploader: MultipartUploader
    private let aiClient: any AIChatStreaming
    private let aiConversationStore: AIConversationStore
    private let locationProvider: any LocationProviding
    private let mode: ChatThreadMode
    private let currentUserId: String
    private let asBusinessUserId: String?
    private var sendingIdentityId: String {
        asBusinessUserId ?? currentUserId
    }

    public var isBusinessReply: Bool {
        asBusinessUserId != nil
    }

    /// Topic the thread opened on. Used once, like Android, so "All" stays selected after a refresh.
    private var initialTopic: ChatInitialTopic?
    /// Gig backing a `.room` thread (from the unified-conversations
    /// row's `gig_id`). Drives the pinned context strip. `nil` for
    /// non-gig rooms, person threads, and AI.
    private let gigId: String?
    /// Registry consulted by `AppDelegate.willPresent` to suppress chat
    /// push banners for the thread the user is already viewing.
    private let activeThreadTracker: ActiveChatThreadTracker
    /// Message to scroll to on first load (Chat Search deep-link). `nil`
    /// for normal opens, which land on the latest message. In the assistant
    /// thread opened at a nudge it is the nudge's id until its history names
    /// the message that carries it.
    private var scrollToMessageId: String?
    private var didResolveScrollTarget = false
    /// Found, not yet scrolled to (`consumePendingScroll()` clears it).
    private var awaitingTargetScroll = false
    /// The brief or nudge the assistant thread was opened at.
    private let aiNudge: AIAssistantNudge?
    private let logger = Logger(label: "app.pantopus.ios.ChatConversation")

    private var messages: [ChatMessageDTO] = []
    private var pendingByClientId: [String: ChatMessageDTO] = [:]
    /// Rows whose first appearance is timed (`ChatPerformance`): a send's
    /// sending bubble (true) or a live incoming message (false).
    @ObservationIgnored private var awaitingFirstRender: [String: Bool] = [:]
    /// Messages this person may edit or delete, derived once per rebuild:
    /// every bubble asks on every render, and a scan per bubble made a long
    /// thread's render quadratic.
    @ObservationIgnored private var manageableMessageIds: Set<String> = []
    /// The text a send just took from the composer, and when. The field can
    /// still hold it for a moment after the composer clears; a keystroke in
    /// that moment must not bring the sent text back.
    @ObservationIgnored private var sentComposerText: (text: String, at: Date)?
    /// The picked photos of photo messages still sending, by client id: their
    /// bubbles show the in-memory previews (`ChatPhotoPreviews`).
    @ObservationIgnored private var pendingPhotoIds: [String: [String]] = [:]
    /// Older pages applied to the timeline so far; the view keeps the reader's
    /// place on the layout that adds one above the viewport.
    @ObservationIgnored public private(set) var olderPagesApplied = 0
    private var failedClientIds: Set<String> = []
    /// Failed sends the server refused with a 403 (blocked, not a
    /// participant, the account can't message). They show "Not sent"
    /// with no Retry, since resending cannot succeed.
    private var refusedClientIds: Set<String> = []
    private var activeRoomIds: Set<String> = []
    private var historyAccessRefused = false
    private var joinedRoomIds: Set<String> = []
    private var joiningRooms: [String: Task<Void, Never>] = [:]
    private var roomSubscriptionIds: [String: String] = [:]
    private var roomJoinRetryAt: [String: Date] = [:]
    private var roomJoinAttempts: [String: Int] = [:]
    private var roomJoinGeneration = 0
    private let roomJoinAccountSession = AuthManager.shared.requestSessionGeneration
    private var refusedRoomJoins: Set<String> = []
    private var roomJoinWakeTask: Task<Void, Never>?
    private var lastJoinRecoveryAt = Date.distantPast

    /// Membership ACKs subscribe only; canonical history/delta owns recovery.
    /// Ignore the legacy backfill array instead of decoding hundreds of unused rows.
    private struct RoomSubscriptionAck: Decodable {
        let success: Bool?
        let code: String?
        let retryAfterMs: Int?
        let error: String?
    }

    private var hasMore: Bool = false
    private var oldestCursor: String?
    /// A topic change or leaving the screen invalidates every suspended history request.
    private var historyGeneration = 0
    private var historyRequestId: UUID?
    private var historyTouchedIds: Set<String> = []
    private var historyConfirmedAt: Date?
    private var syncCursors: [String: Int64]?
    private var historySaveTask: Task<Void, Never>?
    private var savedHistorySnapshot: ChatThreadMemory?
    private var savedHistoryKey: String?
    private var refreshInProgress = false
    private var fallbackRefreshTask: Task<Void, Never>?
    private var topicsRefreshTask: Task<Void, Never>?
    private var markReadTask: Task<Void, Never>?
    private var visibleReadBoundaries: [String: String] = [:]
    private var scheduledReadBoundaries: [String: String] = [:]
    private var markReadRequestId: UUID?
    private var lastReadBoundaries: [String: String] = [:]
    private var socketTasks: [Task<Void, Never>] = []
    /// Socket-down fallback: checks promptly, backing off to 30 seconds while
    /// the connection is not `.connected`, so the loaded thread keeps
    /// receiving replies. Cancelled on reconnect and teardown. Never
    /// runs for the AI thread (its messages are local-only).
    private var fallbackPollTask: Task<Void, Never>?
    /// Auto-clears `isCounterpartyTyping` ~5s after the last typing event.
    private var typingClearTask: Task<Void, Never>?
    /// Last `typing:start` emit — throttles outgoing typing signals to
    /// one per 3s, refreshing before the recipient's 5s expiry while
    /// leaving room for stops within the backend's 30/min typing budget.
    private var lastTypingEmitAt: Date?
    /// Whether we owe the room a `typing:stop` (a start was emitted).
    private var didEmitTypingStart = false
    /// True while `composerText` is being seeded programmatically
    /// (edit seeding, edit-failure restore, capability-chip taps).
    /// Suppresses the typing emitter so only real keystrokes broadcast
    /// `typing:start` to the room.
    private var isProgrammaticComposerWrite = false
    /// Photos sent to the assistant, by the message that carried them: copies on the phone,
    /// because the server deletes each photo once it has read it and its reference never loads.
    private var aiSentPhotos: [String: [URL]] = [:]
    /// PDFs sent to the assistant, by the message that carried them: a chip
    /// each in its bubble. Only their names and sizes are kept.
    private var aiSentFiles: [String: [ChatSentFile]] = [:]
    /// Where those copies are kept. It goes with "New chat", with the view-model, and at the next launch.
    private let aiPhotoFolder = ChatMediaURL.sentPhotosRoot.appendingPathComponent(UUID().uuidString, isDirectory: true)
    /// In-flight AI reply stream, held so the composer's stop button can
    /// cancel it mid-generation.
    private var aiStreamTask: Task<Void, Never>?
    private var aiConversationId: String?
    private var aiDraftsByMessageId: [String: [ChatAIDraftCard]] = [:]
    private var aiLinksByMessageId: [String: [ChatAILink]] = [:]
    private let actionDoneStore: AIActionDoneStore
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
    private var outboxTask: Task<Void, Never>?
    private var outboxIds: Set<String> = []
    private var outboxNotice: String?
    private var usesDurableOutbox: Bool {
        api === APIClient.shared && mode != .ai
    }

    /// Inputs needed to (re)send one optimistic message. Captured at
    /// send time so retry doesn't re-read mutated composer state.
    private struct PendingSendContext {
        let text: String
        /// Original bytes and queue identities belong to this send,
        /// even when a newer draft changes the composer before retry.
        let attachments: [ChatQueuedAttachment]
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
        var draft: ChatComposerDraft?
        var replyRoomId: String?
        var sendRoomId: String?
    }

    private var draftId = UUID().uuidString.lowercased()
    private var draftMutation = 0
    private var hasRestoredDraft = false
    private var isRestoringDraft = false
    private var draftSaveTask: Task<Void, Never>?

    private enum ChatSendError: Error {
        case noRoom
    }

    init(
        mode: ChatThreadMode,
        counterparty: ChatCounterparty,
        currentUserId: String,
        initialComposerText: String = "",
        scrollToMessageId: String? = nil,
        initialTopic: ChatInitialTopic? = nil,
        gigId: String? = nil,
        asBusinessUserId: String? = nil,
        api: APIClient = .shared,
        socket: SocketClient = .shared,
        uploader: MultipartUploader = .shared,
        aiClient: any AIChatStreaming = AIChatStreamClient.shared,
        aiConversationStore: AIConversationStore = .shared,
        aiTopic: AIAskTopic? = nil,
        aiNudge: AIAssistantNudge? = nil,
        actionDoneStore: AIActionDoneStore = .shared,
        locationProvider: any LocationProviding = DeviceLocationProvider.shared,
        activeThreadTracker: ActiveChatThreadTracker = .shared
    ) {
        self.mode = mode
        self.counterparty = counterparty
        self.currentUserId = currentUserId
        if case .room = mode {
            self.asBusinessUserId = asBusinessUserId
        } else {
            self.asBusinessUserId = nil
        }
        composerText = initialComposerText
        self.initialTopic = initialTopic
        let nudge: AIAssistantNudge? = if case .ai = mode { aiNudge } else { nil }
        self.aiNudge = nudge
        self.scrollToMessageId = scrollToMessageId ?? nudge?.notificationId
        self.gigId = gigId
        self.api = api
        store = ScreenStore.store(for: api)
        self.socket = socket
        self.uploader = uploader
        self.aiClient = aiClient
        self.aiConversationStore = aiConversationStore
        self.actionDoneStore = actionDoneStore
        self.locationProvider = locationProvider
        self.activeThreadTracker = activeThreadTracker
        let topic: AIAskTopic? = if case .ai = mode { aiTopic } else { nil }
        self.aiTopic = topic
        aiPrompts = topic?.starterChips ?? Self.launchAICapabilities
        emptyChips = Self.launchEmptyChips
        // Continue the user's existing AI conversation across thread
        // opens within this app session, from Messages or an Ask on a
        // screen alike (as on Android). A thread opened at a nudge
        // continues the nudge's conversation.
        if case .ai = mode, nudge == nil {
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
        asBusinessUserId = nil
        scrollToMessageId = nil
        aiNudge = nil
        initialTopic = nil
        gigId = nil
        api = .shared
        store = .shared
        socket = .shared
        uploader = .shared
        aiClient = AIChatStreamClient.shared
        aiConversationStore = .shared
        actionDoneStore = .shared
        locationProvider = DeviceLocationProvider.shared
        activeThreadTracker = .shared
        aiPrompts = Self.launchAICapabilities
        aiTopic = nil
        emptyChips = Self.launchEmptyChips
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

    /// The copies of photos sent to the assistant go with the view-model (their folder is a constant).
    deinit {
        try? FileManager.default.removeItem(at: aiPhotoFolder)
    }

    // MARK: - Public API

    public func load() async {
        ChatPerformance.signposter.emitEvent("ThreadLoad")
        observeOutbox()
        await restoreComposerDraft()
        if case .loaded = state {
            // Back on screen after `teardown()` (a pushed screen, a tab
            // switch): listen again and catch up on what arrived meanwhile.
            if socketTasks.isEmpty {
                subscribeToSockets()
                await refresh()
            }
            return
        }
        await restoreAIConversationIfNeeded()
        // Reopening a thread seen earlier this session: its messages at once,
        // then the newest page merged in quietly.
        let recalled = await recallThread()
        guard !Task.isCancelled else { return }
        if recalled { ChatPerformance.mark("ThreadCached", rows: messages.count) }
        await loadTopicsIfNeeded()
        await fetch(recalled ? .merge : .reload)
        subscribeToSockets()
        prefetchDirectRoomIfNeeded()
        loadGigContextIfNeeded()
    }

    private var draftThreadKey: String? {
        switch mode {
        case let .person(id): "person|\(id)|\(asBusinessUserId ?? "")"
        case let .room(id): "room|\(id)|\(asBusinessUserId ?? "")"
        case .ai: nil
        }
    }

    private func composerDraft() -> ChatComposerDraft? {
        guard let thread = draftThreadKey else { return nil }
        return ChatComposerDraft(
            id: draftId,
            threadKey: thread,
            text: composerText,
            reply: replyingTo,
            editingMessageId: editingMessageId,
            topicId: selectedTopicId,
            updatedAt: Date(),
            attachments: queuedAttachments.filter { $0.data != nil }.map(ChatOutboxAttachment.init)
        )
    }

    private func scheduleDraftSave(immediate: Bool = false) {
        guard usesDurableOutbox, !isRestoringDraft,
              case let .signedIn(user) = AuthManager.shared.state, user.id == currentUserId else { return }
        draftMutation += 1
        draftSaveTask?.cancel()
        guard !isSending, let draft = composerDraft() else { return }
        let attachments = queuedAttachments.filter { $0.data != nil }
        let storage = ChatLocalStore.shared
        let reservation = storage.reserveDraft(draft.id)
        let version = storage.sessionVersion
        let scope = ChatLocalStore.scope(server: api.apiBaseURL.absoluteString, account: currentUserId)
        draftSaveTask = Task { [weak self] in
            do {
                if !immediate { try await Task.sleep(nanoseconds: 150_000_000) }
                try Task.checkCancellation()
                try await storage.saveDraft(draft, attachments: attachments, reservation: reservation, scope: scope, version: version)
            } catch is CancellationError {
                return
            } catch {
                guard let self, storage.sessionVersion == version else { return }
                actionFailure = "Couldn't save this draft on your device. \(error.localizedDescription)"
            }
        }
    }

    private func restoreComposerDraft() async {
        guard usesDurableOutbox, !hasRestoredDraft, let thread = draftThreadKey else { return }
        hasRestoredDraft = true
        let mutation = draftMutation
        let version = ChatLocalStore.shared.sessionVersion
        do {
            guard let (draft, attachments) = try await ChatOutbox.shared.restoreComposer(thread: thread, expectedAccount: currentUserId),
                  draftMutation == mutation, ChatLocalStore.shared.sessionVersion == version, !Task.isCancelled,
                  composerText.isEmpty, queuedAttachments.isEmpty, replyingTo == nil, editingMessageId == nil else { return }
            isRestoringDraft = true
            defer { isRestoringDraft = false }
            draftId = draft.id
            setComposerTextSilently(draft.text)
            queuedAttachments = attachments
            replyingTo = draft.reply
            editingMessageId = draft.editingMessageId
            selectedTopicId = draft.topicId
        } catch is CancellationError {
            return
        } catch {
            guard ChatLocalStore.shared.sessionVersion == version else { return }
            actionFailure = "Couldn't restore this draft. Reopen the conversation to try again."
            hasRestoredDraft = false
        }
    }

    /// Restore the most recent Ask-Pantopus conversation across app
    /// relaunches: `GET /api/ai/conversations` returns summaries ordered
    /// newest-updated first, and `POST /api/ai/chat` resumes server-side
    /// state when handed that conversation id. Its earlier turns are shown
    /// too, so the assistant never refers to something the person can't
    /// see. When the session store already holds an id (a same-session
    /// reopen), only that conversation's turns are read. A thread opened
    /// with Ask on a screen continues the same conversation and shows it
    /// too, so closing the sheet never loses what was said; its starters
    /// stay in the welcome card at the top of the thread.
    private func restoreAIConversationIfNeeded() async {
        guard case .ai = mode else { return }
        if let aiNudge {
            await openAINudge(aiNudge)
            return
        }
        // Reopened this session (from Messages or an Ask on a screen): show
        // the conversation it continues, as a relaunch does.
        if let aiConversationId {
            await loadAIHistory(conversationId: aiConversationId)
            return
        }
        guard !aiConversationStore.didStartFresh(forUserId: currentUserId) else { return }
        do {
            let response: AIConversationsResponse = try await api.request(AIEndpoints.conversations())
            // A message sent meanwhile already has its conversation.
            guard let latest = response.conversations.first, aiConversationId == nil else { return }
            aiConversationId = latest.id
            aiConversationStore.setConversationId(latest.id, forUserId: currentUserId)
            await loadAIHistory(conversationId: latest.id)
        } catch {
            // Non-fatal — the thread simply starts a fresh conversation.
            logger.warning("AI conversation restore failed: \(error)")
        }
    }

    /// A brief's or nudge's push or row: the conversation it went into (the
    /// one its metadata names, else the newest, which a nudge is added to),
    /// shown with its turns and opened at the nudge's message. The person
    /// carries on in that conversation, so "move it to Sunday" after a
    /// weather nudge reaches the plan it was about.
    private func openAINudge(_ nudge: AIAssistantNudge) async {
        let shown = await showNudgeConversation(nudge)
        if !shown {
            // Offline or a server error: say so, rather than show an empty thread.
            actionFailure = "Couldn\u{2019}t load this conversation. Check your connection, then open it again."
        }
        // Not found (gone, or another conversation): the thread opens at its latest message.
        if scrollToMessageId == nudge.notificationId, !didResolveScrollTarget {
            didResolveScrollTarget = true
            rebuild()
        }
    }

    /// Shows the conversation a brief or nudge went into; when the one it names is gone
    /// (deleted), the newest. False when it couldn't be read.
    private func showNudgeConversation(_ nudge: AIAssistantNudge) async -> Bool {
        do {
            var named = nudge.conversationId
            if named == nil { named = try await newestAIConversationId() }
            // A message sent meanwhile already has its conversation.
            guard let conversationId = named, aiConversationId == nil else { return true }
            switch await continueAIConversation(conversationId) {
            case .read: return true
            case .failed: return false
            case .missing:
                guard nudge.conversationId != nil, aiConversationId == conversationId,
                      let newest = try await newestAIConversationId(), newest != conversationId else { return true }
                aiConversationId = nil
                return await continueAIConversation(newest) != .failed
            }
        } catch {
            logger.warning("AI conversations unavailable: \(error)")
            return false
        }
    }

    /// The person's newest assistant conversation (`GET /api/ai/conversations`
    /// lists them newest-updated first), nil when there is none.
    private func newestAIConversationId() async throws -> String? {
        let response: AIConversationsResponse = try await api.request(AIEndpoints.conversations())
        return response.conversations.first?.id
    }

    /// Carries on in `conversationId`, showing its turns.
    @discardableResult
    private func continueAIConversation(_ conversationId: String) async -> AIHistoryLoad {
        aiConversationId = conversationId
        aiConversationStore.setConversationId(conversationId, forUserId: currentUserId)
        return await loadAIHistory(conversationId: conversationId)
    }

    /// Seed the thread with a restored conversation's turns
    /// (`GET /api/ai/conversations/:id/messages`). A draft and the note
    /// after it share one reply, as they did when it streamed. A server
    /// without the route (404) leaves the thread empty, as before.
    @discardableResult
    private func loadAIHistory(conversationId: String) async -> AIHistoryLoad {
        guard messages.isEmpty else { return .read }
        do {
            let history: AIConversationMessagesResponse = try await api.request(
                AIEndpoints.conversationMessages(id: conversationId, cards: AIChatStreamRequest.supportedCards)
            )
            // A message sent (or "New chat") while this loaded wins.
            guard messages.isEmpty, aiConversationId == conversationId else { return .read }
            var restored: [ChatMessageDTO] = []
            var drafts: [String: [ChatAIDraftCard]] = [:]
            var links: [String: [ChatAILink]] = [:]
            var openReplyId: String?
            // The open reply already shows a brief's or nudge's line, so a later line starts its own.
            var openReplyHasText = false
            var nudgeMessageId: String?
            for (index, item) in history.messages.enumerated() {
                let id = "ai_history_\(index)"
                if item.role == "user" {
                    openReplyId = nil
                    let shown = Self.sentText(item.text ?? "", photos: item.photos ?? 0, documents: item.documents ?? 0)
                    restored.append(localMessage(id: id, text: shown, userId: currentUserId, type: "text", createdAt: item.at))
                    continue
                }
                // A brief or nudge starts its own reply, and its cards join it.
                if item.nudge != nil { openReplyId = nil }
                var replyId = openReplyId ?? id
                if let draft = item.draft {
                    if openReplyId == nil {
                        restored.append(localMessage(id: replyId, text: "", userId: "ai", type: "ai_reply", createdAt: item.at))
                        openReplyId = replyId
                        openReplyHasText = false
                    }
                    let object: [String: Any] = [
                        "type": draft.type,
                        "valid": true,
                        "draft": draft.draft.mapValues { AIChatStreamClient.foundationValue($0) }
                    ]
                    if let card = AIChatStreamClient.parseDraft(object).flatMap({ withSavedState($0) }) {
                        drafts[replyId, default: []].append(card)
                    }
                } else if let text = item.text, !text.isEmpty {
                    if let open = openReplyId, !openReplyHasText, let at = restored.firstIndex(where: { $0.id == open }) {
                        restored[at] = localMessage(id: open, text: text, userId: "ai", type: "ai_reply", createdAt: item.at)
                        openReplyId = nil
                    } else {
                        replyId = id
                        restored.append(localMessage(id: id, text: text, userId: "ai", type: "ai_reply", createdAt: item.at))
                        openReplyId = item.nudge != nil ? id : nil
                        openReplyHasText = item.nudge != nil
                    }
                }
                // A reply's link buttons stay under it after a relaunch.
                let itemLinks: [AIChatLinkDTO] = (item.links ?? []).filter { !$0.label.isEmpty && !$0.url.isEmpty }
                var target: String? = replyId
                if !restored.contains(where: { $0.id == replyId }) {
                    target = restored.last { $0.messageType == "ai_reply" }?.id
                }
                if !itemLinks.isEmpty, let target {
                    links[target, default: []] += itemLinks.map { ChatAILink(label: $0.label, url: $0.url) }
                }
                // The first reply carrying the nudge the thread was opened at.
                if nudgeMessageId == nil, let nudge = aiNudge, item.nudge?.id.lowercased() == nudge.notificationId,
                   let target {
                    nudgeMessageId = target
                }
            }
            messages = restored
            aiDraftsByMessageId = drafts
            aiLinksByMessageId = links
            if aiNudge != nil, !didResolveScrollTarget {
                if let nudgeMessageId {
                    scrollToMessageId = nudgeMessageId
                } else {
                    // Not in this conversation: the thread opens at its latest message.
                    didResolveScrollTarget = true
                }
            }
            rebuild()
            return .read
        } catch APIError.notFound {
            return .missing
        } catch {
            logger.warning("AI conversation history unavailable: \(error)")
            return .failed
        }
    }

    /// A restored message of the person's: their words, or a line for the
    /// photos and PDFs they sent alone ("Sent a photo and a document").
    static func sentText(_ text: String, photos: Int, documents: Int) -> String {
        guard text.isEmpty else { return text }
        var sent: [String] = []
        if photos > 0 { sent.append(photos == 1 ? "a photo" : "\(photos) photos") }
        if documents > 0 { sent.append(documents == 1 ? "a document" : "\(documents) documents") }
        return sent.isEmpty ? text : "Sent " + sent.joined(separator: " and ")
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

    public func refresh(retryRoomSubscriptions: Bool = false) async {
        if retryRoomSubscriptions {
            refusedRoomJoins.removeAll()
            roomJoinRetryAt.removeAll()
            joinActiveRoomsIfPossible()
        }
        guard !refreshInProgress else { return }
        refreshInProgress = true
        ChatPerformance.signposter.emitEvent("RefreshStart")
        defer {
            refreshInProgress = false
            ChatPerformance.mark("RefreshDone", rows: messages.count)
        }
        let generation = historyGeneration
        await loadTopicsIfNeeded()
        guard generation == historyGeneration, !Task.isCancelled else { return }
        if isViewingSearchContext {
            didResolveScrollTarget = false
            await fetch(.reload)
            return
        }
        if case .error = state {
            await fetch(.reload)
        } else {
            await fetch(.merge)
        }
    }

    /// Incomplete legacy events and reconnects share one recovery request.
    private func scheduleFallbackRefresh() {
        guard fallbackRefreshTask == nil else { return }
        fallbackRefreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard let self, !Task.isCancelled else { return }
            await refresh()
            fallbackRefreshTask = nil
        }
    }

    public func selectTopic(_ topicId: String?) async {
        rememberThread()
        isViewingSearchContext = false
        scrollToMessageId = nil
        selectedTopicId = selectedTopicId == topicId ? nil : topicId
        sendLimitNotice = nil
        await returnToLatest()
    }

    public func returnToLatest() async {
        isViewingSearchContext = false
        scrollToMessageId = nil
        didResolveScrollTarget = false
        awaitingTargetScroll = false
        pendingScrollTargetId = nil
        await fetch(.reload, recallOnReload: true)
        pendingScrollTargetId = "chat_bottom_anchor"
    }

    /// Sending never waits for network history. Recover the latest encrypted
    /// window locally, then let durable enqueue and normal refresh proceed.
    private func prepareLatestForSend() async {
        isViewingSearchContext = false
        scrollToMessageId = nil
        didResolveScrollTarget = false
        awaitingTargetScroll = false
        _ = await prepareHistoryReload(recall: true)
        rebuild()
        pendingScrollTargetId = "chat_bottom_anchor"
        scheduleFallbackRefresh()
    }

    /// Dismiss the send notice banner.
    public func dismissSendLimitNotice() {
        sendLimitNotice = nil
    }

    /// Scroll-to-top trigger — fetch the next older page.
    public func loadOlder() async {
        guard hasMore, let cursor = oldestCursor else { return }
        let interval = ChatPerformance.signposter.beginInterval("OlderPage")
        await fetch(.older(cursor: cursor))
        ChatPerformance.end("OlderPage", interval, rows: messages.count)
    }

    /// Send the current composer text. Optimistic — prepends a row
    /// with a client-side id; on success swaps to the server id, on
    /// failure marks the row as failed for the view's retry CTA.
    public func send() async {
        let hasQueuedFiles = queuedAttachments.contains { $0.data != nil }
        guard roomClosedNote == nil, !isSending, !isDeletingAIConversation, canSend || hasQueuedFiles else { return }
        ChatPerformance.signposter.emitEvent("SendTap")
        let sendSession = AuthManager.shared.requestSessionGeneration
        let trimmed = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        let capturedAttachments = queuedAttachments
        let capturedReply = replyingTo
        let capturedReplyRoom = capturedReply?.roomId ?? messages.first { $0.id == capturedReply?.messageId }?.roomId
        let capturedTopic = selectedTopicId
        let capturedEdit = editingMessageId
        let capturedMutation = draftMutation
        isSending = true
        defer {
            isSending = false
            scheduleDraftSave()
        }
        var replyDestination: String?
        if capturedReply != nil, capturedEdit == nil {
            guard let room = await prepareReplySend(roomId: capturedReplyRoom, mutation: capturedMutation, session: sendSession)
            else { return }
            replyDestination = room
        }
        let consumedDraft = usesDurableOutbox && editingMessageId == nil ? composerDraft() : nil
        if consumedDraft != nil { draftId = Self.newClientMessageId() }
        sentComposerText = composerText.isEmpty ? nil : (composerText, Date())
        composerText = ""
        if capturedEdit == nil { replyingTo = nil }
        let clearedMutation = draftMutation
        if isViewingSearchContext || isViewingEarlierHistory, capturedEdit == nil { await prepareLatestForSend() }
        guard api !== APIClient.shared || sendSession == AuthManager.shared.requestSessionGeneration else { return }

        if let capturedEdit {
            do {
                let response: SendChatMessageResponse = try await api.request(
                    ChatEndpoints.editMessage(
                        id: capturedEdit,
                        body: EditChatMessageBody(messageText: trimmed)
                    )
                )
                applyUpdatedMessage(response.message)
                if draftMutation == clearedMutation, editingMessageId == capturedEdit { cancelMessageAction() }
            } catch {
                if draftMutation == clearedMutation, editingMessageId == capturedEdit, composerText.isEmpty {
                    setComposerTextSilently(trimmed)
                }
                actionFailure = "Couldn\u{2019}t save your edit. Try again."
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

        let clientId = consumedDraft?.id ?? Self.newClientMessageId()
        let pending = optimisticMessage(
            text: trimmed.isEmpty ? "Attachment" : trimmed,
            clientId: clientId,
            roomId: replyDestination ?? knownRoomIdHint()
        )
        pendingByClientId[clientId] = pending
        awaitFirstRender(pending.id, isSend: true)
        sendContextsByClientId[clientId] = PendingSendContext(
            text: trimmed,
            attachments: capturedAttachments,
            fileIds: nil,
            replyToId: capturedReply?.messageId,
            topicId: capturedTopic,
            messageType: nil,
            metadata: nil,
            draft: consumedDraft,
            replyRoomId: capturedReplyRoom,
            sendRoomId: replyDestination
        )
        rememberPendingPhotos(capturedAttachments, clientId: clientId)
        // The sending bubble and retry keep the immutable captured reply.
        rebuild()
        if usesDurableOutbox {
            await enqueuePending(clientId: clientId)
            return
        }
        await performSend(clientId: clientId)
    }

    /// Retry a failed optimistic send. Accepts the timeline row id
    /// (`client_<uuid>`) or the bare client id, and resends with the
    /// same `clientMessageId` — the backend dedups on it, so a retry
    /// after a lost response can't double-post.
    public func retry(clientId rawId: String) async {
        guard roomClosedNote == nil, !isSending else { return }
        let clientId = Self.bareClientId(rawId)
        if usesDurableOutbox, outboxIds.contains(clientId) {
            await ChatOutbox.shared.retry(clientId)
            return
        }
        guard pendingByClientId[clientId] != nil, sendContextsByClientId[clientId] != nil,
              !refusedClientIds.contains(clientId) else { return }
        failedClientIds.remove(clientId)
        isSending = true
        defer { isSending = false }
        rebuild()
        if usesDurableOutbox {
            await enqueuePending(clientId: clientId)
            return
        }
        await performSend(clientId: clientId)
    }

    private func enqueuePending(clientId: String) async {
        guard let context = sendContextsByClientId[clientId], let pending = pendingByClientId[clientId] else { return }
        let destination: ChatOutboxMessage.Destination
        let target: String
        switch mode {
        case let .person(id): destination = .person
            target = id
        case let .room(id): destination = .room
            target = id
        case .ai: return
        }
        ChatOutbox.shared.start(account: currentUserId)
        let attachments = context.attachments.filter { $0.data != nil }
        let message = ChatOutboxMessage(
            id: clientId,
            destination: destination,
            targetId: target,
            businessUserId: asBusinessUserId,
            roomId: context.sendRoomId ?? (knownRoomIdHint().isEmpty ? nil : knownRoomIdHint()),
            text: context.text,
            messageType: context.messageType,
            metadata: context.metadata,
            replyToId: context.replyToId,
            replyRoomId: context.replyRoomId ?? messages.first { $0.id == context.replyToId }?.roomId,
            topicId: context.topicId,
            createdAt: pending.createdAt,
            queuedAt: Date(),
            attachments: attachments.map(ChatOutboxAttachment.init),
            fileIds: context.fileIds
        )
        do {
            try await ChatOutbox.shared.enqueue(message, attachments: attachments, expectedAccount: currentUserId, draft: context.draft)
            let capturedIds = Set(attachments.map(\.id))
            queuedAttachments.removeAll { capturedIds.contains($0.id) }
            sendLimitNotice = nil
            applyOutboxSnapshot()
        } catch {
            failedClientIds.insert(clientId)
            sendLimitNotice = error.localizedDescription
            rebuild()
        }
    }

    private func observeOutbox() {
        guard usesDurableOutbox, outboxTask == nil else { return }
        ChatOutbox.shared.start(account: currentUserId)
        let stream = ChatOutbox.shared.events()
        outboxTask = Task { [weak self] in
            for await event in stream {
                guard let self, !Task.isCancelled else { return }
                if case let .accepted(message) = event, let clientId = message.clientMessageId,
                   pendingByClientId[clientId] != nil {
                    ChatPerformance.signposter.emitEvent("SendAccepted")
                    carryPhotoPreviews(to: message)
                    retireConfirmedSend(clientId: clientId)
                    if case .person = mode { directRoomId = message.roomId }
                    activeRoomIds.insert(message.roomId)
                    activeThreadTracker.setActiveRooms(activeRoomIds, owner: ObjectIdentifier(self), topicId: selectedTopicId)
                    joinActiveRoomsIfPossible()
                    upsert(message, confirmedSend: true)
                    scheduleMarkRead()
                }
                applyOutboxSnapshot()
            }
        }
    }

    private func applyOutboxSnapshot() {
        let before = (pendingByClientId, failedClientIds, refusedClientIds)
        let held = ChatOutbox.shared.messages.filter { message in
            guard message.businessUserId == asBusinessUserId else { return false }
            switch mode {
            case let .person(id): return message.destination == .person && message.targetId == id
            case let .room(id): return message.destination == .room && message.targetId == id
            case .ai: return false
            }
        }
        let heldIds = Set(held.map(\.id))
        for id in outboxIds.subtracting(heldIds) {
            retireConfirmedSend(clientId: id)
        }
        outboxIds = heldIds
        for message in held {
            pendingByClientId[message.id] = ChatMessageDTO(
                id: "client_\(message.id)",
                roomId: message.roomId ?? "",
                userId: sendingIdentityId,
                messageText: message.text.isEmpty ? "Attachment" : message.text,
                messageType: message.messageType ?? "text",
                metadata: message.metadata.map(JSONValue.object),
                replyToId: message.replyToId,
                topicId: message.topicId,
                clientMessageId: message.id,
                createdAt: message.createdAt,
                editedAt: nil,
                deletedAt: nil,
                deliveredAt: nil,
                readAt: nil,
                sender: nil
            )
            sendContextsByClientId[message.id] = PendingSendContext(
                text: message.text,
                attachments: [],
                fileIds: message.fileIds,
                replyToId: message.replyToId,
                topicId: message.topicId,
                messageType: message.messageType,
                metadata: message.metadata,
                replyRoomId: message.replyRoomId,
                sendRoomId: message.roomId
            )
            // A transient failure (offline, timeout) is retried on its own, at
            // once when the socket reconnects: it reads as sending, so nobody
            // types it again. Only a final failure offers Retry.
            if message.status == .queued || message.status == .retrying {
                failedClientIds.remove(message.id)
            } else {
                failedClientIds.insert(message.id)
            }
            if message.status == .refused { refusedClientIds.insert(message.id) } else { refusedClientIds.remove(message.id) }
        }
        let failure = ChatOutbox.shared.restoreFailure ?? held.last { $0.status != .queued }?.failure
        if let failure { sendLimitNotice = failure } else if sendLimitNotice == outboxNotice { sendLimitNotice = nil }
        outboxNotice = failure
        // Most outbox events (saved progress, another thread's send, the
        // first snapshot of an empty queue, a send entering the queue as it
        // is shown) change no row here. Re-rendering the timeline for them
        // delayed the send itself and, before history arrived, flashed the
        // empty "start of your conversation" state.
        guard (pendingByClientId, failedClientIds, refusedClientIds) != before else { return }
        rebuild()
    }

    /// Shared send/retry tail. Resolves the destination room (creating
    /// the direct room on a person thread's first message), uploads the
    /// composer's queued attachments at most once, and POSTs under the
    /// pending row's idempotency key.
    @discardableResult
    private func performSend(clientId: String) async -> Bool {
        guard var context = sendContextsByClientId[clientId] else { return false }
        do {
            let roomId: String = if let selectedRoom = context.sendRoomId { selectedRoom } else { try await ensureRoomId() }
            if context.messageType == nil, context.fileIds == nil {
                context.fileIds = try await uploadQueuedAttachmentsIfNeeded(
                    context.attachments,
                    roomId: roomId,
                    clientId: clientId
                )
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
                        replyToId: context.replyToId,
                        topicId: context.topicId,
                        metadata: context.metadata,
                        asBusinessUserId: asBusinessUserId
                    )
                )
            )
            // Swap optimistic → server message. The socket echo may have
            // landed it via a refetch already, so replace-by-id.
            ChatPerformance.signposter.emitEvent("SendAccepted")
            carryPhotoPreviews(to: response.message)
            retireConfirmedSend(clientId: clientId)
            upsert(response.message, confirmedSend: true)
            sendLimitNotice = nil
            rebuild()
            scheduleMarkRead(for: roomId)
            return true
        } catch {
            if Self.isPreBidLimit(error) {
                // Launch cut #4 (Open gigs): bidding is hidden.
                sendLimitNotice = LaunchFeatures.openGigs
                    ? "Message limit reached — place a bid or wait for acceptance to keep chatting."
                    : "Message limit reached — wait for acceptance to keep chatting."
            } else if Self.isSendRefused(error) {
                // 403: the server refuses this pairing (blocked, not a
                // participant, or the account can't message). Retrying
                // cannot succeed: show the server's reason and mark the
                // row "Not sent" without a Retry.
                sendLimitNotice = Self.sendRefusedNotice(error)
                refusedClientIds.insert(clientId)
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
    /// A 403 refusal of the send itself (`chats.js` "Unable to message this
    /// user" / "Not a participant" / "cannot send messages").
    private static func isSendRefused(_ error: any Error) -> Bool {
        if case APIError.forbidden = error { return true }
        if case let APIError.clientError(status, _) = error, status == 403 { return true }
        return false
    }

    /// The server's own sentence for a refused send ("Unable to message
    /// this user"), or a plain fallback when the 403 carried none.
    private static func sendRefusedNotice(_ error: any Error) -> String {
        if case let APIError.forbidden(message?) = error { return message }
        return "You can't send messages in this conversation."
    }

    private static func isPreBidLimit(_ error: any Error) -> Bool {
        guard case let APIError.clientError(status, message) = error else { return false }
        return status == 429 && (message?.contains("PRE_BID_LIMIT") ?? false)
    }

    /// Insert a persisted message, replacing any copy that already
    /// arrived through a socket-triggered refetch.
    private func upsert(_ message: ChatMessageDTO, confirmedSend: Bool = false) {
        guard !historyAccessRefused else { return }
        if confirmedSend, isViewingSearchContext || isViewingEarlierHistory,
           !messages.contains(where: { $0.id == message.id }) {
            // A queued send may finish after the user paged backwards. Keep its
            // accepted row visible and recover latest history without a gap.
            isViewingSearchContext = false
            isViewingEarlierHistory = false
            earlierHistoryBefore = nil
            scrollToMessageId = nil
            didResolveScrollTarget = false
            awaitingTargetScroll = false
            hasLatestHistoryWindow = false
            historyGeneration += 1
            historyRequestId = nil
            messages = []
            oldestCursor = nil
            hasMore = false
            syncCursors = nil
            setVisibleReadBoundaries([])
            pendingScrollTargetId = "chat_bottom_anchor"
            scheduleFallbackRefresh()
        }
        guard acceptsMessageInWindow(message) else { return }
        historyTouchedIds.insert(message.id)
        guard selectedTopicId == nil || message.topicId == selectedTopicId else { return }
        if let index = messages.firstIndex(where: { $0.id == message.id }) {
            if message.readAt == nil, let knownRead = messages[index].readAt {
                messages[index] = message.replacingReadAt(knownRead)
            } else {
                messages[index] = message
            }
        } else {
            messages.append(message)
        }
        messages.sort(by: Self.messagePrecedes)
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

    private func validatedReplyRoom(_ roomId: String?, allowOfflineIntent: Bool = false) async throws -> String {
        guard let roomId else { throw ChatReplyScopeError.differentAudience }
        switch mode {
        case let .room(destination):
            guard destination == roomId else { throw ChatReplyScopeError.differentAudience }
        case let .person(peerId):
            do {
                let detail: ChatRoomDetailResponse = try await api.request(
                    ChatEndpoints.room(roomId: roomId, asBusinessUserId: asBusinessUserId),
                    expectedSessionGeneration: roomJoinAccountSession
                )
                guard detail.hasCompleteReplyAudience else { throw ChatReplyScopeError.unverifiedAudience }
                guard detail.isDirectConversation(senderId: sendingIdentityId, peerId: peerId) else {
                    throw ChatReplyScopeError.differentAudience
                }
            } catch {
                // Offline Send still records the exact reply intent. The durable
                // worker must validate it online before uploading any media.
                var unavailable = (error as? APIError)?.isTransient == true || (error as? URLError).map { $0.code != .cancelled } == true
                if case APIError.retriesExhausted = error { unavailable = true }
                guard allowOfflineIntent, unavailable, !Task.isCancelled else { throw error }
            }
        case .ai: throw ChatReplyScopeError.differentAudience
        }
        return roomId
    }

    private func prepareReplySend(roomId: String?, mutation: Int, session: Int) async -> String? {
        do {
            let room = try await validatedReplyRoom(roomId, allowOfflineIntent: usesDurableOutbox)
            guard api !== APIClient.shared || session == AuthManager.shared.requestSessionGeneration else { return nil }
            guard draftMutation == mutation else {
                actionFailure = "Your draft changed while checking the reply. Tap Send again when you're ready."
                return nil
            }
            return room
        } catch {
            guard api !== APIClient.shared || session == AuthManager.shared.requestSessionGeneration else { return nil }
            actionFailure = error is ChatReplyScopeError
                ? error.localizedDescription
                : "Couldn't check this reply's conversation. Your draft is saved. Reconnect and try again."
            return nil
        }
    }

    /// A message to the assistant with the photos and PDFs it sends, uploaded.
    private struct AIOutgoing {
        let message: ChatMessageDTO
        /// The uploads' private references, for the chat's `images`.
        let references: [String]
        /// PDFs and no photos: the question without words asks about the document.
        let documentsOnly: Bool
        /// The composer's files as they were sent, given back if the reply fails before it starts.
        let files: [ChatQueuedAttachment]
    }

    /// The person's message, its photos and PDFs uploaded first: nil when the
    /// upload failed. Then nothing went, and the composer keeps the words and
    /// the files for another try, except a file the server refused: that one
    /// leaves, and the server's reason stays above the composer.
    private func outgoingAIMessage(_ text: String) async -> AIOutgoing? {
        // What the upload sends, taken before it starts.
        let files = queuedAttachments
        let photos = files.compactMap { $0.mimeType.hasPrefix("image/") ? $0.data : nil }
        let documents = files.filter { $0.mimeType == Self.pdfMimeType && $0.data != nil }
        let references: [String]
        do {
            references = try await uploadAIMedia(files)
        } catch {
            if composerText.isEmpty { setComposerTextSilently(text) }
            if let refusal = Self.aiUploadRefusal(error) {
                // Sent again, it would be refused again: it leaves the queue. A toast would be
                // gone before the reason is read.
                if let refused = Self.refusedAIFile(refusal, among: files) {
                    queuedAttachments.removeAll { $0.id == refused.id }
                }
                sendLimitNotice = refusal.message
            } else {
                actionFailure = Self.aiUploadFailure(error)
            }
            return nil
        }
        let userMessage = localMessage(
            id: "ai_user_\(UUID().uuidString)",
            text: text,
            userId: currentUserId,
            type: "text"
        )
        if !photos.isEmpty, !references.isEmpty {
            aiSentPhotos[userMessage.id] = await Self.sentPhotoCopies(of: photos, in: aiPhotoFolder)
        }
        if !documents.isEmpty, !references.isEmpty {
            aiSentFiles[userMessage.id] = documents.map {
                ChatSentFile(name: $0.filename, sizeLabel: Self.fileSizeLabel($0.data?.count))
            }
        }
        return AIOutgoing(
            message: userMessage,
            references: references,
            documentsOnly: photos.isEmpty && !documents.isEmpty,
            files: files
        )
    }

    private func sendAIMessage(_ text: String) async {
        // A refusal shown for the last Send.
        sendLimitNotice = nil
        guard let outgoing = await outgoingAIMessage(text) else { return }
        let userMessage = outgoing.message
        let references = outgoing.references
        let files = outgoing.files
        let assistantId = "ai_assistant_\(UUID().uuidString)"
        let assistantMessage = localMessage(id: assistantId, text: "", userId: "ai", type: "ai_reply")
        messages.append(userMessage)
        messages.append(assistantMessage)
        // Files picked while the upload ran stay.
        queuedAttachments.removeAll { sent in files.contains { $0.id == sent.id } }
        rebuild()

        let request = AIChatStreamRequest(
            message: text.isEmpty
                ? (outgoing.documentsOnly ? "What can you tell me about this document?" : "What can you tell me about this image?")
                : text,
            conversationId: aiConversationId,
            // PDF references go with the photos' (phase 2 contract §7.1).
            images: references.isEmpty ? nil : references,
            // Every message of a thread opened from a screen says which screen.
            context: aiTopic?.context
        )
        // The stream is consumed in a stored Task so the composer's stop
        // button (A15.3) can cancel it mid-generation via
        // `cancelAIStream()`; partial text already rendered is kept.
        isAIStreaming = true
        let task = Task { [weak self] in
            var streamedText = ""
            // A turn ends with `done` or an `error`; a stream that just stops was cut off
            // (the server went away mid-turn).
            var ended = false
            guard let client = self?.aiClient else { return }
            do {
                for try await event in client.streamChat(request) {
                    guard let self else { return }
                    switch event {
                    case let .conversation(id):
                        // A reply cancelled by "New chat" must not bring its conversation back.
                        guard !Task.isCancelled else { break }
                        aiConversationId = id
                        aiConversationStore.setConversationId(id, forUserId: currentUserId)
                    case let .status(message):
                        aiStatus = message
                    case let .textDelta(delta):
                        aiStatus = nil
                        streamedText += delta
                        replaceLocalMessage(id: assistantId, text: streamedText, type: "ai_reply", userId: "ai")
                    case let .draft(draft):
                        aiStatus = nil
                        if let card = withSavedState(draft) {
                            aiDraftsByMessageId[assistantId, default: []].append(card)
                        }
                        rebuild()
                    case let .link(link):
                        aiLinksByMessageId[assistantId, default: []].append(link)
                        rebuild()
                    case let .error(message):
                        ended = true
                        aiStatus = nil
                        if !Task.isCancelled { giveBackIfUnanswered(assistantId: assistantId, text: text, files: files) }
                        replaceLocalMessage(id: assistantId, text: message, type: "ai_reply", userId: "ai")
                    case .done:
                        ended = true
                        aiStatus = nil
                    }
                }
                if !ended { throw URLError(.networkConnectionLost) }
            } catch {
                if !Task.isCancelled {
                    self?.giveBackIfUnanswered(assistantId: assistantId, text: text, files: files)
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
        aiStatus = nil
        isAIStreaming = false
    }

    /// A15.3 stop button — cancel the in-flight AI reply stream. Text
    /// that already streamed in stays as the final reply; an empty
    /// placeholder bubble is dropped.
    public func cancelAIStream() {
        aiStreamTask?.cancel()
    }

    /// A15.3 "New chat": stop a reply in progress, clear the thread back to its starter prompts, and
    /// forget the conversation so the next message starts a new one. A message being written stays.
    public func startNewAIConversation() {
        guard case .ai = mode else { return }
        aiStreamTask?.cancel()
        aiConversationId = nil
        aiConversationStore.startFresh(forUserId: currentUserId)
        aiSentPhotos = [:]
        aiSentFiles = [:]
        try? FileManager.default.removeItem(at: aiPhotoFolder)
        messages = []
        aiDraftsByMessageId = [:]
        aiLinksByMessageId = [:]
        rebuild()
    }

    /// A reply that failed before it said anything (no words, card or link): the person's words and
    /// files go back in the composer, so trying again is one tap, and the files upload again then;
    /// the server deletes their old references once read. Words typed in the meantime stay, and
    /// files picked meanwhile follow the given-back ones. As on Android.
    private func giveBackIfUnanswered(assistantId: String, text: String, files: [ChatQueuedAttachment]) {
        let answered = messages.contains { $0.id == assistantId && !($0.messageText ?? "").isEmpty }
            || !(aiDraftsByMessageId[assistantId] ?? []).isEmpty
            || !(aiLinksByMessageId[assistantId] ?? []).isEmpty
        guard !answered else { return }
        if composerText.isEmpty { setComposerTextSilently(text) }
        let picked = queuedAttachments.filter { queued in !files.contains { $0.id == queued.id } }
        queuedAttachments = Array((files + picked).prefix(5))
    }

    private func finalizeCancelledAIStream(assistantId: String, partialText: String) {
        if partialText.isEmpty {
            messages.removeAll { $0.id == assistantId }
            rebuild()
        } else {
            replaceLocalMessage(id: assistantId, text: partialText, type: "ai_reply", userId: "ai")
        }
    }

    /// "Delete conversation" (the header's More menu): every conversation the assistant keeps for this
    /// person goes (`DELETE /api/ai/conversations/:id`), the one on screen and any earlier one "New chat"
    /// or another device left, which the next launch would otherwise show. Each one's cards are read
    /// first, so their records on this phone go with it. Then the thread starts over, as "New chat" does.
    public func deleteAIConversations() async {
        guard case .ai = mode, !isDeletingAIConversation else { return }
        isDeletingAIConversation = true
        defer { isDeletingAIConversation = false }
        aiStreamTask?.cancel()
        var deleted: Set<String> = []
        let activeId = aiConversationId
        var cleared = false
        do {
            // Read oldest first across every page; the displayed thread is deleted only when it is alone.
            for _ in 0..<20 {
                let listed: AIConversationsResponse = try await api.request(AIEndpoints.conversations(oldestFirst: true))
                let onlyActive = listed.conversations.count == 1 && listed.conversations.first?.id == activeId
                let ids = listed.conversations.map(\.id).filter { !deleted.contains($0) && ($0 != activeId || onlyActive) }
                cleared = listed.conversations.isEmpty
                // Done, or listed again after its delete went through.
                if ids.isEmpty { break }
                for id in ids {
                    let cardIds = try await aiActionCardIds(conversationId: id)
                    _ = try await api.request(AIEndpoints.deleteConversation(id: id), as: EmptyResponse.self)
                    actionDoneStore.forget(cardIds: cardIds)
                    deleted.insert(id)
                    // A later verification read may fail; don't retain a thread whose delete succeeded.
                    if id == activeId { startNewAIConversation() }
                }
            }
        } catch {
            logger.warning("AI conversation delete failed: \(error)")
            // The one on screen goes only once it is the last one listed, so after its delete only the check failed.
            if let activeId, deleted.contains(activeId) {
                cleared = true
            } else if case let APIError.clientError(status, _) = error, status == 429 {
                actionFailure = "Couldn\u{2019}t delete it all yet. Try again in a minute."
                return
            }
        }
        guard cleared else {
            actionFailure = "Couldn\u{2019}t delete the conversation. Try again."
            return
        }
        startNewAIConversation()
    }

    /// The action cards in one conversation, by card id; none when it is already gone. The history
    /// read sends the chat's card list, or the server leaves the action cards out.
    private func aiActionCardIds(conversationId: String) async throws -> Set<String> {
        let history: AIConversationMessagesResponse
        do {
            history = try await api.request(
                AIEndpoints.conversationMessages(id: conversationId, cards: AIChatStreamRequest.supportedCards)
            )
        } catch APIError.notFound {
            return []
        }
        var cardIds: Set<String> = []
        for item in history.messages {
            guard let draft = item.draft, draft.type == "action" else { continue }
            let fields: [String: Any] = draft.draft.mapValues { AIChatStreamClient.foundationValue($0) }
            if let cardId = AIChatStreamClient.actionCard(from: fields)?.action?.envelope.id {
                cardIds.insert(cardId)
            }
        }
        return cardIds
    }

    /// Toggle a reaction on a message. The request carries the state the
    /// tap asks for, so a retry after a lost reply keeps the reaction
    /// instead of undoing it.
    public func react(messageId: String, reaction: String) async {
        let reacted = messages.first { $0.id == messageId }.map { message in
            !message.reactions.contains { $0.reaction == reaction && $0.includes(currentUserId) }
        }
        do {
            let response: ReactToChatMessageResponse = try await api.request(
                ChatEndpoints.reactToMessage(id: messageId, reaction: reaction, reacted: reacted),
                as: ReactToChatMessageResponse.self
            )
            if let reactions = response.reactions {
                applyReactions(reactions, to: messageId)
            }
        } catch {
            actionFailure = "Couldn\u{2019}t add your reaction. Try again."
            logger.warning("chat react failed: \(error)")
        }
    }

    /// Download a file attachment (a PDF, video, …) and hand it to the
    /// view to preview.
    public func openAttachment(fileURL: String?, filename: String, mimeType: String?) async {
        guard let fileURL, fileURL.contains("/api/chat/files/") else {
            actionFailure = "This file can\u{2019}t be opened."
            return
        }
        guard !isOpeningAttachment else { return }
        isOpeningAttachment = true
        defer { isOpeningAttachment = false }
        do {
            previewFileURL = try await ChatMediaURL.download(raw: fileURL, filename: filename, mimeType: mimeType)
        } catch {
            actionFailure = "Couldn\u{2019}t open the file. Try again."
            logger.warning("chat file download failed: \(error)")
        }
    }

    public func beginReply(to messageId: String) {
        guard let message = combinedMessages().first(where: { $0.id == messageId }) else { return }
        replyingTo = ChatReplyPreview(
            messageId: message.id,
            senderName: Self.replyName(for: message, currentUserId: sendingIdentityId),
            text: message.messageText ?? "",
            roomId: message.roomId
        )
        editingMessageId = nil
    }

    public func beginEdit(messageId: String) {
        guard let message = messages.first(where: { $0.id == messageId }),
              wroteMessage(message),
              let text = message.messageText else { return }
        editingMessageId = messageId
        replyingTo = nil
        setComposerTextSilently(text)
    }

    /// Edit and delete are for the person who wrote a message: their own, or
    /// one they wrote for the business they answer as here. A teammate's
    /// message for the same business stays theirs (the API refuses it).
    public func canManageMessage(_ messageId: String) -> Bool {
        manageableMessageIds.contains(messageId)
    }

    private func wroteMessage(_ message: ChatMessageDTO) -> Bool {
        message.userId == currentUserId
            || (message.userId == sendingIdentityId && message.actorUserId == currentUserId)
    }

    public func canDiscardMessage(_ messageId: String) -> Bool {
        usesDurableOutbox && pendingByClientId[Self.bareClientId(messageId)] != nil
    }

    public func cancelMessageAction() {
        replyingTo = nil
        editingMessageId = nil
    }

    public func delete(messageId: String) async {
        if canDiscardMessage(messageId) {
            let id = Self.bareClientId(messageId)
            await ChatOutbox.shared.discard(id)
            retireConfirmedSend(clientId: id)
            sendLimitNotice = nil
            applyOutboxSnapshot()
            return
        }
        guard canManageMessage(messageId) else { return }
        do {
            _ = try await api.request(ChatEndpoints.deleteMessage(id: messageId), as: EmptyResponse.self)
            historyTouchedIds.insert(messageId)
            messages.removeAll { $0.id == messageId }
            rebuild()
        } catch {
            actionFailure = "Couldn\u{2019}t delete the message. Try again."
            logger.warning("chat delete failed: \(error)")
        }
    }

    /// Delete a batch of own messages by looping the single-message
    /// endpoint (`DELETE /api/chat/messages/:messageId` — no bulk route
    /// exists). Per-id failures are skipped so one bad id doesn't strand
    /// the rest of the selection, then reported once in `actionFailure`.
    public func bulkDelete(ids: [String]) async {
        for id in ids {
            await delete(messageId: id)
        }
        let failed = ids.filter { id in messages.contains { $0.id == id } }.count
        if failed > 1 {
            actionFailure = "Couldn\u{2019}t delete \(failed) messages. Try again."
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

    /// Only accepted messages can establish a read boundary. A person thread
    /// can combine several rooms; each room needs its own visible boundary.
    /// Derived once per rebuild: every render and scrolled frame reads it.
    @ObservationIgnored public private(set) var latestAcceptedMessageIds: Set<String> = []

    private func acceptedReadBoundaries() -> Set<String> {
        var latest: [String: ChatMessageDTO] = [:]
        for message in messages where message.deletedAt == nil && UUID(uuidString: message.id) != nil
            && (selectedTopicId == nil || message.topicId == selectedTopicId) {
            if let previous = latest[message.roomId], !Self.messagePrecedes(previous, message) { continue }
            latest[message.roomId] = message
        }
        return Set(latest.values.map(\.id))
    }

    public func setVisibleReadBoundaries(_ messageIds: Set<String>) {
        let acceptedIds = latestAcceptedMessageIds
        var boundaries: [String: String] = [:]
        for message in messages where messageIds.contains(message.id) && acceptedIds.contains(message.id) {
            guard UUID(uuidString: message.roomId) != nil else { continue }
            boundaries[message.roomId] = message.id
        }
        guard visibleReadBoundaries != boundaries else { return }
        visibleReadBoundaries = boundaries
        markReadTask?.cancel()
        markReadTask = nil
        scheduledReadBoundaries = [:]
        markReadRequestId = nil
        scheduleMarkRead()
    }

    public func scheduleMarkRead() {
        let pending = visibleReadBoundaries.filter { lastReadBoundaries[$0.key] != $0.value }
        var boundaries: [String: String] = [:]
        for roomId in pending.keys.sorted().prefix(500) {
            boundaries[roomId] = pending[roomId]
        }
        guard !boundaries.isEmpty, boundaries != scheduledReadBoundaries else { return }
        markReadTask?.cancel()
        scheduledReadBoundaries = boundaries
        let requestId = UUID()
        markReadRequestId = requestId
        let generation = historyGeneration
        let topicId = selectedTopicId
        markReadTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 600_000_000) } catch { return }
            guard let self else { return }
            await performMarkRead(boundaries: boundaries, generation: generation, topicId: topicId)
            if markReadRequestId == requestId {
                markReadRequestId = nil
                scheduledReadBoundaries = [:]
                markReadTask = nil
                if boundaries.allSatisfy({ lastReadBoundaries[$0.key] == $0.value }) { scheduleMarkRead() }
            }
        }
    }

    public func teardown() {
        resetRoomJoins()
        scheduleDraftSave(immediate: true)
        outboxTask?.cancel()
        outboxTask = nil
        setVisibleReadBoundaries([])
        historyGeneration += 1
        historyRequestId = nil
        fallbackRefreshTask?.cancel()
        fallbackRefreshTask = nil
        topicsRefreshTask?.cancel()
        topicsRefreshTask = nil
        rememberThread()
        emitTypingStopIfNeeded()
        counterpartyOnline = nil
        isCounterpartyTyping = false
        markReadTask?.cancel()
        typingClearTask?.cancel()
        aiStreamTask?.cancel()
        fallbackPollTask?.cancel()
        fallbackPollTask = nil
        socketTasks.forEach { $0.cancel() }
        socketTasks.removeAll()
        activeThreadTracker.clear(owner: ObjectIdentifier(self))
    }

    // MARK: - Pickup-days card

    /// A pickup-days card's Save: the household's days through the pickup
    /// calendar route, as the Today editor saves them. The card shows how it went.
    public func savePickupSchedule(_ card: ChatAIDraftCard) async {
        guard let pickup = card.pickup, pickup.save != .saving, pickup.save != .saved else { return }
        updatePickup(card.id) { $0.save = .saving }
        let request = SetPickupDayRequest(
            weekday: pickup.garbageWeekday,
            recyclingFrequency: pickup.recyclingFrequency,
            recyclingNextDate: pickup.recyclingFrequency == "not_set" ? nil : pickup.recyclingNextDate
        )
        do {
            let _: AddressCalendarResponse = try await api.request(
                AddressCalendarEndpoints.setPickupDay(homeId: pickup.homeId, request: request)
            )
            updatePickup(card.id) { $0.save = .saved }
        } catch let APIError.forbidden(message) {
            updatePickup(card.id) {
                $0.save = .failed(message ?? "You don't have permission to change this household's pickup schedule.")
            }
        } catch {
            updatePickup(card.id) { $0.save = .failed("Couldn't save your pickup days. Try again.") }
        }
    }

    private func updatePickup(_ cardId: String, _ change: (inout ChatAIPickupSchedule) -> Void) {
        guard let messageId = aiDraftsByMessageId.first(where: { $0.value.contains { $0.id == cardId } })?.key else { return }
        aiDraftsByMessageId[messageId] = aiDraftsByMessageId[messageId]?.map { card in
            guard card.id == cardId, var pickup = card.pickup else { return card }
            change(&pickup)
            var updated = card
            updated.pickup = pickup
            return updated
        }
        rebuild()
    }

    // MARK: - Action cards

    /// A card as this device remembers it: taps that went through show as
    /// done, and a card put away with "Not now" stays away (nil).
    private func withSavedState(_ card: ChatAIDraftCard) -> ChatAIDraftCard? {
        guard var action = card.action else { return card }
        if actionDoneStore.isDismissed(cardId: action.envelope.id) { return nil }
        for key in action.actionKeys {
            if let done = actionDoneStore.done(forKey: key) { action.done[key] = done }
        }
        var updated = card
        updated.action = action
        return updated
    }

    /// One tap on an action card's button (`itemId` for a row's own buttons):
    /// the card's request through the signed-in client, if it is on the
    /// allowlist. While it runs the card's buttons are off; once it went
    /// through, that row (or the card) stays done, here and after a relaunch.
    /// "Fewer like this" stays usable on an expired or finished card until it's used.
    public func runAIAction(cardId: String, itemId: String?, actionId: String) async {
        guard let state = aiDraftsByMessageId.values.joined().first(where: { $0.id == cardId })?.action,
              let tapped = state.actions(itemId: itemId).first(where: { $0.id == actionId }),
              state.canRun(tapped, itemId: itemId) else { return }
        let key = AIActionDoneStore.key(cardId: state.envelope.id, itemId: itemId, actionId: actionId)
        updateAction(cardId) {
            $0.running = key
            $0.failures[itemId ?? ""] = nil
        }
        let outcome = await AIActionRunner.run(tapped, api: api)
        updateAction(cardId) {
            $0.running = nil
            switch outcome {
            case let .done(done): $0.done[key] = done
            case let .failed(message): $0.failures[itemId ?? ""] = message
            }
        }
        if case let .done(done) = outcome {
            actionDoneStore.record(done, forKey: key)
        }
    }

    /// "Not now": nothing is sent; the card goes away here and after a relaunch.
    public func dismissAIAction(cardId: String) {
        guard let state = aiDraftsByMessageId.values.joined().first(where: { $0.id == cardId })?.action,
              state.running == nil else { return }
        actionDoneStore.dismiss(cardId: state.envelope.id)
        for (messageId, cards) in aiDraftsByMessageId {
            aiDraftsByMessageId[messageId] = cards.filter { $0.id != cardId }
        }
        rebuild()
    }

    private func updateAction(_ cardId: String, _ change: (inout ChatAIActionCard) -> Void) {
        guard let messageId = aiDraftsByMessageId.first(where: { $0.value.contains { $0.id == cardId } })?.key else { return }
        aiDraftsByMessageId[messageId] = aiDraftsByMessageId[messageId]?.map { card in
            guard card.id == cardId, var action = card.action else { return card }
            change(&action)
            var updated = card
            updated.action = action
            return updated
        }
        rebuild()
    }

    // MARK: - Typing (A15)

    /// Composer text changed — emit `typing:start` at most once per 3s
    /// while non-empty, and `typing:stop` when cleared. Emits only when
    /// a room id is already known (never creates rooms for typing).
    private func handleComposerTextChange() {
        if composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            emitTypingStopIfNeeded()
            return
        }
        guard socket.connectionState == .connected, let roomId = typingRoomId() else { return }
        let now = Date()
        if let last = lastTypingEmitAt, now.timeIntervalSince(last) < 3 { return }
        lastTypingEmitAt = now
        didEmitTypingStart = true
        socket.emit("typing:start", payload: ["roomId": roomId])
    }

    /// Write `composerText` without feeding the typing emitter — for
    /// programmatic seeds (beginEdit, edit-failure restore, capability
    /// chips), which must not broadcast "typing…" before the user has
    /// touched the keyboard, nor spend the backend's typing budget.
    private func setComposerTextSilently(_ text: String) {
        isProgrammaticComposerWrite = true
        composerText = text
        isProgrammaticComposerWrite = false
    }

    /// Text the composer field reports. Right after a send clears the
    /// composer, the field can report its old contents with a new keystroke
    /// appended before it has shown the cleared value; keep only what was
    /// typed after the send instead of reviving the sent text.
    public func updateComposerFromField(_ text: String) {
        if let sent = sentComposerText {
            // A stale report is the sent text with new keystrokes after it. A
            // report no longer than that text (a fresh first keystroke, even
            // one matching a one-character message) is kept as typed.
            if Date().timeIntervalSince(sent.at) < 2, text.count > sent.text.count, text.hasPrefix(sent.text) {
                composerText = String(text.dropFirst(sent.text.count))
                return
            }
            sentComposerText = nil
        }
        composerText = text
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
        // An unfinished starter ("Remind us…") goes into the composer for the person to finish.
        if chip.label.hasSuffix("\u{2026}") {
            setComposerTextSilently(String(chip.label.dropLast()) + " ")
            return
        }
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

    public func queueAttachment(kind: ChatQueuedAttachmentKind, filename: String, mimeType: String, data: Data, liveVideo: Data? = nil) {
        appendQueuedAttachment(
            ChatQueuedAttachment(
                id: UUID().uuidString,
                kind: kind,
                filename: filename,
                mimeType: mimeType,
                data: data,
                liveVideo: liveVideo
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
        let session = AuthManager.shared.requestSessionGeneration
        let capturedReply = replyingTo
        let capturedTopic = selectedTopicId
        let replyRoom = capturedReply?.roomId ?? messages.first { $0.id == capturedReply?.messageId }?.roomId
        let mutation = draftMutation
        isSending = true
        defer { isSending = false }
        var replyDestination: String?
        if capturedReply != nil {
            guard let room = await prepareReplySend(roomId: replyRoom, mutation: mutation, session: session) else { return }
            replyDestination = room
        }
        if isViewingSearchContext || isViewingEarlierHistory { await prepareLatestForSend() }
        let topicId = await resolveTopicIdForShare(topicForPerson, fallback: capturedTopic)
        guard api !== APIClient.shared || session == AuthManager.shared.requestSessionGeneration else { return }
        let clientId = Self.newClientMessageId()
        let pending = optimisticRichMessage(
            text: messageText,
            clientId: clientId,
            roomId: replyDestination ?? knownRoomIdHint(),
            messageType: messageType,
            metadata: metadata
        )
        pendingByClientId[clientId] = pending
        sendContextsByClientId[clientId] = PendingSendContext(
            text: messageText,
            attachments: [],
            fileIds: nil,
            replyToId: capturedReply?.messageId,
            topicId: topicId,
            messageType: messageType,
            metadata: metadata,
            replyRoomId: replyRoom,
            sendRoomId: replyDestination
        )
        if draftMutation == mutation, replyingTo?.messageId == capturedReply?.messageId { replyingTo = nil }
        rebuild()
        if usesDurableOutbox {
            await enqueuePending(clientId: clientId)
            if topicForPerson != nil { await loadTopicsIfNeeded() }
            return
        }
        let succeeded = await performSend(clientId: clientId)
        if succeeded, topicForPerson != nil {
            await loadTopicsIfNeeded()
        }
    }

    private func resolveTopicIdForShare(
        _ topic: (type: String, refId: String, title: String)?, fallback: String?
    ) async -> String? {
        guard let topic else { return fallback }
        guard case let .person(otherUserId) = mode else { return fallback }
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
            // Tag the card with its topic but keep the current view, as web does. Selecting
            // the topic here made the next refresh hide the other person's later messages.
            return response.topic.id
        } catch {
            logger.warning("find/create share topic failed: \(error)")
            return fallback
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
            userId: sendingIdentityId,
            messageText: text,
            messageType: messageType,
            metadata: .object(metadata),
            replyToId: sanitizedReplyToId(replyingTo?.messageId, roomId: roomId),
            topicId: selectedTopicId,
            clientMessageId: clientId,
            createdAt: Self.fractionalISOFormatter.string(from: Date()),
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
        if mode != .ai, queuedAttachments.contains(where: { $0.id == attachment.id }) {
            ChatPhotoPreviews.shared.prepare(attachment)
        }
    }

    private func uploadQueuedAttachmentsIfNeeded(
        _ attachments: [ChatQueuedAttachment],
        roomId: String,
        clientId: String
    ) async throws -> [String] {
        var files: [MultipartFile] = []
        var slots: [[String: Int]] = []
        for attachment in attachments {
            guard let data = attachment.data else { continue }
            var slot = ["fileIndex": files.count]
            files.append(MultipartFile(fieldName: "files", filename: attachment.filename, mimeType: attachment.mimeType, data: data))
            if let clip = attachment.liveVideo {
                slot["liveVideoIndex"] = files.count
                files.append(MultipartFile(fieldName: "files", filename: "live-\(attachment.id).mp4", mimeType: "video/mp4", data: clip))
            }
            slots.append(slot)
        }
        guard !files.isEmpty else { return [] }
        let media = try String(bytes: JSONEncoder().encode(slots), encoding: .utf8)
        let response = try await uploader.uploadChatMedia(roomId: roomId, files: files, clientRequestId: clientId, media: media)
        return response.media.map(\.id)
    }

    /// The queued photos and PDFs, uploaded to `ai-media`: a private
    /// reference for each, which the chat's `images` carries.
    private func uploadAIMedia(_ attachments: [ChatQueuedAttachment]) async throws -> [String] {
        let files = attachments.compactMap { attachment -> MultipartFile? in
            guard let data = attachment.data,
                  attachment.mimeType.hasPrefix("image/") || attachment.mimeType == Self.pdfMimeType else { return nil }
            return MultipartFile(fieldName: "files", filename: attachment.filename, mimeType: attachment.mimeType, data: data)
        }
        guard !files.isEmpty else { return [] }
        let response = try await uploader.uploadAIMedia(files: files)
        return response.images.map(\.url)
    }

    static let pdfMimeType = "application/pdf"
    /// What `ai-media` takes in a PDF (phase 2 contract §7.1).
    static let aiDocumentMaxBytes = 10 * 1024 * 1024
    static let aiDocumentMaxPages = 20

    /// A PDF for the assistant (Attach → Document), read on the phone first so
    /// one the server would refuse says so at once, in the server's words.
    public func queueAIDocument(filename: String, data: Data) {
        guard data.count <= Self.aiDocumentMaxBytes else {
            actionFailure = "That PDF is over 10 MB. Try a smaller one, or photos of the pages that matter."
            return
        }
        guard let document = PDFDocument(data: data), document.pageCount > 0 else {
            actionFailure = "That PDF can\u{2019}t be read. Try saving it again as a PDF, or send photos of the pages."
            return
        }
        guard !document.isEncrypted else {
            actionFailure = "That PDF is password-protected. Send a copy without a password, or photos of the pages."
            return
        }
        guard document.pageCount <= Self.aiDocumentMaxPages else {
            actionFailure = "That PDF has \(document.pageCount) pages; the assistant reads up to \(Self.aiDocumentMaxPages). "
                + "Send the pages that matter."
            return
        }
        let name = filename.lowercased().hasSuffix(".pdf") ? filename : filename + ".pdf"
        queueAttachment(kind: .document, filename: name, mimeType: Self.pdfMimeType, data: data)
    }

    /// `ai-media` turning the upload down for what was sent (a locked PDF, a
    /// file that isn't what it says), not a lost connection, a busy server or
    /// too many uploads, which another Send may get past.
    private struct AIUploadRefusal {
        /// The server's own sentence.
        let message: String
        /// `PDF_ENCRYPTED`, …
        let code: String?
        /// Its `error` text, which names the file when the refusal is about one.
        let error: String?
    }

    private static func aiUploadRefusal(_ error: any Error) -> AIUploadRefusal? {
        guard case let APIError.clientError(status, body) = error, ![408, 429].contains(status) else { return nil }
        let object = body?.data(using: .utf8).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        return AIUploadRefusal(
            message: APIError.friendlyClientMessage(body) ?? APIError.plainClientMessage(status: status),
            code: object?["code"] as? String,
            error: object?["error"] as? String
        )
    }

    /// The file a refusal is about: the one it names (`File "name" …`),
    /// else, for a PDF the server can't read (`PDF_…`), the only PDF sent;
    /// nil when it can't tell (two PDFs, say), and then every file stays.
    private static func refusedAIFile(_ refusal: AIUploadRefusal, among files: [ChatQueuedAttachment]) -> ChatQueuedAttachment? {
        if let error = refusal.error, let named = files.first(where: { error.contains("File \"\($0.filename)\"") }) {
            return named
        }
        guard refusal.code?.hasPrefix("PDF_") == true else { return nil }
        let documents = files.filter { $0.mimeType == pdfMimeType && $0.data != nil }
        return documents.count == 1 ? documents.first : nil
    }

    /// The upload's failure in the server's own words, else a plain line.
    private static func aiUploadFailure(_ error: any Error) -> String {
        let fallback = "Couldn\u{2019}t send that. Check your connection and try again."
        switch error {
        case let APIError.clientError(_, body): return APIError.friendlyClientMessage(body) ?? fallback
        case let APIError.server(_, body): return APIError.friendlyClientMessage(body) ?? fallback
        default: return (error as? APIError)?.errorDescription ?? fallback
        }
    }

    /// Off the main actor: shrinking full-size photos takes a moment.
    private nonisolated static func sentPhotoCopies(of photos: [Data], in folder: URL) async -> [URL] {
        photos.compactMap { ChatMediaURL.sentPhotoCopy(of: $0, in: folder) }
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

    private func prepareHistoryReload(recall: Bool) async -> Bool {
        setVisibleReadBoundaries([])
        historyGeneration += 1
        state = .loading
        messages = []
        isViewingEarlierHistory = false
        earlierHistoryBefore = nil
        oldestCursor = nil
        hasMore = false
        syncCursors = nil
        hasLatestHistoryWindow = false
        guard recall else { return true }
        let generation = historyGeneration
        _ = await recallThread()
        return generation == historyGeneration && !Task.isCancelled
    }

    private func fetch(_ kind: FetchKind, recoverReceiptReset: Bool = true, recallOnReload: Bool = false) async {
        if case .ai = mode {
            if messages.isEmpty { state = .empty }
            return
        }
        if case .reload = kind {
            guard await prepareHistoryReload(recall: recallOnReload) else { return }
        } else if historyRequestId != nil {
            return
        }
        let requestId = UUID()
        let cacheVersion = ChatLocalStore.shared.version
        let generation = historyGeneration
        let topicId = selectedTopicId
        let held = messages
        historyRequestId = requestId
        historyTouchedIds = []
        defer {
            if historyRequestId == requestId { historyRequestId = nil }
        }
        let before: String? = switch kind {
        case let .older(cursor): cursor
        case .merge: earlierHistoryBefore
        case .reload: nil
        }
        do {
            if case .merge = kind, topicId == nil, let cursor = syncCursors,
               try await fetchChanges(cursor: cursor, requestId: requestId, generation: generation, cacheVersion: cacheVersion) {
                return
            }
            let response = try await requestHistory(before: before, topicId: topicId)
            guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { return }
            let (fetched, authorizedRooms) = try await reconcileCanonicalHistory(
                response, kind: kind, held: held, requestId: requestId, generation: generation
            )
            historyConfirmedAt = Date()
            historyCacheVersion = cacheVersion == ChatLocalStore.shared.version ? cacheVersion : nil
            historyAccessRefused = false
            if response.anchorMessageId != nil { isViewingSearchContext = true }
            if case .older = kind {
                // The loaded page does not redefine the latest/snapshot scope.
            } else {
                hasLatestHistoryWindow = response.anchorMessageId == nil && !isViewingEarlierHistory
                syncCursors = topicId == nil ? response.syncCursors?.filter { authorizedRooms?.contains($0.key) != false } : nil
            }
            apply(response: response, kind: kind, fetchedMessages: fetched, authorizedRooms: authorizedRooms)
            scheduleMarkRead()
            if case let .room(roomId) = mode, before == nil {
                await refreshRoomAvailability(roomId: roomId)
            }
            if recoverReceiptReset, let cursor = response.syncCursors,
               await !refreshMessageReadReceipts(cursor: cursor, requestId: requestId, generation: generation) {
                // A receipt snapshot can discover a history reset after the
                // history request completed. Retry canonical history once.
                historyRequestId = nil
                await fetch(.reload, recoverReceiptReset: false)
            }
        } catch {
            guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { return }
            handleFetchFailure(error, kind: kind)
        }
    }

    /// Access removals apply before any later page can fail, and a later
    /// snapshot cannot reintroduce rows from rooms already removed in this fetch.
    private func reconcileCanonicalHistory(
        _ response: ChatMessagesResponse,
        kind: FetchKind,
        held: [ChatMessageDTO],
        requestId: UUID,
        generation: Int
    ) async throws -> ([ChatMessageDTO], Set<String>?) {
        let topicId = selectedTopicId
        let heldIds = Set(held.map(\.id))
        var authorizedRooms = response.roomIds.map(Set.init)
        if let authorizedRooms {
            // Retire alternate topic/inbox copies before this response can
            // replace the known room set, or a later page can fail.
            reconcileHistoryAccess(roomIds: authorizedRooms, reset: false)
        }
        var fetched = response.messages
        var page = response
        // Reconcile only a bounded retained range. A long offline gap can
        // replace the oldest retained rows; paging still reaches them.
        if case .merge = kind, response.anchorMessageId == nil, let earliest = held.min(by: Self.messagePrecedes) {
            var cursors: Set<String> = []
            while fetched.count < Self.retainedMessageLimit, page.hasMore == true,
                  let oldest = page.messages.min(by: Self.messagePrecedes),
                  Self.messagePrecedes(earliest, oldest),
                  let cursor = page.nextCursor ?? Self.paginationCursor(for: oldest),
                  cursors.insert(cursor).inserted {
                page = try await requestHistory(before: cursor, topicId: topicId)
                guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { throw CancellationError() }
                if let roomIds = page.roomIds {
                    let allowed = authorizedRooms?.intersection(roomIds) ?? Set(roomIds)
                    authorizedRooms = allowed
                    reconcileHistoryAccess(roomIds: allowed, reset: false)
                }
                fetched.append(contentsOf: page.messages)
            }
            let fetchedIds = Set(fetched.map(\.id))
            let lowerBound = fetched.min(by: Self.messagePrecedes)
            messages.removeAll { message in
                guard heldIds.contains(message.id), !historyTouchedIds.contains(message.id),
                      !fetchedIds.contains(message.id) else { return false }
                return page.hasMore != true || lowerBound.map { !Self.messagePrecedes(message, $0) } == true
            }
        }
        if let authorizedRooms {
            messages.removeAll { !authorizedRooms.contains($0.roomId) }
            fetched.removeAll { !authorizedRooms.contains($0.roomId) }
        }
        return (fetched, authorizedRooms)
    }

    /// Drain one fixed server snapshot before applying rows or committing its
    /// cursor. A failed later page leaves the displayed history and cursor intact.
    private func fetchChanges(cursor: [String: Int64], requestId: UUID, generation: Int, cacheVersion: Int) async throws -> Bool {
        guard cursor.count <= 10000 else { return false }
        var next = cursor
        var until: [String: Int64]?
        let heldIds = Set(messages.map(\.id))
        let oldest = messages.first
        var staged: [String: ChatMessageDTO] = [:]
        var deleted: Set<String> = []
        var confirmations: [String: ChatMessageDTO] = [:]
        var finalPage: ChatChangesResponse?
        do {
            repeat {
                let page: ChatChangesResponse = try await api.request(changesEndpoint(cursor: next, until: until))
                guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { return true }
                reconcileHistoryAccess(roomIds: Set(page.roomIds), reset: page.resetRequired)
                guard !page.resetRequired else { return false }
                if let until, until != page.untilCursors { throw APIError.invalidResponse }
                if page.hasMore, page.syncCursors == next { throw APIError.invalidResponse }
                let pendingIds = Set(ChatOutbox.shared.messages.map(\.id))
                    .union(pendingByClientId.keys).union(sendContextsByClientId.keys).union(failedClientIds)
                for change in page.messages {
                    guard let message = change.message else {
                        staged.removeValue(forKey: change.id)
                        if heldIds.contains(change.id) { deleted.insert(change.id) }
                        continue
                    }
                    if let clientId = message.clientMessageId, pendingIds.contains(clientId) {
                        confirmations[clientId] = message
                    }
                    guard acceptsMessageInWindow(message),
                          heldIds.contains(message.id) || oldest.map({ !Self.messagePrecedes(message, $0) }) != false else { continue }
                    deleted.remove(message.id)
                    staged[message.id] = message
                }
                // Never accumulate an outage's entire change log. Canonical
                // bounded history can replace this uncommitted snapshot safely.
                if staged.count > Self.retainedMessageLimit * 2 { return false }
                next = page.syncCursors
                until = page.untilCursors
                finalPage = page
            } while finalPage?.hasMore == true
        } catch APIError.notFound {
            // An older server can still reconcile the loaded history window.
            return false
        } catch let APIError.clientError(status, _) where status == 400 || status == 405 {
            return false
        }
        guard let finalPage else { return false }
        let rooms = Set(finalPage.roomIds)
        var byId = Dictionary(uniqueKeysWithValues: messages.filter { rooms.contains($0.roomId) }.map { ($0.id, $0) })
        for id in deleted where !historyTouchedIds.contains(id) {
            byId.removeValue(forKey: id)
        }
        for message in staged.values where !historyTouchedIds.contains(message.id) && rooms.contains(message.roomId) {
            if message.readAt == nil, let readAt = byId[message.id]?.readAt {
                byId[message.id] = message.replacingReadAt(readAt)
            } else {
                byId[message.id] = message
            }
        }
        messages = byId.values.sorted(by: Self.messagePrecedes)
        retireConfirmedClientIds(in: Array(confirmations.values))
        activeRoomIds = rooms
        activeThreadTracker.setActiveRooms(rooms, owner: ObjectIdentifier(self), topicId: selectedTopicId)
        syncCursors = next
        historyConfirmedAt = Date()
        historyCacheVersion = cacheVersion == ChatLocalStore.shared.version ? cacheVersion : nil
        for message in confirmations.values.sorted(by: Self.messagePrecedes) {
            upsert(message, confirmedSend: true)
        }
        for receipt in finalPage.readReceipts ?? [] {
            handleRead(receipt, recoverOtherRooms: false)
        }
        rebuild()
        ChatPerformance.mark("HistoryChanges", rows: messages.count)
        joinActiveRoomsIfPossible()
        scheduleMarkRead()
        if case let .room(roomId) = mode { await refreshRoomAvailability(roomId: roomId) }
        return await refreshMessageReadReceipts(cursor: next, requestId: requestId, generation: generation)
    }

    private func changesEndpoint(cursor: [String: Int64], until: [String: Int64]?, readMessageIds: [String]? = nil) throws -> Endpoint {
        switch mode {
        case let .room(roomId):
            return ChatEndpoints.changes(
                conversationId: roomId,
                isRoom: true,
                cursor: cursor,
                until: until,
                asBusinessUserId: asBusinessUserId,
                readMessageIds: readMessageIds
            )
        case let .person(otherUserId):
            return ChatEndpoints.changes(
                conversationId: otherUserId,
                isRoom: false,
                cursor: cursor,
                until: until,
                readMessageIds: readMessageIds
            )
        case .ai: throw ChatSendError.noRoom
        }
    }

    /// Receipt-only snapshots do not alter the message delta cursor. Positive
    /// confirmations can apply independently; nil never clears a known Read.
    private func refreshMessageReadReceipts(cursor: [String: Int64], requestId: UUID, generation: Int) async -> Bool {
        guard cursor.count <= 10000 else { return true }
        let ids = messages.filter {
            $0.userId == sendingIdentityId && $0.readAt == nil && $0.deletedAt == nil && UUID(uuidString: $0.id) != nil
        }
        .map(\.id)
        for start in stride(from: 0, to: ids.count, by: 500) {
            guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { return true }
            let batch = Array(ids[start..<min(start + 500, ids.count)])
            do {
                let response: ChatChangesResponse = try await api.request(
                    changesEndpoint(cursor: cursor, until: cursor, readMessageIds: batch),
                    expectedSessionGeneration: roomJoinAccountSession
                )
                guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { return true }
                reconcileHistoryAccess(roomIds: Set(response.roomIds), reset: response.resetRequired)
                guard !response.resetRequired else { return false }
                guard let receipts = response.messageReadReceipts else { return true }
                applyMessageReadReceipts(receipts, requested: Set(batch))
            } catch {
                guard generation == historyGeneration, historyRequestId == requestId, !Task.isCancelled else { return true }
                if ScreenStore.isRefusal(error) {
                    // A missing legacy endpoint and a vanished room both need
                    // canonical authorization before any saved rows reappear.
                    reconcileHistoryAccess(roomIds: [], reset: true)
                    return false
                }
                logger.warning("chat receipt recovery failed: \(error)")
                return true
            }
        }
        return true
    }

    /// Authorization and reset metadata apply even to a receipt-only response.
    /// Retire disk and memory copies before a replacement history can fail offline.
    private func reconcileHistoryAccess(roomIds: Set<String>, reset: Bool) {
        var knownRooms = activeRoomIds.union(messages.map(\.roomId))
        if let syncCursors { knownRooms.formUnion(syncCursors.keys) }
        let removed = knownRooms.subtracting(roomIds)
        guard reset || !removed.isEmpty else { return }
        invalidateSavedThreadCache()
        messages.removeAll { reset || !roomIds.contains($0.roomId) }
        activeRoomIds = roomIds
        if let directRoomId, !roomIds.contains(directRoomId) { self.directRoomId = nil }
        visibleReadBoundaries = visibleReadBoundaries.filter { roomIds.contains($0.key) }
        lastReadBoundaries = lastReadBoundaries.filter { roomIds.contains($0.key) }
        if reset {
            hasLatestHistoryWindow = false
            historyConfirmedAt = nil
            syncCursors = nil
            oldestCursor = nil
            hasMore = false
        } else {
            syncCursors = syncCursors?.filter { roomIds.contains($0.key) }
        }
        activeThreadTracker.setActiveRooms(roomIds, owner: ObjectIdentifier(self), topicId: selectedTopicId)
        joinActiveRoomsIfPossible()
        rebuild()
    }

    private func applyMessageReadReceipts(_ receipts: [ChatMessageReadReceipt], requested: Set<String>) {
        let confirmed = receipts.reduce(into: [String: String]()) { result, receipt in
            if requested.contains(receipt.messageId), let readAt = receipt.readAt, Self.parseISO(readAt) != nil {
                result[receipt.messageId] = readAt
            }
        }
        for index in messages.indices {
            let message = messages[index]
            guard message.userId == sendingIdentityId, message.readAt == nil, let readAt = confirmed[message.id] else { continue }
            historyTouchedIds.insert(message.id)
            messages[index] = message.replacingReadAt(readAt)
        }
        if !confirmed.isEmpty { rebuild() }
    }

    private func requestHistory(before: String?, topicId: String?) async throws -> ChatMessagesResponse {
        let endpoint: Endpoint
        if before == nil, topicId == nil, let messageId = scrollToMessageId, !didResolveScrollTarget || isViewingSearchContext {
            isViewingSearchContext = true
            hasLatestHistoryWindow = false
            switch mode {
            case let .room(roomId):
                return try await api.request(ChatEndpoints.messageContext(
                    conversationId: roomId, isRoom: true, messageId: messageId, asBusinessUserId: asBusinessUserId
                ))
            case let .person(otherUserId):
                return try await api.request(ChatEndpoints.messageContext(conversationId: otherUserId, isRoom: false, messageId: messageId))
            case .ai: break
            }
        }
        switch mode {
        case let .room(roomId):
            endpoint = ChatEndpoints.roomMessages(roomId: roomId, before: before, asBusinessUserId: asBusinessUserId)
        case let .person(otherUserId):
            endpoint = ChatEndpoints.conversationMessages(otherUserId: otherUserId, before: before, topicId: topicId)
        case .ai:
            throw ChatSendError.noRoom
        }
        return try await api.request(endpoint)
    }

    private func loadTopicsIfNeeded() async {
        guard case let .person(otherUserId) = mode else { return }
        let generation = historyGeneration
        if let initialTopic, selectedTopicId == nil {
            self.initialTopic = nil
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
                guard generation == historyGeneration, !Task.isCancelled else { return }
                selectedTopicId = response.topic.id
            } catch {
                logger.warning("find/create topic failed: \(error)")
            }
            self.initialTopic = nil
        }
        do {
            let response: ConversationTopicsResponse = try await api.request(ChatEndpoints.conversationTopics(otherUserId: otherUserId))
            guard generation == historyGeneration, !Task.isCancelled else { return }
            topics = response.topics.map {
                ChatConversationTopic(id: $0.id, topicType: $0.topicType, title: $0.title, status: $0.status)
            }
            topicsConfirmed = true
            scheduleHistorySave()
        } catch {
            logger.warning("load topics failed: \(error)")
        }
    }

    /// Messages can be opened without a Plan route (Inbox, Search, or a link).
    /// Read the room's current status so those entry points also become read-only.
    private func refreshRoomAvailability(roomId: String) async {
        do {
            let response: ChatRoomDetailResponse = try await api.request(
                ChatEndpoints.room(roomId: roomId, asBusinessUserId: asBusinessUserId)
            )
            inactiveRoomNote = response.room.isActive == false
                ? "This chat has closed. Message them directly to keep talking."
                : nil
        } catch {
            // Keep already loaded history and any previously confirmed closure.
            // The server still checks availability on every send.
            logger.warning("chat availability refresh failed: \(error)")
        }
    }

    private func handleFetchFailure(_ error: any Error, kind: FetchKind) {
        if let apiError = error as? APIError {
            switch apiError {
            case .forbidden, .notFound, .unauthorized:
                discardSavedThread()
                state = .error(message: friendlyMessage(error))
                return
            default: break
            }
        }
        if case .reload = kind, !hasLatestHistoryWindow {
            state = .error(message: friendlyMessage(error))
        } else {
            logger.warning("chat refetch failed: \(error)")
        }
    }

    private func apply(
        response: ChatMessagesResponse,
        kind: FetchKind,
        fetchedMessages: [ChatMessageDTO],
        authorizedRooms: Set<String>?
    ) {
        switch kind {
        case .reload, .merge: sendRefusalNote = response.sendRefusal?.error
        case .older: break
        }
        // Events received after the request started are newer than its snapshot.
        var byId = Dictionary(uniqueKeysWithValues: messages.map { ($0.id, $0) })
        for message in fetchedMessages where !historyTouchedIds.contains(message.id) {
            if message.readAt == nil, let knownRead = byId[message.id]?.readAt {
                byId[message.id] = message.replacingReadAt(knownRead)
            } else {
                byId[message.id] = message
            }
        }
        messages = byId.values.sorted(by: Self.messagePrecedes)
        retireConfirmedClientIds(in: fetchedMessages)
        updateActiveRooms(response: response, authorizedRooms: authorizedRooms)
        if case .merge = kind, oldestCursor != nil {
            // Keep the pagination position belonging to the oldest loaded page.
        } else {
            hasMore = response.hasMore ?? false
            oldestCursor = response.nextCursor ?? Self.paginationCursor(for: messages.first)
        }
        switch kind {
        case .older: boundRetainedMessages(keepingOlder: true)
        case .reload, .merge: boundRetainedMessages(keepingOlder: isViewingEarlierHistory || isViewingSearchContext)
        }
        rebuild()
        joinActiveRoomsIfPossible()
        switch kind {
        case .reload: ChatPerformance.mark("HistoryReload", rows: messages.count)
        case .merge: ChatPerformance.mark("HistoryMerge", rows: messages.count)
        case .older:
            olderPagesApplied += 1
            ChatPerformance.mark("HistoryOlder", rows: messages.count)
        }
    }

    /// A fetched row carrying one of our client ids means that send
    /// landed server-side (e.g. the POST response was lost, then a
    /// socket refetch ran) — retire every trace of the optimistic
    /// copy so a delivered message can never linger as "failed".
    private func retireConfirmedClientIds(in messages: [ChatMessageDTO]) {
        if usesDurableOutbox {
            for message in messages {
                ChatOutbox.shared.confirm(message)
            }
        }
        for message in messages {
            guard let clientId = message.clientMessageId,
                  pendingByClientId[clientId] != nil
                  || sendContextsByClientId[clientId] != nil
                  || failedClientIds.contains(clientId) else { continue }
            carryPhotoPreviews(to: message)
            retireConfirmedSend(clientId: clientId)
        }
    }

    /// Every confirmation path consumes only the original send's
    /// attachments. A newer composer draft keeps its text and files.
    private func retireConfirmedSend(clientId: String) {
        pendingPhotoIds[clientId] = nil
        if let context = sendContextsByClientId.removeValue(forKey: clientId) {
            let attachmentIds = Set(context.attachments.map(\.id))
            queuedAttachments.removeAll { attachmentIds.contains($0.id) }
        }
        pendingByClientId[clientId] = nil
        failedClientIds.remove(clientId)
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

    private func updateActiveRooms(response: ChatMessagesResponse, authorizedRooms: Set<String>?) {
        var ids = authorizedRooms ?? Set(response.roomIds ?? [])
        ids.formUnion(response.messages.map(\.roomId))
        if case let .room(roomId) = mode {
            ids.insert(roomId)
        }
        if let directRoomId {
            ids.insert(directRoomId)
        }
        if let authorizedRooms { ids.formIntersection(authorizedRooms) }
        activeRoomIds = ids
        // Keep the push layer's "currently viewing" registry in sync so
        // foreground chat pushes for this thread don't show a banner.
        activeThreadTracker.setActiveRooms(ids, owner: ObjectIdentifier(self), topicId: selectedTopicId)
    }

    // MARK: - Mark-read

    private func performMarkRead(boundaries: [String: String], generation: Int, topicId: String?) async {
        guard !Task.isCancelled, selectedTopicId == topicId, historyGeneration == generation,
              !boundaries.isEmpty,
              boundaries.allSatisfy({ visibleReadBoundaries[$0.key] == $0.value }) else { return }
        guard let endpoint = readEndpoint(boundaries: boundaries, topicId: topicId) else { return }
        let session = AuthManager.shared.requestSessionGeneration
        let checkpoint = ChatLocalStore.shared.inboxCheckpoint
        do {
            let response = try await api.request(
                endpoint, as: ChatReadResponse.self, expectedSessionGeneration: roomJoinAccountSession
            )
            guard historyGeneration == generation, session == AuthManager.shared.requestSessionGeneration,
                  selectedTopicId == topicId else { return }
            if let topicId, response.readScope != "topic" || response.topicId != topicId { return }
            lastReadBoundaries.merge(boundaries) { _, confirmed in confirmed }
            guard api === APIClient.shared, asBusinessUserId == nil, let count = response.unreadCount,
                  case let .signedIn(user) = AuthManager.shared.state, user.id == currentUserId else { return }
            let kind: UnifiedConversation.Kind
            let id: String
            switch mode {
            case let .person(otherUserId): (kind, id) = (.conversation, otherUserId)
            case let .room(roomId): (kind, id) = (.room, roomId)
            case .ai: return
            }
            await ChatLocalStore.shared.saveInboxRead(
                count: count,
                kind: kind,
                id: id,
                scope: ChatLocalStore.scope(server: api.apiBaseURL.absoluteString, account: currentUserId),
                checkpoint: checkpoint
            )
        } catch {
            logger.warning("markRead failed: \(error)")
        }
    }

    private func readEndpoint(boundaries: [String: String], topicId: String?) -> Endpoint? {
        if let topicId {
            switch mode {
            case let .person(id):
                return ChatEndpoints.markTopicRead(conversationId: id, isRoom: false, topicId: topicId, throughMessageIds: boundaries)
            case let .room(id):
                guard let messageId = boundaries[id] else { return nil }
                return ChatEndpoints.markTopicRead(
                    conversationId: id,
                    isRoom: true,
                    topicId: topicId,
                    throughMessageIds: [id: messageId],
                    asBusinessUserId: asBusinessUserId
                )
            case .ai: return nil
            }
        }
        switch mode {
        case let .person(id): return ChatEndpoints.markConversationRead(otherUserId: id, throughMessageIds: boundaries)
        case let .room(id):
            guard let messageId = boundaries[id] else { return nil }
            return ChatEndpoints.markRoomRead(roomId: id, asBusinessUserId: asBusinessUserId, throughMessageId: messageId)
        case .ai: return nil
        }
    }

    private func scheduleMarkRead(for _: String) {
        scheduleMarkRead()
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
                activeThreadTracker.setActiveRooms(activeRoomIds, owner: ObjectIdentifier(self), topicId: selectedTopicId)
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
        // Each loop holds the view model weakly between events, so one that
        // is dropped without `teardown()` stops handling events and can be
        // freed, instead of staying alive (and polling) inside the loop.
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.connectionStates() else { return }
            for await state in stream {
                guard let self else { return }
                handleConnectionState(state)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(
                named: "message:new", as: ChatRealtimeMessageEnvelope.self, keyDecodingStrategy: .useDefaultKeys
            ) else { return }
            for await event in stream {
                guard let self else { return }
                handleIncoming(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(
                named: "message:edited",
                as: ChatRealtimeMessageUpdate.self,
                keyDecodingStrategy: .useDefaultKeys
            ) else { return }
            for await event in stream {
                guard let self else { return }
                handleUpdate(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "message:deleted", as: ChatRealtimeMessageDelete.self) else { return }
            for await event in stream {
                guard let self else { return }
                handleDelete(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "message:reaction_updated", as: ChatRealtimeReaction.self) else { return }
            for await event in stream {
                guard let self else { return }
                handleReaction(event)
            }
        })
        subscribeToReadReceipts()
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "typing:user", as: ChatRealtimeTyping.self) else { return }
            for await event in stream {
                guard let self else { return }
                handleTypingStarted(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "typing:stopped", as: ChatRealtimeTyping.self) else { return }
            for await event in stream {
                guard let self else { return }
                handleTypingStopped(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "user:online", as: ChatRealtimePresence.self) else { return }
            for await event in stream {
                guard let self else { return }
                handlePresence(event, online: true)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "user:offline", as: ChatRealtimePresence.self) else { return }
            for await event in stream {
                guard let self else { return }
                handlePresence(event, online: false)
            }
        })
        joinActiveRoomsIfPossible()
    }

    private func handleConnectionState(_ state: SocketClient.ConnectionState) {
        resetRoomJoins()
        if state == .connected {
            ChatPerformance.signposter.emitEvent("SocketConnected")
            joinActiveRoomsIfPossible()
            scheduleFallbackRefresh()
        } else {
            counterpartyOnline = nil
            isCounterpartyTyping = false
            typingClearTask?.cancel()
            didEmitTypingStart = false
            lastTypingEmitAt = nil
        }
        updateFallbackPolling(isConnected: state == .connected)
    }

    private func subscribeToReadReceipts() {
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "messages:read", as: ChatRealtimeRead.self) else { return }
            for await event in stream {
                guard let self else { return }
                handleRead(event)
            }
        })
        socketTasks.append(Task { [weak self] in
            guard let stream = self?.socket.events(named: "messages:topic_read", as: ChatRealtimeTopicRead.self) else { return }
            for await event in stream {
                guard let self else { return }
                handleTopicRead(event)
            }
        })
    }

    /// Live presence (A15 header dot / "Active now"). Only the person
    /// thread's counterparty matters — room/group/AI threads have no
    /// single presence subject.
    private func handlePresence(_ event: ChatRealtimePresence, online: Bool) {
        guard socket.connectionState == .connected, case let .person(otherUserId) = mode,
              event.userId == otherUserId else { return }
        counterpartyOnline = online
    }

    /// Start/stop the socket-down fallback poll. While disconnected, a
    /// loaded non-AI thread refreshes promptly then backs off to 30 seconds.
    /// Reconnection resumes realtime delivery and canonical REST catch-up.
    private func updateFallbackPolling(isConnected: Bool) {
        if isConnected {
            fallbackPollTask?.cancel()
            fallbackPollTask = nil
            return
        }
        guard fallbackPollTask == nil else { return }
        if case .ai = mode { return }
        scheduleFallbackRefresh()
        fallbackPollTask = Task { [weak self] in
            var delay: UInt64 = 3
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: delay * 1_000_000_000)
                guard !Task.isCancelled else { return }
                guard let self else { return }
                await refresh()
                // While the socket is down an open thread keeps polling at
                // least every 10 s, so it catches up soon after the outage.
                delay = min(delay * 2, 10)
            }
        }
    }

    private func resetRoomJoins() {
        roomJoinGeneration += 1
        for (roomId, subscriptionId) in roomSubscriptionIds {
            leaveRoomSubscription(roomId, subscriptionId: subscriptionId)
        }
        joiningRooms.values.forEach { $0.cancel() }
        joiningRooms.removeAll()
        roomSubscriptionIds.removeAll()
        joinedRoomIds.removeAll()
        refusedRoomJoins.removeAll()
        roomJoinRetryAt.removeAll()
        roomJoinAttempts.removeAll()
        roomJoinWakeTask?.cancel()
        roomJoinWakeTask = nil
    }

    private func leaveRoomSubscription(_ roomId: String, subscriptionId: String) {
        guard socket.connectionState == .connected else { return }
        socket.emit("room:leave", payload: ["roomId": roomId, "subscriptionId": subscriptionId])
    }

    private func joinActiveRoomsIfPossible() {
        guard socket.connectionState == .connected, !historyAccessRefused else { return }
        if api === APIClient.shared {
            guard roomJoinAccountSession == AuthManager.shared.requestSessionGeneration,
                  case let .signedIn(user) = AuthManager.shared.state, user.id == currentUserId else {
                resetRoomJoins()
                return
            }
        }
        for roomId in joinedRoomIds.subtracting(activeRoomIds) {
            if let subscriptionId = roomSubscriptionIds.removeValue(forKey: roomId) {
                leaveRoomSubscription(roomId, subscriptionId: subscriptionId)
            }
            joinedRoomIds.remove(roomId)
        }
        for (roomId, task) in joiningRooms where !activeRoomIds.contains(roomId) {
            task.cancel()
            if let subscriptionId = roomSubscriptionIds[roomId] {
                leaveRoomSubscription(roomId, subscriptionId: subscriptionId)
            }
        }
        refusedRoomJoins.formIntersection(activeRoomIds)
        roomJoinWakeTask?.cancel()
        roomJoinWakeTask = nil
        let pending = activeRoomIds.subtracting(joinedRoomIds).subtracting(joiningRooms.keys).subtracting(refusedRoomJoins)
        let now = Date()
        let ready = pending.filter { (roomJoinRetryAt[$0] ?? .distantPast) <= now }.sorted()
        let generation = roomJoinGeneration
        let session = AuthManager.shared.requestSessionGeneration
        for roomId in ready.prefix(max(0, 4 - joiningRooms.count)) {
            let subscriptionId = UUID().uuidString
            roomSubscriptionIds[roomId] = subscriptionId
            joiningRooms[roomId] = Task { [weak self] in
                guard let self else { return }
                let ack: RoomSubscriptionAck? = await socket.emitWithAck(
                    "room:join",
                    payload: ["roomId": roomId, "subscriptionId": subscriptionId, "includeBackfill": false],
                    as: RoomSubscriptionAck.self
                )
                guard session == AuthManager.shared.requestSessionGeneration else { return }
                guard generation == roomJoinGeneration, roomSubscriptionIds[roomId] == subscriptionId else {
                    leaveRoomSubscription(roomId, subscriptionId: subscriptionId)
                    return
                }
                joiningRooms[roomId] = nil
                if !activeRoomIds.contains(roomId) || Task.isCancelled {
                    leaveRoomSubscription(roomId, subscriptionId: subscriptionId)
                    roomSubscriptionIds[roomId] = nil
                } else {
                    completeRoomJoin(roomId, ack: ack)
                }
                joinActiveRoomsIfPossible()
                if joiningRooms.isEmpty, activeRoomIds.isSubset(of: joinedRoomIds) {
                    // One canonical catch-up after all subscriptions settle,
                    // rather than one refresh per room acknowledgement.
                    scheduleFallbackRefresh()
                }
            }
        }
        guard joiningRooms.count < 4,
              let next = pending.compactMap({ roomJoinRetryAt[$0] }).filter({ $0 > now }).min() else { return }
        roomJoinWakeTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: UInt64(max(0.1, next.timeIntervalSinceNow) * 1_000_000_000)) } catch { return }
            guard let self, !Task.isCancelled, generation == roomJoinGeneration,
                  session == AuthManager.shared.requestSessionGeneration else { return }
            roomJoinWakeTask = nil
            joinActiveRoomsIfPossible()
        }
    }

    private func completeRoomJoin(_ roomId: String, ack: RoomSubscriptionAck?) {
        if ack?.success == true {
            joinedRoomIds.insert(roomId)
            roomJoinAttempts[roomId] = nil
            roomJoinRetryAt[roomId] = nil
            return
        }
        if let subscriptionId = roomSubscriptionIds.removeValue(forKey: roomId) {
            leaveRoomSubscription(roomId, subscriptionId: subscriptionId)
        }
        let denied = ack?.error?.localizedCaseInsensitiveContains("access denied") == true
            || ["FORBIDDEN", "CHAT_ACCESS_DENIED"].contains(ack?.code ?? "")
        if denied {
            // Canonical REST removes revoked rooms. A permanent socket refusal
            // is retried only on an explicit refresh/reopen/reconnect.
            refusedRoomJoins.insert(roomId)
            roomJoinRetryAt[roomId] = nil
        } else {
            // Attempts remain retryable; only the exponential backoff is capped.
            let attempt = min(6, (roomJoinAttempts[roomId] ?? 0) + 1)
            roomJoinAttempts[roomId] = attempt
            let backoff = min(30, pow(2, Double(attempt - 1)))
            let requested = Double(max(1000, ack?.retryAfterMs ?? 1000)) / 1000
            let delay = max(backoff, requested)
            roomJoinRetryAt[roomId] = Date().addingTimeInterval(min(30, delay + Double.random(in: 0...min(1, delay * 0.2))))
        }
        // A refusal can signal removed membership. Resolve it canonically,
        // with a global bound even when hundreds of rooms fail together.
        if Date().timeIntervalSince(lastJoinRecoveryAt) >= 5 {
            lastJoinRecoveryAt = Date()
            scheduleFallbackRefresh()
        }
    }

    private func handleReaction(_ event: ChatRealtimeReaction) {
        guard let original = messages.first(where: { $0.id == event.messageId }) else { return }
        guard let summaries = event.reactions, summaries.allSatisfy({ $0.users != nil }) else {
            scheduleFallbackRefresh()
            return
        }
        // reacted_by_me on a room broadcast belongs to its author. Derive it
        // from the supplied users for this viewer instead.
        historyTouchedIds.insert(original.id)
        applyReactions(summaries.map {
            ChatReactionSummary(reaction: $0.reaction, count: $0.count, reactedByMe: $0.users?.contains { $0.id == currentUserId } == true)
        }, to: original.id)
    }

    private func handleIncoming(_ event: ChatRealtimeMessageEnvelope) {
        guard !historyAccessRefused else { return }
        let message = event.message
        if case let .person(otherUserId) = mode, event.otherUserId == otherUserId,
           activeRoomIds.insert(message.roomId).inserted {
            // A new direct/task room can belong to an already-open person thread.
            activeThreadTracker.setActiveRooms(activeRoomIds, owner: ObjectIdentifier(self), topicId: selectedTopicId)
            joinActiveRoomsIfPossible()
        }
        guard activeRoomIds.contains(message.roomId) else { return }
        if let topicId = message.topicId, !topics.contains(where: { $0.id == topicId }) {
            scheduleTopicsRefresh()
        }
        let confirmsPending = message.clientMessageId.map { pendingByClientId[$0] != nil } == true
        if let clientId = message.clientMessageId {
            carryPhotoPreviews(to: message)
            retireConfirmedSend(clientId: clientId)
        }
        let isNewIncoming = message.userId != sendingIdentityId && !messages.contains { $0.id == message.id }
        upsert(message, confirmedSend: confirmsPending)
        if isNewIncoming, messages.contains(where: { $0.id == message.id }) {
            ChatPerformance.signposter.emitEvent("IncomingMessage")
            awaitFirstRender(message.id, isSend: false)
        }
        rebuild()
        scheduleMarkRead()
    }

    private func awaitFirstRender(_ rowId: String, isSend: Bool) {
        // Rows that never reach the screen (a closed thread) must not pile up.
        if awaitingFirstRender.count > 100 { awaitingFirstRender.removeAll() }
        awaitingFirstRender[rowId] = isSend
    }

    /// A timeline row reached the screen. Times a send's sending bubble and a
    /// live incoming message (`ChatPerformance`); every other row is ignored.
    public func noteRowAppeared(_ rowId: String) {
        guard let isSend = awaitingFirstRender.removeValue(forKey: rowId) else { return }
        if isSend {
            ChatPerformance.signposter.emitEvent("SendBubble")
        } else {
            ChatPerformance.signposter.emitEvent("IncomingBubble")
        }
    }

    /// A peer can introduce a topic while this screen stays open. Refresh only
    /// its metadata; the complete live message already supplies the new bubble.
    private func scheduleTopicsRefresh() {
        guard case .person = mode, topicsRefreshTask == nil else { return }
        topicsRefreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 150_000_000)
            guard let self, !Task.isCancelled else { return }
            await loadTopicsIfNeeded()
            guard !Task.isCancelled else { return }
            rebuild()
            topicsRefreshTask = nil
        }
    }

    private func handleUpdate(_ event: ChatRealtimeMessageUpdate) {
        if let roomId = event.roomId, !activeRoomIds.contains(roomId) { return }
        guard messages.contains(where: { $0.id == event.id }) else { return }
        guard let updated = event.updatedMessage else {
            scheduleFallbackRefresh()
            return
        }
        applyUpdatedMessage(updated)
    }

    private func handleRead(_ event: ChatRealtimeRead, recoverOtherRooms: Bool = true) {
        // A group's single reader must never imply that everyone has read it.
        guard !historyAccessRefused, roomJoinAccountSession == AuthManager.shared.requestSessionGeneration,
              case let .person(otherUserId) = mode, event.userId == otherUserId,
              activeRoomIds.contains(event.roomId) else { return }
        if event.directReceiptEligible == false {
            retireIneligibleReceipts(roomId: event.roomId)
            return
        }
        guard event.directReceiptEligible == true else {
            if recoverOtherRooms { scheduleFallbackRefresh() }
            return
        }
        guard let throughMessageId = event.throughMessageId, let readAt = event.readAt else { return }
        guard event.roomId == directRoomId else {
            // Aggregate history also contains groups and older direct rooms.
            // Only the server's per-message receipts can distinguish them here.
            if recoverOtherRooms { scheduleFallbackRefresh() }
            return
        }
        let boundary = messages.first { $0.id == throughMessageId && $0.roomId == event.roomId }
        guard let createdAt = boundary?.createdAt ?? event.throughCreatedAt,
              let boundaryDate = Self.parseISO(createdAt), Self.parseISO(readAt) != nil else { return }
        var changed = false
        for index in messages.indices {
            let message = messages[index]
            guard message.roomId == event.roomId, message.userId == sendingIdentityId,
                  let messageDate = Self.parseISO(message.createdAt),
                  (messageDate, message.id) <= (boundaryDate, throughMessageId) else { continue }
            historyTouchedIds.insert(message.id)
            guard message.readAt != readAt else { continue }
            messages[index] = message.replacingReadAt(readAt)
            changed = true
        }
        // A receipt that moves no stamp (the reader's own new message, a
        // repeat) must not re-render the whole timeline.
        if changed { rebuild() }
    }

    private func handleTopicRead(_ event: ChatRealtimeTopicRead) {
        guard !historyAccessRefused, roomJoinAccountSession == AuthManager.shared.requestSessionGeneration,
              case let .person(peerId) = mode, event.userId == peerId,
              activeRoomIds.contains(event.roomId) else { return }
        if event.directReceiptEligible == false {
            retireIneligibleReceipts(roomId: event.roomId)
            return
        }
        guard event.directReceiptEligible == true else {
            scheduleFallbackRefresh()
            return
        }
        guard selectedTopicId == nil || selectedTopicId == event.topicId,
              let throughId = event.throughMessageId, let readAt = event.readAt else { return }
        guard event.roomId == directRoomId else {
            scheduleFallbackRefresh()
            return
        }
        let boundary = messages.first { $0.id == throughId && $0.roomId == event.roomId && $0.topicId == event.topicId }
        guard let createdAt = boundary?.createdAt ?? event.throughCreatedAt,
              let boundaryDate = Self.parseISO(createdAt), Self.parseISO(readAt) != nil else { return }
        var changed = false
        for index in messages.indices {
            let message = messages[index]
            guard message.roomId == event.roomId, message.topicId == event.topicId,
                  message.userId == sendingIdentityId, message.readAt == nil,
                  let date = Self.parseISO(message.createdAt), (date, message.id) <= (boundaryDate, throughId) else { continue }
            historyTouchedIds.insert(message.id)
            messages[index] = message.replacingReadAt(readAt)
            changed = true
        }
        if changed { rebuild() }
    }

    /// Explicit server ineligibility overrides a legacy optimistic Read. When
    /// this screen showed one, retire all encrypted topic variants before
    /// canonical recovery can fail offline. Saved history comes from the same
    /// canonical rows, which never carry a Read for such a room, so a refusal
    /// that changes nothing here (any read in a shared task room) leaves the
    /// account's cached threads and inbox in place.
    private func retireIneligibleReceipts(roomId: String) {
        var changed = false
        for index in messages.indices {
            let message = messages[index]
            guard message.roomId == roomId, message.userId == sendingIdentityId, message.readAt != nil else { continue }
            historyTouchedIds.insert(message.id)
            messages[index] = message.replacingReadAt(nil)
            changed = true
        }
        guard changed else { return }
        invalidateSavedThreadCache()
        historyCacheVersion = nil
        rebuild()
        scheduleFallbackRefresh()
    }

    private func handleDelete(_ event: ChatRealtimeMessageDelete) {
        if let roomId = event.roomId, !activeRoomIds.contains(roomId) { return }
        historyTouchedIds.insert(event.id)
        messages.removeAll { $0.id == event.id }
        rebuild()
    }

    private func applyUpdatedMessage(_ updated: ChatMessageDTO) {
        guard let original = messages.first(where: { $0.id == updated.id }) else { return }
        upsert(original.applyingEdit(updated))
        rebuild()
    }

    private func applyReactions(_ reactions: [ChatReactionSummary], to messageId: String) {
        historyTouchedIds.insert(messageId)
        guard let index = messages.firstIndex(where: { $0.id == messageId }) else { return }
        messages[index] = messages[index].replacingReactions(reactions)
        rebuild()
    }

    // MARK: - Projection

    private func acceptsMessageInWindow(_ message: ChatMessageDTO) -> Bool {
        if messages.contains(where: { $0.id == message.id }) { return true }
        if isViewingSearchContext { return false }
        guard isViewingEarlierHistory else { return true }
        guard let first = messages.first, let last = messages.last else { return false }
        return !Self.messagePrecedes(message, first) && !Self.messagePrecedes(last, message)
    }

    /// Pending/failed rows live separately and are never subject to this cap.
    private func boundRetainedMessages(keepingOlder: Bool) {
        guard messages.count > Self.retainedMessageLimit else { return }
        if keepingOlder {
            // Save the actual recent window before its newest edge is evicted.
            rememberThread()
            earlierHistoryBefore = Self.paginationCursor(for: messages[Self.retainedMessageLimit])
            messages = Array(messages.prefix(Self.retainedMessageLimit))
            isViewingEarlierHistory = true
            hasLatestHistoryWindow = false
        } else {
            messages = Array(messages.suffix(Self.retainedMessageLimit))
            oldestCursor = Self.paginationCursor(for: messages.first)
            hasMore = true
        }
        let retained = Set(messages.map(\.id))
        visibleReadBoundaries = visibleReadBoundaries.filter { retained.contains($0.value) }
    }

    private func rebuild() {
        if historyRequestId == nil { historyTouchedIds.removeAll() }
        if case .ai = mode {
            // Assistant history has a separate contract and cache.
        } else {
            boundRetainedMessages(keepingOlder: isViewingEarlierHistory || isViewingSearchContext)
        }
        let interval = ChatPerformance.signposter.beginInterval("Rebuild")
        rebuildTimeline()
        manageableMessageIds = Set(messages.lazy.filter { self.wroteMessage($0) }.map(\.id))
        latestAcceptedMessageIds = acceptedReadBoundaries()
        ChatPerformance.end("Rebuild", interval, rows: messages.count)
        scheduleHistorySave()
    }

    private func rebuildTimeline() {
        let combined = combinedMessages()
        let messagesById = Dictionary(uniqueKeysWithValues: combined.map { ($0.id, $0) })
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
            if message.messageType == "system" {
                rows.append(.systemLine(ChatDayDivider(id: message.id, label: message.messageText ?? "")))
                continue
            }
            let side: ChatMessageSide = (message.userId == sendingIdentityId) ? .outgoing : .incoming
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
                    return refusedClientIds.contains(clientId) ? .refused : .failed
                }
                if message.id.hasPrefix("client_") { return .sending }
                if message.readAt != nil { return .read }
                return .sent
            }()
            // Failed / in-flight rows keep their stamp row even when
            // grouped (no tail) — the stamp is the only surface for the
            // "Sending..." spinner and the "Failed to send" + Retry CTA,
            // which must never be hidden by group rhythm. Tail visuals
            // stay driven by `hasTail`.
            let showStamp = hasTail || deliveryState == .failed || deliveryState == .refused
                || deliveryState == .sending
            let stamp: String? = showStamp ? Self.stampLabel(for: message, currentUserId: sendingIdentityId) : nil
            let body = bubbleBody(for: message)
            let replyPreview = Self.replyPreview(for: message, in: messagesById, currentUserId: sendingIdentityId)
            let reactions = message.reactions.map {
                ChatBubbleReaction(id: $0.reaction, reaction: $0.reaction, count: $0.count, reactedByMe: $0.includes(currentUserId))
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
                sentSupportTier: Self.sentSupportTier(for: message),
                senderName: side == .incoming ? roomSenderName(for: message) : nil,
                aiLinks: message.messageType == "ai_reply" ? aiLinksByMessageId[message.id] ?? [] : [],
                attachments: message.attachments
            )))
        }
        state = .loaded(rows: rows)
        resolveScrollTargetIfNeeded(rows: rows)
    }

    /// An assistant reply carries the draft cards that came with it, and a message sent to the
    /// assistant with photos shows the phone's copies of them.
    private func bubbleBody(for message: ChatMessageDTO) -> ChatBubbleContent.Body {
        let photos = aiSentPhotos[message.id] ?? []
        let files = aiSentFiles[message.id] ?? []
        if !photos.isEmpty || !files.isEmpty {
            return .textWithImages(text: message.messageText ?? "", imageURLs: photos, files: files)
        }
        if let sending = pendingPhotoBody(for: message) { return sending }
        guard message.messageType == "ai_reply" else { return Self.bodyForMessage(message) }
        return .aiReply(text: message.messageText ?? "", estimate: nil, drafts: aiDraftsByMessageId[message.id] ?? [])
    }

    private func rememberPendingPhotos(_ attachments: [ChatQueuedAttachment], clientId: String) {
        let photoIds = attachments.filter { $0.kind == .image && $0.data != nil }.map(\.id)
        if !photoIds.isEmpty { pendingPhotoIds[clientId] = photoIds }
    }

    /// A photo message still sending shows the pictures just picked, in the
    /// photo bubble, instead of a bare "Attachment" line.
    private func pendingPhotoBody(for message: ChatMessageDTO) -> ChatBubbleContent.Body? {
        guard message.id.hasPrefix("client_"), let clientId = message.clientMessageId,
              let photoIds = pendingPhotoIds[clientId] else { return nil }
        let urls = photoIds.compactMap(ChatPhotoPreviews.url(for:))
        guard let first = urls.first else { return nil }
        let text = sendContextsByClientId[clientId]?.text.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return .image(url: first, caption: text.isEmpty ? nil : text, moreURLs: Array(urls.dropFirst()))
    }

    /// The sent copy shows the same pictures while its photos first load.
    private func carryPhotoPreviews(to message: ChatMessageDTO) {
        guard let clientId = message.clientMessageId, let photoIds = pendingPhotoIds[clientId],
              case let .image(first?, _, more) = Self.bodyForMessage(message) else { return }
        ChatPhotoPreviews.shared.alias([first] + more, to: photoIds)
    }

    /// A room's incoming messages name their sender, as on Android: a room
    /// has several people, and its avatar alone doesn't say who wrote what.
    /// A made-up username is never shown.
    private func roomSenderName(for message: ChatMessageDTO) -> String? {
        guard case .room = mode else { return nil }
        return Self.senderName(of: message) ?? "Participant"
    }

    /// The name a message's sender goes by: their identity's display name
    /// (older servers send `name`), else a username they chose. Nil when
    /// there's only a made-up one. Bubbles, replies and stamps all use it.
    private static func senderName(of message: ChatMessageDTO) -> String? {
        for name in [message.sender?.displayName, message.sender?.name] {
            if let name = name?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
                return name
            }
        }
        return MadeUpUsername.chosen(message.sender?.handle)
            ?? MadeUpUsername.chosen(message.sender?.username)
    }

    /// Resolve the Chat Search scroll target once: if the deep-linked
    /// message is present in the loaded page, publish its row id for the
    /// view to scroll to. Server search loads an authorized bounded context.
    private func resolveScrollTargetIfNeeded(rows: [ChatTimelineRow]) {
        guard !didResolveScrollTarget, let target = scrollToMessageId else { return }
        let rowId = "bubble_\(target)"
        guard rows.contains(where: { $0.id == rowId }) else { return }
        didResolveScrollTarget = true
        awaitingTargetScroll = true
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
        awaitingTargetScroll = false
    }

    /// Merge persisted messages with optimistic pending rows. Failed
    /// rows stay in the list with the same id so the retry CTA can
    /// target them.
    private func combinedMessages() -> [ChatMessageDTO] {
        let pending = pendingByClientId.values.filter { selectedTopicId == nil || $0.topicId == selectedTopicId }
        return (messages + pending).sorted(by: Self.messagePrecedes)
    }

    /// Optimistic local row. Its `id` keeps the `client_` prefix — the
    /// projection and views key "still sending" off that — while
    /// `clientMessageId` stays a bare UUID for the wire. A reply quotes its
    /// original while it sends, when the send will carry that reply.
    private func optimisticMessage(text: String, clientId: String, roomId: String) -> ChatMessageDTO {
        ChatMessageDTO(
            id: "client_\(clientId)",
            roomId: roomId,
            userId: sendingIdentityId,
            messageText: text,
            messageType: "text",
            metadata: nil,
            replyToId: sanitizedReplyToId(replyingTo?.messageId, roomId: roomId),
            topicId: selectedTopicId,
            clientMessageId: clientId,
            createdAt: Self.fractionalISOFormatter.string(from: Date()),
            editedAt: nil,
            deletedAt: nil,
            deliveredAt: nil,
            readAt: nil,
            sender: nil
        )
    }

    /// An assistant-thread message, dated now unless it was restored with its time.
    private func localMessage(id: String, text: String, userId: String, type: String, createdAt: String? = nil) -> ChatMessageDTO {
        ChatMessageDTO(
            id: id,
            roomId: "ai",
            userId: userId,
            messageText: text,
            messageType: type,
            metadata: nil,
            replyToId: nil,
            clientMessageId: nil,
            createdAt: createdAt ?? Self.fractionalISOFormatter.string(from: Date()),
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
        if let attachmentBody = attachmentBody(for: message) {
            return attachmentBody
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

    /// Photos and files keep the text sent with them as a caption, and
    /// every photo in the message shows, not just the first attachment.
    private static func attachmentBody(for message: ChatMessageDTO) -> ChatBubbleContent.Body? {
        guard let file = message.attachments.first else { return nil }
        let text = (message.messageText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let caption = text.isEmpty || isAttachmentPlaceholder(text) ? nil : text
        let photoURLs = message.attachments
            .filter { ($0.mimeType ?? "").hasPrefix("image/") }
            .compactMap { resolvedMediaURL($0.fileURL) }
        if let first = photoURLs.first {
            return .image(url: first, caption: caption, moreURLs: Array(photoURLs.dropFirst()))
        }
        return .attachment(
            filename: file.originalFilename ?? "Attachment",
            sizeLabel: fileSizeLabel(file.fileSize),
            fileURL: file.fileURL,
            mimeType: file.mimeType,
            caption: caption
        )
    }

    /// Text the server fills in for a message that is only attachments
    /// ("Photo", "Document"), or an older client's "[1 attachment]"; not
    /// a caption.
    private static func isAttachmentPlaceholder(_ text: String) -> Bool {
        ["photo", "video", "document", "media"].contains(text.lowercased())
            || text.range(of: #"^\[.+ attachments?\]$"#, options: [.regularExpression, .caseInsensitive]) != nil
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

    private static func replyPreview(
        for message: ChatMessageDTO,
        in messages: [String: ChatMessageDTO],
        currentUserId: String
    ) -> ChatReplyPreview? {
        guard let replyToId = message.replyToId,
              let original = messages[replyToId] else { return nil }
        return ChatReplyPreview(
            messageId: original.id,
            senderName: replyName(for: original, currentUserId: currentUserId),
            text: original.messageText ?? ""
        )
    }

    /// Who a reply quotes: "You" for your own message, as your bubbles and
    /// stamps carry no name, else the sender's name.
    private static func replyName(for message: ChatMessageDTO, currentUserId: String) -> String {
        message.userId == currentUserId ? "You" : senderName(of: message) ?? "Message"
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
        return dayKeyFormatter.string(from: date)
    }

    private static func dayLabel(for iso: String) -> String {
        guard let date = parseISO(iso) else { return iso }
        let calendar = Calendar.current
        if calendar.isDateInToday(date) { return "Today" }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        return dayLabelFormatter.string(from: date).uppercased()
    }

    private static func stampLabel(for message: ChatMessageDTO, currentUserId: String) -> String? {
        let isOutgoing = message.userId == currentUserId
        let timestamp = isOutgoing ? (message.readAt ?? message.createdAt) : message.createdAt
        guard let date = parseISO(timestamp) else { return nil }
        let time = stampFormatter.string(from: date)
        let sender = senderName(of: message)
        if isOutgoing {
            return time
        } else if let sender {
            return "\(sender) · \(time)"
        } else {
            return time
        }
    }

    private static let dayKeyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let dayLabelFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = .autoupdatingCurrent
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    private static let stampFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .autoupdatingCurrent
        formatter.timeZone = .autoupdatingCurrent
        formatter.timeStyle = .short
        return formatter
    }()

    private static let fractionalISOFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let isoFormatter = ISO8601DateFormatter()
    private static let preciseISOStyle = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
    private static var parsedDates: [String: Date] = [:]

    private static func parseISO(_ raw: String) -> Date? {
        if let cached = parsedDates[raw] { return cached }
        // ISO8601DateFormatter truncates sub-millisecond values. PostgreSQL
        // cursors retain microseconds, so keep that precision before the id tie-break.
        let date = (try? preciseISOStyle.parse(raw)) ?? isoFormatter.date(from: raw)
        if parsedDates.count > 4096 { parsedDates.removeAll(keepingCapacity: true) }
        if let date { parsedDates[raw] = date }
        return date
    }

    private static func messagePrecedes(_ lhs: ChatMessageDTO, _ rhs: ChatMessageDTO) -> Bool {
        let left = parseISO(lhs.createdAt) ?? .distantPast
        let right = parseISO(rhs.createdAt) ?? .distantPast
        return (left, lhs.id) < (right, rhs.id)
    }

    private func friendlyMessage(_ error: any Error) -> String {
        (error as? APIError)?.errorDescription ?? "Couldn't load this conversation."
    }
}

// MARK: - The thread kept in memory (Instant Screens)

/// The newest messages of a thread and its paging position, as the screen
/// last showed them. The optional encrypted recent copy shares this snapshot.
struct ChatThreadMemory: Codable, Equatable {
    let messages: [ChatMessageDTO]
    let oldestCursor: String?
    let hasMore: Bool
    var confirmedAt: Date?
    var syncCursors: [String: Int64]?
    var topics: [ChatConversationTopic]?
    /// In-memory seeds carry their originating storage generation. Disk reads
    /// replace this only after validating their durable history epoch.
    var cacheGeneration: Int?
}

extension ChatConversationViewModel {
    /// How many of a thread's newest messages are kept for reopening it.
    static let rememberedMessages = 100

    /// Topic windows use their own query key within the same encrypted history
    /// scope. Search context is never saved as a recent window.
    private var threadMemoryEndpoint: Endpoint? {
        guard initialTopic == nil, scrollToMessageId == nil else { return nil }
        if case let .person(otherUserId) = mode {
            return ChatEndpoints.conversationMessages(otherUserId: otherUserId, before: nil, topicId: selectedTopicId)
        }
        return latestThreadMemoryEndpoint
    }

    private var latestThreadMemoryEndpoint: Endpoint? {
        switch mode {
        case let .room(roomId):
            ChatEndpoints.roomMessages(roomId: roomId, before: nil, asBusinessUserId: asBusinessUserId)
        case let .person(otherUserId):
            ChatEndpoints.conversationMessages(otherUserId: otherUserId, before: nil, topicId: nil)
        case .ai: nil
        }
    }

    /// Shows the kept thread, if there is one. True when it did.
    private func recallThread() async -> Bool {
        guard let endpoint = threadMemoryEndpoint, let key = store.key(for: endpoint), key.account == currentUserId else { return false }
        let generation = historyGeneration
        let cacheVersion = ChatLocalStore.shared.version
        var recalled = store.seeded(endpoint, as: ChatThreadMemory.self)
        if api === APIClient.shared, recalled?.cacheGeneration != cacheVersion { recalled = nil }
        if recalled == nil, api === APIClient.shared {
            recalled = await ChatLocalStore.shared.history(
                scope: ChatLocalStore.scope(server: key.server, account: key.account), thread: key.description
            )
        }
        guard generation == historyGeneration, store.key(for: endpoint) == key, !Task.isCancelled,
              let memory = recalled, !memory.messages.isEmpty else { return false }
        guard api !== APIClient.shared || cacheVersion == ChatLocalStore.shared.version else { return false }
        messages = memory.messages
        historyCacheVersion = cacheVersion
        hasLatestHistoryWindow = true
        oldestCursor = memory.oldestCursor
        hasMore = memory.hasMore
        historyConfirmedAt = memory.confirmedAt
        syncCursors = memory.syncCursors
        if !topicsConfirmed, let savedTopics = memory.topics {
            topics = Array(savedTopics.prefix(100))
        }
        activeRoomIds = Set(messages.map(\.roomId))
        rebuild()
        return true
    }

    /// The newest page shares no message with what's held while older messages
    /// remain beyond it: messages in between may be missing.
    static func leavesGap(_ response: ChatMessagesResponse, after held: [ChatMessageDTO]) -> Bool {
        guard response.hasMore == true, !response.messages.isEmpty else { return false }
        let heldIds = Set(held.map(\.id))
        return !response.messages.contains { heldIds.contains($0.id) }
    }

    /// Keeps the newest messages for the next opening (leaving the screen).
    private func rememberThread() {
        historySaveTask?.cancel()
        historySaveTask = nil
        // Leaving context or a failed return-to-latest must never relabel an old
        // bounded window as the recent offline thread.
        guard hasLatestHistoryWindow, !isViewingSearchContext, !isViewingEarlierHistory,
              let endpoint = threadMemoryEndpoint, let key = store.key(for: endpoint), key.account == currentUserId else { return }
        guard api !== APIClient.shared || historyCacheVersion == ChatLocalStore.shared.version else { return }
        let kept = Array(messages.suffix(Self.rememberedMessages))
        let trimmed = kept.count < messages.count
        let memory = ChatThreadMemory(
            messages: kept,
            oldestCursor: trimmed ? Self.paginationCursor(for: kept.first) : oldestCursor,
            hasMore: trimmed || hasMore,
            confirmedAt: historyConfirmedAt,
            syncCursors: syncCursors,
            topics: Array(topics.prefix(100)),
            cacheGeneration: historyCacheVersion
        )
        store.seed(memory, for: endpoint)
        guard api === APIClient.shared, historyConfirmedAt != nil else { return }
        guard memory != savedHistorySnapshot || key.description != savedHistoryKey else { return }
        savedHistorySnapshot = memory
        savedHistoryKey = key.description
        guard let version = historyCacheVersion else { return }
        Task {
            await ChatLocalStore.shared.saveHistory(
                memory, scope: ChatLocalStore.scope(server: key.server, account: key.account), thread: key.description, version: version
            )
        }
    }

    private func scheduleHistorySave() {
        historySaveTask?.cancel()
        historySaveTask = Task { [weak self] in
            do { try await Task.sleep(nanoseconds: 250_000_000) } catch { return }
            self?.rememberThread()
        }
    }

    private func discardSavedThread() {
        historyAccessRefused = true
        topics = []
        topicsConfirmed = false
        activeRoomIds.removeAll()
        resetRoomJoins()
        activeThreadTracker.clear(owner: ObjectIdentifier(self))
        historySaveTask?.cancel()
        historySaveTask = nil
        historyConfirmedAt = nil
        syncCursors = nil
        savedHistorySnapshot = nil
        savedHistoryKey = nil
        hasLatestHistoryWindow = false
        messages = []
        oldestCursor = nil
        hasMore = false
        invalidateSavedThreadCache()
    }

    private func invalidateSavedThreadCache() {
        historySaveTask?.cancel()
        historySaveTask = nil
        savedHistorySnapshot = nil
        savedHistoryKey = nil
        guard let endpoint = latestThreadMemoryEndpoint, let key = store.key(for: endpoint), key.account == currentUserId else { return }
        store.removeSeeds(for: endpoint)
        store.remove(ChatEndpoints.unifiedConversations())
        store.remove(ChatEndpoints.stats())
        guard api === APIClient.shared else { return }
        ChatLocalStore.shared.removeHistory(
            scope: ChatLocalStore.scope(server: key.server, account: key.account), thread: key.description
        )
    }
}
