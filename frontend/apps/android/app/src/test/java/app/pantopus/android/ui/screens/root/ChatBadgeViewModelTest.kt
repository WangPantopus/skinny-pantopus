package app.pantopus.android.ui.screens.root

import app.pantopus.android.data.api.models.chats.ChatStats
import app.pantopus.android.data.api.models.chats.ChatStatsResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatBadgeCoordinator
import app.pantopus.android.data.chats.ChatConversationPreferences
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.realtime.SocketManager
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
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
        every { socket.connectionState } returns MutableStateFlow(SocketManager.ConnectionState.Disconnected)
        every { preferences.mutedKeys() } returns emptySet()
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test fun init_seeds_unread_messages_from_stats() =
        runTest {
            coEvery { repo.stats() } returns
                NetworkResult.Success(ChatStatsResponse(ChatStats(totalUnread = 7)))
            coEvery { repo.unifiedConversations(any()) } returns
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.chats.UnifiedConversationsResponse(emptyList()),
                )
            val vm = ChatBadgeViewModel(repo, socket, preferences, badgeCoordinator)
            assertEquals(7, vm.unreadMessages.value)
        }

    @Test fun badge_unread_count_accepts_backend_and_expo_shapes() {
        assertEquals(1, JSONObject("""{"total_unread":1}""").badgeUnreadCount())
        assertEquals(2, JSONObject("""{"totalUnread":2}""").badgeUnreadCount())
        assertEquals(3, JSONObject("""{"unread_messages":3}""").badgeUnreadCount())
        assertEquals(4, JSONObject("""{"unreadMessages":4}""").badgeUnreadCount())
    }
}
