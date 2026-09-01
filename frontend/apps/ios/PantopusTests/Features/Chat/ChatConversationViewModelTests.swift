//
//  ChatConversationViewModelTests.swift
//  PantopusTests
//
//  Covers projection (day-divider + tail-grouping + outgoing/incoming
//  sides), empty state, error, optimistic send swap on success, retry
//  marker on send failure, and the AI thread's automatic empty mode.
//

// swiftlint:disable file_length

import XCTest
@testable import Pantopus

// swiftlint:disable line_length multiline_function_chains

// swiftlint:disable type_body_length
@MainActor
final class ChatConversationViewModelTests: XCTestCase {
    override func setUp() {
        super.setUp()
        URLProtocolStub.reset()
    }

    private func makeAPI() -> APIClient {
        APIClient(
            environment: .current,
            session: TestSession.make(),
            retryPolicy: .none
        )
    }

    private static let counterpartyPerson: ChatCounterparty = .person(
        name: "Maria K.",
        initials: "MK",
        locality: "Elm Park",
        verified: true,
        online: true
    )

    private static let counterpartyAI: ChatCounterparty = .ai(name: "Pantopus AI")

    private static func messagesJSON(_ rows: String..., hasMore: Bool = false) -> String {
        "{\"messages\":[\(rows.joined(separator: ","))],\"hasMore\":\(hasMore)}"
    }

    private static func messageJSON(
        id: String,
        userId: String,
        text: String,
        createdAt: String = "2026-04-20T10:00:00.000Z",
        clientMessageId: String? = nil,
        replyToId: String? = nil,
        topicId: String? = nil
    ) -> String {
        let client = clientMessageId.map { "\"\($0)\"" } ?? "null"
        let replyTo = replyToId.map { "\"\($0)\"" } ?? "null"
        let topic = topicId.map { "\"\($0)\"" } ?? "null"
        return """
        {
          "id":"\(id)","room_id":"r1","user_id":"\(userId)",
          "message_text":"\(text)","message_type":"text",
          "reply_to_id":\(replyTo),
          "client_message_id":\(client),
          "topic_id":\(topic),
          "created_at":"\(createdAt)",
          "sender":{"id":"\(userId)","username":"u","name":null,"profile_picture_url":null}
        }
        """
    }

    /// Production DB shape — body in `message` / `type`, not the legacy aliases.
    private static func canonicalMessageJSON(
        id: String,
        userId: String,
        text: String,
        createdAt: String = "2026-04-20T10:00:00.000Z"
    ) -> String {
        """
        {
          "id":"\(id)","room_id":"r1","user_id":"\(userId)",
          "message":"\(text)","type":"text",
          "created_at":"\(createdAt)",
          "sender":{"id":"\(userId)","username":"u","name":null,"profile_picture_url":null}
        }
        """
    }

