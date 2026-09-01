@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonClaimDto
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonDto
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonHomeDto
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonIncumbentDto
import app.pantopus.android.data.api.models.homes.HomeClaimComparisonOwnerDto
import app.pantopus.android.data.api.models.homes.HomeClaimUserDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimMaskedClaimantDto
import app.pantopus.android.data.api.models.homes.HomeOwnershipClaimsResponse
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimDto
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimantDto
import app.pantopus.android.data.api.models.homes.HomeResidencyClaimsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeClaimReviewRepository
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HomeClaimReviewViewModelTest {
    private val repo: HomeClaimReviewRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): HomeClaimReviewViewModel =
        HomeClaimReviewViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(HOME_CLAIM_REVIEW_HOME_ID_KEY to "home_1")),
        )

    private fun stubAllFailing() {
        coEvery { repo.ownershipClaims(any()) } returns
            NetworkResult.Failure(NetworkError.Forbidden)
        coEvery { repo.residencyClaims(any()) } returns
            NetworkResult.Failure(NetworkError.Forbidden)
        coEvery { repo.ownershipClaimComparison(any()) } returns
            NetworkResult.Failure(NetworkError.NotFound)
    }

    // region Load / state transitions

    @Test
    fun `all three reads failing surfaces the error state`() =
        runTest {
            stubAllFailing()
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is HomeClaimReviewUiState.Error)
        }

    @Test
    fun `empty collections surface the empty state, not an error`() =
        runTest {
            coEvery { repo.ownershipClaims(any()) } returns
                NetworkResult.Success(HomeOwnershipClaimsResponse(claims = emptyList()))
            coEvery { repo.residencyClaims(any()) } returns
                NetworkResult.Success(HomeResidencyClaimsResponse(claims = emptyList()))
            coEvery { repo.ownershipClaimComparison(any()) } returns
                NetworkResult.Failure(NetworkError.NotFound)
            val vm = makeVm()
            vm.load()
            assertEquals(HomeClaimReviewUiState.Empty, vm.state.value)
        }

    @Test
    fun `a 403 on ownership does not hide pending residency claims`() =
        runTest {
            coEvery { repo.ownershipClaims(any()) } returns
                NetworkResult.Failure(NetworkError.Forbidden)
            coEvery { repo.ownershipClaimComparison(any()) } returns
                NetworkResult.Failure(NetworkError.NotFound)
            coEvery { repo.residencyClaims(any()) } returns
                NetworkResult.Success(
                    HomeResidencyClaimsResponse(
                        claims =
                            listOf(
                                HomeResidencyClaimDto(
                                    id = "rc_1",
                                    status = "pending",
                                    claimedRole = "renter",
                                    claimedAddress = "418 Elm St",
                                    createdAt = "2026-08-01T10:00:00Z",
                                    claimant =
                                        HomeResidencyClaimantDto(
                                            id = "u1",
                                            name = "Maria Kovács",
                                        ),
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as HomeClaimReviewUiState.Loaded
            assertTrue(loaded.data.ownership.isEmpty())
            assertEquals(1, loaded.data.residency.size)
            assertEquals("Requesting: Renter", loaded.data.residency.first().roleLabel)
        }

    // endregion

    // region Projection

    @Test
    fun `comparison claims win over the masked fallback list`() {
        val items =
            HomeClaimReviewViewModel.ownershipItems(
                comparison = comparisonDto(phase = "under_review", hasVerifiedOwner = false),
                fallback = listOf(maskedClaim(state = "submitted")),
            )
        assertEquals(1, items.size)
        assertEquals("Rosa Delgado", items.first().displayName)
        assertEquals(HomeClaimReviewActionMode.Verdict, items.first().actionMode)
    }

    @Test
    fun `a verified incumbent turns an active claim into relationship actions`() {
        val items =
            HomeClaimReviewViewModel.ownershipItems(
                comparison = comparisonDto(phase = "evidence_submitted", hasVerifiedOwner = true),
                fallback = emptyList(),
            )
        assertEquals(HomeClaimReviewActionMode.Relationship, items.first().actionMode)
        assertEquals("Invite as owner", items.first().inviteTitle)
    }

    @Test
    fun `a challenged claim is admin-only even with a verified incumbent`() {
        val items =
            HomeClaimReviewViewModel.ownershipItems(
                comparison = comparisonDto(phase = "challenged", hasVerifiedOwner = true),
                fallback = emptyList(),
            )
        assertEquals(HomeClaimReviewActionMode.AdminReviewRequired, items.first().actionMode)
        assertTrue(items.first().isChallenged)
    }

    @Test
    fun `terminal comparison phases are filtered out`() {
        val items =
            HomeClaimReviewViewModel.ownershipItems(
                comparison = comparisonDto(phase = "verified", hasVerifiedOwner = true),
                fallback = emptyList(),
            )
        assertTrue(items.isEmpty())
    }

    @Test
    fun `masked fallback keeps the claimant anonymous and only lists reviewable states`() {
        val items =
            HomeClaimReviewViewModel.ownershipItems(
                comparison = null,
                fallback =
                    listOf(
                        maskedClaim(state = "submitted"),
                        maskedClaim(id = "c_2", state = "approved"),
                    ),
            )
        assertEquals(1, items.size)
        assertEquals("Masked claimant", items.first().displayName)
        assertEquals("Account 120d old", items.first().accountAgeLabel)
        assertEquals("Postcard", items.first().methodLabel)
    }

    @Test
    fun `non-pending residency claims are dropped`() {
        val items =
            HomeClaimReviewViewModel.residencyItems(
                listOf(
                    HomeResidencyClaimDto(id = "r1", status = "pending", claimedRole = "member"),
                    HomeResidencyClaimDto(id = "r2", status = "verified", claimedRole = "member"),
                ),
            )
        assertEquals(listOf("r1"), items.map { it.id })
    }

    @Test
    fun `comparison projects both columns of the side-by-side view`() {
        val comparison =
            HomeClaimReviewViewModel.comparison(
                comparisonDto(phase = "under_review", hasVerifiedOwner = true),
            )
        assertEquals("412 Elm Street", comparison.homeTitle)
        assertTrue(comparison.hasVerifiedOwner)
        assertEquals(1, comparison.incumbents.size)
        assertEquals("Jamie Patel", comparison.incumbents.first().name)
        assertTrue(comparison.incumbents.first().lines.contains("Primary owner"))
        assertEquals(1, comparison.challengers.size)
        assertEquals("Rosa Delgado", comparison.challengers.first().name)
    }

    @Test
    fun `initials fall back to a single glyph and strip the at-sign`() {
        assertEquals("RD", HomeClaimReviewViewModel.initials("Rosa Delgado"))
        assertEquals("R", HomeClaimReviewViewModel.initials("@rosa"))
        assertEquals("?", HomeClaimReviewViewModel.initials(""))
    }

    @Test
    fun `evidence label is null when there is no evidence`() {
        assertNull(HomeClaimReviewViewModel.evidenceLabel(0))
        assertEquals("1 file", HomeClaimReviewViewModel.evidenceLabel(1))
        assertEquals("3 files", HomeClaimReviewViewModel.evidenceLabel(3))
    }

    // endregion

    private fun maskedClaim(
        id: String = "c_1",
        state: String,
    ) = HomeOwnershipClaimDto(
        id = id,
        claimType = "owner",
        state = state,
        method = "postcard",
        createdAt = "2026-08-01T10:00:00Z",
        claimant =
            HomeOwnershipClaimMaskedClaimantDto(
                masked = true,
                accountAgeDays = 120,
                method = "postcard",
                riskScore = 12.0,
            ),
    )

    private fun comparisonDto(
        phase: String,
        hasVerifiedOwner: Boolean,
    ) = HomeClaimComparisonDto(
        homeId = "home_1",
        home = HomeClaimComparisonHomeDto(id = "home_1", name = "412 Elm Street"),
        householdResolutionState = "contested",
        incumbent =
            HomeClaimComparisonIncumbentDto(
                owners =
                    listOf(
                        HomeClaimComparisonOwnerDto(
                            id = "o1",
                            subjectId = "u2",
                            ownerStatus = "verified",
                            isPrimaryOwner = true,
                            verificationTier = "legal",
                            addedVia = "claim",
                            createdAt = "2022-03-12T10:00:00Z",
                            user = HomeClaimUserDto(id = "u2", name = "Jamie Patel"),
                        ),
                    ),
                hasVerifiedOwner = hasVerifiedOwner,
            ),
        claims =
            listOf(
                HomeClaimComparisonClaimDto(
                    id = "c_1",
                    claimantUserId = "u1",
                    claimant =
                        HomeClaimUserDto(
                            id = "u1",
                            name = "Rosa Delgado",
                            email = "rosa@example.com",
                        ),
                    claimType = "owner",
                    state = "pending_review",
                    claimPhaseV2 = phase,
                    claimStrength = "documented_strong",
                    routingClassification = "primary_claim",
                    createdAt = "2026-08-01T10:00:00Z",
                ),
            ),
    )
}
