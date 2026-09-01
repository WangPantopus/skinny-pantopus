@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LargeClass")

package app.pantopus.android.ui.screens.inbox.conversation

import app.pantopus.android.data.ai.AIChatRepository
import app.pantopus.android.data.ai.AIChatStreamEvent
import app.pantopus.android.data.ai.AIConversationSession
import app.pantopus.android.data.api.models.ai.AIConversationsResponse
import app.pantopus.android.data.api.models.chats.ChatAttachmentDto
import app.pantopus.android.data.api.models.chats.ChatMediaUploadResponse
import app.pantopus.android.data.api.models.chats.ChatMessageDto
import app.pantopus.android.data.api.models.chats.ChatMessageSender
import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatTopic
import app.pantopus.android.data.api.models.chats.ConversationTopicsResponse
import app.pantopus.android.data.api.models.chats.CreateDirectChatResponse
import app.pantopus.android.data.api.models.chats.FindOrCreateTopicResponse
import app.pantopus.android.data.api.models.chats.SendChatMessageBody
import app.pantopus.android.data.api.models.chats.SendChatMessageResponse
import app.pantopus.android.data.api.models.chats.resolvedText
import app.pantopus.android.data.api.models.profile.UserReportRequest
import app.pantopus.android.data.api.models.profile.UserReportResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.chats.ActiveChatThread
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.links.LinkPreviewRepository
import app.pantopus.android.data.listings.ListingsRepository
import app.pantopus.android.data.location.LocationProvider
import app.pantopus.android.data.profile.UserReportsRepository
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.upload.UploadRepository
import app.pantopus.android.ui.theme.PantopusIcon
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.UUID