    private static func socketDecoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return decoder
    }

    func testLoadDecodesCanonicalBackendMessageField() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(
                Self.canonicalMessageJSON(id: "m1", userId: "u_other", text: "Hey neighbor")
            ))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content }
            return nil
        }
        XCTAssertEqual(bubbles.count, 1)
        if case let .text(body) = bubbles[0].body {
            XCTAssertEqual(body, "Hey neighbor")
        } else {
            XCTFail("Expected text bubble, got \(bubbles[0].body)")
        }
    }

    func testLoadProducesLoadedWithDayDividerAndBubbles() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(
                Self.messageJSON(id: "m1", userId: "u_other", text: "hi"),
                Self.messageJSON(id: "m2", userId: "u_me", text: "hello", createdAt: "2026-04-20T10:00:30.000Z")
            ))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // Day divider + 2 bubbles
        XCTAssertEqual(rows.count, 3)
        if case .dayDivider = rows.first { /* ok */ } else { XCTFail("Expected day divider first") }
    }

    /// The backend returns messages oldest-first (`backend/routes/chats.js`
    /// fetches the newest N rows then `.reverse()`s them). The initial load
    /// must preserve that order — oldest bubble at the top, newest at the
    /// bottom — and must never re-reverse it back to newest-first.
    func testInitialLoadKeepsBackendOldestFirstOrder() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(
                Self.messageJSON(id: "m_old", userId: "u_other", text: "first", createdAt: "2026-04-20T09:00:00.000Z"),
                Self.messageJSON(id: "m_mid", userId: "u_me", text: "second", createdAt: "2026-04-20T10:00:00.000Z"),
                Self.messageJSON(id: "m_new", userId: "u_other", text: "third", createdAt: "2026-04-20T11:00:00.000Z")
            ))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        let bubbleIds = rows.compactMap { row -> String? in
            if case let .bubble(content) = row { return content.id }
            return nil
        }
        XCTAssertEqual(
            bubbleIds,
            ["m_old", "m_mid", "m_new"],
            "initial load must render oldest-first (backend order), not reversed to newest-first"
        )
    }

    func testAIThreadStartsInEmptyForWelcomeFrame() async {
        let vm = ChatConversationViewModel(
            mode: .ai,
            counterparty: Self.counterpartyAI,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        if case .empty = vm.state { /* ok */ } else {
            XCTFail("Expected .empty for AI welcome, got \(vm.state)")
        }
    }

    func testSendCapabilityPromptStartsAIThreadWithUserBubble() async {
        let vm = ChatConversationViewModel(
            mode: .ai,
            counterparty: Self.counterpartyAI,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        // Welcome/empty before any capability is tapped.
        if case .empty = vm.state { /* ok */ } else { XCTFail("Expected .empty welcome state") }
        await vm.sendCapabilityPrompt(ChatPromptChip(id: "price", label: "Price a task", icon: .hammer))
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after tapping a capability, got \(vm.state)")
            return
        }
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }
        let outgoing = bubbles.first { $0.side == .outgoing }
        XCTAssertNotNil(outgoing, "capability tap should append an outgoing user bubble")
        if case let .text(text)? = outgoing?.body {
            XCTAssertEqual(text, "Price a task")
        } else {
            XCTFail("Expected a text bubble carrying the capability label")
        }
    }

    func testAIThreadStreamsAssistantReply() async {
        let fakeAI = FakeAIChatStreamClient(events: [
            .conversation(id: "c1"),
            .textDelta("Hello"),
            .textDelta(" there"),
            .draft(ChatAIDraftCard(
                id: "d1",
                type: "gig",
                title: "Hang shelves",
                summary: "Three shelves in the living room",
                priceLabel: "$60",
                valid: true
            )),
            .done
        ])
        let vm = ChatConversationViewModel(
            mode: .ai,
            counterparty: Self.counterpartyAI,
            currentUserId: "u_me",
            api: makeAPI(),
            aiClient: fakeAI
        )
        await vm.load()
        vm.composerText = "Hello AI"
        await vm.send()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected loaded state")
            return
        }
        let aiBubble = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row, content.side == .incoming { return content }
            return nil
        }.first
        if case let .aiReply(text, _, drafts)? = aiBubble?.body {
            XCTAssertEqual(text, "Hello there")
            XCTAssertEqual(drafts.first?.title, "Hang shelves")
        } else {
            XCTFail("Expected streamed AI reply bubble")
        }
    }

    /// Regression: `URLSession.AsyncBytes.lines` never yields the blank
    /// line that terminates an SSE event, so the parser must dispatch on
    /// the `data:` line itself. Exercises the real `AIChatStreamClient`
    /// against the exact wire format `backend/routes/ai.js:136` emits —
    /// with the old blank-line-gated parser this yielded zero events and
    /// the chat sat on "Thinking…" forever.
    func testAIChatStreamClientParsesSSEWithoutBlankLines() async throws {
        URLProtocolStub.stub(
            path: "/api/ai/chat",
            response: URLProtocolStub.Response(
                status: 200,
                body: Data("""
                event: conversation
                data: {"conversationId":"c1","isNew":true}

                event: text_delta
                data: {"delta":"Hello"}

                event: text_delta
                data: {"delta":" there"}

                event: done
                data: {"conversationId":"c1","usage":{"inputTokens":1,"outputTokens":2},"toolCalls":0}

                event: close
                data: {}

                """.utf8),
                headers: ["Content-Type": "text/event-stream"]
            )
        )
        let client = AIChatStreamClient(session: TestSession.make())
        var events: [AIChatStreamEvent] = []
        for try await event in client.streamChat(AIChatStreamRequest(message: "hi")) {
            events.append(event)
        }
        XCTAssertEqual(events, [
            .conversation(id: "c1"),
            .textDelta("Hello"),
            .textDelta(" there"),
            .done
        ])
    }

    func testAIThreadUploadsImagesAndPassesURLs() async {
        URLProtocolStub.stub(
            path: "/api/upload/ai-media",
            response: .json("""
            {"message":"1 image(s) uploaded","images":[{"url":"https://cdn.example/image.jpg","key":"k","name":"photo.jpg","mime_type":"image/jpeg","size":3}]}
            """)
        )
        let fakeAI = FakeAIChatStreamClient(events: [.textDelta("Nice image"), .done])
        let vm = ChatConversationViewModel(
            mode: .ai,
            counterparty: Self.counterpartyAI,
            currentUserId: "u_me",
            api: makeAPI(),
            uploader: MultipartUploader(session: TestSession.make()),
            aiClient: fakeAI
        )
        await vm.load()
        vm.queueAttachment(kind: .image, filename: "photo.jpg", mimeType: "image/jpeg", data: Data("jpg".utf8))
        vm.composerText = "Look"
        await vm.send()
        XCTAssertEqual(fakeAI.lastRequest?.images, ["https://cdn.example/image.jpg"])
        guard case let .loaded(rows) = vm.state,
              case let .bubble(content)? = rows.first(where: { $0.id.hasPrefix("bubble_ai_user_") }),
              case let .textWithImages(text, urls) = content.body else {
            XCTFail("Expected outgoing image prompt bubble")
            return
        }
        XCTAssertEqual(text, "Look")
        XCTAssertEqual(urls.first?.absoluteString, "https://cdn.example/image.jpg")
    }

    func testAIActiveSampleRendersStructuredReplyWithEstimate() {
        let rows = ChatConversationSampleData.aiActiveRows
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }
        let aiBubble = bubbles.first { content in
            if case .aiReply = content.body { true } else { false }
        }
        XCTAssertNotNil(aiBubble, "active AI sample should contain an aiReply bubble")
        if case let .aiReply(_, estimate, _)? = aiBubble?.body {
            XCTAssertNotNil(estimate, "the sample AI reply should carry an estimate card")
            XCTAssertEqual(estimate?.amount, "$55–70")
        } else {
            XCTFail("Expected an aiReply body")
        }
    }

    func testSendFailureMarksClientIdAsFailed() async {
        URLProtocolStub.stub(path: "/api/chat/rooms/r1/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/rooms/r1/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(path: "/api/chat/messages", response: .json("{}", status: 500))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "Hello"
        await vm.send()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after failed send")
            return
        }
        // Should contain at least one bubble (the optimistic one) with
        // a failed delivery state.
        let bubbles = rows.compactMap {
            if case let .bubble(content) = $0 { content } else { nil }
        }
        let bubble = bubbles.first { $0.side == .outgoing }
        XCTAssertNotNil(bubble)
        XCTAssertEqual(bubble?.deliveryState, .failed)
    }

    /// A person thread with no history must find-or-create the direct
    /// room via `POST /api/chat/direct` and send there — and the wire
    /// `clientMessageId` must be a bare UUID (`Joi.string().uuid()` on
    /// the backend rejects the local row's `client_` prefix with a 400).
    func testSendCreatesDirectRoomAndPostsBareClientMessageId() async throws {
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r9\",\"otherUser\":{\"id\":\"u_other\"}}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            response: .json("""
            {"message":{"id":"m_sent","room_id":"r9","user_id":"u_me","message_text":"Hello","message_type":"text","created_at":"2026-04-20T10:00:00.000Z"}}
            """)
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "Hello"
        await vm.send()

        let directRequest = URLProtocolStub.capturedRequests.first { $0.url?.path == "/api/chat/direct" }
        XCTAssertNotNil(directRequest, "first send in an empty person thread must resolve the direct room")

        let sendRequest = try XCTUnwrap(
            URLProtocolStub.capturedRequests.first {
                $0.url?.path == "/api/chat/messages" && $0.httpMethod == "POST"
            }
        )
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(sendRequest.httpBodyData())) as? [String: Any])
        XCTAssertEqual(body["roomId"] as? String, "r9", "send must target the resolved direct room")
        let clientMessageId = try XCTUnwrap(body["clientMessageId"] as? String)
        XCTAssertFalse(clientMessageId.hasPrefix("client_"), "wire clientMessageId must be the bare UUID")
        XCTAssertNotNil(UUID(uuidString: clientMessageId), "wire clientMessageId must parse as a UUID")

        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after send")
            return
        }
        XCTAssertTrue(rows.contains { $0.id == "bubble_m_sent" }, "optimistic row should swap to the server message")
    }

    /// Retry must resend under the same `clientMessageId` so the backend
    /// can dedup a send whose response was lost — and must not touch the
    /// composer.
    func testRetryReusesClientMessageIdWithoutClobberingComposer() async throws {
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            responses: [
                .json("{}", status: 500),
                .json("""
                {"message":{"id":"m_retry","room_id":"r1","user_id":"u_me","message_text":"Hello","message_type":"text","created_at":"2026-04-20T10:00:00.000Z"}}
                """)
            ]
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "Hello"
        await vm.send()

        guard case let .loaded(rowsAfterFailure) = vm.state,
              case let .bubble(failedBubble)? = rowsAfterFailure.last(where: {
                  if case .bubble = $0 { true } else { false }
              }) else {
            XCTFail("Expected failed bubble after 500")
            return
        }
        XCTAssertEqual(failedBubble.deliveryState, .failed)

        vm.composerText = "draft in progress"
        await vm.retry(clientId: failedBubble.id)
        XCTAssertEqual(vm.composerText, "draft in progress", "retry must not clobber the composer")

        let sendBodies = try URLProtocolStub.capturedRequests
            .filter { $0.url?.path == "/api/chat/messages" && $0.httpMethod == "POST" }
            .map { try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap($0.httpBodyData())) as? [String: Any]) }
        XCTAssertEqual(sendBodies.count, 2)
        XCTAssertEqual(
            sendBodies[0]["clientMessageId"] as? String,
            sendBodies[1]["clientMessageId"] as? String,
            "retry must reuse the original idempotency key"
        )

        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after retry")
            return
        }
        XCTAssertTrue(rows.contains { $0.id == "bubble_m_retry" })
    }

    /// Socket events refetch the thread (`fetch(.merge)`) — a
    /// failed optimistic row must survive that, or the user silently
    /// loses the message and its retry CTA.
    func testRefetchKeepsFailedPendingRow() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(Self.messageJSON(id: "m1", userId: "u_other", text: "hi")))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(path: "/api/chat/messages", response: .json("{}", status: 500))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "Hello"
        await vm.send()
        await vm.refresh()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after refetch")
            return
        }
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }
        let failed = bubbles.first { $0.deliveryState == .failed }
        XCTAssertNotNil(failed, "failed optimistic row must survive a refetch")
    }

    /// A fetched message carrying our `client_message_id` proves the
    /// send landed server-side — the optimistic copy (and any failed
    /// mark) must be retired so the row isn't duplicated.
    func testFetchRetiresPendingConfirmedByClientMessageId() async throws {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(Self.messageJSON(id: "m1", userId: "u_other", text: "hi")))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(path: "/api/chat/messages", response: .json("{}", status: 500))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "Hello"
        await vm.send()

        // The "failed" send actually landed: the next fetch returns it
        // under the same client_message_id.
        let sendRequest = try XCTUnwrap(
            URLProtocolStub.capturedRequests.first {
                $0.url?.path == "/api/chat/messages" && $0.httpMethod == "POST"
            }
        )
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(sendRequest.httpBodyData())) as? [String: Any])
        let clientMessageId = try XCTUnwrap(body["clientMessageId"] as? String)
        // Stubs are first-match-wins — rebuild them so the next fetch
        // returns the landed message under our client id.
        URLProtocolStub.reset()
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(
                Self.messageJSON(id: "m1", userId: "u_other", text: "hi"),
                Self.messageJSON(
                    id: "m_landed",
                    userId: "u_me",
                    text: "Hello",
                    createdAt: "2026-04-20T10:01:00.000Z",
                    clientMessageId: clientMessageId
                )
            ))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        await vm.refresh()

        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after refetch")
            return
        }
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }
        XCTAssertEqual(bubbles.count, 2, "confirmed pending row must not duplicate")
        XCTAssertTrue(bubbles.contains { $0.id == "m_landed" })
        XCTAssertFalse(bubbles.contains { $0.deliveryState == .failed }, "failed mark must clear once confirmed")
    }

    /// Person threads aggregate messages from every shared room (direct
    /// + gig + group), but Phase 1 always sends to the direct room.
    /// Replying to a bubble that lives in a different room must drop
    /// replyToId — otherwise the backend 400s "Reply target not found in
    /// this room" and the row fails forever.
    func testReplyToCrossRoomMessageDropsReplyToId() async throws {
        let gigRow = """
        {"id":"m_gig","room_id":"rGig","user_id":"u_other","message_text":"about the gig","message_type":"text","created_at":"2026-04-20T10:00:00.000Z"}
        """
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON(gigRow)))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            response: .json("{\"message\":\(Self.messageJSON(id: "m_sent", userId: "u_me", text: "reply"))}")
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.beginReply(to: "m_gig")
        vm.composerText = "reply"
        await vm.send()
        let sendRequest = try XCTUnwrap(
            URLProtocolStub.capturedRequests.first {
                $0.url?.path == "/api/chat/messages" && $0.httpMethod == "POST"
            }
        )
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(sendRequest.httpBodyData())) as? [String: Any])
        XCTAssertEqual(body["roomId"] as? String, "r1")
        XCTAssertNil(body["replyToId"], "a cross-room reply target must be dropped to avoid a 400")
    }

    /// Replying to one's own still-sending / failed optimistic row must
    /// drop replyToId — its `client_<uuid>` id is not a UUID and isn't
    /// persisted, so it would 400 the whole send.
    func testReplyToOptimisticRowDropsReplyToId() async throws {
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            responses: [
                .json("{}", status: 500),
                .json("{\"message\":\(Self.messageJSON(id: "m_sent", userId: "u_me", text: "reply"))}")
            ]
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "will fail"
        await vm.send()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after failed send")
            return
        }
        let optimisticId = try XCTUnwrap(
            rows.compactMap { row -> ChatBubbleContent? in
                if case let .bubble(content) = row { return content } else { return nil }
            }.first { $0.deliveryState == .failed }?.id
        )
        XCTAssertTrue(optimisticId.hasPrefix("client_"))
        vm.beginReply(to: optimisticId)
        vm.composerText = "reply to my own unsent"
        await vm.send()
        let posts = URLProtocolStub.capturedRequests.filter {
            $0.url?.path == "/api/chat/messages" && $0.httpMethod == "POST"
        }
        let lastBody = try XCTUnwrap(JSONSerialization.jsonObject(with: XCTUnwrap(posts.last?.httpBodyData())) as? [String: Any])
        XCTAssertNil(lastBody["replyToId"], "a reply to an unsent optimistic row must be dropped")
    }

    func testLoadOlderPaginatesBackward() async {
        // First load: 1 message at 10:00, hasMore: true.
        // loadOlder(): 1 older message at 09:59, hasMore: false.
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            responses: [
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m2", userId: "u_other", text: "hi"),
                    hasMore: true
                )),
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m1", userId: "u_other", text: "earlier", createdAt: "2026-04-20T09:59:00.000Z"),
                    hasMore: false
                ))
            ]
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        await vm.loadOlder()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after pagination")
            return
        }
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }
        XCTAssertEqual(bubbles.count, 2, "loadOlder() should prepend the older message")
        XCTAssertTrue(bubbles.contains { $0.id == "m1" })
        XCTAssertTrue(bubbles.contains { $0.id == "m2" })
    }

    func testRefreshMergesNewMessageIntoLoadedThread() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            responses: [
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m1", userId: "u_other", text: "hi")
                )),
                // Second fetch (simulating realtime-merge handler calling refresh())
                // returns the same row plus a new server-side echo.
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m2", userId: "u_other", text: "follow-up", createdAt: "2026-04-20T10:01:00.000Z"),
                    Self.messageJSON(id: "m1", userId: "u_other", text: "hi")
                ))
            ]
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        await vm.refresh()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after refresh")
            return
        }
        let bubbles = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }
        XCTAssertEqual(bubbles.count, 2, "realtime refresh should incorporate the new message")
        XCTAssertEqual(bubbles.last?.id, "m2")
    }

    /// A socket-echo refresh() merges the newest page on top of the held
    /// history — it must not wipe pages the user paginated to (the old
    /// reload behavior reset the thread to a shimmer and dropped every
    /// older page, yanking the scroll position on each incoming message).
    func testRefreshKeepsPaginatedOlderMessages() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            responses: [
                // Initial load: newest message, more history behind it.
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m2", userId: "u_other", text: "newest"),
                    hasMore: true
                )),
                // loadOlder(): the older page.
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m1", userId: "u_other", text: "older", createdAt: "2026-04-20T09:59:00.000Z"),
                    hasMore: false
                )),
                // refresh() (socket echo): newest page again plus a reply.
                .json(Self.messagesJSON(
                    Self.messageJSON(id: "m3", userId: "u_other", text: "reply", createdAt: "2026-04-20T10:01:00.000Z"),
                    Self.messageJSON(id: "m2", userId: "u_other", text: "newest")
                ))
            ]
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        await vm.loadOlder()
        await vm.refresh()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after refresh")
            return
        }
        let bubbleIds = rows.compactMap { row -> String? in
            if case let .bubble(content) = row { return content.id } else { return nil }
        }
        XCTAssertEqual(bubbleIds, ["m1", "m2", "m3"], "refresh must keep the paginated older page and append the new reply in order")
    }

    func testReplySendIncludesReplyToId() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(Self.messageJSON(id: "m1", userId: "u_other", text: "hi")))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            response: .json("{\"message\":\(Self.messageJSON(id: "m2", userId: "u_me", text: "reply", replyToId: "m1"))}")
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.beginReply(to: "m1")
        vm.composerText = "reply"
        await vm.send()
        guard case let .loaded(rows) = vm.state,
              case let .bubble(content)? = rows.first(where: { $0.id == "bubble_m2" }) else {
            XCTFail("Expected reply bubble")
            return
        }
        XCTAssertEqual(content.replyPreview?.messageId, "m1")
        XCTAssertEqual(content.replyPreview?.text, "hi")
    }

    func testEditUpdatesMessageAndClearsEditState() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(Self.messageJSON(id: "m1", userId: "u_me", text: "old")))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages/m1",
            response: .json("{\"message\":\(Self.messageJSON(id: "m1", userId: "u_me", text: "new"))}")
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.beginEdit(messageId: "m1")
        XCTAssertEqual(vm.composerText, "old")
        vm.composerText = "new"
        await vm.send()
        XCTAssertNil(vm.editingMessageId)
        guard case let .loaded(rows) = vm.state,
              case let .bubble(content)? = rows.first(where: { $0.id == "bubble_m1" }),
              case let .text(text) = content.body else {
            XCTFail("Expected edited bubble")
            return
        }
        XCTAssertEqual(text, "new")
    }

    func testDeleteRemovesOwnedMessage() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(Self.messageJSON(id: "m1", userId: "u_me", text: "bye")))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/messages/m1", response: .empty)
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        await vm.delete(messageId: "m1")
        if case .empty = vm.state { /* ok */ } else {
            XCTFail("Expected empty after deleting only message, got \(vm.state)")
        }
    }

    func testQueuedAttachmentUploadsAndRendersAttachmentBubble() async {
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(
            path: "/api/upload/chat-media/r1",
            response: .json("""
            {"message":"1 file(s) uploaded","media":[{"id":"f1","file_url":"/api/chat/files/f1","original_filename":"note.pdf","mime_type":"application/pdf","file_size":2048,"file_type":"document"}]}
            """)
        )
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            response: .json("""
            {"message":{"id":"m_file","room_id":"r1","user_id":"u_me","message_text":"Attachment",
            "message_type":"file","created_at":"2026-04-20T10:00:00.000Z",
            "attachments":[{"id":"f1","file_url":"/api/chat/files/f1","original_filename":"note.pdf",
            "mime_type":"application/pdf","file_size":2048,"file_type":"document"}]}}
            """)
        )
        let vm = ChatConversationViewModel(
            mode: .room(id: "r1"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI(),
            uploader: MultipartUploader(session: TestSession.make())
        )
        await vm.load()
        vm.queueAttachment(kind: .document, filename: "note.pdf", mimeType: "application/pdf", data: Data("pdf".utf8))
        await vm.send()
        guard case let .loaded(rows) = vm.state,
              case let .bubble(content)? = rows.first(where: { $0.id == "bubble_m_file" }),
              case let .attachment(filename, sizeLabel) = content.body else {
            XCTFail("Expected attachment bubble")
            return
        }
        XCTAssertEqual(filename, "note.pdf")
        XCTAssertEqual(sizeLabel, "2 KB")
    }

    func testInitialTopicCreatesTopicAndFiltersMessages() async throws {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/topics",
            responses: [
                .json("""
                {"topic":{"id":"t1","topic_type":"listing","topic_ref_id":"11111111-1111-1111-1111-111111111111",
                "title":"Lamp","status":"active","last_activity_at":"2026-04-20T10:00:00.000Z"},"created":true}
                """),
                .json("""
                {"topics":[{"id":"t1","topic_type":"listing","topic_ref_id":"11111111-1111-1111-1111-111111111111","title":"Lamp","status":"active","last_activity_at":"2026-04-20T10:00:00.000Z"}]}
                """)
            ]
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            initialTopic: ChatInitialTopic(
                topicType: "listing",
                topicRefId: "11111111-1111-1111-1111-111111111111",
                title: "Lamp"
            ),
            api: makeAPI()
        )
        await vm.load()
        XCTAssertEqual(vm.selectedTopicId, "t1")
        XCTAssertEqual(vm.topics.first?.title, "Lamp")
        let messageRequest = try XCTUnwrap(
            URLProtocolStub.capturedRequests.first {
                $0.url?.path == "/api/chat/conversations/u_other/messages"
            }
        )
        XCTAssertEqual(
            try URLComponents(url: XCTUnwrap(messageRequest.url), resolvingAgainstBaseURL: false)?
                .queryItems?
                .first { $0.name == "topicId" }?
                .value,
            "t1"
        )
    }

    func testRealtimeBadgePayloadDecodesCurrentAndLegacyShapes() throws {
        let decoder = Self.socketDecoder()
        let current = try decoder.decode(ChatBadgeUpdate.self, from: Data(#"{"unread_messages":5}"#.utf8))
        XCTAssertEqual(current.totalUnread, 5)
        let legacy = try decoder.decode(ChatBadgeUpdate.self, from: Data(#"{"total_unread":3}"#.utf8))
        XCTAssertEqual(legacy.totalUnread, 3)
    }

    func testRealtimeDeletePayloadDecodesMessageIdShape() throws {
        let payload = try Self.socketDecoder().decode(
            ChatRealtimeMessageDelete.self,
            from: Data(#"{"message_id":"m1","room_id":"r1"}"#.utf8)
        )
        XCTAssertEqual(payload.id, "m1")
        XCTAssertEqual(payload.roomId, "r1")
    }

    func testRealtimeEditPayloadDecodesNestedMessageShape() throws {
        let payload = try Self.socketDecoder().decode(
            ChatRealtimeMessageUpdate.self,
            from: Data("""
            {
              "message_id": "m1",
              "message": {
                "id": "m1",
                "room_id": "r1",
                "user_id": "u1",
                "message_text": "Edited",
                "message_type": "text",
                "created_at": "2026-04-20T10:00:00.000Z",
                "edited_at": "2026-04-20T10:01:00.000Z"
              }
            }
            """.utf8)
        )
        XCTAssertEqual(payload.id, "m1")
        XCTAssertEqual(payload.roomId, "r1")
        XCTAssertEqual(payload.messageText, "Edited")
        XCTAssertEqual(payload.editedAt, "2026-04-20T10:01:00.000Z")
    }

    func testRoomJoinAckDecodesBackfillMessages() throws {
        let ack = try JSONDecoder().decode(
            ChatRoomJoinAck.self,
            from: Data("""
            {
              "success": true,
              "messages": [
                {
                  "id": "m1",
                  "room_id": "r1",
                  "user_id": "u1",
                  "message_text": "Backfill",
                  "message_type": "text",
                  "created_at": "2026-04-20T10:00:00.000Z"
                }
              ]
            }
            """.utf8)
        )
        XCTAssertTrue(ack.success)
        XCTAssertEqual(ack.messages?.first?.id, "m1")
    }

    func testLoadMapsGigOfferMetadataToRichCard() async {
        let gigRow = """
        {
          "id":"m_gig","room_id":"r1","user_id":"u_other",
          "message_text":"Fix my fence","message_type":"gig_offer",
          "metadata":{"gigId":"gig-1","title":"Fix my fence","price":75,"category":"Yard","status":"open"},
          "created_at":"2026-04-20T10:00:00.000Z"
        }
        """
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON(gigRow)))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        guard case let .loaded(rows) = vm.state,
              case let .bubble(content)? = rows.first(where: { $0.id == "bubble_m_gig" }),
              case let .gigOfferCard(card) = content.body else {
            XCTFail("Expected gig offer rich card")
            return
        }
        XCTAssertEqual(card.gigId, "gig-1")
        XCTAssertEqual(card.title, "Fix my fence")
        XCTAssertEqual(card.priceLabel, "$75")
    }

    func testChatMessageDecodesTopicId() throws {
        let dto = try JSONDecoder().decode(
            ChatMessageDTO.self,
            from: Data(Self.messageJSON(id: "m1", userId: "u_me", text: "hi", topicId: "t1").utf8)
        )
        XCTAssertEqual(dto.topicId, "t1")
        XCTAssertEqual(dto.replacingReactions([]).topicId, "t1", "replacingReactions must carry topicId through")
    }

    /// In the unfiltered "All" person view, a topicId change between
    /// consecutive messages inserts a labeled topic divider (nil →
    /// non-nil counts as a change). Requires the pair to have ≥1 topic.
    func testTopicDividerInsertedBetweenTopicChanges() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/topics",
            response: .json("""
            {"topics":[{"id":"t1","topic_type":"task","topic_ref_id":null,
            "title":"Fix my fence","status":"active","last_activity_at":null}]}
            """)
        )
        // Backend returns newest-first.
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(
                Self.messageJSON(
                    id: "m2",
                    userId: "u_other",
                    text: "about the fence",
                    createdAt: "2026-04-20T10:01:00.000Z",
                    topicId: "t1"
                ),
                Self.messageJSON(id: "m1", userId: "u_other", text: "hi")
            ))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded, got \(vm.state)")
            return
        }
        // day divider, bubble m1, topic divider, bubble m2
        XCTAssertEqual(rows.count, 4)
        guard case let .topicDivider(divider)? = rows.first(where: {
            if case .topicDivider = $0 { true } else { false }
        }) else {
            XCTFail("Expected a topic divider row")
            return
        }
        XCTAssertEqual(divider.label, "Fix my fence")
        XCTAssertEqual(rows[2].id, "topic_m2", "divider id must be stable (message starting the segment)")
        XCTAssertEqual(rows[3].id, "bubble_m2", "divider must sit directly above the topic's first message")
    }

    /// A 429 `PRE_BID_LIMIT` send rejection surfaces the dismissible
    /// composer notice (and still marks the optimistic row failed).
    func testPreBidLimitMapsToSendLimitNotice() async {
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            response: .json("""
            {"error":"You can send up to 3 messages before placing a bid. Place a bid to continue chatting.",
            "code":"PRE_BID_LIMIT","messages_sent":3,"messages_limit":3}
            """, status: 429)
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        vm.composerText = "one more"
        await vm.send()
        XCTAssertEqual(
            vm.sendLimitNotice,
            "Message limit reached — place a bid or wait for acceptance to keep chatting."
        )
        guard case let .loaded(rows) = vm.state else {
            XCTFail("Expected .loaded after rejected send")
            return
        }
        let failed = rows.compactMap { row -> ChatBubbleContent? in
            if case let .bubble(content) = row { return content } else { return nil }
        }.first { $0.deliveryState == .failed }
        XCTAssertNotNil(failed, "the optimistic row still shows the failed/retry state")
        vm.dismissSendLimitNotice()
        XCTAssertNil(vm.sendLimitNotice)
    }

    func testBulkDeleteRemovesSelectedMessages() async {
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/messages",
            response: .json(Self.messagesJSON(
                Self.messageJSON(id: "m2", userId: "u_me", text: "second", createdAt: "2026-04-20T10:01:00.000Z"),
                Self.messageJSON(id: "m1", userId: "u_me", text: "first")
            ))
        )
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/messages/m1", response: .empty)
        URLProtocolStub.stub(path: "/api/chat/messages/m2", response: .empty)
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        await vm.bulkDelete(ids: ["m1", "m2"])
        if case .empty = vm.state { /* ok */ } else {
            XCTFail("Expected empty after bulk-deleting every message, got \(vm.state)")
        }
        let deletes = URLProtocolStub.capturedRequests.filter { $0.httpMethod == "DELETE" }
        XCTAssertEqual(deletes.compactMap(\.url?.path).sorted(), ["/api/chat/messages/m1", "/api/chat/messages/m2"])
    }

    func testBlockCounterpartyPostsToBlockEndpoint() async {
        URLProtocolStub.stub(path: "/api/users/u_other/block", response: .json("{\"success\":true}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        let blocked = await vm.blockCounterparty()
        XCTAssertTrue(blocked)
        let request = URLProtocolStub.capturedRequests.first { $0.url?.path == "/api/users/u_other/block" }
        XCTAssertNotNil(request, "block must hit POST /api/users/:userId/block")
        XCTAssertEqual(request?.httpMethod, "POST")
    }

    func testReportCounterpartyPostsToReportEndpoint() async {
        URLProtocolStub.stub(path: "/api/users/u_other/report", response: .json("{\"success\":true}"))
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        let reported = await vm.reportCounterparty(reason: "spam", details: "Keeps posting ads")
        XCTAssertTrue(reported)
        let request = URLProtocolStub.capturedRequests.first { $0.url?.path == "/api/users/u_other/report" }
        XCTAssertNotNil(request, "report must hit POST /api/users/:userId/report")
        XCTAssertEqual(request?.httpMethod, "POST")
    }

    /// Reopening the AI thread within the same app session must
    /// continue the same backend conversation — the conversation id the
    /// stream yields is kept in `AIConversationStore` and re-seeded
    /// into the next VM instance.
    func testAIConversationIdPersistsAcrossVMInstances() async {
        let store = AIConversationStore()
        let firstClient = FakeAIChatStreamClient(events: [.conversation(id: "c1"), .textDelta("Hi"), .done])
        let firstVM = ChatConversationViewModel(
            mode: .ai,
            counterparty: Self.counterpartyAI,
            currentUserId: "u_me",
            api: makeAPI(),
            aiClient: firstClient,
            aiConversationStore: store
        )
        await firstVM.load()
        firstVM.composerText = "Hello"
        await firstVM.send()
        XCTAssertNil(firstClient.lastRequest?.conversationId, "first message starts without a conversation id")

        let secondClient = FakeAIChatStreamClient(events: [.textDelta("Again"), .done])
        let secondVM = ChatConversationViewModel(
            mode: .ai,
            counterparty: Self.counterpartyAI,
            currentUserId: "u_me",
            api: makeAPI(),
            aiClient: secondClient,
            aiConversationStore: store
        )
        await secondVM.load()
        secondVM.composerText = "Continue"
        await secondVM.send()
        XCTAssertEqual(secondClient.lastRequest?.conversationId, "c1", "a new VM must resume the stored conversation")
    }

    func testSendGigOfferPostsMetadataAndTopic() async throws {
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/messages", response: .json(Self.messagesJSON()))
        URLProtocolStub.stub(path: "/api/chat/conversations/u_other/read", response: .json("{}"))
        URLProtocolStub.stub(path: "/api/chat/direct", response: .json("{\"roomId\":\"r1\"}"))
        URLProtocolStub.stub(
            path: "/api/chat/conversations/u_other/topics",
            responses: [
                .json("{\"topics\":[]}"),
                .json("""
                {"topic":{"id":"t1","topic_type":"task","topic_ref_id":"gig-1","title":"Fix my fence","status":"active"},"created":true}
                """),
                .json("{\"topics\":[]}")
            ]
        )
        URLProtocolStub.stub(
            path: "/api/chat/messages",
            response: .json("""
            {"message":{"id":"m_sent","room_id":"r1","user_id":"u_me","message_text":"Fix my fence","message_type":"gig_offer","created_at":"2026-04-20T10:00:00.000Z"}}
            """)
        )
        let vm = ChatConversationViewModel(
            mode: .person(otherUserId: "u_other"),
            counterparty: Self.counterpartyPerson,
            currentUserId: "u_me",
            api: makeAPI()
        )
        await vm.load()
        await vm.sendGigOffer(
            ChatShareGigOption(id: "gig-1", title: "Fix my fence", category: "Yard", price: 75, status: "open")
        )
        let sendRequest = try XCTUnwrap(
            URLProtocolStub.capturedRequests.first {
                $0.url?.path == "/api/chat/messages" && $0.httpMethod == "POST"
            }
        )
        let bodyData = try XCTUnwrap(sendRequest.httpBodyData())
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: bodyData) as? [String: Any])
        XCTAssertEqual(json["messageType"] as? String, "gig_offer")
        let metadata = json["metadata"] as? [String: Any]
        XCTAssertEqual(metadata?["gigId"] as? String, "gig-1")
        XCTAssertEqual(metadata?["price"] as? Double, 75)
        XCTAssertEqual(json["topicId"] as? String, "t1")
    }
}

private extension URLRequest {
    func httpBodyData() -> Data? {
        if let direct = httpBody { return direct }
        guard let stream = httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}

private final class FakeAIChatStreamClient: AIChatStreaming, @unchecked Sendable {
    let events: [AIChatStreamEvent]
    private(set) var lastRequest: AIChatStreamRequest?

    init(events: [AIChatStreamEvent]) {
        self.events = events
    }

    func streamChat(_ request: AIChatStreamRequest) -> AsyncThrowingStream<AIChatStreamEvent, any Error> {
        lastRequest = request
        return AsyncThrowingStream { continuation in
            for event in events {
                continuation.yield(event)
            }
            continuation.finish()
        }
    }
}
