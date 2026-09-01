@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.routing_queue

import app.pantopus.android.data.api.models.mailbox.v2.PendingItemDto
import app.pantopus.android.data.api.models.mailbox.v2.PendingMailDto
import app.pantopus.android.data.api.models.mailbox.v2.PendingResponse
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingRequest
import app.pantopus.android.data.api.models.mailbox.v2.ResolveRoutingResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.mailbox.MailboxRepository
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Coverage for the mail routing queue behind the Mailbox root's
 * "N items need routing" banner. Mirrors iOS
 * `MailRoutingQueueViewModelTests`.
 *   GET  /api/mailbox/v2/pending  (`backend/routes/mailboxV2.js:612`)
 *   POST /api/mailbox/v2/resolve  (`backend/routes/mailboxV2.js:555`)
 */
@OptIn(ExperimentalCoroutinesApi::class)
class MailRoutingQueueViewModelTest {
    private val repo: MailboxRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun twoPending() =
        PendingResponse(
            listOf(
                PendingItemDto(
                    mailId = "m-1",
                    recipientNameRaw = "M. Kovacs",
                    mail =
                        PendingMailDto(
                            subject = "Water bill",
                            previewText = "Due soon",
                            senderDisplay = "EBMUD",
                        ),
                ),
                PendingItemDto(
                    mailId = "m-2",
                    recipientNameRaw = "Marcus K",
                    mail = PendingMailDto(subject = "Notice", senderBusinessName = "City of Elm Park"),
                ),
            ),
        )

    @Test
    fun emptyQueueRendersAllClear() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Success(PendingResponse(emptyList()))
            val vm = MailRoutingQueueViewModel(repo)
            vm.load()

            assertTrue(vm.state.value is MailRoutingQueueUiState.Empty)
        }

    @Test
    fun loadProjectsFirstItemAndCounter() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Success(twoPending())
            val vm = MailRoutingQueueViewModel(repo)
            vm.load()

            val loaded = vm.state.value as MailRoutingQueueUiState.Loaded
            assertEquals("m-1", loaded.entry.mailId)
            assertEquals("M. Kovacs", loaded.entry.recipientName)
            assertEquals("EBMUD", loaded.entry.senderDisplay)
            assertEquals("Due soon", loaded.entry.previewText)
            assertEquals("1 of 2", loaded.counterLabel)
            assertFalse(loaded.canSubmit)
        }

    @Test
    fun aliasToggleOnlyOfferedForPersonalDrawer() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Success(twoPending())
            val vm = MailRoutingQueueViewModel(repo)
            vm.load()

            vm.select(MailRoutingDrawerOption.Home)
            assertFalse((vm.state.value as MailRoutingQueueUiState.Loaded).showsAliasToggle)

            vm.select(MailRoutingDrawerOption.Personal)
            val loaded = vm.state.value as MailRoutingQueueUiState.Loaded
            assertTrue(loaded.showsAliasToggle)
            assertEquals("Add “M. Kovacs” as my alias", loaded.aliasLabel)
        }

    @Test
    fun resolveAdvancesToNextItem() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Success(twoPending())
            val request = slot<ResolveRoutingRequest>()
            coEvery { repo.resolve(capture(request)) } returns
                NetworkResult.Success(ResolveRoutingResponse(message = "Routing resolved", drawer = "home"))

            val vm = MailRoutingQueueViewModel(repo)
            vm.load()
            vm.select(MailRoutingDrawerOption.Home)
            vm.submit()

            assertEquals("m-1", request.captured.mailId)
            assertEquals("home", request.captured.drawer)
            assertNull(request.captured.addAlias)

            val loaded = vm.state.value as MailRoutingQueueUiState.Loaded
            assertEquals("m-2", loaded.entry.mailId)
            assertEquals("2 of 2", loaded.counterLabel)
            assertNull(loaded.selection)
            assertFalse(vm.shouldDismiss.value)
        }

    @Test
    fun aliasIsSentWhenTheToggleIsOn() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Success(twoPending())
            val request = slot<ResolveRoutingRequest>()
            coEvery { repo.resolve(capture(request)) } returns
                NetworkResult.Success(ResolveRoutingResponse(message = "Routing resolved", drawer = "personal"))

            val vm = MailRoutingQueueViewModel(repo)
            vm.load()
            vm.select(MailRoutingDrawerOption.Personal)
            vm.setAddAlias(true)
            vm.submit()

            assertEquals(true, request.captured.addAlias)
            assertEquals("M. Kovacs", request.captured.aliasString)
        }

    @Test
    fun resolvingLastItemRequestsDismiss() =
        runTest {
            coEvery { repo.pending() } returns
                NetworkResult.Success(
                    PendingResponse(
                        listOf(
                            PendingItemDto(
                                mailId = "m-1",
                                recipientNameRaw = "M. Kovacs",
                                mail = PendingMailDto(subject = "Water bill"),
                            ),
                        ),
                    ),
                )
            coEvery { repo.resolve(any()) } returns
                NetworkResult.Success(ResolveRoutingResponse(message = "Routing resolved", drawer = "personal"))

            val vm = MailRoutingQueueViewModel(repo)
            vm.load()
            vm.select(MailRoutingDrawerOption.Personal)
            vm.submit()

            assertTrue(vm.shouldDismiss.value)
        }

    @Test
    fun resolveFailureSurfacesToastAndKeepsItem() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Success(twoPending())
            coEvery { repo.resolve(any()) } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val vm = MailRoutingQueueViewModel(repo)
            vm.load()
            vm.select(MailRoutingDrawerOption.Business)
            vm.submit()

            val loaded = vm.state.value as MailRoutingQueueUiState.Loaded
            assertEquals("m-1", loaded.entry.mailId)
            assertFalse(loaded.isSubmitting)
            assertNotNull(vm.toast.value)
        }

    @Test
    fun fetchFailureSurfacesError() =
        runTest {
            coEvery { repo.pending() } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = MailRoutingQueueViewModel(repo)
            vm.load()

            assertTrue(vm.state.value is MailRoutingQueueUiState.Error)
        }
}
