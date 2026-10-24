package app.pantopus.android.ui.screens.root

import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.store.Stored
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ChatBadgeViewModelTest {
    private val repo: ChatRepository = mockk()
    private val socket: SocketManager = mockk()
    private val preferences: ChatConversationPreferences = mockk(relaxed = true)
    private val badgeCoordinator = ChatBadgeCoordinator()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        every { socket.eventsOf(any()) } returns emptyFlow()
        // badge:update is read through the session-scoped stream, so an old socket's event can't update this account.
        every { socket.scopedEventsOf<suspend (Int, Int?) -> Boolean>("badge:update", any()) } returns emptyFlow()
        every { socket.connectionState } returns MutableStateFlow(SocketManager.ConnectionState.Disconnected)
        every { preferences.mutedKeys() } returns emptySet()
        // No saved list on the phone in these tests.
        every { repo.conversationsCopy() } returns null
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test fun init_seeds_unread_messages_from_the_list() =
        runTest {
            // The badge reads the Messages list through the store (Instant Screens): its own unread total.
            coEvery { repo.conversationsStored(any()) } returns
                Stored(
                    app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse(emptyList(), totalUnread = 7),
                    fetchedAt = System.currentTimeMillis(),
                )
            val vm = ChatBadgeViewModel(repo, socket, preferences, badgeCoordinator)
            assertEquals(7, vm.unreadMessages.value)
            // Live totals come only through the session-scoped badge stream.
            verify(exactly = 1) { socket.scopedEventsOf<suspend (Int, Int?) -> Boolean>("badge:update", any()) }
            verify(exactly = 0) { socket.eventsOf("badge:update") }
        }

    @Test fun badge_unread_count_accepts_backend_and_expo_shapes() {
        assertEquals(1, JSONObject("""{"total_unread":1}""").badgeUnreadCount())
        assertEquals(2, JSONObject("""{"totalUnread":2}""").badgeUnreadCount())
        assertEquals(3, JSONObject("""{"unread_messages":3}""").badgeUnreadCount())
        assertEquals(4, JSONObject("""{"unreadMessages":4}""").badgeUnreadCount())
    }
}
