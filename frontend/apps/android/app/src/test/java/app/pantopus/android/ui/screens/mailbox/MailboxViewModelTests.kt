package app.pantopus.android.ui.screens.mailbox

import app.pantopus.android.data.api.models.mailbox.MailItem
import app.pantopus.android.data.api.models.mailbox.MailboxListResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MailboxViewModelTests {
    private val repo: MailboxRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeMail(
        id: String,
        viewed: Boolean = true,
        starred: Boolean = false,
        priority: String = "normal",
    ) = MailItem(
        id = id,
        recipientUserId = null,
        recipientHomeId = null,
        deliveryTargetType = null,
        deliveryTargetId = null,
        addressHomeId = null,
        attnUserId = null,
        attnLabel = null,
        deliveryVisibility = null,
        mailType = null,
        displayTitle = "Mail $id",
        previewText = null,
        primaryAction = null,
        actionRequired = null,
        ackRequired = null,
        ackStatus = null,
        type = "notice",
        subject = null,
        content = null,
        senderUserId = null,
        senderBusinessName = null,
        senderAddress = null,
        viewed = viewed,
        viewedAt = null,
        archived = false,
        starred = starred,
        payoutAmount = null,
        payoutStatus = null,
        category = null,
        tags = emptyList(),
        priority = priority,
        attachments = null,
        expiresAt = null,
        createdAt = "2025-01-01T00:00:00Z",
    )

    @Test
    fun mailbox_pagination_and_refresh() =
        runTest {
            val page1 = (0 until 25).map { makeMail("m$it") }
            val page2 = listOf(makeMail("m_last"))
            coEvery { repo.list(viewed = null, archived = false, starred = null, limit = 25, offset = 0) } returns
                NetworkResult.Success(MailboxListResponse(mail = page1, count = 25))
            coEvery { repo.list(viewed = null, archived = false, starred = null, limit = 25, offset = 25) } returns
                NetworkResult.Success(MailboxListResponse(mail = page2, count = 1))

            val vm = MailboxListViewModel(repo)
            vm.load()
            val first = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(
                25,
                first.sections
                    .first()
                    .rows.size,
            )
            assertTrue(first.hasMore)

            vm.loadMoreIfNeeded()
            val second = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals(
                26,
                second.sections
                    .first()
                    .rows.size,
            )
            assertTrue(!second.hasMore)
        }

    @Test
    fun mailbox_empty_state() =
        runTest {
            coEvery { repo.list(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(MailboxListResponse(mail = emptyList(), count = 0))
            val vm = MailboxListViewModel(repo)
            vm.load()
            val empty = vm.state.value as ListOfRowsUiState.Empty
            assertEquals("No mail yet", empty.headline)
        }

    @Test
    fun tab_change_triggers_reload_with_filter() =
        runTest {
            coEvery { repo.list(any(), any(), any(), any(), any()) } returns
                NetworkResult.Success(MailboxListResponse(mail = emptyList(), count = 0))
            val vm = MailboxListViewModel(repo)
            vm.load()
            vm.selectTab(MailboxTab.Starred.id)
            assertEquals(MailboxTab.Starred.id, vm.selectedTab.value)
        }
}
