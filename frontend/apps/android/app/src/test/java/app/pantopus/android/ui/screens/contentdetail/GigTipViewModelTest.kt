@file:Suppress("PackageNaming", "FunctionNaming", "MagicNumber")

package app.pantopus.android.ui.screens.contentdetail

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.core.notifications.GigActiveNotifier
import app.pantopus.android.data.api.models.gigs.GigBidsResponse
import app.pantopus.android.data.api.models.gigs.GigDetailResponse
import app.pantopus.android.data.api.models.gigs.GigDto
import app.pantopus.android.data.api.models.gigs.GigMyBidResponse
import app.pantopus.android.data.api.models.gigs.GigPaymentDto
import app.pantopus.android.data.api.models.gigs.GigPaymentResponse
import app.pantopus.android.data.api.models.gigs.GigQuestionsResponse
import app.pantopus.android.data.api.models.offers.MyBidsResponse
import app.pantopus.android.data.api.models.reviews.MyPendingReviewsResponse
import app.pantopus.android.data.api.models.users.UserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.files.FilesRepository
import app.pantopus.android.data.gigs.GigViewerBidRepository
import app.pantopus.android.data.gigs.GigsRepository
import app.pantopus.android.data.offers.OffersRepository
import app.pantopus.android.data.payments.PaymentsRepository
import app.pantopus.android.data.realtime.SocketManager
import app.pantopus.android.data.reviews.ReviewsRepository
import app.pantopus.android.ui.screens.gigs.authorization.GigAssignedAuthorizationCoordinator
import app.pantopus.android.ui.screens.gigs.authorization.GigAssignedAuthorizationState
import app.pantopus.android.ui.screens.gigs.checkout.gigIdentityFixture
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Block 3D — tipping a gig worker. The poster, on a completed + owner-confirmed
 * gig, tips via PaymentSheet. Mirrors iOS `GigTipTests`: the gate, the "Send a
 * tip" dock, and the send-tip event + outcome handling.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class GigTipViewModelTest {
    private val repo: GigsRepository = mockk()
    private val extrasRepo: app.pantopus.android.data.gigs.GigExtrasRepository = mockk()
    private val viewerBidRepo: GigViewerBidRepository = mockk()
    private val ownerActionsRepo: app.pantopus.android.data.gigs.GigOwnerActionsRepository = mockk()
    private val offersRepo: OffersRepository = mockk()
    private val authRepo: AuthRepository = mockk()
    private val filesRepo: FilesRepository = mockk()
    private val paymentsRepo: PaymentsRepository = mockk()
    private val reviewsRepo: ReviewsRepository = mockk()
    private val gigsV2Repo: app.pantopus.android.data.gigs.GigsV2Repository = mockk(relaxed = true)
    private val socket: SocketManager = mockk(relaxed = true)
    private val activeNotifier: GigActiveNotifier = mockk(relaxed = true)
    private val authorization: GigAssignedAuthorizationCoordinator = mockk(relaxed = true)

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { authorization.isCurrentReadScope() } returns true
        every { authorization.state } returns MutableStateFlow(GigAssignedAuthorizationState())
        val signed =
            AuthRepository.State.SignedIn(
                user = UserDto(id = "owner-1", email = "o@example.com", displayName = "Owner", avatarUrl = null),
            )
        every { authRepo.state } returns MutableStateFlow<AuthRepository.State>(signed)
        // Bidder-side lookup — the viewer here is the poster, so this never
        // fires, but the mock must still answer if the gate ever changes.
        coEvery { viewerBidRepo.myBid(any()) } returns NetworkResult.Success(GigMyBidResponse(bid = null))
        coEvery { offersRepo.myBids(any()) } returns NetworkResult.Success(MyBidsResponse(bids = emptyList()))
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun completedConfirmedGig() =
        GigDto(
            id = "g1",
            title = "Patio cleanup",
            userId = "owner-1",
            status = "completed",
            acceptedBy = "worker-1",
            ownerConfirmedAt = "2026-06-01T00:00:00Z",
        )

    private fun vmWithLoadedTip(
        gig: GigDto = completedConfirmedGig(),
        identities: app.pantopus.android.ui.screens.gigs.checkout.GigPaymentIdentitySource = gigIdentityFixture(),
    ): GigDetailViewModel {
        coEvery { repo.detail(gig.id) } returns NetworkResult.Success(GigDetailResponse(gig = gig))
        coEvery { repo.bids(gig.id) } returns NetworkResult.Success(GigBidsResponse(bids = emptyList()))
        coEvery { repo.questions(gig.id) } returns NetworkResult.Success(GigQuestionsResponse(questions = emptyList()))
        coEvery { reviewsRepo.myPending() } returns NetworkResult.Success(MyPendingReviewsResponse(pending = emptyList()))
        // Phase 5b — the owner of an assigned+ gig fetches the payment card.
        coEvery { repo.gigPayment(gig.id) } returns NetworkResult.Success(GigPaymentResponse())
        coEvery { repo.noShowCheck(gig.id) } returns
            NetworkResult.Success(
                app.pantopus.android.data.api.models.gigs.NoShowCheckResponse(canReport = false),
            )
        coEvery { repo.changeOrders(gig.id) } returns
            NetworkResult.Success(
                app.pantopus.android.data.api.models.gigs.GigChangeOrdersResponse(),
            )
        return GigDetailViewModel(
            repo,
            extrasRepo,
            viewerBidRepo,
            ownerActionsRepo,
            offersRepo,
            authRepo,
            filesRepo,
            paymentsRepo,
            reviewsRepo,
            socket,
            activeNotifier,
            gigsV2Repo,
            SavedStateHandle(mapOf(GigDetailViewModel.GIG_ID_KEY to gig.id)),
            checkoutIdentities = identities,
            refundFactory = mockk(relaxed = true),
            authorizationFactory = mockk { every { create(any(), any()) } returns authorization },
            stopFactory = mockk(relaxed = true),
            tipStore = mockk(relaxed = true),
        )
    }

    // MARK: - Gate

    @Test
    fun tip_gate() {
        val gig = completedConfirmedGig()
        assertTrue(GigDetailViewModel.viewerCanTip(gig, "owner-1"))
        assertFalse("Only the poster can tip", GigDetailViewModel.viewerCanTip(gig, "worker-1"))
        assertFalse(
            "Must be owner-confirmed",
            GigDetailViewModel.viewerCanTip(gig.copy(ownerConfirmedAt = null), "owner-1"),
        )
        assertFalse(
            "Must be completed",
            GigDetailViewModel.viewerCanTip(gig.copy(status = "in_progress"), "owner-1"),
        )
    }

    // MARK: - Projection

    @Test
    fun load_sets_can_tip_and_send_tip_dock() =
        runTest {
            val vm = vmWithLoadedTip()
            vm.load()
            assertTrue(vm.canTip())
            val content = (vm.state.value as ContentDetailUiState.Loaded).content
            assertEquals("Send a tip", content.dock.primary.label)
        }

    @Test fun coldHistoricalTipEntryRequiresCurrentScopedExistingPayment() =
        runTest {
            val actor = "22222222-2222-4222-8222-222222222222"
            val gigId = "11111111-1111-4111-8111-111111111111"
            val requestId = "44444444-4444-4444-8444-444444444444"
            val task = completedConfirmedGig().copy(id = gigId, userId = actor, acceptedBy = null, ownerConfirmedAt = null)
            every { authRepo.state } returns
                MutableStateFlow<AuthRepository.State>(
                    AuthRepository.State.SignedIn(
                        UserDto(id = actor, email = "cold@example.invalid", displayName = "Poster", avatarUrl = null),
                    ),
                )
            val preview =
                app.pantopus.android.data.api.models.payments.TipPreview(
                    actor, "a".repeat(64),
                    app.pantopus.android.data.api.models.payments.TipTerms(gigId, actor, null, null), false, "LEGACY_REVIEW",
                    null, requestId, 50, 99_999_999, 3,
                )
            coEvery { paymentsRepo.tipPreview(gigId) } returns NetworkResult.Success(preview)
            val vm = vmWithLoadedTip(task, gigIdentityFixture { actor to "session1" })
            vm.load()
            assertTrue(vm.canTip())
            assertEquals("Send a tip", (vm.state.value as ContentDetailUiState.Loaded).content.dock.primary.label)
            coVerify(exactly = 0) { paymentsRepo.tip(any()) }
            coEvery { paymentsRepo.tipPreview(gigId) } returns NetworkResult.Success(preview.copy(legacyPaymentId = null))
            vm.load()
            assertFalse(vm.canTip())
        }

    @Test fun lateHistoricalTipPreviewCannotExposeAnEntryAfterSessionChanges() =
        runTest {
            val actor = "22222222-2222-4222-8222-222222222222"
            val gigId = "11111111-1111-4111-8111-111111111111"
            val task = completedConfirmedGig().copy(id = gigId, userId = actor, acceptedBy = null, ownerConfirmedAt = null)
            every { authRepo.state } returns
                MutableStateFlow<AuthRepository.State>(
                    AuthRepository.State.SignedIn(
                        UserDto(id = actor, email = "cold@example.invalid", displayName = "Poster", avatarUrl = null),
                    ),
                )
            var session = "session1"
            coEvery { paymentsRepo.tipPreview(gigId) } answers {
                session = "session2"
                NetworkResult.Success(
                    app.pantopus.android.data.api.models.payments.TipPreview(
                        actor, "a".repeat(64),
                        app.pantopus.android.data.api.models.payments.TipTerms(gigId, actor, null, null), false, "LEGACY_REVIEW",
                        null, "44444444-4444-4444-8444-444444444444", 50, 99_999_999, 3,
                    ),
                )
            }
            val vm = vmWithLoadedTip(task, gigIdentityFixture { actor to session })
            vm.load()
            assertFalse(vm.canTip())
            coVerify(exactly = 0) { paymentsRepo.tip(any()) }
        }

    @Test fun assignedPayerAndBusinessManagerCanOpenExactServerPayment() =
        runTest {
            for (actor in listOf("owner-1", "delegate-1")) {
                every { authRepo.state } returns
                    MutableStateFlow<AuthRepository.State>(
                        AuthRepository.State.SignedIn(
                            UserDto(id = actor, email = "a@example.com", displayName = "Actor", avatarUrl = null),
                        ),
                    )
                val vm = vmWithLoadedTip()
                val task = completedConfirmedGig().copy(status = "assigned", price = 12.0, paymentId = "payment-1")
                val payment =
                    GigPaymentDto(
                        id = "payment-1",
                        gigId = "g1",
                        payerId = "owner-1",
                        payeeId = "worker-1",
                        amountTotal = 1200,
                        currency = "USD",
                        paymentStatus = "authorization_failed",
                    )
                coEvery { repo.detail("g1") } returns NetworkResult.Success(GigDetailResponse(gig = task))
                coEvery { repo.gigPayment("g1") } returns NetworkResult.Success(GigPaymentResponse(payment))
                vm.load()
                assertTrue(vm.canOpenAssignedAuthorization())
                vm.openAssignedAuthorization()
                verify { authorization.open(task, payment) }
            }
        }

    @Test fun changedPaymentReceiptNeverExposesAuthorizationEntry() =
        runTest {
            val vm = vmWithLoadedTip()
            val task = completedConfirmedGig().copy(status = "assigned", price = 12.0, paymentId = "payment-1")
            coEvery { repo.detail("g1") } returns NetworkResult.Success(GigDetailResponse(gig = task))
            coEvery { repo.gigPayment("g1") } returns
                NetworkResult.Success(
                    GigPaymentResponse(
                        GigPaymentDto(
                            id = "different-payment", gigId = "g1", payerId = "owner-1", payeeId = "worker-1", amountTotal = 1200,
                            currency = "USD", paymentStatus = "authorization_failed",
                        ),
                    ),
                )
            vm.load()
            assertFalse(vm.canOpenAssignedAuthorization())
            assertEquals(null, vm.payment.value)
        }

    @Test fun workerHasNoPayerAuthorizationEntry() =
        runTest {
            every { authRepo.state } returns
                MutableStateFlow<AuthRepository.State>(
                    AuthRepository.State.SignedIn(
                        UserDto(id = "worker-1", email = "w@example.com", displayName = "Worker", avatarUrl = null),
                    ),
                )
            val vm = vmWithLoadedTip()
            coEvery { repo.detail("g1") } returns
                NetworkResult.Success(
                    GigDetailResponse(gig = completedConfirmedGig().copy(status = "assigned")),
                )
            vm.load()
            assertFalse(vm.canOpenAssignedAuthorization())
            coVerify(exactly = 0) { repo.gigPayment(any()) }
        }
}
