@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.inbox.search

import app.pantopus.android.data.api.models.chats.ChatMessageDto
import app.pantopus.android.data.api.models.chats.ChatMessagesResponse
import app.pantopus.android.data.api.models.chats.ChatOtherIdentity
import app.pantopus.android.data.api.models.chats.UnifiedConversationDto
import app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatRepository
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatSearchViewModelTest {
    private val repo: ChatRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun listResponse() =
        UnifiedConversationsResponse(
            conversations =
                listOf(
                    UnifiedConversationDto(
                        type = "conversation",
                        otherParticipantId = "u1",
                        otherParticipantName = "Marcus R.",
                        otherParticipantIdentity =
                            ChatOtherIdentity(identityKind = "personal", verified = true),
                        totalUnread = 1,
                        lastMessageAt = "2026-04-20T10:00:00Z",
                        lastMessagePreview = "Can you start at 9?",
                    ),
                    UnifiedConversationDto(
                        type = "room",
                        id = "g1",
                        roomType = "group",
                        roomName = "Rose Court Block",
                        totalUnread = 0,
                        lastMessagePreview = "See you Sunday",
                    ),
                ),
            total = 2,
            totalUnread = 1,
        )

    private fun u1Messages() =
        ChatMessagesResponse(
            messages =
                listOf(
                    ChatMessageDto(
                        id = "m_u1",
                        roomId = "r1",
                        userId = "u1",
                        messageText = "Sounds good, see you then.",
                        createdAt = "2026-04-20T10:00:00Z",
                    ),
                ),
            hasMore = false,
        )

    private fun g1Messages() =
        ChatMessagesResponse(
            messages =
                listOf(
                    ChatMessageDto(
                        id = "m_g1",
                        roomId = "g1",
                        userId = "u9",
                        messageText = "I'll grab the folding chairs. Anyone bringing ice?",
                        createdAt = "2026-04-19T12:00:00Z",
                    ),
                ),
            hasMore = false,
        )

    private fun stubIndex() {
        coEvery { repo.unifiedConversations() } returns NetworkResult.Success(listResponse())
        coEvery { repo.conversationMessages("u1") } returns NetworkResult.Success(u1Messages())
        coEvery { repo.roomMessages("g1") } returns NetworkResult.Success(g1Messages())
    }

    @Test fun load_clears_loading() =
        runTest {
            stubIndex()
            val vm = ChatSearchViewModel(repo)
            vm.load()
            assertFalse(vm.isLoading.value)
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun name_match_has_no_scroll_target_and_preview_snippet() =
        runTest {
            stubIndex()
            val vm = ChatSearchViewModel(repo)
            vm.load()
            vm.setQuery("marcus")
            assertEquals(1, vm.results.value.size)
            val result = vm.results.value.first()
            assertEquals("u1", result.conversationId)
            assertEquals(ChatSearchResultKind.Dm, result.kind)
            assertNull(result.matchedMessageId)
            assertEquals("Can you start at 9?", result.snippet)
        }

    @Test fun body_match_carries_message_id_and_snippet() =
        runTest {
            stubIndex()
            val vm = ChatSearchViewModel(repo)
            vm.load()
            vm.setQuery("chairs")
            assertEquals(1, vm.results.value.size)
            val result = vm.results.value.first()
            assertEquals("g1", result.conversationId)
            assertEquals(ChatSearchResultKind.Group, result.kind)
            assertEquals("m_g1", result.matchedMessageId)
            assertTrue(result.snippet.contains("chairs", ignoreCase = true))
        }

    @Test fun case_insensitive_match() =
        runTest {
            stubIndex()
            val vm = ChatSearchViewModel(repo)
            vm.load()
            vm.setQuery("MARCUS")
            assertEquals("u1", vm.results.value.first().conversationId)
        }

    @Test fun no_match_yields_empty() =
        runTest {
            stubIndex()
            val vm = ChatSearchViewModel(repo)
            vm.load()
            vm.setQuery("zzzzz")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun clearing_query_resets_results() =
        runTest {
            stubIndex()
            val vm = ChatSearchViewModel(repo)
            vm.load()
            vm.setQuery("marcus")
            assertFalse(vm.results.value.isEmpty())
            vm.setQuery("")
            assertTrue(vm.results.value.isEmpty())
        }

    @Test fun conversation_list_failure_degrades_to_empty() =
        runTest {
            coEvery { repo.unifiedConversations() } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = ChatSearchViewModel(repo)
            vm.load()
            vm.setQuery("marcus")
            assertFalse(vm.isLoading.value)
            assertTrue(vm.results.value.isEmpty())
        }

    // ─── Text helpers ───────────────────────────────────────

    @Test fun snippet_windows_long_body_around_match() {
        val body = "lorem ipsum ".repeat(8) + "the chairs are here " + "tail ".repeat(8)
        val snippet = ChatSearchText.snippet(body, "chairs", maxLength = 60)
        assertTrue(snippet.contains("chairs"))
        assertTrue(snippet.startsWith("…"))
        assertTrue(snippet.length <= 62)
    }

    @Test fun snippet_returns_short_body_whole() {
        assertEquals("short message", ChatSearchText.snippet("short message", "short"))
    }

    @Test fun highlighted_styles_matched_run() {
        val annotated = ChatSearchText.highlighted("Meet Maria today", "maria")
        assertEquals("Meet Maria today", annotated.text)
        assertTrue(annotated.spanStyles.isNotEmpty())
    }

    @Test fun highlighted_blank_query_is_plain() {
        val annotated = ChatSearchText.highlighted("Plain text", "")
        assertTrue(annotated.spanStyles.isEmpty())
    }
}
