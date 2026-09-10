@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.admin.AdminRepository
import app.pantopus.android.data.api.models.admin.AdminClaimDetailResponse
import app.pantopus.android.data.api.models.admin.AdminClaimReviewAction
import app.pantopus.android.data.api.models.admin.AdminClaimReviewRequest
import app.pantopus.android.data.api.models.homes.HomeClaimDecisionReceipt
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimDetailResponse
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimReviewRequest
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeClaimReviewRepository
import app.pantopus.android.ui.screens.review_claims.ReviewClaimDetailUiState
import app.pantopus.android.ui.screens.review_claims.ReviewClaimDetailViewModel
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
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

@OptIn(ExperimentalCoroutinesApi::class)
class HomeClaimDecisionTest {
    private val homeRepo = mockk<HomeClaimReviewRepository>()
    private val adminRepo = mockk<AdminRepository>()
    private val token = "a".repeat(64)
    private val moshi = Moshi.Builder().build()

    @Test fun credentialReadFailureKeepsTheActionClosedAndRecoverable() =
        runTest {
            val session = HomeClaimScopeTestFixture()
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            val vm = home(session)
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            session.storedReadFailure = java.io.IOException("synthetic unavailable credential storage")
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 0) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
            assertTrue(vm.state.value is HomeClaimReviewUiState.Error)
            assertTrue(vm.toast.value?.text?.contains("Reopen the claim and retry") == true)
        }

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { homeRepo.ownershipClaims(any()) } returns NetworkResult.Success(HomeOwnershipClaimsResponse())
        coEvery { homeRepo.residencyClaims(any()) } returns NetworkResult.Success(HomeResidencyClaimsResponse())
        coEvery { homeRepo.ownershipClaimComparison(any()) } returns NetworkResult.Failure(NetworkError.NotFound)
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun claimJson(
        token: String? = this.token,
        home: String = "home-1",
        state: String = "submitted",
    ): String {
        val encodedToken = token?.let { "\"$it\"" } ?: "null"
        return """
            {"id":"claim-1","home_id":"$home","claimant_user_id":"claimant-1","claim_type":"resident",
            "state":"$state","method":"doc_upload","created_at":"2026-09-10T00:00:00Z","review_token":$encodedToken,
            "evidence":[{"id":"e1","eligible_for_review":true},{"id":"e2","eligible_for_review":false}]}
            """.trimIndent()
    }

    private fun homeDetail(
        token: String? = this.token,
        home: String = "home-1",
    ): HomeOwnershipClaimDetailResponse =
        requireNotNull(moshi.adapter(HomeOwnershipClaimDetailResponse::class.java).fromJson("{\"claim\":${claimJson(token, home)}}"))

    private fun adminDetail(
        token: String? = this.token,
        state: String = "submitted",
    ): AdminClaimDetailResponse =
        requireNotNull(
            moshi.adapter(AdminClaimDetailResponse::class.java).fromJson(
                """
                {"claim":${claimJson(token, state = state)},"home":{"id":"home-1"},"claimant":{"id":"claimant-1"},"evidence":[]}
                """.trimIndent(),
            ),
        )

    private fun receipt(
        action: String = "approve",
        home: String = "home-1",
        replayed: Boolean = false,
    ): HomeClaimDecisionReceipt {
        val state = if (action == "approve") "approved" else "rejected"
        return requireNotNull(
            moshi.adapter(HomeClaimDecisionReceipt::class.java).fromJson(
                """
                {"ok":true,"homeId":"$home","claimId":"claim-1","claimantId":"claimant-1","action":"$action",
                "state":"$state","replayed":$replayed,"occupancy":{"id":"o1","home_id":"$home","user_id":"claimant-1"}}
                """.trimIndent(),
            ),
        )
    }

    private fun home(session: HomeClaimScopeTestFixture = HomeClaimScopeTestFixture()) =
        HomeClaimReviewViewModel(
            homeRepo,
            SavedStateHandle(mapOf(HOME_CLAIM_REVIEW_HOME_ID_KEY to "home-1")),
            claimScopeFactory(session),
        )

    private fun admin(session: HomeClaimScopeTestFixture = HomeClaimScopeTestFixture()) =
        ReviewClaimDetailViewModel(
            adminRepo,
            SavedStateHandle(mapOf(ReviewClaimDetailViewModel.CLAIM_ID_KEY to "claim-1")),
            claimScopeFactory(session),
        )

    @Test fun preparationReturnsDisplayedTypeAndEligibleEvidenceWithoutWriting() =
        runTest {
            coEvery { homeRepo.ownershipClaimDetail("home-1", "claim-1") } returns NetworkResult.Success(homeDetail())
            val snapshot = requireNotNull(home().prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            assertEquals("resident", snapshot.claimType)
            assertEquals(1, snapshot.eligibleEvidenceCount)
            assertEquals(2, snapshot.evidenceCount)
            coVerify(exactly = 0) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
        }

    @Test fun missingMalformedAndOtherHomeSnapshotsCannotPrepare() =
        runTest {
            for (detail in listOf(homeDetail(token = null), homeDetail(token = "bad"), homeDetail(home = "another-home"))) {
                coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(detail)
                assertNull(home().prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            }
            coVerify(exactly = 0) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
        }

    @Test fun confirmedDecisionSendsExactlyDisplayedSnapshot() =
        runTest {
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            coEvery { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) } returns NetworkResult.Success(receipt())
            val vm = home()
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 1) { homeRepo.reviewOwnershipClaim("home-1", "claim-1", "approve", token, null) }
            assertFalse(vm.toast.value?.isError ?: true)
        }

    @Test fun unknownResultRetriesExactDecisionAndRejectsAlternativeAction() =
        runTest {
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            coEvery { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)), NetworkResult.Success(receipt(replayed = true)),
                )
            val vm = home()
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            assertNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Reject))
            assertEquals(snapshot, vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 2) { homeRepo.reviewOwnershipClaim("home-1", "claim-1", "approve", token, null) }
            coVerify(exactly = 1) { homeRepo.ownershipClaimDetail(any(), any()) }
        }

    @Test fun staleReviewDoesNotAutomaticallyFetchAndApproveNewFacts() =
        runTest {
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            coEvery {
                homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any())
            } returns NetworkResult.Failure(NetworkError.ClientError(409, null))
            val vm = home()
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 1) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
            coVerify(exactly = 1) { homeRepo.ownershipClaimDetail(any(), any()) }
        }

    @Test fun accountChangeBeforeConfirmationPreventsWrite() =
        runTest {
            val session = HomeClaimScopeTestFixture()
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            val vm = home(session)
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            session.accounts.value = "another-user"
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 0) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
            assertTrue(vm.state.value is HomeClaimReviewUiState.Error)
        }

    @Test fun delayedPreviousAccountSnapshotIsDiscarded() =
        runTest {
            val session = HomeClaimScopeTestFixture()
            val gate = CompletableDeferred<NetworkResult<HomeOwnershipClaimDetailResponse>>()
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } coAnswers { gate.await() }
            val vm = home(session)
            val pending = async { vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve) }
            testScheduler.runCurrent()
            session.accounts.value = "another-user"
            gate.complete(NetworkResult.Success(homeDetail()))
            assertNull(pending.await())
        }

    @Test fun concurrentConfirmationsOnlySendOneDecision() =
        runTest {
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            val gate = CompletableDeferred<NetworkResult<HomeClaimDecisionReceipt>>()
            coEvery { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) } coAnswers { gate.await() }
            val vm = home()
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 1) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
            gate.complete(NetworkResult.Success(receipt()))
        }

    @Test fun noOpeningAccountCannotBindToLaterLogin() =
        runTest {
            val session =
                HomeClaimScopeTestFixture().apply {
                    accounts.value = null
                    tokens.value = null
                }
            val vm = home(session)
            session.accounts.value = "new-user"
            session.tokens.value = "new-token"
            assertNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            coVerify(exactly = 0) { homeRepo.ownershipClaimDetail(any(), any()) }
        }

    @Test fun platformMissingSnapshotAndDisputeNeverSubmit() =
        runTest {
            for (detail in listOf(adminDetail(token = null), adminDetail(state = "disputed"))) {
                coEvery { adminRepo.claimDetail(any()) } returns NetworkResult.Success(detail)
                val vm = admin()
                vm.load()
                assertFalse(vm.review(AdminClaimReviewAction.Reject))
            }
            coVerify(exactly = 0) { adminRepo.reviewClaim(any(), any()) }
        }

    @Test fun platformUsesLoadedSnapshotAndTruthfulResidentOutcome() =
        runTest {
            coEvery {
                adminRepo.claimDetail(any())
            } returnsMany listOf(NetworkResult.Success(adminDetail()), NetworkResult.Success(adminDetail(state = "approved")))
            coEvery { adminRepo.reviewClaim(any(), any()) } returns NetworkResult.Success(receipt())
            val vm = admin()
            vm.load()
            assertTrue(vm.review(AdminClaimReviewAction.Approve))
            coVerify { adminRepo.reviewClaim("claim-1", AdminClaimReviewRequest("approve", token, null)) }
            assertEquals("Claim approved.", vm.toast.value?.text)
        }

    @Test fun platformUnknownResultRequiresSameNoteAndAction() =
        runTest {
            coEvery { adminRepo.claimDetail(any()) } returns NetworkResult.Success(adminDetail())
            coEvery { adminRepo.reviewClaim(any(), any()) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)), NetworkResult.Success(receipt("reject", replayed = true)),
                )
            val vm = admin()
            vm.load()
            assertFalse(vm.review(AdminClaimReviewAction.Reject, "Exact reason"))
            assertFalse(vm.review(AdminClaimReviewAction.Reject, "Changed reason"))
            assertTrue(vm.review(AdminClaimReviewAction.Reject, "Exact reason"))
            coVerify(exactly = 2) { adminRepo.reviewClaim("claim-1", AdminClaimReviewRequest("reject", token, "Exact reason")) }
        }

    @Test fun mismatchedPlatformReceiptAndLateAccountCannotClaimSuccess() =
        runTest {
            coEvery { adminRepo.claimDetail(any()) } returns NetworkResult.Success(adminDetail())
            coEvery { adminRepo.reviewClaim(any(), any()) } returns NetworkResult.Success(receipt(home = "other-home"))
            val badVm = admin()
            badVm.load()
            assertFalse(badVm.review(AdminClaimReviewAction.Approve))
            val session = HomeClaimScopeTestFixture()
            val gate = CompletableDeferred<NetworkResult<HomeClaimDecisionReceipt>>()
            coEvery { adminRepo.reviewClaim(any(), any()) } coAnswers { gate.await() }
            val vm = admin(session)
            vm.load()
            val pending = async { vm.review(AdminClaimReviewAction.Approve) }
            testScheduler.runCurrent()
            session.accounts.value = "another-user"
            gate.complete(NetworkResult.Success(receipt()))
            assertFalse(pending.await())
            assertTrue(vm.state.value is ReviewClaimDetailUiState.Error)
        }

    @Test fun wireDtosRequireAndSerializeSnapshotAndExactReceipt() {
        val request = moshi.adapter(HomeOwnershipClaimReviewRequest::class.java).toJson(HomeOwnershipClaimReviewRequest("approve", token))
        assertTrue(request.contains("\"review_token\":\"$token\""))
        assertFalse(request.contains("reviewToken"))
        assertTrue(receipt().matches("home-1", "claim-1", "claimant-1", "approve"))
        assertFalse(receipt(home = "other-home").matches("home-1", "claim-1", "claimant-1", "approve"))
        assertNotNull(runCatching { moshi.adapter(HomeClaimDecisionReceipt::class.java).fromJson("{}") }.exceptionOrNull())
    }

    @Test fun sameActorStoredReplacementBeforeTokenCollectorPreventsHomeWrite() =
        runTest {
            val session = HomeClaimScopeTestFixture()
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            val vm = home(session)
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            session.storedToken = "replacement-session-token"
            // The flow still holds the old token, representing a persisted save before collector delivery.
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            coVerify(exactly = 0) { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) }
            assertTrue(vm.state.value is HomeClaimReviewUiState.Error)
        }

    @Test fun sameActorStoredReplacementDiscardsLateHomeDecision() =
        runTest {
            val session = HomeClaimScopeTestFixture()
            coEvery { homeRepo.ownershipClaimDetail(any(), any()) } returns NetworkResult.Success(homeDetail())
            val gate = CompletableDeferred<NetworkResult<HomeClaimDecisionReceipt>>()
            coEvery { homeRepo.reviewOwnershipClaim(any(), any(), any(), any(), any()) } coAnswers { gate.await() }
            val vm = home(session)
            val snapshot = requireNotNull(vm.prepareReview("claim-1", HomeClaimReviewVerdict.Approve))
            vm.review(snapshot, HomeClaimReviewVerdict.Approve)
            session.storedToken = "replacement-session-token"
            gate.complete(NetworkResult.Success(receipt()))
            assertTrue(vm.toast.value?.isError == true)
            assertTrue(vm.state.value is HomeClaimReviewUiState.Error)
        }

    @Test fun sameActorStoredReplacementPreventsPlatformWriteAndLateSuccess() =
        runTest {
            coEvery { adminRepo.claimDetail(any()) } returns NetworkResult.Success(adminDetail())
            val first = HomeClaimScopeTestFixture()
            val blocked = admin(first)
            blocked.load()
            first.storedToken = "replacement-session-token"
            assertFalse(blocked.review(AdminClaimReviewAction.Approve))
            coVerify(exactly = 0) { adminRepo.reviewClaim(any(), any()) }
            val session = HomeClaimScopeTestFixture()
            val gate = CompletableDeferred<NetworkResult<HomeClaimDecisionReceipt>>()
            coEvery { adminRepo.reviewClaim(any(), any()) } coAnswers { gate.await() }
            val vm = admin(session)
            vm.load()
            val pending = async { vm.review(AdminClaimReviewAction.Approve) }
            testScheduler.runCurrent()
            session.storedToken = "replacement-session-token"
            gate.complete(NetworkResult.Success(receipt()))
            assertFalse(pending.await())
        }
}
