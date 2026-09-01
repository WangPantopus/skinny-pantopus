@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile.professional

import app.pantopus.android.data.api.models.professional.ProfessionalPricingDto
import app.pantopus.android.data.api.models.professional.ProfessionalProfileDto
import app.pantopus.android.data.api.models.professional.ProfessionalProfileResponse
import app.pantopus.android.data.api.models.professional.ProfessionalServiceAreaDto
import app.pantopus.android.data.api.models.professional.ProfessionalVerificationStatusResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.professional.ProfessionalRepository
import io.mockk.coEvery
import io.mockk.coVerify
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
class ProfessionalProfileViewModelTest {
    private val repository: ProfessionalRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun loaded(
        seed: ProfessionalProfileContent = ProfessionalProfileSampleData.published,
        baseline: ProfessionalProfileContent? = null,
    ): ProfessionalProfileViewModel {
        val viewModel = ProfessionalProfileViewModel(repository, seed = seed, baseline = baseline)
        viewModel.load()
        return viewModel
    }

    // Sample seam

    @Test fun loadPublishedSeedIsVerifiedAndClean() {
        val viewModel = loaded()
        val state = viewModel.state.value as ProfessionalProfileUiState.Verified
        assertEquals(92, state.content.strength)
        assertEquals(0, state.content.dirtyCount)
        assertEquals(0, state.content.pendingCount)
    }

    @Test fun loadFailureIsError() {
        val viewModel = ProfessionalProfileViewModel(repository, simulateFailure = true)
        viewModel.load()
        assertTrue(viewModel.state.value is ProfessionalProfileUiState.Error)
    }

    @Test fun pendingSeedDerivesPendingWithTwoClaims() {
        val viewModel =
            loaded(
                seed = ProfessionalProfileSampleData.pendingEdits,
                baseline = ProfessionalProfileSampleData.published,
            )
        val state = viewModel.state.value as ProfessionalProfileUiState.Pending
        assertEquals(68, state.content.strength)
        assertEquals(5, state.dirtyCount)
        assertEquals(2, state.pendingCount)
    }

    @Test fun addSkillTransitionsToPendingWithoutPendingClaim() {
        val viewModel = loaded()
        viewModel.addSkill()
        val state = viewModel.state.value as ProfessionalProfileUiState.Pending
        assertEquals(1, state.dirtyCount)
        assertEquals(0, state.pendingCount)
        assertTrue(state.content.skills.last().isFresh)
    }

    @Test fun addCertificationTransitionsToPendingWithPendingClaim() {
        val viewModel = loaded()
        viewModel.addCertification()
        val state = viewModel.state.value as ProfessionalProfileUiState.Pending
        assertEquals(1, state.dirtyCount)
        assertEquals(1, state.pendingCount)
    }

    @Test fun updateYearsInRoleKeepsOnlyDigits() {
        val viewModel = loaded()
        viewModel.updateYearsInRole("12 years")
        val state = viewModel.state.value as ProfessionalProfileUiState.Pending
        assertEquals("12", state.content.yearsInRole.value)
        assertTrue(state.content.yearsInRole.isDirty)
    }

    @Test fun discardRevertsPendingSeedToPublishedBaseline() {
        val viewModel =
            loaded(
                seed = ProfessionalProfileSampleData.pendingEdits,
                baseline = ProfessionalProfileSampleData.published,
            )
        viewModel.discard()
        val state = viewModel.state.value as ProfessionalProfileUiState.Verified
        assertEquals(ProVerificationStatus.Verified, state.content.company.status)
        assertFalse(state.content.skills.any { it.label == "Tile work" })
    }

    @Test fun saveAndSubmitCommitsFreshMarkersButKeepsClaimsInReview() {
        val viewModel =
            loaded(
                seed = ProfessionalProfileSampleData.pendingEdits,
                baseline = ProfessionalProfileSampleData.published,
            )
        viewModel.saveAndSubmit()
        val state = viewModel.state.value as ProfessionalProfileUiState.Verified
        assertEquals(0, state.content.dirtyCount)
        assertEquals(2, state.content.pendingCount)
        assertFalse(state.content.skills.any { it.isFresh })
        assertEquals("Submitted — 2 claims in review.", viewModel.toast.value?.text)
    }

