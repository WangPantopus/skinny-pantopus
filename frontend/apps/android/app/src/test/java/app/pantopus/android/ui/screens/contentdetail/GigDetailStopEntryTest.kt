@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.gigs.GigBidsResponse
import app.pantopus.android.data.api.models.gigs.GigDetailResponse
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigMyBidResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionsResponse
import app.pantopus.android.data.api.models.gigs.GigStopPreview
import app.pantopus.android.data.api.models.gigs.GigStopProgress
import app.pantopus.android.data.api.models.gigs.GigStopReceipt
import app.pantopus.android.data.api.models.gigs.GigStopRequest
import app.pantopus.android.data.api.models.gigs.GigStopTerms
import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.gigs.GigStopRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.gigs.PendingGigStopStore
import app.pantopus.android.ui.screens.gigs.authorization.GigAssignedAuthorizationState
import app.pantopus.android.ui.screens.gigs.checkout.gigIdentityFixture
import app.pantopus.android.ui.screens.gigs.stop.GigStopCoordinator
import app.pantopus.android.ui.screens.gigs.stop.GigStopIdentity
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class GigDetailStopEntryTest {
    private val actor = "11111111-1111-4111-8111-111111111111"
    private val other = "22222222-2222-4222-8222-222222222222"
    private val gig = "33333333-3333-4333-8333-333333333333"
    private val requestId = "44444444-4444-4444-8444-444444444444"
    private val api = mockk<GigStopRepository>()
    private val store = mockk<PendingGigStopStore>()

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun teardown() {
        Dispatchers.resetMain()
    }

    private fun TestScope.vm(snapshot: GigDto): GigDetailViewModel {
        val repo = mockk<GigsRepository>(relaxed = true)
        coEvery { repo.detail(gig) } returns NetworkResult.Success(GigDetailResponse(snapshot))
        coEvery { repo.bids(gig) } returns NetworkResult.Success(GigBidsResponse(emptyList()))
        coEvery { repo.questions(gig) } returns NetworkResult.Success(GigQuestionsResponse(emptyList()))
        coEvery { repo.cancellationPreview(gig) } returns NetworkResult.Failure(NetworkError.NotFound)
        val signed =
            AuthRepository.State.SignedIn(
                UserDto(id = actor, email = "stop@example.invalid", displayName = "Stop", avatarUrl = null),
            )
        val coordinator =
            GigStopCoordinator(
                api,
                store,
                this,
                { GigStopIdentity(actor, "session", "https://api.example.invalid/") },
                Moshi.Builder().build(),
                scopeMarker = { "$actor|session|https://api.example.invalid/" },
            )
        return GigDetailViewModel(
            repo = repo, extrasRepo = mockk(relaxed = true),
            viewerBidRepo = mockk { coEvery { myBid(gig) } returns NetworkResult.Success(GigMyBidResponse(null)) },
            ownerActionsRepo = mockk(relaxed = true),
            offersRepo = mockk { coEvery { myBids(any()) } returns NetworkResult.Success(MyBidsResponse(emptyList())) },
            authRepo = mockk { every { state } returns MutableStateFlow<AuthRepository.State>(signed) },
            filesRepo = mockk(relaxed = true), paymentsRepo = mockk(relaxed = true), reviewsRepo = mockk(relaxed = true),
            socket = mockk(relaxed = true), activeNotifier = mockk(relaxed = true), gigsV2Repo = mockk(relaxed = true),
            savedStateHandle = SavedStateHandle(mapOf(GigDetailViewModel.GIG_ID_KEY to gig)),
            checkoutIdentities = gigIdentityFixture { actor to "session" },
            refundFactory = mockk(relaxed = true),
            authorizationFactory =
                mockk {
                    every { create(any(), any()) } returns
                        mockk(relaxed = true) {
                            coEvery { isCurrentReadScope() } returns true
                            every { state } returns MutableStateFlow(GigAssignedAuthorizationState())
                        }
                },
            stopFactory = mockk { every { create(any(), any()) } returns coordinator },
        )
    }

    @Test fun cancelledOwnerRetainsActualStatusEntryAndReadsExactOriginalReceipt() =
        runTest {
            verifyTerminalEntry(GigDto(gig, "Cancelled", status = "cancelled", userId = actor, price = 0.0), "cancel", actor, other)
        }

    @Test fun reopenedFormerWorkerRetainsActualStatusEntryAfterAssignmentDisappears() =
        runTest {
            verifyTerminalEntry(
                GigDto(gig, "Reopened", status = "open", userId = other, acceptedBy = null, price = 0.0),
                "worker_release",
                other,
                actor,
            )
        }

    private suspend fun TestScope.verifyTerminalEntry(
        snapshot: GigDto,
        action: String,
        owner: String,
        worker: String,
    ) {
        val terms = GigStopTerms(gig, owner, worker, null, 0, "usd", "assigned", null, null, "flexible", 0)
        val saved = GigStopRequest(requestId, gig, actor, action, terms, null, null, "none")
        coEvery { store.read(any()) } returns saved
        coEvery { store.complete(any(), saved, any()) } returns Unit
        val receipt =
            GigStopReceipt(
                requestId, gig, null, owner, worker, 0, "usd", action,
                if (action == "worker_release") "open" else "cancelled", "none",
            )
        coEvery {
            api.request(gig, requestId)
        } returns
            NetworkResult.Success(
                GigStopProgress(actor, "a".repeat(64), requestId, action, "completed", "none", false, saved, receipt),
            )
        val vm = vm(snapshot)
        vm.load()
        advanceUntilIdle()
        assertEquals(snapshot.status, vm.gigSnapshot()?.status)
        assertFalse(vm.canCancelTask())
        assertFalse(vm.canCloseTask())
        assertFalse(vm.canReplaceWorker())
        assertTrue(vm.taskStop.state.value.recoveryAvailable)
        vm.openTaskStopRecovery()
        advanceUntilIdle()
        assertTrue(vm.taskStop.state.value.visible)
        assertEquals(requestId, vm.taskStop.state.value.progress?.receipt?.requestId)
        coVerify(exactly = 1) { api.request(gig, requestId) }
        coVerify(exactly = 0) { api.submit(any(), any()) }
    }

    @Test fun allFourActualVmActionsReadPreviewAndDoNotMutateUntilConfirmation() =
        runTest {
            coEvery { store.read(any()) } returns null
            val terms = GigStopTerms(gig, actor, other, null, 0, "usd", "assigned", null, null, "flexible", 0)
            coEvery {
                api.preview(gig, any())
            } answers { NetworkResult.Success(GigStopPreview(actor, "a".repeat(64), secondArg(), terms, true, null, "none", null)) }
            val vm = vm(GigDto(gig, "Task", status = "assigned", userId = actor, acceptedBy = other))
            listOf("cancel", "close", "worker_release", "reopen_bidding").forEach { action ->
                vm.openTaskStop(action)
                advanceUntilIdle()
                assertEquals(action, vm.taskStop.state.value.preview?.action)
                vm.taskStop.close()
            }
            coVerify(exactly = 4) { api.preview(gig, any()) }
            coVerify(exactly = 0) { api.submit(any(), any()) }
        }

    @Test fun unreadableRecoveryIsAnActualEntryInsteadOfAnAbsentRequest() =
        runTest {
            coEvery { store.read(any()) } throws IllegalStateException("Storage corrupt")
            val vm = vm(GigDto(gig, "Cancelled", status = "cancelled", userId = actor))
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.taskStop.state.value.recoveryAvailable)
            assertTrue(vm.taskStop.state.value.recoveryError?.isNotBlank() == true)
            vm.openTaskStopRecovery()
            advanceUntilIdle()
            assertTrue(vm.taskStop.state.value.error?.isNotBlank() == true)
            coVerify(exactly = 0) { api.submit(any(), any()) }
        }

    @Test fun actualSavedStatusEntryCannotStartNewActionAfterDiskRemoval() =
        runTest {
            val terms = GigStopTerms(gig, actor, other, null, 0, "usd", "assigned", null, null, "flexible", 0)
            coEvery { store.read(any()) } returns GigStopRequest(requestId, gig, actor, "cancel", terms, null, null, "none")
            val vm = vm(GigDto(gig, "Task", status = "assigned", userId = actor, acceptedBy = other))
            vm.load()
            advanceUntilIdle()
            assertTrue(vm.taskStop.state.value.recoveryAvailable)
            coEvery { store.read(any()) } returns null
            vm.openTaskStopRecovery()
            advanceUntilIdle()
            vm.taskStop.checkStatus()
            advanceUntilIdle()
            vm.taskStop.submit()
            advanceUntilIdle()
            assertFalse(vm.taskStop.state.value.maySubmit)
            assertTrue(vm.taskStop.state.value.recoveryOnly)
            coVerify(exactly = 0) { api.preview(any(), any()) }
            coVerify(exactly = 0) { api.submit(any(), any()) }
        }
}
