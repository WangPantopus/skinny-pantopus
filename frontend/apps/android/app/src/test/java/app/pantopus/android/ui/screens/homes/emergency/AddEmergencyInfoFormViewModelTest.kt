@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.CreateEmergencyResponse
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import app.pantopus.android.data.api.models.homes.OccupantDto
import app.pantopus.android.data.api.models.homes.OccupantsResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomeMembersRepository
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

/**
 * P2.8 — Add / Edit Emergency Info form view-model coverage:
 *  - title required + max-length validation
 *  - severity is cleared automatically when category doesn't support
 *    severity
 *  - details map composes the severity / verified-by keys the detail
 *    surface reads
 *  - submit POSTs in create mode and calls `onCreated`
 *  - edit mode commits locally and surfaces the new draft to
 *    `onUpdated`
 *  - every category × severity round-trip is stable (the snapshot
 *    equivalent — we can't generate iOS PNGs here, but the projection
 *    contract is locked)
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AddEmergencyInfoFormViewModelTest {
    private val homesRepo: HomesRepository = mockk()
    private val membersRepo: HomeMembersRepository = mockk()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        coEvery { membersRepo.listOccupants(any()) } returns NetworkResult.Success(OccupantsResponse())
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(
        editDraft: EmergencyFormDraft? = null,
        onCreated: (HomeEmergencyDto) -> Unit = {},
        onUpdated: (EmergencyFormDraft) -> Unit = {},
    ): AddEmergencyInfoFormViewModel {
        val vm =
            AddEmergencyInfoFormViewModel(
                homesRepo = homesRepo,
                membersRepo = membersRepo,
                savedStateHandle = SavedStateHandle(mapOf(ADD_EMERGENCY_HOME_ID_KEY to "home-1")),
            )
        vm.configure(editDraft = editDraft, onCreated = onCreated, onUpdated = onUpdated)
        return vm
    }

    // MARK: - Validation

    @Test
    fun emptyTitleBlocksValid() =
        runTest {
            val vm = makeVm()
            assertFalse(vm.state.value.isValid)
            vm.updateTitle("")
            assertFalse(vm.state.value.isValid)
            assertNotNull(vm.state.value.titleField.error)
        }

    @Test
    fun titlePresenceMakesFormValid() =
        runTest {
            val vm = makeVm()
            vm.updateTitle("Penicillin allergy")
            assertTrue(vm.state.value.isValid)
            assertTrue(vm.state.value.isDirty)
        }

    @Test
    fun titleMaxLengthValidates() =
        runTest {
            val vm = makeVm()
            vm.updateTitle("a".repeat(256))
            assertEquals("Title is too long.", vm.state.value.titleField.error)
        }

    @Test
    fun detailsMaxLengthValidates() =
        runTest {
            val vm = makeVm()
            vm.updateTitle("Asthma")
            vm.updateDetails("a".repeat(2001))
            assertEquals("Details are too long.", vm.state.value.detailsField.error)
            assertFalse(vm.state.value.isValid)
        }

    // MARK: - Category × severity behaviour

    @Test
    fun categoryWithoutSeverityClearsSeverity() =
        runTest {
            val vm = makeVm()
            vm.setCategory(EmergencyFormCategory.Allergy)
            vm.setSeverity(EmergencySeverity.Critical)
            vm.setCategory(EmergencyFormCategory.Contact)
            assertNull("Switching to contact must drop severity", vm.state.value.severity)
        }

    @Test
    fun categoryFlagsForSeveritySupport() {
        assertTrue(EmergencyFormCategory.Allergy.supportsSeverity)
        assertTrue(EmergencyFormCategory.MedicalCondition.supportsSeverity)
        assertTrue(EmergencyFormCategory.Medication.supportsSeverity)
        assertTrue(EmergencyFormCategory.PetMedical.supportsSeverity)
        assertTrue(EmergencyFormCategory.Other.supportsSeverity)
        assertFalse(EmergencyFormCategory.Contact.supportsSeverity)
        assertFalse(EmergencyFormCategory.PowerOfAttorney.supportsSeverity)
    }

    @Test
    fun categoryPaletteMapping() {
        assertEquals(EmergencyCategory.Medical, EmergencyFormCategory.Allergy.palette)
        assertEquals(EmergencyCategory.Medical, EmergencyFormCategory.MedicalCondition.palette)
        assertEquals(EmergencyCategory.Medical, EmergencyFormCategory.Medication.palette)
        assertEquals(EmergencyCategory.Medical, EmergencyFormCategory.PetMedical.palette)
        assertEquals(EmergencyCategory.Contact, EmergencyFormCategory.Contact.palette)
        assertEquals(EmergencyCategory.Contact, EmergencyFormCategory.PowerOfAttorney.palette)
        assertEquals(EmergencyCategory.Contact, EmergencyFormCategory.Other.palette)
    }

    // MARK: - Details map composition

    @Test
    fun detailsMapIncludesSeverityAndVerifiedBy() =
        runTest {
            val vm = makeVm()
            vm.setCategory(EmergencyFormCategory.Allergy)
            vm.updateTitle("Penicillin")
            vm.updateDetails("Hives + throat swelling — EpiPen in go-bag.")
            vm.setSeverity(EmergencySeverity.Critical)
            vm.setVerifiedBy("user-1")
            val map = vm.buildDetailsMap()
            assertEquals("Hives + throat swelling — EpiPen in go-bag.", map["detail"])
            assertEquals("critical", map["severity"])
            assertEquals("user-1", map["verified_by"])
        }

    @Test
    fun detailsMapOmitsNilFields() =
        runTest {
            val vm = makeVm()
            vm.updateTitle("Asthma")
            val map = vm.buildDetailsMap()
            assertNull(map["detail"])
            assertNull(map["severity"])
            assertNull(map["verified_by"])
        }

    // MARK: - Submit

    @Test
    fun submitCreatePostsAndCallsOnCreated() =
        runTest {
            var captured: HomeEmergencyDto? = null
            val vm = makeVm(onCreated = { captured = it })
            vm.setCategory(EmergencyFormCategory.Allergy)
            vm.setSeverity(EmergencySeverity.Critical)
            vm.updateTitle("Penicillin allergy")
            vm.updateDetails("Hives + throat swelling.")

            coEvery { homesRepo.createHomeEmergency(any(), any()) } returns
                NetworkResult.Success(
                    CreateEmergencyResponse(
                        emergency =
                            HomeEmergencyDto(
                                id = "e-1",
                                homeId = "home-1",
                                type = "allergy",
                                label = "Penicillin allergy",
                                location = null,
                                details = mapOf("severity" to "critical", "detail" to "Hives."),
                                createdAt = null,
                                updatedAt = null,
                            ),
                    ),
                )
            vm.submit()
            assertEquals("e-1", captured?.id)
            assertTrue(vm.state.value.shouldDismiss)
        }

    @Test
    fun submitCreateSurfacesNetworkError() =
        runTest {
            val vm = makeVm()
            vm.updateTitle("Penicillin")
            coEvery { homesRepo.createHomeEmergency(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            vm.submit()
            assertNotNull(vm.state.value.toast)
            assertTrue(vm.state.value.toast?.isError == true)
        }

    @Test
    fun editModeCommitsLocallyAndSurfacesDraft() =
        runTest {
            var captured: EmergencyFormDraft? = null
            val seed =
                EmergencyFormDraft(
                    id = "e-1",
                    category = EmergencyFormCategory.MedicalCondition,
                    title = "Asthma",
                    severity = EmergencySeverity.Caution,
                    details = "Inhaler in go-bag.",
                    verifiedByUserId = null,
                    lastUpdated = Instant.ofEpochSecond(1_700_000_000),
                )
            val vm = makeVm(editDraft = seed, onUpdated = { captured = it })
            vm.setSeverity(EmergencySeverity.Critical)
            vm.submit()
            assertEquals(EmergencySeverity.Critical, captured?.severity)
            assertTrue(vm.state.value.shouldDismiss)
        }

    // MARK: - Per-(category, severity) coverage

    @Test
    fun allCategoryAndSeverityCombinationsProduceStableDetailMaps() =
        runTest {
            EmergencyFormCategory.entries.forEach { category ->
                val severities: List<EmergencySeverity?> =
                    if (category.supportsSeverity) {
                        EmergencySeverity.entries.toList()
                    } else {
                        listOf(null)
                    }
                severities.forEach { severity ->
                    val vm = makeVm()
                    vm.setCategory(category)
                    vm.setSeverity(severity)
                    vm.updateTitle("${category.label} — sample")
                    vm.updateDetails("Reference body for ${category.label}")
                    val map = vm.buildDetailsMap()
                    assertEquals(
                        "Detail body must survive for $category × $severity",
                        "Reference body for ${category.label}",
                        map["detail"],
                    )
                    if (severity != null) {
                        assertEquals(
                            "Severity must serialise for $category × $severity",
                            severity.id,
                            map["severity"],
                        )
                    } else {
                        assertNull(
                            "Categories without severity must drop the chip key ($category)",
                            map["severity"],
                        )
                    }
                }
            }
        }

    @Test
    fun criticalSeverityUsesAlertTriangleIcon() {
        // Lock the acceptance criteria — critical pairs with the
        // alert-triangle glyph on top of the error-bg fill.
        assertEquals(
            "Critical must pair with the alert-triangle glyph",
            app.pantopus.android.ui.theme.PantopusIcon.AlertTriangle,
            EmergencySeverity.Critical.icon,
        )
    }

    @Test
    fun loadMembersFiltersInactive() =
        runTest {
            coEvery { membersRepo.listOccupants(any()) } returns
                NetworkResult.Success(
                    OccupantsResponse(
                        occupants =
                            listOf(
                                OccupantDto(
                                    id = "o-1",
                                    userId = "u-1",
                                    isActive = true,
                                    displayName = "Alice",
                                ),
                                OccupantDto(
                                    id = "o-2",
                                    userId = "u-2",
                                    isActive = false,
                                    displayName = "Bob",
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.loadMembers()
            // Members load is launched into viewModelScope; under the
            // unconfined dispatcher it resolves synchronously.
            assertEquals(1, vm.state.value.members.size)
            assertEquals("u-1", vm.state.value.members.first().userId)
        }
}
