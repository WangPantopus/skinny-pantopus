@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.DeleteOwnershipClaimResponse
import app.pantopus.android.data.api.models.homes.MyOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.OwnershipClaimDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.homes.settings.cancel_claim.CANCEL_CLAIM_HOME_ID_KEY
import app.pantopus.android.ui.screens.homes.settings.cancel_claim.CancelClaimUiState
import app.pantopus.android.ui.screens.homes.settings.cancel_claim.CancelClaimViewModel
import com.squareup.moshi.Moshi
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.CompletableDeferred
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeClaimWithdrawalTest {
    private val repo = mockk<HomesRepository>()

    @Before fun setup() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun claims(status: String = "under_review") =
        MyOwnershipClaimsResponse(
            listOf(
                OwnershipClaimDto("claim-1", "home-1", "owner", "doc_upload", status, "2026-09-10T00:00:00Z", "2026-09-10T00:00:00Z"),
            ),
        )

    private fun receipt() = DeleteOwnershipClaimResponse(true, false, true, false, "home-1", "claim-1", "withdraw", "revoked")

    private fun vm(session: HomeClaimScopeTestFixture = HomeClaimScopeTestFixture()) =
        CancelClaimViewModel(
            repo,
            SavedStateHandle(mapOf(CANCEL_CLAIM_HOME_ID_KEY to "home-1")),
            claimScopeFactory(session),
        )

    @Test fun destructiveMismatchedOrIncompleteReceiptsNeverDismiss() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(claims())
            for (bad in listOf(
                receipt().copy(deleted = true),
                receipt().copy(withdrawn = false),
                receipt().copy(homeId = "other"),
                receipt().copy(claimId = "other"),
                receipt().copy(state = "approved"),
                receipt().copy(action = "delete"),
            )) {
                coEvery { repo.deleteOwnershipClaim(any(), any()) } returns NetworkResult.Success(bad)
                val model = vm()
                model.load()
                model.submit()
                assertFalse(model.completed.value)
                assertEquals(CancelClaimUiState.Ready, model.state.value)
                assertNotNull(model.submitError.value)
            }
            assertNotNull(
                runCatching {
                    Moshi.Builder().build().adapter(DeleteOwnershipClaimResponse::class.java).fromJson("{\"ok\":true}")
                }.exceptionOrNull(),
            )
        }

    @Test fun onlyExactRetainedHistoryReceiptCompletes() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(claims())
            coEvery { repo.deleteOwnershipClaim(any(), any()) } returns NetworkResult.Success(receipt())
            val model = vm()
            model.load()
            model.submit()
            model.submit()
            assertTrue(model.completed.value)
            coVerify(exactly = 1) { repo.deleteOwnershipClaim("home-1", "claim-1") }
        }

    @Test fun uncertainWithdrawalRetriesSameClaim() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(claims())
            coEvery { repo.deleteOwnershipClaim(any(), any()) } returnsMany
                listOf(
                    NetworkResult.Failure(NetworkError.Server(503, null)), NetworkResult.Success(receipt().copy(replayed = true)),
                )
            val model = vm()
            model.load()
            model.submit()
            assertFalse(model.completed.value)
            model.submit()
            assertTrue(model.completed.value)
            coVerify(exactly = 2) { repo.deleteOwnershipClaim("home-1", "claim-1") }
        }

    @Test fun replacementStoredSessionPreventsWriteBeforeCollectorDelivery() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(claims())
            val session = HomeClaimScopeTestFixture()
            val model = vm(session)
            model.load()
            session.storedToken = "replacement-token"
            model.submit()
            coVerify(exactly = 0) { repo.deleteOwnershipClaim(any(), any()) }
            assertFalse(model.completed.value)
            assertTrue(model.state.value is CancelClaimUiState.Error)
        }

    @Test fun replacementStoredSessionDiscardsDelayedRead() =
        runTest {
            val gate = CompletableDeferred<NetworkResult<MyOwnershipClaimsResponse>>()
            coEvery { repo.myOwnershipClaims() } coAnswers { gate.await() }
            val session = HomeClaimScopeTestFixture()
            val model = vm(session)
            model.load()
            session.storedToken = "replacement-token"
            gate.complete(NetworkResult.Success(claims()))
            assertTrue(model.state.value is CancelClaimUiState.Error)
            model.submit()
            coVerify(exactly = 0) { repo.deleteOwnershipClaim(any(), any()) }
        }

    @Test fun replacementStoredSessionDiscardsDelayedSuccessAndDoubleTap() =
        runTest {
            coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(claims())
            val gate = CompletableDeferred<NetworkResult<DeleteOwnershipClaimResponse>>()
            coEvery { repo.deleteOwnershipClaim(any(), any()) } coAnswers { gate.await() }
            val session = HomeClaimScopeTestFixture()
            val model = vm(session)
            model.load()
            model.submit()
            model.submit()
            coVerify(exactly = 1) { repo.deleteOwnershipClaim(any(), any()) }
            session.storedToken = "replacement-token"
            gate.complete(NetworkResult.Success(receipt()))
            assertFalse(model.completed.value)
            assertTrue(model.state.value is CancelClaimUiState.Error)
        }

    @Test fun onlyExactHomeWithdrawableStatusesAreOffered() =
        runTest {
            for (status in listOf("approved", "revoked", "unknown")) {
                coEvery { repo.myOwnershipClaims() } returns NetworkResult.Success(claims(status))
                val model = vm()
                model.load()
                assertEquals(CancelClaimUiState.NoClaim, model.state.value)
                model.submit()
            }
            coEvery { repo.myOwnershipClaims() } returns
                NetworkResult.Success(
                    claims("rejected").let {
                        it.copy(
                            claims =
                                it.claims.map {
                                        claim ->
                                    claim.copy(homeId = "other")
                                },
                        )
                    },
                )
            val model = vm()
            model.load()
            assertEquals(CancelClaimUiState.NoClaim, model.state.value)
            coVerify(exactly = 0) { repo.deleteOwnershipClaim(any(), any()) }
        }
}