    @Test fun saveAndSubmitWhenCleanIsNoop() {
        val viewModel = loaded()
        viewModel.saveAndSubmit()
        assertTrue(viewModel.state.value is ProfessionalProfileUiState.Verified)
        assertNull(viewModel.toast.value)
    }

    // Live read-path

    @Test fun liveLoadHydratesFromProfileMe() =
        runTest {
            coEvery { repository.profileMe() } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(
                        ProfessionalProfileDto(
                            headline = "Licensed Handyman",
                            categories = listOf("handyman", "carpentry"),
                            serviceArea = ProfessionalServiceAreaDto(city = "Elm Park", state = "NY"),
                            isPublic = true,
                            isActive = true,
                            verificationStatus = "verified",
                        ),
                    ),
                )
            coEvery { repository.verificationStatus() } returns
                NetworkResult.Success(ProfessionalVerificationStatusResponse(tier = 2, status = "verified"))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()

            val state = viewModel.state.value as ProfessionalProfileUiState.Verified
            assertEquals("Licensed Handyman", state.content.title.value)
            assertEquals(2, state.content.skills.size)
            assertEquals(ProVerificationStatus.Verified, state.content.company.status)
        }

    @Test fun liveLoadFailureSurfacesError() =
        runTest {
            coEvery { repository.profileMe() } returns NetworkResult.Failure(NetworkError.Server(500, "boom"))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()

            assertTrue(viewModel.state.value is ProfessionalProfileUiState.Error)
        }

    // Enable / disable (T4)

    @Test fun nullProfileEntersCreateMode() =
        runTest {
            coEvery { repository.profileMe() } returns NetworkResult.Success(ProfessionalProfileResponse(null))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()

            val state = viewModel.state.value as ProfessionalProfileUiState.Create
            assertFalse(state.draft.isReEnable)
            assertEquals("Enable professional mode", state.draft.ctaLabel)
        }

    @Test fun notFoundEntersCreateModeRatherThanError() =
        runTest {
            coEvery { repository.profileMe() } returns NetworkResult.Failure(NetworkError.NotFound)

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()

            assertTrue(viewModel.state.value is ProfessionalProfileUiState.Create)
        }

    @Test fun inactiveProfileEntersReEnableModeSeededFromRecord() =
        runTest {
            coEvery { repository.profileMe() } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(
                        ProfessionalProfileDto(
                            headline = "Licensed Handyman",
                            bio = "Trades.",
                            categories = listOf("handyman"),
                            serviceArea = ProfessionalServiceAreaDto(city = "Elm Park", state = "NY", radiusKm = 25.0),
                            pricingMeta = ProfessionalPricingDto(hourlyRate = 85.0, currency = "USD"),
                            isPublic = false,
                            isActive = false,
                        ),
                    ),
                )

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()

            val draft = (viewModel.state.value as ProfessionalProfileUiState.Create).draft
            assertTrue(draft.isReEnable)
            assertEquals("Re-enable professional mode", draft.ctaLabel)
            assertEquals("Licensed Handyman", draft.headline)
            assertEquals(listOf("handyman"), draft.categories)
            assertEquals("25", draft.radiusKm)
            assertEquals("85", draft.hourlyRate)
        }

    @Test fun enablePostsProfileThenShowsEditor() =
        runTest {
            coEvery { repository.profileMe() } returns NetworkResult.Success(ProfessionalProfileResponse(null))
            coEvery { repository.createProfile(any()) } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(
                        ProfessionalProfileDto(headline = "Handy", categories = listOf("handyman"), isPublic = true, isActive = true),
                    ),
                )
            coEvery { repository.verificationStatus() } returns
                NetworkResult.Success(ProfessionalVerificationStatusResponse(tier = 0, status = "none"))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()
            viewModel.updateDraftHeadline("Handy")
            viewModel.toggleDraftCategory("handyman")
            viewModel.enable()

            val state = viewModel.state.value as ProfessionalProfileUiState.Verified
            assertEquals("Handy", state.content.title.value)
            assertEquals("Professional mode enabled", viewModel.toast.value?.text)
            coVerify {
                repository.createProfile(
                    match { it.headline == "Handy" && it.categories == listOf("handyman") && it.isPublic == true },
                )
            }
        }

    @Test fun reEnableSendsIsActiveTrue() =
        runTest {
            coEvery { repository.profileMe() } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(ProfessionalProfileDto(headline = "Handy", isActive = false)),
                )
            coEvery { repository.updateProfileMe(any()) } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(ProfessionalProfileDto(headline = "Handy", isActive = true, isPublic = true)),
                )
            coEvery { repository.verificationStatus() } returns
                NetworkResult.Success(ProfessionalVerificationStatusResponse(tier = 0, status = "none"))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()
            viewModel.enable()

            assertTrue(viewModel.state.value is ProfessionalProfileUiState.Verified)
            coVerify { repository.updateProfileMe(match { it.isActive == true }) }
        }

    @Test fun enableFailureKeepsCreateModeAndSurfacesMessage() =
        runTest {
            coEvery { repository.profileMe() } returns NetworkResult.Success(ProfessionalProfileResponse(null))
            coEvery { repository.createProfile(any()) } returns
                NetworkResult.Failure(NetworkError.ClientError(400, "{\"error\":\"Professional profile already exists\"}"))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()
            viewModel.enable()

            val draft = (viewModel.state.value as ProfessionalProfileUiState.Create).draft
            assertFalse(draft.isSubmitting)
            assertEquals("Professional profile already exists", draft.errorMessage)
            assertTrue(viewModel.toast.value?.isError == true)
        }

    @Test fun disableConfirmedDropsBackToReEnableMode() =
        runTest {
            coEvery { repository.profileMe() } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(
                        ProfessionalProfileDto(headline = "Licensed Handyman", isPublic = true, isActive = true),
                    ),
                )
            coEvery { repository.verificationStatus() } returns
                NetworkResult.Success(ProfessionalVerificationStatusResponse(tier = 0, status = "none"))
            coEvery { repository.disableProfile() } returns
                NetworkResult.Success(
                    ProfessionalProfileResponse(
                        ProfessionalProfileDto(headline = "Licensed Handyman", isPublic = false, isActive = false),
                    ),
                )

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()
            viewModel.requestDisable()
            assertTrue(viewModel.showsDisableConfirm.value)
            viewModel.disableConfirmed()

            val draft = (viewModel.state.value as ProfessionalProfileUiState.Create).draft
            assertTrue(draft.isReEnable)
            assertFalse(viewModel.showsDisableConfirm.value)
            assertEquals("Professional mode disabled", viewModel.toast.value?.text)
        }

    @Test fun categorySelectionIsCappedAtFive() =
        runTest {
            coEvery { repository.profileMe() } returns NetworkResult.Success(ProfessionalProfileResponse(null))

            val viewModel = ProfessionalProfileViewModel(repository)
            viewModel.load()
            ProfessionalCategory.all.take(6).forEach { viewModel.toggleDraftCategory(it.key) }

            val draft = (viewModel.state.value as ProfessionalProfileUiState.Create).draft
            assertEquals(ProfessionalCategory.SELECTION_LIMIT, draft.categories.size)

            viewModel.toggleDraftCategory(draft.categories.first())
            assertEquals(4, (viewModel.state.value as ProfessionalProfileUiState.Create).draft.categories.size)
        }

    @Test fun enableRequestOmitsBlankFieldsAndClampsRadius() {
        val request =
            ProfessionalProfileViewModel.enableRequest(
                ProfessionalEnableDraft(
                    headline = "  Handyman  ",
                    bio = "",
                    categories = listOf("handyman", "carpentry"),
                    city = "Elm Park",
                    state = "NY",
                    radiusKm = "",
                    hourlyRate = "85",
                    isPublic = false,
                ),
            )
        assertEquals("Handyman", request.headline)
        assertNull(request.bio)
        assertEquals(listOf("handyman", "carpentry"), request.categories)
        assertEquals(false, request.isPublic)
        assertEquals("Elm Park", request.serviceArea?.city)
        assertEquals(50, request.serviceArea?.radiusKm)
        assertEquals(85.0, request.pricingMeta?.hourlyRate ?: 0.0, 0.0)
        assertEquals("USD", request.pricingMeta?.currency)
    }

    @Test fun reEnableRequestSetsIsActiveTrue() {
        val request =
            ProfessionalProfileViewModel.updateRequest(
                ProfessionalEnableDraft(headline = "Handyman", isReEnable = true),
            )
        assertEquals(true, request.isActive)
        assertEquals("Handyman", request.headline)
    }
}
