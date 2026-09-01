@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.emergency

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomeEmergenciesResponse
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.theme.PantopusIcon
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
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * Covers the Emergency info VM (T6.4b / P17):
 *  - four-state transitions (loading / loaded / empty / error)
 *  - category bucket mapping from `HomeEmergency.type`
 *  - per-type glyph
 *  - chip filter narrows visible sections
 *  - pinned pseudo-group renders only on the "All" chip
 *  - banner summary projection
 */
@OptIn(ExperimentalCoroutinesApi::class)
class EmergencyInfoViewModelTest {
    private val repo: HomesRepository = mockk()

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makeVm(): EmergencyInfoViewModel =
        EmergencyInfoViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(EMERGENCY_HOME_ID_KEY to "home-1")),
        )

    private fun dto(
        id: String = "e1",
        type: String,
        label: String = "Item",
        location: String? = null,
        details: Map<String, String> = emptyMap(),
    ): HomeEmergencyDto =
        HomeEmergencyDto(
            id = id,
            homeId = "home-1",
            type = type,
            label = label,
            location = location,
            details = details,
            createdAt = null,
            updatedAt = null,
        )

    // ─── Four states ───────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(GetHomeEmergenciesResponse(emergencies = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            assertEquals("No emergency info set up", (state as ListOfRowsUiState.Empty).headline)
            assertEquals("Add info", state.ctaTitle)
        }

    @Test fun failure_renders_error_state() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, null))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_buckets_by_category() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        listOf(
                            dto("e1", "shutoff_water", label = "Main water"),
                            dto("e2", "emergency_contacts", label = "911"),
                            dto("e3", "evac_plan", label = "Meeting spot"),
                            dto("e4", "first_aid", label = "Kit"),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val sections = (state as ListOfRowsUiState.Loaded).sections
            assertEquals(4, sections.size)
            assertEquals(listOf("Shutoffs", "Contacts", "Evacuation", "Medical"), sections.map { it.header })
        }

    // ─── Category mapping ─────────────────────────────────────

    @Test fun category_mapping_for_backend_types() {
        assertEquals(EmergencyCategory.Shutoff, EmergencyCategory.fromType("shutoff_water"))
        assertEquals(EmergencyCategory.Shutoff, EmergencyCategory.fromType("shutoff_gas"))
        assertEquals(EmergencyCategory.Shutoff, EmergencyCategory.fromType("shutoff_electric"))
        assertEquals(EmergencyCategory.Shutoff, EmergencyCategory.fromType("breaker_map"))
        assertEquals(EmergencyCategory.Contact, EmergencyCategory.fromType("emergency_contacts"))
        assertEquals(EmergencyCategory.Evac, EmergencyCategory.fromType("evac_plan"))
        assertEquals(EmergencyCategory.Medical, EmergencyCategory.fromType("first_aid"))
        assertEquals(EmergencyCategory.Medical, EmergencyCategory.fromType("extinguisher"))
        // Unknown / "other" falls back to .Contact (safest household default).
        assertEquals(EmergencyCategory.Contact, EmergencyCategory.fromType("other"))
        assertEquals(EmergencyCategory.Contact, EmergencyCategory.fromType("unknown_value"))
    }

    @Test fun category_glyph_per_type() {
        assertEquals(PantopusIcon.Droplet, EmergencyCategory.glyph(forType = "shutoff_water"))
        assertEquals(PantopusIcon.Flame, EmergencyCategory.glyph(forType = "shutoff_gas"))
        assertEquals(PantopusIcon.Zap, EmergencyCategory.glyph(forType = "shutoff_electric"))
        assertEquals(PantopusIcon.Flag, EmergencyCategory.glyph(forType = "evac_plan"))
        assertEquals(PantopusIcon.Phone, EmergencyCategory.glyph(forType = "emergency_contacts"))
        assertEquals(PantopusIcon.Cross, EmergencyCategory.glyph(forType = "first_aid"))
    }

    // ─── Projection ─────────────────────────────────────────

    @Test fun projection_fills_body_and_chips() {
        val item =
            dto(
                type = "emergency_contacts",
                label = "911",
                details = mapOf("phone" to "911", "detail" to "Dispatcher will ask address."),
            )
        val projection = EmergencyInfoViewModel.project(item, pinned = false)
        assertEquals("911", projection.title)
        assertEquals(EmergencyCategory.Contact, projection.category)
        assertEquals(PantopusIcon.Phone, projection.glyph)
        assertEquals("Dispatcher will ask address.", projection.body)
        assertEquals(PantopusIcon.Phone, projection.bodyIcon)
        assertEquals("911", projection.actionTarget)
        assertFalse(projection.needsReview)
    }

    @Test fun projection_reviewed_and_needs_review() {
        val reviewed =
            dto(
                type = "shutoff_water",
                details = mapOf("reviewed" to "Aug 14", "detail" to "Basement closet"),
            )
        val p1 = EmergencyInfoViewModel.project(reviewed, pinned = false)
        assertEquals("Reviewed Aug 14", p1.lastReviewed)
        assertFalse(p1.needsReview)

        val dueForReview =
            dto(
                type = "shutoff_water",
                details = mapOf("needs_review" to "1", "detail" to "Behind fridge"),
            )
        val p2 = EmergencyInfoViewModel.project(dueForReview, pinned = false)
        assertTrue(p2.needsReview)
    }

    // ─── Chip filter ─────────────────────────────────────────

    @Test fun chip_filter_narrows_to_category() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        listOf(
                            dto("e1", "shutoff_water", label = "Main water"),
                            dto("e2", "emergency_contacts", label = "911"),
                            dto("e3", "evac_plan", label = "Meeting spot"),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.selectFilter(EmergencyFilter.Contact.id)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val sections = (state as ListOfRowsUiState.Loaded).sections
            assertEquals(1, sections.size)
            assertEquals("Contacts", sections[0].header)
            assertEquals(1, sections[0].rows.size)
        }

    // ─── Pinned pseudo-group ─────────────────────────────────

    @Test fun pinned_section_appears_on_all_chip_only() =
        runTest {
            coEvery { repo.getHomeEmergencies(any()) } returns
                NetworkResult.Success(
                    GetHomeEmergenciesResponse(
                        listOf(
                            dto(
                                "e1",
                                "shutoff_water",
                                label = "Main water",
                                details = mapOf("pinned" to "1"),
                            ),
                            dto("e2", "emergency_contacts", label = "911"),
                        ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val allState = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("Pinned · Quick access", allState.sections.first().header)

            vm.selectFilter(EmergencyFilter.Shutoff.id)
            val filtered = vm.state.value as ListOfRowsUiState.Loaded
            assertEquals("Shutoffs", filtered.sections.first().header)
            assertNotEquals("Pinned · Quick access", filtered.sections.first().header)
        }

    // ─── Banner summary ─────────────────────────────────────

    @Test fun banner_summary_no_review() {
        val items =
            listOf(
                dto("e1", "shutoff_water", details = mapOf("reviewed" to "Aug 14")),
                dto("e2", "emergency_contacts", details = mapOf("reviewed" to "Aug 14")),
            )
        val summary = EmergencyInfoViewModel.summarize(items)
        assertEquals(2, summary.totalItems)
        assertEquals(0, summary.needsReviewCount)
        assertEquals("reviewed Aug 14", summary.lastReviewedLabel)
        assertTrue(summary.hasContent)
    }

    @Test fun banner_summary_with_review_backlog() {
        val items =
            listOf(
                dto("e1", "shutoff_water", details = mapOf("needs_review" to "1")),
                dto("e2", "emergency_contacts", details = mapOf("reviewed" to "Aug 14")),
            )
        val summary = EmergencyInfoViewModel.summarize(items)
        assertEquals(1, summary.needsReviewCount)
        assertEquals("reviewed Aug 14", summary.lastReviewedLabel)
    }
}
