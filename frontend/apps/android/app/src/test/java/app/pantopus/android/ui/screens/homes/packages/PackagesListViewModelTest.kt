@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.homes.packages

import androidx.lifecycle.SavedStateHandle
import app.pantopus.android.data.api.models.homes.GetHomePackagesResponse
import app.pantopus.android.data.api.models.homes.PackageDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.homes.HomesRepository
import app.pantopus.android.ui.components.StatusChipVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.FabTint
import app.pantopus.android.ui.screens.shared.list_of_rows.FabVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState
import app.pantopus.android.ui.screens.shared.list_of_rows.RowHighlight
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.Instant

/**
 * Covers the Packages VM (T6.3d / P14):
 *  - four-state transitions (loading / loaded / empty / error)
 *  - status taxonomy mapping (backend enum → PackageChipStatus)
 *  - row projection (title fallbacks, subtitle, body recipient)
 *  - tab filtering (Expected / Delivered / Archived buckets)
 *  - tab counts
 *  - banner summary projection
 *  - courier inference (one test per carrier)
 *  - FAB + topBarAction contract
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PackagesListViewModelTest {
    private val repo: HomesRepository = mockk()

    /** Fixed clock so banner counts are deterministic. */
    private val fixedNow: Instant = Instant.parse("2026-05-15T12:00:00Z")

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
    }

    @After fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun makePackage(
        id: String = "p",
        status: String = "expected",
        carrier: String? = null,
        trackingNumber: String? = null,
        description: String? = null,
        deliveryInstructions: String? = null,
        expectedAt: String? = null,
        pickedUpBy: String? = null,
    ) = PackageDto(
        id = id,
        homeId = "home-1",
        carrier = carrier,
        trackingNumber = trackingNumber,
        description = description,
        deliveryInstructions = deliveryInstructions,
        status = status,
        expectedAt = expectedAt,
        pickedUpBy = pickedUpBy,
    )

    private fun makeVm(): PackagesListViewModel =
        PackagesListViewModel(
            repo = repo,
            savedStateHandle = SavedStateHandle(mapOf(PACKAGES_HOME_ID_KEY to "home-1")),
            clock = { fixedNow },
        )

    // ─── Four states ───────────────────────────────────────────

    @Test fun empty_response_renders_empty_state() =
        runTest {
            coEvery { repo.getHomePackages(any(), any()) } returns
                NetworkResult.Success(GetHomePackagesResponse(packages = emptyList()))
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Empty)
            val empty = state as ListOfRowsUiState.Empty
            assertEquals("No packages tracked yet", empty.headline)
            assertEquals("Log a package", empty.ctaTitle)
        }

    @Test fun error_response_renders_error_state() =
        runTest {
            coEvery { repo.getHomePackages(any(), any()) } returns
                NetworkResult.Failure(NetworkError.Server(500, "boom"))
            val vm = makeVm()
            vm.load()
            assertTrue(vm.state.value is ListOfRowsUiState.Error)
        }

    @Test fun loaded_response_maps_rows_to_status_chip_trailing() =
        runTest {
            coEvery { repo.getHomePackages(any(), any()) } returns
                NetworkResult.Success(
                    GetHomePackagesResponse(
                        packages =
                            listOf(
                                makePackage(
                                    id = "p1",
                                    status = "out_for_delivery",
                                    carrier = "USPS",
                                    trackingNumber = "9405 5118 4471",
                                    description = "Birthday cards",
                                    deliveryInstructions = "Mailbox",
                                ),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertFalse(loaded.hasMore)
            assertEquals(1, loaded.sections[0].rows.size)
            val row = loaded.sections[0].rows[0]
            assertEquals("p1", row.id)
            assertEquals("Birthday cards", row.title)
            assertEquals("USPS · Mailbox", row.subtitle)
            val trailing = row.trailing
            assertTrue(trailing is RowTrailing.Status)
            val chip = trailing as RowTrailing.Status
            assertEquals("Out for delivery", chip.text)
            assertEquals(StatusChipVariant.Info, chip.variant)
            val leading = row.leading
            assertTrue(leading is RowLeading.TypeIcon)
            val typeIcon = leading as RowLeading.TypeIcon
            assertEquals(PantopusIcon.Mailbox, typeIcon.icon)
        }

    // ─── Status mapping ────────────────────────────────────────

    @Test fun status_mapping_covers_all_six_backend_values() {
        assertEquals(PackageChipStatus.Expected, PackageChipStatus.from("expected"))
        assertEquals(PackageChipStatus.OutForDelivery, PackageChipStatus.from("out_for_delivery"))
        assertEquals(PackageChipStatus.Delivered, PackageChipStatus.from("delivered"))
        assertEquals(PackageChipStatus.PickedUp, PackageChipStatus.from("picked_up"))
        assertEquals(PackageChipStatus.Lost, PackageChipStatus.from("lost"))
        assertEquals(PackageChipStatus.Returned, PackageChipStatus.from("returned"))
    }

    @Test fun unknown_status_falls_back_to_expected() {
        assertEquals(PackageChipStatus.Expected, PackageChipStatus.from(null))
        assertEquals(PackageChipStatus.Expected, PackageChipStatus.from("bogus"))
    }

    @Test fun status_to_tab_buckets() {
        assertEquals(PackagesTab.Expected, PackageChipStatus.Expected.tab)
        assertEquals(PackagesTab.Expected, PackageChipStatus.OutForDelivery.tab)
        assertEquals(PackagesTab.Delivered, PackageChipStatus.Delivered.tab)
        assertEquals(PackagesTab.Delivered, PackageChipStatus.PickedUp.tab)
        assertEquals(PackagesTab.Archived, PackageChipStatus.Lost.tab)
        assertEquals(PackagesTab.Archived, PackageChipStatus.Returned.tab)
    }

    // ─── Per-row projection ────────────────────────────────────

    @Test fun title_fallbacks_to_tracking_short_when_description_missing() {
        val projection =
            PackagesListViewModel.project(
                pkg = makePackage(trackingNumber = "1Z9X4 W84 2218"),
                currentUserId = null,
                memberLookup = { null },
            )
        assertEquals("Tracking #…W842218", projection.title)
    }

    @Test fun title_fallbacks_to_package_when_both_missing() {
        val projection =
            PackagesListViewModel.project(
                pkg = makePackage(carrier = "Amazon"),
                currentUserId = null,
                memberLookup = { null },
            )
        assertEquals("Package", projection.title)
    }

    @Test fun subtitle_combines_courier_and_drop() {
        val projection =
            PackagesListViewModel.project(
                pkg =
                    makePackage(
                        carrier = "FedEx",
                        description = "Side table",
                        deliveryInstructions = "Front porch",
                    ),
                currentUserId = null,
                memberLookup = { null },
            )
        assertEquals("FedEx · Front porch", projection.subtitle)
    }

    @Test fun subtitle_omits_drop_when_missing() {
        val projection =
            PackagesListViewModel.project(
                pkg = makePackage(carrier = "Amazon", description = "Cat food"),
                currentUserId = null,
                memberLookup = { null },
            )
        assertEquals("Amazon", projection.subtitle)
    }

    @Test fun body_renders_recipient_for_other_user() {
        val projection =
            PackagesListViewModel.project(
                pkg =
                    makePackage(
                        status = "picked_up",
                        description = "Jacket",
                        pickedUpBy = "user-ava",
                    ),
                currentUserId = "viewer",
                memberLookup = { if (it == "user-ava") "Ava" else null },
            )
        assertEquals("Picked up by Ava", projection.body)
    }

    @Test fun body_omits_recipient_when_picked_up_by_current_user() {
        val projection =
            PackagesListViewModel.project(
                pkg =
                    makePackage(
                        status = "picked_up",
                        description = "Jacket",
                        pickedUpBy = "viewer",
                    ),
                currentUserId = "viewer",
                memberLookup = { "Maria" },
            )
        assertNull(projection.body)
    }

    @Test fun returned_status_gets_muted_highlight() {
        val projection =
            PackagesListViewModel.project(
                pkg = makePackage(status = "returned"),
                currentUserId = null,
                memberLookup = { null },
            )
        assertEquals(RowHighlight.Muted, projection.highlight)
        assertEquals(StatusChipVariant.Neutral, projection.chipVariant)
    }

    // ─── Courier inference ────────────────────────────────────

    @Test fun courier_inference_amazon() {
        assertEquals(CourierKind.Amazon, CourierKind.from("Amazon Logistics"))
        assertEquals(CourierKind.Amazon, CourierKind.from("amzl"))
    }

    @Test fun courier_inference_usps() {
        assertEquals(CourierKind.Usps, CourierKind.from("USPS"))
        assertEquals(CourierKind.Usps, CourierKind.from("United States Postal Service"))
    }

    @Test fun courier_inference_ups() {
        assertEquals(CourierKind.Ups, CourierKind.from("UPS"))
    }

    @Test fun courier_inference_fedex() {
        assertEquals(CourierKind.Fedex, CourierKind.from("FedEx Ground"))
        assertEquals(CourierKind.Fedex, CourierKind.from("Fed Ex"))
    }

    @Test fun courier_inference_dhl() {
        assertEquals(CourierKind.Dhl, CourierKind.from("DHL Express"))
    }

    @Test fun courier_inference_falls_back_to_generic() {
        assertEquals(CourierKind.Generic, CourierKind.from(null))
        assertEquals(CourierKind.Generic, CourierKind.from(""))
        assertEquals(CourierKind.Generic, CourierKind.from("Some niche carrier"))
    }

    // ─── Tab filtering + counts ───────────────────────────────

    @Test fun tab_counts_match_each_bucket() =
        runTest {
            coEvery { repo.getHomePackages(any(), any()) } returns
                NetworkResult.Success(
                    GetHomePackagesResponse(
                        packages =
                            listOf(
                                makePackage(id = "a", status = "expected"),
                                makePackage(id = "b", status = "out_for_delivery"),
                                makePackage(id = "c", status = "delivered"),
                                makePackage(id = "d", status = "picked_up"),
                                makePackage(id = "e", status = "picked_up"),
                                makePackage(id = "f", status = "lost"),
                                makePackage(id = "g", status = "returned"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            val tabs = vm.tabs.value
            assertEquals(3, tabs.size)
            assertEquals("Expected", tabs[0].label)
            assertEquals(2, tabs[0].count)
            assertEquals("Delivered", tabs[1].label)
            assertEquals(3, tabs[1].count)
            assertEquals("Archived", tabs[2].label)
            assertEquals(2, tabs[2].count)
        }

    @Test fun tab_switch_filters_without_refetch() =
        runTest {
            coEvery { repo.getHomePackages(any(), any()) } returns
                NetworkResult.Success(
                    GetHomePackagesResponse(
                        packages =
                            listOf(
                                makePackage(id = "in1", status = "expected"),
                                makePackage(id = "in2", status = "out_for_delivery"),
                                makePackage(id = "done", status = "delivered"),
                            ),
                    ),
                )
            val vm = makeVm()
            vm.load()
            vm.selectTab(PackagesTab.Delivered.id)
            val state = vm.state.value
            assertTrue(state is ListOfRowsUiState.Loaded)
            val loaded = state as ListOfRowsUiState.Loaded
            assertEquals(1, loaded.sections[0].rows.size)
            assertEquals("done", loaded.sections[0].rows[0].id)
        }

    // ─── Banner summary ───────────────────────────────────────

    @Test fun banner_summarizes_in_flight_and_exceptions() {
        val packages =
            listOf(
                makePackage(id = "a", status = "expected", expectedAt = "2026-05-15T20:00:00Z"),
                makePackage(id = "b", status = "out_for_delivery", expectedAt = "2026-05-15T18:00:00Z"),
                makePackage(id = "c", status = "expected", expectedAt = "2026-05-20T10:00:00Z"),
                makePackage(id = "d", status = "lost"),
                makePackage(id = "e", status = "delivered"),
            )
        val summary = PackagesListViewModel.summarize(packages, fixedNow)
        assertEquals(3, summary.inFlightCount)
        assertEquals(2, summary.arrivingTodayCount)
        assertEquals(1, summary.exceptionCount)
        assertTrue(summary.hasContent)
    }

    @Test fun banner_empty_when_no_in_flight_and_no_exception() {
        val packages =
            listOf(
                makePackage(id = "a", status = "delivered"),
                makePackage(id = "b", status = "picked_up"),
            )
        val summary = PackagesListViewModel.summarize(packages, fixedNow)
        assertEquals(0, summary.inFlightCount)
        assertEquals(0, summary.exceptionCount)
        assertFalse(summary.hasContent)
    }

    // ─── FAB + topBarAction contract ──────────────────────────

    @Test fun fab_is_canonical_create_with_home_tint() {
        val vm = makeVm()
        val fab = vm.fab()
        assertNotNull(fab)
        assertEquals("Log a package", fab.contentDescription)
        assertEquals(PantopusIcon.Plus, fab.icon)
        assertEquals(FabTint.Home, fab.tint)
        assertEquals(FabVariant.CanonicalCreate, fab.variant)
    }

    @Test fun top_bar_action_is_null() {
        val vm = makeVm()
        assertNull(vm.topBarAction)
    }
}