/**
 * Mirrors the iOS [ChatConversationViewModelTests] coverage: backend
 * load → day-divider + bubble projection, AI mode → empty welcome
 * frame, and send-failure → failed delivery state on the optimistic
 * bubble.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ChatConversationViewModelTest {
    private val repo: ChatRepository = mockk()
    private val socket: SocketManager = mockk()
    private val uploadRepo: UploadRepository = mockk()
    private val aiRepo: AIChatRepository = mockk()
    private val gigsRepo: GigsRepository = mockk(relaxed = true)
    private val listingsRepo: ListingsRepository = mockk(relaxed = true)
    private val geoApi: GeoApi = mockk(relaxed = true)
    private val locationProvider: LocationProvider = mockk(relaxed = true)
    private val blocksRepo: BlocksRepository = mockk()
    private val reportsRepo: UserReportsRepository = mockk()
    private val linkPreviewRepo: LinkPreviewRepository = mockk(relaxed = true)

    // Real instance — the singleton holder is what carries the AI
    // conversation id across VM instances within one app session.
    private val aiSession = AIConversationSession()

    // Real instance — plain holder the VM publishes viewed room ids into
    // for chat-push suppression.
    private val activeChatThread = ActiveChatThread()

    private fun makeViewModel(): ChatConversationViewModel =
        ChatConversationViewModel(
            repo,
            socket,
            uploadRepo,
            aiRepo,
            gigsRepo,
            listingsRepo,
            geoApi,
            locationProvider,
            blocksRepo,
            reportsRepo,
            linkPreviewRepo,
            aiSession,
            activeChatThread,
        )

    private val counterpartyPerson =
        ChatCounterparty.Person(
            displayName = "Maria K.",
            initials = "MK",
            locality = "Elm Park",
            verified = true,
            online = true,
        )

    private val counterpartyAi = ChatCounterparty.Ai(displayName = "Pantopus AI")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { socket.connectionState } returns MutableStateFlow(SocketManager.ConnectionState.Disconnected)
        every { socket.eventsOf(any()) } returns emptyFlow()
        coEvery { socket.emitWithAck(any(), any(), any()) } returns null
        coEvery { uploadRepo.uploadChatMedia(any(), any()) } returns
            NetworkResult.Success(ChatMediaUploadResponse(message = "ok", media = emptyList()))
        coEvery { uploadRepo.uploadAIMedia(any()) } returns
            NetworkResult.Success(
                app.pantopus.android.data.api.models.chats.AIMediaUploadResponse(
                    message = "ok",
                    images = emptyList(),
                ),
            )
        every { aiRepo.streamChat(any(), any(), any()) } returns flowOf(AIChatStreamEvent.TextDelta("Hi"), AIChatStreamEvent.Done)
        coEvery { aiRepo.conversations() } returns NetworkResult.Success(AIConversationsResponse(emptyList()))
        coEvery { repo.markRoomRead(any()) } returns NetworkResult.Success(Unit)
        coEvery { repo.markConversationRead(any()) } returns NetworkResult.Success(Unit)
        coEvery { repo.createDirectChat(any()) } returns
            NetworkResult.Success(CreateDirectChatResponse(roomId = "r1"))
        coEvery { repo.conversationTopics(any()) } returns NetworkResult.Success(ConversationTopicsResponse(emptyList()))
        coEvery { repo.findOrCreateTopic(any(), any()) } returns
            NetworkResult.Success(FindOrCreateTopicResponse(ChatTopic(id = "t1", topicType = "listing", title = "Lamp"), true))
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun message(
        id: String,
        userId: String,
        text: String,
        createdAt: String = "2026-04-20T10:00:00.000Z",
        clientMessageId: String? = null,
        topicId: String? = null,
    ): ChatMessageDto =
        ChatMessageDto(
            id = id,
            roomId = "r1",
            userId = userId,
            messageText = text,
            messageType = "text",
            topicId = topicId,
            clientMessageId = clientMessageId,
            createdAt = createdAt,
            sender = ChatMessageSender(id = userId, username = "u"),
        )

    /** Production DB shape — body in `message` / `type`, not the legacy aliases. */
    private fun canonicalMessage(
        id: String,
        userId: String,
        text: String,
        createdAt: String = "2026-04-20T10:00:00.000Z",
    ): ChatMessageDto =
        ChatMessageDto(
            id = id,
            roomId = "r1",
            userId = userId,
            message = text,
            type = "text",
            createdAt = createdAt,
            sender = ChatMessageSender(id = userId, username = "u"),
        )

    @Test fun load_projects_canonical_backend_message_field() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages = listOf(canonicalMessage(id = "m1", userId = "u_other", text = "Hey neighbor")),
                        hasMore = false,
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubble =
                loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().single().content
            val body = bubble.body as ChatBubbleBody.Text
            assertEquals("Hey neighbor", body.text)
            assertEquals("Hey neighbor", canonicalMessage(id = "x", userId = "u", text = "Hey neighbor").resolvedText)
        }

    @Test fun load_produces_loaded_with_day_divider_and_bubbles() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages =
                            listOf(
                                message(id = "m2", userId = "u_me", text = "hello", createdAt = "2026-04-20T10:00:30.000Z"),
                                message(id = "m1", userId = "u_other", text = "hi"),
                            ),
                        hasMore = false,
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            assertEquals(3, loaded.rows.size)
            assertTrue(loaded.rows.first() is ChatTimelineRow.DayDivider)
        }

    /**
     * The backend returns messages oldest-first (backend/routes/chats.js
     * fetches the newest N rows then reverses them). The initial load must
     * preserve that order — oldest bubble at the top, newest at the bottom —
     * and must never re-reverse it back to newest-first.
     */
    @Test fun load_keeps_backend_oldest_first_order() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages =
                            listOf(
                                message(id = "m_old", userId = "u_other", text = "first", createdAt = "2026-04-20T09:00:00.000Z"),
                                message(id = "m_mid", userId = "u_me", text = "second", createdAt = "2026-04-20T10:00:00.000Z"),
                                message(id = "m_new", userId = "u_other", text = "third", createdAt = "2026-04-20T11:00:00.000Z"),
                            ),
                        hasMore = false,
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubbleIds =
                loaded.rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .map { it.content.id }
            assertEquals(
                "initial load must render oldest-first (backend order), not reversed to newest-first",
                listOf("m_old", "m_mid", "m_new"),
                bubbleIds,
            )
        }

    @Test fun load_subscribes_to_backend_socket_event_names() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            verify { socket.eventsOf("message:new") }
            verify { socket.eventsOf("message:edited") }
            verify { socket.eventsOf("message:deleted") }
            verify { socket.eventsOf("message:reaction_updated") }
        }

    @Test fun load_joins_active_rooms_when_socket_connected() =
        runTest {
            every { socket.connectionState } returns MutableStateFlow(SocketManager.ConnectionState.Connected)
            coEvery { socket.emitWithAck(eq("room:join"), any(), any()) } returns
                org.json.JSONObject("""{"success":true,"messages":[]}""")
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages = listOf(message(id = "m1", userId = "u_other", text = "hi")),
                        hasMore = false,
                        roomIds = listOf("r1"),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            coVerify { socket.emitWithAck(eq("room:join"), match { it.optString("roomId") == "r1" }, any()) }
        }

    @Test fun ai_thread_starts_in_empty_for_welcome_frame() =
        runTest {
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Ai,
                counterparty = counterpartyAi,
                currentUserId = "u_me",
            )
            vm.load()
            assertTrue(vm.state.value is ChatConversationUiState.Empty)
        }

    @Test fun send_capability_prompt_starts_ai_thread_with_user_bubble() =
        runTest {
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Ai,
                counterparty = counterpartyAi,
                currentUserId = "u_me",
            )
            vm.load()
            assertTrue(vm.state.value is ChatConversationUiState.Empty)
            vm.sendCapabilityPrompt(ChatPromptChip("price", "Price a task", PantopusIcon.Hammer))
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val outgoing =
                loaded.rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .firstOrNull { it.content.side == ChatMessageSide.Outgoing }
            assertNotNull(outgoing)
            val body = outgoing!!.content.body
            assertTrue(body is ChatBubbleBody.Text)
            assertEquals("Price a task", (body as ChatBubbleBody.Text).text)
        }

    @Test fun ai_send_streams_assistant_reply() =
        runTest {
            every { aiRepo.streamChat("Hello AI", null, emptyList()) } returns
                flowOf(
                    AIChatStreamEvent.Conversation("c1"),
                    AIChatStreamEvent.TextDelta("Hello"),
                    AIChatStreamEvent.TextDelta(" there"),
                    AIChatStreamEvent.Draft(
                        ChatAIDraftCard(
                            id = "d1",
                            type = "gig",
                            title = "Hang shelves",
                            summary = "Three shelves in the living room",
                            priceLabel = "$60",
                            valid = true,
                        ),
                    ),
                    AIChatStreamEvent.Done,
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Ai,
                counterparty = counterpartyAi,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("Hello AI")
            vm.send()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val aiBubble =
                loaded.rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .firstOrNull { it.content.side == ChatMessageSide.Incoming }
            assertNotNull(aiBubble)
            val body = aiBubble!!.content.body
            assertTrue(body is ChatBubbleBody.AiReply)
            assertEquals("Hello there", (body as ChatBubbleBody.AiReply).text)
            assertEquals("Hang shelves", body.drafts.first().title)
        }

    @Test fun ai_send_uploads_images_and_passes_image_urls() =
        runTest {
            coEvery { uploadRepo.uploadAIMedia(any()) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.AIMediaUploadResponse(
                        message = "ok",
                        images =
                            listOf(
                                app.pantopus.android.data.api.models.chats.AIUploadedImage(
                                    url = "https://cdn.example/image.jpg",
                                ),
                            ),
                    ),
                )
            every { aiRepo.streamChat("Look", null, listOf("https://cdn.example/image.jpg")) } returns
                flowOf(AIChatStreamEvent.TextDelta("Nice image"), AIChatStreamEvent.Done)
            val vm = makeViewModel()
            vm.configure(mode = ChatThreadMode.Ai, counterparty = counterpartyAi, currentUserId = "u_me")
            vm.load()
            vm.queueAttachment(ChatQueuedAttachmentKind.Image, "photo.jpg", "image/jpeg", "jpg".toByteArray())
            vm.setComposerText("Look")
            vm.send()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val outgoing = loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().first { it.content.side == ChatMessageSide.Outgoing }
            assertTrue(outgoing.content.body is ChatBubbleBody.TextWithImages)
        }

    @Test fun send_failure_marks_optimistic_bubble_as_failed() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { repo.sendMessage(any<SendChatMessageBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("Hello")
            vm.send()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val outgoing =
                loaded.rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .firstOrNull { it.content.side == ChatMessageSide.Outgoing }
            assertNotNull(outgoing)
            assertEquals(ChatDeliveryState.Failed, outgoing!!.content.deliveryState)
        }

    /**
     * A person thread with no history must find-or-create the direct
     * room via `POST /api/chat/direct` and send there — and the wire
     * `clientMessageId` must be a bare UUID (`Joi.string().uuid()` on
     * the backend rejects the local row's `client_` prefix with a 400).
     */
    @Test fun send_creates_direct_room_and_posts_bare_client_message_id() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { repo.createDirectChat("u_other") } returns
                NetworkResult.Success(CreateDirectChatResponse(roomId = "r9"))
            val bodySlot = slot<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodySlot)) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                        message(id = "m_sent", userId = "u_me", text = "Hello"),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("Hello")
            vm.send()
            coVerify(exactly = 1) { repo.createDirectChat("u_other") }
            assertEquals("r9", bodySlot.captured.roomId)
            val clientMessageId = bodySlot.captured.clientMessageId
            assertNotNull(clientMessageId)
            assertTrue(
                "wire clientMessageId must be a bare UUID, got $clientMessageId",
                !clientMessageId!!.startsWith("client_"),
            )
            UUID.fromString(clientMessageId)
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            assertTrue(loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().any { it.content.id == "m_sent" })
        }

    /**
     * Retry must resend under the same `clientMessageId` so the backend
     * can dedup a send whose response was lost — and must not touch the
     * composer.
     */
    @Test fun retry_reuses_client_message_id_without_clobbering_composer() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            val bodies = mutableListOf<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodies)) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(500, null)),
                    NetworkResult.Success(
                        app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                            message(id = "m_retry", userId = "u_me", text = "Hello"),
                        ),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("Hello")
            vm.send()
            val failedRow =
                (vm.state.value as ChatConversationUiState.Loaded)
                    .rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .first { it.content.deliveryState == ChatDeliveryState.Failed }
            vm.setComposerText("draft in progress")
            vm.retry(failedRow.content.id)
            assertEquals("retry must not clobber the composer", "draft in progress", vm.composerText.value)
            assertEquals(2, bodies.size)
            assertEquals(
                "retry must reuse the original idempotency key",
                bodies[0].clientMessageId,
                bodies[1].clientMessageId,
            )
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            assertTrue(loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().any { it.content.id == "m_retry" })
        }

    /**
     * Socket events refetch the thread (`fetch(initial = true)`) — a
     * failed optimistic row must survive that, or the user silently
     * loses the message and its retry CTA.
     */
    @Test fun refetch_keeps_failed_pending_row() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(messages = listOf(message(id = "m1", userId = "u_other", text = "hi")), hasMore = false),
                )
            coEvery { repo.sendMessage(any<SendChatMessageBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("Hello")
            vm.send()
            vm.refresh()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            assertTrue(
                "failed optimistic row must survive a refetch",
                loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().any { it.content.deliveryState == ChatDeliveryState.Failed },
            )
        }

    /**
     * A fetched message carrying our `client_message_id` proves the send
     * landed server-side — the optimistic copy (and any failed mark)
     * must be retired so the row isn't duplicated.
     */
    @Test fun fetch_retires_pending_confirmed_by_client_message_id() =
        runTest {
            val bodySlot = slot<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodySlot)) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } answers {
                val rows =
                    if (bodySlot.isCaptured) {
                        listOf(
                            // Newest-first, as the backend returns them.
                            message(
                                id = "m_landed",
                                userId = "u_me",
                                text = "Hello",
                                createdAt = "2026-04-20T10:01:00.000Z",
                                clientMessageId = bodySlot.captured.clientMessageId,
                            ),
                            message(id = "m1", userId = "u_other", text = "hi"),
                        )
                    } else {
                        listOf(message(id = "m1", userId = "u_other", text = "hi"))
                    }
                NetworkResult.Success(ChatMessagesResponse(messages = rows, hasMore = false))
            }
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("Hello")
            vm.send()
            // The "failed" send actually landed: the next fetch returns it
            // under the same client_message_id.
            vm.refresh()
            val bubbles = (vm.state.value as ChatConversationUiState.Loaded).rows.filterIsInstance<ChatTimelineRow.Bubble>()
            assertEquals("confirmed pending row must not duplicate", 2, bubbles.size)
            assertTrue(bubbles.any { it.content.id == "m_landed" })
            assertTrue(
                "failed mark must clear once confirmed",
                bubbles.none { it.content.deliveryState == ChatDeliveryState.Failed },
            )
        }

    /**
     * Person threads aggregate messages from every shared room (direct +
     * gig + group), but Phase 1 always sends to the direct room. Replying
     * to a bubble that lives in a different room must drop replyToId —
     * otherwise the backend 400s "Reply target not found in this room"
     * and the row fails forever.
     */
    @Test fun reply_to_cross_room_message_drops_reply_to_id() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages =
                            listOf(
                                ChatMessageDto(
                                    id = "m_gig",
                                    roomId = "rGig",
                                    userId = "u_other",
                                    messageText = "about the gig",
                                    messageType = "text",
                                    createdAt = "2026-04-20T10:00:00.000Z",
                                    sender = ChatMessageSender(id = "u_other", username = "u"),
                                ),
                            ),
                        hasMore = false,
                    ),
                )
            coEvery { repo.createDirectChat("u_other") } returns
                NetworkResult.Success(CreateDirectChatResponse(roomId = "r1"))
            val bodySlot = slot<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodySlot)) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                        message(id = "m_sent", userId = "u_me", text = "reply"),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.beginReply("m_gig")
            vm.setComposerText("reply")
            vm.send()
            assertEquals("r1", bodySlot.captured.roomId)
            assertEquals("a cross-room reply target must be dropped", null, bodySlot.captured.replyToId)
        }

    /**
     * Replying to one's own still-sending / failed optimistic row must
     * drop replyToId — its `client_<uuid>` id is not a UUID and isn't
     * persisted, so it would 400 the whole send.
     */
    @Test fun reply_to_optimistic_row_drops_reply_to_id() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            val bodies = mutableListOf<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodies)) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(500, null)),
                    NetworkResult.Success(
                        app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                            message(id = "m_sent", userId = "u_me", text = "reply"),
                        ),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("will fail")
            vm.send()
            val optimisticId =
                (vm.state.value as ChatConversationUiState.Loaded)
                    .rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .first { it.content.deliveryState == ChatDeliveryState.Failed }
                    .content.id
            assertTrue(optimisticId.startsWith("client_"))
            vm.beginReply(optimisticId)
            vm.setComposerText("reply to my own unsent")
            vm.send()
            assertEquals(2, bodies.size)
            assertEquals("a reply to an unsent optimistic row must be dropped", null, bodies[1].replyToId)
        }

    @Test fun load_failure_transitions_error() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            assertTrue(vm.state.value is ChatConversationUiState.Error)
        }

    @Test fun load_older_paginates_backward() =
        runTest {
            val initial =
                ChatMessagesResponse(
                    messages = listOf(message(id = "m2", userId = "u_other", text = "hi")),
                    hasMore = true,
                )
            val older =
                ChatMessagesResponse(
                    messages =
                        listOf(
                            message(id = "m1", userId = "u_other", text = "earlier", createdAt = "2026-04-20T09:59:00.000Z"),
                        ),
                    hasMore = false,
                )
            coEvery {
                repo.conversationMessages(any(), any(), any(), any(), any())
            } returnsMany listOf(NetworkResult.Success(initial), NetworkResult.Success(older))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.loadOlder()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubbleIds =
                loaded.rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .map { it.content.id }
            assertTrue("expected both pages merged, got $bubbleIds", bubbleIds.containsAll(listOf("m1", "m2")))
        }

    @Test fun refresh_merges_new_message_into_loaded_thread() =
        runTest {
            val first =
                ChatMessagesResponse(
                    messages = listOf(message(id = "m1", userId = "u_other", text = "hi")),
                    hasMore = false,
                )
            val second =
                ChatMessagesResponse(
                    messages =
                        listOf(
                            message(id = "m1", userId = "u_other", text = "hi"),
                            message(id = "m2", userId = "u_other", text = "follow-up", createdAt = "2026-04-20T10:01:00.000Z"),
                        ),
                    hasMore = false,
                )
            coEvery {
                repo.conversationMessages(any(), any(), any(), any(), any())
            } returnsMany listOf(NetworkResult.Success(first), NetworkResult.Success(second))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            // Simulate realtime: server-side echo → refresh() reads
            // the merged list. handleIncoming + handleReaction both
            // call fetch(initial = true) under the hood.
            vm.refresh()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubbleIds =
                loaded.rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .map { it.content.id }
            assertTrue("expected new message merged in, got $bubbleIds", bubbleIds.contains("m2"))
        }

    @Test fun reply_send_includes_reply_to_id() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(messages = listOf(message(id = "m1", userId = "u_other", text = "hi")), hasMore = false),
                )
            val bodySlot = slot<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodySlot)) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                        message(id = "m2", userId = "u_me", text = "reply"),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.beginReply("m1")
            vm.setComposerText("reply")
            vm.send()
            assertEquals("m1", bodySlot.captured.replyToId)
        }

    @Test fun edit_updates_message_and_clears_edit_state() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(messages = listOf(message(id = "m1", userId = "u_me", text = "old")), hasMore = false),
                )
            coEvery { repo.editMessage("m1", "new") } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                        message(id = "m1", userId = "u_me", text = "new"),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.beginEdit("m1")
            assertEquals("old", vm.composerText.value)
            vm.setComposerText("new")
            vm.send()
            assertEquals(null, vm.editingMessageId.value)
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubble = loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().first { it.content.id == "m1" }
            assertEquals("new", (bubble.content.body as ChatBubbleBody.Text).text)
        }

    @Test fun delete_removes_owned_message() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(messages = listOf(message(id = "m1", userId = "u_me", text = "bye")), hasMore = false),
                )
            coEvery { repo.deleteMessage("m1") } returns NetworkResult.Success(Unit)
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.delete("m1")
            coVerify { repo.deleteMessage("m1") }
            assertTrue(vm.state.value is ChatConversationUiState.Empty)
        }

    @Test fun queued_attachment_uploads_and_sends_file_ids() =
        runTest {
            coEvery { repo.roomMessages(any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { uploadRepo.uploadChatMedia(eq("r1"), any()) } returns
                NetworkResult.Success(
                    ChatMediaUploadResponse(
                        message = "ok",
                        media =
                            listOf(
                                ChatAttachmentDto(
                                    id = "f1",
                                    fileUrl = "/api/chat/files/f1",
                                    originalFilename = "note.pdf",
                                    mimeType = "application/pdf",
                                    fileSize = 2048,
                                    fileType = "document",
                                ),
                            ),
                    ),
                )
            val bodySlot = slot<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodySlot)) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                        ChatMessageDto(
                            id = "m_file",
                            roomId = "r1",
                            userId = "u_me",
                            messageText = "Attachment",
                            messageType = "file",
                            createdAt = "2026-04-20T10:00:00.000Z",
                            attachments =
                                listOf(
                                    ChatAttachmentDto(
                                        id = "f1",
                                        fileUrl = "/api/chat/files/f1",
                                        originalFilename = "note.pdf",
                                        mimeType = "application/pdf",
                                        fileSize = 2048,
                                        fileType = "document",
                                    ),
                                ),
                        ),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Room(id = "r1"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.queueAttachment(ChatQueuedAttachmentKind.Document, "note.pdf", "application/pdf", "pdf".toByteArray())
            vm.send()
            assertEquals(listOf("f1"), bodySlot.captured.fileIds)
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubble = loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().first { it.content.id == "m_file" }
            val body = bubble.content.body as ChatBubbleBody.Attachment
            assertEquals("note.pdf", body.filename)
            assertEquals("2 KB", body.sizeLabel)
        }

    @Test fun initial_topic_creates_topic_and_filters_messages() =
        runTest {
            val topic = ChatTopic(id = "t1", topicType = "listing", topicRefId = "l1", title = "Lamp")
            coEvery { repo.findOrCreateTopic("u_other", any()) } returns
                NetworkResult.Success(FindOrCreateTopicResponse(topic, true))
            coEvery { repo.conversationTopics("u_other") } returns
                NetworkResult.Success(ConversationTopicsResponse(listOf(topic)))
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
                initialTopic = ChatInitialTopic(topicType = "listing", topicRefId = "l1", title = "Lamp"),
            )
            vm.load()
            coVerify { repo.findOrCreateTopic("u_other", any()) }
            coVerify { repo.conversationMessages("u_other", null, null, 60, "t1") }
            assertEquals("t1", vm.selectedTopicId.value)
            assertEquals("Lamp", vm.topics.value.first().title)
        }

    @Test fun load_maps_gig_offer_metadata_to_rich_card() =
        runTest {
            coEvery { repo.roomMessages("r1", any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages =
                            listOf(
                                ChatMessageDto(
                                    id = "m_gig",
                                    roomId = "r1",
                                    userId = "u_other",
                                    messageText = "Fix my fence",
                                    messageType = "gig_offer",
                                    metadata =
                                        mapOf(
                                            "gigId" to "gig-1",
                                            "title" to "Fix my fence",
                                            "category" to "Yard",
                                            "price" to 75.0,
                                            "status" to "open",
                                        ),
                                    createdAt = "2026-04-20T10:00:00.000Z",
                                ),
                            ),
                        hasMore = false,
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Room(id = "r1"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val bubble = loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().first()
            val body = bubble.content.body as ChatBubbleBody.GigOfferCard
            assertEquals("gig-1", body.card.gigId)
            assertEquals("Fix my fence", body.card.title)
            assertEquals("$75", body.card.priceLabel)
        }

    @Test fun sendGigOffer_posts_metadata_and_topic() =
        runTest {
            coEvery { repo.conversationMessages("u_other", any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            val bodySlot = slot<SendChatMessageBody>()
            coEvery { repo.sendMessage(capture(bodySlot)) } returns
                NetworkResult.Success(
                    SendChatMessageResponse(
                        message =
                            ChatMessageDto(
                                id = "m_sent",
                                roomId = "r1",
                                userId = "u_me",
                                messageText = "Fix my fence",
                                messageType = "gig_offer",
                                createdAt = "2026-04-20T10:00:00.000Z",
                            ),
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.sendGigOffer(
                ChatShareGigOption(
                    id = "gig-1",
                    title = "Fix my fence",
                    category = "Yard",
                    price = 75.0,
                    status = "open",
                ),
            )
            coVerify { repo.findOrCreateTopic("u_other", any()) }
            assertEquals("gig_offer", bodySlot.captured.messageType)
            assertEquals("gig-1", bodySlot.captured.metadata?.get("gigId"))
            assertEquals(75.0, bodySlot.captured.metadata?.get("price"))
        }

    /**
     * On the unfiltered ("All") person view, a topic change between
     * consecutive messages projects a [ChatTimelineRow.TopicDivider]
     * labelled with the topic's title (null → non-null counts as a change).
     */
    @Test fun topic_change_projects_topic_divider_row() =
        runTest {
            coEvery { repo.conversationTopics("u_other") } returns
                NetworkResult.Success(
                    ConversationTopicsResponse(
                        listOf(ChatTopic(id = "t1", topicType = "task", title = "Fence repair", status = "open")),
                    ),
                )
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages =
                            listOf(
                                // Newest-first, as the backend returns them.
                                message(
                                    id = "m2",
                                    userId = "u_other",
                                    text = "about the fence",
                                    createdAt = "2026-04-20T10:01:00.000Z",
                                    topicId = "t1",
                                ),
                                message(id = "m1", userId = "u_other", text = "hi"),
                            ),
                        hasMore = false,
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val divider = loaded.rows.filterIsInstance<ChatTimelineRow.TopicDivider>().single()
            assertEquals("Fence repair", divider.label)
            assertEquals("topic_m2", divider.rowId)
            // The divider sits between the two bubbles.
            val rowIds = loaded.rows.map { it.rowId }
            assertTrue(rowIds.indexOf("bubble_m1") < rowIds.indexOf("topic_m2"))
            assertTrue(rowIds.indexOf("topic_m2") < rowIds.indexOf("bubble_m2"))
        }

    /**
     * `POST /api/chat/messages` answers 429 `code: "PRE_BID_LIMIT"` when a
     * non-bidder exhausts the gig room's pre-bid allowance
     * (`backend/routes/chats.js:1574`) — the VM surfaces the banner copy
     * and clears it on the next successful send.
     */
    @Test fun pre_bid_limit_failure_sets_send_limit_notice() =
        runTest {
            coEvery { repo.roomMessages(any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { repo.sendMessage(any<SendChatMessageBody>()) } returns
                NetworkResult.Failure(
                    NetworkError.ClientError(
                        429,
                        """{"error":"You can send up to 3 messages before placing a bid.",""" +
                            """"code":"PRE_BID_LIMIT","messages_sent":3,"messages_limit":3}""",
                    ),
                )
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Room(id = "r1"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("one more")
            vm.send()
            assertNotNull(vm.sendLimitNotice.value)
            assertTrue(vm.sendLimitNotice.value!!.contains("Message limit reached"))
            // A later successful send clears the banner.
            coEvery { repo.sendMessage(any<SendChatMessageBody>()) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.SendChatMessageResponse(
                        message(id = "m_ok", userId = "u_me", text = "bid placed"),
                    ),
                )
            vm.setComposerText("bid placed")
            vm.send()
            assertEquals(null, vm.sendLimitNotice.value)
        }

    /** A non-PRE_BID 4xx must not raise the pre-bid banner. */
    @Test fun generic_client_error_does_not_set_send_limit_notice() =
        runTest {
            coEvery { repo.roomMessages(any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { repo.sendMessage(any<SendChatMessageBody>()) } returns
                NetworkResult.Failure(NetworkError.ClientError(400, """{"error":"Invalid payload"}"""))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Room(id = "r1"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("hello")
            vm.send()
            assertEquals(null, vm.sendLimitNotice.value)
        }

    @Test fun bulk_delete_removes_selected_messages_and_exits_selection() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(
                    ChatMessagesResponse(
                        messages =
                            listOf(
                                message(id = "m2", userId = "u_me", text = "second", createdAt = "2026-04-20T10:01:00.000Z"),
                                message(id = "m1", userId = "u_me", text = "first", createdAt = "2026-04-20T10:00:30.000Z"),
                                message(id = "m0", userId = "u_other", text = "hi"),
                            ),
                        hasMore = false,
                    ),
                )
            coEvery { repo.deleteMessage(any()) } returns NetworkResult.Success(Unit)
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.enterSelectionMode("m1")
            assertTrue(vm.isSelectionMode.value)
            vm.toggleSelection("m2")
            // The counterparty's rows are not selectable.
            vm.toggleSelection("m0")
            assertEquals(setOf("m1", "m2"), vm.selectedMessageIds.value)
            vm.deleteSelected()
            coVerify(exactly = 1) { repo.deleteMessage("m1") }
            coVerify(exactly = 1) { repo.deleteMessage("m2") }
            assertEquals(false, vm.isSelectionMode.value)
            assertTrue(vm.selectedMessageIds.value.isEmpty())
            val loaded = vm.state.value as ChatConversationUiState.Loaded
            val ids = loaded.rows.filterIsInstance<ChatTimelineRow.Bubble>().map { it.content.id }
            assertEquals(listOf("m0"), ids)
        }

    @Test fun selection_mode_rejects_optimistic_rows() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { repo.sendMessage(any<SendChatMessageBody>()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            vm.setComposerText("will fail")
            vm.send()
            val optimisticId =
                (vm.state.value as ChatConversationUiState.Loaded)
                    .rows
                    .filterIsInstance<ChatTimelineRow.Bubble>()
                    .first()
                    .content.id
            assertTrue(optimisticId.startsWith("client_"))
            vm.enterSelectionMode(optimisticId)
            assertEquals(false, vm.isSelectionMode.value)
        }

    @Test fun block_user_calls_blocks_repo_and_signals_success() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            coEvery { blocksRepo.block("u_other") } returns NetworkResult.Success(Unit)
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            var blocked = false
            vm.blockUser { blocked = true }
            coVerify(exactly = 1) { blocksRepo.block("u_other") }
            assertTrue(blocked)
        }

    @Test fun report_user_calls_reports_repo_and_signals_success() =
        runTest {
            coEvery { repo.conversationMessages(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(ChatMessagesResponse(messages = emptyList(), hasMore = false))
            val bodySlot = slot<UserReportRequest>()
            coEvery { reportsRepo.report("u_other", capture(bodySlot)) } returns
                NetworkResult.Success(UserReportResponse(message = "ok", alreadyReported = false))
            val vm = makeViewModel()
            vm.configure(
                mode = ChatThreadMode.Person(otherUserId = "u_other"),
                counterparty = counterpartyPerson,
                currentUserId = "u_me",
            )
            vm.load()
            var reported = false
            vm.reportUser(reason = "harassment", details = "  keeps spamming my inbox  ") { reported = true }
            coVerify(exactly = 1) { reportsRepo.report("u_other", any()) }
            assertEquals("harassment", bodySlot.captured.reason)
            assertEquals("keeps spamming my inbox", bodySlot.captured.details)
            assertTrue(reported)
            assertEquals(
                "Report submitted — thanks for keeping the neighborhood safe",
                vm.reportNotice.value,
            )
        }

    /**
     * The conversation id captured from the AI stream must survive the VM
     * being recreated within the same app session (singleton holder), so a
     * reopened AI thread keeps appending to the same backend conversation.
     */
    @Test fun ai_conversation_id_persists_across_vm_instances() =
        runTest {
            every { aiRepo.streamChat("Hello AI", null, emptyList()) } returns
                flowOf(AIChatStreamEvent.Conversation("c42"), AIChatStreamEvent.TextDelta("Hi"), AIChatStreamEvent.Done)
            val vm = makeViewModel()
            vm.configure(mode = ChatThreadMode.Ai, counterparty = counterpartyAi, currentUserId = "u_me")
            vm.load()
            vm.setComposerText("Hello AI")
            vm.send()
            assertEquals("c42", aiSession.conversationId)
            every { aiRepo.streamChat("Again", "c42", emptyList()) } returns
                flowOf(AIChatStreamEvent.TextDelta("Welcome back"), AIChatStreamEvent.Done)
            val second = makeViewModel()
            second.configure(mode = ChatThreadMode.Ai, counterparty = counterpartyAi, currentUserId = "u_me")
            second.load()
            second.setComposerText("Again")
            second.send()
            verify { aiRepo.streamChat("Again", "c42", emptyList()) }
        }
}
