@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeEmergenciesResponse
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

/**
 * P2.8 — Detail view-model coverage:
 *   - load finds the item by id and projects a draft
 *   - missing rows flip to the Missing state
 *   - errors flip to Error
 *   - apply(updated) swaps the loaded draft optimistically
 *   - confirmDelete flips `isDeleted`
 *   - legacy backend types (`shutoff_water` etc.) still render
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EmergencyInfoDetailViewModelTest {
    private val repo: HomesRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(emergencyId: String = "e-1"): EmergencyInfoDetailViewModel =
        EmergencyInfoDetailViewModel(
            repo = repo,
            savedStateHandle =
                SavedStateHandle(
                    mapOf(
                        EMERGENCY_DETAIL_HOME_ID_KEY to "home-1",
                        EMERGENCY_DETAIL_ITEM_ID_KEY to emergencyId,
                    ),
                ),
        )

    @Test
    fun loadFindsRowAndProjectsDraft() =
        runTest {
            coEvery { repo.getHomeEmergencies("home-1") } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        emergencies =
                            listOf(
                                HomeEmergencyDto(
                                    id = "e-1",
                                    homeId = "home-1",
                                    type = "allergy",
                                    label = "Penicillin",
                                    location = null,
                                    details = mapOf("severity" to "critical", "detail" to "EpiPen"),
                                    createdAt = null,
                                    updatedAt = null,
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as EmergencyInfoDetailUiState.Loaded
            assertEquals("Penicillin", loaded.draft.title)
            assertEquals(EmergencyFormCategory.Allergy, loaded.draft.category)
            assertEquals(EmergencySeverity.Critical, loaded.draft.severity)
        }

    @Test
    fun loadMissingRowFlipsToMissing() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(GetHomeEmergenciesResponse(emergencies = emptyList()))
            val vm = makeVm()
            vm.load()
            assertEquals(EmergencyInfoDetailUiState.Missing, vm.state.value)
        }

    @Test
    fun loadErrorFlipsToError() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is EmergencyInfoDetailUiState.Error)
        }

    @Test
    fun legacyTypeStillRendersAsOther() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        emergencies =
                            listOf(
                                HomeEmergencyDto(
                                    id = "e-1",
                                    homeId = "home-1",
                                    type = "shutoff_water",
                                    label = "Main water",
                                    location = "Basement closet",
                                    details = mapOf("detail" to "Behind heater"),
                                    createdAt = null,
                                    updatedAt = null,
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val loaded = vm.state.value as EmergencyInfoDetailUiState.Loaded
            assertEquals(EmergencyFormCategory.Other, loaded.draft.category)
            assertEquals("Behind heater", loaded.draft.details)
        }

    @Test
    fun applyUpdatedSwapsLoadedDraft() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        emergencies =
                            listOf(
                                HomeEmergencyDto(
                                    id = "e-1",
                                    homeId = "home-1",
                                    type = "medication",
                                    label = "Metformin",
                                    location = null,
                                    details = mapOf("detail" to "Daily 500mg"),
                                    createdAt = null,
                                    updatedAt = null,
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val updated =
                EmergencyFormDraft(
                    id = "e-1",
                    category = EmergencyFormCategory.Medication,
                    title = "Metformin XR",
                    severity = EmergencySeverity.Caution,
                    details = "1g nightly",
                    verifiedByUserId = null,
                    lastUpdated = Instant.now(),
                )
            vm.apply(updated)
            val loaded = vm.state.value as EmergencyInfoDetailUiState.Loaded
            assertEquals("Metformin XR", loaded.draft.title)
            assertEquals(EmergencySeverity.Caution, loaded.draft.severity)
        }

    @Test
    fun confirmDeleteFlipsDeletedFlag() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        emergencies =
                            listOf(
                                HomeEmergencyDto(
                                    id = "e-1",
                                    homeId = "home-1",
                                    type = "contact",
                                    label = "Dr. Lin",
                                    location = null,
                                    details = emptyMap(),
                                    createdAt = null,
                                    updatedAt = null,
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.showDeleteConfirm()
            vm.confirmDelete()
            assertTrue(vm.isDeleted.value)
            val loaded = vm.state.value as EmergencyInfoDetailUiState.Loaded
            assertFalse(loaded.showsDeleteConfirm)
        }

    @Test
    fun emergencyFormDraftFromDtoPreservesAllFields() {
        val dto =
            HomeEmergencyDto(
                id = "e-1",
                homeId = "home-1",
                type = "pet_medical",
                label = "Murphy — chicken allergy",
                location = null,
                details =
                    mapOf(
                        "detail" to "Hives if exposed",
                        "severity" to "caution",
                        "verified_by" to "user-2",
                    ),
                createdAt = null,
                updatedAt = null,
            )
        val draft = EmergencyFormDraft.from(dto)
        assertEquals(EmergencyFormCategory.PetMedical, draft?.category)
        assertEquals(EmergencySeverity.Caution, draft?.severity)
        assertEquals("user-2", draft?.verifiedByUserId)
    }
}
